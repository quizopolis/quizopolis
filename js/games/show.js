/* Τηλεπαιχνίδι: γρήγορος γύρος 60″, ποντάρισμα, μεγάλος τελικός «διπλάσιο ή μισό». */
import { esc, num } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts } from './kit.js';
import { __ } from '../i18n.js';

export const QUICK_SECONDS = 60;
export const BETS = 3;
const HOST = {
  hello: [__('Καλησπέρα και καλώς ήρθες στο πιο γρήγορο τηλεπαιχνίδι της τάξης!'), __('Φώτα, κάμερα… πάμε! Καλώς ήρθες στο στούντιο!')],
  good: [__('Εξαιρετικά!'), __('Τι λες τώρα! Σωστό!'), __('Το κοινό χειροκροτεί!'), __('Πολύ δυνατά!')],
  bad: [__('Αχ, τόσο κοντά!'), __('Δεν πειράζει, συνεχίζουμε!'), __('Το κοινό σε στηρίζει!')]
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function start(kit) {
  let score = 0;
  const main = kit.shell('gm-dark');
  main.innerHTML = `<div class="sh"><div class="sh-lights" aria-hidden="true"></div>
    <div class="sh-host"><span class="sh-av" aria-hidden="true">🎤</span><p class="sh-say" aria-live="polite"></p></div>
    <p class="sh-round"></p><div class="sh-area"></div></div>`;
  const sayEl = main.querySelector('.sh-say');
  const roundEl = main.querySelector('.sh-round');
  const area = main.querySelector('.sh-area');
  const say = (t) => { sayEl.textContent = t; };
  const add = (n) => { score = Math.max(0, Math.round(score + n)); kit.setScore(score); };

  function intro(title, text, btn = __('Πάμε!')) {
    return new Promise((resolve) => {
      area.innerHTML = `<div class="sh-card"><h2 class="sh-t">${esc(title)}</h2><p class="sh-p">${esc(text)}</p><button class="btn btn-sun btn-lg" type="button" data-go>${esc(btn)}</button></div>`;
      const b = area.querySelector('[data-go]');
      b.addEventListener('click', () => { kit.sfx.click(); resolve(); }, { once: true });
      setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
    });
  }
  async function quickRound() {
    roundEl.textContent = __('Γύρος 1 από 3 · Γρήγορες ερωτήσεις');
    say(pick(HOST.hello));
    await intro(__('Γύρος 1: Γρήγορες ερωτήσεις'), `${__('Έχεις {0} δευτερόλεπτα. Απάντησε σε όσες περισσότερες μπορείς: κάθε σωστή δίνει 100 πόντους.', QUICK_SECONDS)}`);
    const t0 = Date.now();
    let up = false, resolveUp;
    const timeUp = new Promise((r) => { resolveUp = r; });
    kit.after(QUICK_SECONDS * 1000, () => { up = true; resolveUp(null); });
    const clockIv = setInterval(() => {
      if (kit.stopped) { clearInterval(clockIv); return; }
      const left = Math.max(0, Math.ceil(QUICK_SECONDS - (Date.now() - t0) / 1000));
      kit.setStatus(`<span class="sh-clock ${left <= 10 ? 'is-hurry' : ''}">${left}″</span>`);
      if (left <= 5 && left > 0) kit.sfx.tick();
      if (left <= 0) clearInterval(clockIv);
    }, 1000);
    say(__('Το ρολόι τρέχει!'));
    let n = 0;
    while (!up && !kit.stopped) {
      const q = kit.next();
      const res = await Promise.race([kit.ask(area, q, { cls: 'gq-show', explain: false, autoNext: 0, feedback: false, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } }), timeUp]);
      if (!res) break;
      const gain = Math.round(100 * (res.f || 0));
      add(gain);
      kit.record(q, res.a, res.f, res.t, gain);
      n++;
      say(res.f === 1 ? pick(HOST.good) : `${__('Όχι! Σωστό ήταν:')} ${TYPES[q.type].correct(q)}`);
      await new Promise((r) => kit.after(res.f === 1 ? 350 : 1100, r));
    }
    clearInterval(clockIv);
    kit.setStatus('');
    kit.sfx.whistle();
    say(`${__('Τέλος χρόνου! Απάντησες σε {0} ερωτήσεις και έχεις {1} πόντους.', n, num(score))}`);
  }
  function chooseBet(max) {
    return new Promise((resolve) => {
      const opts = Array.from(new Set([50, 100, 200, max].filter((v) => v > 0 && v <= max))).sort((a, b) => a - b);
      area.innerHTML = `<div class="sh-card"><h2 class="sh-t">${__('Πόσο ποντάρεις;')}</h2><p class="sh-p">${__('Αν απαντήσεις σωστά κερδίζεις το ποντάρισμα, αν όχι το χάνεις.')}</p>
        <div class="jp-wager-b" role="group" aria-label="${__('Ποντάρισμα')}">${opts.map((v) => `<button type="button" class="btn btn-sun btn-lg" data-bet="${v}">${v === max && v > 200 ? `${__('Όλα ({0})', num(v))}` : num(v)}</button>`).join('')}</div></div>`;
      area.addEventListener('click', function on(e) {
        const b = e.target.closest('[data-bet]');
        if (!b) return;
        area.removeEventListener('click', on);
        kit.sfx.click();
        resolve(Number(b.dataset.bet));
      });
    });
  }
  async function betRound() {
    roundEl.textContent = __('Γύρος 2 από 3 · Ποντάρισμα');
    await intro(__('Γύρος 2: Ποντάρισμα'), `${BETS} ${__('ερωτήσεις. Πριν από κάθε μία διαλέγεις πόσους πόντους ποντάρεις.')}`);
    for (let i = 0; i < BETS && !kit.stopped; i++) {
      say(i === 0 ? __('Ας δούμε πόσο τολμηρός είσαι!') : pick([__('Συνεχίζουμε!'), __('Επόμενη ερώτηση!'), __('Τι λες, ρισκάρεις;')]));
      const bet = await chooseBet(Math.max(score, 200));
      const q = kit.next();
      const res = await kit.ask(area, q, { cls: 'gq-show', continue: i < BETS - 1 ? __('Επόμενη ερώτηση') : __('Στον τελικό!'), onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
      const delta = res.f === 1 ? bet : -bet;
      add(delta);
      kit.record(q, res.a, res.f, res.t, Math.max(0, delta));
      say(res.f === 1 ? `${pick(HOST.good)} ${__('+{0} πόντοι!', num(bet))}` : `${pick(HOST.bad)} −${num(bet)} ${__('πόντοι.')}`);
    }
  }
  async function finalRound() {
    roundEl.textContent = __('Γύρος 3 από 3 · Μεγάλος τελικός');
    say(__('Και τώρα… ο μεγάλος τελικός!'));
    kit.sfx.drum();
    await intro(__('Ο μεγάλος τελικός'), `${__('Μία ερώτηση: αν απαντήσεις σωστά διπλασιάζεις τους πόντους σου ({0} → {1}). Αν όχι, χάνεις τους μισούς.', num(score), num(score * 2))}`, __('Πάμε στον τελικό!'));
    const q = kit.next();
    const res = await kit.ask(area, q, { cls: 'gq-show', continue: __('Δες το αποτέλεσμα'), suspense: 900, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
    const before = score;
    if (res.f === 1) add(score); else add(-Math.round(score / 2));
    kit.record(q, res.a, res.f, res.t, Math.max(0, score - before));
    say(res.f === 1 ? __('Διπλασίασες τους πόντους σου! Τι παιχνίδι!') : __('Κρίμα! Κρατάς όμως τους μισούς πόντους.'));
    kit.finish({ score, win: res.f === 1, title: res.f === 1 ? `${__('Τελικό σκορ: {0} πόντοι!', num(score))}` : `${__('Τελικό σκορ: {0} πόντοι', num(score))}`, detail: `${kit.play.correct} ${__('σωστές σε {0} ερωτήσεις.', kit.play.asked)} ${res.f === 1 ? __('Διπλασίασες τους πόντους στον τελικό.') : __('Στον τελικό έχασες τους μισούς πόντους.')}`, short: `${kit.play.correct}${__('/{0} σωστές', kit.play.asked)}`, delay: 1800 });
  }
  (async () => { await quickRound(); if (!kit.stopped) await betRound(); if (!kit.stopped) await finalRound(); })();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  let score = 0, i = 0;
  const next = () => qs[i++ % qs.length];
  const quick = Math.round(QUICK_SECONDS / (5 + (1 - skill) * 8));
  for (let k = 0; k < quick; k++) { const r = simRecord(answers, next(), skill); score += Math.round(100 * (r.f || 0)); }
  for (let k = 0; k < BETS; k++) { const bet = Math.min(Math.max(score, 200), [100, 200, score][k % 3] || 100); const r = simRecord(answers, next(), skill); score = Math.max(0, score + (r.f === 1 ? bet : -bet)); }
  const r = simRecord(answers, next(), skill);
  score = r.f === 1 ? score * 2 : Math.round(score / 2);
  const c = simCounts(answers);
  return Object.assign({ answers, score, result: { title: `${__('Σκορ')} ${num(score)}`, short: `${c.correct}${__('/{0} σωστές', c.answered)}`, score } }, c);
}
