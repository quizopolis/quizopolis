/* Κρυμμένη εικόνα: κάθε σωστή απάντηση ανοίγει ένα κομμάτι. Όσο λιγότερα κομμάτια χρειαστείς για να μαντέψεις, τόσο περισσότεροι πόντοι. */
import { esc, num, norm, shuffle } from '../ui.js';
import { TYPES, normAnswer } from '../qtypes.js';
import { simRecord, simCounts } from './kit.js';
import { PICTURES } from './pictures.js';
import { __ } from '../i18n.js';

const GRIDS = { 6: [3, 2], 8: [4, 2], 9: [3, 3], 12: [4, 3], 16: [4, 4] };
export const tilesFor = (n) => [16, 12, 9, 8, 6].find((t) => t <= Math.max(6, n));
const BONUS = 1000, PER_HIDDEN = 300, WRONG = 200;
const TILE_COLORS = ['#0B7A5C', '#06513D', '#0E8C6B', '#0A6A50'];

const ARTICLE = /^(ο|η|το|οι|τα|ενασ|ενα|μια|the|a|an)\s+/;
const key = (s) => normAnswer(norm(s).replace(ARTICLE, ''));
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/* Δεκτή απάντηση για δική μας εικόνα: χωρίς τόνους, κεφαλαία και άρθρα, με περιθώριο για ένα ορθογραφικό λάθος. */
export function guessOk(given, accepted) {
  const g = key(given);
  if (!g) return false;
  return String(accepted || '').split('|').map(key).filter(Boolean)
    .some((a) => a === g || (a.length >= 6 && lev(a, g) <= 1) || (a.length >= 11 && lev(a, g) <= 2));
}

