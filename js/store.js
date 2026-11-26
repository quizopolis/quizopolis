/* Επιλογή «βάσης»: Firebase (κανονική λειτουργία) ή τοπική δοκιμαστική λειτουργία. */
import { CFG } from './ui.js';

export let DB = null;

// Με Firebase, η λήψη του ξεκινά αμέσως, παράλληλα με την υπόλοιπη σελίδα.
// With Firebase, its download starts right away, alongside the rest of the page.
const FB = CFG.firebase && typeof CFG.firebase === 'object' && CFG.firebase.apiKey && CFG.firebase.projectId ? CFG.firebase : null;
const fbModule = FB ? import('./db-firebase.js') : null;
if (fbModule) fbModule.catch(() => {});

export async function initStore() {
  if (FB) {
    const m = await fbModule;
    DB = await m.create(FB);
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

/* Οι εικόνες ενός συνδέσμου φυλάγονται σε χωριστό έγγραφο (sessions/{id}-img, ίδιοι κανόνες με τον σύνδεσμο),
   ώστε η σελίδα του παιχνιδιού να ανοίγει αμέσως και οι εικόνες να έρχονται όσο το παιδί γράφει το όνομά του.
   A link's pictures live in a separate document (sessions/{id}-img, same rules as the link), so the game page
   opens at once and the pictures arrive while the child types their name. */
export const mediaId = (sid) => sid + '-img';
const isData = (v) => typeof v === 'string' && /^data:image\//.test(v);
const BACK = '_b'; // η πίσω όψη μιας κάρτας / a card's back side
export function splitImages(s) {
  const images = {};
  const questions = (s.questions || []).map((q) => {
    if (!q) return q;
    const front = isData(q.image);
    const back = !!(q.back && isData(q.back.image));
    if (!front && !back) return q;
    const c = Object.assign({}, q);
    if (front) { images[q.id] = q.image; delete c.image; }
    if (back) { images[q.id + BACK] = q.back.image; c.back = Object.assign({}, q.back); delete c.back.image; }
    return c;
  });
  let settings = s.settings;
  if (settings && settings.picture && isData(settings.picture.image)) {
    images['@picture'] = settings.picture.image;
    settings = Object.assign({}, settings, { picture: Object.assign({}, settings.picture) });
    delete settings.picture.image;
  }
  if (!Object.keys(images).length) return { lite: s, images: null };
  return { lite: Object.assign({}, s, { questions, settings, media: true }), images };
}
export function withImages(s, images) {
  if (!s || !images) return s;
  const out = Object.assign({}, s, {
    questions: (s.questions || []).map((q) => {
      if (!q) return q;
      const front = !q.image && images[q.id];
      const back = q.back && typeof q.back === 'object' && !q.back.image && images[q.id + BACK];
      if (!front && !back) return q;
      const c = Object.assign({}, q);
      if (front) c.image = front;
      if (back) c.back = Object.assign({}, q.back, { image: back });
      return c;
    })
  });
  const pic = out.settings && out.settings.picture;
  if (images['@picture'] && pic && typeof pic === 'object' && !pic.image) out.settings = Object.assign({}, out.settings, { picture: Object.assign({}, pic, { image: images['@picture'] }) });
  return out;
}

