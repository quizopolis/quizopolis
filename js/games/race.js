/* Αγώνας δρόμου και κολύμβησης: η κούρσα τρέχει συνέχεια· οι σωστές απαντήσεις δίνουν φόρα, τα λάθη κουράζουν.
   Αντίπαλοι: οι συμμαθητές που έτρεξαν πριν (ξαναπαίζεται η διαδρομή τους) και δρομείς του υπολογιστή. */
import { esc, num, shuffle } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { DB } from '../store.js';
import { simRecord, simCounts, rnd, clamp } from './kit.js';
import { __, LANG, ordinal } from '../i18n.js';

export const D = 100;        // μέτρα
const V0 = 0.85;             // βασική ταχύτητα (μ./δευτ.)
const BOOST = 1.7;           // επιπλέον ταχύτητα με σωστή απάντηση
const BOOST_T = 5;           // για πόσα δευτερόλεπτα
const TIRED = 0.45;          // πολλαπλασιαστής ταχύτητας με λάθος
const TIRED_T = 4;
const DT = 0.5;              // δείγματα διαδρομής ανά μισό δευτερόλεπτο
const BOTS = { race: [__('Αστραπή'), __('Βέλος'), __('Κεραυνός'), __('Άνεμος')], swim: [__('Δελφίνι'), __('Κύμα'), __('Γλάρος'), __('Χελιδονόψαρο')] };

export function runner() { return { x: 0, t: 0, boost: 0, boostF: 1, tired: 0, done: null, track: [0], next: DT }; }
export function speed(r) { let v = V0; if (r.boost > 0) v += BOOST * r.boostF; if (r.tired > 0) v *= TIRED; return v; }
export function step(r, dt) {
  if (r.done !== null) return;
  r.x = Math.min(D, r.x + speed(r) * dt);
  r.t += dt;
  r.boost -= dt;
  r.tired -= dt;
  while (r.t >= r.next) { r.track.push(Math.round(r.x * 10) / 10); r.next += DT; }
  if (r.x >= D) { r.done = Math.round(r.t * 10) / 10; r.track.push(D); }
}
export function answer(r, f) {
  if (f > 0) { r.boost = BOOST_T; r.boostF = f; r.tired = 0; } else { r.tired = TIRED_T; r.boost = 0; }
}
export const raceScore = (t) => Math.max(500, Math.round(6000 - 30 * t));
const fmtT = (t) => `${LANG === 'en' ? t.toFixed(1) : t.toFixed(1).replace('.', ',')}″`;
const ghostAt = (g, t) => {
  const i = t / DT;
  const a = g.track[Math.floor(i)];
  if (a === undefined) return D;
  const b = g.track[Math.floor(i) + 1];
  return b === undefined ? a : a + (b - a) * (i - Math.floor(i));
};
// δρομέας του υπολογιστή: απαντά κάθε λίγο με κάποια επιτυχία
function cpu(skill) { const r = runner(); r.skill = skill; r.nextAns = rnd(4, 9); return r; }
function stepCpu(r, dt) {
  if (r.done !== null) return;
  r.nextAns -= dt;
  if (r.nextAns <= 0) { answer(r, Math.random() < r.skill ? 1 : 0); r.nextAns = rnd(6, 12); }
  step(r, dt);
}

