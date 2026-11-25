/*
  «Αποτελέσματα»: όλες οι αναφορές μαζί σε έναν πίνακα, ανά τάξη και περίοδο, και από κάτω οι σύνδεσμοι.
  Results: every report together in one dashboard, by class and period, with the links below.
  Τα νούμερα έρχονται από τα αποθηκευμένα στατιστικά κάθε συνδέσμου (stats.js), όχι από όλους τους μαθητές κάθε φορά.
  The numbers come from each link's stored statistics (stats.js), not from every student each time.
*/
import { esc, app, setTitle, toast, num, plural, ICON, errText, confirmDanger, busy, local } from './ui.js';
import { DB } from './store.js';
import { MODES } from './modes.js';
import { gameIcon } from './gicons.js';
import { teacherTop, linkState, LINK_STATE, closesText } from './teacher.js';
import { statsPlan, refreshStats, nameKey, forgetStats } from './stats.js';
import { __, LOCALE } from './i18n.js';

const DAY = 864e5;
const HELP = 50; // κάτω από αυτό: «χρειάζεται βοήθεια», όπως στην αναφορά / below this: "needs help", as in the report
const COLS = 10; // παιχνίδια στον πίνακα της τάξης / games in the class grid
const LIST = 12; // σύνδεσμοι πριν από το «Δείξε όλους» / links before "Show all"
const SHORT = 6; // παιδιά ή ερωτήσεις πριν από το «Δείξε όλα» / rows before "Show all"
const PREF = 'qz-dash';

const when = (s) => s.createdAt || s.startedAt || 0;
const isNum = (v) => typeof v === 'number' && isFinite(v);
const pc = (v) => `${Math.round(v)}%`;
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const scoredOf = (st) => (st && st.p ? st.p.map((p) => p.a).filter(isNum) : []);

