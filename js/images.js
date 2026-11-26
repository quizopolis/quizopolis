/*
  Εικόνες: σμίκρυνση και συμπίεση μέσα στον browser, ώστε τα παιχνίδια να ανοίγουν γρήγορα στα κινητά των παιδιών.
  Οι εικόνες αποθηκεύονται μέσα στο παιχνίδι (JPEG), γιατί η δωρεάν βάση δεν έχει χώρο αρχείων.
  Images: resizing and compression in the browser, so games open quickly on children's phones.
  Images are stored inside the game (JPEG), because the free database has no file storage.
*/
import { __ } from './i18n.js';

// Όρια σε χαρακτήρες της εικόνας ως κείμενο (data URL). / Limits in characters of the image as text (data URL).
export const PHOTO = { dim: 900, bytes: 100000 }; // εικόνα ερώτησης / question picture
export const BIG = { dim: 1200, bytes: 200000 }; // «Λέξεις στην εικόνα»: χρειάζεται λεπτομέρεια / "Label the picture": needs detail
// Κάρτες μελέτης: μικρότερες, γιατί μια τράπουλα έχει εικόνες και στις δύο όψεις και όλη χωράει σε ένα έγγραφο
// (περίπου 20 φωτογραφίες, περισσότερες αν είναι ζωγραφιές). Όταν ο χώρος τελειώνει, οι νέες συμπιέζονται περισσότερο.
// Flashcards: smaller, because a deck has pictures on both sides and all of it fits in one document
// (about 20 photos, more if they are drawings). When space runs low, new ones are compressed further.
export const CARD = { dim: 640, bytes: 42000 };
export const CARD_MIN = 14000;

function encode(img, maxDim, maxBytes) {
  const draw = (dim) => {
    const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    // Η καλύτερη ποιότητα που χωράει στο όριο. / The best quality that fits the limit.
    for (let q = 0.84; q >= 0.4; q -= 0.08) {
      const out = cv.toDataURL('image/jpeg', q);
      if (out.length <= maxBytes) return out;
    }
    return null;
  };
  let dim = maxDim, out = null;
  while (!out && dim >= 240) { out = draw(dim); dim = Math.round(dim * 0.8); }
  return out;
}

const load = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(__('Η εικόνα δεν άνοιξε. Δοκίμασε άλλο αρχείο.')));
  img.src = src;
});

/* Από αρχείο του υπολογιστή. / From a file on the computer. */
export async function readImage(file, maxDim = PHOTO.dim, maxBytes = PHOTO.bytes) {
  if (!file || !/^image\//.test(file.type)) throw new Error(__('Διάλεξε αρχείο εικόνας (JPG, PNG, GIF ή WebP).'));
  const url = URL.createObjectURL(file);
  try {
    const out = encode(await load(url), maxDim, maxBytes);
    if (!out) throw new Error(__('Η εικόνα είναι πολύ μεγάλη. Δοκίμασε μικρότερη.'));
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Μια εικόνα που ήδη υπάρχει, μόνο αν ξεπερνά το όριο. Σε σφάλμα μένει όπως ήταν.
   An existing picture, only if it is over the limit. On error it stays as it was. */
export async function slimImage(src, maxDim, maxBytes) {
  if (typeof src !== 'string' || !/^data:image\//.test(src) || src.length <= maxBytes * 1.1) return src;
  try {
    const out = encode(await load(src), maxDim, maxBytes);
    return out && out.length < src.length ? out : src;
  } catch (e) {
    return src;
  }
}

/* Οι ερωτήσεις ενός συνδέσμου με ελαφρύτερες εικόνες. Το ίδιο το παιχνίδι κρατά τις αρχικές.
   A link's questions with lighter pictures. The game itself keeps the originals. */
export async function slimQuestions(questions, isBig) {
  return Promise.all((questions || []).map(async (q) => {
    if (!q) return q;
    const backImg = q.back && typeof q.back === 'object' ? q.back.image : '';
    if (!q.image && !backImg) return q;
    const lim = q.type === 'card' ? CARD : isBig && isBig(q) ? BIG : PHOTO;
    const image = q.image ? await slimImage(q.image, lim.dim, lim.bytes) : q.image;
    const back = backImg ? await slimImage(backImg, lim.dim, lim.bytes) : backImg;
    if (image === q.image && back === backImg) return q;
    const out = Object.assign({}, q, { image });
    if (back !== backImg) out.back = Object.assign({}, q.back, { image: back });
    return out;
  }));
}
