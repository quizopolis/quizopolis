/*
  Δοκιμαστική λειτουργία: όλα μένουν στον browser αυτής της συσκευής.
  Κάθε καρτέλα είναι ξεχωριστός «μαθητής», οπότε μπορείς να ανοίξεις τον εκπαιδευτικό σε ένα παράθυρο
  και μαθητές σε άλλες καρτέλες. Οι αλλαγές φτάνουν ζωντανά σε όλες τις καρτέλες.
*/
import { rid } from './ui.js';
import { makeError, gameMeta, sessionMeta } from './store.js';
import { __ } from './i18n.js';

const NS = 'qz-demo:';
const OLD_NS = 'ludus-demo:';

function lsOK() {
  try { localStorage.setItem(NS + 't', '1'); localStorage.removeItem(NS + 't'); return true; } catch (e) { return false; }
}
/* Η προηγούμενη έκδοση (Ludus) κρατούσε τα δεδομένα δοκιμής με άλλο πρόθεμα: τα μεταφέρουμε μία φορά. */
function migrate() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    if (keys.some((k) => k && k.indexOf(NS) === 0)) return;
    keys.filter((k) => k && k.indexOf(OLD_NS) === 0).forEach((k) => localStorage.setItem(NS + k.slice(OLD_NS.length), localStorage.getItem(k)));
  } catch (e) { /* ignore */ }
}

