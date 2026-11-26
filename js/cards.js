/*
  Κάρτες μελέτης: πώς φαίνεται μια κάρτα (κείμενο, εικόνα, βίντεο) και η μελέτη από τα παιδιά.
  Φορτώνεται μόνο για τις κάρτες, όχι στα υπόλοιπα παιχνίδια.
  Flashcards: how a card looks (text, image, video) and how children study them.
  Loaded only for flashcards, not for the other games.
*/
import { esc, shuffle, local, ICON } from './ui.js';
import { TYPES, parseCloze, videoInfo, videoSrc, studyItems } from './qtypes.js';
import { __ } from './i18n.js';

/* Μικρογραφία βίντεο που δεν φόρτωσε (π.χ. χωρίς σύνδεση): φεύγει, μένει το σκούρο πλαίσιο με το «Παίξε».
   A video thumbnail that failed to load (e.g. offline): it goes, the dark frame with "Play" stays. */
if (typeof document !== 'undefined') {
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('fc-thumb')) t.remove();
  }, true);
}

export const FLIP_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 3.5V8h4.5M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20.5V16h-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const AGAIN_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- μια κάρτα / one card ---------- */

/* Οι δύο όψεις μιας κάρτας. Στους παλιούς συνδέσμους (ερωτήσεις κουίζ) η ερώτηση είναι μπροστά και η σωστή απάντηση πίσω.
   A card's two sides. In old links (quiz questions) the question is on the front and the right answer on the back. */
export function sidesOf(q) {
  if (q.type === 'card') {
    const b = q.back || {};
    return {
      front: { text: q.text || '', image: q.image || '', video: q.video || null },
      back: { text: b.text || '', image: b.image || '', video: b.video || null }
    };
  }
  const t = TYPES[q.type];
  let front = esc(q.text);
  if (q.type === 'dropdown' || q.type === 'drag') front += '<br>' + parseCloze(q.cloze || '').map((p) => (p.blank ? '<span class="cz-blank">…</span>' : esc(p.t))).join('');
  if (q.type === 'underline') front += `<br><span class="flash-passage">${esc(String(q.passage || '').replace(/[[\]]/g, ''))}</span>`;
  return {
    front: { html: `<p class="fc-text fc-t2">${front}</p>${t.face ? t.face(q) : q.image ? `<img class="fc-img" src="${esc(q.image)}" alt="">` : ''}` },
    back: { html: `${t.back ? t.back(q) : `<p class="fc-text fc-t1">${esc(t.correct(q))}</p>`}${q.explain ? `<p class="fc-note">${esc(q.explain)}</p>` : ''}` }
  };
}

/* Σύντομο κείμενο για λίστες: το κείμενο της όψης ή τι έχει. / Short text for lists: the side's text or what it holds. */
export function sideLabel(s) {
  const t = String((s && s.text) || '').replace(/\s+/g, ' ').trim();
  if (t) return t;
  if (s && s.image) return __('(εικόνα)');
  if (s && s.video && s.video.url) return __('(βίντεο)');
  return '';
}

/* Σύντομα κείμενα μιας κάρτας για λίστες και αναφορές (και για τις παλιές κάρτες από ερωτήσεις).
   Short texts of a card for lists and reports (also for old cards made of questions). */
export function cardFront(q) {
  if (q.type === 'card') return sideLabel(sidesOf(q).front) || __('(κενή)');
  return String(q.text || '').replace(/\s+/g, ' ').trim() || (TYPES[q.type] ? TYPES[q.type].label : '');
}
export function cardBack(q) {
  if (q.type === 'card') return sideLabel(sidesOf(q).back);
  return TYPES[q.type] ? String(TYPES[q.type].correct(q) || '') : '';
}

// Όσο μεγαλύτερο το κείμενο, τόσο μικρότερα τα γράμματα. / The longer the text, the smaller the letters.
const sizeOf = (text, media) => {
  const n = text.length;
  return 'fc-t' + Math.min(3, (n <= 24 ? 0 : n <= 70 ? 1 : n <= 180 ? 2 : 3) + (media ? 1 : 0));
};

