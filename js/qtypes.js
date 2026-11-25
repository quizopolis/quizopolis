/*
  Είδη ερωτήσεων. Κάθε είδος έχει:
  - blank(): νέα ερώτηση
  - edit(q, i) / bind(root, q, change, redraw): το κομμάτι του επεξεργαστή
  - validate(q): λάθη που εμποδίζουν την αποθήκευση
  - play(root, q, ctx): η οθόνη του μαθητή. ctx = { submit(answer), shuffle }
      επιστρέφει { reveal(answer, f), fifty(), disable() }
  - check(q, a): ποσοστό σωστού 0..1 (null αν δεν βαθμολογείται)
  - describe(q, a), correct(q): κείμενα για αναφορές και ανασκόπηση
  - sample(q, good): απάντηση για εικονικούς μαθητές
  - summary(q, answers): ανάλυση για την αναφορά
*/
import { esc, norm, shuffle, textOn, shade, ICON, pct, toast } from './ui.js';
import { __ } from './i18n.js';

export const LETTERS = [__('Α'), __('Β'), __('Γ'), __('Δ'), __('Ε'), __('Ζ')];
export const OPT_COLORS = ['#2F6FE4', '#F4A80B', '#8E44D9', '#E2445C', '#0FA3B1', '#C2410C'];
const optStyle = (k) => { const c = OPT_COLORS[k % OPT_COLORS.length]; return `--o:${c};--od:${shade(c, -0.3)};--of:${textOn(c)}`; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clean = (s) => String(s || '').trim();

/* ---------- κοινά κομμάτια ---------- */
function submitBar(label = __('Υποβολή')) {
  return `<div class="q-submit"><button class="btn btn-sun btn-lg" type="button" data-submit disabled>${label}</button></div>`;
}
function optionsEditor(q, i, mode) {
  // mode: 'one' (radio), 'many' (checkbox), 'none' (poll)
  const rows = q.options.map((o, k) => {
    let mark = '';
    if (mode === 'one') mark = `<label class="oe-mark"><input type="radio" name="c-${i}" value="${k}" ${q.correct === k ? 'checked' : ''} data-f="correct"><span class="oe-l" style="${optStyle(k)}">${LETTERS[k]}</span><span class="sr">${__('Σωστή η')} ${LETTERS[k]}</span></label>`;
    else if (mode === 'many') mark = `<label class="oe-mark"><input type="checkbox" value="${k}" ${(q.correct || []).includes(k) ? 'checked' : ''} data-f="corrects"><span class="oe-l" style="${optStyle(k)}">${LETTERS[k]}</span><span class="sr">${__('Σωστή η')} ${LETTERS[k]}</span></label>`;
    else mark = `<span class="oe-l" style="${optStyle(k)}">${LETTERS[k]}</span>`;
    const isRight = mode === 'one' ? q.correct === k : mode === 'many' ? (q.correct || []).includes(k) : false;
    return `<div class="oe-row${isRight ? ' is-right' : ''}" style="${optStyle(k)}">${mark}<input class="input" data-opt="${k}" value="${esc(o)}" placeholder="${__('Απάντηση')} ${LETTERS[k]}" aria-label="${__('Απάντηση')} ${LETTERS[k]}">
      ${q.options.length > 2 ? `<button type="button" class="icon-btn" data-del-opt="${k}" aria-label="${__('Αφαίρεση απάντησης')} ${LETTERS[k]}">${ICON.x}</button>` : '<span class="icon-space"></span>'}</div>`;
  }).join('');
  const legend = mode === 'one' ? __('Απαντήσεις: πάτα το γράμμα της σωστής') : mode === 'many' ? __('Απαντήσεις: πάτα τα γράμματα όλων των σωστών') : __('Επιλογές');
  return `<fieldset class="oe"><legend class="label">${legend}</legend>${rows}
    ${q.options.length < 6 ? `<button type="button" class="btn btn-sm btn-ghost" data-add-opt>${ICON.plus}${__('Απάντηση')}</button>` : ''}</fieldset>`;
}
function bindOptions(root, q, change, redraw, mode) {
  root.addEventListener('input', (e) => {
    const k = e.target.dataset.opt;
    if (k !== undefined) { q.options[Number(k)] = e.target.value; change(); }
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'correct') { q.correct = Number(e.target.value); change(); redraw(); }
    if (e.target.dataset.f === 'corrects') {
      q.correct = Array.from(root.querySelectorAll('[data-f="corrects"]:checked')).map((x) => Number(x.value));
      change(); redraw();
    }
  });
  root.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-opt]');
    if (del) {
      const k = Number(del.dataset.delOpt);
      q.options.splice(k, 1);
      if (mode === 'one') { if (q.correct === k) q.correct = 0; else if (q.correct > k) q.correct--; }
      if (mode === 'many') q.correct = (q.correct || []).filter((x) => x !== k).map((x) => (x > k ? x - 1 : x));
      change(); redraw();
    }
    if (e.target.closest('[data-add-opt]')) { q.options.push(''); change(); redraw(`[data-opt="${q.options.length - 1}"]`); }
  });
}
function bar(label, n, total, right) {
  const w = total ? Math.round(n / total * 100) : 0;
  return `<div class="sb-row${right ? ' is-right' : ''}"><span class="sb-label">${right ? '✓ ' : ''}${esc(label)}</span>
    <span class="sb-track"><span class="sb-fill" style="width:${w}%"></span></span><span class="sb-n">${n}</span></div>`;
}
function optionCounts(q, answers, isRight) {
  const counts = q.options.map(() => 0);
  answers.forEach((a) => {
    const v = a.v;
    (Array.isArray(v) ? v : [v]).forEach((k) => { if (counts[k] !== undefined) counts[k]++; });
  });
  return `<div class="sb">${q.options.map((o, k) => bar(`${LETTERS[k]}. ${o}`, counts[k], answers.length, isRight(k))).join('')}</div>`;
}

/* Επιλογή-τοποθέτηση: πάτα ένα κομμάτι και μετά τη θέση του, ή σύρε το. */
function enableDrag(root, onDrop) {
  let suppress = false;
  root.addEventListener('pointerdown', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip || e.button > 0 || chip.disabled) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, over = null;
    const rect = chip.getBoundingClientRect();
    const move = (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        ghost = chip.cloneNode(true);
        ghost.classList.add('chip-ghost');
        ghost.style.width = rect.width + 'px';
        document.body.appendChild(ghost);
        chip.classList.add('is-dragging');
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - rect.width / 2}px, ${ev.clientY - rect.height / 2}px)`;
      ghost.style.display = 'none';
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      ghost.style.display = '';
      const t = el && (el.closest('[data-slot]') || el.closest('[data-bank]'));
      if (over && over !== t) over.classList.remove('is-over');
      over = t && root.contains(t) ? t : null;
      if (over) over.classList.add('is-over');
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', end);
      if (ghost) { ghost.remove(); chip.classList.remove('is-dragging'); }
      if (over) over.classList.remove('is-over');
    };
    const up = () => {
      const target = over;
      const dragged = !!ghost;
      end();
      if (dragged) {
        suppress = true;
        setTimeout(() => { suppress = false; }, 50);
        if (target) onDrop(chip.dataset.chip, target.dataset.slot !== undefined ? target.dataset.slot : 'bank');
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', end);
  });
  root.addEventListener('click', (e) => { if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
}

/* Κείμενο με κενά: «[σωστό|λάθος|λάθος]» */
export function parseCloze(src) {
  const parts = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ t: src.slice(last, m.index) });
    const opts = m[1].split('|').map(clean).filter(Boolean);
    parts.push({ blank: true, opts, answer: opts[0] || '' });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ t: src.slice(last) });
  return parts;
}
const blanksOf = (q) => parseCloze(q.cloze || '').filter((p) => p.blank);

function header(q) {
  return `<div class="q-card"><h1 class="q-text">${esc(q.text)}</h1>${q.image ? `<img class="q-img" src="${esc(q.image)}" alt="">` : ''}</div>`;
}
export { header as questionHeader };

/* ================= ΤΑ ΕΙΔΗ ================= */
export const TYPES = {};

/* 1. Πολλαπλής επιλογής */
TYPES.mcq = {
  label: __('Πολλαπλής επιλογής'), icon: '◉', desc: __('Μία σωστή απάντηση ανάμεσα σε 2 έως 6.'), scored: true, instant: true,
  blank: () => ({ options: ['', '', '', ''], correct: 0 }),
  edit: (q, i) => optionsEditor(q, i, 'one'),
  bind: (root, q, change, redraw) => bindOptions(root, q, change, redraw, 'one'),
  validate(q) {
    const e = [];
    if (q.options.filter((o) => clean(o)).length < 2) e.push(__('χρειάζεται τουλάχιστον δύο απαντήσεις'));
    else if (!clean(q.options[q.correct])) e.push(__('η απάντηση που σημείωσες ως σωστή είναι κενή'));
    return e;
  },
  tidy(q) {
    const opts = []; let corr = 0;
    q.options.forEach((o, k) => { if (clean(o)) { if (k === q.correct) corr = opts.length; opts.push(clean(o)); } });
    q.options = opts; q.correct = corr;
  },
  play(root, q, ctx) {
    const order = ctx.shuffle ? shuffle(q.options.map((_, k) => k)) : q.options.map((_, k) => k);
    root.innerHTML = header(q) + `<div class="q-opts${order.length > 4 ? ' q-opts-3' : ''}" role="group" aria-label="${__('Απαντήσεις')}">${order.map((k, pos) =>
      `<button type="button" class="opt" data-k="${k}" style="${optStyle(pos)}"><span class="opt-l" aria-hidden="true">${LETTERS[pos]}</span><span class="opt-t">${esc(q.options[k])}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join('')}</div>`;
    root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => ctx.submit(Number(b.dataset.k))));
    return {
      reveal(a) {
        root.querySelectorAll('.opt').forEach((b) => {
          const k = Number(b.dataset.k);
          b.disabled = true;
          if (k === q.correct) { b.classList.add('is-right'); b.querySelector('.opt-mark').textContent = '✓'; }
          else if (k === a) { b.classList.add('is-wrong'); b.querySelector('.opt-mark').textContent = '✗'; }
          else b.classList.add('is-dim');
        });
      },
      fifty() {
        const wrong = shuffle(Array.from(root.querySelectorAll('.opt')).filter((b) => Number(b.dataset.k) !== q.correct));
        wrong.slice(0, Math.floor(wrong.length / 2 + 0.5)).slice(0, Math.max(1, wrong.length - 1)).forEach((b) => { b.disabled = true; b.classList.add('is-gone'); });
      },
      disable() { root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; }); }
    };
  },
  check: (q, a) => (a === q.correct ? 1 : 0),
  describe: (q, a) => (q.options[a] !== undefined ? q.options[a] : '—'),
  correct: (q) => q.options[q.correct],
  sample: (q, good) => (good ? q.correct : pick(q.options.map((_, k) => k).filter((k) => k !== q.correct))),
  summary: (q, answers) => optionCounts(q, answers, (k) => k === q.correct)
};

