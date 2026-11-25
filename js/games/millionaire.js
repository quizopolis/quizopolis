/* Εκατομμυριούχος: σκάλα ποσών, σταθμοί ασφαλείας, τρεις βοήθειες, κλείδωμα απάντησης. */
import { esc, num, shuffle } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { DB } from '../store.js';
import { simRecord, simCounts, rnd } from './kit.js';
import { __ } from '../i18n.js';

const FULL = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
export const ladder = (n) => FULL.slice(15 - Math.max(1, Math.min(15, n)));
export function havens(n) {
  if (n >= 15) return [4, 9];
  if (n >= 6) return [Math.floor(n / 3) - 1, Math.floor((2 * n) / 3) - 1];
  if (n >= 3) return [Math.floor(n / 2) - 1];
  return [];
}
export const euro = (n) => __('{0} €', num(n));
const secured = (level, L, H) => { const h = H.filter((i) => i < level).pop(); return h === undefined ? 0 : L[h]; };

/* Πώς δείχνει μια απάντηση η οθόνη: γράμματα ανάλογα με τη σειρά των κουμπιών. */
function optionLabels(box, q) {
  return Array.from(box.querySelectorAll('.opt')).map((b) => ({
    k: b.dataset.k,
    label: q.type === 'tf' ? (b.dataset.k === '1' ? __('Σωστό') : __('Λάθος')) : (b.querySelector('.opt-l') || {}).textContent || '',
    text: (b.querySelector('.opt-t') || {}).textContent || ''
  }));
}
const isRight = (q, k) => (q.type === 'tf' ? (k === '1') === !!q.correct : q.type === 'multi' ? (q.correct || []).includes(Number(k)) : Number(k) === q.correct);