export function videoHtml(v) {
  const info = v && videoInfo(v.url);
  if (!info) return `<p class="fc-vid-bad">${__('Το βίντεο δεν ανοίγει: ο σύνδεσμος δεν αναγνωρίστηκε.')}</p>`;
  const src = videoSrc(info, v);
  if (info.kind === 'file') return `<div class="fc-vid"><video controls playsinline preload="metadata" src="${esc(src)}"></video></div>`;
  const thumb = info.kind === 'youtube' ? `<img class="fc-thumb" src="https://i.ytimg.com/vi/${esc(info.id)}/hqdefault.jpg" alt="" loading="lazy">` : '';
  return `<div class="fc-vid${thumb ? '' : ' is-plain'}"><button type="button" class="fc-play" data-video="${esc(src)}">${thumb}<span class="fc-play-i" aria-hidden="true">${ICON.play}</span><span class="fc-play-t">${__('Παίξε το βίντεο')}${info.name ? ` <small>${esc(info.name)}</small>` : ''}</span></button></div>`;
}

export function sideHtml(s) {
  if (s.html) return `<div class="fc-content">${s.html}</div>`;
  const text = String(s.text || '').trim();
  const vid = s.video && s.video.url ? s.video : null;
  const media = !!(s.image || vid);
  return `<div class="fc-content">${text ? `<p class="fc-text ${sizeOf(text, media)}">${esc(text)}</p>` : ''}${s.image ? `<img class="fc-img${text || vid ? '' : ' is-only'}" src="${esc(s.image)}" alt="">` : ''}${vid ? videoHtml(vid) : ''}</div>`;
}

/* Το βίντεο φορτώνει μόνο όταν το πατήσουν: η κάρτα ανοίγει γρήγορα και δεν παίζει τίποτα κρυφά.
   The video loads only when pressed: the card opens fast and nothing plays in the background. */