/* 2. Πολλές σωστές */
TYPES.multi = {
  label: __('Πολλές σωστές'), icon: '☑', desc: __('Οι μαθητές διαλέγουν όλες τις σωστές απαντήσεις.'), scored: true,
  blank: () => ({ options: ['', '', '', ''], correct: [0] }),
  edit: (q, i) => optionsEditor(q, i, 'many'),
  bind: (root, q, change, redraw) => bindOptions(root, q, change, redraw, 'many'),
  validate(q) {
    const e = [];
    if (q.options.filter((o) => clean(o)).length < 2) e.push(__('χρειάζεται τουλάχιστον δύο απαντήσεις'));
    else if (!(q.correct || []).some((k) => clean(q.options[k]))) e.push(__('σημείωσε τουλάχιστον μία σωστή απάντηση'));
    return e;
  },
  tidy(q) {
    const opts = []; const corr = [];
    q.options.forEach((o, k) => { if (clean(o)) { if ((q.correct || []).includes(k)) corr.push(opts.length); opts.push(clean(o)); } });
    q.options = opts; q.correct = corr;
  },
  play(root, q, ctx) {
    const order = ctx.shuffle ? shuffle(q.options.map((_, k) => k)) : q.options.map((_, k) => k);
    const picked = new Set();
    root.innerHTML = header(q) + `<p class="q-hint">${__('Διάλεξε όλες τις σωστές απαντήσεις.')}</p><div class="q-opts${order.length > 4 ? ' q-opts-3' : ''}" role="group" aria-label="${__('Απαντήσεις')}">${order.map((k, pos) =>
      `<button type="button" class="opt opt-check" aria-pressed="false" data-k="${k}" style="${optStyle(pos)}"><span class="opt-l" aria-hidden="true">${LETTERS[pos]}</span><span class="opt-t">${esc(q.options[k])}</span><span class="opt-box" aria-hidden="true"></span></button>`).join('')}</div>` + submitBar();
    const sub = root.querySelector('[data-submit]');
    root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.k);
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      b.setAttribute('aria-pressed', String(picked.has(k)));
      sub.disabled = picked.size === 0;
    }));
    sub.addEventListener('click', () => ctx.submit(Array.from(picked).sort((x, y) => x - y)));
    return {
      reveal(a) {
        root.querySelectorAll('.opt').forEach((b) => {
          const k = Number(b.dataset.k);
          b.disabled = true;
          const right = q.correct.includes(k), chose = (a || []).includes(k);
          if (right) b.classList.add(chose ? 'is-right' : 'is-missed');
          else if (chose) b.classList.add('is-wrong');
          else b.classList.add('is-dim');
        });
        sub.hidden = true;
      },
      disable() { root.querySelectorAll('.opt, [data-submit]').forEach((b) => { b.disabled = true; }); }
    };
  },
  check(q, a) {
    const C = new Set(q.correct || []);
    const S = new Set(a || []);
    let right = 0, wrong = 0;
    S.forEach((k) => (C.has(k) ? right++ : wrong++));
    return C.size ? Math.max(0, (right - wrong) / C.size) : 0;
  },
  describe: (q, a) => (a || []).map((k) => q.options[k]).join(', ') || '—',
  correct: (q) => (q.correct || []).map((k) => q.options[k]).join(', '),
  sample(q, good) {
    if (good) return q.correct.slice();
    const s = q.options.map((_, k) => k).filter(() => Math.random() < 0.5);
    return s.length ? s : [0];
  },
  summary: (q, answers) => optionCounts(q, answers, (k) => q.correct.includes(k))
};

/* 3. Σωστό ή λάθος */
TYPES.tf = {
  label: __('Σωστό ή λάθος'), icon: '⚖', desc: __('Μια πρόταση που είναι σωστή ή λάθος.'), scored: true, instant: true,
  blank: () => ({ correct: true }),
  edit: (q, i) => `<fieldset class="oe"><legend class="label">${__('Η πρόταση είναι')}</legend><div class="seg">
      <label class="seg-c"><input type="radio" name="tf-${i}" value="1" ${q.correct ? 'checked' : ''} data-f="tf"><span>${__('Σωστή')}</span></label>
      <label class="seg-c"><input type="radio" name="tf-${i}" value="0" ${!q.correct ? 'checked' : ''} data-f="tf"><span>${__('Λάθος')}</span></label></div></fieldset>`,
  bind(root, q, change) {
    root.addEventListener('change', (e) => { if (e.target.dataset.f === 'tf') { q.correct = e.target.value === '1'; change(); } });
  },
  validate: () => [],
  play(root, q, ctx) {
    root.innerHTML = header(q) + `<div class="q-opts q-opts-tf" role="group" aria-label="${__('Απαντήσεις')}">
      <button type="button" class="opt" data-k="1" style="${optStyle(0)}"><span class="opt-l" aria-hidden="true">✓</span><span class="opt-t">${__('Σωστό')}</span><span class="opt-mark" aria-hidden="true"></span></button>
      <button type="button" class="opt" data-k="0" style="${optStyle(3)}"><span class="opt-l" aria-hidden="true">✗</span><span class="opt-t">${__('Λάθος')}</span><span class="opt-mark" aria-hidden="true"></span></button></div>`;
    root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => ctx.submit(b.dataset.k === '1')));
    return {
      reveal(a) {
        root.querySelectorAll('.opt').forEach((b) => {
          const v = b.dataset.k === '1';
          b.disabled = true;
          if (v === q.correct) { b.classList.add('is-right'); b.querySelector('.opt-mark').textContent = '✓'; }
          else if (v === a) { b.classList.add('is-wrong'); b.querySelector('.opt-mark').textContent = '✗'; }
          else b.classList.add('is-dim');
        });
      },
      disable() { root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; }); }
    };
  },
  check: (q, a) => (a === q.correct ? 1 : 0),
  describe: (q, a) => (a === true ? __('Σωστό') : a === false ? __('Λάθος') : '—'),
  correct: (q) => (q.correct ? __('Σωστό') : __('Λάθος')),
  sample: (q, good) => (good ? q.correct : !q.correct),
  summary(q, answers) {
    const yes = answers.filter((a) => a.v === true).length;
    const no = answers.filter((a) => a.v === false).length;
    const none = answers.length - yes - no;
    return `<div class="sb">${bar(__('Σωστό'), yes, answers.length, q.correct)}${bar(__('Λάθος'), no, answers.length, !q.correct)}${none ? bar(__('Χωρίς απάντηση'), none, answers.length, false) : ''}</div>`;
  }
};

/* 4. Συμπλήρωση (σύντομη απάντηση) */
export function normAnswer(s) {
  return norm(s).replace(/[«»"“”‘’']/g, '').replace(/(\d),(\d)/g, '$1.$2').replace(/[.!;·,]+$/g, '').replace(/\s+/g, '');
}
function sameAnswer(given, accepted) {
  const g = normAnswer(given), a = normAnswer(accepted);
  if (!g) return false;
  if (g === a) return true;
  const gn = Number(g), an = Number(a);
  return g !== '' && a !== '' && !isNaN(gn) && !isNaN(an) && Math.abs(gn - an) < 1e-9;
}
TYPES.fill = {
  label: __('Συμπλήρωση'), icon: '✎', desc: __('Οι μαθητές γράφουν τη σωστή λέξη ή τον αριθμό.'), scored: true,
  blank: () => ({ answers: [''] }),
  edit: (q, i) => `<div class="field"><label class="label" for="fa-${i}">${__('Αποδεκτές απαντήσεις, μία σε κάθε γραμμή')}</label>
    <textarea class="input" id="fa-${i}" rows="2" data-f="answers">${esc((q.answers || []).join('\n'))}</textarea>
    <p class="hint">${__('Δεν μετράνε τόνοι, κεφαλαία και κενά. Το 0,5 και το 0.5 θεωρούνται ίδια.')}</p></div>`,
  bind(root, q, change) {
    root.addEventListener('input', (e) => { if (e.target.dataset.f === 'answers') { q.answers = e.target.value.split('\n'); change(); } });
  },
  validate: (q) => ((q.answers || []).some((a) => clean(a)) ? [] : [__('γράψε τουλάχιστον μία αποδεκτή απάντηση')]),
  tidy(q) { q.answers = (q.answers || []).map(clean).filter(Boolean); },
  play(root, q, ctx) {
    root.innerHTML = header(q) + `<form class="q-fill" novalidate><label class="sr" for="fill-in">${__('Η απάντησή σου')}</label>
      <input id="fill-in" class="input input-xl" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${__('Γράψε την απάντηση')}">
      <button class="btn btn-sun btn-lg" type="submit" data-submit disabled>${__('Υποβολή')}</button></form>`;
    const inp = root.querySelector('#fill-in');
    const sub = root.querySelector('[data-submit]');
    inp.addEventListener('input', () => { sub.disabled = !inp.value.trim(); });
    root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); if (inp.value.trim()) ctx.submit(inp.value.trim()); });
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    return {
      reveal(a, f) { inp.disabled = true; sub.hidden = true; inp.classList.add(f === 1 ? 'is-right' : 'is-wrong'); },
      disable() { inp.disabled = true; sub.disabled = true; }
    };
  },
  check: (q, a) => ((q.answers || []).some((x) => sameAnswer(a, x)) ? 1 : 0),
  describe: (q, a) => (a ? String(a) : '—'),
  correct: (q) => (q.answers || [])[0] || '',
  sample: (q, good) => (good ? q.answers[0] : pick([__('δεν ξέρω'), '12', __('κάτι άλλο')])),
  summary(q, answers) {
    const counts = {};
    answers.forEach((a) => { const k = String(a.v || '').trim() || '—'; counts[k] = (counts[k] || 0) + 1; });
    const rows = Object.keys(counts).sort((x, y) => counts[y] - counts[x]).slice(0, 8);
    return `<div class="sb">${rows.map((k) => bar(k, counts[k], answers.length, TYPES.fill.check(q, k) === 1)).join('')}</div>`;
  }
};

