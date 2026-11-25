/* Εκκίνηση, δρομολόγηση και οι «ανοιχτές» σελίδες: αρχική, σύνδεση εκπαιδευτικού, οδηγός εγκατάστασης. */
import { esc, app, setTitle, CFG, CONFIG_BROKEN, toast, dialog, ICON, LOGO, errText, local, copy, langSwitch, avatar } from './ui.js';
import { DB, initStore, useSandbox, leaveSandbox, inSandbox } from './store.js';
import { RULES } from './rules.js';
import { MODES, BASIC_MODES, REVIEW_MODES, STAGE_MODES } from './modes.js';
import { gameIcon, softTile } from './gicons.js';
import { __, LANG } from './i18n.js';

let cleanup = null, guard = null, current = null, booted = false;

const ctx = {
  go(path, replace) {
    if (replace) { history.replaceState(null, '', '#' + path); route(); }
    else if (location.hash === '#' + path) route(true);
    else location.hash = path;
  },
  replace(path) { history.replaceState(null, '', '#' + path); current = path; },
  setCleanup(fn) { cleanup = fn; },
  setGuard(fn) { guard = fn; }
};

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const params = {};
  (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { raw, path: path.replace(/\/+$/, '') || '/', params };
}

async function route(force) {
  const { raw, path, params } = parse();
  if (!force && raw === current) return;
  if (guard && guard()) {
    const leave = await dialog({
      title: __('Φεύγεις χωρίς αποθήκευση;'), text: __('Οι αλλαγές που έκανες στο παιχνίδι θα χαθούν.'),
      actions: [{ label: __('Μένω εδώ'), value: false }, { label: __('Φεύγω χωρίς αποθήκευση'), value: true, kind: 'danger' }]
    });
    if (!leave) { history.replaceState(null, '', '#' + current); return; }
  }
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } }
  cleanup = null;
  guard = null;
  current = raw;
  document.querySelectorAll('.dlg-wrap, .menu').forEach((d) => d.remove());
  window.scrollTo(0, 0);
  if (inSandbox() && !/^\/(g|play|try)(\/|$)/.test(path)) leaveSandbox();
  let m;
  const teacherOnly = (fn) => {
    if (!DB.user()) { ctx.go('/login?next=' + encodeURIComponent(path), true); return; }
    fn();
  };
  if (path === '/') { viewHome(); import('./views.js').catch(() => {}); return; }
  if (path === '/login') return viewAuth('login', params);
  if (path === '/signup') return viewAuth('signup', params);
  if (path === '/reset') return viewAuth('reset', params);
  if (path === '/setup') return viewSetup();
  if (path === '/try') return viewTry();
  let views;
  try { views = await import('./views.js'); } catch (e) {
    app().innerHTML = ('<div class="auth"><main class="auth-main"><div class="auth-card"><h1 class="h2">' + __('Δεν φόρτωσε η σελίδα') + '</h1><p>' + __('Έλεγξε τη σύνδεση στο διαδίκτυο και ανανέωσε τη σελίδα.') + '</p></div></main></div>');
    return;
  }
  if (raw !== current) return; // στο μεταξύ πήγαμε αλλού
  if ((m = /^\/g\/([\w-]+)$/.exec(path))) return views.viewJoin(m[1], ctx);
  if ((m = /^\/play\/([\w-]+)$/.exec(path))) return views.viewPlay(m[1], ctx);
  if (path === '/t') return teacherOnly(() => views.viewLibrary(ctx));
  if (path === '/t/new') return teacherOnly(() => views.viewChooser(ctx));
  if ((m = /^\/t\/new\/([\w-]+)$/.exec(path))) return teacherOnly(() => views.viewEditor(null, ctx, m[1]));
  if ((m = /^\/t\/edit\/([\w-]+)$/.exec(path))) return teacherOnly(() => views.viewEditor(m[1], ctx));
  if (path === '/t/classes') return teacherOnly(() => views.viewClasses(ctx));
  if (path === '/t/links' || path === '/t/sessions') return teacherOnly(() => views.viewLinks(ctx));
  if ((m = /^\/t\/link\/([\w-]+)$/.exec(path))) return teacherOnly(() => views.viewLink(m[1], ctx));
  if ((m = /^\/t\/report\/([\w-]+)$/.exec(path))) return teacherOnly(() => views.viewReport(m[1], ctx));
  if ((m = /^\/t\/stage\/([\w-]+)$/.exec(path))) return teacherOnly(() => views.viewStage(m[1], ctx));
  if (path === '/t/account') return teacherOnly(() => views.viewAccount(ctx));
  ctx.go('/', true);
}

/* ================= ΑΡΧΙΚΗ / HOME ================= */
function siteHeader() {
  const u = DB.user();
  return `<header class="site-h"><a class="brand" href="#/">${LOGO}<span class="brand-n">${esc(CFG.siteName)}</span></a>
    <nav class="site-nav">${langSwitch()}${u ? `<a class="btn btn-soft" href="#/t">${__('Τα παιχνίδια μου')}</a>`
      : `<a class="nav-a" href="#/login">${__('Είσοδος')}</a><a class="btn btn-soft nav-join" href="#/signup">${__('Φτιάξε λογαριασμό')}</a>`}</nav></header>`;
}
/* Η «πόλη» με τα 15 παιχνίδια γύρω από μια ερώτηση. */
const RING = [['millionaire', 1, 2], ['penalty', 1, 3], ['race', 1, 4], ['escape', 1, 5], ['jeopardy', 2, 5], ['shooting', 3, 5], ['snakes', 4, 5], ['picture', 5, 5],
  ['swim', 5, 4], ['show', 5, 3], ['classic', 5, 2], ['team', 5, 1], ['mastery', 4, 1], ['test', 3, 1], ['flashcards', 2, 1]];
