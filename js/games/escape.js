/* Δωμάτιο απόδρασης: κάθε σωστή απάντηση δίνει ένα ψηφίο για τις κλειδαριές της πόρτας. Κάθε λάθος κοστίζει χρόνο. */
import { esc } from '../ui.js';
import { TYPES } from '../qtypes.js';
import { simRecord, simCounts, clamp } from './kit.js';
import { __ } from '../i18n.js';

export const PENALTY = 20;
export const digitsFor = (n) => clamp(n, 3, 9);
export const timeFor = (digits) => 60 + 35 * digits;
function splitLocks(n) {
  const k = Math.min(3, n);
  const base = Math.floor(n / k);
  return Array.from({ length: k }, (_, i) => base + (i < n % k ? 1 : 0));
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export function start(kit) {
  const n = digitsFor(kit.questions.length);
  const sizes = splitLocks(n);
  const locks = sizes.map((len) => ({ code: Array.from({ length: len }, () => Math.floor(Math.random() * 10)), found: 0, open: false, dial: Array(len).fill(0) }));
  let timeLeft = timeFor(n), score = 0, over = false;
  const main = kit.shell('gm-room');
  main.innerHTML = `<div class="es">
    <div class="es-room">
      <div class="es-story"><p><b>${__('Κλειδώθηκες στη βιβλιοθήκη του σχολείου!')}</b> ${__('Η πόρτα έχει {0} κλειδαριές. Κάθε σωστή απάντηση σου δίνει ένα ψηφίο. Όταν βρεις όλα τα ψηφία μιας κλειδαριάς, πάτα την και βάλε τον κωδικό.', locks.length)}</p></div>
      <div class="es-door" aria-label="${__('Η πόρτα')}"><div class="es-locks">${locks.map((l, i) => `<button type="button" class="es-lock" data-lock="${i}" aria-label="${__('Κλειδαριά')} ${i + 1}">
        <span class="es-shackle" aria-hidden="true"></span><span class="es-body"><span class="es-ln">${i + 1}</span><span class="es-slots">${l.code.map(() => '<i>?</i>').join('')}</span></span></button>`).join('')}</div>
        <span class="es-knob" aria-hidden="true"></span></div>
      <div class="es-notes" aria-label="${__('Τα ψηφία που βρήκες')}"></div>
    </div>
    <div class="es-panel"></div></div>`;
  const panel = main.querySelector('.es-panel');
  const notes = main.querySelector('.es-notes');
  const lockBtns = main.querySelectorAll('.es-lock');
  const drawLocks = () => {
    locks.forEach((l, i) => {
      const b = lockBtns[i];
      b.classList.toggle('is-ready', l.found === l.code.length && !l.open);
      b.classList.toggle('is-open', l.open);
      b.querySelector('.es-slots').innerHTML = l.code.map((d, k) => `<i>${l.open ? d : k < l.found ? '•' : '?'}</i>`).join('');
    });
    notes.innerHTML = locks.map((l, i) => l.code.slice(0, l.found).map((d, k) => `<span class="es-note" data-l="${i}" style="--r:${((i * 7 + k * 13) % 9) - 4}deg"><small>${__('Κλειδαριά {0} · ψηφίο', i + 1)} ${k + 1}</small><b>${d}</b></span>`).join('')).join('');
    kit.setStatus(`<span class="es-clock ${timeLeft < 30 ? 'is-hurry' : ''}">⏱ ${fmt(timeLeft)}</span>`);
  };
  drawLocks();
  const clock = kit.loop((dt) => {
    if (over) return false;
    const before = Math.ceil(timeLeft);
    timeLeft -= dt;
    if (Math.ceil(timeLeft) !== before) drawLocks();
    if (timeLeft <= 0) { timeLeft = 0; lose(); return false; }
    return true;
  });
  const queue = kit.ordered();
  let qi = 0;
  const nextQ = () => { if (qi >= queue.length) { queue.push(...kit.ordered()); } return queue[qi++]; };
  const target = () => locks.find((l) => l.found < l.code.length);

  async function ask() {
    if (over || kit.stopped) return;
    const t = target();
    if (!t) {
      panel.innerHTML = `<p class="es-msg">${__('Βρήκες όλα τα ψηφία! Πάτα {0} για να {1}.', locks.filter((l) => !l.open).length > 1 ? __('τις κλειδαριές') : __('την κλειδαριά'), locks.filter((l) => !l.open).length > 1 ? __('τις ανοίξεις') : __('την ανοίξεις'))}</p>`;
      return;
    }
    const q = nextQ();
    const res = await kit.ask(panel, q, { cls: 'gq-es', explain: false, onAnswer(r) { if (r.f === 1) kit.sfx.unlock(); else kit.sfx.bad(); } });
    if (over || kit.stopped) return;
    kit.record(q, res.a, res.f, res.t, res.f === 1 ? 100 : 0);
    if (res.f === 1) {
      t.found++;
      score += 100;
      kit.setScore(score);
      kit.banner(main.querySelector('.es-room'), `${__('Νέο ψηφίο:')} <b>${t.code[t.found - 1]}</b>`, 'is-ok', 1300);
    } else {
      timeLeft = Math.max(0, timeLeft - PENALTY);
      queue.splice(qi + 2, 0, q);
      kit.banner(main.querySelector('.es-room'), `−${PENALTY}″`, 'is-bad', 1100);
    }
    drawLocks();
    ask();
  }
  function openDial(i) {
    const l = locks[i];
    if (l.open || l.found < l.code.length || over) return;
    kit.sfx.click();
    const d = document.createElement('div');
    d.className = 'es-dial-wrap';
    d.innerHTML = `<div class="es-dial" role="dialog" aria-label="${__('Κλειδαριά')} ${i + 1}"><p class="es-dial-t">${__('Κλειδαριά {0}: βάλε τον κωδικό από τα χαρτάκια', i + 1)}</p>
      <div class="es-wheels">${l.dial.map((v, k) => `<div class="es-wheel"><button type="button" class="es-up" data-k="${k}" data-d="1" aria-label="${__('Ψηφίο {0} πάνω', k + 1)}">▲</button><span class="es-v" data-v="${k}">${v}</span><button type="button" class="es-dn" data-k="${k}" data-d="-1" aria-label="${__('Ψηφίο {0} κάτω', k + 1)}">▼</button></div>`).join('')}</div>
      <p class="es-dial-err" aria-live="polite"></p>
      <p class="actions center"><button type="button" class="btn btn-ghost-light" data-cancel>${__('Πίσω')}</button><button type="button" class="btn btn-sun" data-try>${__('Άνοιξε')}</button></p></div>`;
    main.querySelector('.es-room').appendChild(d);
    d.querySelector('[data-try]').focus();
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) {
        const k = Number(b.dataset.k);
        l.dial[k] = (l.dial[k] + Number(b.dataset.d) + 10) % 10;
        d.querySelector(`[data-v="${k}"]`).textContent = l.dial[k];
        kit.sfx.tick();
      }
      if (e.target.closest('[data-cancel]')) d.remove();
      if (e.target.closest('[data-try]')) {
        if (l.dial.every((v, k) => v === l.code[k])) {
          l.open = true;
          d.remove();
          kit.sfx.unlock();
          score += 300;
          kit.setScore(score);
          drawLocks();
          if (locks.every((x) => x.open)) win();
          else ask();
        } else {
          kit.sfx.bad();
          const err = d.querySelector('.es-dial-err');
          err.textContent = __('Δεν άνοιξε. Κοίτα ξανά τα χαρτάκια.');
          d.querySelector('.es-dial').classList.remove('shake');
          void d.offsetWidth;
          d.querySelector('.es-dial').classList.add('shake');
        }
      }
    });
  }
  main.querySelector('.es-locks').addEventListener('click', (e) => { const b = e.target.closest('[data-lock]'); if (b) openDial(Number(b.dataset.lock)); });
  function win() {
    over = true;
    clock.stop();
    main.querySelector('.es-door').classList.add('is-open');
    const bonus = 2000 + Math.round(timeLeft) * 10;
    score += bonus;
    kit.setScore(score);
    kit.finish({ score, win: true, title: __('Απέδρασες!'), detail: `${__('Άνοιξες την πόρτα με {0} να περισσεύει. {1} σωστές σε {2} ερωτήσεις.', fmt(timeLeft), kit.play.correct, kit.play.asked)}`, short: `${__('απέδρασε,')} ${fmt(timeLeft)}`, delay: 2200 });
  }
  function lose() {
    over = true;
    panel.innerHTML = ('<p class="es-msg">' + __('Ο χρόνος τελείωσε…') + '</p>');
    kit.sfx.lose();
    kit.finish({ score, win: false, title: __('Ο χρόνος τελείωσε'), detail: `${__('Άνοιξες {0} από {1} κλειδαριές. {2} σωστές σε {3} ερωτήσεις.', locks.filter((l) => l.open).length, locks.length, kit.play.correct, kit.play.asked)}`, short: `${locks.filter((l) => l.open).length}${__('/{0} κλειδαριές', locks.length)}` });
  }
  ask();
  return { stop() { kit.stopAll(); } };
}

export function simulate(S, skill) {
  const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
  const answers = {};
  const n = digitsFor(qs.length);
  let left = timeFor(n), found = 0, i = 0, score = 0;
  while (found < n && left > 0) {
    const r = simRecord(answers, qs[i++ % qs.length], skill);
    left -= r.t / 1000 + 4;
    if (r.f === 1) { found++; score += 100; } else left -= PENALTY;
  }
  const escaped = found >= n && left > 0;
  if (escaped) score += 2000 + Math.round(left) * 10 + 300 * Math.min(3, n);
  return Object.assign({ answers, score, result: { title: escaped ? __('Απέδρασε') : __('Δεν πρόλαβε'), short: escaped ? `${__('απέδρασε,')} ${fmt(left)}` : __('δεν πρόλαβε'), score, win: escaped } }, simCounts(answers));
}
export { esc };