/* 5. Αναπτυσσόμενη λίστα */
function clozeEditor(q, i, kind) {
  const help = kind === 'dropdown'
    ? __('Βάλε σε αγκύλες τις επιλογές κάθε κενού, χωρισμένες με |. Πρώτη γράφεις τη σωστή, οι μαθητές τις βλέπουν ανακατεμένες.')
    : __('Βάλε σε αγκύλες τις λέξεις που θα σύρουν οι μαθητές στα κενά.');
  const example = kind === 'dropdown' ? __('Το νερό [βράζει|παγώνει|λιώνει] στους 100 βαθμούς Κελσίου.') : __('Το νερό βράζει στους [100] βαθμούς και παγώνει στους [0].');
  return `<div class="field"><label class="label" for="cz-${i}">${__('Κείμενο με κενά')}</label>
    <textarea class="input" id="cz-${i}" rows="3" data-f="cloze" placeholder="${esc(example)}">${esc(q.cloze || '')}</textarea>
    <p class="hint">${help}</p></div>
    ${kind === 'drag' ? `<div class="field"><label class="label" for="ex-${i}">${__('Λέξεις-παγίδες')} <span class="muted">${__('(προαιρετικά, χωρισμένες με κόμμα)')}</span></label>
      <input class="input" id="ex-${i}" data-f="extra" value="${esc((q.extra || []).join(', '))}"></div>` : ''}
    <div class="cz-preview" data-preview>${clozePreview(q, kind)}</div>`;
}
function clozePreview(q, kind) {
  const parts = parseCloze(q.cloze || '');
  if (!parts.some((p) => p.blank)) return ('<span class="muted">' + __('Η προεπισκόπηση εμφανίζεται όταν βάλεις τουλάχιστον ένα κενό σε αγκύλες.') + '</span>');
  return ('<span class="muted">' + __('Προεπισκόπηση:') + ' </span>') + parts.map((p) => (p.blank
    ? `<span class="cz-blank">${esc(kind === 'dropdown' ? p.opts.join(' / ') : p.answer)}</span>` : esc(p.t))).join('');
}
function bindCloze(root, q, change, kind) {
  root.addEventListener('input', (e) => {
    if (e.target.dataset.f === 'cloze') { q.cloze = e.target.value; root.querySelector('[data-preview]').innerHTML = clozePreview(q, kind); change(); }
    if (e.target.dataset.f === 'extra') { q.extra = e.target.value.split(',').map(clean).filter(Boolean); change(); }
  });
}
TYPES.dropdown = {
  label: __('Αναπτυσσόμενη λίστα'), icon: '▾', desc: __('Κείμενο με κενά· σε κάθε κενό διαλέγουν από λίστα.'), scored: true,
  blank: () => ({ text: __('Διάλεξε τη σωστή λέξη σε κάθε κενό.'), cloze: '' }),
  edit: (q, i) => clozeEditor(q, i, 'dropdown'),
  bind: (root, q, change) => bindCloze(root, q, change, 'dropdown'),
  validate(q) {
    const b = blanksOf(q);
    if (!b.length) return [__('βάλε τουλάχιστον ένα κενό σε αγκύλες, π.χ. [σωστό|λάθος]')];
    if (b.some((x) => x.opts.length < 2)) return [__('κάθε κενό χρειάζεται τουλάχιστον δύο επιλογές, χωρισμένες με |')];
    return [];
  },
  play(root, q, ctx) {
    const parts = parseCloze(q.cloze || '');
    let bi = 0;
    root.innerHTML = header(q) + `<div class="q-cloze">${parts.map((p) => {
      if (!p.blank) return esc(p.t);
      const k = bi++;
      const opts = shuffle(p.opts);
      return `<select class="cz-select" data-b="${k}" aria-label="${__('Κενό')} ${k + 1}"><option value="">…</option>${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select><span class="cz-fix" data-fix="${k}" hidden></span>`;
    }).join('')}</div>` + submitBar();
    const sels = Array.from(root.querySelectorAll('.cz-select'));
    const sub = root.querySelector('[data-submit]');
    root.addEventListener('change', () => { sub.disabled = sels.some((s) => !s.value); });
    sub.addEventListener('click', () => ctx.submit(sels.map((s) => s.value)));
    return {
      reveal(a) {
        const b = blanksOf(q);
        sels.forEach((s, k) => {
          s.disabled = true;
          const ok = (a || [])[k] === b[k].answer;
          s.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) { const fx = root.querySelector(`[data-fix="${k}"]`); fx.hidden = false; fx.textContent = b[k].answer; }
        });
        sub.hidden = true;
      },
      disable() { sels.forEach((s) => { s.disabled = true; }); sub.disabled = true; }
    };
  },
  check(q, a) {
    const b = blanksOf(q);
    if (!b.length) return 0;
    return b.filter((x, k) => (a || [])[k] === x.answer).length / b.length;
  },
  describe: (q, a) => (a || []).join(' / ') || '—',
  correct: (q) => blanksOf(q).map((b) => b.answer).join(' / '),
  sample: (q, good) => blanksOf(q).map((b) => (good ? b.answer : pick(b.opts))),
  summary(q, answers) {
    const b = blanksOf(q);
    return `<div class="sb">${b.map((x, k) => bar(`${__('Κενό {0}:', k + 1)} ${x.answer}`, answers.filter((a) => (a.v || [])[k] === x.answer).length, answers.length, true)).join('')}</div>`;
  }
};

/* 6. Σύρε και άφησε λέξεις */
function placeWidget(root, opts) {
  // opts: { chips: [{id, label}], slots: [{id, label?, multi?}], layout(slotsHtml) , onChange }
  const state = {}; // slotId -> [chipIds]
  opts.slots.forEach((s) => { state[s.id] = []; });
  let picked = null;
  const where = (chipId) => Object.keys(state).find((s) => state[s].includes(chipId));
  const chipHtml = (c, inSlot) => `<button type="button" class="chip-w${picked === c.id ? ' is-picked' : ''}${inSlot ? ' in-slot' : ''}" data-chip="${esc(c.id)}">${esc(c.label)}</button>`;
  const byId = {};
  opts.chips.forEach((c) => { byId[c.id] = c; });
  function draw() {
    const bank = opts.chips.filter((c) => !where(c.id));
    const slotHtml = (s) => `<span class="slot${s.multi ? ' slot-multi' : ''}${state[s.id].length ? ' is-filled' : ''}" data-slot="${esc(s.id)}" role="button" tabindex="0" aria-label="${esc(s.aria || __('Θέση'))}">${state[s.id].map((id) => chipHtml(byId[id], true)).join('') || (s.multi ? '' : '<span class="slot-empty">&nbsp;</span>')}</span>`;
    root.querySelector('[data-area]').innerHTML = opts.layout(slotHtml);
    root.querySelector('[data-bank]').innerHTML = bank.length ? bank.map((c) => chipHtml(c, false)).join('') : ('<span class="bank-empty">' + __('Όλα στη θέση τους. Πάτα «Υποβολή».') + '</span>');
    opts.onChange(state);
  }
  function place(chipId, slotId) {
    const from = where(chipId);
    if (from) state[from] = state[from].filter((x) => x !== chipId);
    if (slotId && slotId !== 'bank') {
      const s = opts.slots.find((x) => x.id === slotId);
      if (s && !s.multi && state[slotId].length) state[slotId] = []; // the old one goes back to the bank
      state[slotId].push(chipId);
    }
    picked = null;
    draw();
  }
  root.addEventListener('click', (e) => {
    if (root.dataset.locked) return;
    const chip = e.target.closest('[data-chip]');
    const slot = e.target.closest('[data-slot]');
    if (chip && chip.classList.contains('in-slot') && !picked) { place(chip.dataset.chip, 'bank'); return; }
    if (chip && !chip.classList.contains('in-slot')) { picked = picked === chip.dataset.chip ? null : chip.dataset.chip; draw(); return; }
    if (slot && picked) { place(picked, slot.dataset.slot); return; }
    if (slot && !picked && slot.dataset.slot && state[slot.dataset.slot].length && !slot.classList.contains('slot-multi')) {
      place(state[slot.dataset.slot][0], 'bank');
    }
  });
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-slot]')) { e.preventDefault(); e.target.click(); }
  });
  enableDrag(root, (chipId, target) => { if (!root.dataset.locked) place(chipId, target); });
  draw();
  return {
    state, draw,
    lock() {
      root.dataset.locked = '1';
      root.querySelectorAll('[data-chip]').forEach((b) => { b.disabled = true; });
      const bank = root.querySelector('[data-bank]');
      if (bank && !bank.querySelector('[data-chip]')) bank.hidden = true;
    }
  };
}

