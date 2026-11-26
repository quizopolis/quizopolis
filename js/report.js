/* Αναφορά ενός παιχνιδιού: επισκόπηση, ανά ερώτηση, ανά μαθητή, πίνακας, εξαγωγή CSV. */
import { esc, app, setTitle, toast, dialog, num, pct, fmtDate, plural, ICON, errText, download, fmtDuration, copy } from './ui.js';
import { DB, withImages } from './store.js';
import { TYPES, isScored, studyItems } from './qtypes.js';
import { firstTry, cardFront, cardBack, sidesOf } from './cards.js';
import { ranking, teamStats, playerStats, TEAM_SET } from './scoring.js';
import { MODES, usesTeams, isReview, unitOf } from './modes.js';
import { teacherTop, linkUrl, linkState, LINK_STATE } from './teacher.js';
import { __, LOCALE } from './i18n.js';
import { noteReport } from './stats.js';

const teamById = (id) => TEAM_SET.find((t) => t.id === id) || null;
const NO_POINTS = ['test', 'flashcards'];
// Κάρτες μελέτης: πράσινο αν την ήξερε αμέσως, κίτρινο αν την έμαθε με επανάληψη, κόκκινο αν δεν την έμαθε ακόμη.
// Flashcards: green if known straight away, yellow if learned with repetition, red if not learned yet.
const cellClass = (q, a) => {
  if (!a) return 'gc-none';
  if (a.known !== undefined) return firstTry(a) ? 'gc-ok' : a.known ? 'gc-part' : 'gc-bad';
  if (!isScored(q)) return 'gc-info';
  if (a.f === 1) return 'gc-ok';
  if (a.f > 0) return 'gc-part';
  return 'gc-bad';
};
const cellMark = (q, a) => {
  if (!a) return '';
  if (a.known !== undefined) return firstTry(a) ? '✓' : a.known ? '↻' : '✗';
  if (!isScored(q)) return '•';
  return a.f === 1 ? '✓' : a.f > 0 ? Math.round(a.f * 100) : '✗';
};