const QTILE = '<span class="st st-q" style="grid-area:1/1" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><circle cx="23" cy="23" r="11" fill="none" stroke="#fff" stroke-width="5.6"/><path d="M29.5 29.5l8.5 8.5" stroke="#FFC23C" stroke-width="6" stroke-linecap="round"/></svg></span>';
function heroCard() {
  const a = [['2/4', '#2F6FE4', true], ['1/3', '#F4A80B'], ['2/3', '#8E44D9'], ['3/4', '#E2445C']];
  return `<div class="qcard"><div class="qc-top"><span>${__('Ερώτηση 3 από 10')}</span><span class="qc-timer">${ICON.clock}12</span></div>
    <div class="qc-q">${__('Ποιο κλάσμα είναι ίσο με το 1/2;')}</div>
    <div class="qc-a">${a.map(([t, c, ok]) => `<span class="${ok ? '' : 'off'}" style="background:${c}">${t}${ok ? `<i class="qc-ok">${ICON.check}</i>` : ''}</span>`).join('')}</div>
    <div class="qc-r">${ICON.check}${__('Σωστό! +950 πόντοι')}</div></div>`;
}
function viewHome() {
  setTitle('');
  const el = app();
  el.className = 'v-home';
  const last = local.get('qz:last', null);
  const u = DB.user();
  const en = LANG === 'en';
  const join = u ? `<a class="btn btn-primary btn-lg" href="#/t">${__('Τα παιχνίδια μου')}</a>` : `<a class="btn btn-primary btn-lg" href="#/signup">${__('Φτιάξε δωρεάν λογαριασμό')}</a>`;
  const mosaic = `<div class="mosaic" aria-hidden="true">${QTILE}${RING.map(([id, r, c]) => softTile(id, `grid-area:${r}/${c}`)).join('')}${heroCard()}</div>`;
  const mosaicM = `<div class="mosaic-m" aria-hidden="true">${['millionaire', 'penalty', 'race', 'escape', 'jeopardy'].map((id) => softTile(id)).join('')}${heroCard()}${['shooting', 'snakes', 'picture', 'swim', 'show'].map((id) => softTile(id)).join('')}</div>`;
  const kids = en ? ['Emma K.', 'Noah P.', 'Grace M.', 'Sam A.'] : ['Ελένη Κ.', 'Νίκος Π.', 'Γιώργος Μ.', 'Σοφία Α.'];
  const cap = en ? ['Nicosia', 'Limassol', 'Larnaca', 'Paphos'] : ['Λευκωσία', 'Λεμεσός', 'Λάρνακα', 'Πάφος'];
  const vis1 = `<div class="mini">${['jeopardy', 'penalty', 'snakes'].map((id) => `<div class="mt${id === 'penalty' ? ' on' : ''}">${id === 'penalty' ? `<span class="mt-tick">${ICON.check}</span>` : ''}${gameIcon(id, { size: 48 })}<span>${esc(MODES[id].label)}</span></div>`).join('')}</div>`;
  const radio = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>';
  const vis2 = `<div class="mcard"><div class="mcard-ty">${radio}${__('Πολλαπλής επιλογής')}</div><div class="mcard-q">${__('Ποια είναι η πρωτεύουσα της Κύπρου;')}</div>
    <div class="mcard-a">${cap.map((t, i) => `<span style="background:${['#2F6FE4', '#F4A80B', '#8E44D9', '#E2445C'][i]}">${esc(t)}${i === 0 ? `<i class="mcard-ok">${ICON.check}</i>` : ''}</span>`).join('')}</div></div>`;
  const vis3 = `<div class="mcard"><div class="mcard-lt">${__('Στείλε τον σύνδεσμο στα παιδιά')}</div><div class="mcard-link"><span>quizopolis/<em>#/g/4kx9m2</em></span><b>${ICON.copy}</b></div>
    <div class="mcard-who"><span class="avs">${kids.map((k) => avatar(k)).join('')}</span><span>${__('<b>{0}</b> από {1} έπαιξαν', 18, 24)}</span></div><div class="bar"><i style="width:75%"></i></div></div>`;
  const item = (id, stage) => `<li>${gameIcon(id, { size: 44, cls: stage ? 'gi-stage' : '' })}<span><b>${esc(MODES[id].label)}</b><small>${esc(MODES[id].short || '')}</small></span></li>`;
  const ck = ICON.check;
  el.innerHTML = `<div class="home">${siteHeader()}
    <main>
      <section class="wrap hero"><div class="hero-t">
        <h1 class="home-h">${esc(CFG.tagline)}</h1>
        <p class="home-lead">${__('Γράφεις τις ερωτήσεις μία φορά και η τάξη παίζει μ’ αυτές Εκατομμυριούχο, Πέναλτι, Jeopardy ή όποιο άλλο από τα {0} παιχνίδια θέλεις. Τα παιδιά μπαίνουν με έναν σύνδεσμο, χωρίς λογαριασμό.', BASIC_MODES.length + REVIEW_MODES.length)}</p>
        <div class="hero-cta">${join}<a class="btn btn-lg" href="#/try">${ICON.play}${__('Δοκίμασε ένα παιχνίδι')}</a></div>
        <ul class="trust"><li>${ck}${__('Δωρεάν, χωρίς διαφημίσεις')}</li><li>${ck}${__('Ελληνικά και αγγλικά')}</li></ul>
        ${mosaicM}</div>${mosaic}</section>
      <div class="wrap"><div class="kid"><span class="kid-i">${ICON.user}</span><p><b>${__('Μαθητής ή μαθήτρια;')}</b> ${__('Άνοιξε τον σύνδεσμο που σου έστειλε ο δάσκαλος ή η δασκάλα σου. Δεν χρειάζεσαι λογαριασμό.')}${last && last.sid && last.name ? `<small>${__('Θα μπεις ως {0}.', esc(last.name))}</small>` : ''}</p>
        ${last && last.sid ? `<a class="btn btn-line" href="#/g/${esc(last.sid)}">${__('Συνέχισε:')} ${esc(last.title || __('το παιχνίδι σου'))}</a>` : ''}</div></div>
      <section class="wrap hsec" aria-labelledby="h-how"><h2 class="hsec-h" id="h-how">${__('Τρία βήματα και η τάξη παίζει')}</h2>
        <div class="steps3">
          <div class="s3"><div class="s3-vis" aria-hidden="true">${vis1}</div><h3><span class="s3-n">1</span>${__('Διάλεξε παιχνίδι')}</h3><p>${__('Από κλασικό κουίζ ως δωμάτιο απόδρασης. Αν αλλάξεις γνώμη, αλλάζεις παιχνίδι χωρίς να ξαναγράψεις τίποτα.')}</p></div>
          <div class="s3"><div class="s3-vis" aria-hidden="true">${vis2}</div><h3><span class="s3-n">2</span>${__('Γράψε τις ερωτήσεις')}</h3><p>${__('Πολλαπλή επιλογή, σωστό ή λάθος, συμπλήρωση, αντιστοίχιση και άλλα, με εικόνες και εξηγήσεις.')}</p></div>
          <div class="s3"><div class="s3-vis" aria-hidden="true">${vis3}</div><h3><span class="s3-n">3</span>${__('Στείλε τον σύνδεσμο')}</h3><p>${__('Τα παιδιά πατούν το όνομά τους και παίζουν. Εσύ βλέπεις ποιος έπαιξε και τι δυσκόλεψε την τάξη.')}</p></div>
        </div></section>
      <section class="wrap hsec" aria-labelledby="h-games"><h2 class="hsec-h" id="h-games">${__('Οι ίδιες ερωτήσεις, {0} τρόποι να παιχτούν', BASIC_MODES.length + REVIEW_MODES.length)}</h2>
        <p class="hsec-p">${__('Τα παιδιά παίζουν από το σπίτι ή στο εργαστήριο, όποτε μπορούν ως την προθεσμία.')}</p>
        <div class="glist"><div class="gcol gcol-2"><h3>${__('Παιχνίδια επανάληψης')}</h3><ul class="gl">${REVIEW_MODES.map((id) => item(id)).join('')}</ul></div>
          <div class="gcol"><h3>${__('Κουίζ και μελέτη')}</h3><ul class="gl">${BASIC_MODES.map((id) => item(id)).join('')}</ul></div></div>
        <div class="stage-strip"><span class="gstack" style="--gs:#EEF0F8">${STAGE_MODES.map((id) => gameIcon('stage-' + id, { size: 40 })).join('')}</span><p><b>${__('Και στον προβολέα, με όλη την τάξη.')}</b> ${__('Ο Εκατομμυριούχος, το Jeopardy και το Τηλεπαιχνίδι παίζονται σε ομάδες, χωρίς συσκευές για τα παιδιά.')}</p></div>
      </section>
      <section class="wrap hsec" aria-labelledby="h-safe"><h2 class="hsec-h" id="h-safe">${__('Απλό για εσένα, ασφαλές για τα παιδιά')}</h2>
        <div class="two"><div class="two-c"><h3><span class="two-i">${ICON.teach}</span>${__('Για εσένα')}</h3><ul class="checks">
            <li>${ck}<span>${__('<b>Αποτελέσματα</b> για κάθε σύνδεσμο: ποιος έπαιξε, τι απάντησε και ποια ερώτηση δυσκόλεψε την τάξη.')}</span></li>
            <li>${ck}<span>${__('<b>Λίστες τάξης</b>, ώστε τα παιδιά να πατούν απλώς το όνομά τους.')}</span></li>
            <li>${ck}<span>${__('<b>13 είδη ερωτήσεων</b>, με εικόνες, χρόνο, διπλούς πόντους και εξήγηση.')}</span></li>
            <li>${ck}<span>${__('<b>Έτοιμα παραδείγματα</b> για να ξεκινήσεις και εισαγωγή ερωτήσεων από κείμενο.')}</span></li></ul></div>
          <div class="two-c"><h3><span class="two-i">${ICON.heart}</span>${__('Για τα παιδιά')}</h3><ul class="checks">
            <li>${ck}<span>${__('<b>Χωρίς λογαριασμό και χωρίς email.</b> Μόνο μικρό όνομα και αρχικό επωνύμου.')}</span></li>
            <li>${ck}<span>${__('<b>Από κινητό, τάμπλετ ή υπολογιστή</b>, χωρίς να κατεβάσουν εφαρμογή.')}</span></li>
            <li>${ck}<span>${__('<b>Χωρίς διαφημίσεις</b> και χωρίς αγορές μέσα στα παιχνίδια.')}</span></li>
            <li>${ck}<span>${__('<b>Ξαναπαίζουν για καλύτερο σκορ</b> στα παιχνίδια επανάληψης, ως την προθεσμία.')}</span></li></ul></div></div>
      </section>
      <section class="wrap"><div class="band"><div><h2>${u ? __('Φτιάξε ένα νέο παιχνίδι') : __('Φτιάξε το πρώτο σου παιχνίδι')}</h2><p>${__('Δωρεάν, με έτοιμα παραδείγματα για να ξεκινήσεις.')}</p></div>
        <div class="band-a">${u ? `<a class="btn btn-primary btn-lg" href="#/t/new">${ICON.plus}${__('Νέο παιχνίδι')}</a>` : `<a class="btn btn-primary btn-lg" href="#/signup">${__('Φτιάξε δωρεάν λογαριασμό')}</a><span>${__('Έχεις ήδη λογαριασμό;')} <a href="#/login">${__('Είσοδος')}</a></span>`}</div></div></section>
      <div class="wrap">
      ${CONFIG_BROKEN ? ('<p class="home-demo"><b class="err">' + __('Το αρχείο config.js δεν διαβάστηκε: μάλλον λείπει ένα κόμμα ή ένα άγκιστρο. Άνοιξέ το και σύγκρινέ το με το παράδειγμα του οδηγού.') + '</b></p>') : ''}
      ${DB.mode === 'demo' ? ('<p class="home-demo">' + __('Δοκιμαστική λειτουργία: όλα μένουν σε αυτόν τον browser. Για να δοκιμάσεις ως μαθητής, άνοιξε τον σύνδεσμο ενός παιχνιδιού σε άλλη καρτέλα.') + ' <a href="#/setup">' + __('Σύνδεση με τη δωρεάν βάση δεδομένων') + '</a></p>') : ''}
      </div>
    </main>
    <footer class="wrap home-foot"><div><a class="brand" href="#/">${LOGO}<span class="brand-n">${esc(CFG.siteName)}</span></a><small>${__('Δωρεάν παιχνίδια επανάληψης για την τάξη.')}</small></div>
      <nav>${langSwitch()}<a href="#/try">${__('Δοκίμασε ένα παιχνίδι')}</a>${u ? `<a href="#/t">${__('Τα παιχνίδια μου')}</a>` : `<a href="#/login">${__('Είσοδος εκπαιδευτικού')}</a>`}</nav></footer>
  </div>`;
}

