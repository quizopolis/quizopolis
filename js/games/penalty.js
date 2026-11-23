/* Πέναλτι: διαδικασία πέναλτι με τον υπολογιστή. Με σωστή απάντηση σουτάρεις ή πέφτεις να πιάσεις τη μπάλα.
   Με κάθε λάθος ο τερματοφύλακας του αντιπάλου γίνεται πιο γρήγορος. */
import { esc } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts, clamp } from './kit.js';
import { __ } from '../i18n.js';

export const KICKS = 5;
const ZONES = [__('πάνω αριστερά'), __('πάνω στη μέση'), __('πάνω δεξιά'), __('κάτω αριστερά'), __('κάτω στη μέση'), __('κάτω δεξιά')];
const near = (a, b) => (a !== b) && ((Math.floor(a / 3) === Math.floor(b / 3) && Math.abs(a - b) === 1) || (a % 3 === b % 3));
const KEEPER = `<svg viewBox="0 0 80 100" aria-hidden="true"><circle cx="40" cy="16" r="11" fill="#F2C9A0"/><rect x="24" y="28" width="32" height="38" rx="8" fill="#FFC23C"/><rect x="26" y="64" width="11" height="28" rx="5" fill="#142033"/><rect x="43" y="64" width="11" height="28" rx="5" fill="#142033"/>
  <rect x="4" y="30" width="22" height="9" rx="4.5" fill="#FFC23C" transform="rotate(-35 15 34)"/><rect x="54" y="30" width="22" height="9" rx="4.5" fill="#FFC23C" transform="rotate(35 65 34)"/><circle cx="6" cy="22" r="7" fill="#fff"/><circle cx="74" cy="22" r="7" fill="#fff"/></svg>`;
const BALL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#142033" stroke-width="2"/><path d="M20 11l7 5-3 8h-8l-3-8z" fill="#142033"/><path d="M20 11V3M27 16l8-3M24 24l5 7M16 24l-5 7M13 16l-8-3" stroke="#142033" stroke-width="2"/></svg>';

