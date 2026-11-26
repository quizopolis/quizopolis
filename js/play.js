/* Η πλευρά του μαθητή: είσοδος από σύνδεσμο, παιχνίδι σε όλους τους τρόπους, τέλος. */
import { esc, app, setTitle, toast, num, pct, plural, norm, shuffle, local, ICON, errText, LOGO, CFG, langSwitch, exitHref } from './ui.js';
import { DB, withImages } from './store.js';
import { TYPES, grade, isScored, studyItems } from './qtypes.js';
import { points, ranking, teamStats, POWERUPS, TEAM_SET, pickTeam } from './scoring.js';
import { MODES, isReview, unitOf } from './modes.js';
import { __, LOCALE } from './i18n.js';

const PRAISE = [__('Σωστά!'), __('Μπράβο!'), __('Τέλεια!'), __('Πολύ καλά!'), __('Εύγε!')];
const NUDGE = [__('Όχι αυτή τη φορά'), __('Δεν πειράζει, συνέχισε!'), __('Την επόμενη θα το βρεις!'), __('Λάθος, αλλά μαθαίνεις!')];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const teamById = (id) => TEAM_SET.find((t) => t.id === id) || null;
const isOpen = (s) => s && s.status !== 'ended' && !(s.deadline && Date.now() > s.deadline);
export const LAST_KEY = 'qz:last';

/* Το παιχνίδι (ερωτήσεις και εικόνες) κατεβαίνει μία φορά σε κάθε επίσκεψη: η είσοδος ανοίγει τον ακροατή
   και η σελίδα του παιχνιδιού συνεχίζει με τον ίδιο. Έτσι κάθε παιδί «κατεβάζει» το παιχνίδι μία φορά αντί για δύο,
   που μετράει στο μηνιαίο όριο μεταφοράς του Firebase (σημαντικό για παιχνίδια με εικόνες).
   The game (questions and images) is downloaded once per visit: the join page opens the listener and the game page
   keeps using it, so each child downloads it once instead of twice (Firebase's free plan limits monthly transfer). */
const LIVE_GRACE = 5 * 60 * 1000;
const live = { on: false, sid: null, db: null, stop: null, has: false, value: null, subs: new Set(), timer: 0 };
const cloneData = (v) => { if (v == null) return v; try { return structuredClone(v); } catch (e) { return v; } };
function dropLive() {
  clearTimeout(live.timer);
  const stop = live.stop;
  Object.assign(live, { on: false, sid: null, db: null, stop: null, has: false, value: null, subs: new Set() });
  if (stop) { try { stop(); } catch (e) { /* ignore */ } }
}
function watchLive(sid, next, onErr) {
  if (live.on && (live.sid !== sid || live.db !== DB)) dropLive();
  clearTimeout(live.timer);
  const sub = { next, onErr };
  live.subs.add(sub);
  if (!live.on) {
    const subs = live.subs;
    Object.assign(live, { on: true, sid, db: DB, has: false, value: null });
    const stop = DB.watchSession(sid, (v) => {
      if (live.subs !== subs) return;
      live.has = true; live.value = v;
      [...subs].forEach((x) => x.next(cloneData(v)));
    }, (e) => {
      if (live.subs !== subs) return;
      const list = [...subs];
      dropLive();
      list.forEach((x) => { if (x.onErr) x.onErr(e); });
    });
    if (live.subs === subs) live.stop = stop;
    else { try { stop(); } catch (e) { /* ignore */ } }
  } else if (live.has) {
    const v = live.value;
    Promise.resolve().then(() => { if (live.subs.has(sub)) next(cloneData(v)); });
  }
  return () => {
    if (!live.subs.has(sub)) return;
    live.subs.delete(sub);
    if (!live.subs.size) { clearTimeout(live.timer); live.timer = setTimeout(dropLive, LIVE_GRACE); }
  };
}
function firstSession(sid) {
  return new Promise((resolve, reject) => {
    let release = null, settled = false;
    const done = (fn) => { if (settled) return; settled = true; Promise.resolve().then(() => { if (release) release(); }); fn(); };
    release = watchLive(sid, (v) => done(() => resolve(v)), (e) => done(() => reject(e)));
  });
}

