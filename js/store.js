/* Επιλογή «βάσης»: Firebase (κανονική λειτουργία) ή τοπική δοκιμαστική λειτουργία. */
import { CFG } from './ui.js';

export let DB = null;

export async function initStore() {
  const fb = CFG.firebase;
  if (fb && typeof fb === 'object' && fb.apiKey && fb.projectId) {
    const m = await import('./db-firebase.js');
    DB = await m.create(fb);
  } else {
    const m = await import('./db-local.js');
    DB = m.create();
  }
  return DB;
}

/* Δοκιμή ως μαθητής: μια προσωρινή βάση στη μνήμη της σελίδας, χωριστή από την κανονική.
   Try-as-a-student: a throwaway in-memory store, separate from the real one. */
let REAL = null, SANDBOX = null;
export async function useSandbox() {
  if (!REAL) REAL = DB;
  if (!SANDBOX) {
    const m = await import('./db-local.js');
    SANDBOX = m.create({ memory: true });
    SANDBOX.sandbox = true;
  }
  DB = SANDBOX;
  return DB;
}
export function leaveSandbox() { if (REAL) { DB = REAL; REAL = null; } }
export const inSandbox = () => !!(DB && DB.sandbox);

/* Μικρές «κάρτες» για τις λίστες (βιβλιοθήκη, αναφορές), ώστε να μη φορτώνονται ολόκληρα παιχνίδια με εικόνες. */
export function gameMeta(g) {
  const qs = g.questions || [];
  return {
    id: g.id, owner: g.owner, title: g.title || '', description: g.description || '', grades: g.grades || [], subject: g.subject || '',
    cover: g.cover || null, mode: g.mode || '', count: qs.length, incomplete: g.incomplete || 0, types: Array.from(new Set(qs.map((q) => q.type))), updatedAt: g.updatedAt || 0, createdAt: g.createdAt || 0
  };
}
export function sessionMeta(s) {
  return {
    id: s.id, owner: s.owner, title: s.title || '', mode: s.mode, status: s.status, createdAt: s.createdAt || 0,
    startedAt: s.startedAt || null, deadline: s.deadline || null, classId: s.classId || null, className: s.className || null, gameId: s.gameId || null, lang: s.lang || null
  };
}

/* Κοινά για όλες τις «βάσεις». */
export function makeError(message, code) {
  const e = new Error(message);
  e.userMessage = message;
  e.code = code || 'app';
  return e;
}
