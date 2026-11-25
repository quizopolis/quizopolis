/*
  Στατιστικά κάθε συνδέσμου, αποθηκευμένα μαζί με την κάρτα του στη λίστα (sessionIndex/{id}.stats).
  Ο πίνακας «Αποτελέσματα» διαβάζει μόνο αυτά. Τους μαθητές ενός συνδέσμου τους ξαναδιαβάζει μόνο όταν
  κάτι άλλαξε, ώστε να μένουμε άνετα μέσα στο δωρεάν όριο του Firebase.

  Per-link statistics, stored with the link's list card (sessionIndex/{id}.stats).
  The Results dashboard reads only these. It re-reads a link's students only when something changed,
  so it stays well inside Firebase's free quota.

  stats = { v, at, st (κατάσταση / state), n (μαθητές / players), d (ολοκλήρωσαν / done), r (λίστα τάξης / roster size),
            p: [{ n: όνομα / name, a: % σωστά με ένα δεκαδικό ή null / % correct with one decimal or null, d: 1|0 }],
            q: [{ i: id ερώτησης / question id, t: κείμενο / text, a: % σωστά / % correct, c: απαντήσεις / answers }] }
*/
import { DB } from './store.js';
import { TYPES, isScored } from './qtypes.js';
import { playerStats } from './scoring.js';
import { linkState } from './teacher.js';
import { norm } from './ui.js';

export const STATS_V = 1;
const MIN = 60 * 1000;
const DAY = 864e5;

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const qText = (q) => String(q.text || '').replace(/\s+/g, ' ').trim() || (TYPES[q.type] ? TYPES[q.type].label : '');
/* Το ίδιο παιδί με λίγο διαφορετική γραφή («Γιώργος Π.», «γιωργος π») μετράει ως ένα. */
export const nameKey = (n) => norm(n).replace(/[.·,]/g, ' ').replace(/\s+/g, ' ').trim();

/* Ίδιοι υπολογισμοί με την αναφορά του συνδέσμου, για να συμφωνούν οι αριθμοί.
   Same calculations as the link's report, so the numbers agree. */
export function sessionStats(S, players) {
  const qs = S.questions || [];
  const flash = S.mode === 'flashcards';
  const p = players.map((pl) => {
    const s = playerStats(pl, qs);
    return { n: cut(String(pl.name || '?').trim() || '?', 40), a: flash || s.acc === null ? null : Math.round(s.acc * 1000) / 10, d: pl.done ? 1 : 0 };
  });
  const q = flash ? [] : qs.filter(isScored).map((qq) => {
    const ans = players.map((pl) => pl.answers && pl.answers[qq.id]).filter(Boolean);
    if (!ans.length) return null;
    const f = ans.reduce((s, a) => s + (a.known !== undefined ? (a.known ? 1 : 0) : (a.f || 0)), 0) / ans.length;
    return { i: String(qq.id), t: cut(qText(qq), 90), a: Math.round(f * 100), c: ans.length };
  }).filter(Boolean);
  return {
    v: STATS_V, at: Date.now(), st: linkState(S), n: p.length, d: p.filter((x) => x.d).length,
    r: Array.isArray(S.roster) ? S.roster.length : 0, p, q
  };
}

/*
  Τι χρειάζεται ένας σύνδεσμος / What a link needs:
  'ok'    τα αποθηκευμένα ισχύουν / the stored stats hold
  'check' ανοιχτός σύνδεσμος: πρώτα μια μέτρηση των παικτών (2 αναγνώσεις) / open link: first a player count (2 reads)
  'full'  ξαναδιάβασμα όλων των μαθητών / re-read every student
*/
export function statsPlan(meta, now = Date.now()) {
  const s = meta.stats;
  if (!s || s.v !== STATS_V) return 'full';
  if (linkState(meta) !== 'open') return s.st === 'open' ? 'full' : 'ok'; // μία τελευταία φορά μετά το κλείσιμο
  const age = now - (meta.startedAt || meta.createdAt || 0);
  const ttl = age < 2 * DAY ? 5 * MIN : age < 30 * DAY ? 30 * MIN : 24 * 60 * MIN;
  return now - (s.at || 0) > ttl ? 'check' : 'ok';
}

const checked = new Map(); // id -> πότε μετρήθηκε / when it was counted
const lite = new Map(); // id -> { mode, roster, questions } χωρίς εικόνες / without images
const saved = new Map(); // id -> τα τελευταία αποθηκευμένα / the last saved stats

const same = (a, b) => !!a && !!b && JSON.stringify(Object.assign({}, a, { at: 0 })) === JSON.stringify(Object.assign({}, b, { at: 0 }));

/* Αποθήκευση μόνο όταν άλλαξε κάτι. Λάθη αγνοούνται: τα στατιστικά είναι μόνο βοηθητικά.
   Saves only when something changed. Errors are ignored: the stats are only a helper. */
export async function storeStats(sid, stats, known) {
  if (same(stats, saved.get(sid)) || same(stats, known)) return stats;
  try {
    if (DB.saveSessionStats) await DB.saveSessionStats(sid, stats);
    saved.set(sid, stats);
  } catch (e) { /* ignore */ }
  return stats;
}

/* Από τη σελίδα της αναφοράς: οι μαθητές είναι ήδη φορτωμένοι, άρα δεν κοστίζει αναγνώσεις.
   From the report page: the students are already loaded, so this costs no reads. */
export function noteReport(S, players) {
  if (!S || !S.id) return;
  lite.set(S.id, { mode: S.mode, roster: S.roster || null, questions: (S.questions || []).map((q) => ({ id: q.id, type: q.type, text: q.text || '' })) });
  storeStats(S.id, sessionStats(S, players));
}

/* Φέρνει τα στατιστικά ενός συνδέσμου στην επικαιρότητα. Επιστρέφει τα στατιστικά ή null.
   force: 'check' = μέτρηση τώρα / count now, 'full' = ξαναδιάβασμα όλων / re-read everything.
   Brings a link's stats up to date. Returns the stats or null. */
export async function refreshStats(meta, { force = '' } = {}) {
  let plan = statsPlan(meta);
  if (force === 'full' || (force === 'check' && plan === 'ok' && meta.stats)) plan = force;
  if (plan === 'ok') return meta.stats;
  if (plan === 'check') {
    const at = checked.get(meta.id);
    if (!force && at && Date.now() - at < 5 * MIN) return meta.stats;
    const c = await DB.countPlayers(meta.id);
    checked.set(meta.id, Date.now());
    if (c.joined === meta.stats.n && c.done === meta.stats.d) return meta.stats;
  }
  let S = lite.get(meta.id);
  const playersP = DB.listPlayers(meta.id);
  if (!S) {
    const full = await DB.getSession(meta.id);
    if (!full) { await playersP.catch(() => {}); return null; }
    S = { mode: full.mode, roster: full.roster || null, questions: (full.questions || []).map((q) => ({ id: q.id, type: q.type, text: q.text || '' })) };
    lite.set(meta.id, S);
  }
  const players = await playersP;
  const stats = sessionStats(Object.assign({ id: meta.id, status: meta.status, deadline: meta.deadline }, S), players);
  checked.set(meta.id, Date.now());
  return storeStats(meta.id, stats, meta.stats);
}

export const forgetStats = (id) => { checked.delete(id); lite.delete(id); saved.delete(id); };