/* ================= ΔΟΚΙΜΗ ΩΣ ΜΑΘΗΤΗΣ / TRY AS A STUDENT =================
   Ένα δείγμα παίζεται σε μια προσωρινή «βάση» μέσα στη σελίδα: δεν χρειάζεται λογαριασμός και δεν αποθηκεύεται τίποτα.
   A sample game is played on a throwaway in-page store: no account needed, nothing is saved. */
const TRY = ['classic', 'millionaire', 'penalty', 'race', 'escape', 'picture'];
function viewTry() {
  setTitle(__('Δοκίμασε ένα παιχνίδι'));
  const el = app();
  el.className = 'v-home';
  el.innerHTML = `<div class="home">${siteHeader()}<main class="wrap try-main">
    <p class="crumbs"><a href="#/">${ICON.back}${__('Αρχική')}</a></p>
    <h1 class="h1">${__('Δοκίμασε ένα παιχνίδι')}</h1>
    <p class="lead">${__('Παίξε ως μαθητής με έτοιμες ερωτήσεις. Δεν χρειάζεται λογαριασμός και δεν αποθηκεύεται τίποτα.')}</p>
    <ul class="try-grid">${TRY.map((id) => `<li><button type="button" class="pick" data-try="${id}">${gameIcon(id, { size: 48 })}<span class="pick-t"><b>${esc(MODES[id].label)}</b><span>${esc(MODES[id].short || '')}</span></span></button></li>`).join('')}</ul>
    <p class="try-note">${__('Θέλεις να γράψεις τις δικές σου ερωτήσεις;')} <a href="#/signup">${__('Φτιάξε δωρεάν λογαριασμό')}</a></p>
  </main></div>`;
  el.querySelector('.try-grid').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    el.querySelectorAll('[data-try]').forEach((x) => { x.disabled = true; });
    try { const sid = await startTry(b.dataset.try); ctx.go('/g/' + sid); } catch (er) {
      toast(errText(er), 'error');
      el.querySelectorAll('[data-try]').forEach((x) => { x.disabled = false; });
    }
  });
}
async function startTry(mode) {
  const SB = await useSandbox();
  const email = 'try@quizopolis.local', pw = 'try-quizopolis';
  if (!SB.user()) { try { await SB.signUp(email, pw, CFG.siteName); } catch (e) { await SB.signIn(email, pw); } }
  const { sampleGames } = await import('./samples.js');
  const { sampleGamesEn } = await import('./samples-en.js');
  const { TEAM_SET } = await import('./scoring.js');
  const games = LANG === 'en' ? sampleGamesEn() : sampleGames();
  const g = games.find((x) => x.mode === mode) || games.find((x) => x.mode === 'penalty') || games[0];
  const settings = Object.assign({}, MODES[mode].defaults);
  if (mode === 'picture') settings.picture = 'auto';
  const body = {
    gameId: null, title: g.title, mode, settings, questions: g.questions, cover: g.cover || null,
    classId: null, roster: null, status: 'live', startedAt: Date.now(), lang: LANG, deadline: null, sandbox: true
  };
  if (mode === 'team') body.teams = TEAM_SET.slice(0, 4);
  const { id } = await SB.createSession(body);
  await SB.signOut();
  return id;
}

