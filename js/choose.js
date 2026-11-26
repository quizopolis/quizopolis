/* Το πρώτο βήμα ενός νέου παιχνιδιού: «Τι θα παίξετε;».
   Η επιλογή αποθηκεύεται στο παιχνίδι (game.mode) και προεπιλέγεται όταν μοιράζεσαι ή ανοίγεις τον προβολέα.
   Τιμές: ένας τρόπος από τα MODES (π.χ. 'penalty'), 'stage-millionaire' κ.λπ. για τον προβολέα, ή '' αν δεν διαλέχτηκε ακόμη.
   Οι ίδιες ερωτήσεις παίζονται πάντα και σε κάθε άλλο παιχνίδι. */
import { esc, app, setTitle, dialog, plural, ICON } from './ui.js';
import { MODES, BASIC_MODES, REVIEW_MODES, STAGE_MODES } from './modes.js';
import { TYPES, validateQuestion } from './qtypes.js';
import { teacherTop } from './teacher.js';
import { __ } from './i18n.js';
import { gameIcon } from './gicons.js';

const STAGE_SHORT = {
  millionaire: __('Η σκάλα ως το 1.000.000 €, με βοήθειες.'),
  jeopardy: __('Πίνακας με θεματικές, κλέψιμο και τελικός.'),
  show: __('Γρήγορος γύρος, ποντάρισμα και τελικός.')
};

const GROUPS = [
  { id: 'basic', title: __('Κουίζ και μελέτη'), note: __('Κάθε παιδί παίζει από τη δική του συσκευή, με σύνδεσμο.'), ids: BASIC_MODES },
  { id: 'review', title: __('Παιχνίδια επανάληψης'), note: __('Κάθε παιδί παίζει από τη δική του συσκευή και μπορεί να ξαναπαίξει. Με το «Παίξε» τα παίζετε και όλοι μαζί στην οθόνη.'), ids: REVIEW_MODES },
  { id: 'stage', title: __('Στον προβολέα, με όλη την τάξη'), note: __('Στην οθόνη της τάξης, με ομάδες. Τα παιδιά απαντούν προφορικά, χωρίς συσκευές.'), ids: STAGE_MODES.map((m) => 'stage-' + m) }
];
const KICKER = { basic: __('Κουίζ και μελέτη'), review: __('Παιχνίδι επανάληψης'), stage: __('Στον προβολέα, με όλη την τάξη') };

/* Συμβουλές για τις ερωτήσεις, όπου το παιχνίδι έχει κάτι δικό του. */
const TIPS = {
  classic: __('Παίζουν όλα τα είδη ερωτήσεων. Τον χρόνο και τους διπλούς πόντους τους ορίζεις σε κάθε ερώτηση.'),
  team: __('Παίζουν όλα τα είδη ερωτήσεων. Πόσες ομάδες θα έχει, το διαλέγεις όταν φτιάχνεις τον σύνδεσμο.'),
  mastery: __('Παίζουν όλα τα είδη ερωτήσεων. Τον στόχο (π.χ. 80%) τον διαλέγεις όταν φτιάχνεις τον σύνδεσμο.'),
  test: __('Παίζουν όλα τα είδη ερωτήσεων. Οι απαντήσεις στις ανοιχτές ερωτήσεις φαίνονται στην αναφορά.'),
  flashcards: __('Σε κάθε όψη βάζεις κείμενο, εικόνα ή βίντεο. Κάρτες φτιάχνεις και από κείμενο ή από ένα κουίζ σου.'),
  millionaire: __('Κάθε ερώτηση είναι ένα σκαλί. Με 15 ερωτήσεις η σκάλα φτάνει ολόκληρη ως το 1.000.000 €.'),
  jeopardy: __('Οι στήλες του πίνακα είναι οι θεματικές: γράψε θεματική σε κάθε ερώτηση, στο «Θεματική και εξήγηση» (έως 6 στήλες, με έως 5 ερωτήσεις η καθεμιά). Με 6 ή περισσότερες ερωτήσεις, η τελευταία γίνεται τελικός γύρος.'),
  picture: __('Την κρυμμένη εικόνα τη διαλέγεις όταν φτιάχνεις τον σύνδεσμο: από τη συλλογή ή δική σου.'),
  race: __('Η κούρσα συνεχίζεται ώσπου να τερματίσει το παιδί, οπότε οι ερωτήσεις ξαναέρχονται. Με 8 ή περισσότερες έχει ποικιλία.'),
  swim: __('Η κούρσα συνεχίζεται ώσπου να τερματίσει το παιδί, οπότε οι ερωτήσεις ξαναέρχονται. Με 8 ή περισσότερες έχει ποικιλία.'),
  'stage-millionaire': __('Οι ομάδες μοιράζονται τις ερωτήσεις: όσο περισσότερες γράψεις, τόσο ψηλότερα φτάνει η σκάλα κάθε ομάδας.')
};
TIPS['stage-jeopardy'] = TIPS.jeopardy;
export const NEED = 3;

