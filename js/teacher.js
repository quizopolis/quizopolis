/* Πίνακας εκπαιδευτικού: πλαϊνό μενού, τα παιχνίδια μου, «Στείλε στην τάξη», αποτελέσματα, τάξεις, λογαριασμός.
   Teacher area: sidebar, my games, "Send to class", results, classes, account. */
import { esc, app, setTitle, CFG, toast, dialog, fmtDate, plural, ICON, LOGO, errText, confirmDanger, busy, norm, local, rid, sleep, langSwitch, avatar, popMenu } from './ui.js';
import { DB } from './store.js';
import { TYPES, validateQuestion, tidyQuestion } from './qtypes.js';
import { MODES, BASIC_MODES, REVIEW_MODES } from './modes.js';
import { TEAM_SET } from './scoring.js';
import { sampleGames } from './samples.js';
import { sampleGamesEn } from './samples-en.js';
import { __, LANG, LOCALE, rememberLang } from './i18n.js';
import { choiceOf, linkModeOf } from './choose.js';
import { gameIcon, tint } from './gicons.js';

/* ---------- πλαϊνό μενού (στο κινητό: μπάρα στο κάτω μέρος) ---------- */
export function teacherTop(active) {
  rememberLang();
  const u = DB.user();
  const name = u ? (u.name || u.email || '') : '';
  const items = [['lib', '/t', __('Τα παιχνίδια μου'), ICON.grid], ['links', '/t/links', __('Αποτελέσματα'), ICON.chart], ['classes', '/t/classes', __('Τάξεις'), ICON.users]];
  return `<aside class="tside" aria-label="${__('Μενού εκπαιδευτικού')}">
    <a class="ts-brand" href="#/t">${LOGO}<span>${esc(CFG.siteName)}</span></a>
    <a class="btn btn-primary ts-new" href="#/t/new">${ICON.plus}<span>${__('Νέο παιχνίδι')}</span></a>
    <nav class="ts-nav">${items.map(([k, href, label, ic]) => `<a class="ts-a tab" href="#${href}"${k === active ? ' aria-current="page"' : ''}>${ic}<span>${label}</span></a>`).join('')}</nav>
    <div class="ts-foot">${langSwitch('lang-sw-sm')}<a class="ts-me" href="#/t/account"${active === 'account' ? ' aria-current="page"' : ''}>${avatar(name)}<span class="ts-me-t"><b>${esc(name)}</b><small>${__('Λογαριασμός')}</small></span><span class="sr">${__('Λογαριασμός')}</span></a></div>
  </aside>${DB.mode === 'demo' ? `<div class="demo-bar">${__('Δοκιμαστική λειτουργία: όλα αποθηκεύονται μόνο σε αυτόν τον browser.')} <a href="#/setup">${__('Πώς τη συνδέω με τη δωρεάν βάση Firebase')}</a></div>` : ''}`;
}

/* ---------- μικρά βοηθητικά ---------- */
const QUICK = ['classic', 'millionaire', 'penalty', 'race', 'escape'];
const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export function closesText(deadline) {
  if (!deadline) return __('Χωρίς προθεσμία');
  const days = Math.round((dayStart(deadline) - dayStart(Date.now())) / 864e5);
  if (days <= 0) return __('Κλείνει σήμερα');
  if (days === 1) return __('Κλείνει αύριο');
  return __('Κλείνει σε {0} μέρες', days);
}
/* «Ανοιχτό ως Κυριακή 29/11» */
export function untilText(deadline) {
  const d = new Date(deadline);
  return `${d.toLocaleDateString(LOCALE, { weekday: 'long' })} ${d.getDate()}/${d.getMonth() + 1}`;
}

