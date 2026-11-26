/*
  Επεξεργαστής καρτών μελέτης: οι δύο όψεις μιας κάρτας (κείμενο, εικόνα, βίντεο), προεπισκόπηση,
  κάρτες από απλό κείμενο και κάρτες από ένα κουίζ. Το editor.js τα χρησιμοποιεί όταν το παιχνίδι είναι τράπουλα.
  Flashcard editor: a card's two sides (text, image, video), preview, cards from plain text and cards
  from a quiz. editor.js uses these when the game is a deck.
*/
import { esc, dialog, toast, ICON, errText, busy, rid, plural } from './ui.js';
import { DB } from './store.js';
import { TYPES, videoInfo, parseCloze, CARD_TEXT_MAX, newQuestion, tidyQuestion } from './qtypes.js';
import { sidesOf, sideHtml, sideLabel, videoHtml, playVideo } from './cards.js';
import { isDeck } from './modes.js';
import { slimImage, CARD } from './images.js';
import { __ } from './i18n.js';

const VIDEO_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5.5" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 10.5l5-3v9l-5-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>';
const SWAP_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const SIDES = ['front', 'back'];
const sideName = (s) => (s === 'front' ? __('Μπροστά') : __('Πίσω'));

/* Η όψη μιας κάρτας ως αντικείμενο με text, image, video: η μπροστινή είναι η ίδια η κάρτα.
   A card side as an object with text, image, video: the front is the card itself. */
export function sideOf(q, s) {
  if (s === 'front') return q;
  if (!q.back || typeof q.back !== 'object') q.back = { text: '', image: '', video: null };
  return q.back;
}
const hasVideo = (o) => !!(o.video && String(o.video.url || '').trim());
const sideEmpty = (o) => !String(o.text || '').trim() && !o.image && !hasVideo(o);
export const cardEmpty = (q) => sideEmpty(sideOf(q, 'front')) && sideEmpty(sideOf(q, 'back'));

/* Για τη λίστα αριστερά. / For the list on the left. */
export function railTexts(q) {
  const s = sidesOf(q);
  return { front: sideLabel(s.front), back: sideLabel(s.back) };
}

