/* Προβολέας: Εκατομμυριούχος, Jeopardy και Τηλεπαιχνίδι στην οθόνη της τάξης, με ομάδες.
   Οι ομάδες απαντούν προφορικά: ο εκπαιδευτικός περνά την απάντηση στην οθόνη ή πατά «Σωστά» / «Λάθος».
   Δεν αποθηκεύεται τίποτα και δεν χρειάζεται σύνδεσμος. */
import { esc, app, setTitle, num, shuffle, ICON, toast, errText, fullscreenToggle, exitFullscreen, local, plural } from './ui.js';
import { DB } from './store.js';
import { TYPES, grade, isScored, validateQuestion, tidyQuestion } from './qtypes.js';
import { MODES, STAGE_MODES } from './modes.js';
import { TEAM_SET } from './scoring.js';
import { sfx, isMuted, setMuted } from './games/sfx.js';
import { ladder, havens, euro, hintFor, audienceFor } from './games/millionaire.js';
import { buildBoard, VALUES } from './games/jeopardy.js';
import { __ } from './i18n.js';
import { stageModeOf } from './choose.js';
import { playOwn, deviceModeOf } from './playown.js';
import { gameIcon } from './gicons.js';

const PREF = 'qz:stage';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const PRAISE = [__('Σωστά!'), __('Μπράβο!'), __('Τέλεια!'), __('Εύγε!')];