/* ---------- ημερομηνίες / dates ---------- */
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const weekStart = (t) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const monthStart = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const next = (t, unit) => {
  const d = new Date(t);
  if (unit === 'day') d.setDate(d.getDate() + 1); else if (unit === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  return d.getTime();
};
const fmt = (t, o) => new Date(t).toLocaleDateString(LOCALE, o);
const dm = (t) => fmt(t, { day: 'numeric', month: 'short' });

const PERIODS = () => [
  ['7', __('Τελευταίες 7 ημέρες')],
  ['30', __('Τελευταίες 30 ημέρες')],
  ['90', __('Τελευταίοι 3 μήνες')],
  ['year', __('Φετινή σχολική χρονιά')],
  ['all', __('Όλο το διάστημα')]
];
function periodStart(p, now = Date.now()) {
  if (p === 'all') return 0;
  if (p === 'year') { const d = new Date(now); return new Date(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1, 8, 1).getTime(); }
  return dayStart(now) - ((Number(p) || 30) - 1) * DAY;
}

/* ---------- υπολογισμοί / calculations ---------- */
function totals(F) {
  let plays = 0, done = 0;
  const accs = [];
  F.forEach((s) => { if (!s.stats) return; plays += s.stats.n || 0; done += s.stats.d || 0; accs.push(...scoredOf(s.stats)); });
  return { links: F.length, plays, done, acc: mean(accs) };
}

function activity(F, from, to) {
  const span = to - from;
  const unit = span <= 35 * DAY ? 'day' : span <= 46 * 7 * DAY ? 'week' : 'month';
  const first = unit === 'day' ? dayStart(from) : unit === 'week' ? weekStart(from) : monthStart(from);
  const out = [];
  for (let t = first; t <= to && out.length < 400; t = next(t, unit)) out.push({ start: t, end: next(t, unit) - 1, plays: 0, links: 0, accs: [] });
  F.forEach((s) => {
    const t = when(s);
    const b = out.find((x) => t >= x.start && t <= x.end);
    if (!b) return;
    b.links++;
    if (s.stats) { b.plays += s.stats.n || 0; b.accs.push(...scoredOf(s.stats)); }
  });
  out.forEach((b) => { b.acc = mean(b.accs); });
  return { unit, buckets: out };
}

/* Το ίδιο παιδί σε πολλά παιχνίδια: ανά τάξη και όνομα. / The same child across games: by class and name. */
function students(F) {
  const map = new Map();
  F.forEach((s) => (s.stats && s.stats.p ? s.stats.p : []).forEach((p) => {
    const k = nameKey(p.n);
    if (!k) return;
    const key = (s.classId || '-') + '|' + k;
    let x = map.get(key);
    if (!x) map.set(key, (x = { key, k, classId: s.classId || '-', cls: s.className || '', name: p.n, last: 0, games: 0, accs: [] }));
    x.games++;
    if (when(s) >= x.last) { x.last = when(s); x.name = p.n; }
    if (isNum(p.a)) x.accs.push(p.a);
  }));
  return Array.from(map.values()).map((x) => Object.assign(x, { acc: mean(x.accs), scored: x.accs.length }));
}

/* Ερωτήσεις: το ίδιο παιχνίδι μπορεί να στάλθηκε πολλές φορές. / The same game may have been sent many times. */
function questions(F) {
  const map = new Map();
  F.forEach((s) => (s.stats && s.stats.q ? s.stats.q : []).forEach((q) => {
    const key = (s.gameId || s.id) + '|' + q.i;
    let x = map.get(key);
    if (!x) map.set(key, (x = { key, t: q.t, title: s.title, sid: s.id, at: 0, sum: 0, c: 0 }));
    x.sum += q.a * q.c;
    x.c += q.c;
    if (when(s) >= x.at) { x.at = when(s); x.sid = s.id; x.title = s.title; x.t = q.t; }
  }));
  return Array.from(map.values()).filter((x) => x.c).map((x) => Object.assign(x, { acc: x.sum / x.c }));
}

function classRows(F, classes) {
  const groups = new Map();
  F.forEach((s) => {
    const id = s.classId || '-';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(s);
  });
  return Array.from(groups.entries()).map(([id, links]) => {
    const cls = classes.find((c) => c.id === id);
    const size = cls ? (cls.students || []).length : 0;
    const parts = [], accs = [];
    links.forEach((s) => {
      if (!s.stats) return;
      const r = s.stats.r || size;
      if (r) parts.push(Math.min(1, new Set((s.stats.p || []).map((p) => nameKey(p.n))).size / r) * 100);
      accs.push(...scoredOf(s.stats));
    });
    const name = id === '-' ? __('Χωρίς τάξη') : cls ? cls.name : (links.find((s) => s.className) || {}).className || __('Τάξη που σβήστηκε');
    return { id, name, links: links.length, part: mean(parts), acc: mean(accs) };
  }).sort((a, b) => (a.id === '-') - (b.id === '-') || String(a.name).localeCompare(String(b.name), LOCALE, { numeric: true }));
}

/* Πίνακας της τάξης: μαθητές × τα πιο πρόσφατα παιχνίδια. / Class grid: students × the latest games. */
function classGrid(F, cls) {
  const links = F.filter((s) => s.stats).sort((a, b) => when(a) - when(b));
  const shown = links.slice(-COLS);
  const rows = [];
  const byKey = new Map();
  const add = (name, onList) => {
    const k = nameKey(name);
    if (!k || byKey.has(k)) return;
    const r = { k, name: String(name), onList, cells: [] };
    byKey.set(k, r);
    rows.push(r);
  };
  (cls ? cls.students || [] : []).forEach((st) => add(st && st.name ? st.name : st, true));
  const listN = rows.length;
  const extra = [];
  shown.forEach((s) => (s.stats.p || []).forEach((p) => { if (!byKey.has(nameKey(p.n))) extra.push(p.n); }));
  extra.sort((a, b) => String(a).localeCompare(String(b), LOCALE)).forEach((n) => add(n, false));
  rows.forEach((r) => {
    r.cells = shown.map((s) => {
      const ps = (s.stats.p || []).filter((p) => nameKey(p.n) === r.k);
      if (!ps.length) return null;
      const a = mean(ps.map((p) => p.a).filter(isNum));
      return { a: a === null ? null : Math.round(a) };
    });
    r.avg = mean(r.cells.filter((c) => c && c.a !== null).map((c) => c.a));
    r.played = r.cells.filter(Boolean).length;
  });
  const cols = shown.map((s, j) => {
    const base = listN ? rows.slice(0, listN) : rows;
    return { s, played: base.filter((r) => r.cells[j]).length, of: base.length, avg: mean(rows.map((r) => r.cells[j]).filter((c) => c && c.a !== null).map((c) => c.a)) };
  });
  return { rows, cols, listN, more: links.length - shown.length };
}

function ticksFor(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const st = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw && Number.isInteger(v)) || Math.ceil(raw));
  const top = Math.ceil(max / st) * st;
  const out = [];
  for (let v = 0; v <= top; v += st) out.push(v);
  return out;
}

/* ---------- μικρά κομμάτια / small parts ---------- */
const bar = (v, low) => `<span class="dz-bar${low ? ' is-low' : ''}" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(1)}%"></i></span>`;
const meterCell = (v, low) => `<span class="dz-mc">${bar(v, low)}<span class="dz-mc-v">${pc(v)}</span></span>`;

/* Ένα αναδυόμενο για όλα τα γραφήματα. Το κείμενο μπαίνει με textContent: ονόματα και τίτλοι είναι δεδομένα.
   One tooltip for every chart. Text goes in with textContent: names and titles are data. */