/* ================= ΤΑ ΠΑΙΧΝΙΔΙΑ ΜΟΥ ================= */
export function viewLibrary(ctx) {
  setTitle(__('Τα παιχνίδια μου'));
  const el = app();
  el.className = 'v-teacher';
  const u = DB.user();
  const first = String((u && u.name) || '').trim().split(/\s+/)[0] || '';
  const hello = first ? (new Date().getHours() < 12 ? __('Καλημέρα, {0}', first) : __('Καλησπέρα, {0}', first)) : __('Καλώς ήρθες');
  const quick = QUICK.map((id) => `<a class="qt" href="#/t/new/${id}">${gameIcon(id, { size: 40 })}<span>${esc(MODES[id].label)}</span></a>`).join('')
    + `<a class="qt qt-all" href="#/t/new"><span class="gstack">${['jeopardy', 'snakes', 'picture'].map((id) => gameIcon(id, { size: 26 })).join('')}</span><span>${__('Όλα τα παιχνίδια')}</span></a>`;
  el.innerHTML = teacherTop('lib') + `<main class="tmain">
    <div class="thead lib-head"><div><h1 class="h1">${esc(hello)}</h1><p class="lib-sub">${__('Τι θα παίξετε σήμερα;')}</p></div>
      <label class="search">${ICON.search}<span class="sr">${__('Αναζήτηση παιχνιδιού')}</span><input type="search" data-q placeholder="${__('Αναζήτηση στα παιχνίδια σου')}"></label></div>
    <nav class="quick" aria-label="${__('Ξεκίνα νέο παιχνίδι')}">${quick}</nav>
    <div class="sec-h"><h2>${__('Τα παιχνίδια μου')}<span class="n" data-n></span></h2></div>
    <div data-list><p class="muted">${__('Φορτώνει…')}</p></div>
    <section data-live hidden><div class="sec-h"><h2>${__('Παίζονται τώρα')}</h2><a href="#/t/links">${__('Όλα τα αποτελέσματα')}</a></div><div class="live" data-live-rows></div></section>
  </main>`;
  const list = el.querySelector('[data-list]');
  let games = [], alive = true;
  const unsubs = [];
  const card = (g) => {
    const ch = choiceOf(g.mode);
    const c = (g.cover && g.cover.color) || '#0F8A5F';
    const id = esc(g.id);
    const title = g.title || __('Χωρίς τίτλο');
    const meta = [`<span class="pill">${plural(g.count || 0, __('ερώτηση'), __('ερωτήσεις'))}</span>`]
      .concat(g.incomplete ? [`<span class="pill pill-warn">${plural(g.incomplete, __('θέλει συμπλήρωση'), __('θέλουν συμπλήρωση'))}</span>`] : [])
      .concat(g.subject ? [`<span class="pill">${esc(__(g.subject))}</span>`] : [])
      .concat((g.grades || []).slice(0, 3).map((x) => `<span class="pill">${esc(__(x))}</span>`)).join('');
    const main = ch && ch.stage
      ? `<a class="btn btn-line btn-sm" href="#/t/stage/${id}">${ICON.screen}${__('Στην οθόνη της τάξης')}</a>`
      : `<button class="btn btn-soft btn-sm" type="button" data-share="${id}">${ICON.send}${__('Στείλε στην τάξη')}</button>`;
    return `<article class="gcard" data-id="${id}">
      <a class="gcard-cover" href="#/t/edit/${id}" style="background:${tint(c, 0.16)}" tabindex="-1" aria-hidden="true">${ch ? `<span class="gcard-badge gcard-game">${gameIcon(g.mode, { size: 24 })}<span>${esc(ch.full)}</span></span>` : ''}<span class="gcard-emoji">${esc((g.cover && g.cover.emoji) || '🧠')}</span></a>
      <div class="gcard-body"><h2 class="gcard-t"><a href="#/t/edit/${id}">${esc(title)}</a></h2>
        ${ch ? `<p class="sr">${esc(ch.full)}</p>` : ''}<p class="gcard-meta">${meta}</p></div>
      <div class="gcard-actions">${main}<button class="icon-btn" type="button" data-menu="${id}" aria-haspopup="menu" aria-expanded="false" aria-label="${__('Περισσότερα για το «{0}»', esc(title))}" title="${__('Περισσότερα')}">${ICON.more}</button></div>
    </article>`;
  };
  const draw = () => {
    const q = norm(el.querySelector('[data-q]').value);
    const shown = games.filter((g) => !q || norm(`${g.title} ${g.subject || ''} ${g.subject ? __(g.subject) : ''} ${g.description || ''}`).includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    el.querySelector('[data-n]').textContent = games.length ? String(games.length) : '';
    if (!games.length) {
      list.innerHTML = `<div class="empty"><p class="empty-t">${__('Δεν έχεις ακόμη παιχνίδια.')}</p>
        <p>${__('Διάλεξε ένα παιχνίδι από πάνω για να ξεκινήσεις, ή πρόσθεσε έτοιμα παραδείγματα με όλα τα είδη ερωτήσεων για να δεις πώς δουλεύουν.')}</p>
        <p class="actions center"><a class="btn btn-primary" href="#/t/new">${ICON.plus}${__('Νέο παιχνίδι')}</a><button class="btn btn-line" type="button" data-samples>${__('Πρόσθεσε παραδείγματα')}</button></p></div>`;
      return;
    }
    list.innerHTML = shown.length ? `<div class="gcards">${shown.map(card).join('')}</div>`
      : ('<div class="empty"><p class="empty-t">' + __('Κανένα παιχνίδι δεν ταιριάζει με την αναζήτηση.') + '</p></div>');
  };
  const load = () => DB.listGames().then((gs) => { if (!alive) return; games = gs; draw(); }, (e) => { list.innerHTML = `<div class="banner banner-bad">${esc(errText(e))}</div>`; });
  el.querySelector('[data-q]').addEventListener('input', draw);

  const dup = async (gid) => {
    let g = null;
    try { g = await DB.getGame(gid); } catch (er) { toast(errText(er), 'error'); }
    if (!g) return;
    const copyG = JSON.parse(JSON.stringify(g));
    delete copyG.id; delete copyG.createdAt;
    copyG.title = `${g.title} ${__('(αντίγραφο)')}`;
    try { await DB.saveGame(copyG); toast(__('Έγινε αντίγραφο.'), 'ok'); load(); } catch (er) { toast(errText(er), 'error'); }
  };
  const del = async (gid) => {
    const g = games.find((x) => x.id === gid);
    if (g && await confirmDanger(`${__('Διαγραφή του «{0}»;', g.title || __('Χωρίς τίτλο'))}`, __('Το παιχνίδι θα σβηστεί. Οι σύνδεσμοι που έχεις ήδη στείλει και τα αποτελέσματά τους μένουν.'))) {
      try { await DB.deleteGame(g.id); toast(__('Διαγράφηκε.'), 'ok'); load(); } catch (er) { toast(errText(er), 'error'); }
    }
  };
  const share = async (gid, btn) => {
    if (btn) btn.disabled = true;
    try { const g = await DB.getGame(gid); if (g) await shareDialog(g, ctx); else toast(__('Το παιχνίδι δεν βρέθηκε.'), 'error'); } catch (er) { toast(errText(er), 'error'); }
    if (btn) btn.disabled = false;
  };
  list.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-samples]')) {
      const b = busy(__('Προστίθενται τα παραδείγματα…'));
      try { for (const g of (LANG === 'en' ? sampleGamesEn() : sampleGames()).reverse()) { await DB.saveGame(g); await sleep(5); } } catch (er) { toast(errText(er), 'error'); }
      b.close();
      load();
    }
    if (t.dataset.share) share(t.dataset.share, t);
    if (t.dataset.menu) {
      const gid = t.dataset.menu;
      const g = games.find((x) => x.id === gid) || {};
      const ch = choiceOf(g.mode);
      popMenu(t, [
        { label: __('Επεξεργασία'), icon: ICON.edit, act: () => ctx.go('/t/edit/' + gid) },
        ch && ch.stage ? { label: __('Στείλε σύνδεσμο στα παιδιά'), icon: ICON.send, act: () => share(gid) } : { label: __('Στον προβολέα της τάξης'), icon: ICON.screen, act: () => ctx.go('/t/stage/' + gid) },
        { label: __('Αντίγραφο'), icon: ICON.copy, act: () => dup(gid) },
        '-',
        { label: __('Διαγραφή'), icon: ICON.trash, danger: true, act: () => del(gid) }
      ]);
    }
  });

  /* Όσα παίζονται τώρα: οι ανοιχτοί σύνδεσμοι, με το πόσα παιδιά έπαιξαν. */
  (async () => {
    let sessions = [], classes = [];
    try { [sessions, classes] = await Promise.all([DB.listSessions(), DB.listClasses().catch(() => [])]); } catch (e) { return; }
    if (!alive) return;
    const open = sessions.filter((s) => linkState(s) === 'open').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
    if (!open.length) return;
    const box = el.querySelector('[data-live]');
    const rows = el.querySelector('[data-live-rows]');
    box.hidden = false;
    rows.innerHTML = open.map((s) => {
      const m = MODES[s.mode] || MODES.classic;
      const cls = classes.find((c) => c.id === s.classId);
      const cn = s.className || (cls && cls.name);
      return `<div class="lrow">${gameIcon(s.mode, { size: 40 })}<div class="lrow-t"><b>${esc(s.title)}</b><small>${esc(m.label)}${cn ? `, ${esc(cn)}` : ''}</small></div>
        <div class="lrow-p" data-prog="${esc(s.id)}"><small>${__('Φορτώνει…')}</small><div class="bar"><i style="width:0"></i></div></div>
        <span class="live-dot">${esc(closesText(s.deadline))}</span><a class="btn btn-line btn-sm" href="#/t/link/${esc(s.id)}">${__('Αποτελέσματα')}</a></div>`;
    }).join('');
    open.forEach((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      const total = cls ? (cls.students || []).length : 0;
      let un = null;
      un = DB.watchPlayers(s.id, (ps) => {
        if (!alive) return;
        const p = rows.querySelector(`[data-prog="${s.id}"]`);
        if (!p) return;
        const joined = ps.length, done = ps.filter((x) => x.done).length;
        const frac = total ? Math.min(1, joined / total) : joined ? done / joined : 0;
        p.querySelector('small').innerHTML = total ? __('<b>{0}</b> από {1} παιδιά έπαιξαν', joined, total)
          : joined ? __('<b>{0}</b> μπήκαν, {1} τελείωσαν', joined, done) : __('Δεν έχει παίξει κανείς ακόμη');
        p.querySelector('.bar i').style.width = `${Math.round(frac * 100)}%`;
        if (un) { un(); un = null; }
      }, () => {});
      if (un) unsubs.push(() => { if (un) un(); });
    });
  })();
  ctx.setCleanup(() => { alive = false; unsubs.forEach((f) => f()); document.querySelectorAll('.menu').forEach((m) => m.remove()); });
  load();
}