/* ================= ΣΥΝΔΕΣΗ ΕΚΠΑΙΔΕΥΤΙΚΟΥ ================= */
function viewAuth(kind, params) {
  const next = params.next && /^\/t/.test(params.next) ? params.next : '/t';
  if (kind !== 'reset' && DB.user()) { ctx.go(next, true); return; }
  setTitle(kind === 'login' ? __('Σύνδεση') : kind === 'signup' ? __('Νέος λογαριασμός') : __('Νέος κωδικός'));
  const el = app();
  el.className = 'v-auth';
  const nextQ = next !== '/t' ? `?next=${encodeURIComponent(next)}` : '';
  const head = { login: __('Σύνδεση εκπαιδευτικού'), signup: __('Νέος λογαριασμός εκπαιδευτικού'), reset: __('Ξέχασες τον κωδικό;') }[kind];
  el.innerHTML = `<div class="auth">${siteHeader(true)}<main class="auth-main"><div class="auth-card">
    <h1 class="h2">${head}</h1>
    ${kind === 'reset' ? ('<p class="muted">' + __('Γράψε το email του λογαριασμού σου και θα σου στείλουμε σύνδεσμο για νέο κωδικό.') + '</p>') : ''}
    <form novalidate>
      ${kind === 'signup' ? ('<div class="field"><label class="label" for="a-name">' + __('Το όνομά σου') + '</label><input class="input" id="a-name" autocomplete="name" maxlength="60" placeholder="' + __('π.χ. Μαρία Παπαδοπούλου') + '"></div>') : ''}
      <div class="field"><label class="label" for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="email" inputmode="email" maxlength="120"></div>
      ${kind !== 'reset' ? `<div class="field"><label class="label" for="a-pw">${__('Κωδικός')}${kind === 'signup' ? (' <span class="muted">' + __('(τουλάχιστον 6 χαρακτήρες)') + '</span>') : ''}</label>
        <div class="pw-wrap"><input class="input" id="a-pw" type="password" autocomplete="${kind === 'signup' ? 'new-password' : 'current-password'}" maxlength="100"><button type="button" class="pw-eye" aria-label="${__('Εμφάνιση κωδικού')}" aria-pressed="false">${ICON.eye}</button></div></div>` : ''}
      <p class="form-err" role="alert"></p>
      <button class="btn btn-primary btn-lg btn-wide" type="submit">${kind === 'login' ? __('Σύνδεση') : kind === 'signup' ? __('Δημιουργία λογαριασμού') : __('Στείλε μου σύνδεσμο')}</button>
    </form>
    <p class="auth-links">${kind === 'login' ? `<a href="#/signup${nextQ}">${__('Φτιάξε λογαριασμό')}</a><a href="#/reset">${__('Ξέχασες τον κωδικό;')}</a>`
      : kind === 'signup' ? `<a href="#/login${nextQ}">${__('Έχεις ήδη λογαριασμό; Σύνδεση')}</a>` : ('<a href="#/login">' + __('Πίσω στη σύνδεση') + '</a>')}</p>
    ${kind === 'signup' ? ('<p class="auth-note">' + __('Ο λογαριασμός χρειάζεται μόνο για τους εκπαιδευτικούς. Οι μαθητές μπαίνουν από τον σύνδεσμο που τους στέλνεις, χωρίς λογαριασμό.') + '</p>') : ''}
    ${DB.mode === 'demo' ? ('<p class="auth-note">' + __('Δοκιμαστική λειτουργία: ο λογαριασμός υπάρχει μόνο σε αυτόν τον browser.') + '</p>') : ''}
  </div></main></div>`;
  const form = el.querySelector('form');
  const errEl = el.querySelector('.form-err');
  const btn = form.querySelector('[type="submit"]');
  const eye = el.querySelector('.pw-eye');
  if (eye) eye.addEventListener('click', () => {
    const pw = el.querySelector('#a-pw');
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? __('Απόκρυψη κωδικού') : __('Εμφάνιση κωδικού'));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const email = el.querySelector('#a-email').value.trim();
    const pwEl = el.querySelector('#a-pw');
    const pw = pwEl ? pwEl.value : '';
    const name = el.querySelector('#a-name') ? el.querySelector('#a-name').value.trim() : '';
    if (kind === 'signup' && !name) { errEl.textContent = __('Γράψε το όνομά σου.'); el.querySelector('#a-name').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = __('Γράψε ένα σωστό email.'); el.querySelector('#a-email').focus(); return; }
    if (kind !== 'reset' && pw.length < 6) { errEl.textContent = __('Ο κωδικός έχει τουλάχιστον 6 χαρακτήρες.'); pwEl.focus(); return; }
    btn.disabled = true;
    try {
      if (kind === 'login') { await DB.signIn(email, pw); ctx.go(next, true); }
      else if (kind === 'signup') { await DB.signUp(email, pw, name); toast(`${__('Καλώς ήρθες, {0}!', name)}`, 'ok'); ctx.go(next, true); }
      else {
        await DB.resetPassword(email);
        el.querySelector('.auth-card form').innerHTML = `<p class="banner banner-ok">${__('Αν υπάρχει λογαριασμός με το {0}, θα λάβεις σε λίγο email με σύνδεσμο για νέο κωδικό. Κοίτα και στα ανεπιθύμητα.', esc(email))}</p>`;
      }
    } catch (er) {
      errEl.textContent = errText(er);
      btn.disabled = false;
    }
  });
  setTimeout(() => { if (form.contains(document.activeElement)) return; const f = form.querySelector('input'); if (f) f.focus(); }, 40);
}