export function create(opts = {}) {
  const useLS = !opts.memory && lsOK();
  if (useLS) migrate();
  const mem = {};
  const listeners = new Map(); // key -> Set(fn)

  const read = (key, d) => {
    try {
      const v = useLS ? localStorage.getItem(NS + key) : (key in mem ? mem[key] : null);
      return v === null || v === undefined ? d : JSON.parse(v);
    } catch (e) { return d; }
  };
  const write = (key, val) => {
    const s = JSON.stringify(val);
    if (useLS) {
      try { localStorage.setItem(NS + key, s); } catch (e) {
        throw makeError(__('Γέμισε ο χώρος της δοκιμαστικής λειτουργίας σε αυτόν τον browser. Σβήσε παλιά παιχνίδια ή αναφορές.'), 'quota');
      }
    } else {
      mem[key] = s;
    }
    fire(key);
  };
  const fire = (key) => {
    const set = listeners.get(key);
    if (set) set.forEach((fn) => setTimeout(fn, 0));
    // Every player has its own entry (p:<session>:<uid>), so answers from many tabs never overwrite each other.
    const m = /^p:([^:]+):/.exec(key);
    if (m) fire('players:' + m[1]);
  };
  const keysWith = (prefix) => {
    const out = [];
    if (useLS) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(NS + prefix) === 0) out.push(k.slice(NS.length));
      }
    } else {
      Object.keys(mem).forEach((k) => { if (k.indexOf(prefix) === 0) out.push(k); });
    }
    return out;
  };
  const players = (sid) => keysWith('p:' + sid + ':').map((k) => read(k, null)).filter(Boolean);
  const remove = (key) => {
    try { if (useLS) localStorage.removeItem(NS + key); else delete mem[key]; } catch (e) { /* ignore */ }
    fire(key);
  };
  const on = (key, fn) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  };
  if (useLS) {
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf(NS) === 0) fire(e.key.slice(NS.length));
    });
  }

  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (t, p) => {
    Object.keys(p).forEach((k) => {
      if (p[k] === undefined) return;
      if (isObj(p[k]) && isObj(t[k])) merge(t[k], p[k]);
      else t[k] = clone(p[k]);
    });
    return t;
  };
  const col = (name) => read(name, {});
  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 30));

  /* ---------- ταυτότητα ---------- */
  // Ο εκπαιδευτικός μένει συνδεδεμένος στη συσκευή. Κάθε καρτέλα έχει δικό της «μαθητή».
  let studentId = null;
  if (!opts.memory) { try { studentId = sessionStorage.getItem(NS + 'student'); } catch (e) { /* ignore */ } }
  if (!studentId) {
    studentId = 'st-' + rid(12);
    if (!opts.memory) { try { sessionStorage.setItem(NS + 'student', studentId); } catch (e) { /* ignore */ } }
  }
  const authCbs = new Set();
  const currentUser = () => {
    const uid = read('auth', null);
    if (!uid) return null;
    const u = col('users')[uid];
    return u ? { uid, email: u.email, name: u.name, isTeacher: true } : null;
  };
  const emitAuth = () => { const u = currentUser(); authCbs.forEach((fn) => fn(u)); };
  on('auth', emitAuth);

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

  const me = () => {
    const u = currentUser();
    if (!u) throw makeError(__('Χρειάζεται σύνδεση εκπαιδευτικού.'), 'auth');
    return u;
  };
  const owned = (o) => o && o.owner === me().uid;

  return {
    mode: 'demo',

    onAuth(fn) { authCbs.add(fn); setTimeout(() => fn(currentUser()), 0); return () => authCbs.delete(fn); },
    user: currentUser,

    async signUp(email, password, name) {
      email = String(email || '').trim().toLowerCase();
      const users = col('users');
      if (Object.values(users).some((u) => u.email === email)) throw makeError(__('Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδέσου.'), 'exists');
      if (String(password).length < 6) throw makeError(__('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'), 'weak');
      const uid = 't-' + rid(10);
      users[uid] = { email, name: String(name || '').trim() || email.split('@')[0], pw: hash(password), createdAt: Date.now() };
      write('users', users);
      write('auth', uid);
      return delay(currentUser());
    },
    async signIn(email, password) {
      email = String(email || '').trim().toLowerCase();
      const users = col('users');
      const uid = Object.keys(users).find((k) => users[k].email === email);
      if (!uid || users[uid].pw !== hash(password)) throw makeError(__('Λάθος email ή κωδικός.'), 'credentials');
      write('auth', uid);
      return delay(currentUser());
    },
    async signOut() { write('auth', null); },
    async resetPassword() {
      throw makeError(__('Στη δοκιμαστική λειτουργία δεν στέλνονται emails. Φτιάξε νέο λογαριασμό.'), 'demo');
    },
    async ensureStudent() { return studentId; },
    studentId: () => studentId,
    async updateProfile(name) {
      const u = me();
      const users = col('users');
      users[u.uid].name = String(name || '').trim() || users[u.uid].name;
      write('users', users);
      emitAuth();
    },

    /* ---------- παιχνίδια ---------- */
    async listGames() { const u = me(); return delay(Object.values(col('games')).filter((g) => g.owner === u.uid).map(gameMeta)); },
    async getGame(id) { const g = col('games')[id]; if (!g || !owned(g)) return null; return delay(clone(g)); },
    async saveGame(game) {
      const u = me();
      const games = col('games');
      const id = game.id || 'g-' + rid(10);
      if (games[id] && games[id].owner !== u.uid) throw makeError(__('Δεν έχεις πρόσβαση σε αυτό το παιχνίδι.'), 'permission');
      const now = Date.now();
      games[id] = Object.assign(clone(game), { id, owner: u.uid, createdAt: (games[id] && games[id].createdAt) || game.createdAt || now, updatedAt: now });
      write('games', games);
      return delay(id);
    },
    async deleteGame(id) {
      const games = col('games');
      if (games[id] && owned(games[id])) { delete games[id]; write('games', games); }
    },

    /* ---------- τάξεις ---------- */
    async listClasses() { const u = me(); return delay(Object.values(col('classes')).filter((c) => c.owner === u.uid)); },
    async saveClass(cls) {
      const u = me();
      const all = col('classes');
      const id = cls.id || 'c-' + rid(10);
      all[id] = Object.assign(clone(cls), { id, owner: u.uid, updatedAt: Date.now(), createdAt: (all[id] && all[id].createdAt) || Date.now() });
      write('classes', all);
      return delay(id);
    },
    async deleteClass(id) { const all = col('classes'); if (all[id] && owned(all[id])) { delete all[id]; write('classes', all); } },

    /* ---------- παιχνίδια σε εξέλιξη (sessions) ---------- */
    async listSessions() {
      const u = me();
      const st = read('stats', {});
      return delay(Object.values(col('sessions')).filter((s) => s.owner === u.uid).map((s) => Object.assign(sessionMeta(s), { stats: st[s.id] || null })));
    },
    async saveSessionStats(id, stats) {
      const s = col('sessions')[id];
      if (!s || !owned(s)) return;
      const all = read('stats', {});
      all[id] = clone(stats);
      write('stats', all);
    },
    dropCache() { /* τίποτα στη μνήμη / nothing cached */ },
    async createSession(data) {
      const u = me();
      const id = 's' + rid(16);
      const sessions = col('sessions');
      sessions[id] = Object.assign(clone(data), { id, owner: u.uid, ownerName: u.name, createdAt: Date.now() });
      write('sessions', sessions);
      return delay({ id });
    },
    async getMedia() { return null; }, // εδώ οι εικόνες μένουν μέσα στον σύνδεσμο / here pictures stay inside the link
    async updateSession(id, patch) {
      const sessions = col('sessions');
      if (!sessions[id]) throw makeError(__('Το παιχνίδι δεν βρέθηκε.'), 'missing');
      if (!owned(sessions[id])) throw makeError(__('Δεν έχεις πρόσβαση σε αυτό το παιχνίδι.'), 'permission');
      merge(sessions[id], patch);
      write('sessions', sessions);
    },
    async deleteSession(id) {
      const sessions = col('sessions');
      const s = sessions[id];
      if (!s || !owned(s)) return;
      delete sessions[id];
      write('sessions', sessions);
      keysWith('p:' + id + ':').forEach(remove);
      const st = read('stats', {});
      if (st[id]) { delete st[id]; write('stats', st); }
    },
    async getSession(id) { const s = col('sessions')[id]; return delay(s ? clone(s) : null); },
    watchSession(id, cb) {
      let last = null;
      const emit = () => {
        const s = col('sessions')[id] || null;
        const str = JSON.stringify(s);
        if (str === last) return;
        last = str;
        cb(s ? clone(s) : null);
      };
      const off = on('sessions', emit);
      setTimeout(emit, 0);
      return off;
    },

    /* ---------- μαθητές ---------- */
    async joinSession(sid, uid, player) {
      const s = col('sessions')[sid];
      if (!s) throw makeError(__('Το παιχνίδι δεν υπάρχει πια.'), 'missing');
      if (s.status === 'ended') throw makeError(__('Ο σύνδεσμος έκλεισε.'), 'ended');
      if (s.deadline && Date.now() > s.deadline) throw makeError(__('Η προθεσμία έληξε.'), 'ended');
      if (s.kicked && s.kicked[uid]) throw makeError(__('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.'), 'kicked');
      const key = 'p:' + sid + ':' + uid;
      const cur = read(key, null) || {};
      const next = Object.assign(cur, clone(player), { uid });
      write(key, next);
      return delay(clone(next));
    },
    async getPlayer(sid, uid) { const p = read('p:' + sid + ':' + uid, null); return delay(p ? clone(p) : null); },
    async updatePlayer(sid, uid, patch) {
      const s = col('sessions')[sid];
      if (s && s.status === 'ended') throw makeError(__('Ο σύνδεσμος έκλεισε.'), 'ended');
      if (s && s.deadline && Date.now() > s.deadline) throw makeError(__('Η προθεσμία έληξε.'), 'ended');
      if (s && s.kicked && s.kicked[uid]) throw makeError(__('Ο εκπαιδευτικός σε αφαίρεσε από αυτό το παιχνίδι.'), 'kicked');
      const key = 'p:' + sid + ':' + uid;
      const cur = read(key, null);
      if (!cur) throw makeError(__('Δεν είσαι πια στο παιχνίδι.'), 'kicked');
      write(key, merge(cur, patch));
    },
    async listPlayers(sid) { return delay(players(sid)); },
    async countPlayers(sid) { const all = players(sid); return delay({ joined: all.length, done: all.filter((x) => x.done).length }); },
    watchPlayers(sid, cb) {
      let last = null;
      const emit = () => {
        const all = players(sid);
        all.sort((a, b) => String(a.uid).localeCompare(String(b.uid)));
        const str = JSON.stringify(all);
        if (str === last) return;
        last = str;
        cb(clone(all));
      };
      const off = on('players:' + sid, emit);
      setTimeout(emit, 0);
      return off;
    },
    watchFinished(sid, cb) {
      return this.watchPlayers(sid, (all) => cb(all.filter((p) => p.done)));
    },
    async removePlayer(sid, uid) {
      const s = col('sessions')[sid];
      if (!s || !owned(s)) return;
      remove('p:' + sid + ':' + uid);
    },

    /* Μόνο στη δοκιμαστική λειτουργία: γράψιμο για εικονικούς μαθητές. */
    botWrite(sid, uid, patch) {
      const key = 'p:' + sid + ':' + uid;
      const cur = read(key, null) || { uid };
      write(key, merge(cur, patch));
    },
    canBots: true,
    storageNote: useLS ? 'local' : 'memory'
  };
}