/* ================= ΣΤΕΙΛΕ ΣΤΗΝ ΤΑΞΗ ================= */
const DEADLINES = [[1, __('1 μέρα')], [3, __('3 μέρες')], [7, __('1 εβδομάδα')], [14, __('2 εβδομάδες')], [30, __('1 μήνας')], [0, __('Χωρίς προθεσμία')]];
const OPT_SHORT = {
  timer: __('χρονόμετρο'), showAnswers: __('σωστές απαντήσεις'), powerups: __('βοήθειες'), shuffleQ: __('ανακάτεμα ερωτήσεων'),
  shuffleA: __('ανακάτεμα απαντήσεων'), leaderboard: __('κατάταξη'), showResults: __('διορθώσεις στο τέλος')
};

export async function shareDialog(game0, ctx) {
  if (!(game0.questions || []).length) { dialog({ title: __('Το παιχνίδι δεν έχει ερωτήσεις'), text: __('Πρόσθεσε ερωτήσεις στον επεξεργαστή και ξαναδοκίμασε.') }); return; }
  /* Μόνο οι συμπληρωμένες ερωτήσεις μπαίνουν στο παιχνίδι (ο επεξεργαστής αποθηκεύει και τις μισές). */
  const ready = game0.questions.filter((q) => TYPES[q.type] && !validateQuestion(q).length).map((q) => tidyQuestion(JSON.parse(JSON.stringify(q))));
  const skipped = game0.questions.length - ready.length;
  if (!ready.length) { dialog({ title: __('Καμία ερώτηση δεν είναι έτοιμη'), text: __('Συμπλήρωσε τις ερωτήσεις στον επεξεργαστή και ξαναδοκίμασε.') }); return; }
  const game = Object.assign({}, game0, { questions: ready });
  let classes = [];
  try { classes = await DB.listClasses(); } catch (e) { /* ignore */ }
  const remembered = local.get('qz:sharePrefs', {});
  const chosen = linkModeOf(game.mode);
  let mode = chosen || (MODES[remembered.mode] ? remembered.mode : 'classic');
  let picture = null;
  const scoredCount = (game.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored).length;
  const days0 = DEADLINES.some(([d]) => d === remembered.days) ? remembered.days : 7;
  const modeCard = (k) => `<label class="mode-c"><input type="radio" name="mode" value="${k}" ${k === mode ? 'checked' : ''}><span class="mode-in">${gameIcon(k, { size: 36 })}<span class="mode-l">${esc(MODES[k].label)}</span></span></label>`;
  const grids = `<fieldset class="sd-modes"><legend class="label">${__('Κουίζ και μελέτη')}</legend><div class="mode-grid">${BASIC_MODES.map(modeCard).join('')}</div></fieldset>
    <fieldset class="sd-modes"><legend class="label">${__('Παιχνίδια επανάληψης')}</legend><div class="mode-grid">${REVIEW_MODES.map(modeCard).join('')}</div></fieldset>
    <p class="sd-desc" data-desc></p>`;
  const classHint = (id) => (id ? __('Τα παιδιά βρίσκουν το όνομά τους στη λίστα και παίζουν, χωρίς κωδικούς.')
    : classes.length ? __('Χωρίς λίστα, τα παιδιά γράφουν μόνα τους το όνομά τους.') : __('Στις «Τάξεις» μπορείς να φτιάξεις λίστα με τα ονόματα, ώστε τα παιδιά να πατούν το δικό τους.'));
  const remClass = classes.some((c) => c.id === remembered.classId) ? remembered.classId : '';
  const html = `<div class="sd">
    <div class="sd-game"><span data-chosen-i>${gameIcon(mode, { size: 40 })}</span><span class="sd-game-t"><b data-chosen-n>${esc(MODES[mode].label)}</b><small>${esc(game.title || __('Χωρίς τίτλο'))}, ${plural(game.questions.length, __('ερώτηση'), __('ερωτήσεις'))}</small></span>
      <button type="button" class="btn btn-sm btn-line" data-other aria-expanded="${chosen ? 'false' : 'true'}">${__('Άλλο παιχνίδι')}</button></div>
    <div class="sd-all"${chosen ? ' hidden' : ''}>${grids}</div>
    <div class="field"><label class="label" for="sd-class">${__('Ποια τάξη θα παίξει;')}</label><select class="input" id="sd-class">
      <option value="">${__('Χωρίς λίστα τάξης')}</option>
      ${classes.map((c) => `<option value="${esc(c.id)}" ${remClass === c.id ? 'selected' : ''}>${esc(c.name)}, ${plural((c.students || []).length, __('παιδί'), __('παιδιά'))}</option>`).join('')}</select>
      <p class="hint" data-class-hint>${classHint(remClass)}</p></div>
    <fieldset class="field"><legend class="label">${__('Ως πότε θα παίζουν;')}</legend><div class="chips-pick">${DEADLINES.map(([d, l]) => `<label class="chip-pick"><input type="radio" name="sd-days" value="${d}" ${d === days0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <details class="sd-more"><summary><span>${__('Περισσότερες ρυθμίσεις')}<small data-more-sum></small></span>${ICON.chev}</summary><div class="sd-opts" data-opts></div></details>
    ${skipped ? `<p class="banner sd-skip">${skipped === 1 ? __('Μία ερώτηση δεν είναι συμπληρωμένη και δεν θα μπει στο παιχνίδι.') : __('{0} ερωτήσεις δεν είναι συμπληρωμένες και δεν θα μπουν στο παιχνίδι.', skipped)}</p>` : ''}
    <div class="sd-warn" data-warn></div></div>`;
  const toggle = (k, label, on, hint = '') => `<label class="check"><input type="checkbox" data-o="${k}" ${on ? 'checked' : ''}><span>${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</span></label>`;
  const summary = (dlg) => {
    const on = [];
    dlg.querySelectorAll('[data-o]').forEach((x) => {
      if (x.type === 'checkbox') { if (x.checked && OPT_SHORT[x.dataset.o]) on.push(OPT_SHORT[x.dataset.o]); }
      else if (x.dataset.o === 'teams') on.push(__('{0} ομάδες', x.value));
      else if (x.dataset.o === 'goal') on.push(__('στόχος {0}%', x.value));
    });
    const s = on.length ? on.join(', ') : __('Χωρίς επιπλέον ρυθμίσεις');
    dlg.querySelector('[data-more-sum]').textContent = s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1);
  };
  const drawOpts = (dlg) => {
    const m = MODES[mode];
    const d = Object.assign({}, m.defaults, (remembered.opts || {})[mode] || {});
    let desc = m.desc + (m.note ? ` ${m.note}` : '');
    if (m.group === 'review' && scoredCount < (game.questions || []).length) desc += (' ' + __('Οι ερωτήσεις χωρίς σωστή απάντηση (δημοσκόπηση, ανοιχτή) δεν μπαίνουν στα παιχνίδια επανάληψης.'));
    dlg.querySelector('[data-desc]').textContent = desc;
    let h = '';
    if ('timer' in d) h += toggle('timer', __('Χρονόμετρο σε κάθε ερώτηση'), d.timer, __('Ο χρόνος ορίζεται στην κάθε ερώτηση. Γρήγορες σωστές απαντήσεις παίρνουν περισσότερους πόντους.'));
    if ('showAnswers' in d) h += toggle('showAnswers', __('Δείχνει τη σωστή απάντηση μετά από κάθε ερώτηση'), d.showAnswers);
    if ('powerups' in d) h += toggle('powerups', __('Βοήθειες (50:50, διπλοί πόντοι, έξτρα χρόνος)'), d.powerups, __('Κερδίζονται με 3 σωστές στη σειρά.'));
    if ('shuffleQ' in d) h += toggle('shuffleQ', __('Ανακάτεμα ερωτήσεων'), d.shuffleQ);
    if ('shuffleA' in d) h += toggle('shuffleA', __('Ανακάτεμα απαντήσεων'), d.shuffleA);
    if ('leaderboard' in d && mode !== 'test') h += toggle('leaderboard', __('Κατάταξη στο τέλος'), d.leaderboard);
    if ('showResults' in d) h += toggle('showResults', __('Στο τέλος τα παιδιά βλέπουν το αποτέλεσμα και τις διορθώσεις'), d.showResults);
    if ('teams' in d) h += `<div class="field"><label class="label" for="o-teams">${__('Αριθμός ομάδων')}</label><select class="input input-narrow" id="o-teams" data-o="teams">${[2, 3, 4, 5, 6].map((n) => `<option ${n === d.teams ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <p class="hint">${__('Κάθε παιδί που ανοίγει τον σύνδεσμο μπαίνει στη μικρότερη ομάδα.')}</p></div>`;
    if (mode === 'mastery') h += `<div class="field"><label class="label" for="o-goal">${__('Στόχος')}</label><select class="input input-narrow" id="o-goal" data-o="goal">${[60, 70, 80, 90, 100].map((n) => `<option value="${n}" ${n === d.goal ? 'selected' : ''}>${n}${__('% των ερωτήσεων')}</option>`).join('')}</select></div>`;
    if (mode === 'picture') {
      h += `<fieldset class="field"><legend class="label">${__('Η κρυμμένη εικόνα')}</legend>
        <label class="check"><input type="radio" name="pic" value="auto" ${!picture ? 'checked' : ''}><span>${__('Μια εικόνα από τη συλλογή του {0}, διαφορετική για κάθε παιδί', esc(CFG.siteName))}<span class="hint">${__('Τα παιδιά μαντεύουν διαλέγοντας ανάμεσα σε τέσσερα ονόματα.')}</span></span></label>
        <label class="check"><input type="radio" name="pic" value="own" ${picture ? 'checked' : ''}><span>${__('Δική μου εικόνα')}<span class="hint">${__('Τα παιδιά γράφουν τι δείχνει.')}</span></span></label>
        <div class="pic-own" ${picture ? '' : 'hidden'}>
          <div class="pic-prev">${picture ? `<img src="${esc(picture.image)}" alt="">` : ''}</div>
          <label class="btn btn-sm btn-ghost qe-up">${ICON.upload}${__('Επιλογή εικόνας')}<input type="file" accept="image/*" class="sr" data-pic-file></label>
          <div class="field"><label class="label" for="pic-ans">${__('Τι δείχνει η εικόνα;')}</label><input class="input" id="pic-ans" maxlength="80" value="${esc(picture ? picture.answer : '')}" placeholder="${__('π.χ. Ο Παρθενώνας | Παρθενώνας')}">
          <p class="hint">${__('Αν δέχεσαι περισσότερες απαντήσεις, χώρισέ τες με |.')}</p></div></div></fieldset>`;
    }
    dlg.querySelector('[data-opts]').innerHTML = h;
    if (mode === 'picture') dlg.querySelector('.sd-more').open = true;
    dlg.querySelector('[data-warn]').innerHTML = m.group === 'review' && scoredCount < 3 ? ('<p class="banner banner-bad">' + __('Αυτό το παιχνίδι χρειάζεται τουλάχιστον 3 ερωτήσεις με σωστή απάντηση.') + '</p>') : '';
    summary(dlg);
  };
  const readOpts = (dlg) => {
    const o = Object.assign({}, MODES[mode].defaults);
    dlg.querySelectorAll('[data-o]').forEach((x) => {
      if (x.type === 'checkbox') o[x.dataset.o] = x.checked;
      else o[x.dataset.o] = Number(x.value);
    });
    return o;
  };
  let picked = null;
  const choice = await dialog({
    title: __('Στείλε στην τάξη'), wide: false, html,
    actions: [{ label: __('Άκυρο'), value: null }, {
      label: __('Φτιάξε τον σύνδεσμο'), value: 'go', kind: 'primary',
      check(dlg) {
        if (MODES[mode].group === 'review' && scoredCount < 3) { toast(__('Διάλεξε άλλο παιχνίδι ή πρόσθεσε ερωτήσεις με σωστή απάντηση.'), 'error'); return false; }
        const own = mode === 'picture' && dlg.querySelector('[name="pic"]:checked') && dlg.querySelector('[name="pic"]:checked').value === 'own';
        if (own) {
          const ans = dlg.querySelector('#pic-ans').value.trim();
          if (!picture || !picture.image) { toast(__('Διάλεξε την εικόνα σου ή πάρε μια από τη συλλογή.'), 'error'); dlg.querySelector('.sd-more').open = true; return false; }
          if (!ans) { toast(__('Γράψε τι δείχνει η εικόνα.'), 'error'); dlg.querySelector('.sd-more').open = true; dlg.querySelector('#pic-ans').focus(); return false; }
          picture.answer = ans;
        }
        const dd = dlg.querySelector('[name="sd-days"]:checked');
        picked = { opts: readOpts(dlg), classId: dlg.querySelector('#sd-class').value, days: dd ? Number(dd.value) : 7, own };
        return true;
      }
    }],
    onOpen(dlg) {
      dlg.classList.add('dlg-send');
      drawOpts(dlg);
      const other = dlg.querySelector('[data-other]');
      other.addEventListener('click', () => {
        const all = dlg.querySelector('.sd-all');
        all.hidden = !all.hidden;
        other.setAttribute('aria-expanded', String(!all.hidden));
        if (!all.hidden) { const r = all.querySelector('input[name="mode"]:checked'); if (r) r.focus(); }
      });
      dlg.addEventListener('change', async (e) => {
        if (e.target.name === 'mode') {
          mode = e.target.value;
          drawOpts(dlg);
          dlg.querySelector('[data-chosen-n]').textContent = MODES[mode].label;
          dlg.querySelector('[data-chosen-i]').innerHTML = gameIcon(mode, { size: 40 });
        }
        if (e.target.id === 'sd-class') dlg.querySelector('[data-class-hint]').textContent = classHint(e.target.value);
        if (e.target.matches('[data-o]')) summary(dlg);
        if (e.target.name === 'pic') dlg.querySelector('.pic-own').hidden = e.target.value !== 'own';
        if (e.target.matches('[data-pic-file]') && e.target.files && e.target.files[0]) {
          try {
            const { readImage } = await import('./editor.js');
            const image = await readImage(e.target.files[0], 900, 160000);
            picture = { image, answer: (picture && picture.answer) || '' };
            dlg.querySelector('.pic-prev').innerHTML = `<img src="${esc(image)}" alt="">`;
          } catch (er) { toast(errText(er), 'error'); }
        }
      });
    }
  });
  if (choice !== 'go' || !picked) return;
  const { opts, classId, days } = picked;
  const prefs = local.get('qz:sharePrefs', {});
  prefs.mode = mode;
  prefs.classId = classId;
  prefs.days = days;
  prefs.opts = Object.assign({}, prefs.opts || {}, { [mode]: opts });
  local.set('qz:sharePrefs', prefs);
  const cls = classes.find((c) => c.id === classId);
  const settings = Object.assign({}, opts);
  if (mode === 'picture') settings.picture = picked.own && picture ? { image: picture.image, answer: picture.answer } : 'auto';
  const body = {
    gameId: game.id || null, title: game.title, mode, settings,
    questions: game.questions, cover: game.cover || null,
    classId: cls ? cls.id : null, className: cls ? cls.name : null, roster: cls ? (cls.students || []).map((s) => s.name || s).filter(Boolean) : null,
    status: 'live', startedAt: Date.now(), lang: LANG,
    deadline: days ? Date.now() + days * 864e5 : null
  };
  if (mode === 'team') body.teams = TEAM_SET.slice(0, Math.max(2, Math.min(6, opts.teams || 4)));
  if (JSON.stringify(body).length > 950000) { dialog({ title: __('Το παιχνίδι είναι πολύ μεγάλο'), text: __('Οι εικόνες πιάνουν πολύ χώρο. Αφαίρεσε κάποιες και ξαναδοκίμασε.') }); return; }
  const b = busy(__('Φτιάχνεται ο σύνδεσμος…'));
  try {
    const { id } = await DB.createSession(body);
    b.close();
    ctx.go('/t/link/' + id);
  } catch (e) {
    b.close();
    dialog({ title: __('Δεν φτιάχτηκε ο σύνδεσμος'), text: errText(e) });
  }
}
export const startDialog = shareDialog;

/* ================= ΤΑΞΕΙΣ ================= */
export function viewClasses() {
  setTitle(__('Τάξεις'));
  const el = app();
  el.className = 'v-teacher';
  el.innerHTML = teacherTop('classes') + `<main class="tmain narrow">
    <div class="thead"><h1 class="h1">${__('Τάξεις')}</h1><button class="btn btn-primary" type="button" data-new>${ICON.plus}${__('Νέα τάξη')}</button></div>
    <p class="lead">${__('Με λίστα τάξης τα παιδιά δεν γράφουν όνομα: πατούν το δικό τους, οπότε τα αποτελέσματα βγαίνουν πάντα σωστά. Χρησιμοποίησε μικρό όνομα και αρχικό επωνύμου.')}</p>
    <div data-list><p class="muted">${__('Φορτώνει…')}</p></div></main>`;
  const list = el.querySelector('[data-list]');
  let classes = [];
  const load = () => DB.listClasses().then((cs) => {
    classes = cs.sort((a, b) => String(a.name).localeCompare(String(b.name), LOCALE));
    list.innerHTML = classes.length ? `<ul class="rows">${classes.map((c) => `<li class="row-i"><span class="row-t"><span>${esc(c.name)}</span></span><span class="row-s">${plural((c.students || []).length, __('μαθητής'), __('μαθητές'))}</span>
      <span class="row-a"><button class="btn btn-sm btn-line" type="button" data-edit="${esc(c.id)}">${ICON.edit}${__('Επεξεργασία')}</button><button class="icon-btn icon-danger" type="button" data-del="${esc(c.id)}" aria-label="${__('Διαγραφή της τάξης')} ${esc(c.name)}">${ICON.trash}</button></span></li>`).join('')}</ul>`
      : ('<div class="empty"><p class="empty-t">' + __('Δεν έχεις ακόμη τάξεις.') + '</p><p>' + __('Πρόσθεσε μια τάξη με τα ονόματα των μαθητών.') + '</p></div>');
  }, (e) => { list.innerHTML = `<div class="banner banner-bad">${esc(errText(e))}</div>`; });
  const edit = async (c) => {
    let data = null;
    const v = await dialog({
      title: c ? `${__('Τάξη:')} ${c.name}` : __('Νέα τάξη'),
      html: `<div class="field"><label class="label" for="c-name">${__('Όνομα τάξης')}</label><input class="input" id="c-name" maxlength="40" value="${esc(c ? c.name : '')}" placeholder="${__('π.χ. Ε1 2026–27')}"></div>
        <div class="field"><label class="label" for="c-st">${__('Μαθητές, ένας σε κάθε γραμμή')}</label><textarea class="input" id="c-st" rows="10" placeholder="${__('Νίκος Π.')}\n${__('Ελένη Κ.')}">${esc(c ? (c.students || []).map((s) => s.name || s).join('\n') : '')}</textarea>
        <p class="hint">${__('Μόνο μικρό όνομα και αρχικό επωνύμου. Αν δύο παιδιά έχουν το ίδιο όνομα, βάλε διαφορετικό αρχικό.')}</p></div>`,
      focus: '#c-name',
      actions: [{ label: __('Άκυρο'), value: null }, {
        label: __('Αποθήκευση'), kind: 'primary', value: 'save',
        check(dlg) {
          const name = dlg.querySelector('#c-name').value.trim();
          const names = dlg.querySelector('#c-st').value.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
          if (!name) { toast(__('Γράψε όνομα τάξης.'), 'error'); return false; }
          const dup = names.find((n, i) => names.findIndex((m) => norm(m) === norm(n)) !== i);
          if (dup) { toast(`${__('Το όνομα «{0}» υπάρχει δύο φορές. Κάνε τα ονόματα διαφορετικά.', dup)}`, 'error'); return false; }
          data = { name, names };
          return true;
        }
      }]
    });
    if (v !== 'save' || !data) return;
    const body = { name: data.name, students: data.names.map((n) => ({ id: rid(6), name: n })) };
    if (c) { body.id = c.id; body.createdAt = c.createdAt; }
    try {
      await DB.saveClass(body);
      toast(__('Αποθηκεύτηκε.'), 'ok');
      load();
    } catch (e) { toast(errText(e), 'error'); }
  };
  el.querySelector('[data-new]').addEventListener('click', () => edit(null));
  list.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) edit(classes.find((c) => c.id === ed.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) {
      const c = classes.find((x) => x.id === del.dataset.del);
      if (c && await confirmDanger(`${__('Διαγραφή της τάξης «{0}»;', c.name)}`, __('Οι σύνδεσμοι και τα αποτελέσματά τους μένουν.'))) {
        try { await DB.deleteClass(c.id); load(); } catch (er) { toast(errText(er), 'error'); }
      }
    }
  });
  load();
}

/* ================= ΑΠΟΤΕΛΕΣΜΑΤΑ (λίστα συνδέσμων) ================= */
/* Ο σύνδεσμος για τα παιδιά· κρατά τη γλώσσα με την οποία φτιάχτηκε. */
export const linkUrl = (sid, lang) => `${(location.origin + location.pathname).replace(/index\.html?$/i, '')}${lang ? `?lang=${lang}` : ''}#/g/${sid}`;
export const linkState = (s) => (s.status === 'ended' ? 'closed' : s.deadline && Date.now() > s.deadline ? 'expired' : 'open');
export const LINK_STATE = { open: __('Ανοιχτός'), closed: __('Κλειστός'), expired: __('Έληξε') };

export function viewLinks(ctx) {
  setTitle(__('Αποτελέσματα'));
  const el = app();
  el.className = 'v-teacher';
  el.innerHTML = teacherTop('links') + `<main class="tmain narrow">
    <div class="thead"><h1 class="h1">${__('Αποτελέσματα')}</h1></div>
    <p class="lead">${__('Κάθε φορά που στέλνεις ένα παιχνίδι στην τάξη φτιάχνεται ένας σύνδεσμος. Εδώ βλέπεις ποιος έπαιξε και τι απάντησε, και κλείνεις τους συνδέσμους.')}</p>
    <div data-list><p class="muted">${__('Φορτώνει…')}</p></div></main>`;
  const list = el.querySelector('[data-list]');
  let sessions = [], classes = [];
  const load = () => Promise.all([DB.listSessions(), DB.listClasses().catch(() => [])]).then(([ss, cs]) => {
    classes = cs;
    sessions = ss.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    list.innerHTML = sessions.length ? `<ul class="rows">${sessions.map((s) => {
      const m = MODES[s.mode] || MODES.classic;
      const state = linkState(s);
      const cls = classes.find((c) => c.id === s.classId);
      const cn = s.className || (cls && cls.name);
      return `<li class="row-i has-ic">${gameIcon(s.mode, { size: 40 })}<span class="row-t"><span>${esc(s.title)}</span></span>
        <span class="row-s"><span>${esc(m.label)}${cn ? `, ${esc(cn)}` : ''}</span><span>${esc(fmtDate(s.createdAt, false))}</span><span class="state state-${state}">${state === 'open' ? esc(closesText(s.deadline)) : LINK_STATE[state]}</span></span>
        <span class="row-a"><a class="btn btn-sm btn-line" href="#/t/link/${esc(s.id)}">${ICON.link}${__('Σύνδεσμος')}</a><a class="btn btn-sm btn-soft" href="#/t/report/${esc(s.id)}">${ICON.chart}${__('Αναφορά')}</a>
        <button class="icon-btn icon-danger" type="button" data-del="${esc(s.id)}" aria-label="${__('Διαγραφή του συνδέσμου')} ${esc(s.title)}">${ICON.trash}</button></span></li>`;
    }).join('')}</ul>` : (`<div class="empty"><p class="empty-t">${__('Δεν έχεις στείλει ακόμη κανένα παιχνίδι.')}</p><p>${__('Από «Τα παιχνίδια μου» πάτα «Στείλε στην τάξη» σε ένα παιχνίδι.')}</p><p class="actions center"><a class="btn btn-primary" href="#/t">${__('Τα παιχνίδια μου')}</a></p></div>`);
  }, (e) => { list.innerHTML = `<div class="banner banner-bad">${esc(errText(e))}</div>`; });
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const s = sessions.find((x) => x.id === del.dataset.del);
    if (s && await confirmDanger(`${__('Διαγραφή του συνδέσμου «{0}»;', s.title)}`, __('Ο σύνδεσμος δεν θα ανοίγει πια και θα σβηστούν οι απαντήσεις των παιδιών.'))) {
      const b = busy(__('Διαγραφή…'));
      try { await DB.deleteSession(s.id); load(); } catch (er) { toast(errText(er), 'error'); }
      b.close();
    }
  });
  load();
}