export function start(kit) {
  let keeperSkill = 0.22;
  const me = [], cpu = [];
  let saves = 0;
  const main = kit.shell('gm-pitch');
  main.innerHTML = `<div class="pk">
    <div class="pk-score" aria-label="${__('Σκορ')}"><div class="pk-row"><span class="pk-who">${__('Εσύ')}</span><span class="pk-dots" data-me></span><b data-me-n>0</b></div>
      <div class="pk-row"><span class="pk-who">${__('Αντίπαλοι')}</span><span class="pk-dots" data-cpu></span><b data-cpu-n>0</b></div></div>
    <div class="pk-field"><div class="pk-goal"><div class="pk-net" aria-hidden="true"></div>
      <div class="pk-zones" role="group" aria-label="${__('Σημεία του τέρματος')}">${ZONES.map((z, i) => `<button type="button" class="pk-z" data-z="${i}" aria-label="${z}" disabled></button>`).join('')}</div>
      <div class="pk-keeper">${KEEPER}</div></div>
      <div class="pk-ball">${BALL}</div><p class="pk-say" aria-live="polite"></p></div>
    <div class="pk-q"></div></div>`;
  const goal = main.querySelector('.pk-goal');
  const keeper = main.querySelector('.pk-keeper');
  const ball = main.querySelector('.pk-ball');
  const say = (t, cls = '') => { const s = main.querySelector('.pk-say'); s.textContent = t; s.className = `pk-say ${cls}`; };
  const qBox = main.querySelector('.pk-q');
  const zones = main.querySelectorAll('.pk-z');
  const dots = (arr, n) => Array.from({ length: Math.max(KICKS, n) }, (_, i) => `<i class="${arr[i] === undefined ? '' : arr[i] ? 'g' : 'x'}"></i>`).join('');
  const drawScore = () => {
    const n = Math.max(me.length, cpu.length, KICKS);
    main.querySelector('[data-me]').innerHTML = dots(me, n);
    main.querySelector('[data-cpu]').innerHTML = dots(cpu, n);
    main.querySelector('[data-me-n]').textContent = me.filter(Boolean).length;
    main.querySelector('[data-cpu-n]').textContent = cpu.filter(Boolean).length;
  };
  const score = () => me.filter(Boolean).length * 1000 + saves * 700 + kit.play.correct * 100;
  drawScore();

  function zoneXY(z) {
    const gw = goal.clientWidth, gh = goal.clientHeight;
    return { x: ((z % 3) + 0.5) * (gw / 3), y: (Math.floor(z / 3) + 0.5) * (gh / 2) };
  }
  function reset() {
    keeper.style.transform = '';
    keeper.classList.remove('is-dive');
    ball.style.transform = '';
    ball.classList.remove('is-out', 'is-kick');
    goal.classList.remove('is-goal');
  }
  function pickZone(label) {
    return new Promise((resolve) => {
      say(label);
      goal.classList.add('is-pick');
      zones.forEach((b) => { b.disabled = false; });
      zones[1].focus({ preventScroll: true });
      const on = (e) => {
        const b = e.target.closest('[data-z]');
        if (!b) return;
        goal.removeEventListener('click', on);
        goal.classList.remove('is-pick');
        zones.forEach((x) => { x.disabled = true; });
        resolve(Number(b.dataset.z));
      };
      goal.addEventListener('click', on);
    });
  }
  function animate(shotZone, keeperZone, out) {
    return new Promise((resolve) => {
      const k = zoneXY(keeperZone);
      const gw = goal.clientWidth;
      const kx = k.x - gw / 2;
      const rot = keeperZone % 3 === 0 ? -70 : keeperZone % 3 === 2 ? 70 : 0;
      const ky = Math.floor(keeperZone / 3) === 0 ? -goal.clientHeight * 0.18 : goal.clientHeight * 0.05;
      kit.sfx.kick();
      ball.classList.add('is-kick');
      const s = zoneXY(shotZone);
      const gr = goal.getBoundingClientRect();
      const br = ball.getBoundingClientRect();
      const tx = gr.left + s.x - (br.left + br.width / 2);
      const ty = out ? gr.top - br.top - br.height * 1.6 : gr.top + s.y - (br.top + br.height / 2);
      requestAnimationFrame(() => {
        keeper.classList.add('is-dive');
        keeper.style.transform = `translate(${kx}px, ${ky}px) rotate(${rot}deg)`;
        ball.style.transform = `translate(${out ? tx * 1.4 : tx}px, ${ty}px) scale(${out ? 0.5 : 0.62})`;
      });
      kit.after(700, resolve);
    });
  }
  async function kick(mine, idx) {
    reset();
    say(mine ? `${__('Σουτ {0}: απάντησε σωστά για να σουτάρεις', idx + 1)}` : `${__('Σουτάρει ο αντίπαλος: απάντησε σωστά για να προλάβεις')}`);
    const q = kit.next();
    const res = await kit.ask(qBox, q, { cls: 'gq-pk', explain: false, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
    if (kit.stopped) return;
    kit.record(q, res.a, res.f, res.t, res.f === 1 ? 100 : 0);
    qBox.innerHTML = '';
    if (res.f === 1) keeperSkill = Math.max(0.15, keeperSkill - 0.02); else keeperSkill = Math.min(0.55, keeperSkill + 0.08);
    let goalIn;
    if (mine) {
      if (res.f === 1) {
        const z = await pickZone(__('Διάλεξε πού θα σουτάρεις'));
        const kz = Math.random() < keeperSkill ? z : [0, 1, 2, 3, 4, 5].filter((x) => x !== z)[Math.floor(Math.random() * 5)];
        await animate(z, kz, false);
        goalIn = kz !== z;
      } else {
        say(__('Η μπάλα γλίστρησε…'));
        await animate(1, Math.floor(Math.random() * 6), true);
        goalIn = false;
      }
      me.push(goalIn);
    } else {
      const shot = Math.floor(Math.random() * 6);
      if (res.f === 1) {
        const z = await pickZone(__('Πού θα πέσεις για να πιάσεις τη μπάλα;'));
        await animate(shot, z, false);
        goalIn = !(z === shot || (near(z, shot) && Math.random() < 0.4));
      } else {
        const miss = Math.random() < 0.12;
        await animate(shot, (shot + 3) % 6, miss);
        goalIn = !miss;
      }
      if (!goalIn) saves++;
      cpu.push(goalIn);
    }
    drawScore();
    kit.setScore(score());
    if (goalIn) { goal.classList.add('is-goal'); say(mine ? __('ΓΚΟΟΟΛ!') : __('Γκολ του αντιπάλου'), mine ? 'is-ok' : 'is-bad'); if (mine) kit.sfx.cheer(); else kit.sfx.bad(); }
    else { say(mine ? (res.f === 1 ? __('Απέκρουσε ο τερματοφύλακας!') : __('Άουτ!')) : __('Την έπιασες! Απόκρουση!'), mine ? 'is-bad' : 'is-ok'); if (!mine) kit.sfx.cheer(); }
    await new Promise((r) => kit.after(1300, r));
  }
  async function play() {
    for (let i = 0; i < KICKS && !kit.stopped; i++) {
      await kick(true, i);
      // αν έχει κριθεί, σταματάμε
      if (decided(i, true)) break;
      await kick(false, i);
      if (decided(i, false)) break;
    }
    let extra = 0;
    while (!kit.stopped && me.filter(Boolean).length === cpu.filter(Boolean).length && extra < 3) {
      say(__('Ισοπαλία! Πάμε σε «ξαφνικό θάνατο»'));
      await new Promise((r) => kit.after(900, r));
      await kick(true, KICKS + extra);
      await kick(false, KICKS + extra);
      extra++;
    }
    if (kit.stopped) return;
    const a = me.filter(Boolean).length, b = cpu.filter(Boolean).length;
    const win = a > b;
    kit.finish({
      score: score() + (win ? 2000 : 0), win,
      title: win ? `${__('Νίκη στα πέναλτι με {0}-{1}!', a, b)}` : a === b ? `${__('Ισοπαλία {0}-', a)}${b}` : `${__('Ήττα στα πέναλτι με {0}-', a)}${b}`,
      detail: `${__('Έβαλες {0} γκολ και έπιασες {1} πέναλτι. {2} σωστές σε {3} ερωτήσεις.', a, saves, kit.play.correct, kit.play.asked)}`,
      short: `${a}-${b}`
    });
  }
  function decided(i, afterMine) {
    const a = me.filter(Boolean).length, b = cpu.filter(Boolean).length;
    const leftMe = KICKS - me.length, leftCpu = KICKS - cpu.length;
    void i; void afterMine;
    return a > b + leftCpu || b > a + leftMe;
  }
  play();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  let goals = 0, against = 0, saves = 0, i = 0;
  for (let k = 0; k < KICKS; k++) {
    const r1 = simRecord(answers, qs[i++ % qs.length], skill);
    if (r1.f === 1 && Math.random() > 0.25) goals++;
    const r2 = simRecord(answers, qs[i++ % qs.length], skill);
    if (r2.f === 1 && Math.random() < 0.3) saves++; else against++;
  }
  const c = simCounts(answers);
  const win = goals > against;
  const score = goals * 1000 + saves * 700 + c.correct * 100 + (win ? 2000 : 0);
  return Object.assign({ answers, score, result: { title: `${goals}${__('-{0} στα πέναλτι', against)}`, short: `${goals}-${against}`, score, win } }, c);
}
export { esc, clamp };