function tooltips(root, lookup) {
  const tip = document.createElement('div');
  tip.className = 'dz-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null;
  const hide = () => { cur = null; tip.hidden = true; };
  const show = (el) => {
    const lines = lookup(el.getAttribute('data-tip'));
    if (!lines) { hide(); return; }
    cur = el;
    tip.replaceChildren(...lines.map((t, i) => { const n = document.createElement(i ? 'span' : 'strong'); n.textContent = t; return n; }));
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
  };
  const over = (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && root.contains(el)) { if (el !== cur) show(el); } else if (cur) hide(); };
  const out = (e) => { if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide(); };
  const key = (e) => { if (e.key === 'Escape') hide(); };
  root.addEventListener('pointerover', over);
  root.addEventListener('pointerout', out);
  root.addEventListener('focusin', over);
  root.addEventListener('focusout', hide);
  document.addEventListener('keydown', key);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  return () => {
    tip.remove();
    document.removeEventListener('keydown', key);
    window.removeEventListener('scroll', hide, true);
    window.removeEventListener('resize', hide);
  };
}

/* ================= ΣΕΛΙΔΑ / PAGE ================= */
export function viewLinks(ctx) {
  setTitle(__('Αποτελέσματα'));
  const el = app();
  el.className = 'v-teacher v-dash';
  const saved = local.get(PREF, {}) || {};
  const pref = { period: PERIODS().some(([v]) => v === saved.period) ? saved.period : 'year', cls: saved.cls || 'all' };
  el.innerHTML = teacherTop('links') + `<main class="tmain dz">
    <div class="thead"><h1 class="h1">${__('Αποτελέσματα')}</h1>
      <div class="actions"><button class="btn btn-line" type="button" data-refresh>${__('Ανανέωση')}</button></div></div>
    <p class="lead">${__('Πώς τα πάνε οι τάξεις σου σε όλα τα παιχνίδια που έστειλες. Για τις λεπτομέρειες ενός παιχνιδιού, πάτα «Αναφορά» δίπλα του.')}</p>
    <div class="dz-filters" data-filters hidden></div>
    <div class="dz-body" data-body><p class="muted">${__('Φορτώνει…')}</p></div></main>`;
  const main = el.querySelector('main');
  const body = el.querySelector('[data-body]');
  const filters = el.querySelector('[data-filters]');
  let sessions = [], classes = [], alive = true, timer = 0, hl = '';
  const open = { help: false, hard: false, links: false };
  const view = { act: 'chart' };
  const tips = new Map();
  const offTips = tooltips(main, (k) => tips.get(k));

  /* ---------- ενημέρωση στατιστικών / stats sync ---------- */
  const seen = new Set(), queued = new Set();
  const queue = [];
  let workers = 0, total = 0, finished = 0, fails = 0;
  const soon = () => { if (!timer) timer = setTimeout(() => { timer = 0; if (alive) draw(); }, 300); };
  function syncNote() {
    const n = filters.querySelector('[data-sync]');
    if (!n) return;
    n.textContent = total ? __('Ενημερώνονται τα στατιστικά: {0} από {1}…', finished, total)
      : fails ? __('Κάποιοι σύνδεσμοι δεν ενημερώθηκαν. Πάτα «Ανανέωση» για να ξαναδοκιμάσεις.') : '';
  }
  function enqueue(list, force) {
    list.forEach((s) => {
      if (queued.has(s.id)) return;
      const f = force && linkState(s) === 'open' ? (Date.now() - when(s) < 2 * DAY ? 'full' : 'check') : '';
      if (!f && (seen.has(s.id) || statsPlan(s) === 'ok')) return;
      queued.add(s.id);
      queue.push({ s, f });
      total++;
    });
    while (workers < 3 && queue.length) { workers++; work(); }
    syncNote();
  }
  async function work() {
    while (queue.length && alive) {
      const { s, f } = queue.shift();
      try {
        const st = await refreshStats(s, { force: f });
        if (st && st !== s.stats) { s.stats = st; soon(); }
      } catch (e) { fails++; }
      queued.delete(s.id);
      seen.add(s.id);
      finished++;
      syncNote();
    }
    workers--;
    if (!workers && alive) { total = finished = 0; syncNote(); soon(); }
  }

  /* ---------- φόρτωση / loading ---------- */
  async function load(force) {
    const btn = main.querySelector('[data-refresh]');
    btn.disabled = true;
    if (force) { fails = 0; if (DB.dropCache) DB.dropCache(); body.classList.add('is-stale'); }
    try {
      const [ss, cs] = await Promise.all([DB.listSessions(), DB.listClasses().catch(() => [])]);
      if (!alive) return;
      sessions = ss.sort((a, b) => when(b) - when(a));
      classes = cs;
      drawFilters();
      draw();
      enqueue(filtered(), force);
    } catch (e) {
      if (alive) body.innerHTML = `<div class="banner banner-bad">${esc(errText(e))}</div>`;
    } finally {
      btn.disabled = false;
      body.classList.remove('is-stale');
    }
  }

  function classOptions() {
    const opts = [['all', __('Όλες οι τάξεις')]];
    const named = classes.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), LOCALE, { numeric: true })).map((c) => [c.id, c.name]);
    sessions.forEach((s) => { if (s.classId && !named.some(([id]) => id === s.classId)) named.push([s.classId, s.className || __('Τάξη που σβήστηκε')]); });
    opts.push(...named);
    if (sessions.some((s) => !s.classId)) opts.push(['-', __('Χωρίς τάξη')]);
    return opts;
  }
  const filtered = () => {
    const from = periodStart(pref.period);
    return sessions.filter((s) => when(s) >= from && (pref.cls === 'all' || (pref.cls === '-' ? !s.classId : s.classId === pref.cls)));
  };
  const remember = () => local.set(PREF, pref);

  function drawFilters() {
    if (!sessions.length) { filters.hidden = true; return; }
    const opts = classOptions();
    if (!opts.some(([v]) => v === pref.cls)) pref.cls = 'all';
    filters.hidden = false;
    filters.innerHTML = `<label class="dz-f"><span class="dz-fl">${__('Περίοδος')}</span><select class="input" data-f="period">${PERIODS().map(([v, l]) => `<option value="${v}"${v === pref.period ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="dz-f"><span class="dz-fl">${__('Τάξη')}</span><select class="input" data-f="cls">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === pref.cls ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <p class="dz-sync" data-sync role="status"></p>`;
    syncNote();
  }
  filters.addEventListener('change', (e) => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    pref[f.dataset.f] = f.value;
    open.help = open.hard = open.links = false;
    hl = '';
    remember();
    draw();
    enqueue(filtered());
  });
  function pickClass(id, rowKey) {
    pref.cls = id;
    hl = rowKey || '';
    remember();
    drawFilters();
    draw();
    enqueue(filtered());
    const target = (rowKey && body.querySelector(`[data-row="${CSS.escape(rowKey)}"]`)) || body.querySelector('[data-grid]');
    if (target) target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* ---------- σχεδίαση / drawing ---------- */
  function draw() {
    tips.clear();
    if (!sessions.length) {
      body.innerHTML = `<div class="empty"><p class="empty-t">${__('Δεν έχεις στείλει ακόμη κανένα παιχνίδι.')}</p><p>${__('Από «Τα παιχνίδια μου» πάτα «Στείλε στην τάξη» σε ένα παιχνίδι.')}</p><p><a class="btn btn-primary" href="#/t">${__('Τα παιχνίδια μου')}</a></p></div>`;
      return;
    }
    const F = filtered();
    if (!F.length) {
      body.innerHTML = `<div class="empty"><p class="empty-t">${__('Δεν υπάρχουν παιχνίδια σε αυτή την περίοδο.')}</p><p>${__('Διάλεξε μεγαλύτερη περίοδο ή άλλη τάξη.')}</p><p><button class="btn" type="button" data-all-time>${__('Δες όλο το διάστημα')}</button></p></div>`;
      return;
    }
    const k = totals(F);
    const from = pref.period === 'all' ? Math.min(...F.map(when)) : periodStart(pref.period);
    const cls = pref.cls !== 'all' ? classes.find((c) => c.id === pref.cls) || null : null;
    body.innerHTML = tilesHtml(k)
      + actHtml(activity(F, from, Date.now()))
      + `<div class="dz-cols">${helpHtml(F)}${hardHtml(F, k)}</div>`
      + (pref.cls === 'all' ? classesHtml(F) : gridHtml(F, cls))
      + linksHtml(F);
    fitAxis();
  }

  function tilesHtml(k) {
    const t = (v, l) => `<div class="tile-s"><span class="tile-n">${v}</span><span class="tile-l">${l}</span></div>`;
    return `<div class="tiles dz-tiles">
      ${t(num(k.links), k.links === 1 ? __('παιχνίδι στάλθηκε') : __('παιχνίδια στάλθηκαν'))}
      ${t(num(k.plays), k.plays === 1 ? __('συμμετοχή') : __('συμμετοχές'))}
      ${t(k.acc === null ? '–' : pc(k.acc), __('μέση ακρίβεια'))}
      ${t(k.plays ? pc((k.done / k.plays) * 100) : '–', __('ολοκλήρωσαν'))}</div>`;
  }

  function actHtml({ unit, buckets }) {
    const title = unit === 'day' ? __('Συμμετοχές ανά ημέρα') : unit === 'week' ? __('Συμμετοχές ανά εβδομάδα') : __('Συμμετοχές ανά μήνα');
    const long = (b) => (unit === 'day' ? fmt(b.start, { weekday: 'long', day: 'numeric', month: 'long' })
      : unit === 'week' ? `${dm(b.start)} – ${dm(b.end)}` : fmt(b.start, { month: 'long', year: 'numeric' }));
    const tick = (b) => (unit === 'month' ? fmt(b.start, { month: 'short' }) : dm(b.start));
    const plays = (n) => (n === 1 ? __('1 συμμετοχή') : __('{0} συμμετοχές', num(n)));
    const games = (n) => (n === 1 ? __('1 παιχνίδι') : __('{0} παιχνίδια', num(n)));
    const seg = `<div class="seg dz-seg" role="radiogroup" aria-label="${__('Προβολή')}">${[['chart', __('Γράφημα')], ['table', __('Πίνακας')]].map(([v, l]) =>
      `<label class="seg-c"><input type="radio" name="dz-act" value="${v}" data-view="act"${view.act === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    let inner;
    if (view.act === 'table') {
      const rows = buckets.filter((b) => b.links).reverse();
      inner = rows.length ? `<div class="dz-scroll"><table class="dz-table"><thead><tr><th scope="col">${unit === 'day' ? __('Ημέρα') : unit === 'week' ? __('Εβδομάδα') : __('Μήνας')}</th><th scope="col" class="num">${__('Συμμετοχές')}</th><th scope="col" class="num">${__('Παιχνίδια')}</th><th scope="col" class="num">${__('Μέση ακρίβεια')}</th></tr></thead>
        <tbody>${rows.map((b) => `<tr><th scope="row">${esc(long(b))}</th><td class="num">${num(b.plays)}</td><td class="num">${num(b.links)}</td><td class="num">${b.acc === null ? '–' : pc(b.acc)}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="dz-empty">${__('Δεν στάλθηκαν παιχνίδια σε αυτή την περίοδο.')}</p>`;
    } else {
      const max = Math.max(0, ...buckets.map((b) => b.plays));
      const ticks = ticksFor(max);
      const top = ticks[ticks.length - 1];
      const iMax = max ? buckets.findIndex((b) => b.plays === max) : -1;
      let iLast = -1;
      buckets.forEach((b, i) => { if (b.plays) iLast = i; });
      buckets.forEach((b, i) => {
        tips.set('a' + i, [plays(b.plays), long(b), b.links ? (b.acc === null ? games(b.links) : `${games(b.links)}, ${__('{0} σωστά', pc(b.acc))}`) : __('Κανένα παιχνίδι')]);
      });
      inner = `<div class="dz-act">
        <div class="dz-y" aria-hidden="true">${ticks.map((v) => `<span style="bottom:${((v / top) * 100).toFixed(2)}%">${num(v)}</span>`).join('')}</div>
        <div class="dz-plot">${ticks.map((v, i) => `<i class="dz-gl${i ? '' : ' is-base'}" style="bottom:${((v / top) * 100).toFixed(2)}%"></i>`).join('')}
          <div class="dz-bars" role="group" aria-label="${esc(title)}">${buckets.map((b, i) => {
            const h = ((b.plays / top) * 100).toFixed(2);
            const cap = b.plays && (i === iMax || i === iLast);
            return `<div class="dz-col" role="img" tabindex="${i === buckets.length - 1 ? 0 : -1}" data-tip="a${i}" aria-label="${esc(long(b))}: ${esc(plays(b.plays))}"><i style="height:${h}%"></i>${cap ? `<b class="dz-cap" style="bottom:${h}%">${num(b.plays)}</b>` : ''}</div>`;
          }).join('')}</div></div>
        <div class="dz-x" aria-hidden="true">${buckets.map((b) => `<span>${esc(tick(b))}</span>`).join('')}</div></div>`;
    }
    return `<section class="panel dz-card"><div class="dz-head"><div><h2 class="h3">${title}</h2>
      <p class="dz-sub">${__('Πόσες φορές έπαιξαν τα παιδιά τα παιχνίδια που έστειλες, με βάση την ημέρα που στάλθηκε το καθένα.')}</p></div>${seg}</div>${inner}</section>`;
  }

  /* Ετικέτες του άξονα χωρίς επικαλύψεις: δείχνουμε μία κάθε τόσες, πάντα και την τελευταία.
     Axis labels without overlaps: one every few, always including the last. */
  function fitAxis() {
    const x = body.querySelector('.dz-x');
    if (!x) return;
    const spans = Array.from(x.children);
    const per = x.clientWidth / Math.max(1, spans.length);
    const widest = Math.max(1, ...spans.map((s) => s.scrollWidth));
    const k = Math.max(1, Math.ceil((widest + 12) / Math.max(1, per)));
    spans.forEach((s, i) => s.classList.toggle('is-off', (spans.length - 1 - i) % k !== 0));
  }

  function helpHtml(F) {
    const withQs = F.filter((s) => s.stats && (s.stats.q || []).length).length;
    const minGames = withQs >= 2 ? 2 : 1;
    const list = students(F).filter((x) => x.acc !== null && x.scored >= minGames && x.acc < HELP)
      .sort((a, b) => a.acc - b.acc || b.scored - a.scored);
    const all = pref.cls === 'all';
    const rows = open.help ? list : list.slice(0, SHORT);
    return `<section class="panel dz-card"><div class="dz-head"><div><h2 class="h3">${__('Χρειάζονται βοήθεια')}</h2>
      <p class="dz-sub">${minGames === 2 ? __('Κάτω από {0}% σωστά, κατά μέσο όρο σε 2 ή περισσότερα παιχνίδια.', HELP) : __('Κάτω από {0}% σωστά.', HELP)}</p></div></div>
      ${list.length ? `<ul class="dz-list">${rows.map((x) => `<li class="dz-m"><button class="dz-m-n" type="button" data-stu="${esc(x.classId)}" data-key="${esc(x.k)}" title="${esc(__('Δες το παιδί στον πίνακα της τάξης'))}">
          <b>${esc(x.name)}</b><span>${all && x.cls ? `${esc(x.cls)}, ` : ''}${x.scored === 1 ? __('1 παιχνίδι') : __('{0} παιχνίδια', x.scored)}</span></button>
          ${bar(x.acc, true)}<span class="dz-m-v">${pc(x.acc)}</span></li>`).join('')}</ul>
        ${list.length > SHORT ? `<button class="btn btn-sm btn-line dz-more" type="button" data-more="help">${open.help ? __('Λιγότερα') : __('Δείξε και τα {0} ακόμη', list.length - SHORT)}</button>` : ''}`
        : `<p class="dz-empty">${scoredOf({ p: [].concat(...F.map((s) => (s.stats ? s.stats.p || [] : []))) }).length ? __('Κανένα παιδί κάτω από {0}% σε αυτή την περίοδο.', HELP) : __('Δεν υπάρχουν ακόμη απαντήσεις με βαθμό.')}</p>`}
    </section>`;
  }

  function hardHtml(F, k) {
    const minC = k.plays >= 10 ? 3 : 1;
    const list = questions(F).filter((x) => x.c >= minC && x.acc < 70).sort((a, b) => a.acc - b.acc || b.c - a.c);
    const rows = open.hard ? list : list.slice(0, SHORT);
    const any = questions(F).length;
    return `<section class="panel dz-card"><div class="dz-head"><div><h2 class="h3">${__('Οι πιο δύσκολες ερωτήσεις')}</h2>
      <p class="dz-sub">${__('Με τις λιγότερες σωστές απαντήσεις. Κόκκινο σημαίνει κάτω από {0}%. Πάτα μία για να ανοίξει η αναφορά.', HELP)}</p></div></div>
      ${list.length ? `<ul class="dz-list">${rows.map((x) => `<li class="dz-m"><a class="dz-m-n" href="#/t/report/${esc(x.sid)}">
          <b class="dz-q">${esc(x.t)}</b><span>${esc(x.title)}, ${esc(dm(x.at))}</span></a>
          ${bar(x.acc, x.acc < HELP)}<span class="dz-m-v">${pc(x.acc)}</span></li>`).join('')}</ul>
        ${list.length > SHORT ? `<button class="btn btn-sm btn-line dz-more" type="button" data-more="hard">${open.hard ? __('Λιγότερα') : __('Δείξε και τις {0} ακόμη', list.length - SHORT)}</button>` : ''}`
        : `<p class="dz-empty">${any ? __('Όλες οι ερωτήσεις είχαν 70% σωστές απαντήσεις ή περισσότερο.') : __('Δεν υπάρχουν ακόμη απαντήσεις με βαθμό.')}</p>`}
    </section>`;
  }

  function classesHtml(F) {
    const rows = classRows(F, classes);
    return `<section class="panel dz-card"><div class="dz-head"><div><h2 class="h3">${__('Οι τάξεις σου')}</h2>
      <p class="dz-sub">${__('Συμμετοχή: πόσα παιδιά της λίστας έπαιξαν κάθε παιχνίδι, κατά μέσο όρο. Άνοιξε μια τάξη για να δεις κάθε παιδί.')}</p></div></div>
      <div class="dz-scroll"><table class="dz-table dz-cls"><thead><tr><th scope="col">${__('Τάξη')}</th><th scope="col" class="num">${__('Παιχνίδια')}</th><th scope="col">${__('Συμμετοχή')}</th><th scope="col">${__('Μέση ακρίβεια')}</th><th scope="col"><span class="dz-sr">${__('Άνοιγμα')}</span></th></tr></thead>
      <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.name)}</th><td class="num" data-l="${__('Παιχνίδια')}">${num(r.links)}</td>
        <td data-l="${__('Συμμετοχή')}">${r.part === null ? '<span class="muted">–</span>' : meterCell(r.part, false)}</td>
        <td data-l="${__('Μέση ακρίβεια')}">${r.acc === null ? '<span class="muted">–</span>' : meterCell(r.acc, r.acc < HELP)}</td>
        <td class="dz-go"><button class="btn btn-sm btn-line" type="button" data-pick="${esc(r.id)}">${__('Άνοιγμα')}</button></td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function gridHtml(F, cls) {
    const g = classGrid(F, cls);
    const name = pref.cls === '-' ? __('Χωρίς τάξη') : cls ? cls.name : (F.find((s) => s.className) || {}).className || __('Τάξη που σβήστηκε');
    const head = `<div class="dz-head"><div><h2 class="h3">${__('{0}: η τάξη με μια ματιά', esc(name))}</h2>
      <p class="dz-sub">${__('Ποσοστό σωστών απαντήσεων κάθε παιδιού σε κάθε παιχνίδι.')}${g.more ? ` ${__('Φαίνονται τα {0} πιο πρόσφατα.', g.cols.length)}` : ''}</p></div>
      <button class="btn btn-sm btn-line" type="button" data-pick="all">${__('Όλες οι τάξεις')}</button></div>`;
    if (!g.cols.length || !g.rows.length) {
      return `<section class="panel dz-card" data-grid>${head}<p class="dz-empty">${g.cols.length ? __('Δεν έπαιξε ακόμη κανείς.') : __('Περιμένουμε τα στατιστικά…')}</p></section>`;
    }
    const hasList = g.listN > 0;
    const anyInfo = g.rows.some((r) => r.cells.some((c) => c && c.a === null));
    const anyLow = g.rows.some((r) => r.cells.some((c) => c && c.a !== null && c.a < HELP));
    g.cols.forEach((c, j) => tips.set('h' + j, [c.s.title, fmt(when(c.s), { day: 'numeric', month: 'long', year: 'numeric' }),
      __('Έπαιξαν {0} από {1}', c.played, c.of) + (c.avg === null ? '' : `, ${__('{0} σωστά', pc(c.avg))}`)]));
    const cell = (r, c, j) => {
      if (!c) return `<td class="dz-c is-none">–</td>`;
      if (c.a === null) { tips.set(`c${j}-${r.k}`, [__('Έπαιξε'), r.name, g.cols[j].s.title]); return `<td class="dz-c is-info" data-tip="c${j}-${esc(r.k)}">✓</td>`; }
      tips.set(`c${j}-${r.k}`, [__('{0} σωστά', `${c.a}%`), r.name, g.cols[j].s.title]);
      return `<td class="dz-c${c.a < HELP ? ' is-low' : ''}" data-tip="c${j}-${esc(r.k)}">${c.a}</td>`;
    };
    return `<section class="panel dz-card" data-grid>${head}
      <div class="dz-legend">${anyLow ? `<span class="dz-lg"><i class="dz-sw is-low"></i>${__('κάτω από {0}%', HELP)}</span>` : ''}<span class="dz-lg"><i class="dz-sw is-ok"></i>${__('{0}% και πάνω', HELP)}</span><span class="dz-lg"><i class="dz-sw is-none">–</i>${__('δεν έπαιξε')}</span>${anyInfo ? `<span class="dz-lg"><i class="dz-sw is-info">✓</i>${__('έπαιξε, χωρίς βαθμό')}</span>` : ''}</div>
      <div class="dz-scroll dz-hm-wrap" tabindex="0" role="region" aria-label="${esc(__('{0}: η τάξη με μια ματιά', name))}">
      <table class="dz-hm"><thead><tr><th scope="col" class="dz-hm-n">${__('Μαθητής')}</th>${g.cols.map((c, j) => `<th scope="col" class="dz-hm-h"><a href="#/t/report/${esc(c.s.id)}" data-tip="h${j}"><span class="dz-vt">${esc(c.s.title)}</span><span class="dz-hd">${esc(dm(when(c.s)))}</span></a></th>`).join('')}
        <th scope="col" class="dz-hm-s">${__('Μ.Ο.')}</th><th scope="col" class="dz-hm-s">${__('Έπαιξε')}</th></tr></thead>
      <tbody>${g.rows.map((r, i) => `<tr data-row="${esc(r.k)}"${r.k === hl ? ' class="is-hl"' : ''}><th scope="row" class="dz-hm-n${i === g.listN && hasList ? ' is-sep' : ''}">${esc(r.name)}${hasList && !r.onList ? '<sup class="dz-off">*</sup>' : ''}</th>
        ${r.cells.map((c, j) => cell(r, c, j)).join('')}
        <td class="dz-c dz-avg${r.avg !== null && r.avg < HELP ? ' is-low' : ''}">${r.avg === null ? '–' : pc(r.avg)}</td><td class="dz-c dz-pl">${r.played}/${g.cols.length}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row" class="dz-hm-n">${__('Έπαιξαν')}</th>${g.cols.map((c) => `<td class="dz-c dz-pl">${c.played}/${c.of}</td>`).join('')}<td></td><td></td></tr>
        <tr><th scope="row" class="dz-hm-n">${__('Μ.Ο. τάξης')}</th>${g.cols.map((c) => `<td class="dz-c dz-avg${c.avg !== null && c.avg < HELP ? ' is-low' : ''}">${c.avg === null ? '–' : pc(c.avg)}</td>`).join('')}<td></td><td></td></tr></tfoot></table></div>
      ${hasList && g.rows.length > g.listN ? `<p class="dz-note"><sup>*</sup> ${__('Δεν είναι στη λίστα της τάξης: το παιδί έγραψε το όνομά του διαφορετικά ή έπαιξε από σύνδεσμο χωρίς λίστα.')}</p>` : ''}</section>`;
  }

  function linksHtml(F) {
    const rows = open.links ? F : F.slice(0, LIST);
    return `<section class="dz-links"><div class="dz-links-h"><h2 class="h3">${__('Σύνδεσμοι')}</h2><span class="muted">${num(F.length)}</span></div>
      <ul class="rows">${rows.map((s) => {
        const m = MODES[s.mode] || MODES.classic;
        const state = linkState(s);
        const cls = classes.find((c) => c.id === s.classId);
        const cn = s.className || (cls && cls.name);
        const st = s.stats;
        const acc = st ? mean(scoredOf(st)) : null;
        const who = !st ? '<span class="muted">…</span>' : st.n ? `<span>${st.n === 1 ? __('1 παιδί') : __('{0} παιδιά', num(st.n))}${acc === null ? '' : `, ${__('{0} σωστά', pc(acc))}`}</span>` : `<span>${__('Δεν έπαιξε ακόμη κανείς')}</span>`;
        return `<li class="row-i has-ic">${gameIcon(s.mode, { size: 40 })}<span class="row-t"><span>${esc(s.title)}</span></span>
          <span class="row-s"><span>${esc(m.label)}${cn ? `, ${esc(cn)}` : ''}</span><span>${esc(fmt(when(s), { day: 'numeric', month: 'short', year: 'numeric' }))}</span>${who}<span class="state state-${state}">${state === 'open' ? esc(closesText(s.deadline)) : LINK_STATE[state]}</span></span>
          <span class="row-a"><a class="btn btn-sm btn-line" href="#/t/link/${esc(s.id)}">${ICON.link}${__('Σύνδεσμος')}</a><a class="btn btn-sm btn-soft" href="#/t/report/${esc(s.id)}">${ICON.chart}${__('Αναφορά')}</a>
          <button class="icon-btn icon-danger" type="button" data-del="${esc(s.id)}" aria-label="${__('Διαγραφή του συνδέσμου')} ${esc(s.title)}">${ICON.trash}</button></span></li>`;
      }).join('')}</ul>
      ${F.length > LIST ? `<button class="btn btn-sm btn-line dz-more" type="button" data-more="links">${open.links ? __('Λιγότεροι') : __('Δείξε όλους ({0})', num(F.length))}</button>` : ''}</section>`;
  }

  /* ---------- ενέργειες / actions ---------- */
  body.addEventListener('click', async (e) => {
    const t = e.target;
    const more = t.closest('[data-more]');
    if (more) { open[more.dataset.more] = !open[more.dataset.more]; draw(); const b = body.querySelector(`[data-more="${more.dataset.more}"]`); if (b) b.focus(); return; }
    const pick = t.closest('[data-pick]');
    if (pick) { pickClass(pick.dataset.pick); return; }
    const stu = t.closest('[data-stu]');
    if (stu) { pickClass(stu.dataset.stu, stu.dataset.key); return; }
    if (t.closest('[data-all-time]')) { pref.period = 'all'; remember(); drawFilters(); draw(); enqueue(filtered()); return; }
    const del = t.closest('[data-del]');
    if (!del) return;
    const s = sessions.find((x) => x.id === del.dataset.del);
    if (s && await confirmDanger(`${__('Διαγραφή του συνδέσμου «{0}»;', s.title)}`, __('Ο σύνδεσμος δεν θα ανοίγει πια και θα σβηστούν οι απαντήσεις των παιδιών.'))) {
      const b = busy(__('Διαγραφή…'));
      try {
        await DB.deleteSession(s.id);
        forgetStats(s.id);
        sessions = sessions.filter((x) => x.id !== s.id);
        drawFilters();
        draw();
      } catch (er) { toast(errText(er), 'error'); }
      b.close();
    }
  });
  body.addEventListener('change', (e) => {
    const v = e.target.closest('[data-view]');
    if (!v) return;
    view[v.dataset.view] = v.value;
    draw();
    const back = body.querySelector(`[data-view="${v.dataset.view}"][value="${v.value}"]`);
    if (back) back.focus();
  });
  // Τα δεδομένα του γραφήματος με τα βελάκια: μία στάση με Tab, μετά ←/→. / Chart data with the arrow keys: one Tab stop, then ←/→.
  body.addEventListener('keydown', (e) => {
    const col = e.target.closest && e.target.closest('.dz-col');
    if (!col || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const all = Array.from(col.parentNode.children);
    const i = all.indexOf(col);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    all.forEach((c, n) => c.setAttribute('tabindex', n === j ? '0' : '-1'));
    all[j].focus();
  });
  main.querySelector('[data-refresh]').addEventListener('click', () => load(true));
  let rs = 0;
  const onResize = () => { cancelAnimationFrame(rs); rs = requestAnimationFrame(fitAxis); };
  window.addEventListener('resize', onResize);
  ctx.setCleanup(() => { alive = false; clearTimeout(timer); offTips(); window.removeEventListener('resize', onResize); });

  load(false);
}
