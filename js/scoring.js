/* Πόντοι, κατάταξη και ομάδες. */
import { isScored } from './qtypes.js';
import { __ } from './i18n.js';

export const BASE = 1000;
export const STREAK_STEP = 100;
export const TEAM_BONUS = 200;

/* Πόντοι μιας απάντησης.
   f: ποσοστό σωστού 0..1, elapsed: δευτερόλεπτα, limit: όριο χρόνου (0 = χωρίς), streak: σερί σωστών μαζί με αυτήν. */
export function points(q, f, elapsed, limit, streak, mult = 1) {
  if (f === null || f === undefined || !(f > 0)) return 0;
  const P = BASE * (q.double ? 2 : 1);
  const speed = limit > 0 ? 0.5 + 0.5 * Math.max(0, 1 - elapsed / limit) : 1;
  const bonus = f === 1 ? Math.min(Math.max(streak - 1, 0), 3) * STREAK_STEP : 0;
  return Math.round(((P * f * speed) + bonus) * mult / 10) * 10;
}

/* Σύνοψη ενός μαθητή από τις απαντήσεις του. */
export function playerStats(p, questions) {
  const ans = p.answers || {};
  let scored = 0, sumF = 0, full = 0, answered = 0;
  questions.forEach((q) => {
    const a = ans[q.id];
    if (!a) return;
    answered++;
    if (isScored(q) && a.f !== null && a.f !== undefined) { scored++; sumF += a.f; if (a.f === 1) full++; }
  });
  return { answered, scored, full, acc: scored ? sumF / scored : null };
}

/* Κατάταξη: πόντοι, μετά σωστές, μετά ποιος τελείωσε πρώτος. */
export function ranking(players) {
  return players.slice().sort((a, b) =>
    (b.score || 0) - (a.score || 0) ||
    (b.correct || 0) - (a.correct || 0) ||
    (a.doneAt || Infinity) - (b.doneAt || Infinity) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'el'));
}

/* Ομάδες: μέσος όρος πόντων των μελών (για να μη χάνουν οι μικρότερες ομάδες)
   + μπόνους συνεργασίας για κάθε ερώτηση που απάντησαν σωστά ΟΛΑ τα μέλη.
   Οι πόντοι της ομάδας πιστώνονται σε κάθε μέλος. */
export function teamStats(players, teams, teamOf, questions) {
  const scoredQs = questions.filter(isScored);
  const rows = teams.map((t) => {
    const members = players.filter((p) => ((teamOf && teamOf[p.uid]) || p.team) === t.id);
    const avg = members.length ? members.reduce((s, p) => s + (p.score || 0), 0) / members.length : 0;
    let bonus = 0;
    if (members.length) {
      scoredQs.forEach((q) => {
        if (members.every((p) => p.answers && p.answers[q.id] && p.answers[q.id].f === 1)) bonus += TEAM_BONUS;
      });
    }
    const correct = members.reduce((s, p) => s + (p.correct || 0), 0);
    return Object.assign({}, t, { members, avg: Math.round(avg), bonus, total: Math.round(avg) + bonus, correct });
  });
  return rows.sort((a, b) => b.total - a.total || b.correct - a.correct);
}

export const TEAM_SET = [
  { id: 't1', name: __('Αετοί'), the: __('οι Αετοί'), emoji: '🦅', color: '#2F6FE4' },
  { id: 't2', name: __('Δελφίνια'), the: __('τα Δελφίνια'), emoji: '🐬', color: '#0E8C99' },
  { id: 't3', name: __('Λύκοι'), the: __('οι Λύκοι'), emoji: '🐺', color: '#8E44D9' },
  { id: 't4', name: __('Κουκουβάγιες'), the: __('οι Κουκουβάγιες'), emoji: '🦉', color: '#C2410C' },
  { id: 't5', name: __('Χελώνες'), the: __('οι Χελώνες'), emoji: '🐢', color: '#0B7A5C' },
  { id: 't6', name: __('Αλεπούδες'), the: __('οι Αλεπούδες'), emoji: '🦊', color: '#D23A52' }
];
export const teamThe = (t) => (t && (t.the || t.name)) || '';
/* Ένα παιδί που μπαίνει μπαίνει στη μικρότερη ομάδα (με ισοπαλία, σε μία τυχαία από τις μικρότερες). */
export function pickTeam(players, teams) {
  const sizes = {};
  teams.forEach((t) => { sizes[t.id] = 0; });
  players.forEach((p) => { if (p.team && sizes[p.team] !== undefined) sizes[p.team]++; });
  const min = Math.min(...Object.values(sizes));
  const small = teams.filter((t) => sizes[t.id] === min);
  return small[Math.floor(Math.random() * small.length)].id;
}

export const POWERUPS = {
  fifty: { label: '50:50', icon: '½', desc: __('Κρύβει τις μισές λάθος απαντήσεις') },
  double: { label: __('Διπλοί πόντοι'), icon: '×2', desc: __('Διπλοί πόντοι στην επόμενη σωστή') },
  time: { label: __('Έξτρα χρόνος'), icon: '+⏱', desc: __('Μισό χρόνο ακόμη σε αυτή την ερώτηση') }
};