TYPES.drag = {
  label: __('Σύρε και άφησε'), icon: '⇄', desc: __('Οι μαθητές σέρνουν λέξεις στα κενά ενός κειμένου.'), scored: true,
  blank: () => ({ text: __('Σύρε κάθε λέξη στο σωστό κενό.'), cloze: '', extra: [] }),
  edit: (q, i) => clozeEditor(q, i, 'drag'),
  bind: (root, q, change) => bindCloze(root, q, change, 'drag'),
  validate: (q) => (blanksOf(q).length ? [] : [__('βάλε σε αγκύλες τουλάχιστον μία λέξη, π.χ. Το νερό βράζει στους [100] βαθμούς.')]),
  play(root, q, ctx) {
    const parts = parseCloze(q.cloze || '');
    const blanks = parts.filter((p) => p.blank);
    const words = shuffle(blanks.map((b) => b.answer).concat(q.extra || []));
    const chips = words.map((w, k) => ({ id: 'w' + k, label: w }));
    const slots = blanks.map((b, k) => ({ id: 'b' + k, aria: `${__('Κενό')} ${k + 1}` }));
    root.innerHTML = header(q) + `<div class="q-cloze q-cloze-drag" data-area></div><div class="bank" data-bank aria-label="${__('Λέξεις')}"></div>` + submitBar();
    const sub = root.querySelector('[data-submit]');
    let bi = 0;
    const w = placeWidget(root, {
      chips, slots,
      layout: (slotHtml) => { bi = 0; return parts.map((p) => (p.blank ? slotHtml(slots[bi++]) : esc(p.t))).join(''); },
      onChange: (st) => { if (sub) sub.disabled = slots.some((s) => !st[s.id].length); }
    });
    root.querySelector('[data-submit]').addEventListener('click', () => {
      ctx.submit(slots.map((s) => { const id = w.state[s.id][0]; return id ? chips.find((c) => c.id === id).label : ''; }));
    });
    return {
      reveal(a) {
        w.lock();
        root.querySelectorAll('[data-slot]').forEach((el, k) => {
          const ok = norm((a || [])[k]) === norm(blanks[k].answer);
          el.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) el.insertAdjacentHTML('afterend', `<span class="cz-fix">${esc(blanks[k].answer)}</span>`);
        });
        root.querySelector('[data-submit]').hidden = true;
      },
      disable() { w.lock(); root.querySelector('[data-submit]').disabled = true; }
    };
  },
  check(q, a) {
    const b = blanksOf(q);
    return b.length ? b.filter((x, k) => norm((a || [])[k]) === norm(x.answer)).length / b.length : 0;
  },
  describe: (q, a) => (a || []).join(' / ') || '—',
  correct: (q) => blanksOf(q).map((b) => b.answer).join(' / '),
  sample(q, good) { const b = blanksOf(q).map((x) => x.answer); return good ? b : shuffle(b.concat(q.extra || [])).slice(0, b.length); },
  summary(q, answers) {
    const b = blanksOf(q);
    return `<div class="sb">${b.map((x, k) => bar(`${__('Κενό {0}:', k + 1)} ${x.answer}`, answers.filter((a) => norm((a.v || [])[k]) === norm(x.answer)).length, answers.length, true)).join('')}</div>`;
  }
};

/* 6γ. Λέξεις στην εικόνα: κενά πάνω σε μια εικόνα (π.χ. τα όργανα του πεπτικού) και λέξεις που σέρνουν τα παιδιά.
   labels: [{ id, text, x, y }] με x, y από 0 έως 1: το κέντρο του κενού πάνω στην εικόνα. extra: λέξεις-παγίδες.
   Label the picture: blanks placed on an image; children drag words into them. x, y are fractions of the image size. */
const LB_MAX = 20;
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const atPos = (l) => `left:${(clamp01(l.x) * 100).toFixed(2)}%;top:${(clamp01(l.y) * 100).toFixed(2)}%`;
const lbOk = (q) => (q.labels || []).filter((l) => clean(l.text));
let lbSeq = 0;
const lbId = () => 'l' + Date.now().toString(36) + (lbSeq++).toString(36);
/* Η εικόνα με τα κενά, πάντα με τις αναλογίες της εικόνας, ώστε οι θέσεις να πέφτουν σωστά. */
function lbStageFit(stage) {
  const img = stage && stage.querySelector('.lb-img');
  if (!img) return;
  const set = () => { if (img.naturalWidth && img.naturalHeight) stage.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4)); };
  if (img.complete) set(); else img.addEventListener('load', set, { once: true });
}
const pinLabel = (l, k) => `${__('Κενό {0}', k + 1)}: ${clean(l.text) || __('χωρίς λέξη')}`;

