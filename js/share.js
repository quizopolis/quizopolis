/* Η σελίδα ενός συνδέσμου: ο σύνδεσμος για τα παιδιά, ποιοι παίζουν τώρα και μια πρώτη ματιά στα αποτελέσματα.
   A link's page: the link for the children, who is playing now, and a first look at the results. */
import { esc, app, setTitle, toast, dialog, num, plural, ICON, errText, confirmDanger, copy, CFG, avatar } from './ui.js';
import { DB } from './store.js';
import { MODES, unitOf } from './modes.js';
import { ranking, TEAM_SET } from './scoring.js';
import { TYPES } from './qtypes.js';
import { teacherTop, linkUrl, linkState, untilText } from './teacher.js';
import { gameIcon } from './gicons.js';
import { __ } from './i18n.js';

export function viewLink(sid, ctx) {
  setTitle(__('Σύνδεσμος'));
  const el = app();
  el.className = 'v-teacher v-link';
  el.innerHTML = teacherTop('links') + ('<main class="tmain lk"><p class="muted">' + __('Φορτώνει…') + '</p></main>');
  const main = el.querySelector('main');
  let S = null, players = [], drawn = false, alive = true;
  const unsubS = DB.watchSession(sid, (s) => { S = s; render(); }, (e) => toast(errText(e), 'error'));
  const unsubP = DB.watchPlayers(sid, (ps) => { players = ps; drawPlayers(); }, () => {});

  function render() {
    if (!alive) return;
    const me = DB.user();
    if (!S || !me || S.owner !== me.uid) {
      drawn = false;
      main.innerHTML = ('<div class="empty"><p class="empty-t">' + __('Ο σύνδεσμος δεν βρέθηκε') + '</p><p><a class="btn btn-line" href="#/t/links">' + __('Στα αποτελέσματα') + '</a></p></div>');
      return;
    }
    setTitle(S.title);
    const m = MODES[S.mode] || MODES.classic;
    const url = linkUrl(sid, S.lang);
    const state = linkState(S);
    const qr = window.QzQR ? window.QzQR.svg(url, __('QR για τον σύνδεσμο')) : '';
    const msg = `${__('Παίξε «{0}» στο {1}:', S.title, CFG.siteName)} ${url}`;
    const stateText = state === 'closed' ? __('Κλειστό') : state === 'expired' ? __('Έληξε') : S.deadline ? __('Ανοιχτό ως {0}', untilText(S.deadline)) : __('Ανοιχτό, χωρίς προθεσμία');
    const who = S.className ? (S.roster ? `${esc(S.className)}, ${plural(S.roster.length, __('παιδί'), __('παιδιά'))}` : esc(S.className))
      : S.roster ? `${__('Λίστα τάξης:')} ${plural(S.roster.length, __('όνομα'), __('ονόματα'))}` : '';
    main.innerHTML = `<p class="crumbs"><a href="#/t/links">${ICON.back}${__('Αποτελέσματα')}</a></p>
      <div class="lk-head">${gameIcon(S.mode, { size: 56 })}<div><h1 class="h1">${esc(S.title)}</h1>
        <p class="lk-pills"><span class="state-pill is-${state}">${esc(stateText)}</span><span class="pill">${esc(m.label)}</span>${who ? `<span class="pill">${who}</span>` : ''}</p></div></div>
      ${state !== 'open' ? `<div class="banner banner-bad">${state === 'closed' ? __('Ο σύνδεσμος είναι κλειστός: τα παιδιά δεν μπορούν να παίξουν.') : __('Η προθεσμία έληξε: τα παιδιά δεν μπορούν να παίξουν.')}</div>` : ''}
      <section class="lk-share"><div class="lk-share-t">
        <h2>${__('Στείλε τον σύνδεσμο στα παιδιά')}</h2>
        <p>${S.roster ? __('Όποιο παιδί τον ανοίξει πατά το όνομά του και παίζει, από κινητό, τάμπλετ ή υπολογιστή.') : __('Όποιο παιδί τον ανοίξει γράφει το όνομά του και παίζει, από κινητό, τάμπλετ ή υπολογιστή.')}</p>
        <div class="lk-url"><label class="sr" for="lk-url">${__('Σύνδεσμος')}</label><input class="input" id="lk-url" readonly value="${esc(url)}">
          <button class="btn btn-primary" type="button" data-copy>${ICON.copy}${__('Αντιγραφή')}</button></div>
        <p class="actions lk-ways"><button class="btn btn-sm btn-line" type="button" data-copy-msg>${ICON.msg}${__('Αντιγραφή με μήνυμα')}</button>
          ${navigator.share ? `<button class="btn btn-sm btn-line" type="button" data-native>${ICON.share}${__('Κοινοποίηση')}</button>` : ''}
          <a class="btn btn-sm btn-line" href="${DB.storageNote === 'memory' ? `#/g/${esc(sid)}` : esc(url)}" ${DB.storageNote === 'memory' ? '' : 'target="_blank" rel="noopener"'}>${ICON.eye}${__('Δοκίμασέ το ως μαθητής')}</a></p></div>
        ${qr ? `<div class="lk-qr">${qr}<small>${__('Σάρωσε ή τύπωσε')}</small></div>` : ''}
      </section>
      <div class="lk-cols">
        <section class="box"><div class="box-h"><h2 data-count>${__('Παίζουν τώρα')}</h2><small data-count-s></small></div>
          <div data-players></div>
          ${DB.canBots && state === 'open' ? `<p class="lk-bots"><button class="btn btn-sm btn-line" type="button" data-bots>${ICON.users}${__('Εικονικοί μαθητές')}</button></p>` : ''}</section>
        <section class="box"><div class="box-h"><h2>${__('Με μια ματιά')}</h2></div>
          <div class="kpis"><div><b data-k-done>0</b><span>${__('τελείωσαν')}</span></div><div><b data-k-avg>–</b><span>${__('μέση επιτυχία')}</span></div></div>
          <p class="hardq" data-hard></p>
          <a class="btn btn-primary btn-wide" href="#/t/report/${esc(sid)}">${ICON.chart}${__('Όλα τα αποτελέσματα')}</a>
          <div class="lk-manage">${state === 'closed' ? `<button class="btn btn-sm btn-soft" type="button" data-open>${ICON.unlock}${__('Άνοιξε ξανά τον σύνδεσμο')}</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-close>${ICON.lock}${__('Κλείσε τον σύνδεσμο')}</button>`}
            <button class="btn btn-sm btn-ghost" type="button" data-extend>${ICON.clock}${S.deadline ? __('Παράταση 7 ημερών') : __('Βάλε προθεσμία 7 ημερών')}</button>
            ${S.deadline ? `<button class="btn btn-sm btn-ghost" type="button" data-nodeadline>${__('Χωρίς προθεσμία')}</button>` : ''}
            <p class="hint">${__('Όσο ο σύνδεσμος είναι κλειστός, τα παιδιά δεν μπορούν να παίξουν. Οι απαντήσεις που έχουν δώσει μένουν.')}</p></div></section>
      </div>`;
    drawn = true;
    drawPlayers();
    main.querySelector('[data-copy]').addEventListener('click', () => copy(url).then(() => toast(__('Αντιγράφηκε ο σύνδεσμος.'), 'ok'), () => { main.querySelector('#lk-url').select(); toast(__('Πάτα Ctrl+C για αντιγραφή.')); }));
    main.querySelector('[data-copy-msg]').addEventListener('click', () => copy(msg).then(() => toast(__('Αντιγράφηκε το μήνυμα με τον σύνδεσμο.'), 'ok'), () => toast(msg)));
    main.querySelector('#lk-url').addEventListener('focus', (e) => e.target.select());
    const nat = main.querySelector('[data-native]');
    if (nat) nat.addEventListener('click', () => { navigator.share({ title: S.title, text: `${__('Παίξε «{0}» στο', S.title)} ${CFG.siteName}`, url }).catch(() => {}); });
    const set = (patch, okMsg) => DB.updateSession(sid, patch).then(() => toast(okMsg, 'ok'), (e) => toast(errText(e), 'error'));
    const cl = main.querySelector('[data-close]');
    if (cl) cl.addEventListener('click', () => confirmDanger(__('Να κλείσει ο σύνδεσμος;'), __('Τα παιδιά δεν θα μπορούν να παίξουν μέχρι να τον ανοίξεις ξανά.'), __('Κλείσιμο')).then((y) => { if (y) set({ status: 'ended', endedAt: Date.now() }, __('Ο σύνδεσμος έκλεισε.')); }));
    const op = main.querySelector('[data-open]');
    if (op) op.addEventListener('click', () => set({ status: 'live' }, __('Ο σύνδεσμος άνοιξε ξανά.')));
    main.querySelector('[data-extend]').addEventListener('click', () => {
      const base = S.deadline && S.deadline > Date.now() ? S.deadline : Date.now();
      set({ deadline: base + 7 * 864e5, status: 'live' }, __('Η προθεσμία άλλαξε.'));
    });
    const nd = main.querySelector('[data-nodeadline]');
    if (nd) nd.addEventListener('click', () => set({ deadline: null }, __('Ο σύνδεσμος δεν έχει πια προθεσμία.')));
    const bb = main.querySelector('[data-bots]');
    if (bb) bb.addEventListener('click', addBots);
    main.querySelector('[data-players]').addEventListener('click', (e) => {
      const k = e.target.closest('[data-kick]');
      if (!k) return;
      const p = players.find((x) => x.uid === k.dataset.kick);
      confirmDanger(`${__('Αφαίρεση: {0};', p ? p.name : __('παίκτης'))}`, __('Οι απαντήσεις του σβήνονται και δεν μπορεί να ξαναπαίξει από την ίδια συσκευή.'), __('Αφαίρεση')).then(async (yes) => {
        if (!yes) return;
        try {
          await DB.updateSession(sid, { kicked: { [k.dataset.kick]: true } });
          await DB.removePlayer(sid, k.dataset.kick);
        } catch (er) { toast(errText(er), 'error'); }
      });
    });
  }

  /* Μέση επιτυχία και η πιο δύσκολη ερώτηση, από τις απαντήσεις που έχουν δοθεί ως τώρα. */
  function glance() {
    const qs = (S.questions || []).filter((q) => TYPES[q.type] && TYPES[q.type].scored);
    const stats = qs.map((q) => {
      const fs = players.map((p) => p.answers && p.answers[q.id]).filter((a) => a && typeof a.f === 'number').map((a) => a.f);
      return { q, n: fs.length, avg: fs.length ? fs.reduce((x, y) => x + y, 0) / fs.length : null };
    });
    const all = stats.filter((s) => s.n);
    const total = all.reduce((x, s) => x + s.n, 0);
    const avg = total ? all.reduce((x, s) => x + s.avg * s.n, 0) / total : null;
    const hard = all.filter((s) => s.n >= 2).sort((a, b) => a.avg - b.avg)[0];
    return { avg, hard };
  }

  function drawPlayers() {
    if (!drawn || !S) return;
    const box = main.querySelector('[data-players]');
    if (!box) return;
    const done = players.filter((p) => p.done).length;
    const total = (S.questions || []).length || 1;
    const roster = S.roster ? S.roster.length : 0;
    main.querySelector('[data-count-s]').textContent = players.length
      ? (roster ? __('{0} από {1} μπήκαν', players.length, roster) : __('{0} μπήκαν, {1} τελείωσαν', players.length, done)) : '';
    main.querySelector('[data-k-done]').textContent = String(done);
    const g = glance();
    main.querySelector('[data-k-avg]').textContent = g.avg === null ? '–' : `${Math.round(g.avg * 100)}%`;
    const hard = main.querySelector('[data-hard]');
    hard.innerHTML = g.hard && g.hard.avg < 1
      ? __('Δυσκόλεψε περισσότερο: <b>«{0}»</b>, με {1}% σωστές.', esc(String(g.hard.q.text || TYPES[g.hard.q.type].label).slice(0, 120)), Math.round(g.hard.avg * 100))
      : players.length ? '' : __('Εδώ θα δεις πόσα παιδιά τελείωσαν και ποια ερώτηση δυσκόλεψε την τάξη.');
    if (!players.length) { box.innerHTML = ('<p class="muted">' + __('Κανείς δεν έχει ανοίξει ακόμη τον σύνδεσμο.') + '</p>'); return; }
    const unit = unitOf(S.mode);
    const scoreOn = S.mode !== 'test' && S.mode !== 'flashcards';
    box.innerHTML = `<ul class="lk-players">${ranking(players).map((p) => {
      const t = TEAM_SET.find((x) => x.id === p.team);
      const n = Math.min(total, p.answered || 0);
      const frac = p.done ? 1 : n / total;
      return `<li class="lk-p">${avatar(p.name)}<span class="lk-pn">${esc(p.name)}${t ? ` <span class="dot" style="--t:${t.color}"></span><span class="muted">${esc(t.name)}</span>` : ''}</span>
        <span class="lk-pp"><span class="bar"><i style="width:${Math.round(frac * 100)}%"></i></span><small>${p.done ? __('Τελείωσε') : __('{0} από {1} ερωτήσεις', n, total)}</small></span>
        <span class="lk-ps">${scoreOn ? `${num(p.score || 0)}${unit ? ` ${unit}` : ''}` : ''}</span>
        <button type="button" class="lk-kick" data-kick="${esc(p.uid)}" aria-label="${__('Αφαίρεση:')} ${esc(p.name)}" title="${__('Αφαίρεση')}">${ICON.x}</button></li>`;
    }).join('')}</ul>`;
  }
  async function addBots() {
    const n = await dialog({
      title: __('Εικονικοί μαθητές'),
      text: __('Μόνο για δοκιμή: παίζουν αμέσως το παιχνίδι, για να δεις κατάταξη, αναφορά και αντιπάλους στους αγώνες.'),
      actions: [{ label: __('Άκυρο'), value: 0 }, { label: '5', value: 5 }, { label: '10', value: 10, kind: 'primary' }]
    });
    if (!n) return;
    try {
      const { simulatePlayers } = await import('./bots.js');
      await simulatePlayers(sid, S, n, players);
      toast(`${__('Έπαιξαν {0} εικονικοί μαθητές.', n)}`, 'ok');
    } catch (e) { toast(errText(e), 'error'); console.error(e); }
  }
  ctx.setCleanup(() => { alive = false; if (unsubS) unsubS(); if (unsubP) unsubP(); });
}
