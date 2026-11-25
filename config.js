/*
  Ρυθμίσεις της πλατφόρμας: το μόνο αρχείο που χρειάζεται να αλλάξεις.
  Platform settings: the only file you need to change.

  1. siteName: το όνομα που βλέπουν όλοι. / The name everyone sees.
  2. lang: η γλώσσα για όποιον ανοίγει πρώτη φορά τη σελίδα, 'el' (ελληνικά) ή 'en' (αγγλικά).
     Ο καθένας μπορεί να την αλλάξει με το κουμπί ΕΛ / EN.
     The language for first-time visitors, 'el' (Greek) or 'en' (English). Anyone can switch with the ΕΛ / EN button.
  3. firebase: τα στοιχεία του δωρεάν έργου σου στο Firebase.
     Τα βρίσκεις στο Firebase: ⚙ Project settings → General → «Your apps» → SDK setup and configuration → Config.
     Αντέγραψε μόνο το κομμάτι από το { μέχρι το } και βάλ' το στη θέση του null.
     Your free Firebase project details: copy the part from { to } and put it in place of null.

  Όσο το firebase μένει null, η πλατφόρμα ανοίγει σε «δοκιμαστική λειτουργία»:
  όλα δουλεύουν, αλλά αποθηκεύονται μόνο στον browser αυτής της συσκευής.
  While firebase is null, the platform runs in demo mode: everything works but is saved only in this browser.
*/
window.QUIZOPOLIS_CONFIG = {
  siteName: 'Quizopolis',
  lang: 'el',
  firebase: {
    apiKey: "AIzaSyCFzgNP_1J1Go4KUIlyQoxVbtVrKebf8vs",
    authDomain: "quizopolis-2d373.firebaseapp.com",
    projectId: "quizopolis-2d373",
    storageBucket: "quizopolis-2d373.firebasestorage.app",
    messagingSenderId: "887516851153",
    appId: "1:887516851153:web:c7ed71bd3851d8ed800ef0"
  }
};

  /* Παράδειγμα / Example:
  firebase: {
    apiKey: "AIza...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  }
  */
};