function shell(inner, cls = '', top = false) {
  return `<div class="pl ${cls}${top ? ' pl-has-top' : ''}">${top ? `<div class="pl-top"><span class="pl-brand">${LOGO}<span>${esc(CFG.siteName)}</span></span>${langSwitch()}</div>` : ''}<div class="pl-in">${inner}</div></div>`;
}
function teamBadge(t) {
  return t ? `<span class="team-badge" style="--t:${t.color}"><span aria-hidden="true">${t.emoji}</span> ${esc(t.name)}</span>` : '';
}
const fmtScore = (n, mode) => `${num(n || 0)}${unitOf(mode) ? ` ${unitOf(mode)}` : ''}`;
/* Κάρτες μελέτης: «την ήξερε αμέσως», δηλαδή με την πρώτη φορά που τη σημείωσε. Ίδιο με το cards.js.
   Flashcards: "knew it straight away", i.e. the first time it was marked. Same as in cards.js. */
const firstTry = (a) => !!a && (a.first !== undefined ? !!a.first : !!a.known && (a.n || 1) === 1);
/* Σύντομο κείμενο μιας όψης για λίστες. / Short text of a side for lists. */
const sideText = (o) => String((o && o.text) || '').replace(/\s+/g, ' ').trim() || (o && o.image ? __('(εικόνα)') : o && o.video && o.video.url ? __('(βίντεο)') : '');
const cardTexts = (q) => {
  if (q.type === 'card') return { front: sideText(q), back: sideText(q.back) };
  const t = TYPES[q.type];
  return { front: String(q.text || '').trim() || (t ? t.label : ''), back: t ? String(t.correct(q) || '') : '' };
};

/* Ο παίκτης που μόλις γράφτηκε περνά κατευθείαν στο παιχνίδι, χωρίς νέα ανάγνωση.
   The player who just joined goes straight into the game, without another read. */
let handoff = null;

/* Οι εικόνες του συνδέσμου (χωριστό έγγραφο) κατεβαίνουν μία φορά, όσο το παιδί γράφει το όνομά του.
   The link's pictures (a separate document) download once, while the child types their name. */
const media = new Map();
function imagesFor(s) {
  if (!s || !s.media || !DB.getMedia) return Promise.resolve(null);
  const key = s.id;
  if (!media.has(key)) {
    const p = DB.getMedia(s.id);
    media.set(key, p);
    p.catch(() => { if (media.get(key) === p) media.delete(key); });
  }
  return media.get(key);
}

