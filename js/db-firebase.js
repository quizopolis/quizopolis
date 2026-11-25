/*
  Κανονική λειτουργία: Firebase (δωρεάν πλάνο Spark).
  - Authentication: λογαριασμοί εκπαιδευτικών (email/κωδικός) και ανώνυμη σύνδεση για τους μαθητές.
  - Cloud Firestore: παιχνίδια, τάξεις, παιχνίδια σε εξέλιξη, απαντήσεις μαθητών.
  Οι κανόνες ασφαλείας (firestore.rules) ορίζουν ποιος διαβάζει και γράφει τι.
*/
import { makeError, gameMeta, sessionMeta } from './store.js';
import { __ } from './i18n.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';

const MESSAGES = {
  'auth/invalid-credential': __('Λάθος email ή κωδικός.'),
  'auth/wrong-password': __('Λάθος email ή κωδικός.'),
  'auth/user-not-found': __('Λάθος email ή κωδικός.'),
  'auth/invalid-email': __('Το email δεν είναι σωστό.'),
  'auth/email-already-in-use': __('Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδέσου ή ζήτα νέο κωδικό.'),
  'auth/weak-password': __('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'),
  'auth/too-many-requests': __('Πολλές προσπάθειες στη σειρά. Περίμενε λίγα λεπτά και δοκίμασε ξανά.'),
  'auth/network-request-failed': __('Δεν υπάρχει σύνδεση στο διαδίκτυο. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'),
  'auth/operation-not-allowed': __('Στο Firebase δεν έχει ενεργοποιηθεί αυτός ο τρόπος σύνδεσης (Authentication → Sign-in method). Δες τον οδηγό εγκατάστασης.'),
  'auth/admin-restricted-operation': __('Στο Firebase δεν έχει ενεργοποιηθεί η ανώνυμη σύνδεση για τους μαθητές (Authentication → Sign-in method → Anonymous).'),
  'auth/unauthorized-domain': __('Η διεύθυνση της πλατφόρμας δεν έχει προστεθεί στα Authorized domains του Firebase. Δες τον οδηγό εγκατάστασης.'),
  'permission-denied': __('Δεν επιτρέπεται αυτή η ενέργεια. Αν μόλις έστησες την πλατφόρμα, έλεγξε ότι επικόλλησες τους κανόνες ασφαλείας (firestore.rules).'),
  'resource-exhausted': __('Εξαντλήθηκε το δωρεάν όριο της ημέρας στο Firebase. Θα ξαναλειτουργήσει όταν μηδενιστεί ο μετρητής, γύρω στις 10 το πρωί (ώρα Ελλάδας).'),
  'unavailable': __('Δεν υπάρχει σύνδεση με τη βάση. Έλεγξε το διαδίκτυο και δοκίμασε ξανά.'),
  'failed-precondition': __('Η βάση Firestore δεν έχει δημιουργηθεί ακόμη στο έργο Firebase. Δες τον οδηγό εγκατάστασης.'),
  'not-found': __('Η βάση Firestore δεν βρέθηκε στο έργο Firebase. Έλεγξε ότι τη δημιούργησες (βήμα 3 του οδηγού).'),
  'auth/invalid-api-key': __('Το apiKey στο config.js δεν είναι σωστό. Αντέγραψέ το ξανά από το Firebase (βήμα 5 του οδηγού).'),
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': __('Το apiKey στο config.js δεν είναι σωστό. Αντέγραψέ το ξανά από το Firebase (βήμα 5 του οδηγού).'),
  'auth/configuration-not-found': __('Στο Firebase δεν έχει ενεργοποιηθεί το Authentication (Security → Authentication → Get started). Δες το βήμα 2 του οδηγού.'),
  'auth/missing-email': __('Γράψε το email σου.'),
  'auth/user-disabled': __('Αυτός ο λογαριασμός έχει απενεργοποιηθεί.'),
  'unauthenticated': __('Χρειάζεται ξανά σύνδεση. Ανανέωσε τη σελίδα.'),
  'deadline-exceeded': __('Η σύνδεση με τη βάση αργεί πολύ. Έλεγξε το διαδίκτυο και δοκίμασε ξανά.')
};

