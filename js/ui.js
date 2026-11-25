/* Κοινά εργαλεία οθόνης: ασφαλές HTML, μηνύματα, διάλογοι, μορφοποίηση, εικονίδια. */

import { __, LOCALE, LANG, LANGS, urlInLang, setLang } from './i18n.js';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const RAW_CFG = window.QUIZOPOLIS_CONFIG || window.LUDUS_CONFIG || window.ALANA_CONFIG || null;
export const CFG = Object.assign({ siteName: 'Quizopolis', firebase: null }, RAW_CFG || {});
// Οι παλιές εκδόσεις (Αλάνα, Ludus) είχαν άλλο όνομα στο config.js: παίρνουν αυτόματα το νέο.
if (!CFG.siteName || /^(ludus|αλάνα|αλανα)$/i.test(String(CFG.siteName).trim())) CFG.siteName = 'Quizopolis';
CFG.tagline = __(CFG.tagline || 'Παιχνίδια επανάληψης για την τάξη');
// Αν το config.js έχει λάθος σύνταξης, η ρύθμιση δεν υπάρχει: το λέμε στην αρχική σελίδα.
export const CONFIG_BROKEN = !RAW_CFG;

export function app() { return document.getElementById('app'); }

export function setTitle(t) { document.title = t ? `${t} · ${CFG.siteName}` : CFG.siteName; }

/* ---------- μορφοποίηση ---------- */
export const num = (n) => Math.round(Number(n) || 0).toLocaleString(LOCALE);
export const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function fmtDate(ms, withTime = true) {
  if (!ms) return '';
  const d = new Date(ms);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString(LOCALE, opts);
}
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('el').replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function rid(n = 10) {
  const abc = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  const buf = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(n)) : null;
  for (let i = 0; i < n; i++) s += abc[(buf ? buf[i] : Math.floor(Math.random() * 256)) % abc.length];
  return s;
}
export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = (...args) => { clearTimeout(t); fn(...args); };
  d.cancel = () => clearTimeout(t);
  return d;
}
export const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.22 ? '#142033' : '#fff';
}
export function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  }).join('');
}

/* ---------- σταθερές ---------- */
/* Οι τάξεις και τα μαθήματα αποθηκεύονται με το ελληνικό τους όνομα και εμφανίζονται μεταφρασμένα. */
export const GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'Στ΄', 'Γυμνάσιο', 'Λύκειο'];
export const SUBJECTS = ['Γλώσσα', 'Μαθηματικά', 'Μελέτη Περιβάλλοντος', 'Ιστορία', 'Γεωγραφία', 'Φυσικά', 'Φυσική', 'Χημεία',
  'Βιολογία', 'Θρησκευτικά', 'Κοινωνική και Πολιτική Αγωγή', 'Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Πληροφορική', 'Μουσική',
  'Εικαστικά', 'Αρχαία', 'Λογοτεχνία', 'Εργαστήρια Δεξιοτήτων', 'Γενικές γνώσεις'];
export const COVERS = ['#0B7A5C', '#2F6FE4', '#E2445C', '#8E44D9', '#F4A80B', '#0FA3B1', '#C2410C', '#334155'];
export const EMOJIS = ['🧠', '📚', '🔢', '➗', '📐', '🧮', '🍕', '🌍', '🗺️', '🏛️', '🔬', '⚡', '🌱', '🦉', '🎨', '🎵',
  '⚽', '✏️', '🔤', '💬', '🚀', '⭐', '🧩', '🏆', '🌋', '🧪', '💡', '⏳', '📜', '🇬🇷'];

