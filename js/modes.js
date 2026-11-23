/* Τρόποι παιχνιδιού. Κάθε σετ ερωτήσεων παίζεται με όποιον τρόπο διαλέξει ο εκπαιδευτικός, μέσω συνδέσμου. */
import { __ } from './i18n.js';
export const MODES = {
  classic: {
    label: __('Κλασικό κουίζ'), icon: '🧠', group: 'basic',
    short: __('Ερωτήσεις με πόντους, χρόνο και κατάταξη.'),
    desc: __('Κάθε παιδί απαντά με τον δικό του ρυθμό. Πόντοι για σωστές και γρήγορες απαντήσεις, σερί και βοήθειες.'),
    kid: __('Απάντησε με τον δικό σου ρυθμό. Οι σωστές και γρήγορες απαντήσεις φέρνουν περισσότερους πόντους.'),
    defaults: { timer: true, showAnswers: true, powerups: true, shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  team: {
    label: __('Ομαδικό'), icon: '🤝', group: 'basic',
    short: __('Παίζουν σε ομάδες· οι πόντοι μετράνε για όλη την ομάδα.'),
    desc: __('Κάθε παιδί μπαίνει σε μία ομάδα και παίζει όποτε μπορεί. Η ομάδα παίρνει τον μέσο όρο των μελών της, συν μπόνους για κάθε ερώτηση που βρήκαν όλοι. Οι πόντοι της ομάδας γράφονται σε όλα τα μέλη.'),
    kid: __('Θα μπεις σε μία ομάδα. Οι πόντοι σου μετράνε για όλη την ομάδα!'),
    defaults: { timer: true, showAnswers: true, powerups: true, shuffleQ: true, shuffleA: true, leaderboard: true, teams: 4 }
  },
  mastery: {
    label: __('Κατάκτηση'), icon: '⛰️', group: 'basic',
    short: __('Όποια ερώτηση χάσουν ξαναέρχεται, μέχρι τον στόχο.'),
    desc: __('Όποια ερώτηση χάσουν ξαναέρχεται, μέχρι να φτάσουν τον στόχο. Ανεβαίνουν βήμα βήμα στην κορυφή.'),
    kid: __('Όποια ερώτηση χάσεις θα ξανάρθει, μέχρι να φτάσεις στην κορυφή.'),
    defaults: { timer: false, showAnswers: true, shuffleQ: true, shuffleA: true, leaderboard: true, goal: 80 }
  },
  test: {
    label: __('Τεστ'), icon: '📝', group: 'basic',
    short: __('Χωρίς πόντους και διορθώσεις· τα αποτελέσματα στην αναφορά.'),
    desc: __('Χωρίς πόντους, χωρίς χρονόμετρο και χωρίς διόρθωση στη διάρκεια. Τα αποτελέσματα τα βλέπεις στην αναφορά.'),
    kid: __('Απάντησε σε όλες τις ερωτήσεις. Τα αποτελέσματα τα βλέπει ο εκπαιδευτικός σου.'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: false, showResults: true }
  },
  flashcards: {
    label: __('Κάρτες μελέτης'), icon: '🃏', group: 'basic',
    short: __('Κάρτες με την ερώτηση μπροστά και την απάντηση πίσω.'),
    desc: __('Γυρίζουν κάρτες με την ερώτηση και τη σωστή απάντηση και σημειώνουν τι ήξεραν.'),
    kid: __('Γύρνα τις κάρτες, δες τη σωστή απάντηση και σημείωσε αν την ήξερες.'),
    defaults: { shuffleQ: true }
  },
  millionaire: {
    label: __('Εκατομμυριούχος'), icon: '💰', group: 'review', unit: '€', replay: true, stage: true,
    short: __('Η σκάλα ως το 1.000.000 €, με βοήθειες.'),
    desc: __('Ανεβαίνουν τη σκάλα των ποσών ως το 1.000.000. Με λάθος απάντηση κρατούν το ποσό του τελευταίου σταθμού. Βοήθειες: 50:50, «Ρώτα την τάξη» και «Συμβουλή».'),
    kid: __('Ανέβα τη σκάλα των ποσών ως το 1.000.000 €! Έχεις τρεις βοήθειες: 50:50, «Ρώτα την τάξη» και «Συμβουλή».'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  jeopardy: {
    label: 'Jeopardy', icon: '🟦', group: 'review', replay: true, stage: true,
    short: __('Πίνακας με θεματικές και αξίες από 100 έως 500.'),
    desc: __('Πίνακας με θεματικές και αξίες 100 έως 500. Διαλέγουν ερώτηση, κερδίζουν την αξία της. Μια κρυφή ερώτηση είναι «διπλή» με ποντάρισμα.'),
    note: __('Οι στήλες του πίνακα βγαίνουν από τη «Θεματική» των ερωτήσεων (στον επεξεργαστή). Με 6 ή περισσότερες ερωτήσεις, η τελευταία γίνεται τελικός γύρος.'),
    kid: __('Διάλεξε θεματική και αξία από τον πίνακα. Κάπου κρύβεται μια διπλή ερώτηση!'),
    defaults: { shuffleA: true, leaderboard: true }
  },
  show: {
    label: __('Τηλεπαιχνίδι'), icon: '🎤', group: 'review', replay: true, stage: true,
    short: __('Γρήγορος γύρος, ποντάρισμα και τελικός.'),
    desc: __('Τρεις γύροι: γρήγορες ερωτήσεις σε 60 δευτερόλεπτα, ποντάρισμα και μεγάλος τελικός «διπλάσιο ή μισό».'),
    kid: __('Τρεις γύροι: γρήγορες ερωτήσεις, ποντάρισμα και ο μεγάλος τελικός!'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  race: {
    label: __('Αγώνας δρόμου'), icon: '🏃', group: 'review', replay: true,
    short: __('Κάθε σωστή απάντηση δίνει φόρα στα 100 μέτρα.'),
    desc: __('Τρέχουν 100 μέτρα. Κάθε σωστή απάντηση δίνει φόρα, κάθε λάθος κουράζει. Αντίπαλοι είναι οι συμμαθητές που έτρεξαν πριν και δρομείς του υπολογιστή.'),
    kid: __('Τρέξε 100 μέτρα! Κάθε σωστή απάντηση σου δίνει φόρα, κάθε λάθος σε κουράζει.'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  swim: {
    label: __('Κολύμβηση'), icon: '🏊', group: 'review', replay: true,
    short: __('Κάθε σωστή απάντηση δίνει φόρα στην πισίνα.'),
    desc: __('Κολυμπούν 100 μέτρα ελεύθερο. Κάθε σωστή απάντηση δίνει φόρα, κάθε λάθος κουράζει. Αντίπαλοι είναι οι συμμαθητές που κολύμπησαν πριν και κολυμβητές του υπολογιστή.'),
    kid: __('Κολύμπησε 100 μέτρα! Κάθε σωστή απάντηση σου δίνει φόρα, κάθε λάθος σε κουράζει.'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  shooting: {
    label: __('Σκοποβολή'), icon: '🎯', group: 'review', replay: true,
    short: __('Με σωστές απαντήσεις οι στόχοι μεγαλώνουν.'),
    desc: __('Μετά από κάθε ερώτηση, γύρος με κινούμενους στόχους. Με σωστές απαντήσεις οι στόχοι μεγαλώνουν και κινούνται πιο αργά. Με λάθη μικραίνουν.'),
    kid: __('Απάντησε σωστά και οι στόχοι μεγαλώνουν. Μετά σημάδεψε και πάτα πάνω τους!'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  penalty: {
    label: __('Πέναλτι'), icon: '⚽', group: 'review', replay: true,
    short: __('Σουτάρουν και αποκρούουν με σωστές απαντήσεις.'),
    desc: __('Διαδικασία πέναλτι με τον υπολογιστή. Με σωστή απάντηση σουτάρουν ή πέφτουν να πιάσουν τη μπάλα. Με λάθη ο τερματοφύλακας του αντιπάλου γίνεται πιο γρήγορος.'),
    kid: __('Απάντησε σωστά για να σουτάρεις και να πιάνεις τη μπάλα. Κέρδισε στα πέναλτι!'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  escape: {
    label: __('Δωμάτιο απόδρασης'), icon: '🔐', group: 'review', replay: true,
    short: __('Κάθε σωστή απάντηση δίνει ένα ψηφίο για την πόρτα.'),
    desc: __('Κλειδωμένοι στη βιβλιοθήκη! Κάθε σωστή απάντηση δίνει ένα ψηφίο για τις κλειδαριές της πόρτας. Κάθε λάθος κοστίζει χρόνο.'),
    kid: __('Η πόρτα της βιβλιοθήκης κλείδωσε! Βρες τα ψηφία για τις κλειδαριές πριν τελειώσει ο χρόνος.'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  snakes: {
    label: __('Φιδάκι'), icon: '🐍', group: 'review', replay: true,
    short: __('Ζαριές με σωστές απαντήσεις, απέναντι σε ένα ρομπότ.'),
    desc: __('Ζάρι και ερωτήσεις, απέναντι στον υπολογιστή. Με σωστή απάντηση ρίχνουν το ζάρι. Στο κεφάλι του φιδιού, μια σωστή απάντηση τους σώζει.'),
    kid: __('Κάθε σωστή απάντηση σου δίνει μια ζαριά. Φτάσε στο 30 πριν από το ρομπότ!'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true }
  },
  picture: {
    label: __('Κρυμμένη εικόνα'), icon: '🖼️', group: 'review', replay: true,
    short: __('Κάθε σωστή απάντηση ξεσκεπάζει ένα κομμάτι της εικόνας.'),
    desc: __('Κάθε σωστή απάντηση ξεσκεπάζει ένα κομμάτι από μια κρυμμένη εικόνα. Όσο νωρίτερα τη μαντέψουν, τόσο περισσότεροι πόντοι.'),
    kid: __('Κάθε σωστή απάντηση ανοίγει ένα κομμάτι από μια κρυμμένη εικόνα. Μάντεψε τι δείχνει!'),
    defaults: { shuffleQ: true, shuffleA: true, leaderboard: true, picture: 'auto' }
  }
};
export const BASIC_MODES = ['classic', 'team', 'mastery', 'test', 'flashcards'];
export const REVIEW_MODES = ['millionaire', 'jeopardy', 'show', 'race', 'swim', 'shooting', 'penalty', 'escape', 'snakes', 'picture'];
export const STAGE_MODES = ['millionaire', 'jeopardy', 'show'];
export const MODE_ORDER = BASIC_MODES.concat(REVIEW_MODES);

export function modeOf(s) { return MODES[s && s.mode] || MODES.classic; }
export const isReview = (mode) => REVIEW_MODES.includes(mode);
export const isSelfPaced = (mode) => ['classic', 'team', 'mastery', 'test'].includes(mode);
export const usesTeams = (mode) => mode === 'team';
export const unitOf = (mode) => (MODES[mode] && MODES[mode].unit) || '';
