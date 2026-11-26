/* Επεξεργαστής παιχνιδιού: στοιχεία, ερωτήσεις όλων των ειδών, εικόνες, προεπισκόπηση, εισαγωγή από κείμενο. */
import { esc, app, setTitle, toast, dialog, plural, ICON, errText, confirmDanger, busy, norm, rid, local, GRADES, SUBJECTS, COVERS, EMOJIS } from './ui.js';
import { DB } from './store.js';
import { TYPES, TYPE_ORDER, newQuestion, validateQuestion, tidyQuestion, grade, isScored } from './qtypes.js';
import { startDialog } from './teacher.js';
import { __, LANG } from './i18n.js';
import { choiceOf, readiness, pickDialog, NEED, usesQuizExtras } from './choose.js';
import { playOwn, playProblem } from './playown.js';
import { gameIcon, tint } from './gicons.js';
import { readImage, PHOTO, BIG, CARD, CARD_MIN } from './images.js';
import { isDeck } from './modes.js';
import { cardForm, bindCardForm, sideOf, cardEmpty, railTexts, cardPreview, textImportDialog, quizImportDialog, cardsFromQuestions } from './deckedit.js';

const TIMES = [0, 10, 20, 30, 45, 60, 90, 120, 180, 300];
const timeLabel = (s) => (!s ? __('Χωρίς όριο χρόνου') : s < 60 ? __('{0} δευτερόλεπτα', s) : s === 90 ? __('1,5 λεπτό') : s === 60 ? __('1 λεπτό') : __('{0} λεπτά', s / 60));
const LIMIT = 900000; // λίγο κάτω από το όριο του 1 MB ανά έγγραφο στο Firestore
const MAX_Q = 100;

/* ---------- εικόνες: σμίκρυνση στον browser και αποθήκευση μέσα στο παιχνίδι ---------- */
// Οι εικόνες συμπιέζονται στο images.js· το readImage μένει διαθέσιμο κι από εδώ.
// Images are compressed in images.js; readImage stays available from here too.
export { readImage };

/* ---------- εισαγωγή ερωτήσεων από απλό κείμενο ---------- */
export function parseQuestionText(src) {
  const blocks = String(src || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const out = [], errors = [];
  const tfWord = (s) => { const n = norm(s); return ['σωστο', 'σ', 'true', 'right', 'yes', 'ναι'].includes(n) ? true : ['λαθοσ', 'λ', 'false', 'wrong', 'no', 'οχι'].includes(n) ? false : null; };
  let category = '';
  blocks.forEach((lines) => {
    while (lines.length && /^#/.test(lines[0])) category = lines.shift().replace(/^#+\s*/, '').trim().slice(0, 40);
    if (!lines.length) return;
    const text = lines[0].replace(/^\d{1,3}\s*[.)]\s*/, '');
    const short = text.length > 40 ? text.slice(0, 40) + '…' : text;
    const opts = lines.slice(1).map((l) => {
      const star = /^\*/.test(l);
      const t = l.replace(/^\*\s*/, '').replace(/^(?:[-–•]|[α-ωa-z]\)|\d{1,2}\))\s*/i, '').trim();
      return { t, star };
    }).filter((o) => o.t);
    const id = 'q' + rid(8);
    if (!opts.length) { errors.push(`${__('«{0}»: δεν έχει απαντήσεις από κάτω.', short)}`); return; }
    if (opts.length === 1 && /^=/.test(opts[0].t)) {
      const answers = opts[0].t.replace(/^=\s*/, '').split('|').map((s) => s.trim()).filter(Boolean);
      if (!answers.length) { errors.push(`${__('«{0}»: γράψε την απάντηση μετά το', short)} =.`); return; }
      out.push(Object.assign(newQuestion('fill', id), { text, answers }, category ? { category } : {}));
      return;
    }
    if (opts.length === 2 && opts.every((o) => tfWord(o.t) !== null)) {
      const right = opts.find((o) => o.star);
      if (!right) { errors.push(`${__('«{0}»: βάλε * μπροστά στο Σωστό ή στο Λάθος.', short)}`); return; }
      out.push(Object.assign(newQuestion('tf', id), { text, correct: tfWord(right.t) }, category ? { category } : {}));
      return;
    }
    if (opts.length < 2) { errors.push(`${__('«{0}»: χρειάζεται τουλάχιστον δύο απαντήσεις.', short)}`); return; }
    if (opts.length > 6) { errors.push(`${__('«{0}»: έχει πάνω από 6 απαντήσεις.', short)}`); return; }
    const stars = opts.map((o, k) => (o.star ? k : -1)).filter((k) => k >= 0);
    if (!stars.length) { errors.push(`${__('«{0}»: βάλε * μπροστά στη σωστή απάντηση.', short)}`); return; }
    if (stars.length === 1) out.push(Object.assign(newQuestion('mcq', id), { text, options: opts.map((o) => o.t), correct: stars[0] }, category ? { category } : {}));
    else out.push(Object.assign(newQuestion('multi', id), { text, options: opts.map((o) => o.t), correct: stars }, category ? { category } : {}));
  });
  return { questions: out, errors };
}

/* Προεπισκόπηση μιας ερώτησης όπως τη βλέπει ο μαθητής. */
export function previewQuestion(q0) {
  const q = tidyQuestion(JSON.parse(JSON.stringify(q0)));
  dialog({
    title: __('Προεπισκόπηση'), wide: true,
    html: '<div class="pv"><div class="pv-stage"><div class="q-holder"></div></div><div class="pv-out" aria-live="polite"></div></div>',
    actions: [{ label: __('Ξανά'), value: 'again' }, { label: __('Κλείσιμο'), value: null, kind: 'primary' }],
    onOpen(dlg) {
      const holder = dlg.querySelector('.q-holder');
      const out = dlg.querySelector('.pv-out');
      let ctl = null, done = false;
      const mount = () => {
        done = false;
        out.textContent = '';
        ctl = TYPES[q.type].play(holder, q, {
          shuffle: true,
          submit(a) {
            if (done) return;
            done = true;
            const f = grade(q, a);
            ctl.reveal(a, f);
            out.innerHTML = !isScored(q) ? ('<p class="pv-v">' + __('Η απάντηση καταγράφεται (δεν βαθμολογείται).') + '</p>')
              : `<p class="pv-v ${f === 1 ? 'is-ok' : f > 0 ? 'is-part' : 'is-bad'}">${f === 1 ? __('✓ Σωστό') : f > 0 ? `${__('◐ {0}% σωστό', Math.round(f * 100))}` : __('✗ Λάθος')}</p>${f === 1 ? '' : `<p>${__('Σωστή απάντηση:')} <b>${esc(TYPES[q.type].correct(q))}</b></p>`}`;
          }
        });
      };
      mount();
      dlg.querySelector('.dlg-actions [data-i="0"]').addEventListener('click', (e) => { e.stopPropagation(); mount(); }, true);
    }
  });
}

/* Ο επεξεργαστής: μία ερώτηση κάθε φορά.
   Αριστερά το παιχνίδι και η λίστα των ερωτήσεων, στη μέση η ερώτηση όπως θα τη δουν τα παιδιά,
   δεξιά λίγες ρυθμίσεις. Όλα αποθηκεύονται μόνα τους.
   The editor: one question at a time. Left: the game and the question list; middle: the question as children
   will see it; right: a few settings. Everything saves itself. */