function wrap(e) {
  if (e && e.userMessage) return e;
  const code = (e && e.code) || '';
  const msg = MESSAGES[code] || MESSAGES[code.replace(/^firestore\//, '')] ||
    (__('Κάτι δεν πήγε καλά') + (code ? ` (${code})` : '') + __('. Δοκίμασε ξανά.'));
  const err = makeError(msg, code || 'firebase');
  err.cause = e;
  return err;
}
const guard = (p) => p.catch((e) => { throw wrap(e); });

export async function create(config) {
  let mods;
  try {
    mods = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]);
  } catch (e) {
    throw makeError(__('Δεν φόρτωσε το Firebase. Έλεγξε τη σύνδεση στο διαδίκτυο και ανανέωσε τη σελίδα.'), 'sdk');
  }
  const [{ initializeApp }, A, F] = mods;
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { ignoreUndefinedProperties: true }); } catch (e) { db = F.getFirestore(app); }

  let user = null;
  const lists = new Map();
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  const authCbs = new Set();
  const toUser = (u) => (u ? { uid: u.uid, email: u.email || '', name: u.displayName || (u.email ? u.email.split('@')[0] : ''), isTeacher: !u.isAnonymous } : null);
  A.onAuthStateChanged(auth, (u) => {
    if (!u || !user || u.uid !== user.uid) lists.clear();
    user = toUser(u);
    resolveReady();
    authCbs.forEach((fn) => fn(user && user.isTeacher ? user : null));
  });

  const me = () => {
    if (!user || !user.isTeacher) throw makeError(__('Χρειάζεται σύνδεση εκπαιδευτικού.'), 'auth');
    return user;
  };
  const d = (...path) => F.doc(db, ...path);
  const c = (...path) => F.collection(db, ...path);
  const data = (snap) => (snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null);
  // Οι λίστες του εκπαιδευτικού (παιχνίδια, τάξεις, σύνδεσμοι) κρατιούνται λίγα λεπτά στη μνήμη.
  // Έτσι το πήγαινε-έλα ανάμεσα στις σελίδες δεν ξαναδιαβάζει κάθε φορά όλα τα έγγραφα
  // (το δωρεάν όριο του Firebase μετράει αναγνώσεις). Κάθε αλλαγή από αυτή τη συσκευή τις ανανεώνει.
  // The teacher's lists are kept in memory for a few minutes, so moving between pages
  // does not re-read every document (Firebase's free quota counts reads). Any change made here refreshes them.
  const LIST_TTL = 3 * 60 * 1000;
  const forget = () => lists.clear();
  const copies = (arr) => arr.map((o) => Object.assign({}, o));
  const mine = (name) => {
    const uid = me().uid;
    const hit = lists.get(name);
    if (hit && hit.uid === uid && Date.now() - hit.at < LIST_TTL) return hit.p.then(copies);
    const p = guard(F.getDocs(F.query(c(name), F.where('owner', '==', uid))))
      .then((qs) => qs.docs.map((s) => Object.assign({ id: s.id }, s.data())));
    const entry = { at: Date.now(), uid, p };
    lists.set(name, entry);
    p.catch(() => { if (lists.get(name) === entry) lists.delete(name); });
    return p.then(copies);
  };

  const api = {
    mode: 'firebase',

    onAuth(fn) {
      authCbs.add(fn);
      ready.then(() => fn(user && user.isTeacher ? user : null));
      return () => authCbs.delete(fn);
    },
    user: () => (user && user.isTeacher ? user : null),

    async signUp(email, password, name) {
      const cred = await guard(A.createUserWithEmailAndPassword(auth, String(email).trim(), password));
      const displayName = String(name || '').trim() || String(email).split('@')[0];
      await guard(A.updateProfile(cred.user, { displayName }));
      // Το προφίλ στη βάση δεν είναι απαραίτητο· αν οι κανόνες λείπουν, ο λογαριασμός λειτουργεί και το λάθος φαίνεται στη βιβλιοθήκη.
      try { await F.setDoc(d('teachers', cred.user.uid), { name: displayName, email: cred.user.email, createdAt: Date.now() }); } catch (e) { /* not critical */ }
      user = toUser(cred.user);
      user.name = displayName;
      authCbs.forEach((fn) => fn(user));
      return user;
    },
    async signIn(email, password) {
      const cred = await guard(A.signInWithEmailAndPassword(auth, String(email).trim(), password));
      return toUser(cred.user);
    },
    async signOut() { await guard(A.signOut(auth)); },
    async resetPassword(email) { await guard(A.sendPasswordResetEmail(auth, String(email).trim())); },
    async updateProfile(name) {
      const u = auth.currentUser;
      if (!u) return;
      await guard(A.updateProfile(u, { displayName: name }));
      try { await F.setDoc(d('teachers', u.uid), { name }, { merge: true }); } catch (e) { /* not critical */ }
      user = toUser(u);
      user.name = name;
      authCbs.forEach((fn) => fn(user));
    },
    async ensureStudent() {
      await ready;
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await guard(A.signInAnonymously(auth));
      return cred.user.uid;
    },
    studentId: () => (auth.currentUser ? auth.currentUser.uid : null),

    /* ---------- παιχνίδια ---------- */
    // Η βιβλιοθήκη διαβάζει μόνο τις μικρές κάρτες (gameIndex)· το πλήρες παιχνίδι φορτώνεται όταν χρειάζεται.
    listGames: () => mine('gameIndex'),
    async getGame(id) { return data(await guard(F.getDoc(d('games', id)))); },
    async saveGame(game) {
      const u = me();
      const ref = game.id ? d('games', game.id) : F.doc(c('games'));
      const now = Date.now();
      const body = Object.assign({}, game, { owner: u.uid, updatedAt: now, createdAt: game.createdAt || now });
      delete body.id;
      const meta = gameMeta(Object.assign({}, body, { id: ref.id }));
      delete meta.id;
      const batch = F.writeBatch(db);
      batch.set(ref, body);
      batch.set(d('gameIndex', ref.id), meta);
      await guard(batch.commit());
      return ref.id;
    },
    async deleteGame(id) {
      const batch = F.writeBatch(db);
      batch.delete(d('games', id));
      batch.delete(d('gameIndex', id));
      await guard(batch.commit());
    },

    /* ---------- τάξεις ---------- */
    listClasses: () => mine('classes'),
    async saveClass(cls) {
      const u = me();
      const ref = cls.id ? d('classes', cls.id) : F.doc(c('classes'));
      const body = Object.assign({}, cls, { owner: u.uid, updatedAt: Date.now(), createdAt: cls.createdAt || Date.now() });
      delete body.id;
      await guard(F.setDoc(ref, body));
      return ref.id;
    },
    async deleteClass(id) { await guard(F.deleteDoc(d('classes', id))); },

    /* ---------- παιχνίδια σε εξέλιξη ---------- */
    listSessions: () => mine('sessionIndex'),
    // Κάθε σύνδεσμος είναι ένα έγγραφο με τυχαίο αναγνωριστικό 20 χαρακτήρων: δεν μαντεύεται.
    async createSession(body) {
      const u = me();
      const ref = F.doc(c('sessions'));
      const batch = F.writeBatch(db);
      const full = Object.assign({}, body, { owner: u.uid, ownerName: u.name || '', createdAt: Date.now() });
      const meta = sessionMeta(Object.assign({ id: ref.id }, full));
      delete meta.id;
      batch.set(ref, full);
      batch.set(d('sessionIndex', ref.id), meta);
      await guard(batch.commit());
      return { id: ref.id };
    },
    async updateSession(id, patch) {
      await guard(F.setDoc(d('sessions', id), patch, { merge: true }));
      const m = {};
      ['status', 'startedAt', 'deadline', 'title'].forEach((k) => { if (k in patch) m[k] = patch[k] === undefined ? null : patch[k]; });
      if (Object.keys(m).length) {
        try { await F.setDoc(d('sessionIndex', id), m, { merge: true }); } catch (e) { /* μόνο η ετικέτα της λίστας */ }
      }
    },
    async deleteSession(id) {
      const ps = await guard(F.getDocs(c('sessions', id, 'players')));
      let batch = F.writeBatch(db);
      let n = 0;
      for (const p of ps.docs) {
        batch.delete(p.ref);
        if (++n % 400 === 0) { await guard(batch.commit()); batch = F.writeBatch(db); }
      }
      batch.delete(d('sessions', id));
      batch.delete(d('sessionIndex', id));
      await guard(batch.commit());
    },
    // Στατιστικά για τον πίνακας «Αποτελέσματα»: μία εγγραφή στην κάρτα της λίστας, ενημερώνει και τη μνήμη.
    // Stats for the Results dashboard: one write to the list card, and the in-memory list is patched too.
    async saveSessionStats(id, stats) {
      await guard(F.setDoc(d('sessionIndex', id), { stats }, { merge: true }));
      const hit = lists.get('sessionIndex');
      if (hit) hit.p = hit.p.then((arr) => arr.map((o) => (o.id === id ? Object.assign({}, o, { stats }) : o)));
    },
    // «Ανανέωση»: οι λίστες ξαναδιαβάζονται την επόμενη φορά. / "Refresh": the lists are read again next time.
    dropCache() { forget(); },
    async getSession(id) { return data(await guard(F.getDoc(d('sessions', id)))); },
    watchSession(id, cb, onErr) {
      return F.onSnapshot(d('sessions', id), (snap) => cb(data(snap)), (e) => { if (onErr) onErr(wrap(e)); });
    },

    /* ---------- μαθητές ---------- */
    async joinSession(sid, uid, player) {
      await guard(F.setDoc(d('sessions', sid, 'players', uid), Object.assign({}, player, { uid }), { merge: true }));
      return data(await guard(F.getDoc(d('sessions', sid, 'players', uid))));
    },
    async getPlayer(sid, uid) { return data(await guard(F.getDoc(d('sessions', sid, 'players', uid)))); },
    async updatePlayer(sid, uid, patch) {
      try {
        await F.setDoc(d('sessions', sid, 'players', uid), patch, { merge: true });
      } catch (e) {
        // Μετά το τέλος (ή την προθεσμία) οι κανόνες δεν δέχονται άλλες απαντήσεις.
        if (e && /permission-denied/.test(e.code || '')) throw makeError(__('Ο σύνδεσμος έκλεισε.'), 'ended');
        throw wrap(e);
      }
    },
    async listPlayers(sid) {
      const qs = await guard(F.getDocs(c('sessions', sid, 'players')));
      return qs.docs.map((s) => Object.assign({ uid: s.id }, s.data()));
    },
    watchPlayers(sid, cb, onErr) {
      return F.onSnapshot(c('sessions', sid, 'players'),
        (qs) => cb(qs.docs.map((s) => Object.assign({ uid: s.id }, s.data()))),
        (e) => { if (onErr) onErr(wrap(e)); });
    },
    // Πόσα παιδιά μπήκαν και πόσα τελείωσαν: δύο μετρήσεις (2 αναγνώσεις) αντί να διαβαστούν όλοι οι παίκτες.
    // How many children joined and finished: two counts (2 reads) instead of reading every player.
    async countPlayers(sid) {
      const col = c('sessions', sid, 'players');
      const [all, done] = await Promise.all([
        guard(F.getCountFromServer(col)),
        guard(F.getCountFromServer(F.query(col, F.where('done', '==', true))))
      ]);
      return { joined: all.data().count, done: done.data().count };
    },
    async removePlayer(sid, uid) { await guard(F.deleteDoc(d('sessions', sid, 'players', uid))); },

    canBots: false
  };
  // Μετά από κάθε αλλαγή οι λίστες ξαναδιαβάζονται. / After any change the lists are read again.
  ['signUp', 'signIn', 'signOut', 'saveGame', 'deleteGame', 'saveClass', 'deleteClass', 'createSession', 'updateSession', 'deleteSession'].forEach((k) => {
    const fn = api[k];
    api[k] = async (...args) => { forget(); try { return await fn(...args); } finally { forget(); } };
  });
  return api;
}