/* ---------- χρόνος βίντεο / video time ---------- */
export function parseTime(v) {
  const s = String(v || '').trim();
  if (!s) return 0;
  const parts = s.split(/\s*[:.,΄']\s*/);
  if (parts.length > 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}
export function fmtTime(n) {
  n = Math.floor(Number(n) || 0);
  if (!n) return '';
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
}

/* ---------- η φόρμα μιας κάρτας / a card's form ---------- */
const openVideo = new Set(); // όψεις όπου πατήθηκε «Βίντεο» χωρίς σύνδεσμο ακόμη / sides where "Video" was pressed, no link yet

function videoHint(v) {
  const url = String((v && v.url) || '').trim();
  if (!url) return { bad: false, text: __('Από YouTube, Vimeo ή Google Drive, ή αρχείο .mp4. Τα βίντεο δεν πιάνουν χώρο στο παιχνίδι.') };
  if (!/^https:\/\//i.test(url)) return { bad: true, text: __('Ο σύνδεσμος πρέπει να ξεκινά με https://. Αντέγραψέ τον από τη γραμμή διευθύνσεων.') };
  const info = videoInfo(url);
  if (!info) return { bad: true, text: __('Δεν αναγνωρίστηκε. Βάλε σύνδεσμο από YouTube, Vimeo ή Google Drive, ή αρχείο .mp4.') };
  if (info.kind === 'drive') return { bad: false, text: __('Google Drive: το αρχείο πρέπει να είναι κοινόχρηστο σε «Οποιονδήποτε έχει τον σύνδεσμο».') };
  if (info.kind === 'vimeo') return { bad: false, text: __('Vimeo: το βίντεο πρέπει να επιτρέπει την ενσωμάτωση σε άλλες σελίδες.') };
  return { bad: false, text: info.name ? __('Βίντεο από {0}.', info.name) : __('Αρχείο βίντεο.') };
}
function videoForm(q, s, base) {
  const o = sideOf(q, s);
  const v = o.video || { url: '', start: 0, end: 0 };
  const info = videoInfo(v.url);
  const h = videoHint(v);
  return `<div class="ce-vid" data-vbox>
    <div class="field"><label class="label" for="${base}-v">${__('Σύνδεσμος βίντεο')}</label>
      <input class="input" id="${base}-v" type="url" inputmode="url" autocomplete="off" spellcheck="false" data-cf="video.url" value="${esc(v.url || '')}" placeholder="https://www.youtube.com/watch?v=…">
      <p class="hint${h.bad ? ' is-bad' : ''}" data-vhint>${esc(h.text)}</p></div>
    <div class="ce-times" data-vtimes ${info && info.kind === 'drive' ? 'hidden' : ''}>
      <div class="field"><label class="label" for="${base}-s">${__('Ξεκινά από')}</label><input class="input" id="${base}-s" inputmode="numeric" autocomplete="off" data-cf="video.start" value="${esc(fmtTime(v.start))}" placeholder="0:00"></div>
      <div class="field"><label class="label" for="${base}-e">${__('Σταματά στο')} <span class="muted">${__('(προαιρετικά)')}</span></label><input class="input" id="${base}-e" inputmode="numeric" autocomplete="off" data-cf="video.end" value="${esc(fmtTime(v.end))}" placeholder="${__('λ:δδ')}"></div>
      <p class="hint ce-thint" data-thint>${__('Σε λεπτά:δευτερόλεπτα, π.χ. 1:30.')}</p>
    </div>
    <div class="ce-vprev" data-vprev>${info ? videoHtml(v) : ''}</div>
    <button type="button" class="btn btn-sm btn-ghost ce-novid" data-ce="novid">${ICON.x}<span>${__('Αφαίρεση βίντεο')}</span></button>
  </div>`;
}
function sideForm(q, s, i) {
  const o = sideOf(q, s);
  const base = `ce-${esc(q.id)}-${s}`;
  const name = sideName(s);
  const vid = hasVideo(o) || openVideo.has(`${q.id}:${s}`);
  const ph = s === 'front' ? __('π.χ. Πώς λέγεται το ζώο;') : __('π.χ. Αλεπού');
  return `<section class="ce-side ce-${s}" data-side="${s}" aria-labelledby="${base}-h">
    <h3 class="ce-h" id="${base}-h"><span class="ce-h-n">${name}</span><span class="sr">, </span><span class="ce-h-s">${s === 'front' ? __('Αυτό βλέπουν πρώτα') : __('Αυτό βλέπουν όταν τη γυρίσουν')}</span></h3>
    <label class="sr" for="${base}-t">${__('Κάρτα {0}, {1}: κείμενο', i + 1, name)}</label>
    <textarea class="ce-text" id="${base}-t" rows="2" maxlength="${CARD_TEXT_MAX}" data-cf="text" placeholder="${esc(ph)}">${esc(o.text || '')}</textarea>
    ${o.image ? `<figure class="ce-img"><img src="${esc(o.image)}" alt="${esc(__('Η εικόνα: {0}', name))}"><figcaption>
        <label class="btn btn-sm btn-line">${ICON.image}<span>${__('Άλλη εικόνα')}</span><input type="file" accept="image/*" class="sr" data-cf="image"></label>
        <button type="button" class="btn btn-sm btn-line" data-ce="noimg">${ICON.x}<span>${__('Αφαίρεση')}</span></button></figcaption></figure>` : ''}
    ${vid ? videoForm(q, s, base) : ''}
    ${o.image && vid ? '' : `<div class="ce-add">${o.image ? '' : `<label class="ce-drop" data-drop>${ICON.image}<span>${__('Εικόνα')}</span><input type="file" accept="image/*" class="sr" data-cf="image"></label>`}${vid ? '' : `<button type="button" class="ce-drop" data-ce="vid">${VIDEO_ICON}<span>${__('Βίντεο')}</span></button>`}</div>`}
  </section>`;
}
export function cardForm(q, i, count) {
  const qid = esc(q.id);
  return `<article class="qe ce" data-q="${qid}" id="qe-${qid}">
    <div class="qe-head"><span class="qe-type-l">${TYPES.card.icon}<span>${__('Κάρτα {0}', i + 1)}</span></span>
      <span class="qe-tools">
        <button type="button" class="icon-btn" data-ce="swap" title="${__('Αντιμετάθεση όψεων')}" aria-label="${__('Αντιμετάθεση: η μπροστινή όψη γίνεται πίσω και η πίσω μπροστινή')}">${SWAP_ICON}</button>
        <button type="button" class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} title="${__('Πάνω')}" aria-label="${__('Μετακίνηση της κάρτας {0} πάνω', i + 1)}">${ICON.up}</button>
        <button type="button" class="icon-btn" data-act="down" ${i === count - 1 ? 'disabled' : ''} title="${__('Κάτω')}" aria-label="${__('Μετακίνηση της κάρτας {0} κάτω', i + 1)}">${ICON.down}</button>
        <button type="button" class="icon-btn" data-act="dup" title="${__('Αντίγραφο')}" aria-label="${__('Αντίγραφο της κάρτας {0}', i + 1)}">${ICON.copy}</button>
        <button type="button" class="icon-btn icon-danger" data-act="del" title="${__('Διαγραφή')}" aria-label="${__('Διαγραφή της κάρτας {0}', i + 1)}">${ICON.trash}</button>
      </span></div>
    <div class="ce-sides">${sideForm(q, 'front', i)}${sideForm(q, 'back', i)}</div>
    <ul class="qe-errs" role="alert" hidden></ul>
  </article>`;
}

/* api = { change(), redraw(focusSelector), setImage(side, file) } */
export function bindCardForm(box, q, api) {
  const sideKey = (node) => { const sec = node.closest('[data-side]'); return sec ? sec.dataset.side : null; };
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
  box.querySelectorAll('.ce-text').forEach(grow);
  const paintVideo = (sec, o) => {
    const v = o.video || { url: '' };
    const h = videoHint(v);
    const hint = sec.querySelector('[data-vhint]');
    if (hint) { hint.textContent = h.text; hint.classList.toggle('is-bad', h.bad); }
    const info = videoInfo(v.url);
    const times = sec.querySelector('[data-vtimes]');
    if (times) times.hidden = !!(info && info.kind === 'drive');
    const pv = sec.querySelector('[data-vprev]');
    if (pv) pv.innerHTML = info ? videoHtml(v) : '';
  };
  box.addEventListener('input', (e) => {
    const f = e.target.dataset.cf;
    const s = sideKey(e.target);
    if (!f || !s) return;
    const o = sideOf(q, s);
    const sec = e.target.closest('[data-side]');
    if (f === 'text') { o.text = e.target.value; grow(e.target); api.change(); return; }
    if (f === 'video.url') {
      const was = o.video || { url: '', start: 0, end: 0 };
      o.video = { url: e.target.value, start: was.start || 0, end: was.end || 0 };
      const info = videoInfo(o.video.url);
      // Σύνδεσμος με χρόνο (π.χ. ...&t=90): το βίντεο ξεκινά από εκεί. / A link with a time starts there.
      if (info && info.start && !was.start) {
        o.video.start = info.start;
        const si = sec.querySelector('[data-cf="video.start"]');
        if (si) si.value = fmtTime(info.start);
      }
      paintVideo(sec, o);
      api.change();
      return;
    }
    if (f === 'video.start' || f === 'video.end') {
      const n = parseTime(e.target.value);
      const th = sec.querySelector('[data-thint]');
      e.target.classList.toggle('is-err', Number.isNaN(n));
      if (th) th.classList.toggle('is-bad', Number.isNaN(n));
      if (Number.isNaN(n)) return;
      o.video = Object.assign({ url: '', start: 0, end: 0 }, o.video, { [f === 'video.start' ? 'start' : 'end']: n });
      api.change();
    }
  });
  box.addEventListener('change', (e) => {
    const f = e.target.dataset.cf;
    const s = sideKey(e.target);
    if (!f || !s) return;
    if (f === 'image' && e.target.files && e.target.files[0]) { api.setImage(s, e.target.files[0]); return; }
    if (f === 'video.start' || f === 'video.end') {
      const n = parseTime(e.target.value);
      if (!Number.isNaN(n)) { e.target.value = fmtTime(n); paintVideo(e.target.closest('[data-side]'), sideOf(q, s)); }
    }
  });
  box.addEventListener('click', (e) => {
    const v = e.target.closest('[data-video]');
    if (v) { playVideo(v); return; }
    const b = e.target.closest('[data-ce]');
    if (!b) return;
    const s = sideKey(b);
    const act = b.dataset.ce;
    if (act === 'swap') {
      const f = { text: q.text, image: q.image, video: q.video };
      const bk = sideOf(q, 'back');
      q.text = bk.text || ''; q.image = bk.image || ''; q.video = bk.video || null;
      q.back = { text: f.text || '', image: f.image || '', video: f.video || null };
      api.change();
      api.redraw('[data-ce="swap"]');
      toast(__('Οι δύο όψεις άλλαξαν θέση.'), 'ok');
      return;
    }
    if (!s) return;
    const o = sideOf(q, s);
    if (act === 'noimg') { o.image = ''; api.change(); api.redraw(`[data-side="${s}"] [data-drop] input`); }
    if (act === 'vid') { openVideo.add(`${q.id}:${s}`); api.redraw(`[data-side="${s}"] [data-cf="video.url"]`); }
    if (act === 'novid') { openVideo.delete(`${q.id}:${s}`); o.video = null; api.change(); api.redraw(`[data-side="${s}"] [data-ce="vid"]`); }
  });
  // Εικόνα με σύρσιμο ή επικόλληση (Ctrl+V) στο κείμενο της όψης. / Image by dragging or pasting (Ctrl+V) into the side's text.
  box.addEventListener('dragover', (e) => {
    const z = e.target.closest && e.target.closest('[data-side]');
    if (!z || !e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    z.classList.add('is-over');
  });
  box.addEventListener('dragleave', (e) => {
    const z = e.target.closest && e.target.closest('[data-side]');
    if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-over');
  });
  box.addEventListener('drop', (e) => {
    const z = e.target.closest && e.target.closest('[data-side]');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!z || !file) return; // κείμενο που σύρθηκε: όπως πάντα / dragged text: as usual
    e.preventDefault();
    z.classList.remove('is-over');
    api.setImage(z.dataset.side, file);
  });
  box.addEventListener('paste', (e) => {
    const s = sideKey(e.target);
    const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
    const img = items.find((it) => it.kind === 'file' && /^image\//.test(it.type));
    if (!s || !img) return;
    e.preventDefault();
    api.setImage(s, img.getAsFile());
  });
}

/* ---------- προεπισκόπηση / preview ---------- */
export function cardPreview(q0, startBack) {
  const q = tidyQuestion(JSON.parse(JSON.stringify(q0)));
  const sides = sidesOf(q);
  let side = startBack ? 'back' : 'front';
  let flipIt = () => {}; // ορίζεται στο onOpen / set in onOpen
  return dialog({
    title: __('Προεπισκόπηση'), wide: true,
    html: `<div class="fc-pv"><div class="fc-stage"><section class="fc-card" data-card aria-labelledby="pv-tag"><p class="fc-tag" id="pv-tag" data-tag></p><div class="fc-face" data-face aria-live="polite"></div></section></div>
      <p class="fc-pv-hint">${__('Πάτα την κάρτα για να τη γυρίσεις, όπως τα παιδιά.')}</p></div>`,
    actions: [{ label: __('Γύρισε την κάρτα'), value: 'flip', check() { flipIt(); return false; } }, { label: __('Κλείσιμο'), value: null, kind: 'primary' }],
    onOpen(dlg) {
      const card = dlg.querySelector('[data-card]');
      paint();
      card.addEventListener('click', (e) => {
        const v = e.target.closest('[data-video]');
        if (v) { playVideo(v); return; }
        if (e.target.closest('a, button, iframe, video')) return;
        flipIt();
      });
      function paint() {
        dlg.querySelector('[data-face]').innerHTML = sideHtml(sides[side]);
        dlg.querySelector('[data-tag]').textContent = sideName(side);
        card.classList.toggle('is-back', side === 'back');
      }
      flipIt = () => { side = side === 'front' ? 'back' : 'front'; paint(); };
    }
  });
}

/* ---------- κάρτες από ερωτήσεις κουίζ / cards from quiz questions ---------- */
export function cardFromQuestion(q) {
  const t = TYPES[q && q.type];
  if (!t || !t.scored || q.type === 'label' || q.type === 'card') return null;
  let front = String(q.text || '').trim();
  if (q.type === 'dropdown' || q.type === 'drag') front = [front, parseCloze(q.cloze || '').map((p) => (p.blank ? '…' : p.t)).join('').trim()].filter(Boolean).join('\n');
  if (q.type === 'underline') front = [front, String(q.passage || '').replace(/[[\]]/g, '').trim()].filter(Boolean).join('\n');
  const back = [String(t.correct(q) || '').trim(), String(q.explain || '').trim()].filter(Boolean).join('\n\n');
  if (!front && !q.image) return null;
  return Object.assign(newQuestion('card', 'q' + rid(8)), {
    text: front.slice(0, CARD_TEXT_MAX), image: q.image || '', video: null,
    back: { text: back.slice(0, CARD_TEXT_MAX), image: '', video: null }
  });
}
/* Ερωτήσεις → κάρτες, με εικόνες στο μέγεθος των καρτών. / Questions → cards, with pictures at card size. */
export async function cardsFromQuestions(questions) {
  const cards = [];
  for (const q of questions || []) {
    const c = cardFromQuestion(q);
    if (!c) continue;
    if (c.image) c.image = await slimImage(c.image, CARD.dim, CARD.bytes);
    cards.push(c);
  }
  return cards;
}

/* Παράθυρο «Κάρτες από κουίζ»: επιστρέφει { cards, skipped, title } ή null. */
export async function quizImportDialog(currentId) {
  let games = [];
  try { games = await DB.listGames(); } catch (e) { toast(errText(e), 'error'); return null; }
  games = games.filter((g) => g.id !== currentId && !isDeck(g) && (g.count || 0) > 0).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!games.length) {
    await dialog({ title: __('Κάρτες από κουίζ'), text: __('Δεν έχεις ακόμη κουίζ με ερωτήσεις. Όταν φτιάξεις, οι ερωτήσεις τους μπορούν να γίνουν κάρτες με ένα πάτημα.') });
    return null;
  }
  let picked = null;
  await dialog({
    title: __('Κάρτες από κουίζ'), wide: true,
    html: `<p class="dlg-text">${__('Διάλεξε ένα κουίζ σου. Κάθε ερώτηση γίνεται κάρτα: μπροστά η ερώτηση, πίσω η σωστή απάντηση και η εξήγηση.')}</p>
      <ul class="ci-list">${games.map((g) => `<li><button type="button" class="ci-g" data-gid="${esc(g.id)}"><span class="ci-e" aria-hidden="true">${esc((g.cover && g.cover.emoji) || '🧠')}</span><span class="ci-t"><b>${esc(g.title || __('Χωρίς τίτλο'))}</b><small>${plural(g.count || 0, __('ερώτηση'), __('ερωτήσεις'))}</small></span></button></li>`).join('')}</ul>`,
    actions: [{ label: __('Άκυρο'), value: null }],
    focus: '.ci-g',
    onOpen(dlg, close) {
      dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-gid]'); if (b) { picked = b.dataset.gid; close('pick'); } });
    }
  });
  if (!picked) return null;
  const b = busy(__('Φτιάχνονται οι κάρτες…'));
  try {
    const g = await DB.getGame(picked);
    const qs = (g && g.questions) || [];
    const cards = await cardsFromQuestions(qs);
    return { cards, skipped: qs.length - cards.length, title: (g && g.title) || '' };
  } catch (e) {
    toast(errText(e), 'error');
    return null;
  } finally { b.close(); }
}

/* ---------- κάρτες από κείμενο / cards from text ----------
   Μία κάρτα σε κάθε γραμμή: μπροστά και πίσω χωρισμένα με Tab (από Excel ή Quizlet), |, = ή παύλα με κενά.
   Όχι με «;»: στα ελληνικά είναι το ερωτηματικό. Ένας σύνδεσμος βίντεο σε μια όψη γίνεται βίντεο.
   One card per line: front and back separated by Tab (from Excel or Quizlet), |, = or a spaced dash.
   Not with ";": in Greek it is the question mark. A video link on a side becomes a video. */
const SEPS = [/\t+/, /\s*\|\s*/, /\s+=\s+/, /\s+[-–—]\s+/];
function sideFromText(t) {
  const info = videoInfo(t);
  if (info) return { text: '', image: '', video: { url: t, start: info.start || 0, end: 0 } };
  return { text: t.slice(0, CARD_TEXT_MAX), image: '', video: null };
}
export function parseCardsText(src) {
  return String(src || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    let front = line, back = '';
    for (const re of SEPS) {
      const m = re.exec(line);
      if (m && m.index > 0) { front = line.slice(0, m.index).trim(); back = line.slice(m.index + m[0].length).trim(); break; }
    }
    const f = sideFromText(front), b = sideFromText(back);
    return Object.assign(newQuestion('card', 'q' + rid(8)), { text: f.text, video: f.video, back: b });
  });
}
export function textImportDialog(room) {
  let cards = null;
  return dialog({
    title: __('Κάρτες από κείμενο'), wide: true,
    html: `<div class="imp"><div class="imp-help"><p>${__('Γράψε ή επικόλλησε μία κάρτα σε κάθε γραμμή: πρώτα η μπροστινή όψη, μετά η πίσω, χωρισμένες με παύλα ( - ), με = ή με |.')}</p>
      <p>${__('Από Excel, Google Sheets ή Quizlet: αντέγραψε δύο στήλες και επικόλλησέ τες εδώ.')}</p></div>
      <pre class="imp-ex">${esc(__('σκύλος - dog\nγάτα - cat\nΠρωτεύουσα της Γαλλίας; - Παρίσι\nΠόσο κάνει 7 × 8; = 56'))}</pre>
      <label class="label" for="imp-c">${__('Οι κάρτες σου')}</label><textarea class="input" id="imp-c" rows="9"></textarea>
      <div class="imp-res" aria-live="polite"></div></div>`,
    focus: '#imp-c',
    actions: [{ label: __('Άκυρο'), value: null }, {
      label: __('Πρόσθεσε τις κάρτες'), kind: 'primary', value: 'add',
      check(dlg) {
        cards = parseCardsText(dlg.querySelector('#imp-c').value);
        const res = dlg.querySelector('.imp-res');
        if (!cards.length) { res.innerHTML = `<span class="err">${__('Δεν βρέθηκαν κάρτες. Γράψε μία κάρτα σε κάθε γραμμή.')}</span>`; return false; }
        if (cards.length > room) { res.innerHTML = `<span class="err">${__('Χωράνε ακόμη {0} κάρτες σε αυτό το παιχνίδι.', room)}</span>`; return false; }
        return true;
      }
    }],
    onOpen(dlg) {
      const ta = dlg.querySelector('#imp-c');
      const res = dlg.querySelector('.imp-res');
      ta.addEventListener('input', () => {
        const list = parseCardsText(ta.value);
        if (!ta.value.trim()) { res.innerHTML = ''; return; }
        const noBack = list.filter((c) => sideEmpty(c.back)).length;
        const rows = list.slice(0, 4).map((c) => { const r = railTexts(c); return `<tr><td>${esc(r.front)}</td><td>${r.back ? esc(r.back) : `<span class="muted">${__('(κενή)')}</span>`}</td></tr>`; }).join('');
        res.innerHTML = `<p>${list.length === 1 ? __('Θα γίνει 1 κάρτα.') : __('Θα γίνουν {0} κάρτες.', list.length)}${noBack ? ` <span class="err">${noBack === 1 ? __('Μία δεν έχει πίσω όψη: θα τη συμπληρώσεις μετά.') : __('{0} δεν έχουν πίσω όψη: θα τις συμπληρώσεις μετά.', noBack)}</span>` : ''}</p>
          <table class="imp-tbl"><thead><tr><th scope="col">${__('Μπροστά')}</th><th scope="col">${__('Πίσω')}</th></tr></thead><tbody>${rows}</tbody></table>${list.length > 4 ? `<p class="muted">${__('…και {0} ακόμη.', list.length - 4)}</p>` : ''}`;
      });
    }
  }).then((v) => (v === 'add' ? cards : null));
}