/* Όλα όσα χρειάζεται η σελίδα για μια επιλογή, ή null αν δεν υπάρχει. */
export function choiceOf(id) {
  if (!id) return null;
  const stage = /^stage-/.test(id);
  const base = stage ? id.slice(6) : id;
  const m = MODES[base];
  if (!m || (stage && !STAGE_MODES.includes(base))) return null;
  return {
    id, base, stage, icon: m.icon, label: m.label,
    full: stage ? `${m.label} ${__('στον προβολέα')}` : m.label,
    short: stage ? STAGE_SHORT[base] : m.short,
    group: stage ? 'stage' : m.group,
    kicker: KICKER[stage ? 'stage' : m.group],
    tip: TIPS[id] || '',
    needsAnswers: stage || m.group === 'review'
  };
}
/* Ο χρόνος και οι διπλοί πόντοι ανά ερώτηση μετράνε μόνο στα κουίζ με πόντους (κλασικό, ομαδικό, κατάκτηση).
   Όταν δεν έχει διαλεχτεί ακόμη παιχνίδι, φαίνονται, γιατί μπορεί να γίνει κουίζ. */
export const usesQuizExtras = (id) => { const c = choiceOf(id); return !c || (!c.stage && ['classic', 'team', 'mastery'].includes(c.base)); };
/* Ο τρόπος που προεπιλέγεται στο «Μοιράσου» και στον προβολέα. */
export const linkModeOf = (id) => { const c = choiceOf(id); return c ? c.base : null; };
export const stageModeOf = (id) => { const c = choiceOf(id); return c && STAGE_MODES.includes(c.base) ? c.base : null; };

/* Πόσες ερωτήσεις είναι έτοιμες για το παιχνίδι που διαλέχτηκε. */
export function readiness(id, questions) {
  const c = choiceOf(id);
  const valid = (questions || []).filter((q) => TYPES[q.type] && !validateQuestion(q).length);
  if (c && c.needsAnswers) {
    const n = valid.filter((q) => TYPES[q.type].scored).length;
    return { ok: n >= NEED, n, need: NEED, scored: true };
  }
  return { ok: valid.length > 0, n: valid.length, need: 1, scored: false };
}
export function readinessText(id, questions) {
  const r = readiness(id, questions);
  if (r.ok) return { ok: true, text: `${__('Έτοιμο για παιχνίδι:')} ${plural(r.n, __('ερώτηση'), __('ερωτήσεις'))}` };
  if (r.scored) return { ok: false, text: __('Έτοιμες: {0} από τις {1} ερωτήσεις με σωστή απάντηση που χρειάζονται.', r.n, r.need) };
  return { ok: false, text: __('Πρόσθεσε την πρώτη ερώτηση από τα είδη πιο κάτω.') };
}

/* Τα τρία βήματα, για να φαίνεται τι έγινε και τι ακολουθεί. */
export function stepsHtml(active, id) {
  const c = choiceOf(id);
  const third = c && c.stage ? __('Στον προβολέα') : __('Στην τάξη');
  const labels = [__('Παιχνίδι'), __('Ερωτήσεις'), third];
  return `<ol class="steps-mini" aria-label="${__('Βήματα')}">${labels.map((l, i) => {
    const n = i + 1;
    const cls = n < active ? 'is-done' : n === active ? 'is-on' : '';
    return `<li class="${cls}"${n === active ? ' aria-current="step"' : ''}><span class="sm-n" aria-hidden="true">${n < active ? '✓' : n}</span><span>${esc(l)}</span></li>`;
  }).join('')}</ol>`;
}

