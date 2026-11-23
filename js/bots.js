/* Εικονικοί μαθητές για τη δοκιμαστική λειτουργία: παίζουν αμέσως όλο το παιχνίδι. */
import { DB } from './store.js';
import { TYPES, grade, isScored } from './qtypes.js';
import { points, pickTeam } from './scoring.js';
import { isReview } from './modes.js';
import { rid } from './ui.js';
import { simAnswer } from './games/kit.js';
import { LANG } from './i18n.js';

const NAMES_EN = ['Alex P.', 'Emma K.', 'Leo M.', 'Mia S.', 'Noah A.', 'Chloe L.', 'Sam T.', 'Zoe H.', 'Max B.', 'Lily D.', 'Ben Z.', 'Ruby R.',
  'Theo N.', 'Grace F.', 'Jack O.', 'Ella I.', 'Finn G.', 'Ava E.', 'Oscar K.', 'Isla P.', 'Leon L.', 'Nina M.', 'Adam S.', 'Maya T.'];
const NAMES_EL = ['Νίκος Π.', 'Ελένη Κ.', 'Γιώργος Μ.', 'Μαρία Σ.', 'Δημήτρης Α.', 'Κατερίνα Λ.', 'Γιάννης Τ.', 'Σοφία Χ.',
  'Αλέξης Β.', 'Αναστασία Δ.', 'Κώστας Ζ.', 'Ιωάννα Ρ.', 'Παναγιώτης Ν.', 'Χριστίνα Φ.', 'Στέφανος Ο.', 'Δέσποινα Ι.',
  'Θοδωρής Γ.', 'Βασιλική Ε.', 'Μάνος Κ.', 'Ζωή Π.', 'Άρης Λ.', 'Φωτεινή Μ.', 'Λευτέρης Σ.', 'Μυρτώ Τ.'];

export async function simulatePlayers(sid, S, count, existing = []) {
  const NAMES = (S.lang || LANG) === 'en' ? NAMES_EN : NAMES_EL;
  const taken = existing.map((p) => p.name);
  const free = NAMES.filter((n) => !taken.includes(n));
  const qs = S.questions || [];
  const st = S.settings || {};
  const players = existing.slice();
  let gameMod = null;
  if (isReview(S.mode)) {
    const file = { swim: 'race' }[S.mode] || S.mode;
    gameMod = await import(`./games/${file}.js`);
  }
  for (let i = 0; i < count; i++) {
    const name = free.length ? free[i % free.length] + (i >= free.length ? ` ${Math.floor(i / free.length) + 1}` : '') : `${NAMES === NAMES_EN ? 'Student' : 'Μαθητής'} ${i + 1}`;
    const uid = 'bot-' + rid(8);
    const skill = 0.45 + Math.random() * 0.5;
    const ago = Math.round(Math.random() * 3600e3);
    const P = { uid, name, joinedAt: Date.now() - ago - 600e3, score: 0, correct: 0, answered: 0, streak: 0, bestStreak: 0, answers: {}, done: true, doneAt: Date.now() - ago };
    if (S.mode === 'team' && Array.isArray(S.teams)) P.team = pickTeam(players, S.teams);
    if (gameMod && gameMod.simulate) {
      Object.assign(P, gameMod.simulate(S, skill), { plays: 1 });
    } else if (S.mode === 'flashcards') {
      qs.filter(isScored).forEach((q) => { const known = Math.random() < skill; P.answers[q.id] = { v: null, f: null, known, n: known ? 1 : 2, pts: 0, t: 0 }; });
      P.correct = Object.values(P.answers).filter((a) => a.known).length;
      P.answered = Object.keys(P.answers).length;
    } else {
      let streak = 0;
      qs.forEach((q) => {
        const r = simAnswer(q, skill);
        if (r.f !== null) { streak = r.f === 1 ? streak + 1 : 0; P.bestStreak = Math.max(P.bestStreak, streak); }
        const limit = st.timer ? (q.time || 0) : 0;
        const pts = S.mode === 'test' ? 0 : points(q, r.f, r.t / 1000, limit, streak, 1);
        P.answers[q.id] = { v: r.a, f: r.f, pts, t: r.t, n: 1 };
        P.score += pts;
        if (r.f === 1) P.correct++;
      });
      P.answered = Object.keys(P.answers).length;
      if (S.mode === 'mastery') {
        const done = qs.filter((q) => !isScored(q) || P.answers[q.id].f === 1).length;
        P.mastery = { done, total: qs.length, pct: qs.length ? done / qs.length : 0 };
      }
    }
    DB.botWrite(sid, uid, P);
    players.push(P);
  }
}

export { grade, TYPES };