export function viewEditor(id, ctx, choice) {
  setTitle(id ? __('Επεξεργασία παιχνιδιού') : __('Νέο παιχνίδι'));
  const el = app();
  el.className = 'v-editor';
  el.innerHTML = '<div class="ed2"><p class="muted ed-loading">' + __('Φορτώνει…') + '</p></div>';
  const root = el.querySelector('.ed2');
  let G = null, cur = null, tried = false, alive = true;
  /* αυτόματη αποθήκευση: ver μετρά τις αλλαγές, savedVer την τελευταία που αποθηκεύτηκε */
  let ver = 0, savedVer = 0, saving = null, timer = null, saveErr = null;
  const dirty = () => ver !== savedVer;
  const worth = () => !!(G && (G.id || String(G.title || '').trim() || G.questions.some((q) => String(q.text || '').trim() || q.image || (q.type === 'card' && !cardEmpty(q)))));
  /* Τράπουλα: οι κάρτες μελέτης είναι ξεχωριστό παιχνίδι με δικές του κάρτες. / Deck: flashcards are a separate game with their own cards. */
  let deck = false;
  const noun = (n) => (deck ? plural(n, __('κάρτα'), __('κάρτες')) : plural(n, __('ερώτηση'), __('ερωτήσεις')));
  const qById = (qid) => (G ? G.questions.find((x) => x.id === qid) : null);
  const qOf = (node) => { const box = node.closest('[data-q]'); return box ? qById(box.dataset.q) : null; };

  function setStatus(kind, text, title) {
    const st = root.querySelector('[data-status]');
    if (!st) return;
    st.className = 'ed-status is-' + kind;
    st.title = title || '';
    st.innerHTML = (kind === 'saved' ? ICON.check : '') + `<span>${esc(text)}</span>` + (kind === 'error' ? ` <button type="button" class="link-btn" data-retry-save>${__('Ξαναδοκίμασε')}</button>` : '');
  }
  const markDirty = () => {
    ver++;
    saveErr = null;
    if (worth()) setStatus('saving', __('Αποθηκεύεται…'));
    clearTimeout(timer);
    timer = setTimeout(() => { save(); }, 1200);
    sizeMeter();
    drawReady();
    drawSub();
    const q = qById(cur);
    if (q) {
      const tx = root.querySelector(`[data-goto="${cur}"] .qi-tx`);
      if (tx) { tx.textContent = railText(q); tx.classList.toggle('is-empty', deck ? !railTexts(q).front : !String(q.text || '').trim()); }
      const bk = deck && root.querySelector(`[data-goto="${cur}"] .qi-bk`);
      if (bk) { const r = railTexts(q); bk.textContent = r.back || __('(κενή πίσω όψη)'); bk.classList.toggle('is-empty', !r.back); }
    }
    if (tried) showErrors(false);
  };

  async function save() {
    clearTimeout(timer);
    timer = null;
    if (!G || !dirty() || !worth()) return true;
    if (saving) { try { await saving; } catch (e) { /* το χειρίζεται η προηγούμενη */ } return save(); }
    const v = ver;
    const body = JSON.parse(JSON.stringify(G));
    body.questions.forEach(tidyQuestion);
    body.title = String(body.title || '').trim();
    body.incomplete = body.questions.filter((q) => validateQuestion(q).length).length;
    if (JSON.stringify(body).length > LIMIT) {
      saveErr = deck ? __('Οι εικόνες πιάνουν πολύ χώρο. Αφαίρεσε κάποιες εικόνες ή χώρισε τις κάρτες σε δύο παιχνίδια.') : __('Οι εικόνες πιάνουν πολύ χώρο. Αφαίρεσε κάποιες εικόνες ή χώρισε τις ερωτήσεις σε δύο παιχνίδια.');
      setStatus('error', __('Δεν αποθηκεύτηκε: πολύ μεγάλο'), saveErr);
      return false;
    }
    setStatus('saving', __('Αποθηκεύεται…'));
    saving = DB.saveGame(body);
    try {
      const newId = await saving;
      if (!G.id) {
        G.id = newId;
        id = newId;
        if (alive) ctx.replace('/t/edit/' + newId);
      }
      savedVer = Math.max(savedVer, v);
      if (dirty()) { clearTimeout(timer); timer = setTimeout(() => { save(); }, 500); }
      else setStatus('saved', __('Αποθηκεύτηκε'));
      return true;
    } catch (er) {
      saveErr = errText(er);
      if (alive) setStatus('error', __('Δεν αποθηκεύτηκε'), saveErr);
      else toast(`${__('Οι τελευταίες αλλαγές δεν αποθηκεύτηκαν:')} ${saveErr}`, 'error');
      return false;
    } finally {
      saving = null;
    }
  }
  /* Φεύγοντας: αν υπάρχουν αλλαγές, αποθηκεύονται αμέσως. Ρωτάμε μόνο αν η αποθήκευση απέτυχε. */
  ctx.setGuard(() => {
    if (!dirty() || !worth()) return false;
    if (saveErr) return true;
    save();
    return false;
  });
  const onUnload = (e) => { if (G && dirty() && worth()) { save(); e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onUnload);

  (async () => {
    await null; // πρώτα να οριστούν όλα τα παρακάτω (render, railText κ.λπ.), μετά η πρώτη σχεδίαση
    if (id) {
      try { G = await DB.getGame(id); } catch (e) { root.innerHTML = `<div class="ed-msg"><div class="banner banner-bad">${esc(errText(e))}</div></div>`; return; }
      if (!G) { root.innerHTML = ('<div class="ed-msg"><div class="empty"><p class="empty-t">' + __('Το παιχνίδι δεν βρέθηκε.') + '</p><p><a class="btn btn-line" href="#/t">' + __('Στα παιχνίδια μου') + '</a></p></div></div>'); return; }
      G.questions = G.questions || [];
    } else {
      const first = choice === 'label' ? 'label' : '';
      if (first) choice = 'classic';
      if (choice !== 'free' && !choiceOf(choice)) { ctx.go('/t/new', true); return; }
      const c = choiceOf(choice);
      G = { title: '', description: '', grades: [], subject: '', mode: c ? c.id : '', cover: { color: COVERS[Math.floor(Math.random() * COVERS.length)], emoji: first ? '🏷️' : '🧠' }, questions: [] };
      if (first) G.questions.push(newQuestion(first, 'q' + rid(8)));
    }
    if (!alive) return;
    G.cover = G.cover || { color: COVERS[0], emoji: '🧠' };
    if (!id && G.mode === 'flashcards') G.cover.emoji = '🃏';
    deck = isDeck(G);
    cur = G.questions.length ? G.questions[0].id : null;
    render();
    // Παλιό παιχνίδι «Κάρτες μελέτης» με ερωτήσεις κουίζ. / An old "Flashcards" game with quiz questions.
    if (G.mode === 'flashcards' && !deck) oldCards();
  })();

  /* ---------- σελίδα ---------- */
  function render() {
    const c = G.cover;
    const ch = choiceOf(G.mode);
    root.innerHTML = `
      <header class="ed-top">
        <a class="icon-btn ed-back" href="#/t" title="${__('Τα παιχνίδια μου')}" aria-label="${__('Πίσω στα παιχνίδια μου')}">${ICON.back}</a>
        <button type="button" class="ed-cover" data-cover style="background:${tint(c.color, 0.16)}" title="${__('Εξώφυλλο')}" aria-label="${__('Εξώφυλλο: αλλαγή χρώματος και εικονιδίου')}"><span aria-hidden="true">${esc(c.emoji)}</span></button>
        <div class="ed-tt"><label class="sr" for="g-title">${__('Τίτλος παιχνιδιού')}</label><input class="ed-title" id="g-title" maxlength="90" placeholder="${__('Τίτλος παιχνιδιού')}" value="${esc(G.title)}" data-g="title" autocomplete="off"><small class="ed-sub" data-sub></small></div>
        <span class="ed-status" data-status aria-live="polite"></span>
        <button type="button" class="btn btn-line ed-pv" data-act="preview" title="${deck ? __('Δες την κάρτα όπως θα τη δουν τα παιδιά') : __('Δες την ερώτηση όπως θα τη δουν τα παιδιά')}">${ICON.eye}<span>${__('Προεπισκόπηση')}</span></button>
        <button type="button" class="btn btn-line ed-play" data-playnow ${ch && ch.stage ? 'hidden' : ''} title="${__('Παίξε όλο το παιχνίδι όπως τα παιδιά, για δοκιμή ή με όλη την τάξη στην οθόνη. Δεν αποθηκεύεται τίποτα.')}">${ICON.play}<span>${__('Παίξε')}</span></button>
        <button type="button" class="btn btn-primary ed-go" data-saveplay>${ch && ch.stage ? ICON.screen + '<span>' + __('Στον προβολέα') + '</span>' : ICON.send + '<span>' + __('Στείλε στην τάξη') + '</span>'}</button>
      </header>
      <div class="ed-body">
        <aside class="ed-rail">
          <section class="ed-game" data-game aria-label="${__('Παιχνίδι')}"></section>
          <div class="rail-h"><span>${deck ? __('Κάρτες') : __('Ερωτήσεις')}</span><span data-qcount></span></div>
          <ol class="ql${deck ? ' ql-cards' : ''}" data-ql aria-label="${deck ? __('Κάρτες') : __('Ερωτήσεις')}"></ol>
          <button type="button" class="addq" data-addq>${ICON.plus}<span>${deck ? __('Νέα κάρτα') : __('Νέα ερώτηση')}</span></button>
          <button type="button" class="btn btn-ghost btn-sm ed-imp" data-import>${ICON.upload}${__('Εισαγωγή από κείμενο')}</button>
          ${deck ? `<button type="button" class="btn btn-ghost btn-sm ed-imp" data-quizimp>${ICON.copy}${__('Κάρτες από κουίζ')}</button>` : ''}
        </aside>
        <section class="ed-canvas" data-canvas></section>
        <aside class="ed-panel" data-panel></aside>
      </div><datalist id="ed-cats"></datalist>`;
    drawGame();
    drawRail();
    drawCanvas();
    drawPanel();
    drawSub();
    if (G.id) setStatus('saved', __('Αποθηκεύτηκε'));
    else setStatus('idle', __('Νέο παιχνίδι'));
    if (!G.id && !G.title) setTimeout(() => { const t = root.querySelector('#g-title'); if (t) t.focus(); }, 30);
  }
  function drawSub() {
    const s = root.querySelector('[data-sub]');
    if (!s) return;
    const bits = [];
    if (G.subject) bits.push(__(G.subject));
    if ((G.grades || []).length) bits.push(G.grades.map((x) => __(x)).join(' '));
    bits.push(noun(G.questions.length));
    s.textContent = bits.join(', ');
  }
  function typeGrid() {
    const ch = choiceOf(G.mode);
    return `<div class="type-grid">${TYPE_ORDER.map((t) => {
      const off = ch && ch.needsAnswers && !TYPES[t].scored;
      return `<button type="button" class="type-b${off ? ' is-off' : ''}" data-add="${t}"><span class="type-i" aria-hidden="true">${TYPES[t].icon}</span><span class="type-l">${esc(TYPES[t].label)}</span><span class="type-d">${esc(off ? __('Δεν μπαίνει σε αυτό το παιχνίδι, αλλά παίζει στα κουίζ.') : TYPES[t].desc)}</span></button>`;
    }).join('')}</div>`;
  }

  /* ---------- το παιχνίδι ---------- */
  function drawGame() {
    const box = root.querySelector('[data-game]');
    if (!box) return;
    const ch = choiceOf(G.mode);
    if (!ch) {
      box.className = 'ed-game is-free';
      box.innerHTML = `${gameIcon('', { size: 40 })}<span class="ed-game-t"><b>${__('Χωρίς παιχνίδι ακόμη')}</b><small>${__('Το διαλέγεις τώρα ή όταν στείλεις τις ερωτήσεις στην τάξη.')}</small></span>
        <button type="button" class="btn btn-sm btn-soft" data-change-game>${__('Διάλεξε')}</button>`;
      return;
    }
    box.className = 'ed-game' + (ch.stage ? ' is-stage' : '');
    box.innerHTML = `${gameIcon(G.mode, { size: 40 })}<span class="ed-game-t"><b>${esc(ch.label)}</b><small>${esc(deck ? __('Κάθε κάρτα έχει δύο όψεις') : ch.kicker)}</small></span>
      ${deck ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-change-game>${__('Αλλαγή')}</button>`}`;
  }
  function drawReady() {
    const box = root.querySelector('[data-ready]');
    if (!box) return;
    const ch = choiceOf(G.mode);
    const r = readiness(G.mode, G.questions);
    let head, text;
    if (deck) {
      const n = G.questions.filter((q) => !validateQuestion(q).length).length;
      head = n ? __('Έτοιμο για μελέτη') : __('Δεν είναι ακόμη έτοιμο');
      text = n ? plural(n, __('κάρτα έτοιμη'), __('κάρτες έτοιμες')) + (n < G.questions.length ? ` ${__('από {0}.', G.questions.length)}` : '.')
        : G.questions.length ? __('Συμπλήρωσε και τις δύο όψεις της κάρτας.') : __('Πρόσθεσε την πρώτη κάρτα.');
      box.className = 'ready' + (n ? ' is-ok' : '');
      box.innerHTML = `<b>${n ? ICON.check : ''}${esc(head)}</b><span>${esc(text)}</span>${ch && ch.tip ? `<small>${esc(ch.tip)}</small>` : ''}`;
      return;
    }
    if (r.ok) {
      head = __('Έτοιμο για παιχνίδι');
      text = r.scored ? __('{0} ερωτήσεις με σωστή απάντηση. Χρειάζονται τουλάχιστον {1}.', r.n, r.need) : plural(r.n, __('ερώτηση έτοιμη'), __('ερωτήσεις έτοιμες')) + '.';
    } else {
      head = __('Δεν είναι ακόμη έτοιμο');
      text = r.scored ? __('Έτοιμες: {0} από τις {1} ερωτήσεις με σωστή απάντηση που χρειάζονται.', r.n, r.need)
        : G.questions.length ? __('Συμπλήρωσε την ερώτηση για να είναι έτοιμη.') : __('Πρόσθεσε την πρώτη ερώτηση.');
    }
    box.className = 'ready' + (r.ok ? ' is-ok' : '');
    box.innerHTML = `<b>${r.ok ? ICON.check : ''}${esc(head)}</b><span>${esc(text)}</span>${ch && ch.tip ? `<small>${esc(ch.tip)}</small>` : ''}`;
  }
  function applyGame(v) {
    G.mode = v;
    markDirty();
    drawGame();
    drawReady();
    const go = root.querySelector('[data-saveplay]');
    const ch = choiceOf(v);
    go.innerHTML = ch && ch.stage ? ICON.screen + '<span>' + __('Στον προβολέα') + '</span>' : ICON.send + '<span>' + __('Στείλε στην τάξη') + '</span>';
    const pl = root.querySelector('[data-playnow]');
    if (pl) pl.hidden = !!(ch && ch.stage);
    // Χρόνος και διπλοί πόντοι φαίνονται μόνο όπου μετράνε: ξανασχεδιάζονται η ερώτηση και οι ρυθμίσεις.
    drawCanvas();
    drawPanel();
  }
  async function changeGame() {
    const v = await pickDialog(G.mode);
    if (!v || v === G.mode) return;
    if (v === 'flashcards' && !deck) { cardsInstead(); return; }
    applyGame(v);
    const t = root.querySelector('[data-change-game]');
    if (t) t.focus();
  }
  /* Οι κάρτες μελέτης είναι ξεχωριστό παιχνίδι. Χωρίς ερωτήσεις, αυτό εδώ γίνεται τράπουλα·
     με ερωτήσεις, φτιάχνεται νέα τράπουλα από αυτές και το κουίζ μένει όπως είναι.
     Flashcards are a separate game. With no questions, this one becomes a deck;
     with questions, a new deck is made from them and the quiz stays as it is. */
  async function cardsInstead() {
    const filled = G.questions.filter((q) => String(q.text || '').trim() || q.image || !validateQuestion(q).length);
    if (!filled.length) {
      G.mode = 'flashcards';
      G.questions = [];
      if (G.cover && G.cover.emoji === '🧠') G.cover.emoji = '🃏';
      deck = true;
      cur = null;
      markDirty();
      render();
      return;
    }
    const v = await dialog({
      title: __('Κάρτες από αυτές τις ερωτήσεις;'),
      text: __('Οι κάρτες μελέτης είναι ξεχωριστό παιχνίδι: κάθε κάρτα έχει μπροστινή και πίσω όψη, με κείμενο, εικόνα ή βίντεο. Μπορώ να φτιάξω νέες κάρτες από αυτές τις ερωτήσεις: μπροστά η ερώτηση, πίσω η σωστή απάντηση. Το κουίζ σου μένει όπως είναι.'),
      actions: [{ label: __('Άκυρο'), value: null }, { label: __('Φτιάξε κάρτες'), value: 'make', kind: 'primary' }]
    });
    if (v === 'make') makeDeck(false);
  }
  /* Νέα τράπουλα από τις ερωτήσεις αυτού του παιχνιδιού. old: παλιό παιχνίδι «Κάρτες μελέτης» που γίνεται κουίζ.
     A new deck from this game's questions. old: an old "Flashcards" game that becomes a quiz. */
  async function makeDeck(old) {
    const b = busy(__('Φτιάχνονται οι κάρτες…'));
    try {
      const all = await cardsFromQuestions(G.questions.filter((q) => !validateQuestion(q).length));
      if (!all.length) {
        b.close();
        dialog({ title: __('Δεν έγιναν κάρτες'), text: __('Καμία ερώτηση δεν έχει σωστή απάντηση για να μπει στην πίσω όψη. Φτιάξε τις κάρτες από την αρχή, με το «Νέο παιχνίδι».') });
        return;
      }
      const body = { title: String(G.title || '').trim(), description: G.description || '', grades: (G.grades || []).slice(), subject: G.subject || '', mode: 'flashcards', cover: { color: (G.cover && G.cover.color) || COVERS[0], emoji: '🃏' }, questions: [] };
      const fit = fitCards(body, all);
      body.incomplete = body.questions.filter((q) => validateQuestion(q).length).length;
      if (old) { G.mode = 'classic'; ver++; await save(); }
      else if (dirty() && worth()) await save();
      const newId = await DB.saveGame(body);
      b.close();
      const head = body.questions.length === 1 ? __('Έγινε 1 κάρτα.') : __('Έγιναν {0} κάρτες.', body.questions.length);
      toast([head].concat(fit.notes).join(' '), fit.notes.length ? 'error' : 'ok');
      ctx.go('/t/edit/' + newId);
    } catch (e) { b.close(); toast(errText(e), 'error'); }
  }
  /* Βάζει όσες κάρτες χωράνε (έως MAX_Q και έως το όριο μεγέθους· οι εικόνες που δεν χωράνε φεύγουν).
     Adds as many cards as fit (up to MAX_Q and the size limit; pictures that do not fit are dropped). */
  function fitCards(target, cards) {
    const notes = [];
    const room = MAX_Q - target.questions.length;
    if (cards.length > room) notes.push(__('Ένα παιχνίδι έχει έως {0} κάρτες: μπήκαν οι πρώτες {1}.', MAX_Q, Math.max(0, room)));
    let dropped = 0;
    cards.slice(0, Math.max(0, room)).forEach((c) => {
      target.questions.push(c);
      if (JSON.stringify(target).length > LIMIT) {
        if (c.image) { c.image = ''; dropped++; }
        if (c.back && c.back.image) { c.back.image = ''; dropped++; }
      }
    });
    if (dropped) notes.push(dropped === 1 ? __('Μία εικόνα δεν χώρεσε και δεν μπήκε.') : __('{0} εικόνες δεν χώρεσαν και δεν μπήκαν.', dropped));
    return { notes };
  }
  /* Παλιό παιχνίδι «Κάρτες μελέτης» με ερωτήσεις κουίζ: προτείνουμε μία φορά να γίνουν κάρτες.
     An old "Flashcards" game with quiz questions: we offer once to turn them into cards. */
  async function oldCards() {
    const key = 'qz:oldcards:' + (G.id || '');
    if (local.get(key, false)) return;
    const v = await dialog({
      title: __('Οι κάρτες μελέτης άλλαξαν'),
      text: __('Τώρα κάθε κάρτα έχει δική της μπροστινή και πίσω όψη, με κείμενο, εικόνα ή βίντεο. Αυτό το παιχνίδι έχει ερωτήσεις κουίζ. Θες να φτιάξω κάρτες από αυτές; Οι ερωτήσεις μένουν εδώ ως κουίζ.'),
      actions: [{ label: __('Όχι τώρα'), value: null }, { label: __('Φτιάξε κάρτες'), value: 'make', kind: 'primary' }]
    });
    local.set(key, true);
    if (v === 'make' && alive) makeDeck(true);
  }
  /* Κάρτες από κείμενο ή από κουίζ, στο τέλος της τράπουλας. Μια μόνη άδεια κάρτα αντικαθίσταται.
     Cards from text or from a quiz, at the end of the deck. A lone empty card is replaced. */
  function addCards(cards, extra) {
    if (!cards || !cards.length) return;
    if (G.questions.length === 1 && cardEmpty(G.questions[0])) G.questions = [];
    const fit = fitCards(G, cards);
    const added = cards.filter((c) => G.questions.includes(c));
    if (!added.length) { toast(fit.notes.join(' ') || __('Ένα παιχνίδι έχει έως {0} κάρτες.', MAX_Q), 'error'); return; }
    markDirty();
    select(added[0].id);
    const head = added.length === 1 ? __('Προστέθηκε 1 κάρτα.') : __('Προστέθηκαν {0} κάρτες.', added.length);
    const notes = (extra || []).concat(fit.notes);
    toast([head].concat(notes).join(' '), notes.length ? 'error' : 'ok');
  }
  async function importCards() {
    const empty = G.questions.length === 1 && cardEmpty(G.questions[0]);
    const room = MAX_Q - G.questions.length + (empty ? 1 : 0);
    if (room <= 0) { toast(__('Ένα παιχνίδι έχει έως {0} κάρτες.', MAX_Q), 'error'); return; }
    const cards = await textImportDialog(room);
    if (cards && alive) addCards(cards);
  }
  async function importQuiz() {
    const r = await quizImportDialog(G.id);
    if (!r || !alive) return;
    if (!r.cards.length) { dialog({ title: __('Δεν έγιναν κάρτες'), text: __('Αυτό το κουίζ δεν έχει ερωτήσεις με σωστή απάντηση για την πίσω όψη.') }); return; }
    if (!String(G.title || '').trim() && r.title) {
      G.title = r.title;
      const t = root.querySelector('#g-title');
      if (t) t.value = r.title;
    }
    addCards(r.cards, r.skipped ? [r.skipped === 1 ? __('Μία ερώτηση δεν έγινε κάρτα, γιατί δεν έχει σωστή απάντηση.') : __('{0} ερωτήσεις δεν έγιναν κάρτες, γιατί δεν έχουν σωστή απάντηση.', r.skipped)] : []);
  }
  /* «Παίξε»: το παιχνίδι παίζεται αμέσως, όπως θα το έπαιζαν τα παιδιά. Δεν αποθηκεύεται τίποτα. */
  async function playNow() {
    let ch = choiceOf(G.mode);
    if (!ch) {
      const v = await pickDialog(G.mode);
      if (!v) return;
      if (v === 'flashcards' && !deck) { cardsInstead(); return; }
      applyGame(v);
      ch = choiceOf(v);
    }
    if (ch.stage) { sendToClass(); return; }
    const problem = playProblem(G.questions, ch.base);
    if (problem) { tried = true; showErrors(true); toast(problem, 'error'); return; }
    const btn = root.querySelector('[data-playnow]');
    btn.disabled = true;
    try {
      if (dirty() && worth()) await save();
      await playOwn(G, ctx, { mode: ch.base, back: G.id ? '/t/edit/' + G.id : '/t' });
    } catch (e) { toast(errText(e), 'error'); } finally { btn.disabled = false; }
  }

  function sizeMeter() {
    const s = root.querySelector('[data-size]');
    if (!s) return;
    const bytes = JSON.stringify(G).length;
    const p = Math.round(bytes / LIMIT * 100);
    s.textContent = p >= 5 ? `${__('Χώρος: {0}% από όσο χωράει ένα παιχνίδι.', p)}` : '';
    s.className = 'pn-size' + (p >= 90 ? ' size-bad' : p >= 70 ? ' size-warn' : '');
    s.title = __('Οι εικόνες πιάνουν τον περισσότερο χώρο. Κάθε παιχνίδι χωράει περίπου 1 MB.');
  }

  /* ---------- η λίστα των ερωτήσεων ---------- */
  const railText = (q) => (deck ? railTexts(q).front || __('(κενή μπροστινή όψη)') : String(q.text || '').trim() || __('(χωρίς κείμενο)'));
  function railItem(q, i) {
    const t = TYPES[q.type];
    const bad = tried && validateQuestion(q).length;
    const on = q.id === cur;
    if (deck) {
      const r = railTexts(q);
      return `<li><button type="button" class="qi qi-card${on ? ' is-on' : ''}${bad ? ' has-err' : ''}" data-goto="${esc(q.id)}"${on ? ' aria-current="true"' : ''}>
        <span class="qi-n">${i + 1}</span><span class="qi-b"><span class="qi-tx${r.front ? '' : ' is-empty'}">${esc(railText(q))}</span><span class="qi-bk${r.back ? '' : ' is-empty'}">${esc(r.back || __('(κενή πίσω όψη)'))}</span></span>${q.image ? `<img class="qi-th" src="${esc(q.image)}" alt="">` : ''}</button></li>`;
    }
    return `<li><button type="button" class="qi${on ? ' is-on' : ''}${bad ? ' has-err' : ''}" data-goto="${esc(q.id)}"${on ? ' aria-current="true"' : ''}>
      <span class="qi-n">${i + 1}</span><span class="qi-b"><span class="qi-tx${String(q.text || '').trim() ? '' : ' is-empty'}">${esc(railText(q))}</span><span class="qi-ty">${t.icon}<span>${esc(t.label)}</span></span></span></button></li>`;
  }
  function drawRail() {
    const ol = root.querySelector('[data-ql]');
    if (!ol) return;
    ol.innerHTML = G.questions.map(railItem).join('');
    root.querySelector('[data-qcount]').textContent = G.questions.length ? String(G.questions.length) : '';
    const on = ol.querySelector('.is-on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function select(qid, focusText) {
    cur = qid;
    drawRail();
    drawCanvas(focusText);
    drawPanel();
  }

  /* ---------- η ερώτηση ---------- */
  function cardHtml(q, i) {
    const t = TYPES[q.type];
    const clozeType = q.type === 'dropdown' || q.type === 'drag' || q.type === 'label';
    const qid = esc(q.id);
    return `<article class="qe" data-q="${qid}" id="qe-${qid}">
      <div class="qe-head"><span class="qe-type-l">${t.icon}<span>${esc(t.label)}</span></span>
        ${usesQuizExtras(G.mode) ? `<label class="qe-time" title="${__('Χρόνος')}">${ICON.clock}<span class="sr">${__('Χρόνος για την ερώτηση')} ${i + 1}</span><select data-c="time">${TIMES.map((s) => `<option value="${s}" ${Number(q.time) === s ? 'selected' : ''}>${timeLabel(s)}</option>`).join('')}</select></label>` : ''}
        <span class="qe-tools">
          <button type="button" class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="${__('Πάνω')}" aria-label="${__('Μετακίνηση της ερώτησης {0} πάνω', i + 1)}">${ICON.up}</button>
          <button type="button" class="icon-btn" data-act="down" ${i === G.questions.length - 1 ? 'disabled' : ''} title="${__('Κάτω')}" aria-label="${__('Μετακίνηση της ερώτησης {0} κάτω', i + 1)}">${ICON.down}</button>
          <button type="button" class="icon-btn" data-act="dup" title="${__('Αντίγραφο')}" aria-label="${__('Αντίγραφο της ερώτησης')} ${i + 1}">${ICON.copy}</button>
          <button type="button" class="icon-btn icon-danger" data-act="del" title="${__('Διαγραφή')}" aria-label="${__('Διαγραφή της ερώτησης')} ${i + 1}">${ICON.trash}</button>
        </span></div>
      <label class="sr" for="qt-${qid}">${clozeType ? __('Οδηγία') : __('Ερώτηση')} ${i + 1}</label>
      <textarea class="qe-text" id="qt-${qid}" rows="1" maxlength="600" data-c="text" placeholder="${clozeType ? __('Οδηγία, π.χ. Διάλεξε τη σωστή λέξη σε κάθε κενό.') : __('Γράψε την ερώτηση')}">${esc(q.text)}</textarea>
      ${t.ownImage ? '' : `<div class="qe-img">${q.image ? `<img src="${esc(q.image)}" alt="${__('Η εικόνα της ερώτησης')} ${i + 1}"><button type="button" class="btn btn-sm btn-line" data-act="noimg">${ICON.x}${__('Αφαίρεση εικόνας')}</button>`
        : `<label class="qe-drop">${ICON.image}<span>${__('Πρόσθεσε εικόνα')} <span class="muted">${__('(προαιρετικά)')}</span></span><input type="file" accept="image/*" data-c="image" class="sr"></label>`}</div>`}
      <div class="qe-type" data-type-slot></div>
      <ul class="qe-errs" role="alert" hidden></ul>
    </article>`;
  }
  function mountType(card, q) {
    const old = card.querySelector('[data-type-slot]');
    const fresh = document.createElement('div');
    fresh.className = 'qe-type qe-type-' + q.type;
    fresh.setAttribute('data-type-slot', '');
    fresh.innerHTML = TYPES[q.type].edit(q, q.id);
    old.replaceWith(fresh);
    const redraw = (focusSel) => {
      mountType(card, q);
      if (focusSel) { const f = card.querySelector(focusSel); if (f) f.focus(); }
      if (tried) showErrors(false);
    };
    TYPES[q.type].bind(fresh, q, markDirty, redraw);
  }
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
  function drawCanvas(focusText) {
    const box = root.querySelector('[data-canvas]');
    if (!box) return;
    const q = qById(cur);
    if (deck) { drawCard(box, q, focusText); return; }
    if (!q) {
      box.innerHTML = `<div class="ed-empty"><h2 class="h2">${__('Γράψε την πρώτη ερώτηση')}</h2><p class="muted">${__('Διάλεξε τι είδους ερώτηση θα είναι. Μπορείς να βάλεις διαφορετικά είδη στο ίδιο παιχνίδι.')}</p>${typeGrid()}
        <p class="ed-empty-imp"><button type="button" class="btn btn-ghost" data-import>${ICON.upload}${__('Ή εισαγωγή ερωτήσεων από κείμενο')}</button></p></div>`;
      return;
    }
    box.innerHTML = cardHtml(q, G.questions.indexOf(q));
    mountType(box.querySelector('.qe'), q);
    const ta = box.querySelector('.qe-text');
    grow(ta);
    if (tried) showErrors(false);
    if (focusText) setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 20);
  }

  /* ---------- μια κάρτα (τράπουλα) / one card (deck) ---------- */
  function drawCard(box, q, focus) {
    if (!q) {
      box.innerHTML = `<div class="ed-empty ce-empty"><h2 class="h2">${__('Φτιάξε την πρώτη κάρτα')}</h2>
        <p class="muted">${__('Κάθε κάρτα έχει δύο όψεις. Σε καθεμιά βάζεις κείμενο, εικόνα ή βίντεο, όποιο από τα τρία θέλεις.')}</p>
        <p class="ce-empty-go"><button type="button" class="btn btn-primary btn-lg" data-addq>${ICON.plus}${__('Νέα κάρτα')}</button></p>
        <p class="ed-empty-imp"><button type="button" class="btn btn-ghost" data-import>${ICON.upload}${__('Εισαγωγή από κείμενο')}</button> <button type="button" class="btn btn-ghost" data-quizimp>${ICON.copy}${__('Κάρτες από κουίζ')}</button></p></div>`;
      return;
    }
    box.innerHTML = cardForm(q, G.questions.indexOf(q), G.questions.length);
    const card = box.querySelector('.qe');
    bindCardForm(card, q, {
      change: markDirty,
      redraw(sel) { drawCanvas(); const f = sel && root.querySelector(`.qe ${sel}`); if (f) f.focus(); drawRail(); },
      setImage: (side, file) => setCardImage(q, side, file)
    });
    if (tried) showErrors(false);
    if (focus) setTimeout(() => { const ta = box.querySelector('.ce-text'); if (ta) ta.focus(); }, 20);
  }
  /* Όσο χώρος μένει στο παιχνίδι, τόσο μεγάλη η εικόνα: στο τέλος οι νέες συμπιέζονται περισσότερο.
     The picture gets as much room as the game has left: near the end new ones are compressed further. */
  async function setCardImage(q, side, file) {
    const full = () => dialog({ title: __('Δεν χωράει άλλη εικόνα'), text: __('Οι εικόνες γέμισαν τον χώρο του παιχνιδιού. Αφαίρεσε κάποια εικόνα ή χώρισε τις κάρτες σε δύο παιχνίδια. Τα βίντεο δεν πιάνουν χώρο.') });
    const o = sideOf(q, side);
    const old = o.image;
    o.image = '';
    const room = LIMIT - JSON.stringify(G).length - 2000;
    o.image = old;
    if (room < CARD_MIN) { full(); return; }
    const b = busy(__('Ετοιμάζεται η εικόνα…'));
    try {
      const img = await readImage(file, CARD.dim, Math.min(CARD.bytes, room));
      o.image = img;
      if (JSON.stringify(G).length > LIMIT) { o.image = old; full(); }
      else {
        markDirty();
        drawCanvas();
        drawRail();
      }
    } catch (er) {
      if (room < CARD.bytes && /^image\//.test((file && file.type) || '')) full();
      else toast(errText(er), 'error');
    }
    b.close();
  }

  /* ---------- δεξιά: ρυθμίσεις ---------- */
  function drawPanel() {
    const box = root.querySelector('[data-panel]');
    if (!box) return;
    const q = qById(cur);
    const t = q && TYPES[q.type];
    const qid = q ? esc(q.id) : '';
    box.innerHTML = `<div class="ready" data-ready aria-live="polite"></div>
      ${q && !deck ? `<section class="pn" data-q="${qid}" aria-labelledby="pn-q"><h3 class="pn-h" id="pn-q">${__('Αυτή η ερώτηση')}</h3>
        ${t.scored && usesQuizExtras(G.mode) ? `<label class="pn-row"><span>${__('Διπλοί πόντοι')}</span><input type="checkbox" class="tog" data-c="double" ${q.double ? 'checked' : ''}></label>` : ''}
        <div class="field"><label class="label" for="qc-${qid}">${__('Θεματική')} <span class="muted">${__('(γίνεται στήλη στο Jeopardy)')}</span></label><input class="input" id="qc-${qid}" list="ed-cats" maxlength="40" data-c="category" value="${esc(q.category || '')}" placeholder="${__('π.χ. Γεωγραφία')}"></div>
        <div class="field"><label class="label" for="qx-${qid}">${__('Εξήγηση μετά την απάντηση')}</label><textarea class="input" id="qx-${qid}" rows="3" maxlength="400" data-c="explain" placeholder="${__('Τη βλέπουν οι μαθητές αφού απαντήσουν.')}">${esc(q.explain || '')}</textarea></div>
      </section>` : ''}
      <section class="pn" aria-labelledby="pn-g"><h3 class="pn-h" id="pn-g">${__('Το παιχνίδι')}</h3>
        <fieldset class="field"><legend class="label">${__('Τάξη')}</legend><div class="chips-pick">${GRADES.map((g) => `<label class="chip-pick"><input type="checkbox" value="${esc(g)}" data-grade ${(G.grades || []).includes(g) ? 'checked' : ''}><span>${esc(__(g))}</span></label>`).join('')}</div></fieldset>
        <div class="field"><label class="label" for="g-subj">${__('Μάθημα')}</label><select class="input" id="g-subj" data-g="subject"><option value="">—</option>${(G.subject && !SUBJECTS.includes(G.subject) ? [G.subject] : []).concat(SUBJECTS).map((s) => `<option value="${esc(s)}" ${G.subject === s ? 'selected' : ''}>${esc(__(s))}</option>`).join('')}</select></div>
        <div class="field"><label class="label" for="g-desc">${__('Περιγραφή')} <span class="muted">${__('(προαιρετικά)')}</span></label><textarea class="input" id="g-desc" rows="2" maxlength="300" data-g="description">${esc(G.description || '')}</textarea></div>
        <p class="pn-size" data-size></p>
      </section>`;
    drawReady();
    sizeMeter();
    drawCats();
  }
  function drawCats() {
    const dl = root.querySelector('#ed-cats');
    if (!dl) return;
    const cats = Array.from(new Set(G.questions.map((x) => String(x.category || '').trim()).filter(Boolean)));
    dl.innerHTML = cats.map((c) => `<option value="${esc(c)}"></option>`).join('');
  }

  /* ---------- προσθήκη ερώτησης ---------- */
  function typeDialog() {
    let picked = null;
    dialog({
      title: __('Τι είδους ερώτηση;'), wide: true,
      html: `<div class="type-dlg">${typeGrid()}</div>`,
      actions: [{ label: __('Άκυρο'), value: null }],
      focus: '.type-b',
      onOpen(dlg, close) {
        dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) { picked = b.dataset.add; close('add'); } });
      }
    }).then(() => { if (picked) addQuestion(picked); });
  }
  function addQuestion(type) {
    if (G.questions.length >= MAX_Q) { toast(deck ? __('Ένα παιχνίδι έχει έως {0} κάρτες.', MAX_Q) : `${__('Ένα παιχνίδι έχει έως {0} ερωτήσεις.', MAX_Q)}`, 'error'); return; }
    if (deck) type = 'card';
    const at = qById(cur);
    const q = newQuestion(type, 'q' + rid(8));
    if (at) q.time = TYPES[type].ownImage ? Math.max(Number(at.time) || 0, q.time) : at.time;
    const i = at ? G.questions.indexOf(at) + 1 : G.questions.length;
    G.questions.splice(i, 0, q);
    markDirty();
    select(q.id, true);
  }

  /* ---------- συμβάντα ---------- */
  root.addEventListener('input', (e) => {
    const g = e.target.dataset.g;
    if (g) { G[g] = e.target.value; markDirty(); if (g === 'title') e.target.classList.remove('is-err'); return; }
    const c = e.target.dataset.c;
    if (c === 'text' || c === 'explain' || c === 'category') {
      const q = qOf(e.target);
      if (!q) return;
      q[c] = e.target.value;
      if (c === 'text') grow(e.target);
      markDirty();
      if (c === 'category') drawCats();
    }
  });
  root.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.hasAttribute('data-grade')) { G.grades = Array.from(root.querySelectorAll('[data-grade]:checked')).map((x) => x.value); markDirty(); return; }
    if (t.dataset.g === 'subject') { G.subject = t.value; markDirty(); return; }
    const q = qOf(t);
    if (!q) return;
    if (t.dataset.c === 'time') { q.time = Number(t.value); markDirty(); }
    if (t.dataset.c === 'double') { q.double = t.checked; markDirty(); }
    if (t.dataset.c === 'image' && t.files && t.files[0]) await setImage(q, t.files[0]);
  });
  async function setImage(q, file) {
    const b = busy(__('Ετοιμάζεται η εικόνα…'));
    // Στις «Λέξεις στην εικόνα» η εικόνα είναι όλη η ερώτηση: κρατάμε μεγαλύτερο μέγεθος για να διαβάζεται.
    const big = TYPES[q.type] && TYPES[q.type].ownImage;
    try { q.image = await readImage(file, big ? BIG.dim : PHOTO.dim, big ? BIG.bytes : PHOTO.bytes); markDirty(); drawCanvas(); } catch (er) { toast(errText(er), 'error'); }
    b.close();
  }
  root.addEventListener('dragover', (e) => {
    const z = e.target.closest && e.target.closest('.qe-drop');
    if (z) { e.preventDefault(); z.classList.add('is-over'); }
  });
  root.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('.qe-drop'); if (z) z.classList.remove('is-over'); });
  root.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('.qe-drop');
    if (!z) return;
    e.preventDefault();
    z.classList.remove('is-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    const q = qOf(z);
    if (f && q) setImage(q, f);
  });
  root.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { addQuestion(add.dataset.add); return; }
    if (e.target.closest('[data-addq]')) { if (deck) addQuestion('card'); else typeDialog(); return; }
    if (e.target.closest('[data-quizimp]')) { importQuiz(); return; }
    const go = e.target.closest('[data-goto]');
    if (go) { if (go.dataset.goto !== cur) select(go.dataset.goto); return; }
    if (e.target.closest('[data-import]')) { if (deck) importCards(); else importDialog(); return; }
    if (e.target.closest('[data-change-game]')) { changeGame(); return; }
    if (e.target.closest('[data-cover]')) { coverDialog(); return; }
    if (e.target.closest('[data-saveplay]')) { sendToClass(); return; }
    if (e.target.closest('[data-playnow]')) { playNow(); return; }
    if (e.target.closest('[data-retry-save]')) { save(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    const q = a === 'preview' ? qById(cur) : qOf(act);
    if (!q) { if (a === 'preview') toast(deck ? __('Πρόσθεσε πρώτα μια κάρτα.') : __('Πρόσθεσε πρώτα μια ερώτηση.')); return; }
    const i = G.questions.indexOf(q);
    if (a === 'preview' && deck) { cardPreview(q); return; }
    if (a === 'preview') {
      const errs = validateQuestion(q);
      if (errs.length) { dialog({ title: __('Η ερώτηση δεν είναι έτοιμη'), text: (__('Διόρθωσε πρώτα:') + ' ') + errs.join(' · ') + '.' }); return; }
      previewQuestion(q);
    }
    if (a === 'up' && i > 0) { G.questions.splice(i - 1, 0, G.questions.splice(i, 1)[0]); markDirty(); select(q.id); focusAct('up'); }
    if (a === 'down' && i < G.questions.length - 1) { G.questions.splice(i + 1, 0, G.questions.splice(i, 1)[0]); markDirty(); select(q.id); focusAct('down'); }
    if (a === 'dup') {
      if (G.questions.length >= MAX_Q) { toast(deck ? __('Ένα παιχνίδι έχει έως {0} κάρτες.', MAX_Q) : `${__('Ένα παιχνίδι έχει έως {0} ερωτήσεις.', MAX_Q)}`, 'error'); return; }
      if (deck && JSON.stringify(G).length + JSON.stringify(q).length > LIMIT) { toast(__('Οι εικόνες γέμισαν τον χώρο του παιχνιδιού.'), 'error'); return; }
      const copyQ = Object.assign(JSON.parse(JSON.stringify(q)), { id: 'q' + rid(8) });
      G.questions.splice(i + 1, 0, copyQ);
      markDirty();
      select(copyQ.id, true);
      toast(deck ? __('Έγινε αντίγραφο της κάρτας.') : __('Έγινε αντίγραφο της ερώτησης.'), 'ok');
    }
    if (a === 'del') {
      const untouched = deck ? cardEmpty(q) : !q.text && !q.image && validateQuestion(q).length > 0;
      const what = deck ? railTexts(q).front : q.text;
      if (untouched || await confirmDanger(deck ? __('Διαγραφή της κάρτας {0};', i + 1) : `${__('Διαγραφή της ερώτησης {0};', i + 1)}`, what ? `«${what.slice(0, 80)}»` : '')) {
        const at = G.questions.indexOf(q);
        G.questions.splice(at, 1);
        const next = G.questions[Math.min(at, G.questions.length - 1)];
        markDirty();
        select(next ? next.id : null);
      }
    }
    if (a === 'noimg') { q.image = ''; markDirty(); drawCanvas(); }
  });
  function focusAct(act) {
    let b = root.querySelector(`.qe [data-act="${act}"]`);
    if (b && b.disabled) b = root.querySelector(`.qe [data-act="${act === 'up' ? 'down' : 'up'}"]`);
    if (b) b.focus({ preventScroll: true });
  }

  /* ---------- έλεγχος και «Στείλε στην τάξη» ---------- */
  function showErrors(jump) {
    let first = null, count = 0;
    G.questions.forEach((q) => {
      const errs = validateQuestion(q);
      const item = root.querySelector(`[data-goto="${q.id}"]`);
      if (item) item.classList.toggle('has-err', !!errs.length);
      if (errs.length) { count++; if (!first) first = q; }
    });
    const q = qById(cur);
    const card = root.querySelector('.qe');
    if (q && card) {
      const errs = validateQuestion(q);
      const box = card.querySelector('.qe-errs');
      box.hidden = !errs.length;
      box.innerHTML = errs.map((x) => `<li>${esc(x.charAt(0).toUpperCase() + x.slice(1))}.</li>`).join('');
      card.classList.toggle('has-err', !!errs.length);
    }
    const title = root.querySelector('#g-title');
    if (title) title.classList.toggle('is-err', !String(G.title || '').trim());
    if (jump && first && first.id !== cur) select(first.id);
    return count;
  }
  async function sendToClass() {
    tried = true;
    if (!String(G.title || '').trim()) {
      toast(__('Γράψε τίτλο για το παιχνίδι.'), 'error');
      const t = root.querySelector('#g-title');
      t.classList.add('is-err');
      t.focus();
      return;
    }
    if (!G.questions.length) { toast(deck ? __('Πρόσθεσε τουλάχιστον μία κάρτα.') : __('Πρόσθεσε τουλάχιστον μία ερώτηση.'), 'error'); return; }
    const bad = showErrors(true);
    if (bad && deck) { toast(bad === 1 ? __('Μία κάρτα χρειάζεται διόρθωση (σημειώνεται με κόκκινο).') : __('{0} κάρτες χρειάζονται διόρθωση (σημειώνονται με κόκκινο).', bad), 'error'); return; }
    if (bad) { toast(bad === 1 ? __('Μία ερώτηση χρειάζεται διόρθωση (σημειώνεται με κόκκινο).') : `${bad} ${__('ερωτήσεις χρειάζονται διόρθωση (σημειώνονται με κόκκινο).')}`, 'error'); return; }
    const ch = choiceOf(G.mode);
    if (ch && !readiness(G.mode, G.questions).ok) { toast(__('Το παιχνίδι «{0}» χρειάζεται τουλάχιστον {1} ερωτήσεις με σωστή απάντηση.', ch.label, NEED), 'error'); return; }
    const btn = root.querySelector('[data-saveplay]');
    btn.disabled = true;
    if (!G.id) ver++;
    const ok = await save();
    btn.disabled = false;
    if (!ok) { dialog({ title: __('Δεν αποθηκεύτηκε'), text: saveErr || '' }); return; }
    if (ch && ch.stage) ctx.go('/t/stage/' + G.id);
    else startDialog(Object.assign(JSON.parse(JSON.stringify(G)), { questions: G.questions.map((q) => tidyQuestion(JSON.parse(JSON.stringify(q)))) }), ctx);
  }

  /* ---------- εξώφυλλο ---------- */
  function coverDialog() {
    const c = G.cover;
    dialog({
      title: __('Εξώφυλλο'),
      html: `<fieldset class="field"><legend class="label">${__('Χρώμα')}</legend><div class="swatches">${COVERS.map((x) => `<label class="sw"><input type="radio" name="cv-c" value="${x}" ${x === c.color ? 'checked' : ''}><span style="--c:${x}"><span class="sr">${x}</span></span></label>`).join('')}</div></fieldset>
        <fieldset class="field"><legend class="label">${__('Εικονίδιο')}</legend><div class="emojis">${EMOJIS.map((x) => `<label class="em"><input type="radio" name="cv-e" value="${x}" ${x === c.emoji ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></fieldset>`,
      actions: [{ label: __('Άκυρο'), value: null }, {
        label: __('Εντάξει'), kind: 'primary', value: 'ok',
        check(dlg) {
          const col = dlg.querySelector('[name="cv-c"]:checked');
          const em = dlg.querySelector('[name="cv-e"]:checked');
          G.cover = { color: col ? col.value : c.color, emoji: em ? em.value : c.emoji };
          return true;
        }
      }]
    }).then((v) => {
      if (v !== 'ok') return;
      markDirty();
      const b = root.querySelector('[data-cover]');
      b.style.background = tint(G.cover.color, 0.16);
      b.querySelector('span').textContent = G.cover.emoji;
    });
  }

  /* ---------- εισαγωγή από κείμενο ---------- */
  function importDialog() {
    let parsed = null;
    dialog({
      title: __('Εισαγωγή ερωτήσεων από κείμενο'), wide: true,
      html: `<div class="imp"><div class="imp-help">${LANG === 'en' ? `<p>Type or paste your questions like this:</p>
        <ul><li>The question on one line and the answers below it, one per line.</li>
        <li>Put <b>*</b> in front of the right answer. With two or more <b>*</b> it becomes a “several right answers” question.</li>
        <li>For true or false, write <b>*True</b> and <b>False</b> below it (or the other way round).</li>
        <li>For fill in the blank, write <b>= answer</b> below it. Separate more accepted answers with <b>|</b>.</li>
        <li>Leave an empty line between questions.</li>
        <li>For topics (they become Jeopardy columns), write <b># Topic</b> on its own line before its questions.</li></ul></div>
        <pre class="imp-ex"># Maths
What is 7 × 8?
*56
54
64

# Geography
Athens is the capital of Greece.
*True
False

What is the capital of Italy?
= Rome | Roma</pre>` : `<p>Γράψε ή επικόλλησε τις ερωτήσεις έτσι:</p>
        <ul><li>Η ερώτηση σε μία γραμμή και από κάτω οι απαντήσεις, μία σε κάθε γραμμή.</li>
        <li>Βάλε <b>*</b> μπροστά στη σωστή απάντηση. Με δύο ή περισσότερα <b>*</b> γίνεται ερώτηση «πολλές σωστές».</li>
        <li>Για σωστό ή λάθος, γράψε από κάτω <b>*Σωστό</b> και <b>Λάθος</b> (ή ανάποδα).</li>
        <li>Για συμπλήρωση, γράψε από κάτω <b>= απάντηση</b>. Περισσότερες αποδεκτές απαντήσεις χωρίζονται με <b>|</b>.</li>
        <li>Άφησε μία κενή γραμμή ανάμεσα στις ερωτήσεις.</li>
        <li>Για θεματικές (γίνονται στήλες στο Jeopardy), γράψε <b># Θεματική</b> σε δική της γραμμή πριν από τις ερωτήσεις της.</li></ul></div>
        <pre class="imp-ex"># Μαθηματικά
Πόσο κάνει 7 × 8;
*56
54
64

# Γεωγραφία
Η Αθήνα είναι η πρωτεύουσα της Ελλάδας.
*Σωστό
Λάθος

Ποια είναι η πρωτεύουσα της Ιταλίας;
= Ρώμη</pre>`}
        <label class="label" for="imp-t">${__('Οι ερωτήσεις σου')}</label><textarea class="input" id="imp-t" rows="10"></textarea>
        <p class="imp-res" aria-live="polite"></p></div>`,
      focus: '#imp-t',
      actions: [{ label: __('Άκυρο'), value: null }, {
        label: __('Προσθήκη'), kind: 'primary', value: 'add',
        check(dlg) {
          parsed = parseQuestionText(dlg.querySelector('#imp-t').value);
          const res = dlg.querySelector('.imp-res');
          if (!parsed.questions.length) {
            res.innerHTML = `<span class="err">${parsed.errors.length ? parsed.errors.map(esc).join('<br>') : __('Δεν βρέθηκαν ερωτήσεις.')}</span>`;
            return false;
          }
          if (G.questions.length + parsed.questions.length > MAX_Q) { res.innerHTML = `<span class="err">${__('Ένα παιχνίδι έχει έως {0} ερωτήσεις.', MAX_Q)}</span>`; return false; }
          return true;
        }
      }],
      onOpen(dlg) {
        const ta = dlg.querySelector('#imp-t');
        const res = dlg.querySelector('.imp-res');
        ta.addEventListener('input', () => {
          const p = parseQuestionText(ta.value);
          res.innerHTML = ta.value.trim() ? `${__('Βρέθηκαν')} <b>${p.questions.length}</b> ${__('ερωτήσεις.')}${p.errors.length ? `<br><span class="err">${p.errors.map(esc).join('<br>')}</span>` : ''}` : '';
        });
      }
    }).then((v) => {
      if (v !== 'add' || !parsed) return;
      const last = G.questions[G.questions.length - 1];
      parsed.questions.forEach((q) => { if (last) q.time = last.time; G.questions.push(q); });
      markDirty();
      select(parsed.questions[0].id);
      toast(`${parsed.questions.length === 1 ? __('Προστέθηκε 1 ερώτηση.') : __('Προστέθηκαν {0} ερωτήσεις.', parsed.questions.length)}` + (parsed.errors.length ? ` ${parsed.errors.length} ${__('παραλείφθηκαν.')}` : ''), parsed.errors.length ? 'error' : 'ok');
    });
  }

  ctx.setCleanup(() => {
    alive = false;
    window.removeEventListener('beforeunload', onUnload);
    if (G && dirty() && worth() && !saving) save();
  });
}
