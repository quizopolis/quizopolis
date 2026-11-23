/* Jeopardy: πίνακας με θεματικές και αξίες, μια κρυφή «διπλή» ερώτηση με ποντάρισμα και τελικός γύρος. */
import { esc, num, shuffle } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts, clamp } from './kit.js';
import { __ } from '../i18n.js';

export const VALUES = [100, 200, 300, 400, 500];

/* Θεματικές από το πεδίο «Θεματική» των ερωτήσεων· αλλιώς «Ενότητα 1, 2…» με τη σειρά των ερωτήσεων. */
export function buildBoard(questions) {
  const all = questions.slice();
  let final = null;
  if (all.length >= 6) final = all.pop();
  const named = all.filter((q) => String(q.category || '').trim());
  let cats;
  if (named.length >= Math.ceil(all.length / 2)) {
    const map = new Map();
    all.forEach((q) => { const c = String(q.category || '').trim() || __('Διάφορα'); if (!map.has(c)) map.set(c, []); map.get(c).push(q); });
    cats = Array.from(map, ([name, qs]) => ({ name, qs }));
  } else {
    const k = clamp(Math.ceil(all.length / 4), 2, 5);
    cats = Array.from({ length: k }, (_, i) => ({ name: `${__('Ενότητα')} ${i + 1}`, qs: [] }));
    all.forEach((q, i) => cats[i % k].qs.push(q));
  }
  cats = cats.slice(0, 6).map((c) => ({ name: c.name, qs: c.qs.slice(0, 5) }));
  const rows = Math.max(1, ...cats.map((c) => c.qs.length));
  const cells = [];
  cats.forEach((c, ci) => c.qs.forEach((q, ri) => cells.push({ ci, ri, q, value: VALUES[ri] })));
  const pool = cells.filter((x) => x.ri > 0);
  const dd = (pool.length ? pool : cells)[Math.floor(Math.random() * (pool.length || cells.length))];
  return { cats, rows, cells, final, dd };
}

export function wagerForm(max, label) {
  const steps = Array.from(new Set([Math.round(max / 4 / 50) * 50, Math.round(max / 2 / 50) * 50, max].filter((v) => v > 0)));
  return `<div class="jp-wager"><p class="jp-wager-t">${label}</p><p class="jp-wager-s">${__('Μπορείς να ποντάρεις έως')} <b>${num(max)}</b> ${__('πόντους.')}</p>
    <div class="jp-wager-b" role="group" aria-label="${__('Ποντάρισμα')}">${steps.map((v) => `<button type="button" class="btn btn-sun btn-lg" data-bet="${v}">${v === max ? `${__('Όλα ({0})', num(v))}` : num(v)}</button>`).join('')}</div></div>`;
}
function askWager(container, max, label) {
  return new Promise((resolve) => {
    container.innerHTML = wagerForm(max, label);
    container.addEventListener('click', function on(e) {
      const b = e.target.closest('[data-bet]');
      if (!b) return;
      container.removeEventListener('click', on);
      resolve(Number(b.dataset.bet));
    });
  });
}