export function start(kit) {
  const swim = kit.mode === 'swim';
  const me = runner();
  let lanes = [];
  const main = kit.shell(`rc-${swim ? 'swim' : 'run'}`);
  main.innerHTML = `<div class="rc"><div class="rc-track" aria-label="${__('Η κούρσα')}"><div class="rc-marks" aria-hidden="true"><span style="left:25%">${__('25 μ.')}</span><span style="left:50%">${__('50 μ.')}</span><span style="left:75%">${__('75 μ.')}</span></div><div class="rc-lanes"></div><div class="rc-finish" aria-hidden="true"></div></div>
    <div class="rc-info"><span class="rc-dist" data-dist>${__('0 μ.')}</span><span class="rc-time" data-time>${fmtT(0)}</span><span class="rc-state" data-state>${__('Ετοιμάσου…')}</span></div>
    <div class="rc-q"></div></div>`;
  const lanesEl = main.querySelector('.rc-lanes');
  const qBox = main.querySelector('.rc-q');
  const distEl = main.querySelector('[data-dist]');
  const timeEl = main.querySelector('[data-time]');
  const stateEl = main.querySelector('[data-state]');
  const av = swim ? '🏊' : '🏃';
  let finished = false, t = 0, racing = false;

  function setupLanes(ghosts) {
    const g = shuffle(ghosts).slice(0, 3).map((p) => ({ kind: 'ghost', name: p.name, track: p.race.track, time: p.race.time }));
    const bots = BOTS[swim ? 'swim' : 'race'];
    const cpus = Array.from({ length: Math.max(1, 4 - g.length - 1) }, (_, i) => Object.assign(cpu(rnd(0.5, 0.8)), { kind: 'cpu', name: bots[i] }));
    lanes = shuffle([{ kind: 'me', name: kit.P.name, r: me }, ...g, ...cpus.map((r) => ({ kind: 'cpu', name: r.name, r }))]);
    lanesEl.innerHTML = lanes.map((l, i) => `<div class="rc-lane ${l.kind === 'me' ? 'is-me' : ''}" data-lane="${i}"><span class="rc-name" title="${esc(l.name)}">${esc(l.name)}${l.kind === 'cpu' ? (' <small>' + __('υπολ.') + '</small>') : ''}</span><span class="rc-run"><span class="rc-av" aria-hidden="true">${av}</span></span></div>`).join('');
    lanes.forEach((l, i) => { l.el = lanesEl.querySelector(`[data-lane="${i}"] .rc-av`); });
  }
  function draw() {
    lanes.forEach((l) => {
      const x = l.kind === 'ghost' ? ghostAt(l, t) : l.r.x;
      l.x = x;
      l.el.style.left = `${(x / D) * 100}%`;
      l.el.classList.toggle('is-moving', racing && x < D);
    });
    distEl.textContent = `${Math.floor(me.x)} ${__('μ.')}`;
    timeEl.textContent = fmtT(me.done !== null ? me.done : t);
    const pos = 1 + lanes.filter((l) => l.kind !== 'me' && l.x > me.x).length;
    kit.setStatus(__('{0} θέση', ordinal(pos)));
  }
  function placeAtFinish() {
    // χρόνοι όλων: φαντάσματα από τη διαδρομή τους, υπολογιστής με γρήγορη προσομοίωση μέχρι τον τερματισμό
    const times = lanes.map((l) => {
      if (l.kind === 'me') return me.done;
      if (l.kind === 'ghost') return l.time;
      const r = l.r;
      let guard = 0;
      while (r.done === null && guard++ < 20000) stepCpu(r, 0.1);
      return r.done;
    });
    return 1 + times.filter((x, i) => lanes[i].kind !== 'me' && x < me.done).length;
  }
  async function questions() {
    while (!finished && !kit.stopped) {
      const q = kit.next();
      const res = await kit.ask(qBox, q, {
        cls: 'gq-race', feedback: false, explain: false,
        onAnswer(r) {
          if (finished) return;
          answer(me, r.f || 0);
          if (r.f > 0) { kit.sfx.ok(); stateEl.textContent = swim ? __('Φόρα! Κολύμπα γρήγορα!') : __('Φόρα! Τρέξε!'); stateEl.className = 'rc-state is-ok'; }
          else { kit.sfx.bad(); stateEl.textContent = swim ? __('Κατάπιες νερό… κουράστηκες') : __('Σκόνταψες… κουράστηκες'); stateEl.className = 'rc-state is-bad'; }
        }
      });
      if (kit.stopped) return;
      kit.record(q, res.a, res.f, res.t, 0);
      if (finished) return;
      if (res.f !== 1) {
        const c = document.createElement('p');
        c.className = 'gq-c rc-correct';
        c.innerHTML = `${__('Σωστό:')} <b>${esc(TYPES[q.type].correct(q))}</b>`;
        qBox.querySelector('.gq').appendChild(c);
      }
      await new Promise((r) => kit.after(res.f === 1 ? 450 : 1300, r));
    }
  }
  function finish() {
    finished = true;
    racing = false;
    const place = placeAtFinish();
    const score = raceScore(me.done) + (place === 1 ? 500 : place === 2 ? 300 : place === 3 ? 100 : 0);
    qBox.innerHTML = `<div class="rc-done"><p class="rc-done-t">${place === 1 ? ('🏆 ' + __('1η θέση!')) : __('Τερμάτισες στην {0} θέση', ordinal(place))}</p><p>${__('Χρόνος:')} <b>${fmtT(me.done)}</b></p></div>`;
    kit.sfx.cheer();
    kit.finish({
      score, win: place === 1,
      title: place === 1 ? __('Νίκη! 1η θέση σε {0}', fmtT(me.done)) : __('{0} θέση σε {1}', ordinal(place), fmtT(me.done)),
      detail: `${kit.play.correct} ${__('σωστές σε {0} ερωτήσεις στα {1} μέτρα.', kit.play.asked, D)}`,
      short: fmtT(me.done), extra: { race: { time: me.done, track: me.track } }, delay: 2200
    });
  }

  (async () => {
    let ghosts = [];
    try { ghosts = (await DB.listPlayers(kit.sid)).filter((p) => p.uid !== kit.uid && p.race && Array.isArray(p.race.track) && p.race.track.length > 4); } catch (e) { /* χωρίς φαντάσματα */ }
    if (kit.stopped) return;
    setupLanes(ghosts);
    draw();
    qBox.innerHTML = `<div class="rc-ready"><p>${swim ? __('Στα βατήρια') : __('Στη γραμμή εκκίνησης')}: ${lanes.length} ${swim ? __('κολυμβητές') : __('δρομείς')}.${ghosts.length ? (' ' + __('Μαζί σου τρέχουν και συμμαθητές σου που έπαιξαν πριν.')) : ''}</p>
      <p>${__('Η κούρσα δεν σταματά: όσο πιο γρήγορα απαντάς σωστά, τόσο πιο γρήγορα {0}.', swim ? __('κολυμπάς') : __('τρέχεις'))}</p><button class="btn btn-sun btn-lg" type="button" data-go>${__('Ξεκίνα')}</button></div>`;
    await new Promise((r) => qBox.querySelector('[data-go]').addEventListener('click', r, { once: true }));
    await kit.countdown(main.querySelector('.rc-track'));
    if (kit.stopped) return;
    racing = true;
    stateEl.textContent = swim ? __('Κολύμπα!') : __('Τρέξε!');
    kit.loop((dt) => {
      t += dt;
      if (me.done === null) step(me, dt);
      lanes.forEach((l) => { if (l.kind === 'cpu') stepCpu(l.r, dt); });
      draw();
      if (me.done !== null && !finished) { finish(); return false; }
      return true;
    });
    questions();
  })();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  const r = runner();
  let i = 0, nextAns = rnd(4, 8);
  const order = shuffle(qs);
  while (r.done === null && r.t < 400) {
    nextAns -= 0.1;
    if (nextAns <= 0) {
      const q = order[i++ % order.length];
      const res = simRecord(answers, q, skill);
      answer(r, res.f || 0);
      nextAns = rnd(4, 10) * (1.4 - skill * 0.6);
    }
    step(r, 0.1);
  }
  const score = raceScore(r.done);
  return Object.assign({ answers, score, race: { time: r.done, track: r.track }, result: { title: `${__('Τερμάτισε σε')} ${fmtT(r.done)}`, short: fmtT(r.done), score } }, simCounts(answers));
}
export { clamp, num };