TYPES.label = {
  label: __('Λέξεις στην εικόνα'), icon: '🏷', desc: __('Οι μαθητές σέρνουν λέξεις στα κενά μιας εικόνας, π.χ. τα μέρη ενός φυτού.'), scored: true, ownImage: true,
  blank: () => ({ text: __('Σύρε κάθε λέξη στη θέση της.'), labels: [], extra: [], time: 120 }),
  edit(q, i) {
    if (!q.image) {
      return `<div class="lb-ed"><label class="qe-drop lb-drop">${ICON.image}<span><b>${__('Ανέβασε την εικόνα')}</b> <span class="muted">${__('π.χ. ένα σχέδιο του πεπτικού συστήματος χωρίς ονόματα')}</span></span><input type="file" accept="image/*" data-c="image" class="sr"></label>
        <p class="hint">${__('Μετά πατάς πάνω στην εικόνα, εκεί που θέλεις ένα κενό, και γράφεις τη λέξη του.')}</p></div>`;
    }
    const ls = q.labels || [];
    return `<div class="lb-ed">
      <p class="hint lb-ed-h">${ls.length ? __('Πάτα πάνω στην εικόνα για ένα ακόμη κενό. Σύρε ένα κενό για να το μετακινήσεις.') : __('Πάτα πάνω στην εικόνα, εκεί που θέλεις το πρώτο κενό.')}</p>
      <div class="lb-stage lb-ed-stage" data-lb-stage>
        <img class="lb-img" src="${esc(q.image)}" alt="${__('Η εικόνα της ερώτησης')}" draggable="false">
        ${ls.map((l, k) => `<button type="button" class="lb-pin${clean(l.text) ? '' : ' is-empty'}" data-pin="${k}" style="${atPos(l)}" aria-label="${esc(pinLabel(l, k))}" title="${__('Σύρε για να το μετακινήσεις ή χρησιμοποίησε τα βέλη')}"><span class="lb-num" aria-hidden="true">${k + 1}</span><span class="lb-pin-t">${esc(clean(l.text) || '…')}</span></button>`).join('')}
      </div>
      <div class="lb-ed-tools"><label class="btn btn-sm btn-line">${ICON.image}${__('Άλλη εικόνα')}<input type="file" accept="image/*" data-c="image" class="sr"></label>
        <span class="muted">${__('Τα κενά μένουν στις ίδιες θέσεις.')}</span></div>
      <fieldset class="oe lb-words"><legend class="label">${__('Η λέξη κάθε κενού')}</legend>
        ${ls.length ? ls.map((l, k) => `<div class="oe-row lb-row"><span class="lb-num" aria-hidden="true">${k + 1}</span><input class="input" data-lb="${k}" value="${esc(l.text)}" maxlength="40" placeholder="${esc(__('Η λέξη του κενού {0}', k + 1))}" aria-label="${esc(__('Η λέξη του κενού {0}', k + 1))}"><button type="button" class="icon-btn" data-del-lb="${k}" aria-label="${esc(__('Αφαίρεση του κενού {0}', k + 1))}">${ICON.x}</button></div>`).join('')
          : `<p class="muted lb-none">${__('Δεν υπάρχουν κενά ακόμη.')}</p>`}
      </fieldset>
      <div class="field"><label class="label" for="lbx-${i}">${__('Λέξεις-παγίδες')} <span class="muted">${__('(προαιρετικά, χωρισμένες με κόμμα)')}</span></label>
        <input class="input" id="lbx-${i}" data-lb-extra value="${esc((q.extra || []).join(', '))}"></div>
    </div>`;
  },
  bind(root, q, change, redraw) {
    q.labels = q.labels || [];
    root.addEventListener('input', (e) => {
      const k = e.target.dataset.lb;
      if (k !== undefined) {
        const l = q.labels[Number(k)];
        if (!l) return;
        l.text = e.target.value;
        const pin = root.querySelector(`[data-pin="${k}"]`);
        if (pin) {
          pin.querySelector('.lb-pin-t').textContent = clean(l.text) || '…';
          pin.classList.toggle('is-empty', !clean(l.text));
          pin.setAttribute('aria-label', pinLabel(l, Number(k)));
        }
        change();
      }
      if (e.target.matches('[data-lb-extra]')) { q.extra = e.target.value.split(',').map(clean).filter(Boolean); change(); }
    });
    root.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del-lb]');
      if (del) { q.labels.splice(Number(del.dataset.delLb), 1); change(); redraw(); }
    });
    const stage = root.querySelector('[data-lb-stage]');
    if (!stage) return;
    lbStageFit(stage);
    const posOf = (ev) => { const r = stage.getBoundingClientRect(); return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) }; };
    // Σύρσιμο ενός κενού: αλλάζει θέση. / Dragging a blank moves it.
    stage.addEventListener('pointerdown', (e) => {
      const pin = e.target.closest('[data-pin]');
      if (!pin || e.button > 0) return;
      e.preventDefault();
      const k = Number(pin.dataset.pin), sx = e.clientX, sy = e.clientY;
      let moved = false;
      try { pin.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        pin.classList.add('is-moving');
        const at = posOf(ev);
        q.labels[k].x = at.x; q.labels[k].y = at.y;
        pin.style.left = `${(at.x * 100).toFixed(2)}%`; pin.style.top = `${(at.y * 100).toFixed(2)}%`;
      };
      const up = () => {
        pin.removeEventListener('pointermove', move); pin.removeEventListener('pointerup', up); pin.removeEventListener('pointercancel', up);
        pin.classList.remove('is-moving');
        if (moved) { pin.dataset.moved = '1'; setTimeout(() => { delete pin.dataset.moved; }, 0); change(); }
      };
      pin.addEventListener('pointermove', move); pin.addEventListener('pointerup', up); pin.addEventListener('pointercancel', up);
    });
    // Πάτημα στην εικόνα: νέο κενό. Πάτημα σε κενό: πας στη λέξη του. / Tap the image: new blank.
    stage.addEventListener('click', (e) => {
      const pin = e.target.closest('[data-pin]');
      if (pin) {
        if (!pin.dataset.moved) { const inp = root.querySelector(`[data-lb="${pin.dataset.pin}"]`); if (inp) inp.focus(); }
        return;
      }
      if (q.labels.length >= LB_MAX) { toast(__('Έως {0} κενά σε κάθε εικόνα.', LB_MAX), 'error'); return; }
      const at = posOf(e);
      q.labels.push({ id: lbId(), text: '', x: at.x, y: at.y });
      change();
      redraw(`[data-lb="${q.labels.length - 1}"]`);
    });
    // Με το πληκτρολόγιο: τα βέλη μετακινούν το κενό (με Shift πιο πολύ). / Arrow keys move a blank.
    stage.addEventListener('keydown', (e) => {
      const pin = e.target.closest('[data-pin]');
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!pin || !d) return;
      e.preventDefault();
      const l = q.labels[Number(pin.dataset.pin)], step = e.shiftKey ? 0.05 : 0.01;
      l.x = clamp01(l.x + d[0] * step); l.y = clamp01(l.y + d[1] * step);
      pin.style.left = `${(l.x * 100).toFixed(2)}%`; pin.style.top = `${(l.y * 100).toFixed(2)}%`;
      change();
    });
  },
  validate(q) {
    const e = [];
    if (!q.image) e.push(__('ανέβασε την εικόνα'));
    else if (lbOk(q).length < 2) e.push(__('πάτα πάνω στην εικόνα για να βάλεις τουλάχιστον δύο κενά και γράψε τη λέξη τους'));
    if ((q.labels || []).some((l) => !clean(l.text)) && lbOk(q).length) e.push(__('γράψε τη λέξη σε κάθε κενό ή σβήσε όσα περισσεύουν'));
    return e;
  },
  tidy(q) {
    q.labels = lbOk(q).slice(0, LB_MAX).map((l) => ({ id: l.id || lbId(), text: clean(l.text), x: Math.round(clamp01(l.x) * 10000) / 10000, y: Math.round(clamp01(l.y) * 10000) / 10000 }));
    q.extra = (q.extra || []).map(clean).filter(Boolean).slice(0, 10);
  },
  play(root, q, ctx) {
    const ls = lbOk(q);
    const words = shuffle(ls.map((l) => clean(l.text)).concat((q.extra || []).map(clean).filter(Boolean)));
    const chips = words.map((w, k) => ({ id: 'w' + k, label: w }));
    const slots = ls.map((l, k) => ({ id: 's' + k, aria: __('Κενό {0}', k + 1) }));
    const longest = Math.max(4, ...words.map((w) => w.length));
    root.innerHTML = `<div class="q-card"><h1 class="q-text">${esc(q.text)}</h1></div>
      <div class="lb-stage lb-play" style="--lbw:${Math.min(longest, 18)}"><img class="lb-img" src="${esc(q.image)}" alt="${__('Η εικόνα της ερώτησης')}" draggable="false"><div class="lb-layer" data-area></div></div>
      <div class="bank" data-bank aria-label="${__('Λέξεις')}"></div>` + submitBar();
    lbStageFit(root.querySelector('.lb-stage'));
    const sub = root.querySelector('[data-submit]');
    const w = placeWidget(root, {
      chips, slots,
      layout: (slotHtml) => slots.map((s, k) => `<span class="lb-pos" style="${atPos(ls[k])}"><span class="lb-num" aria-hidden="true">${k + 1}</span>${slotHtml(s)}</span>`).join(''),
      onChange: (st) => { if (sub) sub.disabled = slots.some((s) => !st[s.id].length); }
    });
    sub.addEventListener('click', () => {
      ctx.submit(slots.map((s) => { const id = w.state[s.id][0]; return id ? chips.find((c) => c.id === id).label : ''; }));
    });
    return {
      reveal(a) {
        w.lock();
        root.querySelectorAll('.lb-pos').forEach((pos, k) => {
          const ok = norm((a || [])[k]) === norm(ls[k].text);
          const slot = pos.querySelector('[data-slot]');
          if (slot) slot.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) pos.insertAdjacentHTML('beforeend', `<span class="lb-fix">${esc(ls[k].text)}</span>`);
        });
        sub.hidden = true;
      },
      disable() { w.lock(); sub.disabled = true; }
    };
  },
  check(q, a) {
    const ls = lbOk(q);
    return ls.length ? ls.filter((l, k) => norm((a || [])[k]) === norm(l.text)).length / ls.length : 0;
  },
  describe: (q, a) => (Array.isArray(a) && a.some(Boolean) ? lbOk(q).map((l, k) => `${k + 1}. ${a[k] || '—'}`).join(' · ') : '—'),
  correct: (q) => lbOk(q).map((l, k) => `${k + 1}. ${clean(l.text)}`).join(' · '),
  sample(q, good) {
    const ls = lbOk(q).map((l) => clean(l.text));
    return good ? ls : shuffle(ls.concat(q.extra || [])).slice(0, ls.length);
  },
  summary(q, answers) {
    return `<div class="sb">${lbOk(q).map((l, k) => bar(`${k + 1}. ${clean(l.text)}`, answers.filter((a) => norm((a.v || [])[k]) === norm(l.text)).length, answers.length, true)).join('')}</div>`;
  },
  /* Η μπροστινή όψη στις κάρτες μελέτης: η εικόνα με τους αριθμούς των κενών. */
  face: (q) => `<span class="lb-stage lb-face"><img class="lb-img" src="${esc(q.image)}" alt="">${lbOk(q).map((l, k) => `<span class="lb-mark" style="${atPos(l)}">${k + 1}</span>`).join('')}</span>`,
  /* Η πίσω όψη: η ίδια εικόνα με τις λέξεις στη θέση τους. */
  back: (q) => `<span class="lb-stage lb-face"><img class="lb-img" src="${esc(q.image)}" alt="">${lbOk(q).map((l, k) => `<span class="lb-ans" style="${atPos(l)}"><span class="lb-num" aria-hidden="true">${k + 1}</span>${esc(clean(l.text))}</span>`).join('')}</span>`
};

