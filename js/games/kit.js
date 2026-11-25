/* Κοινά εργαλεία για τα παιχνίδια επανάληψης: πλαίσιο, ερώτηση, καταγραφή απαντήσεων, αποτέλεσμα. */
import { esc, num, shuffle, ICON, pct, exitHref } from '../ui.js';
import { TYPES, grade, isScored } from '../qtypes.js';
import { MODES, unitOf } from '../modes.js';
import { sfx, isMuted, setMuted } from './sfx.js';
import { __ } from '../i18n.js';

export { sfx };
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Για τους εικονικούς μαθητές: μια απάντηση με πιθανότητα σωστού ίση με την «ικανότητα». */
export function simAnswer(q, skill) {
  const good = Math.random() < skill;
  const a = TYPES[q.type].sample(q, good);
  const f = grade(q, a);
  const t = Math.round((3 + Math.random() * Math.max(4, (q.time || 20) * 0.6)) * 1000);
  return { a, f, t };
}
/* Απαντήσεις εικονικού μαθητή σε μια σειρά ερωτήσεων (για τα simulate των παιχνιδιών). */
export function simRecord(answers, q, skill) {
  const r = simAnswer(q, skill);
  const prev = answers[q.id];
  answers[q.id] = { v: r.a, f: r.f, pts: 0, t: r.t, n: ((prev && prev.n) || 0) + 1 };
  return r;
}
export const simCounts = (answers) => ({ correct: Object.values(answers).filter((a) => a.f === 1).length, answered: Object.keys(answers).length });

const PRAISE = [__('Σωστά!'), __('Μπράβο!'), __('Τέλεια!'), __('Εύγε!')];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