export function viewStage(gameId, ctx) {
  setTitle(__('Προβολέας'));
  const el = app();
  el.className = 'v-stage';
  el.innerHTML = ('<div class="stg-load"><span class="spinner" aria-hidden="true"></span> ' + __('Φορτώνει…') + '</div>');
  let G = null, run = null, first = true;

  (async () => {
    try { G = await DB.getGame(gameId); } catch (e) { G = null; toast(errText(e), 'error'); }
    const me = DB.user();
    if (!G || !me || (G.owner && G.owner !== me.uid)) {
      el.innerHTML = ('<div class="stg-load"><p>' + __('Το παιχνίδι δεν βρέθηκε.') + '</p><p><a class="btn btn-sun" href="#/t">' + __('Στη βιβλιοθήκη') + '</a></p></div>');
      return;
    }
    setTitle(`${__('Προβολέας:')} ${G.title}`);
    setup();
  })();

  function setup() {
    if (run) { run.stop(); run = null; }
    exitFullscreen();
    const qs = (G.questions || []).filter((q) => isScored(q) && !validateQuestion(q).length).map((q) => tidyQuestion(JSON.parse(JSON.stringify(q))));
    const pref = local.get(PREF, {}) || {};
    // Την πρώτη φορά προτείνεται το παιχνίδι που διάλεξες για αυτές τις ερωτήσεις· μετά, το τελευταίο που παίξατε.
    const mode = (first && stageModeOf(G.mode)) || (STAGE_MODES.includes(pref.mode) ? pref.mode : 'millionaire');
    first = false;
    // Το παιχνίδι που διάλεξε ο εκπαιδευτικός, αν παίζεται από συσκευές (π.χ. αγώνας δρόμου): παίζεται κι αυτό στην οθόνη, όλη η τάξη μαζί.
    const own = deviceModeOf(G.mode);
    const n = clamp(Number(pref.teams) || 2, 1, 6);
    const names = Array.isArray(pref.names) ? pref.names : [];
    el.className = 'v-stage';
    el.innerHTML = `<div class="stg-setup"><div class="stg-in">
      <p class="crumbs"><a href="#/t">${ICON.back}${__('Τα παιχνίδια μου')}</a></p>
      <h1 class="stg-h">${__('Στον προβολέα:')} ${esc(G.title)}</h1>
      <p class="stg-lead">${own ? __('Παίξτε στην οθόνη της τάξης, χωρίς συσκευές για τα παιδιά. Δεν αποθηκεύεται τίποτα.') : __('Ένα παιχνίδι για όλη την τάξη, στην οθόνη. Οι ομάδες απαντούν προφορικά. Εσύ περνάς την απάντηση στην οθόνη ή πατάς «Σωστά» ή «Λάθος». Δεν αποθηκεύεται τίποτα.')}</p>
      ${qs.length < 3 ? ('<p class="banner banner-bad">' + __('Χρειάζονται τουλάχιστον 3 ερωτήσεις με σωστή απάντηση. Οι δημοσκοπήσεις και οι ανοιχτές ερωτήσεις δεν μετράνε.') + '</p>') : ''}
      ${own ? `<section class="stg-own" aria-labelledby="stg-own-h">
        <span class="stg-own-i" aria-hidden="true">${gameIcon(own, { size: 48 })}</span>
        <div class="stg-own-t"><h2 id="stg-own-h">${esc(MODES[own].label)}, ${__('όλη η τάξη μαζί')}</h2>
          <p>${__('Παίζεται στην οθόνη σαν ένας παίκτης: η τάξη λέει την απάντηση και εσύ την πατάς. Δεν αποθηκεύεται τίποτα.')}</p></div>
        <button class="btn btn-sun btn-lg" type="button" data-own>${ICON.play}${__('Ξεκίνα')}</button>
      </section>
      <h2 class="stg-or">${__('Ή ένα παιχνίδι με ομάδες, με τις ίδιες ερωτήσεις')}</h2>
      <p class="stg-or-p">${__('Οι ομάδες απαντούν προφορικά. Εσύ περνάς την απάντηση στην οθόνη ή πατάς «Σωστά» ή «Λάθος».')}</p>` : ''}
      <form class="stg-form" novalidate>
        <fieldset class="stg-modes"><legend class="label-light">${__('Παιχνίδι')}</legend>
          ${STAGE_MODES.map((k) => `<label class="stg-mode"><input type="radio" name="mode" value="${k}" ${k === mode ? 'checked' : ''}><span class="stg-mode-in"><span class="stg-mode-i" aria-hidden="true">${gameIcon(k, { size: 44 })}</span><b>${esc(MODES[k].label)}</b><span>${esc(STAGE_DESC[k])}</span></span></label>`).join('')}
        </fieldset>
        <fieldset class="stg-teams-f"><legend class="label-light">${__('Ομάδες')}</legend>
          <div class="seg seg-dark" role="group" aria-label="${__('Πόσες ομάδες')}">${[1, 2, 3, 4, 5, 6].map((k) => `<button type="button" class="seg-b" data-n="${k}" aria-pressed="${k === n}">${k === 1 ? __('Όλη η τάξη') : k}</button>`).join('')}</div>
          <div class="stg-names"></div>
        </fieldset>
        <p class="actions"><button class="btn btn-sun btn-lg" type="submit" ${qs.length < 3 ? 'disabled' : ''}>${ICON.screen}${__('Ξεκίνα στον προβολέα')}</button></p>
        <p class="stg-note">${__('Συμβουλή: πάτα «Πλήρης οθόνη» μόλις ξεκινήσει το παιχνίδι.')}</p>
      </form></div></div>`;
    const form = el.querySelector('form');
    const ownBtn = el.querySelector('[data-own]');
    if (ownBtn) ownBtn.addEventListener('click', () => {
      ownBtn.disabled = true;
      playOwn(G, ctx, { mode: own, name: __('Η τάξη'), back: '/t/stage/' + G.id }).catch((er) => toast(errText(er), 'error')).finally(() => { ownBtn.disabled = false; });
    });
    let count = n;
    const drawNames = () => {
      const box = el.querySelector('.stg-names');
      const cur = Array.from(box.querySelectorAll('input')).map((i) => i.value);
      box.innerHTML = count === 1 ? ('<p class="stg-note">' + __('Όλη η τάξη παίζει μαζί, σαν μία ομάδα.') + '</p>')
        : TEAM_SET.slice(0, count).map((t, i) => `<label class="stg-name" style="--t:${t.color}"><span aria-hidden="true">${t.emoji}</span><span class="sr">${__('Όνομα της ομάδας')} ${i + 1}</span><input class="input" maxlength="24" value="${esc(cur[i] !== undefined ? cur[i] : names[i] || t.name)}"></label>`).join('');
    };
    drawNames();
    el.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (!b) return;
      count = Number(b.dataset.n);
      el.querySelectorAll('[data-n]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      drawNames();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (qs.length < 3) return;
      const m = form.querySelector('[name="mode"]:checked').value;
      const inputs = Array.from(el.querySelectorAll('.stg-names input'));
      const teams = count === 1 ? [{ name: __('Η τάξη'), emoji: '🏫', color: '#0B7A5C', score: 0 }]
        : TEAM_SET.slice(0, count).map((t, i) => ({ name: (inputs[i] && inputs[i].value.trim()) || t.name, emoji: t.emoji, color: t.color, score: 0 }));
      local.set(PREF, { mode: m, teams: count, names: count > 1 ? teams.map((t) => t.name) : names });
      run = play(m, qs, teams);
    });
  }

  function play(mode, qs, teams) {
    let dead = false;
    const timers = new Set();
    const after = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
    const wait = (ms) => new Promise((r) => after(ms, r));
    let pool = [], pi = 0;
    const next = () => { if (pi >= pool.length) { const last = pool[pool.length - 1]; pool = shuffle(qs); pi = 0; if (pool.length > 1 && pool[0] === last) pool.push(pool.shift()); } return pool[pi++]; };

    el.className = 'v-stage is-playing';
    el.innerHTML = `<div class="stg gm-dark stg-${mode}">
      <div class="stg-bar">
        <button class="g-btn" type="button" data-exit>${ICON.back}<span class="hide-sm">${__('Έξοδος')}</span></button>
        <span class="stg-title"><span aria-hidden="true">${MODES[mode].icon}</span> ${esc(MODES[mode].label)}</span>
        <ol class="stg-board" aria-label="${__('Βαθμολογία ομάδων')}">${teams.map((t, i) => `<li class="stg-team" data-team="${i}" style="--t:${t.color}"><span aria-hidden="true">${t.emoji}</span><b>${esc(t.name)}</b><span class="stg-pts" data-pts>0</span></li>`).join('')}</ol>
        <button class="g-btn" type="button" data-snd aria-pressed="${!isMuted()}" aria-label="${__('Ήχος')}">${isMuted() ? ICON.mute : ICON.sound}</button>
        <button class="g-btn" type="button" data-fs>${ICON.screen}<span class="hide-sm">${__('Πλήρης οθόνη')}</span></button>
      </div>
      <div class="stg-main"></div></div>`;
    const root = el.querySelector('.stg');
    const main = el.querySelector('.stg-main');
    const fs = fullscreenToggle(root);
    const fsBtn = el.querySelector('[data-fs]');
    if (fs) fsBtn.addEventListener('click', fs); else fsBtn.hidden = true;
    const snd = el.querySelector('[data-snd]');
    snd.addEventListener('click', () => { setMuted(!isMuted()); snd.setAttribute('aria-pressed', String(!isMuted())); snd.innerHTML = isMuted() ? ICON.mute : ICON.sound; });
    el.querySelector('[data-exit]').addEventListener('click', () => setup());

    const fmt = (v) => (mode === 'millionaire' ? euro(v) : num(v));
    const drawScores = (cur) => {
      teams.forEach((t, i) => {
        const li = el.querySelector(`[data-team="${i}"]`);
        li.querySelector('[data-pts]').textContent = fmt(t.score);
        li.classList.toggle('is-turn', i === cur);
        li.classList.toggle('is-out', !!t.out);
      });
    };
    drawScores(-1);
    const T = (i) => `<span class="stg-tn" style="--t:${teams[i].color}">${teams[i].emoji} ${esc(teams[i].name)}</span>`;
    const one = teams.length === 1;

    /* μία ερώτηση στην οθόνη: απάντηση με κλικ ή κρίση «Σωστά/Λάθος» */
    function ask(container, q, o = {}) {
      return new Promise((resolve) => {
        const box = document.createElement('div');
        box.className = `gq stg-q ${o.cls || ''}`;
        box.innerHTML = `${o.lead ? `<p class="stg-lead-q">${o.lead}</p>` : ''}<div class="q-holder"></div><div class="gq-confirm" hidden></div>
          <div class="stg-judge" ${o.judge === false ? 'hidden' : ''}><span>${__('Απάντησαν προφορικά;')}</span><button type="button" class="btn btn-ok" data-judge="1">${__('✓ Σωστά')}</button><button type="button" class="btn btn-no" data-judge="0">${__('✗ Λάθος')}</button></div>
          <div class="gq-out" hidden aria-live="polite"></div>`;
        container.replaceChildren(box);
        let done = false, pending;
        const finalize = (a, manual) => {
          if (done || dead) return;
          done = true;
          const f = manual !== undefined ? manual : a === null ? 0 : grade(q, a);
          if (o.onLock) o.onLock();
          box.querySelector('.stg-judge').hidden = true;
          box.querySelector('.gq-confirm').hidden = true;
          const show = () => {
            if (dead) return;
            if (manual !== undefined || a === null) ctl.disable(); else ctl.reveal(a, f);
            box.classList.add(f === 1 ? 'is-ok' : f > 0 ? 'is-part' : 'is-bad');
            if (f === 1) sfx.ok(); else sfx.bad();
            if (o.onAnswer) o.onAnswer(f);
            const out = box.querySelector('.gq-out');
            out.hidden = false;
            const label = typeof o.continue === 'function' ? o.continue(f) : o.continue;
            out.innerHTML = `<p class="gq-v ${f === 1 ? 'v-ok' : f > 0 ? 'v-part' : 'v-bad'}"><span class="sheet-icon" aria-hidden="true">${f === 1 ? '✓' : f > 0 ? '◐' : a === null && manual === undefined ? '⏱' : '✗'}</span>${f === 1 ? pickOne(PRAISE) : f > 0 ? __('Μισό σωστό') : a === null && manual === undefined ? __('Τέλος χρόνου!') : __('Λάθος!')}</p>
              ${f !== 1 || manual !== undefined ? `<p class="gq-c">${__('Σωστή απάντηση:')} <b>${esc(TYPES[q.type].correct(q))}</b></p>` : ''}
              ${o.explain !== false && q.explain && f !== 1 ? `<p class="gq-x">${esc(q.explain)}</p>` : ''}
              ${label ? `<button class="btn btn-sun btn-lg gq-next" type="button" data-next>${esc(label)}</button>` : ''}`;
            if (label) {
              const b = out.querySelector('[data-next]');
              b.addEventListener('click', () => { sfx.click(); resolve({ a, f }); }, { once: true });
              setTimeout(() => { try { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }, 60);
            } else after(o.autoNext !== undefined ? o.autoNext : 900, () => resolve({ a, f }));
          };
          if (o.suspense) { box.classList.add('is-suspense'); sfx.drum(); after(o.suspense, () => { box.classList.remove('is-suspense'); show(); }); } else show();
        };
        const submit = (a) => {
          if (done) return;
          if (o.confirm && (q.type === 'mcq' || q.type === 'tf') && a !== null) {
            pending = a;
            const key = q.type === 'tf' ? (a ? '1' : '0') : String(a);
            box.querySelectorAll('.opt').forEach((b) => b.classList.toggle('is-locked', b.dataset.k === key));
            const c = box.querySelector('.gq-confirm');
            c.hidden = false;
            c.innerHTML = ('<span>' + __('Τελική απάντηση;') + '</span><button class="btn btn-sun" type="button" data-final>' + __('Ναι, κλείδωσέ την') + '</button>');
            c.querySelector('[data-final]').addEventListener('click', () => { c.hidden = true; finalize(pending); }, { once: true });
            return;
          }
          finalize(a);
        };
        const ctl = TYPES[q.type].play(box.querySelector('.q-holder'), q, { submit, shuffle: true });
        box.querySelector('.stg-judge').addEventListener('click', (e) => { const b = e.target.closest('[data-judge]'); if (b) finalize(null, Number(b.dataset.judge)); });
        if (o.stopper) o.stopper.then(() => { if (!done) finalize(null); });
        if (o.onReady) o.onReady(ctl, box);
      });
    }
    function card(title, text, btn) {
      return new Promise((resolve) => {
        main.innerHTML = `<div class="stg-card"><h2 class="stg-card-t">${title}</h2>${text ? `<p class="stg-card-p">${text}</p>` : ''}<button class="btn btn-sun btn-lg" type="button" data-go>${esc(btn || __('Πάμε!'))}</button></div>`;
        const b = main.querySelector('[data-go]');
        b.addEventListener('click', () => { sfx.click(); resolve(); }, { once: true });
        setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
      });
    }
    function choose(title, text, options) {
      return new Promise((resolve) => {
        main.innerHTML = `<div class="stg-card"><h2 class="stg-card-t">${title}</h2>${text ? `<p class="stg-card-p">${text}</p>` : ''}<div class="stg-choices">${options.map((o, i) => `<button type="button" class="btn ${o.kind || 'btn-sun'} btn-lg" data-i="${i}">${o.html || esc(o.label)}</button>`).join('')}</div></div>`;
        main.querySelector('.stg-choices').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { sfx.click(); resolve(options[Number(b.dataset.i)].value); } });
      });
    }
    function finish(title) {
      dead = true;
      timers.forEach(clearTimeout);
      const order = teams.map((t, i) => ({ t, i })).sort((a, b) => b.t.score - a.t.score);
      const top = order[0].t.score;
      const winners = order.filter((x) => x.t.score === top && top > 0);
      sfx.win();
      confetti();
      drawScores(-1);
      main.innerHTML = `<div class="stg-end"><h2 class="stg-end-t">${title || (one ? __('Τέλος παιχνιδιού!') : winners.length > 1 ? __('Ισοπαλία στην κορυφή!') : `${__('Νικήτρια ομάδα: {0}!', esc(order[0].t.name))}`)}</h2>
        <ol class="stg-rank">${order.map((x, k) => `<li style="--t:${x.t.color}" class="${x.t.score === top && top > 0 ? 'is-top' : ''}"><span class="stg-r">${k + 1}</span><span class="stg-rn">${x.t.emoji} ${esc(x.t.name)}</span><b>${fmt(x.t.score)}</b></li>`).join('')}</ol>
        <p class="actions center"><button class="btn btn-sun btn-lg" type="button" data-again>${__('Ξανά από την αρχή')}</button><button class="btn btn-ghost-light btn-lg" type="button" data-setup>${__('Άλλο παιχνίδι')}</button><a class="btn btn-ghost-light btn-lg" href="#/t">${__('Στη βιβλιοθήκη')}</a></p></div>`;
      main.querySelector('[data-again]').addEventListener('click', () => { teams.forEach((t) => { t.score = 0; t.out = false; }); run = play(mode, qs, teams); });
      main.querySelector('[data-setup]').addEventListener('click', () => setup());
    }
    function confetti() {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const box = document.createElement('div');
      box.className = 'confetti';
      box.setAttribute('aria-hidden', 'true');
      const colors = ['#FFC23C', '#2F6FE4', '#E2445C', '#0FA3B1', '#8E44D9', '#ffffff', '#0B7A5C'];
      for (let i = 0; i < 90; i++) {
        const s = document.createElement('span');
        s.style.left = `${Math.random() * 100}%`;
        s.style.background = colors[i % colors.length];
        s.style.animationDelay = `${Math.random() * 0.5}s`;
        s.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
        s.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
        s.style.setProperty('--x', `${Math.random() * 120 - 60}px`);
        box.appendChild(s);
      }
      root.appendChild(box);
      setTimeout(() => box.remove(), 3200);
    }

    /* ================= ΕΚΑΤΟΜΜΥΡΙΟΥΧΟΣ ================= */
    async function millionaire() {
      const per = one ? Math.min(15, qs.length) : clamp(Math.floor(qs.length / teams.length), 3, 15);
      const L = ladder(per), H = havens(per);
      const order = shuffle(qs);
      const qFor = (ti, lv) => order[(ti * per + lv) % order.length];
      const st = teams.map(() => ({ level: 0, used: { fifty: false, audience: false, hint: false } }));
      const secured = (lv) => { const h = H.filter((i) => i < lv).pop(); return h === undefined ? 0 : L[h]; };
      await card(__('Εκατομμυριούχος'), one ? `${per} ${__('ερωτήσεις ως το 1.000.000 €. Με λάθος απάντηση η τάξη κρατά το ποσό του τελευταίου σταθμού ασφαλείας. Τρεις βοήθειες: 50:50, το κοινό και μια συμβουλή.')}`
        : `${__('Οι ομάδες παίζουν με τη σειρά, μία ερώτηση η καθεμιά. Κάθε ομάδα έχει τη δική της σκάλα με {0} ερωτήσεις ως το 1.000.000 € και τις δικές της τρεις βοήθειες. Με λάθος απάντηση η ομάδα κρατά το ποσό του τελευταίου σταθμού και βγαίνει από το παιχνίδι.', per)}`, __('Ξεκινάμε'));
      let turn = -1;
      while (!dead) {
        const alive = teams.map((t, i) => i).filter((i) => !teams[i].out);
        if (!alive.length) break;
        turn = alive.find((i) => i > turn) !== undefined ? alive.find((i) => i > turn) : alive[0];
        const s = st[turn];
        const team = teams[turn];
        drawScores(turn);
        const won = s.level ? L[s.level - 1] : 0;
        main.innerHTML = `<div class="stg-mil"><div class="stg-mil-l">
            <p class="stg-turn">${one ? '' : `${__('Σειρά: {0} ·', T(turn))} `}${__('Ερώτηση {0} για', s.level + 1)} <b>${euro(L[s.level])}</b>${H.includes(s.level) ? (' ' + __('· σταθμός ασφαλείας')) : ''}</p>
            <div class="mil-life" role="group" aria-label="${__('Βοήθειες')}">
              <button type="button" class="mil-lb" data-life="fifty"><b>50:50</b></button>
              <button type="button" class="mil-lb" data-life="audience"><b>${__('Κοινό')}</b></button>
              <button type="button" class="mil-lb" data-life="hint"><b>${__('Συμβουλή')}</b></button>
              ${s.level ? `<button type="button" class="btn btn-ghost-light btn-sm" data-walk>${__('Αποχώρηση με')} ${euro(won)}</button>` : ''}</div>
            <div class="mil-help" aria-live="polite"></div><div class="stg-qa"></div></div>
          <ol class="mil-ladder stg-ladder">${L.map((v, i) => `<li data-i="${i}" class="${H.includes(i) ? 'is-haven' : ''} ${i < s.level ? 'is-done' : ''} ${i === s.level ? 'is-current' : ''}"><span class="ml-n">${i + 1}</span><span class="ml-v">${euro(v)}</span><span class="ml-t">${one ? '' : teams.map((t, k) => (!t.out && st[k].level === i ? `<i style="--t:${t.color}" title="${esc(t.name)}">${t.emoji}</i>` : '')).join('')}</span></li>`).reverse().join('')}</ol></div>`;
        const help = main.querySelector('.mil-help');
        const q = qFor(turn, s.level);
        let ctl = null, box = null, open = true;
        const lifeState = () => main.querySelectorAll('[data-life]').forEach((b) => {
          const k = b.dataset.life;
          const choice = q.type === 'mcq' || q.type === 'tf' || q.type === 'multi';
          b.disabled = !open || s.used[k] || (k === 'fifty' && !(q.type === 'mcq' && (q.options || []).length >= 3)) || (k === 'audience' && !choice);
          b.classList.toggle('is-used', s.used[k]);
        });
        let walked = false;
        const walkP = new Promise((resolve) => {
          main.querySelector('.stg-mil-l').addEventListener('click', (e) => {
            const lb = e.target.closest('[data-life]');
            if (lb && !lb.disabled) {
              const k = lb.dataset.life;
              s.used[k] = true;
              sfx.whoosh();
              if (k === 'fifty' && ctl && ctl.fifty) ctl.fifty();
              if (k === 'audience') {
                const r = audienceFor(q, box, null);
                help.innerHTML = `<div class="mil-aud"><p class="mil-aud-h">${__('Η ψήφος του κοινού')}</p><div class="mil-bars">${r.rows.map((x) => `<div class="mil-bar"><span class="mil-bar-f" style="height:${Math.max(4, x.p)}%"></span><b>${x.p}%</b><span>${esc(x.label)}</span></div>`).join('')}</div></div>`;
              }
              if (k === 'hint') help.innerHTML = `<p class="mil-hint"><span aria-hidden="true">📞</span> ${esc(hintFor(q, box))}</p>`;
              lifeState();
            }
            const w = e.target.closest('[data-walk]');
            if (w && open) { walked = true; resolve(); }
          });
        });
        const res = await Promise.race([
          ask(main.querySelector('.stg-qa'), q, {
            confirm: true, suspense: 1400, cls: 'gq-mil',
            onReady(c, b) { ctl = c; box = b; lifeState(); },
            onLock() { open = false; lifeState(); const wb = main.querySelector('[data-walk]'); if (wb) wb.disabled = true; },
            continue: (f) => (f === 1 ? (s.level + 1 >= per ? __('Το έπαθλο!') : __('Συνέχεια')) : __('Συνέχεια'))
          }),
          walkP
        ]);
        if (dead) return;
        if (walked) {
          team.score = won;
          team.out = true;
          drawScores(turn);
          await card(`${one ? __('Η τάξη αποχωρεί') : `${T(turn)} ${__('αποχωρούν')}`} ${__('με')} ${euro(won)}`, '', __('Συνέχεια'));
          continue;
        }
        if (res.f === 1) {
          s.level++;
          team.score = L[s.level - 1];
          if (s.level >= per) { team.out = true; drawScores(turn); confetti(); sfx.win(); await card(`${one ? __('Η τάξη κέρδισε') : `${T(turn)} ${__('κέρδισαν')}`} ${__('το 1.000.000 €!')}`, '', __('Συνέχεια')); }
        } else {
          team.score = secured(s.level);
          team.out = true;
          drawScores(turn);
          await card(`${one ? __('Η τάξη κρατά') : `${T(turn)} ${__('κρατούν')}`} ${euro(team.score)}`, team.score ? __('Το ποσό του τελευταίου σταθμού ασφαλείας.') : __('Δεν είχαν φτάσει ακόμη σε σταθμό ασφαλείας.'), __('Συνέχεια'));
        }
        drawScores(turn);
      }
      if (!dead) finish();
    }

    /* ================= JEOPARDY ================= */
    async function jeopardy() {
      const B = buildBoard(qs);
      const used = new Set();
      let turn = 0;
      await card('Jeopardy', `${one ? __('Η τάξη διαλέγει') : __('Οι ομάδες διαλέγουν με τη σειρά')} ${__('θεματική και αξία. Σωστή απάντηση: κερδίζετε τους πόντους. {0}Κάπου κρύβεται μια διπλή ερώτηση με ποντάρισμα{1}.', one ? '' : (__('Με λάθος απάντηση, μια άλλη ομάδα μπορεί να «κλέψει» την ερώτηση.') + ' '), B.final ? (' ' + __('και στο τέλος περιμένει ο τελικός γύρος')) : '')}`, __('Στον πίνακα'));
      while (!dead && used.size < B.cells.length) {
        drawScores(one ? -1 : turn);
        main.innerHTML = `<div class="stg-jp">${one ? '' : `<p class="stg-turn">${__('Διαλέγει:')} ${T(turn)}</p>`}<div class="jp-board stg-jp-board" style="--cols:${B.cats.length}">
          ${B.cats.map((c) => `<div class="jp-cat">${esc(c.name)}</div>`).join('')}
          ${Array.from({ length: B.rows }, (_, ri) => B.cats.map((c, ci) => (c.qs[ri] ? `<button type="button" class="jp-cell ${used.has(`${ci}:${ri}`) ? 'is-used' : ''}" data-cell="${ci}:${ri}" ${used.has(`${ci}:${ri}`) ? 'disabled' : ''} aria-label="${esc(c.name)} ${__('για')} ${VALUES[ri]}">${used.has(`${ci}:${ri}`) ? '' : VALUES[ri]}</button>` : '<span class="jp-cell is-empty"></span>')).join('')).join('')}</div></div>`;
        const key = await new Promise((resolve) => main.querySelector('.jp-board').addEventListener('click', (e) => { const b = e.target.closest('[data-cell]'); if (b && !b.disabled) { sfx.click(); resolve(b.dataset.cell); } }));
        used.add(key);
        const [ci, ri] = key.split(':').map(Number);
        const cell = B.cells.find((x) => x.ci === ci && x.ri === ri);
        let value = cell.value;
        const dd = B.dd === cell;
        if (dd) {
          sfx.drum();
          const max = Math.max(teams[turn].score, 500);
          value = await choose(__('Διπλή ερώτηση!'), `${one ? __('Η τάξη ποντάρει') : `${T(turn)} ${__('ποντάρουν')}`} ${__('έως {0} πόντους.', num(max))}`, Array.from(new Set([Math.round(max / 4 / 50) * 50, Math.round(max / 2 / 50) * 50, max])).filter((v) => v > 0).map((v) => ({ label: v === max ? `${__('Όλα ({0})', num(v))}` : num(v), value: v })));
        }
        const lead = `${esc(B.cats[ci].name)} · ${dd ? `${__('διπλή ερώτηση για')} ${num(value)}` : num(value)}${one ? '' : ` ${__('· απαντούν')} ${T(turn)}`}`;
        const res = await ask(main, cell.q, { lead, continue: (f) => (f === 1 || one || dd ? __('Στον πίνακα') : __('Συνέχεια')) });
        if (dead) return;
        if (res.f === 1) teams[turn].score += value;
        else if (dd) teams[turn].score = Math.max(0, teams[turn].score - value);
        drawScores(turn);
        if (res.f !== 1 && !one && !dd) {
          const others = teams.map((t, i) => i).filter((i) => i !== turn);
          const thief = await choose(__('Κλέβει κάποια ομάδα;'), __('Η ομάδα που σηκώνει πρώτη χέρι απαντά. Αν απαντήσει σωστά, κερδίζει τους πόντους.'), others.map((i) => ({ html: `${teams[i].emoji} ${esc(teams[i].name)}`, value: i })).concat([{ label: __('Καμία ομάδα'), value: -1, kind: 'btn-ghost-light' }]));
          if (thief >= 0) {
            const r2 = await ask(main, cell.q, { lead: `${esc(B.cats[ci].name)} ${__('· {0} · κλέβουν', num(value))} ${T(thief)}`, continue: __('Στον πίνακα') });
            if (dead) return;
            if (r2.f === 1) teams[thief].score += value;
            drawScores(turn);
          }
        }
        if (!one) turn = (turn + 1) % teams.length;
      }
      if (dead) return;
      if (B.final) await finalJeopardy(B.final);
      if (!dead) finish();
    }
    async function finalJeopardy(q) {
      drawScores(-1);
      main.innerHTML = `<div class="stg-card stg-final"><h2 class="stg-card-t">${__('Τελικός γύρος')}</h2>
        <p class="stg-card-p">${__('Θεματική:')} <b>${esc(String(q.category || '').trim() || __('έκπληξη'))}</b>. ${one ? __('Πόσους πόντους ποντάρει η τάξη;') : __('Κάθε ομάδα γράφει σε χαρτί πόσους πόντους ποντάρει. Περάστε τα πονταρίσματα εδώ.')}</p>
        <div class="stg-wagers">${teams.map((t, i) => { const max = Math.max(t.score, 300); return `<label class="stg-wager" style="--t:${t.color}"><span>${t.emoji} ${esc(t.name)} <small>${__('έως')} ${num(max)}</small></span><input class="input" type="number" inputmode="numeric" min="0" max="${max}" step="50" value="${Math.min(max, Math.round(max / 2 / 50) * 50)}" data-w="${i}"></label>`; }).join('')}</div>
        <button class="btn btn-sun btn-lg" type="button" data-go>${__('Δείξε την ερώτηση')}</button></div>`;
      await new Promise((r) => main.querySelector('[data-go]').addEventListener('click', r, { once: true }));
      const wagers = teams.map((t, i) => clamp(Math.round(Number(main.querySelector(`[data-w="${i}"]`).value) || 0), 0, Math.max(t.score, 300)));
      sfx.drum();
      main.innerHTML = `<div class="stg-final-q"><div class="q-holder"></div><p class="stg-card-p">${one ? __('Η τάξη γράφει την απάντηση σε χαρτί.') : __('Κάθε ομάδα γράφει την απάντησή της σε χαρτί.')}</p><button class="btn btn-sun btn-lg" type="button" data-show>${__('Δείξε τη σωστή απάντηση')}</button><div class="stg-final-out"></div></div>`;
      const ctl = TYPES[q.type].play(main.querySelector('.q-holder'), q, { submit() {}, shuffle: true });
      await new Promise((r) => main.querySelector('[data-show]').addEventListener('click', r, { once: true }));
      if (dead) return;
      ctl.disable();
      main.querySelector('[data-show]').remove();
      const out = main.querySelector('.stg-final-out');
      out.innerHTML = `<p class="gq-c">${__('Σωστή απάντηση:')} <b>${esc(TYPES[q.type].correct(q))}</b></p>
        <div class="stg-marks">${teams.map((t, i) => `<div class="stg-mark" style="--t:${t.color}"><span>${t.emoji} ${esc(t.name)} · ${num(wagers[i])}</span><span class="seg seg-dark" role="group" aria-label="${esc(t.name)}"><button type="button" class="seg-b" data-m="${i}" data-v="1" aria-pressed="false">${__('✓ Σωστά')}</button><button type="button" class="seg-b" data-m="${i}" data-v="0" aria-pressed="false">${__('✗ Λάθος')}</button></span></div>`).join('')}</div>
        <button class="btn btn-sun btn-lg" type="button" data-calc disabled>${__('Τελικά αποτελέσματα')}</button>`;
      const marks = teams.map(() => null);
      out.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (b) {
          const i = Number(b.dataset.m);
          marks[i] = b.dataset.v === '1';
          out.querySelectorAll(`[data-m="${i}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          out.querySelector('[data-calc]').disabled = marks.some((m) => m === null);
        }
      });
      await new Promise((r) => out.querySelector('[data-calc]').addEventListener('click', r, { once: true }));
      teams.forEach((t, i) => { t.score = Math.max(0, t.score + (marks[i] ? wagers[i] : -wagers[i])); });
    }

    /* ================= ΤΗΛΕΠΑΙΧΝΙΔΙ ================= */
    async function show() {
      const quick = teams.length >= 4 ? 45 : 60;
      const bets = teams.length >= 4 ? 1 : 2;
      await card(__('Τηλεπαιχνίδι'), `${__('Τρεις γύροι: γρήγορες ερωτήσεις {0}″ {1}, ποντάρισμα και ο μεγάλος τελικός, όπου οι πόντοι διπλασιάζονται ή μένουν μισοί.', quick, one ? '' : __('για κάθε ομάδα'))}`, __('Φώτα, κάμερα, πάμε!'));
      // Γύρος 1
      for (let i = 0; i < teams.length && !dead; i++) {
        drawScores(i);
        await card(`${__('Γύρος 1: Γρήγορες ερωτήσεις')}${one ? '' : ` · ${T(i)}`}`, `${quick} ${__('δευτερόλεπτα. Κάθε σωστή απάντηση δίνει 100 πόντους. Αν δεν ξέρετε, πάτα «Λάθος» για την επόμενη.')}`, __('Ξεκίνα το ρολόι'));
        const t0 = Date.now();
        let resolveUp;
        const up = new Promise((r) => { resolveUp = r; });
        after(quick * 1000, () => resolveUp());
        main.innerHTML = `<div class="stg-quick"><p class="stg-clock" data-clock>${quick}″</p><div class="stg-qa"></div></div>`;
        const clock = main.querySelector('[data-clock]');
        const iv = setInterval(() => {
          if (dead) { clearInterval(iv); return; }
          const left = Math.max(0, Math.ceil(quick - (Date.now() - t0) / 1000));
          clock.textContent = `${left}″`;
          clock.classList.toggle('is-hurry', left <= 10);
          if (left <= 5 && left > 0) sfx.tick();
          if (left <= 0) clearInterval(iv);
        }, 250);
        let over = false;
        up.then(() => { over = true; });
        while (!over && !dead) {
          const q = next();
          const res = await ask(main.querySelector('.stg-qa'), q, { stopper: up, explain: false, autoNext: 700 });
          if (dead) { clearInterval(iv); return; }
          if (res.f > 0) teams[i].score += Math.round(100 * res.f);
          drawScores(i);
        }
        clearInterval(iv);
        sfx.whistle();
        if (!dead) await card(`${__('Τέλος χρόνου!')}`, `${one ? __('Η τάξη έχει') : `${T(i)} ${__('έχουν')}`} ${num(teams[i].score)} ${__('πόντους.')}`, i < teams.length - 1 ? __('Επόμενη ομάδα') : __('Στον γύρο 2'));
      }
      // Γύρος 2
      for (let b = 0; b < bets && !dead; b++) {
        for (let i = 0; i < teams.length && !dead; i++) {
          drawScores(i);
          const max = Math.max(teams[i].score, 200);
          const bet = await choose(`${__('Γύρος 2: Ποντάρισμα')}${one ? '' : ` · ${T(i)}`}`, `${__('Πόσους πόντους ποντάρετε; Σωστή απάντηση: τους κερδίζετε. Λάθος: τους χάνετε.')}`,
            Array.from(new Set([50, 100, 200, max].filter((v) => v > 0 && v <= max))).sort((x, y) => x - y).map((v) => ({ label: v === max && v > 200 ? `${__('Όλα ({0})', num(v))}` : num(v), value: v })));
          const res = await ask(main, next(), { lead: `${__('Ποντάρισμα:')} ${num(bet)}${one ? '' : ` ${__('· απαντούν')} ${T(i)}`}`, continue: __('Συνέχεια') });
          if (dead) return;
          teams[i].score = Math.max(0, teams[i].score + (res.f === 1 ? bet : -bet));
          drawScores(i);
        }
      }
      // Γύρος 3
      for (let i = 0; i < teams.length && !dead; i++) {
        drawScores(i);
        await card(`${__('Ο μεγάλος τελικός')}${one ? '' : ` · ${T(i)}`}`, `${__('Σωστή απάντηση: οι πόντοι διπλασιάζονται ({0} → {1}). Λάθος: μένουν οι μισοί.', num(teams[i].score), num(teams[i].score * 2))}`, __('Δείξε την ερώτηση'));
        const res = await ask(main, next(), { suspense: 1200, continue: i < teams.length - 1 ? __('Επόμενη ομάδα') : __('Τα αποτελέσματα'), lead: one ? '' : `${__('Απαντούν')} ${T(i)}` });
        if (dead) return;
        teams[i].score = res.f === 1 ? teams[i].score * 2 : Math.round(teams[i].score / 2);
        drawScores(i);
      }
      if (!dead) finish();
    }

    (mode === 'millionaire' ? millionaire : mode === 'jeopardy' ? jeopardy : show)().catch((e) => { console.error(e); if (!dead) toast(errText(e), 'error'); });
    return { stop() { dead = true; timers.forEach(clearTimeout); timers.clear(); } };
  }

  ctx.setCleanup(() => { if (run) run.stop(); exitFullscreen(); });
}

const STAGE_DESC = {
  millionaire: __('Η σκάλα ως το 1.000.000 €, με βοήθειες.'),
  jeopardy: __('Πίνακας με θεματικές, κλέψιμο και τελικός.'),
  show: __('Γρήγορος γύρος, ποντάρισμα και τελικός.')
};
export { plural };