/* 6β. Υπογράμμιση στο κείμενο: «Ο Παρθενώνας χτίστηκε τον [5ο αιώνα π.Χ.].» */
const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;
function splitWords(text) {
  const out = [];
  let last = 0, m;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text))) {
    if (m.index > last) out.push({ s: text.slice(last, m.index) });
    out.push({ w: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ s: text.slice(last) });
  return out;
}
/* Λέξεις και κενά του κειμένου· c = πρέπει να υπογραμμιστεί. */
export function parseUnderline(src) {
  const toks = [];
  const re = /\[([^\]]*)\]|([^[]+)|\[/g;
  let m;
  while ((m = re.exec(String(src || '')))) {
    if (m[1] !== undefined) splitWords(m[1]).forEach((t) => toks.push(t.w !== undefined ? { w: t.w, c: true } : t));
    else if (m[2] !== undefined) splitWords(m[2]).forEach((t) => toks.push(t.w !== undefined ? { w: t.w, c: false } : t));
  }
  return toks;
}
export function serializeUnderline(toks) {
  let out = '', open = false;
  toks.forEach((t, i) => {
    if (t.w === undefined) { out += t.s; return; }
    if (t.c && !open) { out += '['; open = true; }
    out += t.w;
    const nx = toks[i + 1], nw = toks[i + 2];
    const goesOn = nx && nx.s !== undefined && /^[ \t]+$/.test(nx.s) && nw && nw.w !== undefined && nw.c;
    if (open && !goesOn) { out += ']'; open = false; }
  });
  if (open) out += ']';
  return out;
}
const ulWords = (q) => parseUnderline(q.passage).filter((t) => t.w !== undefined);
const ulRight = (q) => ulWords(q).map((w, i) => (w.c ? i : -1)).filter((i) => i >= 0);
/* Οι λέξεις που διάλεξαν, σε ομάδες γειτονικών λέξεων. */
function ulPhrases(q, idx) {
  const words = ulWords(q);
  const sorted = Array.from(new Set(idx)).filter((i) => words[i]).sort((a, b) => a - b);
  const groups = [];
  sorted.forEach((i) => { const g = groups[groups.length - 1]; if (g && g[g.length - 1] === i - 1) g.push(i); else groups.push([i]); });
  return groups.map((g) => g.map((i) => words[i].w).join(' '));
}
function ulPreview(q) {
  const toks = parseUnderline(q.passage);
  if (!toks.some((t) => t.w !== undefined)) return ('<span class="muted">' + __('Η προεπισκόπηση εμφανίζεται μόλις γράψεις το κείμενο.') + '</span>');
  let k = 0;
  return `<p class="hint ul-prev-h">${__('Πάτα μια λέξη για να τη σημειώσεις ως σωστή ή για να το αναιρέσεις:')}</p><div class="ul-prev">${toks.map((t) => (t.w !== undefined
    ? `<button type="button" class="ul-pw ${t.c ? 'is-c' : ''}" data-uw="${k++}" aria-pressed="${t.c}">${esc(t.w)}</button>` : esc(t.s))).join('')}</div>`;
}
TYPES.underline = {
  label: __('Υπογράμμιση στο κείμενο'), icon: 'U', desc: __('Οι μαθητές υπογραμμίζουν στο κείμενο τις λέξεις που απαντούν στην ερώτηση.'), scored: true,
  blank: () => ({ text: '', passage: '' }),
  edit: (q, i) => `<div class="field"><label class="label" for="ul-${i}">${__('Κείμενο')}</label>
    <textarea class="input" id="ul-${i}" rows="4" data-f="passage" placeholder="${esc(__('Ο Παρθενώνας χτίστηκε τον [5ο αιώνα π.Χ.] στην Ακρόπολη της Αθήνας.'))}">${esc(q.passage || '')}</textarea>
    <p class="hint">${__('Βάλε σε αγκύλες ό,τι πρέπει να υπογραμμίσουν τα παιδιά, π.χ. [5ο αιώνα π.Χ.]. Μπορείς και να πατήσεις τις λέξεις στην προεπισκόπηση.')}</p></div>
    <div class="ul-preview" data-preview>${ulPreview(q)}</div>`,
  bind(root, q, change) {
    root.addEventListener('input', (e) => {
      if (e.target.dataset.f !== 'passage') return;
      q.passage = e.target.value;
      root.querySelector('[data-preview]').innerHTML = ulPreview(q);
      change();
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-uw]');
      if (!b) return;
      const toks = parseUnderline(q.passage);
      let k = -1;
      const idx = Number(b.dataset.uw);
      toks.forEach((t) => { if (t.w !== undefined && ++k === idx) t.c = !t.c; });
      q.passage = serializeUnderline(toks);
      root.querySelector('[data-f="passage"]').value = q.passage;
      root.querySelector('[data-preview]').innerHTML = ulPreview(q);
      const again = root.querySelector(`[data-uw="${idx}"]`);
      if (again) again.focus();
      change();
    });
  },
  validate(q) {
    const words = ulWords(q);
    if (!words.length) return [__('γράψε το κείμενο')];
    if (!words.some((w) => w.c)) return [__('σημείωσε σε αγκύλες τουλάχιστον μία λέξη που πρέπει να υπογραμμιστεί')];
    if (words.every((w) => w.c)) return [__('όλες οι λέξεις είναι σημειωμένες ως σωστές· άφησε και κάποιες χωρίς αγκύλες')];
    return [];
  },
  tidy(q) { q.passage = String(q.passage || '').replace(/[ \t]+\n/g, '\n').trim(); },
  play(root, q, ctx) {
    const toks = parseUnderline(q.passage);
    let k = 0;
    root.innerHTML = header(q) + `<p class="q-hint">${__('Πάτα τις λέξεις για να τις υπογραμμίσεις.')}</p><div class="q-ul">${toks.map((t) => (t.w !== undefined
      ? `<button type="button" class="ul-w" data-w="${k++}" aria-pressed="false">${esc(t.w)}</button>` : `<span>${esc(t.s)}</span>`)).join('')}</div>` + submitBar();
    const sub = root.querySelector('[data-submit]');
    const btns = Array.from(root.querySelectorAll('.ul-w'));
    const chosen = () => btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => Number(b.dataset.w));
    root.querySelector('.q-ul').addEventListener('click', (e) => {
      const b = e.target.closest('.ul-w');
      if (!b || b.disabled) return;
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      sub.disabled = !chosen().length;
    });
    sub.addEventListener('click', () => ctx.submit(chosen()));
    return {
      reveal(a) {
        const right = new Set(ulRight(q));
        const sel = new Set(Array.isArray(a) ? a : []);
        btns.forEach((b) => {
          const i = Number(b.dataset.w);
          b.disabled = true;
          if (sel.has(i) && right.has(i)) b.classList.add('is-right');
          else if (sel.has(i)) b.classList.add('is-wrong');
          else if (right.has(i)) b.classList.add('is-missed');
        });
        sub.hidden = true;
      },
      disable() { btns.forEach((b) => { b.disabled = true; }); sub.disabled = true; }
    };
  },
  check(q, a) {
    const right = new Set(ulRight(q));
    if (!right.size) return 0;
    let hits = 0, wrong = 0;
    new Set(Array.isArray(a) ? a : []).forEach((i) => { if (right.has(i)) hits++; else wrong++; });
    return Math.max(0, (hits - wrong) / right.size);
  },
  describe: (q, a) => ulPhrases(q, Array.isArray(a) ? a : []).join(' … ') || '—',
  correct: (q) => ulPhrases(q, ulRight(q)).join(' … '),
  sample(q, good) {
    const right = ulRight(q);
    if (good) return right;
    const others = ulWords(q).map((w, i) => i).filter((i) => !right.includes(i));
    return right.slice(0, Math.max(0, right.length - 1)).concat(others.length ? [pick(others)] : []);
  },
  summary(q, answers) {
    const toks = parseUnderline(q.passage);
    const n = answers.length || 1;
    const counts = {};
    answers.forEach((a) => (Array.isArray(a.v) ? a.v : []).forEach((i) => { counts[i] = (counts[i] || 0) + 1; }));
    const full = answers.filter((a) => TYPES.underline.check(q, a.v) === 1).length;
    let k = 0;
    return `<p class="ul-sum-h">${full} ${__('από {0} υπογράμμισαν ακριβώς τη σωστή απάντηση. Πιο σκούρο: το υπογράμμισαν περισσότερα παιδιά.', answers.length)}</p>
      <div class="ul-sum">${toks.map((t) => {
        if (t.w === undefined) return esc(t.s);
        const i = k++;
        const p = (counts[i] || 0) / n;
        return `<span class="ul-s ${t.c ? 'is-c' : ''}" style="--p:${p.toFixed(2)}" title="${Math.round(p * 100)}%">${esc(t.w)}</span>`;
      }).join('')}</div>`;
  }
};

/* 7. Αντιστοίχιση */
TYPES.match = {
  label: __('Αντιστοίχιση'), icon: '⟷', desc: __('Οι μαθητές ενώνουν κάθε στοιχείο με το ταίρι του.'), scored: true,
  blank: () => ({ text: __('Αντιστοίχισε κάθε στοιχείο με το ταίρι του.'), pairs: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] }),
  edit: (q, i) => `<fieldset class="oe"><legend class="label">${__('Ζευγάρια')}</legend>${q.pairs.map((p, k) => `<div class="pair-row">
      <input class="input" data-pa="${k}" value="${esc(p.a)}" placeholder="${__('Στοιχείο')} ${k + 1}" aria-label="${__('Στοιχείο')} ${k + 1}"><span class="pair-sep" aria-hidden="true">⟷</span>
      <input class="input" data-pb="${k}" value="${esc(p.b)}" placeholder="${__('Ταίρι')} ${k + 1}" aria-label="${__('Ταίρι')} ${k + 1}">
      ${q.pairs.length > 2 ? `<button type="button" class="icon-btn" data-del-pair="${k}" aria-label="${__('Αφαίρεση ζευγαριού')} ${k + 1}">${ICON.x}</button>` : '<span class="icon-space"></span>'}</div>`).join('')}
      ${q.pairs.length < 8 ? `<button type="button" class="btn btn-sm btn-ghost" data-add-pair>${ICON.plus}${__('Ζευγάρι')}</button>` : ''}</fieldset>`,
  bind(root, q, change, redraw) {
    root.addEventListener('input', (e) => {
      if (e.target.dataset.pa !== undefined) { q.pairs[Number(e.target.dataset.pa)].a = e.target.value; change(); }
      if (e.target.dataset.pb !== undefined) { q.pairs[Number(e.target.dataset.pb)].b = e.target.value; change(); }
    });
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del-pair]');
      if (d) { q.pairs.splice(Number(d.dataset.delPair), 1); change(); redraw(); }
      if (e.target.closest('[data-add-pair]')) { q.pairs.push({ a: '', b: '' }); change(); redraw(`[data-pa="${q.pairs.length - 1}"]`); }
    });
  },
  validate(q) {
    const full = q.pairs.filter((p) => clean(p.a) && clean(p.b));
    if (full.length < 2) return [__('χρειάζονται τουλάχιστον δύο συμπληρωμένα ζευγάρια')];
    if (q.pairs.some((p) => (clean(p.a) && !clean(p.b)) || (!clean(p.a) && clean(p.b)))) return [__('κάποιο ζευγάρι έχει μόνο το ένα μέρος')];
    const bs = full.map((p) => norm(p.b));
    if (new Set(bs).size !== bs.length) return [__('δύο ζευγάρια έχουν το ίδιο ταίρι· κάνε τα ταίρια διαφορετικά')];
    return [];
  },
  tidy(q) { q.pairs = q.pairs.filter((p) => clean(p.a) && clean(p.b)).map((p) => ({ a: clean(p.a), b: clean(p.b) })); },
  play(root, q, ctx) {
    const lefts = q.pairs.map((p, k) => ({ k, a: p.a }));
    const chips = shuffle(q.pairs.map((p, k) => ({ id: 'm' + k, label: p.b })));
    const slots = lefts.map((l) => ({ id: 'l' + l.k, aria: `${__('Ταίρι για:')} ${l.a}` }));
    root.innerHTML = header(q) + `<div class="q-match" data-area></div><div class="bank" data-bank aria-label="${__('Ταίρια')}"></div>` + submitBar();
    const sub = root.querySelector('[data-submit]');
    const w = placeWidget(root, {
      chips, slots,
      layout: (slotHtml) => lefts.map((l, k) => `<div class="match-row"><span class="match-a">${esc(l.a)}</span><span class="match-arrow" aria-hidden="true">→</span>${slotHtml(slots[k])}</div>`).join(''),
      onChange: (st) => { if (sub) sub.disabled = slots.some((s) => !st[s.id].length); }
    });
    root.querySelector('[data-submit]').addEventListener('click', () => {
      ctx.submit(slots.map((s) => { const id = w.state[s.id][0]; return id ? chips.find((c) => c.id === id).label : ''; }));
    });
    return {
      reveal(a) {
        w.lock();
        root.querySelectorAll('[data-slot]').forEach((el, k) => {
          const ok = norm((a || [])[k]) === norm(q.pairs[k].b);
          el.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) el.insertAdjacentHTML('afterend', `<span class="cz-fix">${esc(q.pairs[k].b)}</span>`);
        });
        root.querySelector('[data-submit]').hidden = true;
      },
      disable() { w.lock(); root.querySelector('[data-submit]').disabled = true; }
    };
  },
  check: (q, a) => (q.pairs.length ? q.pairs.filter((p, k) => norm((a || [])[k]) === norm(p.b)).length / q.pairs.length : 0),
  describe: (q, a) => q.pairs.map((p, k) => `${p.a} → ${(a || [])[k] || '—'}`).join('; '),
  correct: (q) => q.pairs.map((p) => `${p.a} → ${p.b}`).join('; '),
  sample(q, good) { const b = q.pairs.map((p) => p.b); return good ? b : shuffle(b); },
  summary(q, answers) {
    return `<div class="sb">${q.pairs.map((p, k) => bar(`${p.a} → ${p.b}`, answers.filter((a) => norm((a.v || [])[k]) === norm(p.b)).length, answers.length, true)).join('')}</div>`;
  }
};