export function playVideo(btn) {
  const box = btn.closest('.fc-vid');
  if (!box) return;
  box.classList.add('is-on');
  box.innerHTML = `<iframe src="${esc(btn.dataset.video)}" title="${__('Βίντεο')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

/* ---------- γύροι μελέτης / study rounds ----------
   Ο γύρος μένει στη συσκευή: ποιες κάρτες περιμένουν (queue), ποιες έμαθε (known) και ποιες χρειάστηκαν επανάληψη (missed).
   The round stays on the device: which cards are waiting (queue), which were learned (known) and which needed repetition (missed). */
export const roundKey = (sid, uid) => `qz:cards:${sid}:${uid}`;
export function newRound(sid, uid, ids, mix) {
  const R = { v: 2, queue: mix ? shuffle(ids) : ids.slice(), known: [], missed: [], total: ids.length };
  local.set(roundKey(sid, uid), R);
  return R;
}
export function roundOf(sid, uid) {
  const R = local.get(roundKey(sid, uid), null);
  return R && R.v === 2 && Array.isArray(R.queue) ? R : null;
}

/* Η πρώτη φορά που σημείωσε την κάρτα μετράει για την αναφορά («την ήξερε αμέσως»).
   The first mark of a card counts for the report ("knew it straight away"). */
export function firstTry(a) {
  if (!a) return null;
  if (a.first !== undefined) return !!a.first;
  return !!a.known && (a.n || 1) === 1;
}

/* ---------- η μελέτη / studying ----------
   env = { el, S, P, sid, uid, exit, write(patch), markDone(), onEnd(), empty() } */
export function startCards(env) {
  const { el, S, P } = env;
  const items = studyItems(S.questions);
  if (!items.length) { env.empty(); return { stop() {} }; }
  const byId = new Map(items.map((q) => [q.id, q]));
  const st = S.settings || {};
  const mix = st.shuffleQ !== false;
  const startSide = st.backFirst ? 'back' : 'front';
  const key = roundKey(env.sid, env.uid);
  const R = load();
  if (!R || !R.queue.length) {
    if (R) env.markDone();
    env.onEnd();
    return { stop() {} };
  }
  // flipping: η κάρτα γυρίζει· moving: φεύγει για την επόμενη. turn: ποιο γύρισμα τρέχει, για να σταματά όταν σημειώσουν.
  // flipping: the card is turning; moving: it leaves for the next one. turn: which turn is running, so marking can stop it.
  let alive = true, flipping = false, moving = false, flipAnim = null, turn = 0, q = null, side = startSide, flipped = false, shownAt = 0;

  function load() {
    const saved = local.get(key, null);
    const ids = items.map((x) => x.id);
    if (saved && saved.v === 2 && Array.isArray(saved.queue)) {
      const queue = saved.queue.filter((id) => byId.has(id));
      const known = (saved.known || []).filter((id) => byId.has(id) && !queue.includes(id));
      const missed = (saved.missed || []).filter((id) => byId.has(id));
      return { v: 2, queue, known, missed, total: Math.max(saved.total || 0, queue.length + known.length) };
    }
    if (Array.isArray(saved)) { // η παλιά μορφή: μόνο η ουρά / the old format: just the queue
      const queue = saved.filter((id) => byId.has(id));
      return { v: 2, queue, known: ids.filter((id) => !queue.includes(id)), missed: [], total: ids.length };
    }
    if (P.done) return null; // τελείωσε ήδη, ίσως σε άλλη συσκευή / already finished, maybe on another device
    // Πρώτη φορά ή άλλη συσκευή: όσες ήξερε ήδη μετράνε. / First time or another device: cards already known count.
    const known = ids.filter((id) => P.answers[id] && P.answers[id].known);
    const rest = ids.filter((id) => !known.includes(id));
    const missed = ids.filter((id) => P.answers[id] && !firstTry(P.answers[id]));
    return { v: 2, queue: mix ? shuffle(rest) : rest, known, missed, total: ids.length };
  }

  el.innerHTML = `<div class="game fc-game">
    <div class="game-bar"><a class="g-btn" href="${esc(env.exit)}">${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></a>
      <span class="game-count" data-count></span><span class="fc-bar-end" aria-hidden="true"></span></div>
    <div class="fc-prog" aria-hidden="true"><i data-bar></i></div>
    <div class="game-body fc-body">
      <div class="fc-stage"><section class="fc-card" data-card aria-labelledby="fc-tag"><p class="fc-tag" id="fc-tag" data-tag></p><div class="fc-face" data-face aria-live="polite"></div></section></div>
      <div class="fc-acts" data-acts></div>
    </div></div>`;
  const card = el.querySelector('[data-card]');
  const face = el.querySelector('[data-face]');
  const tag = el.querySelector('[data-tag]');
  const acts = el.querySelector('[data-acts]');

  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const anim = (frames, ms, fill) => {
    if (reduce() || !card.animate) return null;
    try { return card.animate(frames, { duration: ms, easing: 'ease-in-out', fill: fill || 'none' }); } catch (e) { return null; }
  };
  const done = (a) => (a ? a.finished.catch(() => {}) : Promise.resolve());

  function paintCount() {
    el.querySelector('[data-count]').textContent = __('Έμαθες {0} από {1}', R.known.length, R.total);
    el.querySelector('[data-bar]').style.width = `${Math.round((R.known.length / Math.max(1, R.total)) * 100)}%`;
  }
  function paintFace() {
    face.innerHTML = sideHtml(sidesOf(q)[side]);
    card.classList.toggle('is-back', side === 'back');
    tag.textContent = side === 'front' ? __('Μπροστά') : __('Πίσω');
  }
  function paintActs() {
    acts.innerHTML = flipped
      ? `<div class="fc-judge"><button type="button" class="btn btn-lg btn-ghost-light" data-mark="0">${AGAIN_ICON}<span>${__('Θέλω επανάληψη')}</span></button><button type="button" class="btn btn-lg btn-sun" data-mark="1">${ICON.check}<span>${__('Το ήξερα')}</span></button></div>
        <button type="button" class="btn btn-sm btn-ghost fc-again" data-flip>${FLIP_ICON}<span>${__('Γύρισε ξανά την κάρτα')}</span></button>`
      : `<button type="button" class="btn btn-lg btn-sun fc-flip" data-flip>${FLIP_ICON}<span>${__('Γύρισε την κάρτα')}</span></button><p class="fc-hint">${__('Ή πάτα πάνω στην κάρτα.')}</p>`;
  }
  function show() {
    q = byId.get(R.queue[0]);
    side = startSide;
    flipped = false;
    shownAt = Date.now();
    paintCount();
    paintFace();
    paintActs();
  }
  async function flip() {
    if (flipping || moving || !alive) return;
    flipping = true;
    const my = ++turn;
    flipAnim = anim([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }], 140, 'forwards');
    await done(flipAnim);
    if (!alive || my !== turn) return;
    side = side === 'front' ? 'back' : 'front';
    const first = !flipped;
    const had = acts.contains(document.activeElement);
    flipped = true;
    paintFace();
    if (first) {
      paintActs();
      if (had) acts.querySelector('[data-flip]').focus({ preventScroll: true });
    }
    const out = flipAnim;
    flipAnim = anim([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }], 170);
    if (out) out.cancel();
    await done(flipAnim);
    if (my !== turn) return;
    flipAnim = null;
    flipping = false;
  }
  /* Σημείωσαν πριν τελειώσει το γύρισμα: σταματά εκεί, χωρίς να χαθεί το πάτημα.
     They marked before the turn ended: it stops there, and the tap is not lost. */
  function stopFlip() {
    if (!flipping) return;
    turn++;
    if (flipAnim) { try { flipAnim.cancel(); } catch (e) { /* ignore */ } }
    flipAnim = null;
    flipping = false;
  }
  async function mark(knew) {
    if (moving || !alive || !flipped) return;
    stopFlip();
    moving = true;
    const id = q.id;
    const prev = P.answers[id];
    const first = prev ? firstTry(prev) : knew;
    const dt = Math.max(0, Math.min(300000, Date.now() - shownAt));
    P.answers[id] = { v: null, f: null, known: knew, first, n: ((prev && prev.n) || 0) + 1, pts: 0, t: ((prev && prev.t) || 0) + dt };
    R.queue.shift();
    if (knew) { if (!R.known.includes(id)) R.known.push(id); }
    else {
      if (!R.missed.includes(id)) R.missed.push(id);
      R.queue.splice(Math.min(3, R.queue.length), 0, id); // ξανάρχεται μετά από 3 κάρτες / comes back after 3 cards
    }
    local.set(key, R);
    P.correct = items.filter((x) => P.answers[x.id] && P.answers[x.id].known).length;
    P.answered = items.filter((x) => P.answers[x.id]).length;
    env.write({ answers: { [id]: P.answers[id] }, correct: P.correct, answered: P.answered });
    if (!R.queue.length) {
      paintCount();
      finish();
      return;
    }
    const dir = knew ? 1 : -1;
    const out = anim([{ transform: 'none', opacity: 1 }, { transform: `translateX(${dir * 56}px) rotate(${dir * 4}deg)`, opacity: 0 }], 170, 'forwards');
    await done(out);
    if (!alive) return;
    const had = acts.contains(document.activeElement);
    show();
    moving = false; // η νέα κάρτα γυρίζει αμέσως, ακόμη κι όσο μπαίνει / the new card can turn at once, even while it slides in
    if (had) acts.querySelector('[data-flip]').focus({ preventScroll: true });
    anim([{ transform: `translateX(${-dir * 28}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], 190);
    if (out) out.cancel();
  }

  card.addEventListener('click', (e) => {
    const v = e.target.closest('[data-video]');
    if (v) { playVideo(v); return; }
    if (e.target.closest('a, button, iframe, video')) return;
    flip();
  });
  acts.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-flip')) flip();
    else if (b.dataset.mark) mark(b.dataset.mark === '1');
  });
  // Πληκτρολόγιο: Κενό για γύρισμα, ← επανάληψη, → το ήξερα. / Keyboard: Space flips, ← again, → knew it.
  const onKey = (e) => {
    if (!alive || e.altKey || e.ctrlKey || e.metaKey || document.querySelector('.dlg-wrap')) return;
    const tagName = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(tagName)) return;
    if ((e.key === ' ' || e.key === 'Enter') && !/^(BUTTON|A)$/.test(tagName)) { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' && flipped) { e.preventDefault(); mark(true); }
    else if (e.key === 'ArrowLeft' && flipped) { e.preventDefault(); mark(false); }
  };
  function finish() {
    alive = false;
    document.removeEventListener('keydown', onKey);
    env.markDone();
    env.onEnd();
  }
  document.addEventListener('keydown', onKey);
  show();
  return { stop() { alive = false; document.removeEventListener('keydown', onKey); } };
}
