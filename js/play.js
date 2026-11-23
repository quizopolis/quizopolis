/* Η πλευρά του μαθητή: είσοδος από σύνδεσμο, παιχνίδι σε όλους τους τρόπους, τέλος. */
import { esc, app, setTitle, toast, num, pct, plural, norm, shuffle, local, ICON, errText, LOGO, CFG, langSwitch } from './ui.js';
import { DB } from './store.js';
import { TYPES, grade, isScored, parseCloze } from './qtypes.js';
import { points, ranking, teamStats, POWERUPS, TEAM_SET, pickTeam } from './scoring.js';
import { MODES, isReview, unitOf } from './modes.js';
import { __, LOCALE } from './i18n.js';

const PRAISE = [__('Σωστά!'), __('Μπράβο!'), __('Τέλεια!'), __('Πολύ καλά!'), __('Εύγε!')];
const NUDGE = [__('Όχι αυτή τη φορά'), __('Δεν πειράζει, συνέχισε!'), __('Την επόμενη θα το βρεις!'), __('Λάθος, αλλά μαθαίνεις!')];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const teamById = (id) => TEAM_SET.find((t) => t.id === id) || null;
const isOpen = (s) => s && s.status !== 'ended' && !(s.deadline && Date.now() > s.deadline);
export const LAST_KEY = 'qz:last';

function shell(inner, cls = '', top = false) {
  return `<div class="pl ${cls}${top ? ' pl-has-top' : ''}">${top ? `<div class="pl-top"><a class="pl-brand" href="#/">${LOGO}<span>${esc(CFG.siteName)}</span></a>${langSwitch()}</div>` : ''}<div class="pl-in">${inner}</div></div>`;
}
function teamBadge(t) {
  return t ? `<span class="team-badge" style="--t:${t.color}"><span aria-hidden="true">${t.emoji}</span> ${esc(t.name)}</span>` : '';
}
const fmtScore = (n, mode) => `${num(n || 0)}${unitOf(mode) ? ` ${unitOf(mode)}` : ''}`;

/* ================= ΕΙΣΟΔΟΣ ΑΠΟ ΣΥΝΔΕΣΜΟ ================= */
export async function viewJoin(sid, ctx) {
  setTitle(__('Παιχνίδι'));
  const el = app();
  el.className = 'v-play';
  el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Φορτώνει το παιχνίδι…') + '</p></div>'), '', true);
  const card = el.querySelector('.pl-card');
  const fail = (title, text) => {
    card.innerHTML = `<h1 class="pl-title">${esc(title)}</h1><p class="pl-text">${esc(text)}</p><p><a class="btn btn-sun btn-lg" href="#/">${__('Στην αρχή')}</a></p>`;
  };
  let uid, s;
  try { uid = await DB.ensureStudent(); s = await DB.getSession(sid); } catch (e) { fail(__('Δεν άνοιξε το παιχνίδι'), errText(e)); return; }
  if (!s) { fail(__('Ο σύνδεσμος δεν υπάρχει'), __('Ίσως τον διέγραψε ο εκπαιδευτικός. Ζήτησε νέο σύνδεσμο.')); return; }
  if (s.kicked && s.kicked[uid]) { fail(__('Δεν μπορείς να μπεις σε αυτό το παιχνίδι'), __('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.')); return; }
  let mine = null;
  try { mine = await DB.getPlayer(sid, uid); } catch (e) { /* πρώτη φορά */ }
  if (mine && mine.name) { ctx.go('/play/' + sid, true); return; }
  if (s.status === 'ended') { fail(__('Ο σύνδεσμος έκλεισε'), __('Ο εκπαιδευτικός έκλεισε αυτό το παιχνίδι. Ρώτησέ τον για νέο σύνδεσμο.')); return; }
  if (s.deadline && Date.now() > s.deadline) { fail(__('Η προθεσμία έληξε'), __('Αυτό το παιχνίδι δεν δέχεται πια απαντήσεις.')); return; }

  let players = [];
  try { players = await DB.listPlayers(sid); } catch (e) { /* ignore */ }
  const taken = players.map((p) => norm(p.name));
  const mode = MODES[s.mode] || MODES.classic;
  setTitle(s.title);
  const roster = Array.isArray(s.roster) && s.roster.length ? s.roster : null;
  const cover = s.cover || {};
  card.className = 'pl-card pl-join';
  card.innerHTML = `<div class="join-cover" style="--c:${esc(cover.color || '#0B7A5C')}" aria-hidden="true">${esc(cover.emoji || mode.icon)}</div>
    <p class="pl-kicker">${esc(mode.icon)} ${esc(mode.label)}</p>
    <h1 class="pl-title">${esc(s.title)}</h1>
    <p class="pl-text pl-small">${esc(mode.kid || mode.desc)}</p>
    ${s.deadline ? `<p class="pl-small pl-deadline">${__('Μέχρι')} ${esc(new Date(s.deadline).toLocaleString(LOCALE, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p>` : ''}
    ${roster ? `<p class="pl-text">${__('Πάτησε το όνομά σου.')}</p>
      <div class="roster" role="group" aria-label="${__('Ονόματα της τάξης')}">${roster.map((n) => `<button type="button" class="roster-b" data-name="${esc(n)}" ${taken.includes(norm(n)) ? 'disabled aria-disabled="true"' : ''}>${esc(n)}</button>`).join('')}</div>
      <p class="pl-small"><button type="button" class="link-btn" data-other>${__('Δεν βρίσκω το όνομά μου')}</button></p>` : ''}
    <form class="name-form" ${roster ? 'hidden' : ''} novalidate>
      <label class="label-light" for="nick">${__('Το όνομά σου')}</label>
      <input class="input input-xl" id="nick" maxlength="24" autocomplete="off" spellcheck="false" placeholder="${__('π.χ. Νίκος Π.')}">
      <p class="form-err" role="alert"></p>
      <button class="btn btn-sun btn-lg btn-wide" type="submit">${__('Ξεκίνα')}</button>
    </form>`;
  const join = async (name) => {
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const body = { name, joinedAt: Date.now(), score: 0, correct: 0, answered: 0, streak: 0, bestStreak: 0, answers: {}, done: false };
    if (s.mode === 'team' && Array.isArray(s.teams) && s.teams.length) body.team = pickTeam(players, s.teams);
    try {
      await DB.joinSession(sid, uid, body);
      if (!DB.sandbox) local.set(LAST_KEY, { sid, name, title: s.title });
      ctx.go('/play/' + sid, true);
    } catch (e) {
      toast(errText(e), 'error');
      card.querySelectorAll('button').forEach((b) => { if (!b.getAttribute('aria-disabled')) b.disabled = false; });
    }
  };
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-name]');
    if (b && !b.disabled) join(b.dataset.name);
    if (e.target.closest('[data-other]')) { card.querySelector('.name-form').hidden = false; card.querySelector('#nick').focus(); }
  });
  const form = card.querySelector('.name-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = card.querySelector('#nick').value.replace(/\s+/g, ' ').trim();
    const err = form.querySelector('.form-err');
    if (name.length < 2) { err.textContent = __('Γράψε το όνομά σου (τουλάχιστον 2 γράμματα).'); return; }
    if (taken.includes(norm(name))) { err.textContent = __('Αυτό το όνομα το έχει ήδη κάποιος. Πρόσθεσε το αρχικό του επωνύμου σου.'); return; }
    join(name);
  });
  if (!roster) setTimeout(() => { const n = card.querySelector('#nick'); if (n && matchMedia('(min-width: 700px)').matches) n.focus(); }, 50);
}