export function makeKit(env) {
  const { el, S, P, write, mode, onFinish, uid, sid } = env;
  const st = S.settings || {};
  const questions = (S.questions || []).filter(isScored);
  const timers = new Set();
  const loops = new Set();
  let pool = [], pi = 0, stopped = false, dead = false, finished = false, lastId = null;
  let scoreEl = null, statusEl = null;

  const kit = {
    el, S, P, st, mode, questions, sfx, uid, sid,
    label: MODES[mode].label, icon: MODES[mode].icon, unit: unitOf(mode),
    play: { asked: 0, correct: 0 },
    get stopped() { return stopped; },

    /* ---------- ερωτήσεις ---------- */
    ordered() { return st.shuffleQ === false ? questions.slice() : shuffle(questions); },
    next() {
      if (pi >= pool.length) {
        pool = kit.ordered();
        pi = 0;
        if (pool.length > 1 && pool[0].id === lastId) pool.push(pool.shift());
      }
      const q = pool[pi++];
      lastId = q.id;
      return q;
    },

    /* ---------- χρόνος ---------- */
    after(ms, fn) { const t = setTimeout(() => { timers.delete(t); if (!stopped) fn(); }, ms); timers.add(t); return t; },
    cancel(t) { clearTimeout(t); timers.delete(t); },
    loop(fn) {
      // fn(dt σε δευτερόλεπτα, t σε ms) καλείται σε κάθε καρέ μέχρι να επιστρέψει false
      const L = { on: true };
      let last = performance.now();
      const step = (now) => {
        if (!L.on || stopped) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (fn(dt, now) === false) { L.on = false; loops.delete(L); return; }
        requestAnimationFrame(step);
      };
      loops.add(L);
      requestAnimationFrame(step);
      return { stop() { L.on = false; loops.delete(L); } };
    },
    stopAll() { stopped = true; timers.forEach(clearTimeout); timers.clear(); loops.forEach((L) => { L.on = false; }); loops.clear(); },

    /* ---------- πλαίσιο ---------- */
    shell(extraCls = '') {
      el.innerHTML = `<div class="gm gm-${mode} ${extraCls}">
        <div class="gm-bar">
          <a class="g-btn" href="${exitHref(S)}" aria-label="${__('Έξοδος')}">${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></a>
          <span class="gm-title"><span aria-hidden="true">${kit.icon}</span> <span class="hide-sm">${esc(kit.label)}</span></span>
          <span class="gm-status" data-status aria-live="polite"></span>
          <span class="gm-score"><span data-score>0</span> ${esc(kit.unit || __('πόντοι'))}</span>
          <button class="g-btn gm-snd" type="button" data-snd aria-pressed="${!isMuted()}" aria-label="${__('Ήχος')}">${isMuted() ? ICON.mute : ICON.sound}</button>
        </div>
        <div class="gm-main"></div>
      </div>`;
      scoreEl = el.querySelector('[data-score]');
      statusEl = el.querySelector('[data-status]');
      const snd = el.querySelector('[data-snd]');
      snd.addEventListener('click', () => {
        setMuted(!isMuted());
        snd.setAttribute('aria-pressed', String(!isMuted()));
        snd.innerHTML = isMuted() ? ICON.mute : ICON.sound;
        if (!isMuted()) sfx.click();
      });
      return el.querySelector('.gm-main');
    },
    setScore(n, animate = true) {
      if (!scoreEl) return;
      const from = Number(scoreEl.dataset.v || 0);
      scoreEl.dataset.v = n;
      if (!animate || from === n) { scoreEl.textContent = num(n); return; }
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 500);
        scoreEl.textContent = num(from + (n - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    setStatus(html) { if (statusEl) statusEl.innerHTML = html; },

    /* ---------- μία ερώτηση ----------
       o: { cls, timeLimit (δευτ.), confirm (κλείδωμα απάντησης), suspense (ms), reveal, feedback, explain, continue (ετικέτα κουμπιού),
            autoNext (ms), onReady(ctl, box), onAnswer(res) } */
    ask(container, q, o = {}) {
      return new Promise((resolve) => {
        const box = document.createElement('div');
        box.className = `gq ${o.cls || ''}`;
        box.innerHTML = `${o.timeLimit ? '<div class="gq-time" aria-hidden="true"><span class="gq-time-bar"></span><span class="gq-time-n"></span></div>' : ''}<div class="q-holder"></div><div class="gq-confirm" hidden></div><div class="gq-out" hidden aria-live="polite"></div>`;
        container.replaceChildren(box);
        const holder = box.querySelector('.q-holder');
        const t0 = Date.now();
        let done = false, pending, to = null, iv = null;
        const finalize = (a) => {
          if (done || stopped) return;
          done = true;
          clearTimeout(to);
          clearInterval(iv);
          const t = Date.now() - t0;
          const f = a === null ? 0 : grade(q, a);
          const res = { a, f, t };
          const show = () => {
            if (stopped) return;
            if (o.reveal === false) ctl.disable(); else ctl.reveal(a, f);
            box.classList.add(f === 1 ? 'is-ok' : f > 0 ? 'is-part' : 'is-bad');
            if (o.onAnswer) o.onAnswer(res);
            if (o.feedback === false) { resolve(res); return; }
            const out = box.querySelector('.gq-out');
            const correct = f !== 1 ? TYPES[q.type].correct(q) : '';
            out.hidden = false;
            out.innerHTML = `<p class="gq-v ${f === 1 ? 'v-ok' : f > 0 ? 'v-part' : 'v-bad'}"><span class="sheet-icon" aria-hidden="true">${f === 1 ? '✓' : f > 0 ? '◐' : a === null ? '⏱' : '✗'}</span>${f === 1 ? pickOne(PRAISE) : f > 0 ? `${__('Σχεδόν! {0} σωστό', pct(f))}` : a === null ? __('Τέλος χρόνου!') : __('Λάθος!')}</p>
              ${correct ? `<p class="gq-c">${__('Σωστή απάντηση:')} <b>${esc(correct)}</b></p>` : ''}
              ${o.explain !== false && q.explain && f !== 1 ? `<p class="gq-x">${esc(q.explain)}</p>` : ''}
              ${o.continue ? `<button class="btn btn-sun btn-lg gq-next" type="button" data-next>${esc(typeof o.continue === 'function' ? o.continue(res) : o.continue)}</button>` : ''}`;
            if (o.continue) {
              const b = out.querySelector('[data-next]');
              b.addEventListener('click', () => { b.disabled = true; resolve(res); }, { once: true });
              setTimeout(() => { try { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }, 50);
            } else {
              kit.after(o.autoNext !== undefined ? o.autoNext : (f === 1 ? 1000 : 2200), () => resolve(res));
            }
          };
          if (o.suspense && a !== null) { box.classList.add('is-suspense'); kit.after(o.suspense, () => { box.classList.remove('is-suspense'); show(); }); }
          else show();
        };
        const submit = (a) => {
          if (done) return;
          if (o.confirm && (q.type === 'mcq' || q.type === 'tf') && a !== null) {
            pending = a;
            const key = q.type === 'tf' ? (a ? '1' : '0') : String(a);
            box.querySelectorAll('.opt').forEach((b) => b.classList.toggle('is-locked', b.dataset.k === key));
            const c = box.querySelector('.gq-confirm');
            c.hidden = false;
            c.innerHTML = ('<span>' + __('Τελική απάντηση;') + '</span><button class="btn btn-sun" type="button" data-final>' + __('Ναι, κλείδωσέ την') + '</button>');
            c.querySelector('[data-final]').addEventListener('click', () => { c.hidden = true; finalize(pending); }, { once: true });
            return;
          }
          finalize(a);
        };
        const ctl = TYPES[q.type].play(holder, q, { submit, shuffle: st.shuffleA !== false && o.shuffle !== false });
        if (o.timeLimit) {
          const bar = box.querySelector('.gq-time-bar');
          const n = box.querySelector('.gq-time-n');
          bar.style.transition = `transform ${o.timeLimit}s linear`;
          requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }));
          const tick = () => { const left = Math.max(0, Math.ceil(o.timeLimit - (Date.now() - t0) / 1000)); n.textContent = `${left}″`; box.classList.toggle('is-hurry', left <= 5); };
          tick();
          iv = setInterval(tick, 250);
          to = setTimeout(() => finalize(null), o.timeLimit * 1000);
          timers.add(to);
        }
        if (o.onReady) o.onReady(ctl, box);
      });
    },

    /* ---------- καταγραφή ---------- */
    record(q, a, f, t, pts = 0) {
      const prev = P.answers[q.id];
      P.answers[q.id] = { v: a === undefined ? null : a, f, pts, t: Math.round(t || 0), n: ((prev && prev.n) || 0) + 1 };
      P.correct = Object.values(P.answers).filter((x) => x.f === 1).length;
      P.answered = Object.keys(P.answers).length;
      kit.play.asked++;
      if (f === 1) kit.play.correct++;
      write({ answers: { [q.id]: P.answers[q.id] }, correct: P.correct, answered: P.answered });
    },

    /* ---------- αποτέλεσμα ----------
       r: { score, title, detail, short, win, extra (επιπλέον πεδία για τον μαθητή, π.χ. η διαδρομή του αγώνα), delay } */
    finish(r) {
      if (finished) return;
      finished = true;
      kit.stopAll();
      const score = Math.max(0, Math.round(r.score || 0));
      const first = !P.plays;
      P.plays = (P.plays || 0) + 1;
      P.score = first ? score : Math.max(P.score || 0, score);
      P.last = score;
      P.result = { title: r.title || __('Τέλος παιχνιδιού'), detail: r.detail || '', short: r.short || '', score, correct: kit.play.correct, asked: kit.play.asked, win: !!r.win };
      if (!P.done || first) P.doneAt = P.doneAt || Date.now();
      P.done = true;
      const patch = { score: P.score, last: score, plays: P.plays, result: P.result, done: true, doneAt: P.doneAt };
      if (r.extra && (first || score >= (P.score || 0))) { Object.assign(patch, r.extra); Object.assign(P, r.extra); }
      write(patch);
      if (r.win) { sfx.win(); kit.confetti(); }
      setTimeout(() => { if (!dead) onFinish(); }, r.delay !== undefined ? r.delay : 1600);
    },

    /* ---------- εφέ ---------- */
    confetti(n = 70) {
      if (reduced()) return;
      const box = document.createElement('div');
      box.className = 'confetti';
      box.setAttribute('aria-hidden', 'true');
      const colors = ['#FFC23C', '#2F6FE4', '#E2445C', '#0FA3B1', '#8E44D9', '#ffffff', '#0B7A5C'];
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.style.left = `${Math.random() * 100}%`;
        s.style.background = colors[i % colors.length];
        s.style.animationDelay = `${Math.random() * 0.5}s`;
        s.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
        s.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
        s.style.setProperty('--x', `${Math.random() * 120 - 60}px`);
        box.appendChild(s);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 3200);
    },
    banner(container, html, cls = '', ms = 1200) {
      const b = document.createElement('div');
      b.className = `gm-banner ${cls}`;
      b.innerHTML = html;
      container.appendChild(b);
      setTimeout(() => b.remove(), ms);
      return b;
    },
    // Αντίστροφη μέτρηση 3-2-1 πριν από αγώνες
    countdown(container) {
      return new Promise((resolve) => {
        const b = document.createElement('div');
        b.className = 'gm-count';
        container.appendChild(b);
        const seq = ['3', '2', '1', __('Πάμε!')];
        let i = 0;
        const step = () => {
          if (stopped) { b.remove(); return; }
          if (i >= seq.length) { b.remove(); resolve(); return; }
          b.textContent = seq[i];
          b.classList.remove('pulse');
          void b.offsetWidth;
          b.classList.add('pulse');
          if (i < 3) sfx.tick(); else sfx.whistle();
          i++;
          kit.after(i === 4 ? 500 : 750, step);
        };
        step();
      });
    },
    // καλείται από τη σελίδα όταν το παιδί φεύγει
    destroy() { dead = true; kit.stopAll(); }
  };
  return kit;
}
