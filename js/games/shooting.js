/* Σκοποβολή: μετά από κάθε ερώτηση, γύρος με κινούμενους στόχους.
   Οι σωστές απαντήσεις κάνουν τους στόχους μεγαλύτερους και πιο αργούς, τα λάθη μικρότερους και πιο γρήγορους. */
import { esc, num } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts, rnd, clamp, reduced } from './kit.js';
import { __ } from '../i18n.js';

const SIZES = [30, 40, 52, 66, 82];        // διάμετρος στόχου ανά επίπεδο
const SPEEDS = [300, 240, 190, 150, 115];  // px ανά δευτερόλεπτο
const ROUND_SEC = 8;
const AMMO = 8;
export const ROUNDS = (n) => clamp(n, 5, 10);
const RING = (d, r) => (d < r * 0.35 ? 100 : d < r * 0.7 ? 60 : 30);

export function start(kit) {
  const rounds = ROUNDS(kit.questions.length);
  let level = 2, score = 0, hits = 0, shots = 0, round = 0;
  const main = kit.shell('gm-range');
  main.innerHTML = `<div class="sg"><div class="sg-head"><span class="sg-round" data-round></span><span class="sg-level" data-level></span><span class="sg-ammo" data-ammo aria-live="polite"></span></div>
    <div class="sg-range" aria-label="${__('Πεδίο βολής')}"><div class="sg-rails" aria-hidden="true"><span></span><span></span><span></span></div><div class="sg-msg"></div></div>
    <div class="sg-q"></div></div>`;
  const range = main.querySelector('.sg-range');
  const msg = main.querySelector('.sg-msg');
  const qBox = main.querySelector('.sg-q');
  const levelEl = main.querySelector('[data-level]');
  const ammoEl = main.querySelector('[data-ammo]');
  const roundEl = main.querySelector('[data-round]');
  const drawLevel = () => { levelEl.innerHTML = `${__('Στόχοι:')} ${[__('πολύ μικροί'), __('μικροί'), __('κανονικοί'), __('μεγάλοι'), __('πολύ μεγάλοι')][level]} <span class="sg-dots">${SIZES.map((_, i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`; };
  drawLevel();

  function shootRound() {
    return new Promise((resolve) => {
      let ammo = AMMO, left = ROUND_SEC, spawnIn = 0, alive = true;
      const targets = [];
      const W = () => range.clientWidth, H = () => range.clientHeight;
      const size = SIZES[level], spd = SPEEDS[level] * (reduced() ? 0.6 : 1);
      range.classList.add('is-live');
      msg.textContent = '';
      const drawAmmo = () => { ammoEl.innerHTML = `<span class="sr">${__('Βολές:')} ${ammo}</span>${Array.from({ length: AMMO }, (_, i) => `<i class="${i < ammo ? 'on' : ''}" aria-hidden="true"></i>`).join('')}`; };
      drawAmmo();
      const spawn = () => {
        const row = Math.floor(Math.random() * 3);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sg-t';
        b.setAttribute('aria-label', __('Στόχος βολής'));
        b.style.width = b.style.height = `${size}px`;
        range.appendChild(b);
        const t = { el: b, x: dir > 0 ? -size : W() + size, y: (H() * (row + 0.5)) / 3.2 + 6, dir, spd: spd * rnd(0.85, 1.2), ph: Math.random() * 6, hit: false };
        targets.push(t);
      };
      const end = () => {
        if (!alive) return;
        alive = false;
        loop.stop();
        range.classList.remove('is-live');
        range.removeEventListener('pointerdown', onShoot);
        targets.forEach((t) => t.el.remove());
        resolve();
      };
      const onShoot = (e) => {
        if (!alive || ammo <= 0) return;
        e.preventDefault();
        ammo--;
        shots++;
        drawAmmo();
        kit.sfx.bang();
        const rect = range.getBoundingClientRect();
        const px = (e.clientX !== undefined ? e.clientX : rect.left + rect.width / 2) - rect.left;
        const py = (e.clientY !== undefined ? e.clientY : rect.top + rect.height / 2) - rect.top;
        let hit = null;
        targets.forEach((t) => {
          if (t.hit) return;
          const d = Math.hypot(px - t.x, py - (t.yNow !== undefined ? t.yNow : t.y));
          if (d <= size / 2 && (!hit || d < hit.d)) hit = { t, d };
        });
        const mark = document.createElement('span');
        mark.className = hit ? 'sg-pts' : 'sg-hole';
        mark.style.left = `${px}px`;
        mark.style.top = `${py}px`;
        if (hit) {
          const pts = RING(hit.d, size / 2);
          score += pts;
          hits++;
          hit.t.hit = true;
          hit.t.el.classList.add('is-hit');
          mark.textContent = `+${pts}`;
          kit.sfx.pop();
          kit.setScore(score);
          setTimeout(() => hit.t.el.remove(), 380);
        }
        range.appendChild(mark);
        setTimeout(() => mark.remove(), 700);
        if (ammo <= 0) kit.after(400, end);
      };
      range.addEventListener('pointerdown', onShoot);
      // πληκτρολόγιο: Enter/Space σε στόχο = βολή στο κέντρο του
      range.addEventListener('keydown', (e) => {
        const b = e.target.closest('.sg-t');
        if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
        const t = targets.find((x) => x.el === b);
        const rect = range.getBoundingClientRect();
        if (t) onShoot({ preventDefault() {}, clientX: rect.left + t.x, clientY: rect.top + (t.yNow !== undefined ? t.yNow : t.y) });
      });
      const loop = kit.loop((dt) => {
        left -= dt;
        spawnIn -= dt;
        if (spawnIn <= 0 && targets.filter((t) => !t.hit && t.el.isConnected).length < 4) { spawn(); spawnIn = rnd(0.45, 0.9); }
        targets.forEach((t) => {
          if (t.hit) return;
          t.x += t.dir * t.spd * dt;
          t.ph += dt * 3;
          const y = t.y + Math.sin(t.ph) * 8;
          t.el.style.transform = `translate(${t.x - size / 2}px, ${y - size / 2}px)`;
          t.yNow = y;
          if ((t.dir > 0 && t.x > W() + size) || (t.dir < 0 && t.x < -size)) { t.hit = true; t.el.remove(); }
        });
        roundEl.textContent = `${__('Γύρος {0} από {1} · {2}″', round, rounds, Math.ceil(Math.max(0, left)))}`;
        if (left <= 0) { end(); return false; }
        return true;
      });
    });
  }
  async function play() {
    for (round = 1; round <= rounds && !kit.stopped; round++) {
      roundEl.textContent = `${__('Γύρος {0} από', round)} ${rounds}`;
      msg.textContent = __('Απάντησε για να γεμίσεις το όπλο');
      const q = kit.next();
      const res = await kit.ask(qBox, q, { cls: 'gq-sg', explain: false, onAnswer(r) { if (r.f === 1) kit.sfx.ok(); else kit.sfx.bad(); } });
      if (kit.stopped) return;
      kit.record(q, res.a, res.f, res.t, res.f === 1 ? 50 : 0);
      if (res.f === 1) { score += 50; level = Math.min(4, level + 1); } else if (!(res.f > 0)) level = Math.max(0, level - 1);
      kit.setScore(score);
      drawLevel();
      qBox.innerHTML = `<p class="sg-tip ${res.f === 1 ? 'is-ok' : 'is-bad'}">${res.f === 1 ? __('Σωστό! Οι στόχοι μεγάλωσαν.') : __('Λάθος: οι στόχοι μίκρυναν.')} ${__('Πάτα πάνω στους στόχους!')}</p>`;
      await shootRound();
    }
    if (kit.stopped) return;
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    kit.finish({ score, win: hits >= rounds * 3, title: `${num(score)} ${__('πόντοι στη σκοποβολή!')}`, detail: `${hits} ${__('εύστοχες βολές από {0} ({1}%) και {2} σωστές απαντήσεις σε {3}.', shots, acc, kit.play.correct, kit.play.asked)}`, short: `${hits} ${__('βολές')}` });
  }
  play();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  const rounds = ROUNDS(qs.length);
  let level = 2, score = 0, hits = 0;
  for (let i = 0; i < rounds; i++) {
    const r = simRecord(answers, qs[i % qs.length], skill);
    if (r.f === 1) { score += 50; level = Math.min(4, level + 1); } else level = Math.max(0, level - 1);
    const h = Math.round(rnd(1, 3) + level * rnd(0.6, 1.2) * skill);
    hits += h;
    score += h * Math.round(rnd(45, 75));
  }
  return Object.assign({ answers, score, result: { title: `${num(score)} ${__('πόντοι')}`, short: `${hits} ${__('βολές')}`, score } }, simCounts(answers));
}
export { esc };