export function start(kit) {
  const B = buildBoard(kit.questions);
  let score = 0;
  const used = new Set();
  const main = kit.shell('gm-dark');
  main.innerHTML = `<div class="jp"><div class="jp-board" style="--cols:${B.cats.length}" role="grid" aria-label="${__('Πίνακας ερωτήσεων')}">
      ${B.cats.map((c) => `<div class="jp-cat" role="columnheader">${esc(c.name)}</div>`).join('')}
      ${Array.from({ length: B.rows }, (_, ri) => B.cats.map((c, ci) => {
        const has = c.qs[ri];
        return has ? `<button type="button" class="jp-cell" data-cell="${ci}:${ri}" aria-label="${esc(c.name)} ${__('για')} ${VALUES[ri]}">${VALUES[ri]}</button>` : '<span class="jp-cell is-empty"></span>';
      }).join('')).join('')}
    </div><div class="jp-panel" hidden></div></div>`;
  const board = main.querySelector('.jp-board');
  const panel = main.querySelector('.jp-panel');
  kit.setStatus(`0 / ${B.cells.length}`);

  board.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cell]');
    if (!b || b.disabled || !panel.hidden) return;
    const [ci, ri] = b.dataset.cell.split(':').map(Number);
    const cell = B.cells.find((x) => x.ci === ci && x.ri === ri);
    b.disabled = true;
    b.classList.add('is-used');
    b.textContent = '';
    used.add(cell);
    kit.sfx.click();
    panel.hidden = false;
    board.classList.add('is-dim');
    panel.innerHTML = `<p class="jp-ph">${esc(B.cats[ci].name)} · <b>${cell.value}</b></p><div class="jp-q"></div>`;
    let stake = cell.value;
    const qBox = panel.querySelector('.jp-q');
    if (cell === B.dd) {
      kit.sfx.drum();
      panel.querySelector('.jp-ph').innerHTML = `${esc(B.cats[ci].name)} · <b>${__('Διπλή ευκαιρία!')}</b>`;
      stake = await askWager(qBox, Math.max(score, 500), __('Βρήκες την κρυφή «διπλή» ερώτηση! Πόσο ποντάρεις;'));
    }
    const res = await kit.ask(qBox, cell.q, {
      cls: 'gq-jp', continue: used.size >= B.cells.length ? (B.final ? __('Στον τελικό γύρο') : __('Τέλος')) : __('Πίσω στον πίνακα'),
      onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); }
    });
    const delta = res.f === 1 ? stake : res.f > 0 ? Math.round((stake * res.f) / 10) * 10 : cell === B.dd ? -stake : -Math.round(stake / 2);
    score = Math.max(0, score + delta);
    kit.record(cell.q, res.a, res.f, res.t, Math.max(0, delta));
    kit.setScore(score);
    kit.setStatus(`${used.size} / ${B.cells.length}`);
    panel.hidden = true;
    board.classList.remove('is-dim');
    if (used.size >= B.cells.length) finalRound();
    else { const nb = board.querySelector('.jp-cell:not(:disabled):not(.is-empty)'); if (nb) nb.focus(); }
  });

  async function finalRound() {
    if (!B.final) { done(); return; }
    panel.hidden = false;
    board.classList.add('is-dim');
    kit.sfx.drum();
    panel.innerHTML = `<p class="jp-ph">${__('Τελικός γύρος')}${B.final.category ? ` · ${esc(B.final.category)}` : ''}</p><div class="jp-q"></div>`;
    const qBox = panel.querySelector('.jp-q');
    const stake = score > 0 ? await askWager(qBox, score, __('Τελικός γύρος: πόσους από τους πόντους σου ποντάρεις;')) : 0;
    const res = await kit.ask(qBox, B.final, { cls: 'gq-jp', continue: __('Δες το αποτέλεσμα'), onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
    const delta = res.f === 1 ? stake : -stake;
    score = Math.max(0, score + delta);
    kit.record(B.final, res.a, res.f, res.t, Math.max(0, delta));
    kit.setScore(score);
    done();
  }
  function done() {
    const total = B.cells.length + (B.final ? 1 : 0);
    kit.finish({ score, win: kit.play.correct >= total * 0.6, title: `${__('Μάζεψες {0} πόντους!', num(score))}`, detail: `${kit.play.correct} ${__('σωστές από {0} ερωτήσεις του πίνακα.', total)}`, short: `${kit.play.correct}${__('/{0} σωστές', total)}` });
  }
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const B = buildBoard(qs);
  const answers = {};
  let score = 0;
  shuffle(B.cells).forEach((cell) => {
    const r = simRecord(answers, cell.q, skill);
    const stake = cell === B.dd ? Math.max(score, 500) / 2 : cell.value;
    score = Math.max(0, score + (r.f === 1 ? stake : cell === B.dd ? -stake : -stake / 2));
  });
  if (B.final) {
    const r = simRecord(answers, B.final, skill);
    const stake = Math.round(score / 2);
    score = Math.max(0, score + (r.f === 1 ? stake : -stake));
  }
  score = Math.round(score / 10) * 10;
  const c = simCounts(answers);
  return Object.assign({ answers, score, result: { title: `${__('Μάζεψε {0} πόντους', num(score))}`, short: `${c.correct}${__('/{0} σωστές', c.answered)}`, score } }, c);
}