/* 8. Σειροθέτηση */
TYPES.reorder = {
  label: __('Σειροθέτηση'), icon: '⇅', desc: __('Οι μαθητές βάζουν στοιχεία στη σωστή σειρά.'), scored: true,
  blank: () => ({ text: __('Βάλε τα στη σωστή σειρά.'), items: ['', '', ''] }),
  edit: (q, i) => `<fieldset class="oe"><legend class="label">${__('Στοιχεία στη σωστή σειρά')} <span class="muted">${__('(οι μαθητές τα βλέπουν ανακατεμένα)')}</span></legend>${q.items.map((it, k) => `<div class="pair-row">
      <span class="ro-n">${k + 1}</span><input class="input" data-it="${k}" value="${esc(it)}" placeholder="${__('Στοιχείο')} ${k + 1}" aria-label="${__('Στοιχείο')} ${k + 1}">
      ${q.items.length > 2 ? `<button type="button" class="icon-btn" data-del-it="${k}" aria-label="${__('Αφαίρεση στοιχείου')} ${k + 1}">${ICON.x}</button>` : '<span class="icon-space"></span>'}</div>`).join('')}
      ${q.items.length < 8 ? `<button type="button" class="btn btn-sm btn-ghost" data-add-it>${ICON.plus}${__('Στοιχείο')}</button>` : ''}</fieldset>`,
  bind(root, q, change, redraw) {
    root.addEventListener('input', (e) => { if (e.target.dataset.it !== undefined) { q.items[Number(e.target.dataset.it)] = e.target.value; change(); } });
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del-it]');
      if (d) { q.items.splice(Number(d.dataset.delIt), 1); change(); redraw(); }
      if (e.target.closest('[data-add-it]')) { q.items.push(''); change(); redraw(`[data-it="${q.items.length - 1}"]`); }
    });
  },
  validate: (q) => (q.items.filter((x) => clean(x)).length < 2 ? [__('χρειάζονται τουλάχιστον δύο στοιχεία')] : []),
  tidy(q) { q.items = q.items.map(clean).filter(Boolean); },
  play(root, q, ctx) {
    let order = q.items.map((_, k) => k);
    for (let t = 0; t < 6 && order.every((k, i) => k === i); t++) order = shuffle(order);
    root.innerHTML = header(q) + `<ol class="ro-list" data-list></ol>` + submitBar();
    const list = root.querySelector('[data-list]');
    let locked = false;
    const draw = (focusK) => {
      list.innerHTML = order.map((k, pos) => `<li class="ro-item" data-k="${k}">
        <span class="ro-handle" aria-hidden="true">${ICON.grip}</span><span class="ro-pos">${pos + 1}</span><span class="ro-t">${esc(q.items[k])}</span>
        <span class="ro-btns"><button type="button" class="icon-btn" data-mv="-1" aria-label="${__('Πιο πάνω:')} ${esc(q.items[k])}" ${pos === 0 || locked ? 'disabled' : ''}>${ICON.up}</button>
        <button type="button" class="icon-btn" data-mv="1" aria-label="${__('Πιο κάτω:')} ${esc(q.items[k])}" ${pos === order.length - 1 || locked ? 'disabled' : ''}>${ICON.down}</button></span></li>`).join('');
      if (focusK !== undefined) { const b = list.querySelector(`[data-k="${focusK.k}"] [data-mv="${focusK.d}"]`); if (b && !b.disabled) b.focus(); }
    };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b || locked) return;
      const k = Number(b.closest('[data-k]').dataset.k);
      const pos = order.indexOf(k);
      const to = pos + Number(b.dataset.mv);
      if (to < 0 || to >= order.length) return;
      order.splice(pos, 1); order.splice(to, 0, k);
      draw({ k, d: b.dataset.mv });
    });
    // σύρσιμο με το «χερούλι»
    list.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.ro-handle');
      if (!h || locked || e.button > 0) return;
      const li = h.closest('.ro-item');
      const k = Number(li.dataset.k);
      li.setPointerCapture && li.setPointerCapture(e.pointerId);
      li.classList.add('is-dragging');
      const move = (ev) => {
        ev.preventDefault();
        const items = Array.from(list.children);
        const target = items.find((el) => { const r = el.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom; });
        if (!target || target === li) return;
        const to = order.indexOf(Number(target.dataset.k));
        const from = order.indexOf(k);
        order.splice(from, 1); order.splice(to, 0, k);
        draw();
        const again = list.querySelector(`[data-k="${k}"]`);
        if (again) again.classList.add('is-dragging');
      };
      list.addEventListener('pointermove', move);
      window.addEventListener('pointerup', () => { list.removeEventListener('pointermove', move); draw(); }, { once: true });
    });
    draw();
    const sub = root.querySelector('[data-submit]');
    sub.disabled = false;
    sub.addEventListener('click', () => ctx.submit(order.map((k) => q.items[k])));
    return {
      reveal(a) {
        locked = true;
        draw();
        list.querySelectorAll('.ro-item').forEach((li, pos) => {
          const ok = norm((a || [])[pos]) === norm(q.items[pos]);
          li.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) li.insertAdjacentHTML('beforeend', `<span class="ro-fix">${__('σωστή θέση:')} ${q.items.indexOf(li.querySelector('.ro-t').textContent) + 1}</span>`);
        });
        sub.hidden = true;
      },
      disable() { locked = true; draw(); sub.disabled = true; }
    };
  },
  check: (q, a) => (q.items.length ? q.items.filter((it, k) => norm((a || [])[k]) === norm(it)).length / q.items.length : 0),
  describe: (q, a) => (a || []).join(' → ') || '—',
  correct: (q) => q.items.join(' → '),
  sample: (q, good) => (good ? q.items.slice() : shuffle(q.items)),
  summary(q, answers) {
    return `<div class="sb">${q.items.map((it, k) => bar(`${k + 1}. ${it}`, answers.filter((a) => norm((a.v || [])[k]) === norm(it)).length, answers.length, true)).join('')}</div>`;
  }
};

/* 9. Κατηγοριοποίηση */
const catItems = (q) => {
  const out = [];
  q.groups.forEach((g, gi) => (g.items || []).forEach((it) => { if (clean(it)) out.push({ t: clean(it), g: gi }); }));
  return out;
};
TYPES.categorize = {
  label: __('Κατηγοριοποίηση'), icon: '▦', desc: __('Οι μαθητές βάζουν κάθε στοιχείο στη σωστή ομάδα (2–4 ομάδες).'), scored: true,
  blank: () => ({ text: __('Βάλε κάθε λέξη στη σωστή ομάδα.'), groups: [{ name: '', items: [] }, { name: '', items: [] }] }),
  edit: (q, i) => `<div class="cat-edit">${q.groups.map((g, k) => `<fieldset class="cat-group-e"><legend class="sr">${__('Ομάδα στοιχείων')} ${k + 1}</legend>
      <div class="cat-head"><input class="input" data-gn="${k}" value="${esc(g.name)}" placeholder="${__('Όνομα ομάδας')} ${k + 1}" aria-label="${__('Όνομα ομάδας')} ${k + 1}">
      ${q.groups.length > 2 ? `<button type="button" class="icon-btn" data-del-g="${k}" aria-label="${__('Αφαίρεση ομάδας')} ${k + 1}">${ICON.x}</button>` : ''}</div>
      <textarea class="input" rows="4" data-gi="${k}" placeholder="${__('Ένα στοιχείο σε κάθε γραμμή')}" aria-label="${__('Στοιχεία ομάδας')} ${k + 1}">${esc((g.items || []).join('\n'))}</textarea></fieldset>`).join('')}</div>
      ${q.groups.length < 4 ? `<button type="button" class="btn btn-sm btn-ghost" data-add-g>${ICON.plus}${__('Νέα ομάδα')}</button>` : ''}`,
  bind(root, q, change, redraw) {
    root.addEventListener('input', (e) => {
      if (e.target.dataset.gn !== undefined) { q.groups[Number(e.target.dataset.gn)].name = e.target.value; change(); }
      if (e.target.dataset.gi !== undefined) { q.groups[Number(e.target.dataset.gi)].items = e.target.value.split('\n'); change(); }
    });
    root.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del-g]');
      if (d) { q.groups.splice(Number(d.dataset.delG), 1); change(); redraw(); }
      if (e.target.closest('[data-add-g]')) { q.groups.push({ name: '', items: [] }); change(); redraw(`[data-gn="${q.groups.length - 1}"]`); }
    });
  },
  validate(q) {
    if (q.groups.some((g) => !clean(g.name))) return [__('δώσε όνομα σε κάθε ομάδα')];
    const items = catItems(q);
    if (items.length < 2) return [__('πρόσθεσε τουλάχιστον δύο στοιχεία')];
    if (items.length > 20) return [__('το πολύ 20 στοιχεία συνολικά')];
    if (new Set(items.map((x) => norm(x.t))).size !== items.length) return [__('κάθε στοιχείο πρέπει να εμφανίζεται μία φορά')];
    return [];
  },
  tidy(q) { q.groups = q.groups.map((g) => ({ name: clean(g.name), items: (g.items || []).map(clean).filter(Boolean) })); },
  play(root, q, ctx) {
    const items = catItems(q);
    const chips = shuffle(items.map((it, k) => ({ id: 'c' + k, label: it.t })));
    const slots = q.groups.map((g, k) => ({ id: 'g' + k, multi: true, aria: `${__('Ομάδα:')} ${g.name}` }));
    root.innerHTML = header(q) + `<div class="q-cat" data-area></div><div class="bank" data-bank aria-label="${__('Στοιχεία')}"></div>` + submitBar();
    const sub = root.querySelector('[data-submit]');
    const w = placeWidget(root, {
      chips, slots,
      layout: (slotHtml) => q.groups.map((g, k) => `<div class="cat-box"><p class="cat-name">${esc(g.name)}</p>${slotHtml(slots[k])}</div>`).join(''),
      onChange: (st) => { if (sub) sub.disabled = chips.some((c) => !slots.some((s) => st[s.id].includes(c.id))); }
    });
    root.querySelector('[data-submit]').addEventListener('click', () => {
      // απάντηση: η ομάδα που διάλεξαν για κάθε στοιχείο, με τη σειρά των στοιχείων της ερώτησης
      ctx.submit(items.map((it, k) => slots.findIndex((s) => w.state[s.id].includes('c' + k))));
    });
    return {
      reveal(a) {
        w.lock();
        root.querySelectorAll('.in-slot').forEach((el) => {
          const k = Number(el.dataset.chip.slice(1));
          el.classList.add((a || [])[k] === items[k].g ? 'is-right' : 'is-wrong');
        });
        root.querySelector('[data-submit]').hidden = true;
      },
      disable() { w.lock(); root.querySelector('[data-submit]').disabled = true; }
    };
  },
  check(q, a) { const items = catItems(q); return items.length ? items.filter((it, k) => (a || [])[k] === it.g).length / items.length : 0; },
  describe(q, a) {
    const items = catItems(q);
    return q.groups.map((g, gi) => `${g.name}: ${items.filter((it, k) => (a || [])[k] === gi).map((it) => it.t).join(', ') || '—'}`).join('; ');
  },
  correct: (q) => q.groups.map((g) => `${g.name}: ${(g.items || []).join(', ')}`).join('; '),
  sample(q, good) { return catItems(q).map((it) => (good ? it.g : Math.floor(Math.random() * q.groups.length))); },
  summary(q, answers) {
    const items = catItems(q);
    return `<div class="sb">${items.map((it, k) => bar(`${it.t} → ${q.groups[it.g].name}`, answers.filter((a) => (a.v || [])[k] === it.g).length, answers.length, true)).join('')}</div>`;
  }
};