/* ================= ΛΟΓΑΡΙΑΣΜΟΣ ================= */
export function viewAccount(ctx) {
  setTitle(__('Λογαριασμός'));
  const u = DB.user();
  const el = app();
  el.className = 'v-teacher';
  el.innerHTML = teacherTop('account') + `<main class="tmain narrow"><div class="thead"><h1 class="h1">${__('Λογαριασμός')}</h1></div>
    <section class="panel"><form data-form novalidate><div class="field"><label class="label" for="a-name">${__('Όνομα')}</label><input class="input" id="a-name" maxlength="60" value="${esc(u.name || '')}"></div>
      <p class="muted">Email: ${esc(u.email || '')}</p><p class="actions"><button class="btn btn-primary" type="submit">${__('Αποθήκευση')}</button></p></form></section>
    <section class="panel"><h2 class="h3">${__('Γλώσσα')}</h2><p>${__('Η γλώσσα της πλατφόρμας. Κάθε σύνδεσμος ανοίγει στη γλώσσα με την οποία τον έφτιαξες.')}</p>${langSwitch()}</section>
    <section class="panel"><h2 class="h3">${__('Αποσύνδεση')}</h2><p>${__('Σε κοινόχρηστο υπολογιστή αποσυνδέσου όταν τελειώνεις.')}</p><p><button class="btn btn-line" type="button" data-out>${ICON.logout}${__('Αποσύνδεση')}</button></p></section>
    ${DB.mode === 'demo' ? `<section class="panel"><h2 class="h3">${__('Δοκιμαστική λειτουργία')}</h2><p>${__('Όλα όσα φτιάχνεις τώρα μένουν μόνο σε αυτόν τον browser. Για να παίζουν τα παιδιά από τις δικές τους συσκευές, σύνδεσε την πλατφόρμα με τη δωρεάν βάση Firebase.')}</p><p><a class="btn btn-line" href="#/setup">${__('Οδηγός σύνδεσης')}</a></p></section>` : ''}
  </main>`;
  el.querySelector('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el.querySelector('#a-name').value.trim();
    if (!name) return;
    try { await DB.updateProfile(name); toast(__('Αποθηκεύτηκε.'), 'ok'); } catch (er) { toast(errText(er), 'error'); }
  });
  el.querySelector('[data-out]').addEventListener('click', async () => { await DB.signOut(); ctx.go('/'); });
}