export function start(kit) {
  const own = kit.st.picture && typeof kit.st.picture === 'object' && kit.st.picture.image ? kit.st.picture : null;
  const pic = own ? null : PICTURES[Math.floor(Math.random() * PICTURES.length)];
  const answerText = own ? (String(own.answer || '').split('|').map((s) => s.trim()).filter(Boolean)[0] || '') : pic.name;
  const choices = own ? [] : shuffle([pic.name, ...shuffle(PICTURES.filter((p) => p !== pic)).slice(0, 3).map((p) => p.name)]);
  const tiles = tilesFor(kit.questions.length);
  const [cols, rows] = GRIDS[tiles];
  const open = new Set();
  const wrongNames = new Set();
  let score = 0, over = false, rounds = 0;
  const maxRounds = tiles * 2 + 4;
  const wait = (ms) => new Promise((r) => kit.after(ms, r));

  const main = kit.shell('gm-picture');
  main.innerHTML = `<div class="hp">
    <div class="hp-frame" style="--cols:${cols};--rows:${rows}">
      <div class="hp-img">${own ? `<img src="${esc(own.image)}" alt="">` : pic.svg}</div>
      <div class="hp-tiles" role="group" aria-label="${__('Κομμάτια της εικόνας')}">${Array.from({ length: tiles }, (_, i) => `<button type="button" class="hp-t" data-t="${i}" disabled aria-label="${__('Κομμάτι')} ${i + 1}" style="--c:${TILE_COLORS[(i + Math.floor(i / cols)) % 2 ? 1 : 0]}"><span>${i + 1}</span></button>`).join('')}</div>
    </div>
    <div class="hp-side"><p class="hp-say" aria-live="polite"></p><div class="hp-q"></div></div>
  </div>`;
  const frame = main.querySelector('.hp-frame');
  const tilesEl = main.querySelector('.hp-tiles');
  const qBox = main.querySelector('.hp-q');
  const sayEl = main.querySelector('.hp-say');
  const say = (t, cls = '') => { sayEl.innerHTML = t; sayEl.className = `hp-say ${cls ? `is-${cls}` : ''}`; };
  const status = () => kit.setStatus(`${open.size}${__('/{0} κομμάτια', tiles)}`);
  status();

  function reveal(i) {
    open.add(i);
    tilesEl.querySelector(`[data-t="${i}"]`).classList.add('is-open');
    status();
  }
  function revealAll() {
    tilesEl.querySelectorAll('.hp-t:not(.is-open)').forEach((b, k) => setTimeout(() => b.classList.add('is-open'), k * 70));
  }
  function pickTile() {
    return new Promise((resolve) => {
      say(__('Σωστό! Διάλεξε ποιο κομμάτι θα ανοίξεις.'), 'ok');
      frame.classList.add('is-pick');
      const free = Array.from(tilesEl.querySelectorAll('.hp-t:not(.is-open)'));
      free.forEach((b) => { b.disabled = false; });
      try { free[0].focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      const on = (e) => {
        const b = e.target.closest('.hp-t');
        if (!b || b.disabled || b.classList.contains('is-open')) return;
        tilesEl.removeEventListener('click', on);
        frame.classList.remove('is-pick');
        tilesEl.querySelectorAll('.hp-t').forEach((x) => { x.disabled = true; });
        kit.sfx.pop();
        reveal(Number(b.dataset.t));
        resolve();
      };
      tilesEl.addEventListener('click', on);
    });
  }
  /* Επιστρέφει true (σωστή μαντεψιά), false (λάθος) ή null (θέλει άλλη ερώτηση). */
  function guessPanel(forced) {
    return new Promise((resolve) => {
      const hidden = tiles - open.size;
      const bonus = BONUS + PER_HIDDEN * hidden;
      qBox.innerHTML = `<div class="hp-guess"><p class="hp-guess-t">${__('Τι δείχνει η εικόνα;')}${hidden ? ` <span>${__('Αν το βρεις τώρα:')} <b>+${num(bonus)}</b></span>` : ''}</p>
        ${own ? `<form class="hp-type" novalidate><label class="sr" for="hp-in">${__('Τι δείχνει η εικόνα')}</label><input id="hp-in" class="input input-xl" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="${__('Γράψε τι δείχνει')}"><button class="btn btn-sun btn-lg" type="submit" disabled>${__('Μάντεψε')}</button></form>`
        : `<div class="hp-choices">${choices.map((n) => `<button type="button" class="hp-ch" data-name="${esc(n)}" ${wrongNames.has(n) ? 'disabled' : ''}>${esc(n)}</button>`).join('')}</div>`}
        ${forced ? '' : ('<p class="actions center"><button type="button" class="btn btn-ghost" data-more>' + __('Άλλη ερώτηση πρώτα') + '</button></p>')}</div>`;
      const done = (v) => { qBox.querySelectorAll('button, input').forEach((x) => { x.disabled = true; }); resolve(v); };
      if (own) {
        const inp = qBox.querySelector('#hp-in');
        const sub = qBox.querySelector('[type="submit"]');
        inp.addEventListener('input', () => { sub.disabled = !inp.value.trim(); });
        qBox.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); if (inp.value.trim()) done(guessOk(inp.value, own.answer)); });
        if (forced) try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      } else {
        qBox.querySelector('.hp-choices').addEventListener('click', (e) => {
          const b = e.target.closest('[data-name]');
          if (!b || b.disabled) return;
          const ok = b.dataset.name === pic.name;
          if (!ok) wrongNames.add(b.dataset.name);
          b.classList.add(ok ? 'is-ok' : 'is-bad');
          done(ok);
        });
      }
      const more = qBox.querySelector('[data-more]');
      if (more) more.addEventListener('click', () => done(null), { once: true });
    });
  }
  function wrongGuess() {
    kit.sfx.bad();
    score = Math.max(0, score - WRONG);
    kit.setScore(score);
    say(`${__('Όχι, δεν είναι αυτό!')} −${WRONG} ${__('πόντοι')}`, 'bad');
  }
  function win() {
    over = true;
    const hidden = tiles - open.size;
    const bonus = BONUS + PER_HIDDEN * hidden;
    score += bonus;
    kit.setScore(score);
    revealAll();
    frame.classList.add('is-won');
    say(__('Σωστά!'), 'ok');
    qBox.innerHTML = `<div class="hp-end"><p class="hp-end-t">${esc(answerText)}</p><p>${__('+{0} πόντοι', num(bonus))}${hidden ? `${__(', γιατί έμεναν κλειστά {0} κομμάτια', hidden)}` : ''}</p></div>`;
    kit.finish({
      score, win: true, title: `${__('Βρήκες την εικόνα:')} ${answerText}`,
      detail: `${__('Με {0} από τα {1} κομμάτια ανοιχτά. {2} σωστές σε {3} ερωτήσεις.', open.size, tiles, kit.play.correct, kit.play.asked)}`,
      short: `${__('με {0}/{1} κομμάτια', open.size, tiles)}`, delay: 2800
    });
  }
  function lose() {
    over = true;
    revealAll();
    kit.sfx.lose();
    say(__('Δεν πειράζει!'));
    qBox.innerHTML = `<div class="hp-end is-lose"><p>${__('Η εικόνα ήταν:')}</p><p class="hp-end-t">${esc(answerText)}</p></div>`;
    kit.finish({ score, win: false, title: __('Η εικόνα έμεινε μυστήριο'), detail: `${__('Ήταν: {0}. {1} σωστές σε {2} ερωτήσεις.', answerText, kit.play.correct, kit.play.asked)}`, short: __('δεν τη βρήκε'), delay: 3200 });
  }
  async function finalGuess() {
    say(open.size >= tiles ? __('Άνοιξαν όλα τα κομμάτια!') : __('Τελευταία ευκαιρία!'));
    for (let tries = 0; tries < 2 && !kit.stopped; tries++) {
      const r = await guessPanel(true);
      if (kit.stopped) return;
      if (r) { win(); return; }
      wrongGuess();
      await wait(1100);
    }
    if (!kit.stopped) lose();
  }
  async function play() {
    qBox.innerHTML = `<div class="hp-intro"><p>${__('Πίσω από τα {0} κομμάτια κρύβεται μια εικόνα. Κάθε σωστή απάντηση ανοίγει ένα κομμάτι. Μάντεψε τι δείχνει όσο πιο νωρίς μπορείς: κάθε κλειστό κομμάτι αξίζει', tiles)} <b>${PER_HIDDEN}</b> ${__('πόντους!')}</p>
      <button class="btn btn-sun btn-lg" type="button" data-go>${__('Ξεκίνα')}</button></div>`;
    await new Promise((r) => qBox.querySelector('[data-go]').addEventListener('click', r, { once: true }));
    while (!over && !kit.stopped) {
      if (open.size >= tiles || rounds >= maxRounds) { await finalGuess(); return; }
      rounds++;
      say(__('Απάντησε σωστά για να ανοίξεις ένα κομμάτι.'));
      const q = kit.next();
      const res = await kit.ask(qBox, q, { cls: 'gq-pc', explain: false, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
      if (kit.stopped) return;
      kit.record(q, res.a, res.f, res.t, res.f === 1 ? 100 : 0);
      if (res.f !== 1) continue;
      score += 100;
      kit.setScore(score);
      qBox.innerHTML = '';
      await pickTile();
      if (kit.stopped) return;
      if (open.size >= tiles) { await finalGuess(); return; }
      if (open.size >= 2) {
        say(__('Ξέρεις τι δείχνει;'));
        const r = await guessPanel(false);
        if (kit.stopped) return;
        if (r === true) { win(); return; }
        if (r === false) { wrongGuess(); await wait(1100); }
      }
    }
  }
  play();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  const tiles = tilesFor(qs.length);
  let open = 0, score = 0, i = 0, rounds = 0, won = false;
  while (rounds < tiles * 2 + 4 && open < tiles && !won) {
    rounds++;
    const r = simRecord(answers, qs[i++ % qs.length], skill);
    if (r.f !== 1) continue;
    open++;
    score += 100;
    if (open >= 2 && Math.random() < (open / tiles) * (0.5 + skill * 0.5)) {
      if (Math.random() < 0.3 + 0.7 * (open / tiles)) won = true; else score = Math.max(0, score - WRONG);
    }
  }
  if (!won && Math.random() < 0.85) won = true;
  if (won) score += BONUS + PER_HIDDEN * (tiles - open);
  return Object.assign({ answers, score, result: { title: won ? __('Βρήκε την εικόνα') : __('Δεν βρήκε την εικόνα'), short: won ? `${__('με {0}/{1} κομμάτια', open, tiles)}` : __('δεν τη βρήκε'), score, win: won } }, simCounts(answers));
}