/* ================= ΟΔΗΓΟΣ ΕΓΚΑΤΑΣΤΑΣΗΣ / SETUP GUIDE ================= */
function viewSetup() {
  setTitle(__('Οδηγός εγκατάστασης'));
  const el = app();
  el.className = 'v-auth v-setup';
  const fb = CFG.firebase;
  const en = LANG === 'en';
  const status = CONFIG_BROKEN
    ? `<p class="banner banner-bad">${en ? 'The <b>config.js</b> file could not be read because of a syntax error (usually a missing comma, quote or brace). Compare it with the example in step 6.' : 'Το αρχείο <b>config.js</b> δεν διαβάστηκε, γιατί έχει λάθος στη σύνταξη (συνήθως λείπει ένα κόμμα, ένα εισαγωγικό ή ένα άγκιστρο). Σύγκρινέ το με το παράδειγμα του βήματος 6.'}</p>`
    : DB.mode === 'firebase'
      ? `<p class="banner banner-ok">${en ? 'The platform is connected to the Firebase project' : 'Η πλατφόρμα είναι συνδεδεμένη με το έργο Firebase'} <b>${esc(fb.projectId)}</b>.</p>`
      : `<p class="banner">${en ? 'The platform is running in <b>demo mode</b>: everything is saved only in this browser. Follow the steps so that children can play from their own devices.' : 'Τώρα η πλατφόρμα τρέχει σε <b>δοκιμαστική λειτουργία</b>: όλα αποθηκεύονται μόνο σε αυτόν τον browser. Ακολούθησε τα βήματα για να παίζουν τα παιδιά από τις δικές τους συσκευές.'}</p>`;
  const step = (t, body) => `<li class="step"><h3 class="step-t">${t}</h3>${body}</li>`;
  const cfgExample = `<pre>firebase: {
  apiKey: "AIza…",
  authDomain: "quizopolis-school.firebaseapp.com",
  projectId: "quizopolis-school",
  storageBucket: "quizopolis-school.firebasestorage.app",
  messagingSenderId: "…",
  appId: "…"
}</pre>`;
  const rules = `<p><button type="button" class="btn" data-copy-rules>${ICON.copy}${__('Αντιγραφή κανόνων')}</button></p><details class="rules"><summary>${__('Δες τους κανόνες')}</summary><pre>${esc(RULES)}</pre></details>`;
  const EL = `
    <h1 class="h1">Πώς τη βάζεις στο διαδίκτυο, δωρεάν</h1>
    ${status}
    <p class="lead">Χρειάζεσαι το <b>Firebase</b> της Google για τους λογαριασμούς και τις απαντήσεις, και ένα δωρεάν μέρος για τη σελίδα: το <b>GitHub Pages</b> ή το <b>Cloudflare</b>. Κανένα δεν ζητάει κάρτα. Θα σου πάρει περίπου 20 λεπτά, μία φορά.</p>
    <h2 class="h2">Α. Η βάση δεδομένων (Firebase)</h2>
    <ol class="steps">
      ${step('Φτιάξε έργο Firebase', '<p>Άνοιξε το <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">console.firebase.google.com</a> με έναν λογαριασμό Google και πάτα <b>Create a project</b>. Δώσε ένα όνομα, π.χ. <i>quizopolis-school</i>. Το Google Analytics δεν χρειάζεται: κλείσ\' το. Το έργο μπαίνει αυτόματα στο δωρεάν πλάνο <b>Spark</b>.</p>')}
      ${step('Άνοιξε τους λογαριασμούς', '<p>Στο αριστερό μενού: <b>Security → Authentication → Get started</b> (σε παλιότερη εμφάνιση: Build → Authentication). Στην καρτέλα <b>Sign-in method</b> ενεργοποίησε δύο τρόπους:</p><ul><li><b>Email/Password</b>: για τους εκπαιδευτικούς.</li><li><b>Anonymous</b>: για τους μαθητές, που μπαίνουν μόνο με όνομα, χωρίς λογαριασμό.</li></ul>')}
      ${step('Φτιάξε τη βάση', '<p><b>Databases & Storage → Firestore → Create database</b> (σε παλιότερη εμφάνιση: Build → Firestore Database). Αν σε ρωτήσει για έκδοση, διάλεξε <b>Standard</b>. Για τοποθεσία διάλεξε μία στην Ευρώπη (π.χ. <i>eur3</i> ή <i>europe-west</i>), ώστε τα δεδομένα των παιδιών να μένουν στην ΕΕ. Ξεκίνα σε <b>production mode</b>.</p>')}
      ${step('Επικόλλησε τους κανόνες ασφαλείας', `<p>Στη βάση, άνοιξε την καρτέλα <b>Rules</b>, σβήσε ό,τι υπάρχει, επικόλλησε τους κανόνες και πάτα <b>Publish</b>. Οι κανόνες ορίζουν ότι κάθε εκπαιδευτικός βλέπει μόνο τα δικά του παιχνίδια και ότι κάθε μαθητής γράφει μόνο τις δικές του απαντήσεις.</p>${rules}`)}
      ${step('Πάρε τα στοιχεία σύνδεσης', '<p>Πάτα το γρανάζι ⚙ δίπλα στο <b>Project Overview → Project settings</b>. Κάτω κάτω, στο «Your apps», πάτα το εικονίδιο <b>&lt;/&gt;</b> (Web), δώσε ένα όνομα και πάτα <b>Register app</b> (το Firebase Hosting δεν χρειάζεται). Θα δεις ένα κομμάτι κώδικα με το <code>firebaseConfig</code>.</p>')}
      ${step('Γράψ\' τα στο config.js', `<p>Άνοιξε το αρχείο <b>config.js</b> της πλατφόρμας με ένα απλό πρόγραμμα κειμένου (Σημειωματάριο). Στη θέση του <code>firebase: null</code> βάλε το κομμάτι από το <code>{</code> μέχρι το <code>}</code>, ώστε να μοιάζει έτσι:</p>${cfgExample}<p>Το apiKey δεν είναι μυστικό: μπαίνει σε κάθε σελίδα που χρησιμοποιεί Firebase. Την ασφάλεια την κάνουν οι κανόνες του βήματος 4.</p>`)}
    </ol>
    <h2 class="h2">Β. Η σελίδα: GitHub Pages ή Cloudflare</h2>
    <p>Διάλεξε <b>ένα</b> από τα δύο. Είναι και τα δύο δωρεάν και σηκώνουν όσους επισκέπτες χρειαστεί.</p>
    <h3 class="host-h">Με GitHub Pages</h3>
    <ol class="steps" start="7">
      ${step('Φτιάξε αποθετήριο', '<p>Φτιάξε δωρεάν λογαριασμό στο <a href="https://github.com/" target="_blank" rel="noopener">github.com</a>. Πάτα <b>New repository</b>, δώσε όνομα, π.χ. <i>quizopolis</i>, διάλεξε <b>Public</b> και πάτα <b>Create repository</b>.</p>')}
      ${step('Ανέβασε τα αρχεία', '<p>Πάτα <b>uploading an existing file</b> και σύρε μέσα <b>όλα</b> τα αρχεία και τους φακέλους της πλατφόρμας (index.html, config.js, τον φάκελο js, τον φάκελο assets και τα υπόλοιπα). Πάτα <b>Commit changes</b>.</p>')}
      ${step('Άνοιξε τη σελίδα', '<p><b>Settings → Pages</b>. Στο «Build and deployment» διάλεξε <b>Deploy from a branch</b>, branch <b>main</b>, φάκελο <b>/ (root)</b> και πάτα <b>Save</b>. Σε ένα με δύο λεπτά η πλατφόρμα είναι στη διεύθυνση <code>https://ΟΝΟΜΑ.github.io/quizopolis/</code>.</p>')}
      ${step('Δήλωσε τη διεύθυνση στο Firebase', '<p>Στο Firebase: <b>Authentication → Settings → Authorized domains → Add domain</b> και γράψε <code>ΟΝΟΜΑ.github.io</code> (χωρίς https και χωρίς /quizopolis).</p>')}
    </ol>
    <h3 class="host-h">Ή με Cloudflare Workers</h3>
    <ol class="steps" start="7">
      ${step('Ανέβασε το πακέτο στο GitHub', '<p>Εδώ χρειάζεσαι το πακέτο για Cloudflare: ένα αρχείο <code>wrangler.jsonc</code> και δίπλα του τον φάκελο <code>public</code> με όλη την πλατφόρμα. Το <code>config.js</code> του βήματος 6 είναι μέσα στο <code>public</code>. Στο <a href="https://github.com/" target="_blank" rel="noopener">github.com</a> φτιάξε αποθετήριο με όνομα <i>quizopolis</i> (μπορεί να είναι και <b>Private</b>) και ανέβασε μέσα το <code>wrangler.jsonc</code> και τον φάκελο <code>public</code>.</p>')}
      ${step('Σύνδεσέ το με το Cloudflare', '<p>Φτιάξε δωρεάν λογαριασμό στο <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">dash.cloudflare.com</a>. Πήγαινε <b>Workers &amp; Pages → Create application</b>, διάλεξε <b>GitHub</b>, δώσε πρόσβαση και διάλεξε το αποθετήριο. Το όνομα του έργου πρέπει να είναι <b>quizopolis</b>, όπως μέσα στο <code>wrangler.jsonc</code>. Πάτα <b>Save and Deploy</b>.</p>')}
      ${step('Δήλωσε τη διεύθυνση στο Firebase', '<p>Σε ένα με δύο λεπτά η πλατφόρμα είναι στη διεύθυνση που δείχνει το Cloudflare, π.χ. <code>https://quizopolis.ΟΝΟΜΑ.workers.dev</code>. Στο Firebase: <b>Authentication → Settings → Authorized domains → Add domain</b> και γράψε <code>quizopolis.ΟΝΟΜΑ.workers.dev</code> (χωρίς https). Από εκεί και πέρα, ό,τι αλλάζεις στο GitHub ανεβαίνει μόνο του.</p>')}
    </ol>
    <h2 class="h2">Γ. Δοκίμασε</h2>
    <p>Άνοιξε τη διεύθυνση, φτιάξε τον λογαριασμό σου, πάτα «Πρόσθεσε παραδείγματα» και μοιράσου ένα παιχνίδι. Άνοιξε τον σύνδεσμο από το κινητό σου και παίξε ως μαθητής. Αν κάτι δεν δουλεύει, η πλατφόρμα σου λέει ποιο βήμα έλειψε.</p>
    <h2 class="h2">Καλό να ξέρεις</h2>
    <ul class="notes">
      <li><b>Όρια του δωρεάν πλάνου.</b> Το Firebase δίνει κάθε μέρα 50.000 αναγνώσεις και 20.000 εγγραφές, κοινές για όλους τους εκπαιδευτικούς. Ένα κουίζ 10 ερωτήσεων που το παίζουν 25 παιδιά θέλει περίπου 1.300 αναγνώσεις και 300 εγγραφές· ο αγώνας δρόμου και ο Εκατομμυριούχος γύρω στις 2.000 αναγνώσεις. Άρα χωράνε περίπου 25 με 35 τέτοια παιχνίδια την ημέρα. Το πιο «ακριβό» κομμάτι είναι η κατάταξη στο τέλος: αν την κλείσεις στις ρυθμίσεις του συνδέσμου, το παιχνίδι θέλει περίπου τις μισές αναγνώσεις. Αν το όριο ξεπεραστεί, η βάση σταματά μέχρι να μηδενιστεί ο μετρητής, γύρω στις 10 το πρωί (ώρα Ελλάδας). Δεν υπάρχει χρέωση. Την κατανάλωση τη βλέπεις στη βάση, στην καρτέλα <b>Usage</b>.</li>
      <li><b>Πολλοί εκπαιδευτικοί.</b> Η σελίδα (GitHub Pages ή Cloudflare) σηκώνει όσους χρειαστεί· το όριο είναι μόνο το ημερήσιο του Firebase, που το μοιράζονται όλοι. Για ένα σχολείο συνήθως φτάνει. Αν μπουν πολλά σχολεία, καλύτερα το καθένα να στήσει δικό του αντίγραφο με δικό του έργο Firebase, με τα ίδια βήματα. Αλλιώς, το έργο περνά στο πλάνο <b>Blaze</b> με κάρτα και πληρώνεις μόνο ό,τι ξεπερνά το δωρεάν όριο (μερικά σεντς για κάθε 100.000 αναγνώσεις). Βάλε τότε και ειδοποίηση προϋπολογισμού: σε ειδοποιεί, αλλά δεν σταματά τη χρέωση.</li>
      <li><b>Πολλά παιδιά για πρώτη φορά.</b> Το Firebase δέχεται έως 100 νέους λογαριασμούς μαθητών την ώρα από την ίδια διεύθυνση δικτύου, και στο σχολείο όλες οι συσκευές βγαίνουν συνήθως από την ίδια. Κάθε συσκευή φτιάχνει λογαριασμό μόνο την πρώτη φορά, γιατί ο browser τον θυμάται. Αν περιμένεις όλο το σχολείο να μπει για πρώτη φορά την ίδια ώρα, αύξησε προσωρινά το όριο στο <b>Security → Authentication → Sign-in method</b> (ρύθμιση «sign-up quota»).</li>
      <li><b>Απόρρητο.</b> Τα παιδιά δεν φτιάχνουν λογαριασμό και δεν δίνουν email. Προτίμησε μικρό όνομα και αρχικό επωνύμου στις λίστες τάξης. Σβήνε τις παλιές αναφορές στο τέλος της χρονιάς.</li>
      <li><b>Εικόνες.</b> Οι εικόνες μικραίνουν αυτόματα και αποθηκεύονται μέσα στο παιχνίδι. Κάθε παιχνίδι χωράει περίπου 1 MB, δηλαδή γύρω στις 6 με 8 εικόνες. Μετράνε στο μηνιαίο όριο μεταφοράς του Firebase (10 GB): ένα γεμάτο εικόνες παιχνίδι για 25 παιδιά θέλει περίπου 25 MB, άρα χωράνε γύρω στα 400 τέτοια τον μήνα. Αν ξεπεραστεί το μηνιαίο όριο, η βάση σταματά ως το τέλος του μήνα.</li>
      <li><b>Γλώσσα.</b> Η πλατφόρμα έχει ελληνικά και αγγλικά. Η προεπιλογή αλλάζει στο config.js (<code>lang: 'el'</code> ή <code>'en'</code>) και ο σύνδεσμος που μοιράζεσαι ανοίγει στη γλώσσα που είχες όταν τον έφτιαξες.</li>
      <li><b>Όνομα.</b> Το όνομα «${esc(CFG.siteName)}» αλλάζει στο config.js.</li>
    </ul>`;
  const EN = `
    <h1 class="h1">How to put it online, for free</h1>
    ${status}
    <p class="lead">You need Google's <b>Firebase</b> for accounts and answers, and a free place for the website: <b>GitHub Pages</b> or <b>Cloudflare</b>. None of them asks for a card. It takes about 20 minutes, once.</p>
    <h2 class="h2">A. The database (Firebase)</h2>
    <ol class="steps">
      ${step('Create a Firebase project', '<p>Open <a href="https://console.firebase.google.com/" target="_blank" rel="noopener">console.firebase.google.com</a> with a Google account and click <b>Create a project</b>. Give it a name, e.g. <i>quizopolis-school</i>. You don\'t need Google Analytics: turn it off. The project starts on the free <b>Spark</b> plan.</p>')}
      ${step('Turn on accounts', '<p>In the left menu: <b>Security → Authentication → Get started</b> (in the older layout: Build → Authentication). In the <b>Sign-in method</b> tab, enable two providers:</p><ul><li><b>Email/Password</b>: for teachers.</li><li><b>Anonymous</b>: for students, who join with just a name and no account.</li></ul>')}
      ${step('Create the database', '<p><b>Databases & Storage → Firestore → Create database</b> (in the older layout: Build → Firestore Database). If asked for an edition, choose <b>Standard</b>. For the location, pick one in Europe (e.g. <i>eur3</i> or <i>europe-west</i>) if your school is in the EU, so children\'s data stays there. Start in <b>production mode</b>.</p>')}
      ${step('Paste the security rules', `<p>In the database, open the <b>Rules</b> tab, delete what is there, paste the rules and click <b>Publish</b>. The rules make sure each teacher sees only their own games and each student writes only their own answers.</p>${rules}`)}
      ${step('Get the connection details', '<p>Click the gear ⚙ next to <b>Project Overview → Project settings</b>. At the bottom, under “Your apps”, click the <b>&lt;/&gt;</b> (Web) icon, give it a name and click <b>Register app</b> (you don\'t need Firebase Hosting). You will see a piece of code with <code>firebaseConfig</code>.</p>')}
      ${step('Put them in config.js', `<p>Open the platform's <b>config.js</b> file in a plain text editor (Notepad). Replace <code>firebase: null</code> with the part from <code>{</code> to <code>}</code>, so that it looks like this:</p>${cfgExample}<p>The apiKey is not a secret: it is part of every website that uses Firebase. Security comes from the rules in step 4.</p>`)}
    </ol>
    <h2 class="h2">B. The website: GitHub Pages or Cloudflare</h2>
    <p>Choose <b>one</b> of the two. Both are free and handle as many visitors as you need.</p>
    <h3 class="host-h">With GitHub Pages</h3>
    <ol class="steps" start="7">
      ${step('Create a repository', '<p>Create a free account at <a href="https://github.com/" target="_blank" rel="noopener">github.com</a>. Click <b>New repository</b>, name it, e.g. <i>quizopolis</i>, choose <b>Public</b> and click <b>Create repository</b>.</p>')}
      ${step('Upload the files', '<p>Click <b>uploading an existing file</b> and drag in <b>all</b> the platform\'s files and folders (index.html, config.js, the js folder, the assets folder and the rest). Click <b>Commit changes</b>.</p>')}
      ${step('Turn on the website', '<p><b>Settings → Pages</b>. Under “Build and deployment” choose <b>Deploy from a branch</b>, branch <b>main</b>, folder <b>/ (root)</b> and click <b>Save</b>. In a minute or two the platform is live at <code>https://NAME.github.io/quizopolis/</code>.</p>')}
      ${step('Add the address to Firebase', '<p>In Firebase: <b>Authentication → Settings → Authorized domains → Add domain</b> and type <code>NAME.github.io</code> (without https and without /quizopolis).</p>')}
    </ol>
    <h3 class="host-h">Or with Cloudflare Workers</h3>
    <ol class="steps" start="7">
      ${step('Upload the package to GitHub', '<p>Here you need the Cloudflare package: a <code>wrangler.jsonc</code> file with a <code>public</code> folder next to it that holds the whole platform. The <code>config.js</code> from step 6 is inside <code>public</code>. At <a href="https://github.com/" target="_blank" rel="noopener">github.com</a> create a repository named <i>quizopolis</i> (it can be <b>Private</b>) and upload <code>wrangler.jsonc</code> and the <code>public</code> folder.</p>')}
      ${step('Connect it to Cloudflare', '<p>Create a free account at <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">dash.cloudflare.com</a>. Go to <b>Workers &amp; Pages → Create application</b>, choose <b>GitHub</b>, allow access and pick the repository. The project name must be <b>quizopolis</b>, the same as in <code>wrangler.jsonc</code>. Click <b>Save and Deploy</b>.</p>')}
      ${step('Add the address to Firebase', '<p>In a minute or two the platform is live at the address Cloudflare shows, e.g. <code>https://quizopolis.NAME.workers.dev</code>. In Firebase: <b>Authentication → Settings → Authorized domains → Add domain</b> and type <code>quizopolis.NAME.workers.dev</code> (without https). From then on, whatever you change on GitHub is published automatically.</p>')}
    </ol>
    <h2 class="h2">C. Try it</h2>
    <p>Open the address, create your account, click “Add examples” and share a game. Open the link on your phone and play as a student. If something doesn't work, the platform tells you which step is missing.</p>
    <h2 class="h2">Good to know</h2>
    <ul class="notes">
      <li><b>Free plan limits.</b> Firebase gives 50,000 reads and 20,000 writes a day, shared by all the teachers. A 10-question quiz played by 25 children needs about 1,300 reads and 300 writes; the race and Millionaire about 2,000 reads. So about 25 to 35 such games fit in a day. The most “expensive” part is the leaderboard at the end: if you turn it off in the link settings, a game needs about half the reads. If the limit is exceeded, the database pauses until the daily reset (midnight Pacific time). There is no charge. You can see the usage in the database's <b>Usage</b> tab.</li>
      <li><b>Many teachers.</b> The website (GitHub Pages or Cloudflare) handles as many people as you need; the only limit is Firebase's daily one, which everyone shares. For one school it is usually enough. If several schools join, it is better for each to set up its own copy with its own Firebase project, using the same steps. Otherwise, the project can move to the <b>Blaze</b> plan with a card, and you pay only for what goes beyond the free limit (a few cents per 100,000 reads). In that case also set a budget alert: it warns you but does not stop charges.</li>
      <li><b>Many children for the first time.</b> Firebase accepts up to 100 new student accounts an hour from the same network address, and at school all devices usually share one. Each device creates an account only the first time, because the browser remembers it. If you expect the whole school to join for the first time in the same hour, raise the limit temporarily under <b>Security → Authentication → Sign-in method</b> (the sign-up quota setting).</li>
      <li><b>Privacy.</b> Children don't create accounts or give an email address. Use a first name and the initial of the surname in class lists. Delete old reports at the end of the school year.</li>
      <li><b>Images.</b> Images are resized automatically and stored inside the game. Each game holds about 1 MB, that is around 6 to 8 images. They count towards Firebase's monthly transfer limit (10 GB): a game full of images played by 25 children needs about 25 MB, so around 400 of those fit in a month. If the monthly limit is exceeded, the database stops until the end of the month.</li>
      <li><b>Language.</b> The platform is in Greek and English. The default is set in config.js (<code>lang: 'el'</code> or <code>'en'</code>), and a link you share opens in the language you were using when you created it.</li>
      <li><b>Name.</b> The name “${esc(CFG.siteName)}” can be changed in config.js.</li>
    </ul>`;
  el.innerHTML = `<div class="auth">${siteHeader(true)}<main class="wrap setup">${en ? EN : EL}</main></div>`;
  el.querySelector('[data-copy-rules]').addEventListener('click', () => copy(RULES).then(() => toast(__('Αντιγράφηκαν οι κανόνες.'), 'ok'), () => toast(__('Δεν έγινε αντιγραφή. Άνοιξε το «Δες τους κανόνες» και αντέγραψέ τους με το χέρι.'), 'error')));
}

/* ================= ΕΚΚΙΝΗΣΗ ================= */
/* Αν μια πολιτική ασφαλείας (CSP) του φιλοξενητή μπλοκάρει τις γραμματοσειρές της εφαρμογής, φορτώνεται το ίδιο Inter από το Google Fonts.
   If the host's Content Security Policy blocks our own font files, the same Inter is loaded from Google Fonts instead. */
document.addEventListener('securitypolicyviolation', (e) => {
  if (e.effectiveDirective !== 'font-src' || document.getElementById('qz-gf')) return;
  const l = document.createElement('link');
  l.id = 'qz-gf';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap';
  document.head.appendChild(l);
});
async function boot() {
  const root = app();
  try {
    await initStore();
  } catch (e) {
    root.className = 'v-auth';
    root.innerHTML = `<div class="auth"><main class="auth-main"><div class="auth-card"><h1 class="h2">${__('Η πλατφόρμα δεν ξεκίνησε')}</h1><p>${esc(errText(e))}</p><p><button class="btn btn-primary" type="button" data-reload>${__('Ξαναδοκίμασε')}</button></p></div></main></div>`;
    root.querySelector('[data-reload]').addEventListener('click', () => location.reload());
    return;
  }
  document.documentElement.classList.toggle('is-demo', DB.mode === 'demo');
  await new Promise((resolve) => {
    DB.onAuth((u) => {
      if (!booted) { booted = true; resolve(); return; }
      const { path } = parse();
      if (!u && /^\/t(\/|$)/.test(path)) ctx.go('/login', true);
    });
  });
  window.addEventListener('hashchange', () => route());
  window.addEventListener('beforeunload', (e) => { if (guard && guard()) { e.preventDefault(); e.returnValue = ''; } });
  route(true);
}
boot();
