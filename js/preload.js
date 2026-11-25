/*
  Ξεκινά αμέσως τη λήψη όσων αρχείων θα χρειαστεί η σελίδα, ώστε να κατεβαίνουν όλα μαζί
  και όχι το ένα μετά το άλλο. Τα παιδιά (σύνδεσμος παιχνιδιού) παίρνουν μόνο τα δικά τους.
  Starts downloading the files the page will need right away, so they arrive together
  instead of one after another. Children (game links) get only their own files.
*/
(function () {
  var cfg = window.QUIZOPOLIS_CONFIG || window.LUDUS_CONFIG || window.ALANA_CONFIG || {};
  var fb = cfg.firebase && cfg.firebase.apiKey;
  var hash = location.hash || '';
  var kid = /^#\/(g|play|board)\//.test(hash);
  var teacher = /^#\/t(\/|$)/.test(hash);
  // Ίδια έκδοση με το js/db-firebase.js / Same version as js/db-firebase.js
  var SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
  var files = ['js/main.js', 'js/ui.js', 'js/i18n.js', 'js/lang-en.js', 'js/store.js', 'js/modes.js', 'js/gicons.js', 'js/rules.js'];
  if (kid) files.push('js/play.js', 'js/qtypes.js', 'js/scoring.js');
  if (teacher) files.push('js/views.js');
  if (fb) files.push('js/db-firebase.js', SDK + 'firebase-app.js', SDK + 'firebase-auth.js', SDK + 'firebase-firestore.js');
  for (var i = 0; i < files.length; i++) {
    var l = document.createElement('link');
    l.rel = 'modulepreload';
    l.href = files[i];
    document.head.appendChild(l);
  }
})();