/* Το πλέγμα με τα παιχνίδια: σύνδεσμοι στη σελίδα «Νέο παιχνίδι», κουμπιά στο παράθυρο αλλαγής.
   opts.cards === false: χωρίς τις κάρτες μελέτης (ξεχωριστό παιχνίδι, όχι τρόπος για ερωτήσεις).
   The games grid. opts.cards === false: without flashcards (a separate game, not a way to play questions). */
export function pickGrid(kind, selected, opts = {}) {
  return GROUPS.map((g) => `<section class="pick-g pick-${g.id}" aria-labelledby="pick-h-${g.id}"><div class="pick-hd"><h2 class="pick-h" id="pick-h-${g.id}">${esc(g.title)}</h2><p class="pick-note">${esc(g.note)}</p></div>
    <ul class="pick-grid">${g.ids.filter((id) => opts.cards !== false || id !== 'flashcards').map((id) => {
      const c = choiceOf(id);
      const on = id === selected;
      const inner = `${gameIcon(id, { size: 48 })}<span class="pick-t"><b>${esc(c.label)}</b><span>${esc(c.short)}</span></span>`;
      return `<li>${kind === 'link'
        ? `<a class="pick" href="#/t/new/${id}" data-choice="${id}">${inner}</a>`
        : `<button type="button" class="pick${on ? ' is-on' : ''}" data-pick="${id}" aria-pressed="${on}">${inner}</button>`}</li>`;
    }).join('')}${kind === 'link' && g.id === 'basic' ? labelTile() : ''}</ul></section>`).join('');
}

/* «Λέξεις στην εικόνα»: κλασικό κουίζ που ξεκινά με εικόνα και κενά (το είδος ερώτησης παίζει σε κάθε παιχνίδι). */
function labelTile() {
  return `<li><a class="pick" href="#/t/new/label" data-choice="label">${gameIcon('label', { size: 48 })}<span class="pick-t"><b>${__('Λέξεις στην εικόνα')}</b><span>${__('Ανεβάζεις μια εικόνα και τα παιδιά σέρνουν τις λέξεις στα κενά της.')}</span></span></a></li>`;
}

/* Παράθυρο αλλαγής παιχνιδιού. Επιστρέφει τη νέα επιλογή ή null. */
export function pickDialog(selected, opts = {}) {
  let picked = null;
  return dialog({
    title: __('Διάλεξε παιχνίδι'), wide: true,
    html: `<p class="dlg-text">${__('Οι ερωτήσεις μένουν ίδιες· αλλάζει μόνο το παιχνίδι που προτείνεται όταν φτιάχνεις τον σύνδεσμο.')}</p><div class="pick-dlg">${pickGrid('button', selected, opts)}</div>`,
    actions: [{ label: __('Άκυρο'), value: null }],
    focus: '.pick.is-on, .pick',
    onOpen(dlg, close) {
      dlg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        picked = b.dataset.pick;
        close('picked');
      });
    }
  }).then(() => picked);
}

/* Σελίδα «Νέο παιχνίδι»: πρώτα διαλέγεις τι θα παίξετε. */
export function viewChooser() {
  setTitle(__('Νέο παιχνίδι'));
  const el = app();
  el.className = 'v-teacher';
  el.innerHTML = teacherTop('lib') + `<main class="tmain pick-page">
    <p class="crumbs"><a href="#/t">${ICON.back}${__('Τα παιχνίδια μου')}</a></p>
    <div class="pick-top"><div><h1 class="h1">${__('Τι θα παίξετε;')}</h1>
      <p class="lead">${__('Πάτα ένα παιχνίδι και γράψε τις ερωτήσεις του. Τις ίδιες ερωτήσεις μπορείς αργότερα να τις παίξεις και σε άλλο παιχνίδι.')}<br>${__('Δεν αποφάσισες ακόμη;')} <a href="#/t/new/free">${__('Γράψε πρώτα τις ερωτήσεις')}</a></p></div>
      ${stepsHtml(1, '')}</div>
    ${pickGrid('link', '')}
  </main>`;
}