export function hintFor(q, box) {
  const t = TYPES[q.type];
  if (q.type === 'mcq' || q.type === 'tf' || q.type === 'multi') {
    const opts = optionLabels(box, q).filter((o) => !box.querySelector(`.opt[data-k="${o.k}"].is-gone`));
    const sure = Math.random() < 0.78;
    let pick;
    if (q.type === 'multi') {
      const right = opts.filter((o) => isRight(q, o.k));
      pick = sure ? right : right.slice(0, Math.max(1, right.length - 1));
      return `${__('«Νομίζω πως είναι {0}. {1}»', pick.map((o) => __('το {0}', o.label)).join((' ' + __('και') + ' ')), sure ? __('Είμαι αρκετά σίγουρος.') : __('Ίσως είναι κι άλλο, δεν θυμάμαι.'))}`;
    }
    const right = opts.find((o) => isRight(q, o.k));
    const wrong = opts.filter((o) => !isRight(q, o.k));
    pick = sure || !wrong.length ? right : wrong[Math.floor(Math.random() * wrong.length)];
    return `${__('«{0} ότι είναι {1}.»', sure ? __('Είμαι σχεδόν σίγουρος') : __('Δεν είμαι σίγουρος, αλλά νομίζω'), q.type === 'tf' ? `«${pick.label}»` : `${__('το {0}:', pick.label)} ${pick.text}`)}`;
  }
  if (q.type === 'fill') {
    const a = String((q.answers || [])[0] || '');
    return `${__('«Η απάντηση αρχίζει από «{0}» και έχει {1} γράμματα.»', a.charAt(0), a.replace(/\s/g, '').length)}`;
  }
  const parts = String(t.correct(q)).split(/\s*[;,·]\s*/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? `${__('«Δεν ξέρω όλη την απάντηση, αλλά είμαι σίγουρος για αυτό: {0}.»', parts[0])}` : __('«Δυστυχώς δεν ξέρω.»');
}

export function audienceFor(q, box, classAnswers) {
  const opts = optionLabels(box, q).filter((o) => !box.querySelector(`.opt[data-k="${o.k}"].is-gone`));
  const counts = {};
  opts.forEach((o) => { counts[o.k] = 0; });
  let real = false;
  if (Array.isArray(classAnswers)) {
    const ans = classAnswers.map((p) => p.answers && p.answers[q.id]).filter((a) => a && a.v !== null && a.v !== undefined);
    if (ans.length >= 3) {
      real = true;
      ans.forEach((a) => {
        const vs = q.type === 'multi' ? (Array.isArray(a.v) ? a.v : []) : [a.v];
        vs.forEach((v) => { const k = q.type === 'tf' ? (v ? '1' : '0') : String(v); if (counts[k] !== undefined) counts[k]++; });
      });
    }
  }
  if (!real) {
    // «κοινό»: η σωστή συνήθως παίρνει τα περισσότερα
    const right = opts.filter((o) => isRight(q, o.k));
    let left = 100;
    right.forEach((o) => { const v = Math.round((opts.length <= 2 ? rnd(55, 85) : rnd(38, 72)) / right.length); counts[o.k] = v; left -= v; });
    const wrong = shuffle(opts.filter((o) => !isRight(q, o.k)));
    wrong.forEach((o, i) => { const v = i === wrong.length - 1 ? left : Math.round(left * rnd(0.2, 0.6)); counts[o.k] = Math.max(0, v); left -= counts[o.k]; });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return { real, rows: opts.map((o) => ({ label: o.label, p: Math.round((counts[o.k] / total) * 100) })) };
}

export function start(kit) {
  const qs = kit.ordered().slice(0, 15);
  const N = qs.length;
  const L = ladder(N);
  const H = havens(N);
  const used = { fifty: false, audience: false, hint: false };
  let level = 0, classAnswers = null, ctl = null, box = null, cur = null, answering = false;
  DB.listPlayers(kit.sid).then((ps) => { classAnswers = ps.filter((p) => p.uid !== kit.uid); }).catch(() => { classAnswers = []; });
  const main = kit.shell('gm-dark');
  main.innerHTML = `<div class="mil">
    <div class="mil-stage">
      <div class="mil-top"><div class="mil-life" role="group" aria-label="${__('Βοήθειες')}">
        <button type="button" class="mil-lb" data-life="fifty" title="${__('Κρύβει δύο λάθος απαντήσεις')}"><b>50:50</b></button>
        <button type="button" class="mil-lb" data-life="audience" title="${__('Τι απάντησαν οι συμμαθητές σου')}"><b>${__('Ρώτα')}</b> ${__('την τάξη')}</button>
        <button type="button" class="mil-lb" data-life="hint" title="${__('Μια συμβουλή από φίλο')}"><b>${__('Συμβουλή')}</b></button></div>
        <button type="button" class="btn btn-ghost-light btn-sm mil-walk" data-walk></button></div>
      <p class="mil-now" aria-live="polite"></p>
      <div class="mil-help" aria-live="polite"></div>
      <div class="mil-q"></div>
    </div>
    <ol class="mil-ladder" aria-label="${__('Η σκάλα των ποσών')}">${L.map((v, i) => `<li data-i="${i}" class="${H.includes(i) ? 'is-haven' : ''}"><span class="ml-n">${i + 1}</span><span class="ml-v">${euro(v)}</span></li>`).reverse().join('')}</ol>
  </div>`;
  const help = main.querySelector('.mil-help');
  const now = main.querySelector('.mil-now');
  const walk = main.querySelector('[data-walk]');
  const won = () => (level > 0 ? L[level - 1] : 0);

  function drawLadder() {
    main.querySelectorAll('.mil-ladder li').forEach((li) => {
      const i = Number(li.dataset.i);
      li.classList.toggle('is-done', i < level);
      li.classList.toggle('is-current', i === level);
    });
    now.innerHTML = `${__('Ερώτηση {0} από {1} για', level + 1, N)} <b>${euro(L[level])}</b>${H.includes(level) ? (' ' + __('· σταθμός ασφαλείας')) : ''}`;
    walk.textContent = `${__('Αποχωρώ με')} ${euro(won())}`;
    walk.disabled = level === 0 || answering === 'locked';
    kit.setStatus(`${level} / ${N}`);
    kit.setScore(won());
  }
  function drawLifelines() {
    const choice = cur && (cur.type === 'mcq' || cur.type === 'tf' || cur.type === 'multi');
    main.querySelectorAll('[data-life]').forEach((b) => {
      const k = b.dataset.life;
      const ok = !used[k] && cur && (k === 'fifty' ? cur.type === 'mcq' && cur.options.length >= 3 : k === 'audience' ? choice : true);
      b.disabled = !ok || answering !== true;
      b.classList.toggle('is-used', used[k]);
    });
  }
  main.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-life]');
    if (lb && !lb.disabled) {
      const k = lb.dataset.life;
      used[k] = true;
      kit.sfx.whoosh();
      if (k === 'fifty' && ctl && ctl.fifty) ctl.fifty();
      if (k === 'audience') {
        const r = audienceFor(cur, box, classAnswers);
        help.innerHTML = `<div class="mil-aud"><p class="mil-aud-h">${r.real ? __('Τι απάντησαν οι συμμαθητές σου') : __('Τι ψήφισε η τάξη')}</p><div class="mil-bars">${r.rows.map((x) => `<div class="mil-bar"><span class="mil-bar-f" style="height:${Math.max(4, x.p)}%"></span><b>${x.p}%</b><span>${esc(x.label)}</span></div>`).join('')}</div></div>`;
      }
      if (k === 'hint') help.innerHTML = `<p class="mil-hint"><span aria-hidden="true">📞</span> ${esc(hintFor(cur, box))}</p>`;
      drawLifelines();
    }
    if (e.target.closest('[data-walk]') && !walk.disabled) {
      kit.sfx.click();
      end(won(), 'walk');
    }
  });

  async function round() {
    if (kit.stopped) return;
    if (level >= N) { end(L[N - 1], 'top'); return; }
    cur = qs[level];
    help.innerHTML = '';
    answering = true;
    drawLadder();
    const q = cur;
    const res = await kit.ask(main.querySelector('.mil-q'), q, {
      cls: 'gq-mil', confirm: true, suspense: 1500, explain: true,
      onReady(c, b) { ctl = c; box = b; drawLifelines(); b.addEventListener('click', (e) => { if (e.target.closest('[data-final]')) { answering = 'locked'; drawLadder(); drawLifelines(); } }); },
      onAnswer(r) { answering = false; drawLifelines(); if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); },
      continue: (r) => (r.f === 1 ? (level + 1 >= N ? __('Δες το έπαθλο!') : `${__('Επόμενη ερώτηση για')} ${euro(L[level + 1])}`) : __('Δες τι κέρδισες'))
    });
    kit.record(q, res.a, res.f, res.t, 0);
    if (res.f === 1) { level++; round(); } else end(secured(level, L, H), 'wrong');
  }
  function end(amount, how) {
    const top = how === 'top';
    kit.finish({
      score: amount, win: top || amount >= L[Math.max(0, Math.floor(N / 2))],
      title: top ? __('Κέρδισες το 1.000.000 €!') : amount ? `${__('Κέρδισες {0}!', euro(amount))}` : __('Αυτή τη φορά δεν κέρδισες χρήματα'),
      detail: top ? `${__('Απάντησες σωστά και τις {0} ερωτήσεις.', N)}` : how === 'walk' ? `${__('Αποχώρησες μετά από {0} σωστές απαντήσεις.', level)}` : `${__('Έφτασες στην ερώτηση {0} από {1}.', level + 1, N)}${amount ? (' ' + __('Κράτησες το ποσό του τελευταίου σταθμού ασφαλείας.')) : ''}`,
      short: `${__('ερώτηση {0}/', Math.min(level + (how === 'wrong' ? 1 : 0), N))}${N}`, delay: 1200
    });
  }
  round();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = shuffle((S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored)).slice(0, 15);
  const N = qs.length, L = ladder(N), H = havens(N);
  const answers = {};
  let level = 0, amount = 0;
  for (const q of qs) {
    const r = simRecord(answers, q, Math.min(0.95, skill + 0.08));
    if (r.f === 1) level++;
    else { amount = secured(level, L, H); break; }
  }
  if (level >= N) amount = L[N - 1];
  else if (level > 0 && !amount && Math.random() < 0.3) amount = L[level - 1];
  return Object.assign({ answers, score: amount, result: { title: amount ? `${__('Κέρδισε')} ${euro(amount)}` : __('Δεν κέρδισε'), short: `${__('ερώτηση {0}/', Math.min(level + 1, N))}${N}`, score: amount } }, simCounts(answers));
}