/* 10. Δημοσκόπηση */
TYPES.poll = {
  label: __('Δημοσκόπηση'), icon: '◔', desc: __('Ρωτάς τη γνώμη τους· δεν υπάρχει σωστή απάντηση.'), scored: false, instant: true,
  blank: () => ({ options: ['', '', ''] }),
  edit: (q, i) => optionsEditor(q, i, 'none'),
  bind: (root, q, change, redraw) => bindOptions(root, q, change, redraw, 'none'),
  validate: (q) => (q.options.filter((o) => clean(o)).length < 2 ? [__('χρειάζονται τουλάχιστον δύο επιλογές')] : []),
  tidy(q) { q.options = q.options.map(clean).filter(Boolean); },
  play(root, q, ctx) {
    root.innerHTML = header(q) + `<div class="q-opts" role="group" aria-label="${__('Επιλογές')}">${q.options.map((o, k) =>
      `<button type="button" class="opt" data-k="${k}" style="${optStyle(k)}"><span class="opt-l" aria-hidden="true">${LETTERS[k]}</span><span class="opt-t">${esc(o)}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join('')}</div>`;
    root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => ctx.submit(Number(b.dataset.k))));
    return {
      reveal(a) { root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; if (Number(b.dataset.k) !== a) b.classList.add('is-dim'); else b.classList.add('is-picked'); }); },
      disable() { root.querySelectorAll('.opt').forEach((b) => { b.disabled = true; }); }
    };
  },
  check: () => null,
  describe: (q, a) => (q.options[a] !== undefined ? q.options[a] : '—'),
  correct: () => '',
  sample: (q) => Math.floor(Math.random() * q.options.length),
  summary: (q, answers) => optionCounts(q, answers, () => false)
};

/* 11. Ανοιχτή απάντηση */
TYPES.open = {
  label: __('Ανοιχτή απάντηση'), icon: '¶', desc: __('Οι μαθητές γράφουν ελεύθερα· διαβάζεις τις απαντήσεις στην αναφορά.'), scored: false,
  blank: () => ({}),
  edit: () => ('<p class="hint">' + __('Δεν βαθμολογείται αυτόματα. Θα δεις όλες τις απαντήσεις στην αναφορά του παιχνιδιού.') + '</p>'),
  bind() {},
  validate: () => [],
  play(root, q, ctx) {
    root.innerHTML = header(q) + `<div class="q-open"><label class="sr" for="open-in">${__('Η απάντησή σου')}</label>
      <textarea id="open-in" class="input" rows="4" maxlength="600" placeholder="${__('Γράψε την απάντησή σου')}"></textarea>
      <p class="hint" data-count>0 / 600</p></div>` + submitBar();
    const ta = root.querySelector('#open-in');
    const sub = root.querySelector('[data-submit]');
    ta.addEventListener('input', () => { sub.disabled = !ta.value.trim(); root.querySelector('[data-count]').textContent = `${ta.value.length} / 600`; });
    sub.addEventListener('click', () => ctx.submit(ta.value.trim()));
    return { reveal() { ta.disabled = true; sub.hidden = true; }, disable() { ta.disabled = true; sub.disabled = true; } };
  },
  check: () => null,
  describe: (q, a) => (a ? String(a) : '—'),
  correct: () => '',
  sample: () => pick([__('Μου άρεσε πολύ.'), __('Ήταν δύσκολο στην αρχή.'), __('Έμαθα κάτι καινούριο!'), __('Θέλω κι άλλες τέτοιες ερωτήσεις.')]),
  summary(q, answers) {
    return `<ul class="open-list">${answers.map((a) => `<li><b>${esc(a.name || '')}</b> ${esc(a.v || '')}</li>`).join('') || ('<li class="muted">' + __('Καμία απάντηση.') + '</li>')}</ul>`;
  }
};

export const TYPE_ORDER = ['mcq', 'multi', 'tf', 'fill', 'dropdown', 'drag', 'label', 'underline', 'match', 'reorder', 'categorize', 'poll', 'open'];

/* Εικονίδια ειδών (SVG, ίδια σε κάθε συσκευή). */
const TI = (d, extra = '') => `<svg class="ico ti" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</g>${extra}</svg>`;
const TYPE_ICONS = {
  mcq: TI('<circle cx="12" cy="12" r="8.5"/>', '<circle cx="12" cy="12" r="4" fill="currentColor"/>'),
  multi: TI('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 12.5l3 3 5.5-6.5"/>'),
  tf: TI('<path d="M2.5 12.5l3 3 5-6.5"/><path d="M14.5 8.5l6.5 7M21 8.5l-6.5 7"/>'),
  fill: TI('<path d="M3 20.5h18"/><path d="M6 16.5V14l8.5-8.5 2.5 2.5-8.5 8.5z"/>'),
  dropdown: TI('<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M13.5 11l2.5 2.5 2.5-2.5"/><path d="M6 12h4"/>'),
  underline: TI('<path d="M6.5 15.5l5.5-12 5.5 12M8.6 11h6.8"/><path d="M3.5 20.5h17" stroke-width="2.6"/>'),
  drag: TI('<rect x="3" y="3" width="11" height="6.5" rx="2"/><path d="M8.5 10v6"/><path d="M6 13.5l2.5 2.5 2.5-2.5"/><path d="M3 20.5h4M10 20.5h4M17 20.5h4"/>'),
  label: TI('<rect x="2.5" y="3.5" width="19" height="17" rx="3"/><path d="M2.5 16.5l5-5 4 4 3-3 4.5 4.5"/><rect x="12" y="6" width="7.5" height="4" rx="1.2"/><path d="M9 8h3"/>'),
  match: TI('<circle cx="5" cy="6.5" r="2"/><circle cx="5" cy="17.5" r="2"/><circle cx="19" cy="6.5" r="2"/><circle cx="19" cy="17.5" r="2"/><path d="M7 7.5l10 9M7 16.5l10-9"/>'),
  reorder: TI('<path d="M10.5 6h10.5M10.5 12h10.5M10.5 18h10.5"/><path d="M5 3.5v17M2.5 6L5 3.5 7.5 6M2.5 18L5 20.5 7.5 18"/>'),
  categorize: TI('<rect x="2.5" y="3.5" width="8" height="17" rx="2"/><rect x="13.5" y="3.5" width="8" height="17" rx="2"/><path d="M5 8h3M5 11.5h3M16 8h3"/>'),
  poll: TI('<path d="M5.5 20v-7M10.5 20V5M15.5 20v-9M20.5 20V9M2.5 20.5h20"/>'),
  open: TI('<path d="M4 4.5h16v11H10l-5 4.5v-4.5H4z"/><path d="M8 9h8M8 12h5"/>')
};
Object.keys(TYPE_ICONS).forEach((k) => { if (TYPES[k]) TYPES[k].icon = TYPE_ICONS[k]; });

export function newQuestion(type, id) {
  const t = TYPES[type];
  return Object.assign({ id, type, text: '', image: '', time: 30, double: false, explain: '' }, t.blank());
}
export function isScored(q) { return !!(TYPES[q.type] && TYPES[q.type].scored); }
export function grade(q, a) {
  const t = TYPES[q.type];
  if (!t || !t.scored) return null;
  const f = t.check(q, a);
  return Math.max(0, Math.min(1, Number(f) || 0));
}
export function validateQuestion(q) {
  const t = TYPES[q.type];
  const errs = [];
  if (!clean(q.text) && !q.image && !['dropdown', 'drag', 'label'].includes(q.type)) errs.push(__('γράψε την ερώτηση'));
  return errs.concat(t ? t.validate(q) : [__('άγνωστο είδος ερώτησης')]);
}
export function tidyQuestion(q) {
  const t = TYPES[q.type];
  if (t && t.tidy) t.tidy(q);
  q.text = clean(q.text);
  q.explain = clean(q.explain);
  if (q.category !== undefined) { q.category = clean(q.category).slice(0, 40); if (!q.category) delete q.category; }
  return q;
}
