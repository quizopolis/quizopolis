/*
  Μικρός δημιουργός κωδικών QR για την προβολή στην τάξη.
  Κωδικοποίηση byte (UTF-8), διόρθωση σφαλμάτων επιπέδου M, εκδόσεις 1–10
  (αρκεί για διευθύνσεις έως ~210 χαρακτήρες). Δεν χρειάζεται σύνδεση στο διαδίκτυο.
*/
(function () {
  'use strict';

  var ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var MAX_VERSION = 10;
  var FORMAT_ECL_BITS = 0; // επίπεδο M

  function rawDataModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function numDataCodewords(ver) {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];
  }

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    var res = [];
    for (var i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (var k = 0; k < degree; k++) {
      for (var j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }

  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (coef, i) { res[i] ^= gfMul(coef, factor); });
    });
    return res;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder === 'function') return Array.prototype.slice.call(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str));
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6];
    for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  function encode(text) {
    var bytes = utf8Bytes(String(text));
    var ver = 1;
    for (; ver <= MAX_VERSION; ver++) {
      var needBits = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
      if (needBits <= numDataCodewords(ver) * 8) break;
    }
    if (ver > MAX_VERSION) return null;

    // 1. Data bits
    var bits = [];
    var push = function (val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var capBits = numDataCodewords(ver) * 8;
    push(0, Math.min(4, capBits - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      data.push(v);
    }

    // 2. Error correction and interleaving
    var numBlocks = NUM_BLOCKS[ver];
    var blockEccLen = ECC_PER_BLOCK[ver];
    var rawCodewords = Math.floor(rawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsDivisor(blockEccLen);
    var blocks = [];
    for (var b = 0, k = 0; b < numBlocks; b++) {
      var dat = data.slice(k, k + shortBlockLen - blockEccLen + (b < numShortBlocks ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, divisor);
      if (b < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var codewords = [];
    for (var c = 0; c < blocks[0].length; c++) {
      for (var bl = 0; bl < blocks.length; bl++) {
        if (c !== shortBlockLen - blockEccLen || bl >= numShortBlocks) codewords.push(blocks[bl][c]);
      }
    }

    // 3. Matrix with function patterns
    var size = ver * 4 + 17;
    var modules = [];
    var isFn = [];
    for (var y0 = 0; y0 < size; y0++) {
      var row = [], frow = [];
      for (var x0 = 0; x0 < size; x0++) { row.push(false); frow.push(false); }
      modules.push(row);
      isFn.push(frow);
    }
    var setFn = function (x, y, dark) { modules[y][x] = dark; isFn[y][x] = true; };

    for (var t = 0; t < size; t++) { setFn(6, t, t % 2 === 0); setFn(t, 6, t % 2 === 0); }

    var finder = function (cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var d = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, d !== 2 && d !== 4);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);

    var ap = alignmentPositions(ver, size);
    var na = ap.length;
    for (var ai = 0; ai < na; ai++) {
      for (var aj = 0; aj < na; aj++) {
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === na - 1) || (ai === na - 1 && aj === 0)) continue;
        for (var ady = -2; ady <= 2; ady++) {
          for (var adx = -2; adx <= 2; adx++) {
            setFn(ap[ai] + adx, ap[aj] + ady, Math.max(Math.abs(adx), Math.abs(ady)) !== 1);
          }
        }
      }
    }

    var drawFormat = function (mask) {
      var d = (FORMAT_ECL_BITS << 3) | mask;
      var rem = d;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = ((d << 10) | rem) ^ 0x5412;
      var bit = function (i) { return ((fb >>> i) & 1) !== 0; };
      for (var a = 0; a <= 5; a++) setFn(8, a, bit(a));
      setFn(8, 7, bit(6));
      setFn(8, 8, bit(7));
      setFn(7, 8, bit(8));
      for (var e = 9; e < 15; e++) setFn(14 - e, 8, bit(e));
      for (var f = 0; f < 8; f++) setFn(size - 1 - f, 8, bit(f));
      for (var g = 8; g < 15; g++) setFn(8, size - 15 + g, bit(g));
      setFn(8, size - 8, true);
    };
    drawFormat(0);

    if (ver >= 7) {
      var vrem = ver;
      for (var vi = 0; vi < 12; vi++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1F25);
      var vbits = (ver << 12) | vrem;
      for (var vb = 0; vb < 18; vb++) {
        var dark = ((vbits >>> vb) & 1) !== 0;
        var aa = size - 11 + vb % 3;
        var bb = Math.floor(vb / 3);
        setFn(aa, bb, dark);
        setFn(bb, aa, dark);
      }
    }

    // 4. Data placement (zigzag)
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var jj = 0; jj < 2; jj++) {
          var x = right - jj;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!isFn[y][x] && bi < codewords.length * 8) {
            modules[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    // 5. Mask choice
    var applyMask = function (m) {
      for (var yy = 0; yy < size; yy++) {
        for (var xx = 0; xx < size; xx++) {
          if (isFn[yy][xx]) continue;
          var inv;
          switch (m) {
            case 0: inv = (xx + yy) % 2 === 0; break;
            case 1: inv = yy % 2 === 0; break;
            case 2: inv = xx % 3 === 0; break;
            case 3: inv = (xx + yy) % 3 === 0; break;
            case 4: inv = (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0; break;
            case 5: inv = (xx * yy) % 2 + (xx * yy) % 3 === 0; break;
            case 6: inv = ((xx * yy) % 2 + (xx * yy) % 3) % 2 === 0; break;
            default: inv = ((xx + yy) % 2 + (xx * yy) % 3) % 2 === 0;
          }
          if (inv) modules[yy][xx] = !modules[yy][xx];
        }
      }
    };

    var PAT1 = [true, false, true, true, true, false, true, false, false, false, false];
    var PAT2 = [false, false, false, false, true, false, true, true, true, false, true];
    var penalty = function () {
      var score = 0, darkCount = 0;
      var line = function (get) {
        var run = 1;
        for (var i = 1; i < size; i++) {
          if (get(i) === get(i - 1)) run++;
          else { if (run >= 5) score += run - 2; run = 1; }
        }
        if (run >= 5) score += run - 2;
        for (var s = 0; s + 11 <= size; s++) {
          var m1 = true, m2 = true;
          for (var q = 0; q < 11; q++) {
            var v = get(s + q);
            if (v !== PAT1[q]) m1 = false;
            if (v !== PAT2[q]) m2 = false;
          }
          if (m1) score += 40;
          if (m2) score += 40;
        }
      };
      for (var r = 0; r < size; r++) {
        line(function (i) { return modules[r][i]; });
        line(function (i) { return modules[i][r]; });
      }
      for (var yy = 0; yy < size - 1; yy++) {
        for (var xx = 0; xx < size - 1; xx++) {
          var cc = modules[yy][xx];
          if (cc === modules[yy][xx + 1] && cc === modules[yy + 1][xx] && cc === modules[yy + 1][xx + 1]) score += 3;
        }
      }
      for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++) if (modules[y2][x2]) darkCount++;
      var total = size * size;
      score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
      return score;
    };

    var bestMask = 0, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk);
      drawFormat(mk);
      var p = penalty();
      if (p < bestScore) { bestScore = p; bestMask = mk; }
      applyMask(mk); // undo
    }
    applyMask(bestMask);
    drawFormat(bestMask);
    return { version: ver, size: size, modules: modules };
  }

  function svg(text, label) {
    var qr = encode(text);
    if (!qr) return null;
    var border = 4;
    var n = qr.size + border * 2;
    var d = '';
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) d += 'M' + (x + border) + ' ' + (y + border) + 'h1v1h-1z';
      }
    }
    var safeLabel = String(label || 'Κωδικός QR').replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n +
      '" shape-rendering="crispEdges" role="img" aria-label="' + safeLabel + '">' +
      '<rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  window.QzQR = { encode: encode, svg: svg };
})();