/* ================= ΠΑΙΧΝΙΔΙ ================= */
export function viewPlay(sid, ctx) {
  const el = app();
  el.className = 'v-play';
  el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Φορτώνει…') + '</p></div>'));
  let uid = null, P = null, S = null, engine = null, unsub = null, stopped = false, screen = '';

  const write = (patch) => DB.updatePlayer(sid, uid, patch).catch((e) => {
    if (e.code === 'ended' || e.code === 'kicked') return;
    toast(errText(e), 'error');
  });
  const stopEngine = () => { if (engine) { try { engine.stop(); } catch (e) { /* ignore */ } engine = null; } };

  async function boot() {
    try { uid = await DB.ensureStudent(); P = await DB.getPlayer(sid, uid); } catch (e) { fatal(errText(e)); return; }
    if (!P || !P.name) { ctx.go('/g/' + sid, true); return; }
    P.answers = P.answers || {};
    unsub = DB.watchSession(sid, onSession, (e) => toast(errText(e), 'error'));
  }
  function fatal(text) {
    el.innerHTML = shell(`<div class="pl-card"><h1 class="pl-title">${__('Κάτι δεν πήγε καλά')}</h1><p class="pl-text">${esc(text)}</p><p><a class="btn btn-sun btn-lg" href="#/">${__('Στην αρχή')}</a></p></div>`);
  }
  function onSession(s) {
    if (stopped) return;
    if (!s) { stopEngine(); fatal(__('Ο εκπαιδευτικός διέγραψε αυτό το παιχνίδι.')); return; }
    const first = !S;
    S = s;
    setTitle(s.title);
    if (s.kicked && s.kicked[uid]) {
      stopEngine();
      screen = 'kicked';
      el.innerHTML = shell(('<div class="pl-card"><h1 class="pl-title">' + __('Βγήκες από το παιχνίδι') + '</h1><p class="pl-text">' + __('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.') + '</p><p><a class="btn btn-sun btn-lg" href="#/">' + __('Στην αρχή') + '</a></p></div>'));
      return;
    }
    if (!isOpen(s)) { if (screen !== 'end') { stopEngine(); showEnd(); } return; }
    if (screen === 'end') return;
    if (first || !engine) start();
  }
  function start() {
    stopEngine();
    if (P.done && S.mode !== 'flashcards') { showEnd(); return; }
    if (S.mode === 'flashcards') engine = cardsEngine();
    else if (isReview(S.mode)) engine = gameEngine();
    else engine = selfEngine();
  }

  /* ---------- κοινό πλαίσιο ερώτησης ---------- */
  function frame(opts) {
    screen = 'q';
    el.innerHTML = `<div class="game" style="${opts.team ? `--t:${opts.team.color}` : ''}">
      <div class="game-bar">
        <a class="g-btn" href="#/" aria-label="${__('Έξοδος')}">${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></a>
        <span class="game-count" aria-live="polite"></span>
        <span class="game-stats">${opts.team ? teamBadge(opts.team) : ''}<span class="game-streak" hidden></span><span class="game-pts" ${opts.noPoints ? 'hidden' : ''}><span data-pts>${num(P.score || 0)}</span> ${__('πόντοι')}</span></span>
      </div>
      <div class="game-time" hidden><span class="game-time-bar"></span><span class="game-time-n"></span></div>
      <div class="game-powers" hidden></div>
      <div class="game-body"></div>
      <div class="sheet" hidden></div>
    </div>`;
    const root = el.querySelector('.game');
    return {
      root,
      body: root.querySelector('.game-body'),
      sheet: root.querySelector('.sheet'),
      count: root.querySelector('.game-count'),
      pts: root.querySelector('[data-pts]'),
      streak: root.querySelector('.game-streak'),
      powers: root.querySelector('.game-powers'),
      timeWrap: root.querySelector('.game-time'),
      timeBar: root.querySelector('.game-time-bar'),
      timeN: root.querySelector('.game-time-n')
    };
  }
  function timer(F, limit, onEnd) {
    const t0 = Date.now();
    let total = limit, iv = null, to = null;
    if (!(limit > 0)) { F.timeWrap.hidden = true; return { stop() {}, add() {}, elapsed: () => (Date.now() - t0) / 1000, limit: () => 0 }; }
    F.timeWrap.hidden = false;
    const run = () => {
      const left = Math.max(0, total - (Date.now() - t0) / 1000);
      F.timeBar.style.transition = 'none';
      F.timeBar.style.transform = `scaleX(${left / total})`;
      void F.timeBar.offsetWidth;
      F.timeBar.style.transition = `transform ${left}s linear`;
      F.timeBar.style.transform = 'scaleX(0)';
      clearTimeout(to);
      to = setTimeout(onEnd, left * 1000);
    };
    iv = setInterval(() => {
      const left = Math.max(0, Math.ceil(total - (Date.now() - t0) / 1000));
      F.timeN.textContent = `${left}″`;
      F.root.classList.toggle('is-hurry', left <= 5);
    }, 250);
    F.timeN.textContent = `${total}″`;
    run();
    return {
      stop() {
        clearInterval(iv); clearTimeout(to);
        const left = Math.max(0, total - (Date.now() - t0) / 1000);
        F.timeBar.style.transition = 'none';
        F.timeBar.style.transform = `scaleX(${left / total})`;
        F.root.classList.remove('is-hurry');
      },
      add(sec) { total += sec; run(); },
      elapsed: () => (Date.now() - t0) / 1000,
      limit: () => total
    };
  }
  function animatePts(F, from, to) {
    if (!F.pts) return;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 600);
      F.pts.textContent = num(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function verdictSheet(q, a, f, pts, extra) {
    const scored = isScored(q);
    const ok = f === 1;
    const part = scored && f > 0 && f < 1;
    let head;
    if (!scored) head = ('<p class="sheet-verdict v-neutral"><span class="sheet-icon" aria-hidden="true">✓</span>' + __('Η απάντησή σου καταγράφηκε') + '</p>');
    else if (a === null) head = ('<p class="sheet-verdict v-bad"><span class="sheet-icon" aria-hidden="true">⏱</span>' + __('Τέλος χρόνου!') + '</p>');
    else head = `<p class="sheet-verdict ${ok ? 'v-ok' : part ? 'v-part' : 'v-bad'}"><span class="sheet-icon" aria-hidden="true">${ok ? '✓' : part ? '◐' : '✗'}</span>${ok ? pickOne(PRAISE) : part ? `${__('Σχεδόν! {0} σωστό', pct(f))}` : pickOne(NUDGE)}${pts ? `<span class="sheet-pts">+${num(pts)}</span>` : ''}</p>`;
    const correctTxt = scored && !ok ? TYPES[q.type].correct(q) : '';
    return `<div class="sheet-in">${head}
      ${extra || ''}
      ${correctTxt ? `<p class="sheet-note">${__('Σωστή απάντηση:')} <strong>${esc(correctTxt)}</strong></p>` : ''}
      ${q.explain ? `<p class="sheet-explain">${esc(q.explain)}</p>` : ''}`;
  }

  /* ---------- κλασικό, ομαδικό, κατάκτηση, τεστ ---------- */
  function selfEngine() {
    const s = S;
    const st = s.settings || {};
    const mode = s.mode;
    const qs = s.questions || [];
    const byId = {};
    qs.forEach((q) => { byId[q.id] = q; });
    const timerOn = !!st.timer && mode !== 'test';
    const feedback = st.showAnswers !== false && mode !== 'test';
    const usePowers = !!st.powerups && ['classic', 'team'].includes(mode);
    const noPoints = mode === 'test';
    const oKey = `qz:order:${sid}:${uid}`;
    let order = local.get(oKey, null);
    if (!Array.isArray(order) || order.length !== qs.length || !order.every((id) => byId[id])) {
      order = st.shuffleQ ? shuffle(qs.map((q) => q.id)) : qs.map((q) => q.id);
      local.set(oKey, order);
    }
    const mKey = `qz:mastery:${sid}:${uid}`;
    let M = null;
    if (mode === 'mastery') {
      M = local.get(mKey, null);
      if (!M || !Array.isArray(M.queue)) {
        M = { queue: order.filter((id) => !(P.answers[id] && P.answers[id].f === 1)), tries: {}, mastered: order.filter((id) => P.answers[id] && P.answers[id].f === 1) };
      }
    }
    P.powers = Array.isArray(P.powers) ? P.powers : [];
    let F = null, cur = null, ctl = null, clock = null, answered = false, mult = 1, alive = true, pendingNext = null;

    function nextId() {
      if (M) {
        while (M.queue.length && M.mastered.includes(M.queue[0])) M.queue.shift();
        return M.queue[0] || null;
      }
      return order.find((id) => !P.answers[id]) || null;
    }
    function countText() {
      if (M) return `${__('Κατακτήθηκαν {0} από', M.mastered.length)} ${qs.length}`;
      const done = order.filter((id) => P.answers[id]).length;
      return `${Math.min(done + 1, qs.length)} ${__('από')} ${qs.length}`;
    }
    function drawPowers() {
      if (!usePowers || !F) return;
      F.powers.hidden = !P.powers.length;
      F.powers.innerHTML = P.powers.map((k, i) => {
        const pw = POWERUPS[k];
        const usable = !answered && (k !== 'fifty' || (cur && cur.type === 'mcq' && cur.options.length >= 3)) && (k !== 'time' || (clock && clock.limit() > 0));
        return `<button type="button" class="pw" data-pw="${i}" ${usable ? '' : 'disabled'} title="${esc(pw.desc)}"><span class="pw-i" aria-hidden="true">${esc(pw.icon)}</span>${esc(pw.label)}</button>`;
      }).join('');
    }
    function mountain() {
      if (!M) return '';
      const total = qs.length || 1;
      const p = M.mastered.length / total;
      const goal = (st.goal || 80) / 100;
      return `<div class="mtn" aria-label="${__('Κατακτήθηκαν {0} από', M.mastered.length)} ${qs.length}">
        <svg viewBox="0 0 200 90" aria-hidden="true"><path d="M0 90 L70 20 L95 42 L125 8 L200 90 Z" fill="rgba(255,255,255,.18)"/>
        <line x1="0" x2="200" y1="${90 - goal * 82}" y2="${90 - goal * 82}" stroke="#FFC23C" stroke-dasharray="4 4" stroke-width="2"/>
        <circle cx="${20 + p * 105}" cy="${88 - p * 80}" r="6" fill="#FFC23C" stroke="#fff" stroke-width="2"/></svg>
        <span class="mtn-l">${__('Στόχος {0}%', Math.round(goal * 100))}</span></div>`;
    }
    function show() {
      if (!alive) return;
      const id = nextId();
      if (!id) { finish(); return; }
      cur = byId[id];
      answered = false;
      mult = 1;
      if (!F) F = frame({ team: mode === 'team' ? teamById(P.team) : null, noPoints });
      F.sheet.hidden = true;
      F.sheet.innerHTML = '';
      F.count.textContent = countText();
      F.body.innerHTML = '';
      const holder = document.createElement('div');
      holder.className = 'q-holder';
      F.body.appendChild(holder);
      if (M) holder.insertAdjacentHTML('beforebegin', mountain());
      ctl = TYPES[cur.type].play(holder, cur, { submit, shuffle: st.shuffleA !== false });
      clock = timer(F, timerOn ? (cur.time || 0) : 0, () => submit(null));
      drawPowers();
      F.body.scrollTop = 0;
    }
    function submit(a) {
      if (answered || !alive) return;
      answered = true;
      clock.stop();
      const q = cur;
      const elapsed = clock.elapsed();
      const f = a === null ? (isScored(q) ? 0 : null) : grade(q, a);
      const prevScore = P.score || 0;
      let tries = 1;
      if (M) { M.tries[q.id] = (M.tries[q.id] || 0) + 1; tries = M.tries[q.id]; }
      if (f !== null) {
        if (f === 1) P.streak = (P.streak || 0) + 1; else P.streak = 0;
        P.bestStreak = Math.max(P.bestStreak || 0, P.streak);
      }
      let pts = noPoints ? 0 : points(q, f, elapsed, clock.limit(), P.streak || 0, mult);
      if (M && tries > 1) pts = Math.round(pts / 2 / 10) * 10;
      const prevAns = P.answers[q.id];
      const wasFull = prevAns && prevAns.f === 1;
      P.answers[q.id] = { v: a === undefined ? null : a, f, pts: (prevAns && M ? (prevAns.pts || 0) : 0) + pts, t: Math.round(elapsed * 1000), n: tries };
      P.score = prevScore + pts;
      if (f === 1 && !wasFull) P.correct = (P.correct || 0) + 1;
      P.answered = Object.keys(P.answers).length;
      if (M) {
        M.queue.shift();
        if (f === 1 || f === null) { if (!M.mastered.includes(q.id)) M.mastered.push(q.id); }
        else if (tries < (M.limit || 3)) M.queue.splice(Math.min(2, M.queue.length), 0, q.id);
        local.set(mKey, M);
        P.mastery = { done: M.mastered.length, total: qs.length, pct: qs.length ? M.mastered.length / qs.length : 0 };
      }
      let earned = null;
      if (usePowers && f === 1 && P.streak % 3 === 0 && P.powers.length < 2) {
        earned = pickOne(Object.keys(POWERUPS));
        P.powers.push(earned);
      }
      const patch = { answers: { [q.id]: P.answers[q.id] }, score: P.score, correct: P.correct || 0, answered: P.answered, streak: P.streak || 0, bestStreak: P.bestStreak || 0, powers: P.powers };
      if (P.mastery) patch.mastery = P.mastery;
      write(patch);
      if (!noPoints) animatePts(F, prevScore, P.score);
      F.streak.hidden = !(P.streak >= 2);
      F.streak.textContent = `🔥 ${P.streak}`;
      drawPowers();
      if (feedback) {
        ctl.reveal(a, f);
        const extra = (earned ? `<p class="sheet-power">${__('Κέρδισες βοήθεια:')} <b>${esc(POWERUPS[earned].label)}</b></p>` : '') +
          (M && f !== null && f < 1 && tries < (M.limit || 3) ? ('<p class="sheet-note">' + __('Αυτή η ερώτηση θα ξαναέρθει σε λίγο.') + '</p>') : '');
        F.sheet.innerHTML = verdictSheet(q, a, f, pts, extra) +
          `<button class="btn btn-next" type="button">${nextId() ? __('Επόμενη ερώτηση') : __('Τέλος')}</button></div>`;
        F.sheet.hidden = false;
        const nb = F.sheet.querySelector('.btn-next');
        nb.addEventListener('click', () => show());
        setTimeout(() => { try { nb.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 40);
      } else {
        ctl.disable();
        F.sheet.innerHTML = ('<div class="sheet-in"><p class="sheet-verdict v-neutral"><span class="sheet-icon" aria-hidden="true">✓</span>' + __('Καταχωρήθηκε') + '</p></div>');
        F.sheet.hidden = false;
        pendingNext = setTimeout(show, 700);
      }
    }
    el.addEventListener('click', onPower);
    function onPower(e) {
      const b = e.target.closest('[data-pw]');
      if (!b || b.disabled || answered) return;
      const i = Number(b.dataset.pw);
      const k = P.powers[i];
      if (k === 'fifty' && ctl.fifty) ctl.fifty();
      if (k === 'double') { mult = 2; toast(__('Διπλοί πόντοι σε αυτή την ερώτηση!'), 'ok'); }
      if (k === 'time') clock.add(Math.max(5, Math.round((cur.time || 20) / 2)));
      P.powers.splice(i, 1);
      write({ powers: P.powers });
      drawPowers();
    }
    function finish() {
      alive = false;
      markDone();
      showEnd();
    }
    show();
    return {
      stop() {
        alive = false;
        if (clock) clock.stop();
        clearTimeout(pendingNext);
        el.removeEventListener('click', onPower);
      }
    };
  }
  function markDone() {
    if (!P.done) {
      P.done = true;
      P.doneAt = Date.now();
      write({ done: true, doneAt: P.doneAt });
    }
  }

  /* ---------- κάρτες μελέτης ---------- */
  function cardsEngine() {
    const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
    const byId = {};
    qs.forEach((q) => { byId[q.id] = q; });
    const key = `qz:cards:${sid}:${uid}`;
    let queue = local.get(key, null);
    if (!Array.isArray(queue)) {
      const all = (S.settings && S.settings.shuffleQ) ? shuffle(qs.map((q) => q.id)) : qs.map((q) => q.id);
      queue = all.filter((id) => !(P.answers[id] && P.answers[id].known));
    }
    let alive = true;
    function front(q) {
      if (q.type === 'dropdown' || q.type === 'drag') {
        return esc(q.text) + '<br>' + parseCloze(q.cloze || '').map((p) => (p.blank ? '<span class="cz-blank">…</span>' : esc(p.t))).join('');
      }
      if (q.type === 'underline') return `${esc(q.text)}<br><span class="flash-passage">${esc(String(q.passage || '').replace(/[[\]]/g, ''))}</span>`;
      return esc(q.text);
    }
    function show() {
      if (!alive) return;
      queue = queue.filter((id) => byId[id]);
      local.set(key, queue);
      const known = qs.filter((q) => P.answers[q.id] && P.answers[q.id].known).length;
      if (!queue.length) {
        markDone();
        screen = 'cards-done';
        el.innerHTML = shell(`<div class="pl-card"><p class="pl-kicker">${__('Κάρτες μελέτης')}</p><h1 class="pl-title">${__('Τις ήξερες όλες!')}</h1>
          <p class="pl-text">${known} ${__('από {0} κάρτες.', qs.length)}</p>
          <p class="end-actions"><button class="btn btn-sun btn-lg" type="button" data-again>${__('Ξανά από την αρχή')}</button> <a class="btn btn-ghost-light btn-lg" href="#/">${__('Έξοδος')}</a></p></div>`);
        el.querySelector('[data-again]').addEventListener('click', () => { queue = shuffle(qs.map((q) => q.id)); show(); });
        return;
      }
      screen = 'cards';
      const q = byId[queue[0]];
      el.innerHTML = `<div class="game"><div class="game-bar"><a class="g-btn" href="#/">${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></a>
        <span class="game-count">${__('Ήξερες {0} από {1}, απομένουν', known, qs.length)} ${queue.length}</span><span></span></div>
        <div class="game-body"><button type="button" class="flash" aria-pressed="false">
          <span class="flash-face flash-front"><span class="flash-tag">${__('Ερώτηση')}</span><span class="flash-text">${front(q)}</span>${q.image ? `<img class="q-img" src="${esc(q.image)}" alt="">` : ''}<span class="flash-hint">${__('Πάτα για να δεις την απάντηση')}</span></span>
          <span class="flash-face flash-back"><span class="flash-tag">${__('Απάντηση')}</span><span class="flash-text">${esc(TYPES[q.type].correct(q))}</span>${q.explain ? `<span class="flash-ex">${esc(q.explain)}</span>` : ''}</span>
        </button>
        <div class="flash-actions" hidden><button class="btn btn-lg btn-ghost-light" type="button" data-k="0">${__('Θέλω επανάληψη')}</button><button class="btn btn-lg btn-sun" type="button" data-k="1">${__('Το ήξερα')}</button></div></div></div>`;
      const card = el.querySelector('.flash');
      const acts = el.querySelector('.flash-actions');
      card.addEventListener('click', () => {
        const on = card.getAttribute('aria-pressed') !== 'true';
        card.setAttribute('aria-pressed', String(on));
        acts.hidden = false;
      });
      acts.addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]');
        if (!b) return;
        const knew = b.dataset.k === '1';
        const n = ((P.answers[q.id] && P.answers[q.id].n) || 0) + 1;
        P.answers[q.id] = { v: null, f: null, known: knew, n, pts: 0, t: 0 };
        queue.shift();
        if (!knew) queue.splice(Math.min(3, queue.length), 0, q.id);
        const k2 = qs.filter((x) => P.answers[x.id] && P.answers[x.id].known).length;
        P.correct = k2;
        P.answered = Object.keys(P.answers).length;
        write({ answers: { [q.id]: P.answers[q.id] }, correct: k2, answered: P.answered });
        show();
      });
    }
    show();
    return { stop() { alive = false; } };
  }

  /* ---------- παιχνίδια επανάληψης (φορτώνονται όταν χρειάζονται) ---------- */
  function gameEngine() {
    let inner = null, kitRef = null, cancelled = false;
    screen = 'game';
    el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Ετοιμάζεται το παιχνίδι…') + '</p></div>'));
    const file = { swim: 'race' }[S.mode] || S.mode;
    Promise.all([import(`./games/${file}.js`), import('./games/kit.js')]).then(([mod, kitMod]) => {
      if (cancelled || stopped) return;
      const kit = kitMod.makeKit({
        el, S, P, uid, sid, write, mode: S.mode,
        onFinish() { if (cancelled || stopped) return; inner = null; engine = null; showEnd(); }
      });
      kitRef = kit;
      if (!kit.questions.length) {
        el.innerHTML = shell(('<div class="pl-card"><h1 class="pl-title">' + __('Δεν υπάρχουν ερωτήσεις') + '</h1><p class="pl-text">' + __('Αυτό το παιχνίδι χρειάζεται ερωτήσεις με σωστή απάντηση.') + '</p><p><a class="btn btn-sun btn-lg" href="#/">' + __('Στην αρχή') + '</a></p></div>'));
        return;
      }
      inner = mod.start(kit);
    }).catch((e) => { if (!cancelled) fatal(__('Δεν φόρτωσε το παιχνίδι. Έλεγξε τη σύνδεση και ανανέωσε τη σελίδα.')); console.error(e); });
    return { stop() { cancelled = true; if (kitRef) kitRef.destroy(); if (inner && inner.stop) inner.stop(); } };
  }

  /* ---------- τέλος ---------- */
  function canRetryMastery() {
    const m = P.mastery;
    const st = (S && S.settings) || {};
    return !!m && m.pct * 100 < (st.goal || 80) && isOpen(S);
  }
  async function showEnd() {
    screen = 'end';
    const s = S;
    const mode = s.mode;
    const st = s.settings || {};
    const qs = s.questions || [];
    const scored = qs.filter(isScored);
    const review = isReview(mode);
    let players = null;
    if (st.leaderboard !== false && mode !== 'test' && mode !== 'flashcards') {
      el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Ετοιμάζονται τα αποτελέσματα…') + '</p></div>'));
      try { players = await DB.listPlayers(sid); } catch (e) { players = null; }
      if (stopped || screen !== 'end') return;
      if (players && !players.some((p) => p.uid === uid)) players.push(Object.assign({ uid }, P));
      if (players) players = players.map((p) => (p.uid === uid ? Object.assign({}, p, { score: P.score, done: P.done, result: P.result }) : p));
    }
    const board = players ? ranking(players.filter((p) => p.done || p.uid === uid || (p.answered || 0) > 0)).map((p, i) => ({ uid: p.uid, name: p.name, score: p.score || 0, rank: i + 1, result: p.result })) : [];
    const mine = board.find((b) => b.uid === uid);
    const acc = scored.length ? scored.reduce((sum, q) => sum + ((P.answers[q.id] && P.answers[q.id].f) || 0), 0) / scored.length : null;
    let teamHtml = '';
    if (mode === 'team' && Array.isArray(s.teams) && players) {
      const ts = teamStats(players, s.teams, null, qs);
      teamHtml = `<section class="end-sec"><h2 class="end-h">${__('Ομάδες')}</h2><ol class="team-board">${ts.map((t, i) => `<li class="${t.id === P.team ? 'is-me' : ''}" style="--t:${t.color}">
        <span class="tb-rank">${i + 1}</span><span class="tb-name">${t.emoji} ${esc(t.name)}<span class="tb-members">${plural(t.members.length, __('μέλος'), __('μέλη'))}</span></span><span class="tb-detail">${__('μέσος όρος {0} + μπόνους', num(t.avg))} ${num(t.bonus)}</span><b class="tb-total">${num(t.total)}</b></li>`).join('')}</ol>
        ${P.team ? `<p class="end-note">${__('Οι πόντοι της ομάδας σου ({0}) γράφονται σε όλα τα μέλη της. Η ομάδα μαζεύει πόντους όσο παίζουν τα μέλη της.', num((ts.find((t) => t.id === P.team) || {}).total || 0))}</p>` : ''}</section>`;
    }
    const answeredQs = review ? qs.filter((q) => P.answers[q.id]) : qs;
    const showReview = mode !== 'flashcards' && (mode !== 'test' || st.showResults) && answeredQs.length;
    const reviewHtml = showReview ? `<section class="end-sec review"><h2 class="end-h">${__('Οι απαντήσεις σου')}</h2><ol class="rv-list">${answeredQs.map((q) => {
      const a = P.answers[q.id];
      const t = TYPES[q.type];
      const f = a ? a.f : null;
      const cls = !t.scored ? 'rv-n' : f === 1 ? 'rv-ok' : f > 0 ? 'rv-part' : 'rv-bad';
      return `<li class="rv ${cls}"><span class="rv-mark" aria-hidden="true">${!t.scored ? '•' : f === 1 ? '✓' : f > 0 ? '◐' : '✗'}</span><div class="rv-body">
        <p class="rv-q">${esc(q.text || t.label)}</p>
        <p class="rv-a">${__('Απάντησες:')} <b>${a ? esc(t.describe(q, a.v)) : __('δεν απάντησες')}</b>${a && a.pts && !review ? ` <span class="rv-pts">+${num(a.pts)}</span>` : ''}</p>
        ${t.scored && f !== 1 ? `<p class="rv-a">${__('Σωστό:')} <b>${esc(t.correct(q))}</b></p>` : ''}${q.explain ? `<p class="rv-x">${esc(q.explain)}</p>` : ''}</div></li>`;
    }).join('')}</ol></section>` : '';
    const lb = board.length ? `<section class="end-sec"><h2 class="end-h">${__('Κατάταξη')}</h2><p class="end-note end-note-sm">${plural(board.length, __('παιδί έχει παίξει'), __('παιδιά έχουν παίξει'))} ${__('μέχρι τώρα.')}</p><ol class="board">${board.slice(0, 10).map((b) => `<li class="${b.uid === uid ? 'is-me' : ''}"><span class="b-rank">${b.rank}</span><span class="b-name">${esc(b.name)}${b.result && b.result.short ? `<span class="b-res">${esc(b.result.short)}</span>` : ''}</span><b class="b-score">${fmtScore(b.score, mode)}</b></li>`).join('')}
      ${mine && mine.rank > 10 ? `<li class="is-me b-gap"><span class="b-rank">${mine.rank}</span><span class="b-name">${esc(mine.name)}</span><b class="b-score">${fmtScore(mine.score, mode)}</b></li>` : ''}</ol></section>` : '';

    let headline;
    const expired = s.deadline && Date.now() > s.deadline;
    const closedNote = !isOpen(s) && !P.done ? `<p class="end-note">${expired ? __('Η προθεσμία έληξε.') : __('Ο εκπαιδευτικός έκλεισε το παιχνίδι.')}</p>` : '';
    const retry = mode === 'mastery' && canRetryMastery();
    const replay = review && isOpen(s);
    if (mode === 'test') headline = `<h1 class="end-title">${__('Τέλος του τεστ')}</h1>${closedNote}<p class="end-note">${__('Οι απαντήσεις σου στάλθηκαν στον εκπαιδευτικό.')}</p>${st.showResults && acc !== null ? `<p class="end-big">${pct(acc)} ${__('σωστά')}</p>` : ''}`;
    else if (mode === 'flashcards') headline = `<h1 class="end-title">${__('Τέλος μελέτης')}</h1>${closedNote}<p class="end-big">${__('Ήξερες {0} από', P.correct || 0)} ${scored.length}</p>`;
    else if (review) {
      const r = P.result || {};
      headline = `<h1 class="end-title">${esc(r.title || __('Τέλος παιχνιδιού'))}</h1>${closedNote}
        ${r.detail ? `<p class="end-note">${esc(r.detail)}</p>` : ''}
        <p class="end-score"><span class="end-score-n">${num(r.score !== undefined ? r.score : P.score || 0)}</span><span class="end-score-l">${unitOf(mode) || __('πόντοι')}${(P.plays || 0) > 1 ? ` ${__('· καλύτερο σκορ')} ${fmtScore(P.score, mode)}` : ''}</span></p>
        <dl class="end-stats"><div><dt>${__('Θέση')}</dt><dd>${mine ? `${mine.rank} / ${board.length}` : '–'}</dd></div>
        <div><dt>${__('Σωστές')}</dt><dd>${r.correct !== undefined ? r.correct : P.correct || 0}${r.asked ? ` / ${r.asked}` : ''}</dd></div>
        <div><dt>${__('Παιχνίδια')}</dt><dd>${P.plays || 1}</dd></div></dl>`;
    } else {
      const m = P.mastery;
      headline = `<h1 class="end-title">${P.done ? __('Τελείωσες!') : __('Τέλος παιχνιδιού')}</h1>${closedNote}
        <p class="end-score"><span class="end-score-n">${num(P.score || 0)}</span><span class="end-score-l">${__('πόντοι')}</span></p>
        <dl class="end-stats"><div><dt>${__('Θέση')}</dt><dd>${mine ? `${mine.rank} / ${board.length}` : '–'}</dd></div>
        <div><dt>${__('Σωστές')}</dt><dd>${P.correct || 0} / ${scored.length}</dd></div>
        <div><dt>${m ? __('Κατάκτηση') : __('Ακρίβεια')}</dt><dd>${m ? pct(m.pct) : acc === null ? '–' : pct(acc)}</dd></div></dl>
        ${m ? `<p class="end-note">${m.pct * 100 >= (st.goal || 80) ? (__('Έφτασες στην κορυφή!') + ' ⛰️') : `${__('Ο στόχος είναι {0}%. Μπορείς να ξαναδοκιμάσεις όσες δεν κατέκτησες.', st.goal || 80)}`}</p>` : ''}`;
    }
    const actions = `${retry ? ('<button class="btn btn-sun btn-lg" type="button" data-retry>' + __('Ξανά όσες δεν κατέκτησα') + '</button>') : ''}${replay ? ('<button class="btn btn-sun btn-lg" type="button" data-replay>' + __('Παίξε ξανά') + '</button>') : ''}
      <a class="btn ${retry || replay ? 'btn-ghost-light' : 'btn-sun'} btn-lg" href="#/">${__('Έξοδος')}</a>`;
    el.innerHTML = `<div class="pl pl-end"><div class="pl-in pl-wide"><div class="end-card">
      <p class="pl-me">${esc(P.name)} ${teamBadge(teamById(P.team))}</p>${headline}
      <p class="end-actions">${actions}</p>${DB.sandbox ? `<div class="end-try"><p>${__('Αυτό ήταν ένα δοκιμαστικό παιχνίδι. Θέλεις να φτιάξεις ένα με τις δικές σου ερωτήσεις;')}</p><p class="end-actions"><a class="btn btn-sun btn-lg" href="#/signup">${__('Φτιάξε δωρεάν λογαριασμό')}</a> <a class="btn btn-ghost-light btn-lg" href="#/try">${__('Δοκίμασε άλλο παιχνίδι')}</a></p></div>` : ''}</div>${teamHtml}${lb}${reviewHtml}</div></div>`;
    const rb = el.querySelector('[data-retry]');
    if (rb) rb.addEventListener('click', retryMastery);
    const pb = el.querySelector('[data-replay]');
    if (pb) pb.addEventListener('click', () => { P.done = false; screen = ''; start(); });
  }
  // Κατάκτηση: νέος γύρος με όσες ερωτήσεις δεν κατακτήθηκαν (οι επαναλήψεις παίρνουν μισούς πόντους).
  function retryMastery() {
    const key = `qz:mastery:${sid}:${uid}`;
    const M = local.get(key, null) || {};
    const mastered = Array.isArray(M.mastered) ? M.mastered : (S.questions || []).filter((q) => P.answers[q.id] && P.answers[q.id].f === 1).map((q) => q.id);
    const queue = shuffle((S.questions || []).map((q) => q.id).filter((id) => !mastered.includes(id)));
    if (!queue.length) return;
    local.set(key, { queue, tries: M.tries || {}, mastered, limit: (M.limit || 3) + 3 });
    P.done = false;
    write({ done: false });
    screen = '';
    stopEngine();
    engine = selfEngine();
  }

  ctx.setCleanup(() => { stopped = true; if (unsub) unsub(); stopEngine(); });
  boot();
}