/* ---------- εικονίδια ---------- */
const P = (d, extra = '') => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ${extra}><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ICON = {
  back: P('M15 5l-7 7 7 7'),
  plus: P('M12 5v14M5 12h14'),
  play: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  edit: P('M4 20h4L19 9l-4-4L4 16zM14 6l4 4'),
  copy: P('M9 9h11v11H9zM5 15H4V4h11v1'),
  trash: P('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'),
  users: P('M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8'),
  chart: P('M4 20V10M10 20V4M16 20v-7M22 20H2'),
  logout: P('M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11'),
  check: P('M5 12.5l4.5 4.5L19 7.5'),
  x: P('M6 6l12 12M18 6L6 18'),
  clock: P('M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18'),
  trophy: P('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3'),
  full: P('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  gear: P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2'),
  book: P('M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M19 19v2H6'),
  flame: P('M12 21a7 7 0 0 0 7-7c0-4-3-6-4-9-2 2-2 4-2 5-1-1-2-2-2-4-3 2-6 5-6 8a7 7 0 0 0 7 7'),
  bolt: P('M13 2L4 14h7l-1 8 9-12h-7z'),
  eye: P('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'),
  next: P('M9 5l7 7-7 7'),
  download: P('M12 4v11M7 10l5 5 5-5M5 20h14'),
  upload: P('M12 20V9M7 14l5-5 5 5M5 4h14'),
  grip: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g></svg>',
  up: P('M12 19V5M6 11l6-6 6 6'),
  down: P('M12 5v14M6 13l6 6 6-6'),
  stop: P('M6 6h12v12H6z'),
  share: P('M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6'),
  screen: P('M3 4h18v12H3zM8 20h8M12 16v4'),
  link: P('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  lock: P('M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'),
  unlock: P('M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2'),
  sound: P('M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'),
  mute: P('M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6'),
  home: P('M3 11l9-7 9 7M5 9.5V20h14V9.5'),
  grid: P('M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z'),
  search: P('M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2'),
  send: P('M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z'),
  chev: P('M6 9l6 6 6-6'),
  msg: P('M20.5 12a8 8 0 0 1-11.8 7.1L3.5 20.5l1.4-5A8 8 0 1 1 20.5 12z'),
  image: P('M3.5 4.5h17v15h-17zM9 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6M20.5 16l-4.5-4.5L6 19.5'),
  user: P('M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4.5 20.5c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7'),
  heart: P('M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10C19.5 15.6 12 20 12 20z'),
  teach: P('M3 4h18v12H3zM7 20h10M12 16v4M7.5 9.5h5M7.5 12.5h8'),
  more: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g></svg>'
};

/* Μικρό μενού κάτω από ένα κουμπί (π.χ. «⋯»). items: [{ label, icon, act, danger }] ή '-' για διαχωριστικό. */
/* Πού οδηγεί η «Έξοδος» ενός παιχνιδιού: στην αρχή, ή πίσω στον εκπαιδευτικό όταν δοκιμάζει το δικό του. */
// Πού οδηγεί το «Έξοδος» του παιχνιδιού: ο εκπαιδευτικός γυρίζει στη σελίδα του, ο επισκέπτης στις δοκιμές,
// και τα παιδιά στην κατάταξη του παιχνιδιού τους, ποτέ στην αρχική σελίδα.
// Where a game's "Exit" leads: the teacher back to their page, a visitor to the try page,
// and children to their game's ranking, never to the home page.
export const exitHref = (S) => {
  if (S && S.own && /^\/t(\/|$)/.test(S.own.back || '')) return '#' + S.own.back;
  if (S && S.sandbox) return '#/try';
  return S && S.id ? `#/board/${S.id}` : '#/';
};

export function popMenu(btn, items) {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button type="button" role="menuitem" data-mi="${i}"${it.danger ? ' class="is-danger"' : ''}>${it.icon || ''}<span>${esc(it.label)}</span></button>`)).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  const left = Math.min(Math.max(8, r.right - w), document.documentElement.clientWidth - w - 8);
  const up = r.bottom + 6 + h > window.innerHeight && r.top - 6 - h > 0;
  m.style.left = `${left + window.scrollX}px`;
  m.style.top = `${(up ? r.top - 6 - h : r.bottom + 6) + window.scrollY}px`;
  btn.setAttribute('aria-expanded', 'true');
  const buttons = Array.from(m.querySelectorAll('button'));
  const close = (focusBack) => {
    m.remove();
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', key, true);
    if (focusBack) btn.focus();
  };
  const outside = (e) => { if (!m.contains(e.target) && !btn.contains(e.target)) close(false); };
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Tab') { close(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
    }
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mi]');
    if (!b) return;
    close(false);
    items[Number(b.dataset.mi)].act();
  });
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', key, true); }, 0);
  if (buttons[0]) buttons[0].focus();
  return close;
}

/* Αρχικά ονόματος για το στρογγυλό σήμα (π.χ. «Μαρία Παπαδοπούλου» → «ΜΠ»). */
export function initials(name) {
  const w = String(name || '').replace(/[^\p{L}\p{N}\s.-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '?';
  const a = Array.from(w[0])[0] || '';
  const b = w.length > 1 ? Array.from(w[w.length - 1])[0] || '' : Array.from(w[0])[1] || '';
  return (a + b).toLocaleUpperCase(LOCALE).replace(/[ΆΈΉΊΌΎΏ]/g, (c) => ({ Ά: 'Α', Έ: 'Ε', Ή: 'Η', Ί: 'Ι', Ό: 'Ο', Ύ: 'Υ', Ώ: 'Ω' })[c]);
}
/* Ένα σταθερό απαλό χρώμα για κάθε όνομα. */
const AVC = [['#DDE9FF', '#1E4FB8'], ['#FFE3D6', '#B4461A'], ['#E6F6EA', '#1B7A3D'], ['#F3E5FF', '#7034B8'], ['#FFF1C7', '#8A6100'], ['#DDF4F7', '#0B6F7C'], ['#FFE2EA', '#A8234B'], ['#ECEFF3', '#3F4A57']];
export function avatar(name, cls = '') {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const [bg, fg] = AVC[Math.abs(h) % AVC.length];
  return `<span class="av${cls ? ' ' + cls : ''}" style="background:${bg};color:${fg}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/* Λογότυπο: το Q της Quizopolis, ένας κύκλος με κίτρινη ουρά (θυμίζει και μεγεθυντικό φακό). */
export const LOGO = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="currentColor"/><circle cx="18.5" cy="18.5" r="8.3" fill="none" stroke="#fff" stroke-width="4.4"/><path d="M23.8 23.8l6.6 6.6" stroke="#FFC23C" stroke-width="4.4" stroke-linecap="round"/></svg>';

/* Κουμπί γλώσσας: σύνδεσμοι που ξαναφορτώνουν τη σελίδα στην άλλη γλώσσα. */
export function langSwitch(cls = '') {
  return `<span class="lang-sw ${cls}" role="group" aria-label="Γλώσσα / Language">${LANGS.map((l) => (l.id === LANG
    ? `<span class="lang-b is-on" lang="${l.id}" aria-current="true" title="${l.label}">${l.short}</span>`
    : `<a class="lang-b" lang="${l.id}" href="${esc(urlInLang(l.id))}" title="${l.label}">${l.short}</a>`)).join('')}</span>`;
}

/* Η αλλαγή γλώσσας κρατά τη σελίδα που είναι ανοιχτή τώρα (και όχι αυτή που ήταν όταν φτιάχτηκε το κουμπί). */
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a.lang-b[lang]') : null;
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  setLang(a.getAttribute('lang'));
});