/* ================= ΕΙΣΟΔΟΣ ΑΠΟ ΣΥΝΔΕΣΜΟ ================= */
export async function viewJoin(sid, ctx) {
  setTitle(__('Παιχνίδι'));
  const el = app();
  el.className = 'v-play';
  el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Φορτώνει το παιχνίδι…') + '</p></div>'), '', true);
  const card = el.querySelector('.pl-card');
  // Τα παιδιά δεν πηγαίνουν στην αρχική σελίδα: σε σφάλμα μόνο «Δοκίμασε ξανά».
  // Children never go to the home page: on an error only "Try again".
  const fail = (title, text, retry) => {
    card.innerHTML = `<h1 class="pl-title">${esc(title)}</h1><p class="pl-text">${esc(text)}</p>${retry ? `<p><button class="btn btn-sun btn-lg" type="button" data-reload>${__('Δοκίμασε ξανά')}</button></p>` : ''}`;
    const r = card.querySelector('[data-reload]');
    if (r) r.addEventListener('click', () => location.reload());
  };
  let uid, s, mineP, playersP;
  try {
    uid = await DB.ensureStudent();
    // Το παιχνίδι, ο παίκτης και η λίστα των παικτών έρχονται μαζί, όχι το ένα μετά το άλλο.
    // The game, the player and the player list arrive together, not one after another.
    mineP = DB.getPlayer(sid, uid).catch(() => null);
    playersP = mineP.then((m) => (m && m.name ? [] : DB.listPlayers(sid).catch(() => [])));
    s = await firstSession(sid);
    imagesFor(s).catch(() => {});
    // Οι κάρτες μελέτης κατεβαίνουν όσο το παιδί γράφει το όνομά του. / Flashcards download while the child types their name.
    if (s && s.mode === 'flashcards') import('./cards.js').catch(() => {});
  } catch (e) { fail(__('Δεν άνοιξε το παιχνίδι'), errText(e), true); return; }
  if (!s) {
    if (DB.mode === 'demo') fail(__('Ο σύνδεσμος δεν υπάρχει σε αυτόν τον browser'), __('Η πλατφόρμα λειτουργεί δοκιμαστικά: κάθε σύνδεσμος ανοίγει μόνο στον browser όπου φτιάχτηκε. Για να παίζουν τα παιδιά από τις συσκευές τους, ο εκπαιδευτικός πρέπει να τη συνδέσει με τη δωρεάν βάση Firebase.'));
    else fail(__('Ο σύνδεσμος δεν υπάρχει'), __('Ίσως τον διέγραψε ο εκπαιδευτικός. Ζήτησε νέο σύνδεσμο.'));
    return;
  }
  if (s.kicked && s.kicked[uid]) { fail(__('Δεν μπορείς να μπεις σε αυτό το παιχνίδι'), __('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.')); return; }
  const mine = await mineP;
  if (mine && mine.name) { ctx.go('/play/' + sid, true); return; }
  if (s.status === 'ended') { fail(__('Ο σύνδεσμος έκλεισε'), __('Ο εκπαιδευτικός έκλεισε αυτό το παιχνίδι. Ρώτησέ τον για νέο σύνδεσμο.')); return; }
  if (s.deadline && Date.now() > s.deadline) { fail(__('Η προθεσμία έληξε'), __('Αυτό το παιχνίδι δεν δέχεται πια απαντήσεις.')); return; }

  const players = await playersP;
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
    ${s.own ? `<p class="pl-own">${__('Δοκιμή: δεν αποθηκεύεται τίποτα και δεν φαίνεται στα αποτελέσματα.')}</p>` : ''}
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
      handoff = { sid, uid, db: DB, player: await DB.joinSession(sid, uid, body) };
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
export function viewPlay(sid, ctx, opts = {}) {
  const el = app();
  el.className = 'v-play';
  el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Φορτώνει…') + '</p></div>'));
  let uid = null, P = null, S = null, engine = null, unsub = null, stopped = false, screen = '';

  // «Ξαναπαίξε» στο κουίζ: ο νέος γύρος μένει στη συσκευή και γράφεται μία φορά στο τέλος, μόνο αν είναι καλύτερος.
  // "Play again" in a quiz: the new round stays on the device and is written once at the end, only if it is better.
  let round = null;
  const write = (patch) => (round ? Promise.resolve() : DB.updatePlayer(sid, uid, patch).catch((e) => {
    if (e.code === 'ended' || e.code === 'kicked') return;
    toast(errText(e), 'error');
  }));
  const stopEngine = () => { if (engine) { try { engine.stop(); } catch (e) { /* ignore */ } engine = null; } };

  async function boot() {
    try {
      uid = await DB.ensureStudent();
      const h = handoff;
      handoff = null;
      P = h && h.sid === sid && h.uid === uid && h.db === DB ? Object.assign({}, h.player) : await DB.getPlayer(sid, uid);
    } catch (e) { fatal(errText(e)); return; }
    if (!P || !P.name) { ctx.go('/g/' + sid, true); return; }
    P.answers = P.answers || {};
    unsub = watchLive(sid, onSession, (e) => toast(errText(e), 'error'));
  }
  function fatal(text) {
    el.innerHTML = shell(`<div class="pl-card"><h1 class="pl-title">${__('Κάτι δεν πήγε καλά')}</h1><p class="pl-text">${esc(text)}</p><p><button class="btn btn-sun btn-lg" type="button" data-reload>${__('Δοκίμασε ξανά')}</button></p></div>`);
    el.querySelector('[data-reload]').addEventListener('click', () => location.reload());
  }
  async function onSession(s0) {
    if (stopped) return;
    if (!s0) { stopEngine(); fatal(__('Ο εκπαιδευτικός διέγραψε αυτό το παιχνίδι.')); return; }
    let s = s0;
    if (s0.media) {
      try { s = withImages(s0, await imagesFor(s0)); } catch (e) {
        if (!stopped) fatal(__('Δεν φόρτωσαν οι εικόνες του παιχνιδιού. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'));
        return;
      }
      if (stopped) return;
    }
    const first = !S;
    S = s;
    setTitle(s.title);
    if (s.kicked && s.kicked[uid]) {
      stopEngine();
      screen = 'kicked';
      el.innerHTML = shell(('<div class="pl-card"><h1 class="pl-title">' + __('Βγήκες από το παιχνίδι') + '</h1><p class="pl-text">' + __('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.') + '</p></div>'));
      return;
    }
    if (!isOpen(s)) { if (screen !== 'end') { stopEngine(); showEnd(); } return; }
    if (screen === 'end') return;
    if (first || !engine) start();
  }
  function start() {
    stopEngine();
    stopBoard();
    if (opts.board || (P.done && S.mode !== 'flashcards')) { showEnd(); return; }
    if (S.mode === 'flashcards') engine = cardsEngine();
    else if (isReview(S.mode)) engine = gameEngine();
    else engine = selfEngine();
  }

  /* ---------- κοινό πλαίσιο ερώτησης ---------- */
  function frame(opts) {
    screen = 'q';
    el.innerHTML = `<div class="game" style="${opts.team ? `--t:${opts.team.color}` : ''}">
      <div class="game-bar">
        <a class="g-btn" href="${exitHref(S)}" aria-label="${__('Έξοδος')}">${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></a>
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
    if (round) { closeRound(); return; }
    if (!P.done) {
      P.done = true;
      P.doneAt = Date.now();
      write({ done: true, doneAt: P.doneAt });
    }
  }

  function playAgain() {
    opts.board = false;
    stopBoard();
    if (isReview(S.mode)) { P.done = false; screen = ''; start(); return; }
    // Κουίζ: φυλάμε την καλύτερη προσπάθεια και ξεκινάμε από την αρχή, με νέα σειρά ερωτήσεων.
    // Quiz: keep the best attempt and start over, with a new question order.
    round = { best: { answers: P.answers, score: P.score || 0, correct: P.correct || 0, answered: P.answered || 0, streak: P.streak || 0, bestStreak: P.bestStreak || 0, powers: P.powers || [], plays: P.plays || 1, doneAt: P.doneAt } };
    Object.assign(P, { answers: {}, score: 0, correct: 0, answered: 0, streak: 0, powers: [], done: false, lastRound: null });
    local.set(`qz:order:${sid}:${uid}`, null);
    screen = '';
    start();
  }
  function closeRound() {
    const best = round.best;
    round = null;
    const plays = (best.plays || 1) + 1;
    const R = { score: P.score || 0, correct: P.correct || 0, answers: P.answers };
    if (R.score > best.score || (R.score === best.score && R.correct > best.correct)) {
      Object.assign(P, { plays, done: true, doneAt: best.doneAt || Date.now(), bestStreak: Math.max(P.bestStreak || 0, best.bestStreak) });
      write({ answers: P.answers, score: P.score, correct: P.correct, answered: P.answered, streak: P.streak || 0, bestStreak: P.bestStreak, powers: P.powers || [], plays, done: true });
    } else {
      Object.assign(P, best, { plays, done: true });
      write({ plays });
    }
    P.lastRound = R;
  }

  /* ---------- κάρτες μελέτης (φορτώνονται μόνο όταν χρειάζονται, από το cards.js) ----------
     Flashcards (loaded only when needed, from cards.js) */
  function cardsEngine() {
    let inner = null, cancelled = false;
    screen = 'cards';
    el.innerHTML = shell(('<div class="pl-card"><p class="pl-loading"><span class="spinner" aria-hidden="true"></span> ' + __('Ετοιμάζονται οι κάρτες…') + '</p></div>'));
    import('./cards.js').then((mod) => {
      if (cancelled || stopped) return;
      inner = mod.startCards({
        el, S, P, sid, uid, exit: exitHref(S), write, markDone,
        onEnd() { if (cancelled || stopped) return; cancelled = true; engine = null; showEnd(); },
        empty() {
          el.innerHTML = shell(`<div class="pl-card"><h1 class="pl-title">${__('Δεν υπάρχουν κάρτες')}</h1><p class="pl-text">${__('Αυτό το παιχνίδι δεν έχει ακόμη κάρτες για μελέτη.')}</p>${DB.sandbox ? `<p><a class="btn btn-sun btn-lg" href="${exitHref(S)}">${__('Πίσω')}</a></p>` : ''}</div>`);
        }
      });
    }).catch((e) => { if (!cancelled) fatal(__('Δεν φόρτωσαν οι κάρτες. Έλεγξε τη σύνδεση και ανανέωσε τη σελίδα.')); console.error(e); });
    return { stop() { cancelled = true; if (inner && inner.stop) inner.stop(); } };
  }
  /* «Μελέτησε ξανά»: νέος γύρος με όλες τις κάρτες ή μόνο με όσες χρειάστηκαν επανάληψη.
     "Study again": a new round with every card or only those that needed repetition. */
  async function studyAgain(ids) {
    if (!ids.length) return;
    try {
      const mod = await import('./cards.js');
      mod.newRound(sid, uid, ids, !S.settings || S.settings.shuffleQ !== false);
    } catch (e) { toast(__('Δεν φόρτωσαν οι κάρτες. Έλεγξε τη σύνδεση και ανανέωσε τη σελίδα.'), 'error'); return; }
    if (stopped) return;
    opts.board = false;
    stopBoard();
    screen = '';
    start();
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
        el.innerHTML = shell(('<div class="pl-card"><h1 class="pl-title">' + __('Δεν υπάρχουν ερωτήσεις') + '</h1><p class="pl-text">' + __('Αυτό το παιχνίδι χρειάζεται ερωτήσεις με σωστή απάντηση.') + '</p>' + (DB.sandbox ? `<p><a class="btn btn-sun btn-lg" href="${exitHref(S)}">${__('Πίσω')}</a></p>` : '') + '</div>'));
        return;
      }
      inner = mod.start(kit);
    }).catch((e) => { if (!cancelled) fatal(__('Δεν φόρτωσε το παιχνίδι. Έλεγξε τη σύνδεση και ανανέωσε τη σελίδα.')); console.error(e); });
    return { stop() { cancelled = true; if (kitRef) kitRef.destroy(); if (inner && inner.stop) inner.stop(); } };
  }

  let boardOff = null;
  const stopBoard = () => { if (boardOff) { try { boardOff(); } catch (e) { /* ignore */ } boardOff = null; } };
  function canRetryMastery() {
    const m = P.mastery;
    const st = (S && S.settings) || {};
    return !!m && m.pct * 100 < (st.goal || 80) && isOpen(S);
  }
  /* ---------- τέλος ----------
     Τα παιδιά μένουν εδώ στο τέλος, και όταν πατήσουν «Έξοδος» στη μέση του παιχνιδιού: το αποτέλεσμά τους
     και η κατάταξη της τάξης, που ενημερώνεται όσο τελειώνουν και οι υπόλοιποι. Ποτέ η αρχική σελίδα.
     Children stay here at the end, and when they press "Exit" mid-game: their result and the class ranking,
     which updates as the others finish. Never the home page. */
  function showEnd() {
    screen = 'end';
    stopBoard();
    const s = S;
    const mode = s.mode;
    const st = s.settings || {};
    const qs = s.questions || [];
    const scored = qs.filter(isScored);
    const review = isReview(mode);

    const withBoard = st.leaderboard !== false && mode !== 'flashcards' && (mode !== 'test' || st.showResults !== false);
    const kid = !DB.sandbox; // όχι δοκιμή του εκπαιδευτικού ή του επισκέπτη / not a teacher's or visitor's test
    const R = P.lastRound || null; // ο γύρος που μόλις παίχτηκε, αν ήταν «Ξαναπαίξε» / the round just played, after "Play again"
    const ans = R ? R.answers : P.answers;
    // Κάρτες μελέτης: ο γύρος αυτής της συσκευής (ή, αν λείπει, οι πρώτες σημειώσεις του παιδιού).
    // Flashcards: this device's round (or, without one, the child's first marks).
    const flash = mode === 'flashcards';
    let cards = null;
    if (flash) {
      const items = studyItems(qs);
      const byId = new Map(items.map((q) => [q.id, q]));
      const R0 = local.get(`qz:cards:${sid}:${uid}`, null);
      const round = R0 && R0.v === 2 && Array.isArray(R0.queue) && Array.isArray(R0.known) ? R0 : null;
      const learned = items.filter((q) => ans[q.id] && ans[q.id].known).length;
      if (round) {
        const missed = (round.missed || []).filter((id) => byId.has(id));
        const total = Math.min(items.length, Math.max(round.total || 0, round.queue.length + round.known.length)) || items.length;
        cards = { items, total, learned: round.known.filter((id) => byId.has(id)).length, missed, quick: round.known.filter((id) => byId.has(id) && !missed.includes(id)).length, done: !round.queue.length };
      } else {
        const missed = items.filter((q) => ans[q.id] && !firstTry(ans[q.id])).map((q) => q.id);
        cards = { items, total: items.length, learned, missed, quick: items.filter((q) => firstTry(ans[q.id])).length, done: !!P.done };
      }
    }
    // Βγήκε στη μέση και μπορεί να συνεχίσει. Στις κάρτες μετράει ο γύρος, γιατί μπορεί να μελετά ξανά.
    // Left mid-game and may continue. For flashcards the round counts, since they may be studying again.
    const paused = !!opts.board && isOpen(s) && (flash ? !cards.done : !P.done);
    const acc = scored.length ? scored.reduce((sum, q) => sum + ((ans[q.id] && ans[q.id].f) || 0), 0) / scored.length : null;

    let finished = null; // όσοι τελείωσαν, από τη βάση / finished players, from the database
    const everyone = () => {
      const list = (finished || []).filter((p) => p.uid !== uid);
      if (P.done) list.push(Object.assign({}, P, { uid }));
      return list;
    };
    const rows = () => ranking(everyone()).map((p, i) => ({ uid: p.uid, name: p.name, score: p.score || 0, correct: p.correct || 0, rank: i + 1, result: p.result }));
    // Το τεστ δεν έχει πόντους: η κατάταξη δείχνει τις σωστές. / A test has no points: the ranking shows correct answers.
    const value = (b) => (mode === 'test' ? `${b.correct}/${scored.length}` : fmtScore(b.score, mode));
    const rankText = (list) => { const me = list.find((b) => b.uid === uid); return me ? `${me.rank} / ${list.length}` : '–'; };
    const row = (b, gap) => `<li class="${b.uid === uid ? 'is-me' : ''}${gap ? ' b-gap' : ''}"><span class="b-rank">${b.rank}</span><span class="b-name">${esc(b.name)}${b.result && b.result.short ? `<span class="b-res">${esc(b.result.short)}</span>` : ''}</span><b class="b-score">${value(b)}</b></li>`;
    const boardInner = (list) => {
      if (finished === null) return `<p class="end-note end-note-sm"><span class="spinner" aria-hidden="true"></span> ${__('Φορτώνει η κατάταξη…')}</p>`;
      if (!list.length) return `<p class="end-note end-note-sm">${__('Δεν έχει τελειώσει ακόμη κανείς.')}</p>`;
      const me = list.find((b) => b.uid === uid);
      return `<ol class="board">${list.slice(0, 10).map((b) => row(b)).join('')}${me && me.rank > 10 ? row(me, true) : ''}</ol>`;
    };
    const teams = mode === 'team' && Array.isArray(s.teams) && withBoard;
    const teamInner = () => {
      const ts = teamStats(everyone(), s.teams, null, qs);
      return `<ol class="team-board">${ts.map((t, i) => `<li class="${t.id === P.team ? 'is-me' : ''}" style="--t:${t.color}">
        <span class="tb-rank">${i + 1}</span><span class="tb-name">${t.emoji} ${esc(t.name)}<span class="tb-members">${plural(t.members.length, __('μέλος'), __('μέλη'))}</span></span><span class="tb-detail">${__('μέσος όρος {0} + μπόνους', num(t.avg))} ${num(t.bonus)}</span><b class="tb-total">${num(t.total)}</b></li>`).join('')}</ol>
        ${P.team ? `<p class="end-note">${__('Οι πόντοι της ομάδας σου ({0}) γράφονται σε όλα τα μέλη της. Η ομάδα μαζεύει πόντους όσο παίζουν τα μέλη της.', num((ts.find((t) => t.id === P.team) || {}).total || 0))}${isOpen(s) ? ` ${__('Μετράνε όσα μέλη έχουν τελειώσει.')}` : ''}</p>` : ''}`;
    };

    const answeredQs = review ? qs.filter((q) => ans[q.id]) : qs;
    const showReview = !paused && !flash && (mode !== 'test' || st.showResults) && answeredQs.length;
    const reviewHtml = showReview ? `<section class="end-sec review"><h2 class="end-h">${__('Οι απαντήσεις σου')}</h2><ol class="rv-list">${answeredQs.map((q) => {
      const a = ans[q.id];
      const t = TYPES[q.type];
      const f = a ? a.f : null;
      const cls = !t.scored ? 'rv-n' : f === 1 ? 'rv-ok' : f > 0 ? 'rv-part' : 'rv-bad';
      return `<li class="rv ${cls}"><span class="rv-mark" aria-hidden="true">${!t.scored ? '•' : f === 1 ? '✓' : f > 0 ? '◐' : '✗'}</span><div class="rv-body">
        <p class="rv-q">${esc(q.text || t.label)}</p>
        <p class="rv-a">${__('Απάντησες:')} <b>${a ? esc(t.describe(q, a.v)) : __('δεν απάντησες')}</b>${a && a.pts && !review ? ` <span class="rv-pts">+${num(a.pts)}</span>` : ''}</p>
        ${t.scored && f !== 1 ? `<p class="rv-a">${__('Σωστό:')} <b>${esc(t.correct(q))}</b></p>` : ''}${q.explain ? `<p class="rv-x">${esc(q.explain)}</p>` : ''}</div></li>`;
    }).join('')}</ol></section>` : '';
    // Οι κάρτες που χρειάστηκαν επανάληψη, για να τις ξαναδεί. / The cards that needed repetition, to look at again.
    const missedQs = flash && !paused ? cards.missed.map((id) => cards.items.find((q) => q.id === id)).filter(Boolean) : [];
    const cardsHtml = missedQs.length ? `<section class="end-sec review"><h2 class="end-h">${__('Αυτές θέλουν λίγη ακόμη μελέτη')}</h2><ol class="rv-list fc-missed">${missedQs.map((q) => {
      const t = cardTexts(q);
      return `<li class="rv rv-part"><span class="rv-mark" aria-hidden="true">↻</span><div class="rv-body"><p class="rv-q">${esc(t.front)}</p>${t.back ? `<p class="rv-a">${esc(t.back)}</p>` : ''}</div></li>`;
    }).join('')}</ol></section>` : '';

    let headline;
    const expired = s.deadline && Date.now() > s.deadline;
    const closedNote = !isOpen(s) && !P.done ? `<p class="end-note">${expired ? __('Η προθεσμία έληξε.') : __('Ο εκπαιδευτικός έκλεισε το παιχνίδι.')}</p>` : '';
    const retry = !paused && mode === 'mastery' && canRetryMastery();
    const replay = !paused && P.done && isOpen(s) && (review || mode === 'classic' || mode === 'team');
    const again = !paused && flash && isOpen(s);
    const againMissed = again && cards.done && cards.missed.length > 0 && cards.missed.length < cards.items.length;
    const rankDd = `<dd data-rank>${withBoard ? '…' : '–'}</dd>`;
    if (paused) {
      headline = `<h1 class="end-title">${__('Σταμάτησες εδώ')}</h1>
        <p class="end-note">${flash ? __('Όσα σημείωσες είναι αποθηκευμένα. Μπορείς να συνεχίσεις από εκεί που έμεινες.') : __('Οι απαντήσεις σου είναι αποθηκευμένες. Μπορείς να συνεχίσεις από εκεί που έμεινες.')}</p>
        ${flash ? `<p class="end-big">${__('Έμαθες {0} από {1}', cards.learned, cards.total)}</p>` : mode === 'test' ? '' : `<p class="end-score"><span class="end-score-n">${num(P.score || 0)}</span><span class="end-score-l">${unitOf(mode) || __('πόντοι')}</span></p>`}`;
    } else if (mode === 'test') headline = `<h1 class="end-title">${__('Τέλος του τεστ')}</h1>${closedNote}<p class="end-note">${__('Οι απαντήσεις σου στάλθηκαν στον εκπαιδευτικό.')}</p>${st.showResults && acc !== null ? `<p class="end-big">${pct(acc)} ${__('σωστά')}</p>` : ''}`;
    else if (flash) {
      const n = cards.missed.length;
      headline = `<h1 class="end-title">${cards.done ? __('Έμαθες όλες τις κάρτες!') : __('Τέλος μελέτης')}</h1>${closedNote}
        <p class="end-big">${__('Ήξερες αμέσως {0} από {1}', cards.quick, cards.total)}</p>
        <p class="end-note">${!n ? (cards.done ? __('Τις ήξερες όλες με την πρώτη!') : '') : n === 1 ? __('Μία κάρτα τη θυμήθηκες μετά από επανάληψη.') : __('{0} κάρτες τις θυμήθηκες μετά από επανάληψη.', n)}</p>`;
    }
    else if (review) {
      const r = P.result || {};
      headline = `<h1 class="end-title">${esc(r.title || __('Τέλος παιχνιδιού'))}</h1>${closedNote}
        ${r.detail ? `<p class="end-note">${esc(r.detail)}</p>` : ''}
        <p class="end-score"><span class="end-score-n">${num(r.score !== undefined ? r.score : P.score || 0)}</span><span class="end-score-l">${unitOf(mode) || __('πόντοι')}${(P.plays || 0) > 1 ? ` ${__('· καλύτερο σκορ')} ${fmtScore(P.score, mode)}` : ''}</span></p>
        <dl class="end-stats"><div><dt>${__('Θέση')}</dt>${rankDd}</div>
        <div><dt>${__('Σωστές')}</dt><dd>${r.correct !== undefined ? r.correct : P.correct || 0}${r.asked ? ` / ${r.asked}` : ''}</dd></div>
        <div><dt>${__('Παιχνίδια')}</dt><dd>${P.plays || 1}</dd></div></dl>`;
    } else {
      const m = P.mastery;
      headline = `<h1 class="end-title">${P.done ? __('Τελείωσες!') : __('Τέλος παιχνιδιού')}</h1>${closedNote}
        <p class="end-score"><span class="end-score-n">${num(R ? R.score : P.score || 0)}</span><span class="end-score-l">${__('πόντοι')}${(P.plays || 1) > 1 ? ` ${__('· καλύτερο σκορ')} ${fmtScore(P.score, mode)}` : ''}</span></p>
        <dl class="end-stats"><div><dt>${__('Θέση')}</dt>${rankDd}</div>
        <div><dt>${__('Σωστές')}</dt><dd>${R ? R.correct : P.correct || 0} / ${scored.length}</dd></div>
        <div><dt>${m ? __('Κατάκτηση') : __('Ακρίβεια')}</dt><dd>${m ? pct(m.pct) : acc === null ? '–' : pct(acc)}</dd></div></dl>
        ${m ? `<p class="end-note">${m.pct * 100 >= (st.goal || 80) ? (__('Έφτασες στην κορυφή!') + ' ⛰️') : `${__('Ο στόχος είναι {0}%. Μπορείς να ξαναδοκιμάσεις όσες δεν κατέκτησες.', st.goal || 80)}`}</p>` : ''}`;
    }
    // Τα παιδιά δεν έχουν «Έξοδο»: εδώ είναι το τέλος. Μόνο ο εκπαιδευτικός (δοκιμή) γυρίζει πίσω.
    // Children get no "Exit": this is the end. Only the teacher (test play) goes back.
    const main = paused ? 'data-continue' : retry ? 'data-retry' : replay ? 'data-replay' : again ? 'data-again' : '';
    const againBtns = !again ? '' : againMissed
      ? `<button class="btn btn-sun btn-lg" type="button" data-again="missed">${__('Ξανά όσες δεν ήξερα')}</button><button class="btn btn-ghost-light btn-lg" type="button" data-again="all">${__('Όλες από την αρχή')}</button>`
      : `<button class="btn btn-sun btn-lg" type="button" data-again="all">${__('Μελέτησε ξανά')}</button>`;
    const actions = `${paused ? `<button class="btn btn-sun btn-lg" type="button" data-continue>${flash ? __('Συνέχισε τη μελέτη') : __('Συνέχισε το παιχνίδι')}</button>` : ''}${retry ? ('<button class="btn btn-sun btn-lg" type="button" data-retry>' + __('Ξανά όσες δεν κατέκτησα') + '</button>') : ''}${replay ? ('<button class="btn btn-sun btn-lg" type="button" data-replay>' + __('Ξαναπαίξε') + '</button>') : ''}${againBtns}
      ${kid ? '' : `<a class="btn ${main ? 'btn-ghost-light' : 'btn-sun'} btn-lg" href="${exitHref(s)}">${s.own ? __('Πίσω') : __('Έξοδος')}</a>`}`;
    el.innerHTML = `<div class="pl pl-end"><div class="pl-in pl-wide"><div class="end-card">
      <p class="pl-me">${esc(P.name)} ${teamBadge(teamById(P.team))}</p>${headline}
      ${actions.trim() ? `<p class="end-actions">${actions}</p>` : ''}${DB.sandbox && s.own ? `<div class="end-try"><p>${__('Αυτή ήταν δοκιμή: δεν αποθηκεύτηκε τίποτα και δεν φαίνεται στα αποτελέσματα.')}</p></div>` : DB.sandbox ? `<div class="end-try"><p>${__('Αυτό ήταν ένα δοκιμαστικό παιχνίδι. Θέλεις να φτιάξεις ένα με τις δικές σου ερωτήσεις;')}</p><p class="end-actions"><a class="btn btn-sun btn-lg" href="#/signup">${__('Φτιάξε δωρεάν λογαριασμό')}</a> <a class="btn btn-ghost-light btn-lg" href="#/try">${__('Δοκίμασε άλλο παιχνίδι')}</a></p></div>` : ''}</div>
      ${teams ? `<section class="end-sec"><h2 class="end-h">${__('Ομάδες')}</h2><div data-team></div></section>` : ''}
      ${withBoard ? `<section class="end-sec end-board" aria-live="polite"><h2 class="end-h">${isOpen(s) ? __('Κατάταξη') : __('Τελική κατάταξη')}</h2><div data-board>${boardInner([])}</div></section>` : ''}
      ${reviewHtml}${cardsHtml}</div></div>`;
    const paint = () => {
      if (stopped || screen !== 'end') return;
      const list = rows();
      const b = el.querySelector('[data-board]');
      if (b) b.innerHTML = boardInner(list);
      const r = el.querySelector('[data-rank]');
      if (r && finished !== null) r.textContent = rankText(list);
      const t = el.querySelector('[data-team]');
      if (t && finished !== null) t.innerHTML = teamInner();
    };
    if (withBoard) boardOff = DB.watchFinished(sid, (ps) => { finished = ps; paint(); }, () => { if (finished === null) { finished = []; paint(); } });
    const rb = el.querySelector('[data-retry]');
    if (rb) rb.addEventListener('click', retryMastery);
    const pb = el.querySelector('[data-replay]');
    if (pb) pb.addEventListener('click', playAgain);
    const cb = el.querySelector('[data-continue]');
    if (cb) cb.addEventListener('click', () => ctx.go('/play/' + sid));
    el.querySelectorAll('[data-again]').forEach((b) => b.addEventListener('click', () => {
      studyAgain(b.dataset.again === 'missed' ? cards.missed.slice() : cards.items.map((q) => q.id));
    }));
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

  ctx.setCleanup(() => { stopped = true; if (unsub) unsub(); stopEngine(); stopBoard(); });
  boot();
}
