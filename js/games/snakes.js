/* Φιδάκι: με σωστή απάντηση ρίχνεις το ζάρι. Οι σκάλες ανεβάζουν· στο κεφάλι του φιδιού χρειάζεται σωστή απάντηση για να γλιτώσεις.
   Αντίπαλος: το ρομπότ, που απαντά σωστά περίπου 2 στις 3 φορές. */
import { esc } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts } from './kit.js';
import { __ } from '../i18n.js';

export const N = 30;
const COLS = 6, ROWS = 5;
export const LADDERS = { 3: 12, 8: 17, 14: 25, 19: 27 };
export const SNAKES = { 16: 6, 22: 10, 26: 15, 29: 18 };
const CPU_SKILL = 0.65;
const MAX_TURNS = 40;
const SNAKE_COLORS = { 16: '#8E44D9', 22: '#E2445C', 26: '#0FA3B1', 29: '#C2410C' };

export function cell(n) {
  const r = Math.floor((n - 1) / COLS);
  let c = (n - 1) % COLS;
  if (r % 2) c = COLS - 1 - c;
  return { c, r: ROWS - 1 - r };
}
const center = (n) => { const { c, r } = cell(n); return { x: c * 100 + 50, y: r * 100 + 50 }; };
const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] };
export const dieSvg = (v) => `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="5" y="5" width="90" height="90" rx="20" fill="#fff" stroke="#142033" stroke-width="5"/>${PIPS[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#142033"/>`).join('')}</svg>`;

function ladderSvg(a, b) {
  const A = center(a), B = center(b);
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, px = -uy * 13, py = ux * 13;
  let rungs = '';
  for (let d = 20; d < len - 12; d += 24) rungs += `<line x1="${(A.x + ux * d + px).toFixed(1)}" y1="${(A.y + uy * d + py).toFixed(1)}" x2="${(A.x + ux * d - px).toFixed(1)}" y2="${(A.y + uy * d - py).toFixed(1)}"/>`;
  return `<g class="sn-ladder"><line x1="${A.x + px}" y1="${A.y + py}" x2="${B.x + px}" y2="${B.y + py}"/><line x1="${A.x - px}" y1="${A.y - py}" x2="${B.x - px}" y2="${B.y - py}"/>${rungs}</g>`;
}
function snakeSvg(a, b, color) {
  const A = center(a), B = center(b);
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
  const px = -dy / len, py = dx / len, w = 34;
  const c1 = { x: A.x + dx * 0.3 + px * w, y: A.y + dy * 0.3 + py * w };
  const c2 = { x: A.x + dx * 0.7 - px * w, y: A.y + dy * 0.7 - py * w };
  const d = `M${A.x} ${A.y} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${B.x} ${B.y}`;
  const ex = (-dx / len) * 5, ey = (-dy / len) * 5;
  return `<g class="sn-snake"><path d="${d}" stroke="${color}" stroke-width="15"/><path d="${d}" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-dasharray="3 11"/>
    <ellipse cx="${A.x}" cy="${A.y}" rx="15" ry="13" fill="${color}"/><circle cx="${A.x - 5 + ex}" cy="${A.y - 3 + ey}" r="3.4" fill="#fff"/><circle cx="${A.x + 5 + ex}" cy="${A.y - 3 + ey}" r="3.4" fill="#fff"/>
    <circle cx="${A.x - 5 + ex}" cy="${A.y - 3 + ey}" r="1.6" fill="#142033"/><circle cx="${A.x + 5 + ex}" cy="${A.y - 3 + ey}" r="1.6" fill="#142033"/></g>`;
}

export function start(kit) {
  const pos = { me: 0, cpu: 0 };
  let score = 0, turns = 0;
  const wait = (ms) => new Promise((r) => kit.after(ms, r));
  const initial = (kit.P.name || '?').trim().charAt(0).toLocaleUpperCase('el') || '?';
  const main = kit.shell('gm-board');
  const squares = Array.from({ length: N }, (_, i) => {
    const n = i + 1, { c, r } = cell(n);
    return `<div class="sn-sq ${(c + r) % 2 ? 'alt' : ''} ${n === N ? 'is-goal' : ''}" style="grid-column:${c + 1};grid-row:${r + 1}"><span>${n}</span>${n === N ? '<b aria-hidden="true">🏁</b>' : ''}</div>`;
  }).join('');
  main.innerHTML = `<div class="sn">
    <div class="sn-board-wrap"><div class="sn-board" role="img" aria-label="${__('Ταμπλό με 30 τετράγωνα, σκάλες και φίδια')}">${squares}
      <svg class="sn-art" viewBox="0 0 600 500" aria-hidden="true">${Object.entries(LADDERS).map(([a, b]) => ladderSvg(+a, b)).join('')}${Object.entries(SNAKES).map(([a, b]) => snakeSvg(+a, b, SNAKE_COLORS[a])).join('')}</svg>
      <span class="sn-tok sn-me is-start" data-tok="me" aria-hidden="true">${esc(initial)}</span><span class="sn-tok sn-cpu is-start" data-tok="cpu" aria-hidden="true">🤖</span></div></div>
    <div class="sn-side">
      <div class="sn-players"><div class="sn-pl is-me"><span class="sn-dot" aria-hidden="true">${esc(initial)}</span><b>${esc(kit.P.name)}</b><span data-at="me">${__('στην αφετηρία')}</span></div>
        <div class="sn-pl"><span class="sn-dot cpu" aria-hidden="true">🤖</span><b>${__('Ρομπότ')}</b><span data-at="cpu">${__('στην αφετηρία')}</span></div></div>
      <div class="sn-row"><div class="sn-die" data-die role="img" aria-label="${__('Ζάρι')}">${dieSvg(6)}</div><p class="sn-say" aria-live="polite"></p></div>
      <div class="sn-q"></div>
    </div></div>`;
  const qBox = main.querySelector('.sn-q');
  const dieEl = main.querySelector('[data-die]');
  const sayEl = main.querySelector('.sn-say');
  const toks = { me: main.querySelector('[data-tok="me"]'), cpu: main.querySelector('[data-tok="cpu"]') };
  const say = (t, cls = '') => { sayEl.textContent = t; sayEl.className = `sn-say ${cls ? `is-${cls}` : ''}`; };
  function place(who) {
    const n = pos[who];
    const { c, r } = cell(Math.max(1, n));
    const t = toks[who];
    t.style.left = `calc(${((c + 0.5) / COLS) * 100}% ${who === 'me' ? '-' : '+'} 9px)`;
    t.style.top = `calc(${((r + 0.5) / ROWS) * 100}% ${who === 'me' ? '-' : '+'} 5px)`;
    t.classList.toggle('is-start', n === 0);
    main.querySelector(`[data-at="${who}"]`).textContent = n === 0 ? __('στην αφετηρία') : n >= N ? __('στο τέρμα!') : `${__('στο')} ${n}`;
  }
  place('me');
  place('cpu');

  async function moveBy(who, steps) {
    const target = Math.min(N, pos[who] + steps);
    while (pos[who] < target && !kit.stopped) {
      pos[who]++;
      place(who);
      kit.sfx.tick();
      await wait(240);
    }
  }
  async function jump(who, to, up) {
    toks[who].classList.add('is-slide');
    pos[who] = to;
    place(who);
    if (up) kit.sfx.whoosh(); else kit.sfx.lose();
    await wait(850);
    toks[who].classList.remove('is-slide');
  }
  async function roll(auto) {
    if (!auto) {
      qBox.innerHTML = ('<p class="actions center"><button class="btn btn-sun btn-lg" type="button" data-roll>🎲 ' + __('Ρίξε το ζάρι') + '</button></p>');
      const b = qBox.querySelector('[data-roll]');
      try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      await new Promise((r) => b.addEventListener('click', r, { once: true }));
      qBox.innerHTML = '';
    }
    const v = 1 + Math.floor(Math.random() * 6);
    dieEl.classList.add('is-roll');
    kit.sfx.dice();
    for (let k = 0; k < 7 && !kit.stopped; k++) { dieEl.innerHTML = dieSvg(1 + Math.floor(Math.random() * 6)); await wait(80); }
    dieEl.innerHTML = dieSvg(v);
    dieEl.classList.remove('is-roll');
    dieEl.setAttribute('aria-label', `${__('Ζάρι:')} ${v}`);
    await wait(380);
    return v;
  }
  async function question(lead) {
    say(lead, 'me');
    const q = kit.next();
    const res = await kit.ask(qBox, q, { cls: 'gq-sn', explain: false, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
    if (kit.stopped) return null;
    kit.record(q, res.a, res.f, res.t, res.f === 1 ? 150 : 0);
    qBox.innerHTML = '';
    if (res.f === 1) { score += 150; kit.setScore(score); }
    return res;
  }
  async function land(who) {
    const p = pos[who];
    if (LADDERS[p]) {
      say(who === 'me' ? __('Σκάλα! Ανεβαίνεις!') : __('Το ρομπότ βρήκε σκάλα…'), who === 'me' ? 'ok' : 'bad');
      await jump(who, LADDERS[p], true);
    } else if (SNAKES[p]) {
      if (who === 'me') {
        const res = await question(__('Φίδι! Απάντησε σωστά για να γλιτώσεις.'));
        if (!res) return;
        if (res.f === 1) { say(__('Γλίτωσες από το φίδι!'), 'ok'); await wait(900); } else { say(__('Το φίδι σε κατέβασε…'), 'bad'); await jump(who, SNAKES[p], false); }
      } else if (Math.random() < 0.5) { say(__('Το ρομπότ γλίτωσε από το φίδι.'), 'bad'); await wait(1000); } else { say(__('Το φίδι κατέβασε το ρομπότ!'), 'ok'); await jump(who, SNAKES[p], false); }
    }
  }
  async function myTurn() {
    const res = await question(__('Η σειρά σου! Απάντησε σωστά για να ρίξεις το ζάρι.'));
    if (!res) return;
    if (res.f !== 1) { say(__('Λάθος απάντηση: χάνεις τη σειρά σου.'), 'bad'); await wait(1000); return; }
    const v = await roll(false);
    if (kit.stopped) return;
    say(`${__('Έφερες {0}!', v)}`);
    await moveBy('me', v);
    if (!kit.stopped && pos.me < N) await land('me');
  }
  async function cpuTurn() {
    say(__('Σειρά του ρομπότ…'), 'cpu');
    qBox.innerHTML = ('<p class="sn-think">🤖 ' + __('Το ρομπότ απαντά σε μια ερώτηση…') + '</p>');
    await wait(1100);
    if (kit.stopped) return;
    qBox.innerHTML = '';
    if (Math.random() >= CPU_SKILL) { say(__('Το ρομπότ έκανε λάθος και χάνει τη σειρά του!'), 'ok'); await wait(1100); return; }
    const v = await roll(true);
    if (kit.stopped) return;
    say(`${__('Το ρομπότ έφερε {0}.', v)}`, 'cpu');
    await moveBy('cpu', v);
    if (!kit.stopped && pos.cpu < N) await land('cpu');
  }
  function end(win) {
    const final = score + (win ? 3000 : pos.me * 50);
    qBox.innerHTML = '';
    say(win ? __('Έφτασες στο τέρμα!') : __('Το ρομπότ έφτασε στο τέρμα.'), win ? 'ok' : 'bad');
    if (!win) kit.sfx.lose();
    kit.finish({
      score: final, win,
      title: win ? __('Νίκη! Έφτασες πρώτα εσύ στο 30!') : pos.cpu >= N ? __('Το ρομπότ έφτασε πρώτο στο 30') : __('Τέλος του παιχνιδιού'),
      detail: `${win ? __('Τερμάτισες') : `${__('Έφτασες στο')} ${pos.me}`} ${__('με {0} σωστές σε {1} ερωτήσεις.', kit.play.correct, kit.play.asked)}`,
      short: win ? __('νίκη') : `${__('στο')} ${pos.me}`, delay: 2000
    });
  }
  (async () => {
    qBox.innerHTML = `<div class="sn-intro"><p>${__('Φτάσε στο')} <b>30</b> ${__('πριν από το ρομπότ! Κάθε σωστή απάντηση σού δίνει μια ζαριά. Οι σκάλες σε ανεβάζουν· αν σταθείς σε κεφάλι φιδιού, χρειάζεται σωστή απάντηση για να μη γλιστρήσεις.')}</p>
      <button class="btn btn-sun btn-lg" type="button" data-go>${__('Ξεκίνα')}</button></div>`;
    await new Promise((r) => qBox.querySelector('[data-go]').addEventListener('click', r, { once: true }));
    while (!kit.stopped) {
      turns++;
      await myTurn();
      if (kit.stopped) return;
      if (pos.me >= N) { end(true); return; }
      await cpuTurn();
      if (kit.stopped) return;
      if (pos.cpu >= N) { end(false); return; }
      if (turns >= MAX_TURNS) { end(pos.me > pos.cpu); return; }
    }
  })();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  let me = 0, cpu = 0, i = 0, turns = 0, good = 0;
  const ask = () => { const r = simRecord(answers, qs[i++ % qs.length], skill); if (r.f === 1) good++; return r.f === 1; };
  while (me < N && cpu < N && turns < MAX_TURNS) {
    turns++;
    if (ask()) {
      me = Math.min(N, me + 1 + Math.floor(Math.random() * 6));
      if (LADDERS[me]) me = LADDERS[me]; else if (SNAKES[me] && !ask()) me = SNAKES[me];
    }
    if (me >= N) break;
    if (Math.random() < CPU_SKILL) {
      cpu = Math.min(N, cpu + 1 + Math.floor(Math.random() * 6));
      if (LADDERS[cpu]) cpu = LADDERS[cpu]; else if (SNAKES[cpu] && Math.random() < 0.5) cpu = SNAKES[cpu];
    }
  }
  const win = me >= N || (cpu < N && me > cpu);
  const score = good * 150 + (win ? 3000 : me * 50);
  return Object.assign({ answers, score, result: { title: win ? __('Νίκη στο φιδάκι') : `${__('Έφτασε στο')} ${me}`, short: win ? __('νίκη') : `${__('στο')} ${me}`, score, win } }, simCounts(answers));
}