/* ---------- μηνύματα ---------- */
export function toast(msg, kind) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' toast-' + kind : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, kind === 'error' ? 5500 : 3200);
}

/* Διάλογος. Επιστρέφει την τιμή του κουμπιού που πατήθηκε, ή null (Escape / κλικ έξω).
   o: { title, text, html, actions: [{label, value, kind, check(dlg)}], wide, focus, onOpen(dlg, close) } */
export function dialog(o) {
  return new Promise((resolve) => {
    const tb = document.getElementById('toasts');
    if (tb) tb.replaceChildren();
    const prev = document.activeElement;
    const actions = o.actions || [{ label: __('Εντάξει'), value: true, kind: 'primary' }];
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    wrap.innerHTML = `<div class="dlg${o.wide ? ' dlg-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 class="dlg-t" id="dlg-t">${esc(o.title || '')}</h2>
      ${o.text ? `<p class="dlg-text">${esc(o.text)}</p>` : ''}${o.html || ''}
      <div class="dlg-actions">${actions.map((a, i) => `<button type="button" class="btn${a.kind ? ' btn-' + a.kind : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(wrap);
    let done = false;
    const close = (v) => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
      if (e.key === 'Tab') {
        const f = $$('button:not([disabled]), input, textarea, select, a[href]', wrap);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b && wrap.contains(b) && b.parentElement.classList.contains('dlg-actions')) {
        const a = actions[Number(b.dataset.i)];
        if (a.check && a.check(wrap.querySelector('.dlg')) === false) return;
        close(a.value);
        return;
      }
      if (e.target === wrap) close(null);
    });
    if (o.onOpen) o.onOpen(wrap.querySelector('.dlg'), close);
    const f = wrap.querySelector(o.focus || '.dlg-actions .btn:last-child');
    if (f) f.focus();
  });
}
export const dialogOpen = () => !!document.querySelector('.dlg-wrap');

export function confirmDanger(title, text, label = __('Διαγραφή')) {
  return dialog({ title, text, actions: [{ label: __('Άκυρο'), value: false }, { label, value: true, kind: 'danger' }] })
    .then((v) => v === true);
}

export function busy(text) {
  const o = document.createElement('div');
  o.className = 'dlg-wrap';
  o.innerHTML = `<div class="dlg dlg-busy" role="alertdialog" aria-live="assertive"><span class="spinner" aria-hidden="true"></span><p></p></div>`;
  o.querySelector('p').textContent = text;
  document.body.appendChild(o);
  return { set: (t) => { o.querySelector('p').textContent = t; }, close: () => o.remove() };
}

export function copy(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
  };
  try {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
  } catch (e) { /* fall through */ }
  return fallback();
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* Fullscreen για ένα στοιχείο (αν το υποστηρίζει ο browser). */
export function fullscreenToggle(node) {
  const can = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  if (!can) return null;
  return () => {
    const cur = document.fullscreenElement || document.webkitFullscreenElement;
    if (cur) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const req = node.requestFullscreen || node.webkitRequestFullscreen;
      try { const p = req.call(node); if (p && p.catch) p.catch(() => {}); } catch (e) { /* refused */ }
    }
  };
}
export function exitFullscreen() {
  const cur = document.fullscreenElement || document.webkitFullscreenElement;
  if (cur) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ignore */ } }
}

export function errText(e) {
  if (!e) return __('Άγνωστο σφάλμα.');
  return e.userMessage || e.message || String(e);
}

/* Μικρή, σταθερή αποθήκευση στη συσκευή (με try/catch γιατί κάποιοι browsers την μπλοκάρουν). */
export const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};
