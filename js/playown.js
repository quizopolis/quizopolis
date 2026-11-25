/* «Παίξ' το»: ο εκπαιδευτικός παίζει το δικό του παιχνίδι όπως θα το έπαιζαν τα παιδιά, για δοκιμή
   ή όλη η τάξη μαζί στην οθόνη. Τρέχει στην προσωρινή βάση της σελίδας: δεν αποθηκεύεται τίποτα
   και δεν φαίνεται στα αποτελέσματα.
   "Play it": the teacher plays their own game the way children would, as a test or with the whole
   class on the screen. It runs on the page's throwaway store: nothing is saved or shown in the results. */
import { DB, useSandbox } from './store.js';
import { CFG, dialog } from './ui.js';
import { TYPES, validateQuestion, tidyQuestion } from './qtypes.js';
import { MODES } from './modes.js';
import { TEAM_SET, pickTeam } from './scoring.js';
import { __, LANG } from './i18n.js';
import { linkModeOf, NEED } from './choose.js';

const SB_EMAIL = 'try@quizopolis.local', SB_PW = 'try-quizopolis';

/* Ο τρόπος με τον οποίο παίζεται από τις συσκευές, ή null (π.χ. παιχνίδι μόνο για προβολέα). */
export const deviceModeOf = (id) => { const m = linkModeOf(id); return m && !/^stage-/.test(id || '') ? m : null; };

/* Τι λείπει για να παιχτεί, ή '' αν είναι έτοιμο. */
export function playProblem(questions, mode) {
  const ok = (questions || []).filter((q) => TYPES[q.type] && !validateQuestion(q).length);
  if (!ok.length) return __('Πρόσθεσε και συμπλήρωσε τουλάχιστον μία ερώτηση.');
  if (MODES[mode] && MODES[mode].group === 'review' && ok.filter((q) => TYPES[q.type].scored).length < NEED) {
    return __('Το παιχνίδι «{0}» χρειάζεται τουλάχιστον {1} ερωτήσεις με σωστή απάντηση.', MODES[mode].label, NEED);
  }
  return '';
}

/* src: παιχνίδι ή σύνδεσμος (με questions, title, cover και, για σύνδεσμο, mode/settings/roster).
   opts: mode, name (όνομα παίκτη), back (πού γυρίζει η «Έξοδος»), join (περνά από τη σελίδα εισόδου). */
export async function playOwn(src, ctx, opts = {}) {
  const mode = MODES[opts.mode] ? opts.mode : deviceModeOf(src.mode) || 'classic';
  const problem = playProblem(src.questions, mode);
  if (problem) { dialog({ title: __('Δεν μπορεί να παιχτεί ακόμη'), text: problem }); return false; }
  const questions = src.questions.filter((q) => TYPES[q.type] && !validateQuestion(q).length).map((q) => tidyQuestion(JSON.parse(JSON.stringify(q))));
  const me = DB.user && !DB.sandbox ? DB.user() : null;
  const first = me && me.name ? String(me.name).trim().split(/\s+/)[0] : '';
  const name = opts.name || first || __('Δοκιμή');
  const SB = await useSandbox();
  if (!SB.user()) { try { await SB.signUp(SB_EMAIL, SB_PW, CFG.siteName); } catch (e) { await SB.signIn(SB_EMAIL, SB_PW); } }
  const settings = Object.assign({}, MODES[mode].defaults, src.mode === mode && src.settings ? src.settings : {});
  if (mode === 'picture' && !settings.picture) settings.picture = 'auto';
  const body = {
    gameId: null, title: src.title || __('Χωρίς τίτλο'), mode, settings, questions, cover: src.cover || null,
    classId: null, roster: opts.join && Array.isArray(src.roster) && src.roster.length ? src.roster.slice() : null,
    status: 'live', startedAt: Date.now(), lang: LANG, deadline: null, sandbox: true,
    own: { back: opts.back || '/t' }
  };
  if (mode === 'team') body.teams = Array.isArray(src.teams) && src.teams.length ? src.teams : TEAM_SET.slice(0, Math.max(2, Math.min(6, Number(settings.teams) || 4)));
  const { id: sid } = await SB.createSession(body);
  await SB.signOut();
  if (opts.join) { ctx.go('/g/' + sid); return true; }
  const uid = await SB.ensureStudent();
  const player = { name, joinedAt: Date.now(), score: 0, correct: 0, answered: 0, streak: 0, bestStreak: 0, answers: {}, done: false };
  if (mode === 'team') player.team = pickTeam([], body.teams);
  await SB.joinSession(sid, uid, player);
  ctx.go('/play/' + sid);
  return true;
}