export function viewReport(sid, ctx) {
  setTitle(__('Αναφορά'));
  const el = app();
  el.className = 'v-teacher v-report';
  el.innerHTML = teacherTop('links') + ('<main class="wrap tmain rep"><p class="muted">' + __('Φορτώνει…') + '</p></main>');
  const main = el.querySelector('main');
  let S = null, players = [], tab = 'overview';
  const ctxT = {};

  async function load() {
    try {
      [S, players] = await Promise.all([DB.getSession(sid), DB.listPlayers(sid)]);
      if (S && S.media && DB.getMedia) S = withImages(S, await DB.getMedia(sid).catch(() => null));
    } catch (e) { main.innerHTML = `<div class="banner banner-bad">${esc(errText(e))}</div>`; return; }
    const me = DB.user();
    if (!S || !me || S.owner !== me.uid) { main.innerHTML = ('<div class="empty"><p class="empty-t">' + __('Η αναφορά δεν βρέθηκε.') + '</p><p><a class="btn" href="#/t/links">' + __('Στους συνδέσμους') + '</a></p></div>'); return; }
    setTitle(`${__('Αναφορά:')} ${S.title}`);
    noteReport(Object.assign({ id: sid }, S), players);
    render();
  }

  function render() {
    const m = MODES[S.mode] || MODES.classic;
    const qs = S.questions || [];
    const scored = qs.filter(isScored);
    const state = linkState(S);
    const review = isReview(S.mode);
    const unit = unitOf(S.mode);
    const teamOfP = (p) => teamById(p.team || (S.teamOf || {})[p.uid]);
    ctxT.teamOfP = teamOfP;
    ctxT.review = review;
    ctxT.unit = unit;
    const stats = players.map((p) => ({ p, s: playerStats(p, qs) }));
    const accs = stats.map((x) => x.s.acc).filter((x) => x !== null);
    const avgAcc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
    const done = players.filter((p) => p.done).length;
    const flash = S.mode === 'flashcards';
    // Κάρτες: πόσες φορές τις ήξεραν αμέσως, από όσες είδαν. / Cards: how often they were known straight away, of those seen.
    const cardAns = flash ? players.flatMap((p) => studyItems(qs).map((q) => (p.answers || {})[q.id]).filter(Boolean)) : [];
    const quickAll = cardAns.length ? cardAns.filter(firstTry).length / cardAns.length : null;
    main.innerHTML = `
      <p class="crumbs"><a href="#/t/link/${esc(sid)}">${ICON.back}${__('Σύνδεσμος')}</a></p>
      <div class="thead rep-head"><div><h1 class="h1">${esc(S.title)}</h1>
        <p class="rep-meta"><span>${m.icon} ${esc(m.label)}</span><span>${esc(fmtDate(S.startedAt || S.createdAt))}</span><span class="state state-${state}">${LINK_STATE[state]}</span>${S.roster ? `<span>${plural(S.roster.length, __('μαθητής'), __('μαθητές'))} ${__('στη λίστα')}</span>` : ''}${S.deadline ? `<span>${__('προθεσμία')} ${esc(fmtDate(S.deadline))}</span>` : ''}</p></div>
        <div class="actions"><button class="btn" type="button" data-reload>${__('Ανανέωση')}</button><button class="btn" type="button" data-csv>${ICON.download}${__('CSV για Excel')}</button><button class="btn" type="button" data-copy-table>${ICON.copy}${__('Αντιγραφή πίνακα')}</button><button class="btn" type="button" data-print>${__('Εκτύπωση')}</button></div></div>
      <div class="rep-link"><span class="rep-link-t">${ICON.link}<span>${state === 'open' ? __('Ο σύνδεσμος είναι ανοιχτός: τα παιδιά παίζουν ακόμη.') : state === 'closed' ? __('Ο σύνδεσμος είναι κλειστός.') : __('Η προθεσμία του συνδέσμου έληξε.')}</span></span><span class="actions"><button class="btn btn-sm" type="button" data-copy-link>${ICON.copy}${__('Αντιγραφή συνδέσμου')}</button><a class="btn btn-sm" href="#/t/link/${esc(sid)}">${__('Διαχείριση')}</a></span></div>
      <div class="tiles">
        <div class="tile-s"><span class="tile-n">${players.length}</span><span class="tile-l">${players.length === 1 ? __('μαθητής') : __('μαθητές')}</span></div>
        <div class="tile-s"><span class="tile-n">${flash ? (quickAll === null ? '–' : pct(quickAll)) : avgAcc === null ? '–' : pct(avgAcc)}</span><span class="tile-l">${flash ? __('τις ήξεραν αμέσως') : __('μέση ακρίβεια')}</span></div>
        <div class="tile-s"><span class="tile-n">${done}</span><span class="tile-l">${__('ολοκλήρωσαν')}</span></div>
        <div class="tile-s"><span class="tile-n">${qs.length}</span><span class="tile-l">${flash ? (qs.length === 1 ? __('κάρτα') : __('κάρτες')) : qs.length === 1 ? __('ερώτηση') : __('ερωτήσεις')}</span></div>
      </div>
      ${players.length ? `<div class="rtabs" role="tablist" aria-label="${__('Προβολή')}">${[['overview', __('Επισκόπηση')], ['questions', flash ? __('Ανά κάρτα') : __('Ανά ερώτηση')], ['students', __('Ανά μαθητή')], ['grid', __('Πίνακας')]].map(([k, l]) =>
        `<button type="button" role="tab" class="rtab" id="tab-${k}" aria-controls="panel" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="rpanel" id="panel" role="tabpanel" aria-labelledby="tab-${tab}"></div>`
      : ('<div class="empty"><p class="empty-t">' + __('Δεν έπαιξε ακόμη κανείς.') + '</p><p>' + __('Οι απαντήσεις εμφανίζονται εδώ μόλις μπουν οι μαθητές.') + '</p></div>')}`;
    main.querySelector('[data-reload]').addEventListener('click', () => { main.querySelector('[data-reload]').disabled = true; load(); });
    main.querySelector('[data-copy-link]').addEventListener('click', () => copy(linkUrl(sid, S.lang)).then(() => toast(__('Αντιγράφηκε ο σύνδεσμος.'), 'ok'), () => toast(linkUrl(sid, S.lang))));
    main.querySelector('[data-csv]').addEventListener('click', exportCsv);
    main.querySelector('[data-copy-table]').addEventListener('click', () => {
      copy(tableRows().map((r) => r.map((v) => String(v === undefined || v === null ? '' : v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n'))
        .then(() => toast(__('Αντιγράφηκε. Επικόλλησέ τον σε Excel ή Google Sheets.'), 'ok'), () => toast(__('Η αντιγραφή δεν επιτράπηκε από τον browser. Δοκίμασε το CSV.'), 'error'));
    });
    main.querySelector('[data-print]').addEventListener('click', () => { try { window.print(); } catch (e) { toast(__('Η εκτύπωση δεν είναι διαθέσιμη εδώ.'), 'error'); } });
    const tl = main.querySelector('[role="tablist"]');
    if (tl) {
      tl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); main.querySelector(`#tab-${tab}`).focus(); } });
      tl.addEventListener('keydown', (e) => {
        const keys = ['overview', 'questions', 'students', 'grid'];
        const i = keys.indexOf(tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          tab = keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
          render();
          main.querySelector(`#tab-${tab}`).focus();
        }
      });
      const panel = main.querySelector('#panel');
      if (tab === 'overview') overview(panel, stats, flash ? studyItems(qs) : scored);
      if (tab === 'questions') byQuestion(panel);
      if (tab === 'students') byStudent(panel, stats);
      if (tab === 'grid') grid(panel);
    }
  }

  /* ---------- επισκόπηση ---------- */
  function overview(panel, stats, scored) {
    const qs = S.questions || [];
    const noPts = NO_POINTS.includes(S.mode);
    let html = '';
    if (S.mode === 'team' && Array.isArray(S.teams)) {
      const ts = teamStats(players, S.teams, S.teamOf || null, qs);
      html += `<section class="panel"><h2 class="h3">${__('Ομάδες')}</h2><p class="muted">${__('Πόντοι ομάδας')} = ${__('μέσος όρος των μελών + 200 για κάθε ερώτηση που απάντησαν σωστά όλα τα μέλη. Οι πόντοι της ομάδας γράφονται σε κάθε μέλος.')}</p>
        <ol class="team-board team-board-light">${ts.map((t, i) => `<li style="--t:${t.color}"><span class="tb-rank">${i + 1}</span><span class="tb-name">${t.emoji} ${esc(t.name)}<span class="tb-members">${t.members.map((p) => esc(p.name)).join(', ') || '—'}</span></span>
          <span class="tb-detail">${__('μ.ό. {0} + μπόνους', num(t.avg))} ${num(t.bonus)}</span><b class="tb-total">${num(t.total)}</b></li>`).join('')}</ol></section>`;
    }
    // πιο δύσκολες ερωτήσεις
    const flash = S.mode === 'flashcards';
    const qStats = scored.map((q) => {
      const ans = players.map((p) => p.answers && p.answers[q.id]).filter(Boolean);
      const f = ans.length ? ans.reduce((s, a) => s + (a.known !== undefined ? (firstTry(a) ? 1 : 0) : (a.f || 0)), 0) / ans.length : null;
      return { q, f, n: ans.length };
    }).filter((x) => x.f !== null).sort((a, b) => a.f - b.f);
    const hard = qStats.filter((x) => x.f < 0.6).slice(0, 4);
    // Κάρτες: τα παιδιά που χρειάστηκαν επανάληψη στις μισές ή περισσότερες. / Cards: children who needed repetition on half or more.
    const cardKids = flash ? players.map((p) => {
      const seen = scored.filter((q) => (p.answers || {})[q.id]);
      return { p, n: seen.length, f: seen.length ? seen.filter((q) => firstTry(p.answers[q.id])).length / seen.length : null };
    }) : [];
    html += `<div class="rep-cols">
      <section class="panel"><h2 class="h3">${__('Χρειάζονται επανάληψη')}</h2>${hard.length ? `<ol class="hard">${hard.map((x) => `<li><span class="hard-p ${x.f < 0.4 ? 'is-low' : ''}">${pct(x.f)}</span><span class="hard-q">${flash ? `${esc(cardFront(x.q))}<span class="muted"> · ${esc(__('το ήξεραν αμέσως'))}</span>` : `${esc(x.q.text || TYPES[x.q.type].label)}<span class="muted"> · ${esc(TYPES[x.q.type].label)}</span>`}</span></li>`).join('')}</ol>`
        : `<p class="muted">${!qStats.length ? __('Δεν υπάρχουν ακόμη απαντήσεις.') : flash ? __('Κάθε κάρτα την ήξερε αμέσως πάνω από το 60% των παιδιών.') : __('Όλες οι ερωτήσεις είχαν πάνω από 60% σωστές απαντήσεις.')}</p>`}</section>
      <section class="panel"><h2 class="h3">${__('Χρειάζονται βοήθεια')}</h2>${(() => {
        if (flash) {
          const lowC = cardKids.filter((x) => x.f !== null && x.f < 0.5 && x.n >= 2).sort((a, b) => a.f - b.f);
          return lowC.length ? `<ul class="plain help-list">${lowC.map((x) => `<li><b>${esc(x.p.name)}</b> <span class="muted">${__('ήξερε αμέσως το {0} από {1} κάρτες', pct(x.f), x.n)}</span></li>`).join('')}</ul>`
            : `<p class="muted">${__('Κανένα παιδί δεν χρειάστηκε επανάληψη στις μισές κάρτες.')}</p>`;
        }
        const low = stats.filter((x) => x.s.acc !== null && x.s.acc < 0.5 && x.s.scored >= 2).sort((a, b) => a.s.acc - b.s.acc);
        return low.length ? `<ul class="plain help-list">${low.map((x) => `<li><b>${esc(x.p.name)}</b> <span class="muted">${pct(x.s.acc)} ${__('σωστά σε {0} ερωτήσεις', x.s.scored)}</span></li>`).join('')}</ul>`
          : `<p class="muted">${__('Κανένας μαθητής κάτω από 50%.')}</p>`;
      })()}</section></div>`;
    // κατάταξη
    const ranked = ranking(players);
    html += `<section class="panel"><h2 class="h3">${noPts ? __('Μαθητές') : __('Κατάταξη')}</h2>${ctxT.review ? ('<p class="muted">' + __('Στα παιχνίδια επανάληψης τα παιδιά μπορούν να ξαναπαίξουν· μετράει το καλύτερο σκορ.') + '</p>') : ''}<ol class="board board-light">${ranked.map((p, i) => {
      const st = playerStats(p, qs);
      const t = ctxT.teamOfP(p);
      return `<li><span class="b-rank">${noPts ? '' : i + 1}</span><span class="b-name">${esc(p.name)}${t ? ` <span class="dot" style="--t:${t.color}"></span><span class="muted">${esc(t.name)}</span>` : ''}${p.result && p.result.short ? `<span class="b-res">${esc(p.result.short)}${(p.plays || 0) > 1 ? ` ${__('· {0} φορές', p.plays)}` : ''}</span>` : ''}</span>
        <span class="b-acc">${flash ? __('έμαθε {0} από {1}', p.correct || 0, scored.length) : st.acc === null ? '–' : pct(st.acc)}</span>${noPts ? '' : `<b class="b-score">${num(p.score || 0)}${ctxT.unit ? ` ${ctxT.unit}` : ''}</b>`}</li>`;
    }).join('')}</ol></section>`;
    panel.innerHTML = html;
  }

  /* ---------- ανά κάρτα (κάρτες μελέτης) / per card (flashcards) ---------- */
  function byCard(panel) {
    const items = studyItems(S.questions);
    const img = (src) => (src ? `<img class="rq-cimg" src="${esc(src)}" alt="">` : '');
    const vid = (o) => (o && o.video && o.video.url ? `<span class="rq-vid">${ICON.play}${__('βίντεο')}</span>` : '');
    panel.innerHTML = items.map((q, i) => {
      const ans = players.map((p) => (p.answers || {})[q.id]).filter(Boolean);
      const f = ans.length ? ans.filter(firstTry).length / ans.length : null;
      const times = ans.length ? ans.reduce((x, a) => x + (a.n || 1), 0) / ans.length : null;
      const sides = q.type === 'card' ? sidesOf(q) : null;
      const back = cardBack(q);
      return `<article class="panel rq rq-card"><header class="rq-head"><span class="qe-n">${i + 1}</span><span class="rq-type">${TYPES.card.icon}${esc(TYPES.card.label)}</span>
          ${f !== null ? `<span class="rq-pct ${f < 0.4 ? 'is-low' : f < 0.7 ? 'is-mid' : 'is-high'}">${pct(f)} ${__('το ήξεραν αμέσως')}</span>` : ''}</header>
        <div class="rq-sides"><div class="rq-side"><span class="rq-sl">${__('Μπροστά')}</span><p class="rq-st">${esc(cardFront(q))}</p>${img(sides ? sides.front.image : q.image)}${vid(sides && sides.front)}</div>
          <div class="rq-side"><span class="rq-sl">${__('Πίσω')}</span><p class="rq-st">${back ? esc(back) : '–'}</p>${img(sides ? sides.back.image : '')}${vid(sides && sides.back)}</div></div>
        <p class="rq-meta">${ans.length === 1 ? __('Τη μελέτησε 1 παιδί') : __('Τη μελέτησαν {0} παιδιά', ans.length)}${times === null ? '' : f === 1 ? ` ${__('· την ήξεραν όλοι με την πρώτη')}` : Math.round(times * 10) === 10 ? ` ${__('· ήρθε μία φορά')}` : ` ${__('· ήρθε κατά μέσο όρο {0} φορές', (Math.round(times * 10) / 10).toLocaleString(LOCALE))}`}</p></article>`;
    }).join('') || `<p class="muted">${__('Δεν υπάρχουν κάρτες.')}</p>`;
  }

  /* ---------- ανά ερώτηση ---------- */
  function byQuestion(panel) {
    if (S.mode === 'flashcards') { byCard(panel); return; }
    const qs = S.questions || [];
    panel.innerHTML = qs.map((q, i) => {
      const t = TYPES[q.type];
      const ans = players.filter((p) => p.answers && p.answers[q.id]).map((p) => ({ v: p.answers[q.id].v, f: p.answers[q.id].f, name: p.name, known: p.answers[q.id].known, t: p.answers[q.id].t }));
      const scoredAns = ans.filter((a) => a.f !== null && a.f !== undefined);
      const f = S.mode === 'flashcards' ? (ans.length ? ans.filter((a) => a.known).length / ans.length : null)
        : t.scored && scoredAns.length ? scoredAns.reduce((s, a) => s + a.f, 0) / scoredAns.length : null;
      const times = ans.map((a) => a.t).filter((x) => x > 0);
      const avgT = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : null;
      return `<article class="panel rq"><header class="rq-head"><span class="qe-n">${i + 1}</span><span class="rq-type">${t.icon}${esc(t.label)}</span>
          ${f !== null ? `<span class="rq-pct ${f < 0.4 ? 'is-low' : f < 0.7 ? 'is-mid' : 'is-high'}">${pct(f)} ${S.mode === 'flashcards' ? __('το ήξεραν') : __('σωστά')}</span>` : ''}</header>
        <h3 class="rq-q">${esc(q.text || t.label)}</h3>${q.image ? `<img class="rq-img" src="${esc(q.image)}" alt="">` : ''}
        <p class="rq-meta">${plural(ans.length, __('απάντηση'), __('απαντήσεις'))}${avgT !== null ? ` ${__('· μέσος χρόνος {0}″', Math.round(avgT))}` : ''}${t.scored ? ` ${__('· σωστό:')} <b>${esc(t.correct(q))}</b>` : ''}</p>
        ${S.mode === 'flashcards' ? '' : ans.length ? `<div class="rq-sum">${t.summary(q, ans)}</div>` : ''}
        ${ctxT.review ? ('<p class="muted">' + __('Στα παιχνίδια επανάληψης οι ερωτήσεις μπορεί να ξανάρθουν· φαίνεται η τελευταία απάντηση κάθε παιδιού.') + '</p>') : ''}</article>`;
    }).join('');
  }

  /* ---------- ανά μαθητή ---------- */
  function teamTotals() {
    if (S.mode !== 'team' || !Array.isArray(S.teams)) return null;
    const out = {};
    teamStats(players, S.teams, S.teamOf || null, S.questions || []).forEach((t) => { out[t.id] = t.total; });
    return out;
  }
  function byStudent(panel, stats) {
    const qs = S.questions || [];
    const noPts = NO_POINTS.includes(S.mode);
    const tt = teamTotals();
    const rows = stats.slice().sort((a, b) => String(a.p.name).localeCompare(String(b.p.name), 'el'));
    if (S.mode === 'flashcards') {
      const items = studyItems(qs);
      panel.innerHTML = `<div class="panel panel-flush"><table class="tbl tbl-click"><thead><tr><th scope="col">${__('Όνομα')}</th><th scope="col">${__('Έμαθε')}</th><th scope="col">${__('Ήξερε αμέσως')}</th><th scope="col">${__('Χρόνος')}</th><th scope="col"><span class="sr">${__('Λεπτομέρειες')}</span></th></tr></thead>
        <tbody>${rows.map(({ p }) => {
          const time = Object.values(p.answers || {}).reduce((sum, a) => sum + (a.t || 0), 0) / 1000;
          const quick = items.filter((q) => firstTry((p.answers || {})[q.id])).length;
          return `<tr><td class="t-name">${esc(p.name)}${p.done ? (' <span class="done" title="' + __('Ολοκλήρωσε') + '">✓</span>') : ''}</td><td>${Math.min(items.length, p.correct || 0)}/${items.length}</td><td>${quick}</td>
            <td>${time ? fmtDuration(time) : '–'}</td><td><button type="button" class="btn btn-sm" data-st="${esc(p.uid)}">${__('Κάρτες')}</button></td></tr>`;
        }).join('')}</tbody></table></div>`;
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-st]');
        if (b) studentDialog(players.find((p) => p.uid === b.dataset.st));
      });
      return;
    }
    panel.innerHTML = `<div class="panel panel-flush"><table class="tbl tbl-click"><thead><tr><th scope="col">${__('Όνομα')}</th>${usesTeams(S.mode) ? ('<th scope="col">' + __('Ομάδα') + '</th>') : ''}
      ${ctxT.review ? ('<th scope="col">' + __('Αποτέλεσμα') + '</th><th scope="col">' + __('Φορές') + '</th>') : ''}<th scope="col">${__('Απάντησε')}</th><th scope="col">${S.mode === 'flashcards' ? __('Ήξερε') : __('Σωστές')}</th><th scope="col">${__('Ακρίβεια')}</th>${noPts ? '' : ('<th scope="col" class="num">' + __('Πόντοι') + '</th>')}${tt ? ('<th scope="col" class="num">' + __('Πόντοι ομάδας') + '</th>') : ''}<th scope="col">${__('Χρόνος')}</th><th scope="col"><span class="sr">${__('Λεπτομέρειες')}</span></th></tr></thead>
      <tbody>${rows.map(({ p, s }) => {
        const t = ctxT.teamOfP(p);
        const time = Object.values(p.answers || {}).reduce((sum, a) => sum + (a.t || 0), 0) / 1000;
        return `<tr><td class="t-name">${esc(p.name)}${p.done ? (' <span class="done" title="' + __('Ολοκλήρωσε') + '">✓</span>') : ''}</td>${usesTeams(S.mode) ? `<td>${t ? `<span class="dot" style="--t:${t.color}"></span>${esc(t.name)}` : '–'}</td>` : ''}
          ${ctxT.review ? `<td>${p.result && p.result.short ? esc(p.result.short) : '–'}</td><td>${p.plays || (p.done ? 1 : 0)}</td>` : ''}<td>${s.answered}/${qs.length}</td><td>${p.correct || 0}</td><td>${S.mode === 'flashcards' ? '–' : s.acc === null ? '–' : pct(s.acc)}</td>${noPts ? '' : `<td class="num">${num(p.score || 0)}${ctxT.unit ? ` ${ctxT.unit}` : ''}</td>`}${tt ? `<td class="num">${t && tt[t.id] !== undefined ? num(tt[t.id]) : '–'}</td>` : ''}
          <td>${time ? fmtDuration(time) : '–'}</td><td><button type="button" class="btn btn-sm" data-st="${esc(p.uid)}">${__('Απαντήσεις')}</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-st]');
      if (b) studentDialog(players.find((p) => p.uid === b.dataset.st));
    });
  }
  function studentDialog(p) {
    if (!p) return;
    const qs = S.questions || [];
    if (S.mode === 'flashcards') {
      dialog({
        title: p.name, wide: true,
        html: `<ol class="rv-list rv-light">${studyItems(qs).map((q, i) => {
          const a = (p.answers || {})[q.id];
          const back = cardBack(q);
          const what = !a ? __('Δεν την είδε ακόμη') : firstTry(a) ? __('Την ήξερε αμέσως') : a.known ? __('Την έμαθε μετά από επανάληψη ({0} φορές)', a.n || 2) : __('Δεν την έμαθε ακόμη');
          return `<li class="rv ${cellClass(q, a).replace('gc-', 'rv-')}"><span class="rv-mark" aria-hidden="true">${cellMark(q, a) || '–'}</span><div class="rv-body">
            <p class="rv-q">${i + 1}. ${esc(cardFront(q))}</p><p class="rv-a">${esc(what)}</p>${back ? `<p class="rv-a muted">${__('Πίσω:')} <b>${esc(back)}</b></p>` : ''}</div></li>`;
        }).join('')}</ol>`
      });
      return;
    }
    dialog({
      title: p.name, wide: true,
      html: `<ol class="rv-list rv-light">${qs.map((q, i) => {
        const t = TYPES[q.type];
        const a = (p.answers || {})[q.id];
        const cls = cellClass(q, a).replace('gc-', 'rv-');
        return `<li class="rv ${cls}"><span class="rv-mark" aria-hidden="true">${cellMark(q, a) || '–'}</span><div class="rv-body">
          <p class="rv-q">${i + 1}. ${esc(q.text || t.label)}</p>
          ${a ? (a.known !== undefined ? `<p class="rv-a">${a.known ? __('Το ήξερε') : __('Ζήτησε επανάληψη')}</p>` : `<p class="rv-a">${__('Απάντηση:')} <b>${esc(t.describe(q, a.v))}</b>${a.pts ? ` <span class="rv-pts">+${num(a.pts)}</span>` : ''}${a.t ? ` <span class="muted">${Math.round(a.t / 1000)}″</span>` : ''}${a.n > 1 ? ` <span class="muted">${a.n} ${__('προσπάθειες')}</span>` : ''}</p>`) : ('<p class="rv-a muted">' + __('Δεν απάντησε') + '</p>')}
          ${t.scored && (!a || a.f !== 1) ? `<p class="rv-a">${__('Σωστό:')} <b>${esc(t.correct(q))}</b></p>` : ''}</div></li>`;
      }).join('')}</ol>`
    });
  }

  /* ---------- πίνακας μαθητές × ερωτήσεις ---------- */
  function grid(panel) {
    const flash = S.mode === 'flashcards';
    const qs = flash ? studyItems(S.questions) : S.questions || [];
    const rows = players.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'el'));
    const colPct = qs.map((q) => {
      const ans = rows.map((p) => (p.answers || {})[q.id]).filter(Boolean);
      if (flash) return ans.length ? ans.filter(firstTry).length / ans.length : null;
      const sc = ans.filter((a) => a.f !== null && a.f !== undefined);
      return isScored(q) && sc.length ? sc.reduce((s, a) => s + a.f, 0) / sc.length : null;
    });
    const legend = flash
      ? `<span><i class="gc-ok"></i>${__('την ήξερε αμέσως')}</span><span><i class="gc-part"></i>${__('την έμαθε με επανάληψη')}</span><span><i class="gc-bad"></i>${__('δεν την έμαθε ακόμη')}</span><span><i class="gc-none"></i>${__('δεν την είδε')}</span>`
      : `<span><i class="gc-ok"></i>${__('σωστό')}</span><span><i class="gc-part"></i>${__('μερικώς σωστό (%)')}</span><span><i class="gc-bad"></i>${__('λάθος')}</span><span><i class="gc-info"></i>${__('χωρίς βαθμό')}</span><span><i class="gc-none"></i>${__('δεν απάντησε')}</span>`;
    panel.innerHTML = `<div class="grid-legend">${legend}</div>
      <div class="grid-wrap"><table class="grid"><thead><tr><th scope="col" class="g-name">${__('Μαθητής')}</th>${qs.map((q, i) => `<th scope="col" title="${esc(flash ? cardFront(q) : q.text || TYPES[q.type].label)}"><span class="g-qn">${i + 1}</span><span class="g-qp">${colPct[i] === null ? '' : pct(colPct[i])}</span></th>`).join('')}</tr></thead>
      <tbody>${rows.map((p) => `<tr><th scope="row" class="g-name">${esc(p.name)}</th>${qs.map((q, i) => {
        const a = (p.answers || {})[q.id];
        const tip = a ? (a.known !== undefined ? (firstTry(a) ? __('Την ήξερε αμέσως') : a.known ? __('Την έμαθε με επανάληψη') : __('Δεν την έμαθε ακόμη')) : TYPES[q.type].describe(q, a.v)) : flash ? __('Δεν την είδε') : __('Δεν απάντησε');
        return `<td class="gc ${cellClass(q, a)}" title="${esc(`${i + 1}. ${tip}`)}">${cellMark(q, a)}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- CSV και αντιγραφή ---------- */
  function tableRows() {
    if (S.mode === 'flashcards') return cardRows();
    const qs = S.questions || [];
    const tt = teamTotals();
    const head = [__('Όνομα'), __('Ομάδα'), ctxT.unit === '€' ? __('Ποσό €') : __('Πόντοι'), __('Πόντοι ομάδας'), __('Αποτέλεσμα'), __('Φορές'), __('Σωστές'), __('Απαντήσεις'), __('Ακρίβεια %'), __('Ολοκλήρωσε')];
    qs.forEach((q, i) => { head.push(`${__('Ε{0} απάντηση', i + 1)}`, `${__('Ε{0} %', i + 1)}`); });
    const rows = [head];
    ranking(players).forEach((p) => {
      const st = playerStats(p, qs);
      const t = ctxT.teamOfP(p);
      const row = [p.name, t ? t.name : '', p.score || 0, tt && t && tt[t.id] !== undefined ? tt[t.id] : '', (p.result && p.result.short) || '', p.plays || (p.done ? 1 : 0), p.correct || 0, st.answered, st.acc === null ? '' : Math.round(st.acc * 100), p.done ? __('ναι') : __('όχι')];
      qs.forEach((q) => {
        const a = (p.answers || {})[q.id];
        if (!a) { row.push('', ''); return; }
        if (a.known !== undefined) { row.push(a.known ? __('το ήξερε') : __('επανάληψη'), a.known ? 100 : 0); return; }
        row.push(TYPES[q.type].describe(q, a.v), a.f === null || a.f === undefined ? '' : Math.round(a.f * 100));
      });
      rows.push(row);
    });
    rows.push([]);
    qs.forEach((q, i) => rows.push([__('Ε{0}', i + 1), q.text || TYPES[q.type].label, TYPES[q.type].scored ? `${__('Σωστό:')} ${TYPES[q.type].correct(q)}` : '']));
    return rows;
  }
  /* Κάρτες μελέτης: ένα παιδί σε κάθε γραμμή, μία στήλη για κάθε κάρτα. / Flashcards: one child per row, one column per card. */
  function cardRows() {
    const items = studyItems(S.questions);
    const head = [__('Όνομα'), __('Έμαθε'), __('Ήξερε αμέσως'), __('Ολοκλήρωσε')].concat(items.map((q, i) => __('Κ{0}', i + 1)));
    const rows = [head];
    players.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'el')).forEach((p) => {
      const ans = p.answers || {};
      rows.push([p.name, Math.min(items.length, p.correct || 0), items.filter((q) => firstTry(ans[q.id])).length, p.done ? __('ναι') : __('όχι')]
        .concat(items.map((q) => { const a = ans[q.id]; return !a ? '' : firstTry(a) ? __('αμέσως') : a.known ? __('με επανάληψη') : __('όχι ακόμη'); })));
    });
    rows.push([]);
    items.forEach((q, i) => rows.push([__('Κ{0}', i + 1), cardFront(q), cardBack(q)]));
    return rows;
  }
  function exportCsv() {
    if (!S) return;
    const cell = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
    const lines = tableRows().map((r) => r.map(cell).join(';'));
    const name = `${(S.title || __('αναφορά')).replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60)} ${new Date(S.startedAt || S.createdAt || Date.now()).toISOString().slice(0, 10)}.csv`;
    download(name, lines.join('\r\n'));
    toast(__('Κατέβηκε το αρχείο CSV. Ανοίγει στο Excel ή στο LibreOffice.'), 'ok');
  }

  load();
}
