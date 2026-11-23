/* Γλώσσα της πλατφόρμας: ελληνικά (προεπιλογή) ή αγγλικά.
   Τα κείμενα γράφονται στον κώδικα στα ελληνικά και περνούν από τη __(), που τα μεταφράζει όταν η γλώσσα είναι αγγλικά.
   Η γλώσσα έρχεται από τη διεύθυνση (?lang=en), αλλιώς από την τελευταία επιλογή στον διακόπτη σε αυτή τη συσκευή, αλλιώς από το config.js.
   Language of the platform. Texts are written in Greek in the code and pass through __(), which translates them in English mode. */
import { EN } from './lang-en.js';

const STORE = 'qz:lang';
export const LANGS = [{ id: 'el', label: 'Ελληνικά', short: 'ΕΛ' }, { id: 'en', label: 'English', short: 'EN' }];
const ok = (l) => l === 'el' || l === 'en';

function pick() {
  let l = null;
  try { l = new URL(location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
  // Η γλώσσα του συνδέσμου ισχύει για τη σελίδα που ανοίγει. Αποθηκεύεται μόνο αν η συσκευή δεν έχει ήδη γλώσσα:
  // ο εκπαιδευτικός που δοκιμάζει έναν αγγλικό σύνδεσμο κρατά τις δικές του σελίδες στα ελληνικά.
  if (ok(l)) {
    try { if (!ok(localStorage.getItem(STORE))) localStorage.setItem(STORE, l); } catch (e) { /* ignore */ }
    return l;
  }
  try { l = localStorage.getItem(STORE); } catch (e) { l = null; }
  if (ok(l)) return l;
  const cfg = (window.QUIZOPOLIS_CONFIG || window.LUDUS_CONFIG || window.ALANA_CONFIG || {}).lang;
  return ok(cfg) ? cfg : 'el';
}

export const LANG = pick();
export const LOCALE = LANG === 'en' ? 'en-GB' : 'el-GR';
try { document.documentElement.lang = LANG; } catch (e) { /* ignore */ }
const DICT = LANG === 'en' ? EN : null;
const missing = new Set();

/* __('Ερώτηση {0} από {1}', 3, 10) → «Question 3 of 10» στα αγγλικά. */
export function __(key, ...args) {
  let s = key;
  if (DICT) {
    const v = DICT[key];
    if (v !== undefined) s = v;
    else if (!missing.has(key)) {
      missing.add(key);
      if (window.QZ_I18N_DEBUG) console.warn('i18n: missing', JSON.stringify(key));
    }
  }
  return args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (args[i] === undefined || args[i] === null ? '' : String(args[i]))) : s;
}
export const missingKeys = () => Array.from(missing);

/* Τακτικά αριθμητικά για θέσεις: 1η / 1st. */
export function ordinal(n) {
  if (LANG !== 'en') return `${n}η`;
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suf}`;
}

/* Η διεύθυνση της τρέχουσας σελίδας σε άλλη γλώσσα (κρατά τα υπόλοιπα στοιχεία της διεύθυνσης). */
export function urlInLang(l, hash) {
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  if (hash !== undefined) u.hash = hash;
  return u.toString();
}
/* Οι σελίδες του εκπαιδευτικού κρατούν τη γλώσσα του, αν δεν έχει διαλέξει ακόμη από τον διακόπτη. */
export function rememberLang() {
  try { if (!ok(localStorage.getItem(STORE))) localStorage.setItem(STORE, LANG); } catch (e) { /* ignore */ }
}
export function setLang(l) {
  if (!ok(l) || l === LANG) return;
  try { localStorage.setItem(STORE, l); } catch (e) { /* ignore */ }
  location.replace(urlInLang(l));
}
