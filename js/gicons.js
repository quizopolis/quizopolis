/* Ένα εικονίδιο για κάθε παιχνίδι: λευκό σχέδιο πάνω στο χρώμα του παιχνιδιού.
   Τα παιχνίδια του προβολέα έχουν σκούρο μπλε φόντο. Με { soft: true } το σχέδιο παίρνει το χρώμα και το φόντο γίνεται απαλό.
   One icon per game: a white glyph on the game's colour. Projector games use a dark navy background. */

const CHECKER = (() => {
  let s = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) s += `<rect x="${14 + c * 4}" y="${10 + r * 4}" width="4" height="4" fill="{c}"/>`;
  return s;
})();
const JEOPARDY = (() => {
  let s = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += `<rect x="${9 + c * 10.5}" y="${9 + r * 10.5}" width="8.5" height="8.5" rx="2.2" fill="#fff" opacity="${r === 1 && c === 2 ? 1 : 0.5}"/>`;
  return s;
})();
const WAVE = (y, o) => `<path d="M6 ${y}c3.6 0 3.6-3.2 7.2-3.2s3.6 3.2 7.2 3.2 3.6-3.2 7.2-3.2 3.6 3.2 7.2 3.2 3.6-3.2 7.2-3.2" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" opacity="${o}"/>`;
const TICK = (y) => `<path d="M16.5 ${y}l2.6 2.6 4.6-5" stroke="{c}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const GLYPH = {
  classic: '<rect x="10" y="10" width="12" height="12" rx="3.5" fill="#fff"/><rect x="26" y="10" width="12" height="12" rx="3.5" fill="#fff" opacity=".5"/><rect x="10" y="26" width="12" height="12" rx="3.5" fill="#fff" opacity=".5"/><rect x="26" y="26" width="12" height="12" rx="3.5" fill="#fff" opacity=".5"/>',
  team: '<circle cx="14.5" cy="19" r="4.2" fill="#fff" opacity=".55"/><circle cx="33.5" cy="19" r="4.2" fill="#fff" opacity=".55"/><path d="M6 36c0-5.2 3.8-8.6 8.5-8.6s8.5 3.4 8.5 8.6z" fill="#fff" opacity=".55"/><path d="M25 36c0-5.2 3.8-8.6 8.5-8.6S42 30.8 42 36z" fill="#fff" opacity=".55"/><circle cx="24" cy="16.5" r="5.6" fill="#fff"/><path d="M13.5 38c0-6.4 4.7-10.6 10.5-10.6S34.5 31.6 34.5 38z" fill="#fff"/>',
  mastery: '<path d="M5 38 L19 17 L26.5 27.5 L31 21.5 L43 38 Z" fill="#fff"/><path d="M19 17 V7.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M19.2 7.6 H28.5 L26 10.6 L28.5 13.6 H19.2 Z" fill="#fff" opacity=".7"/>',
  test: '<rect x="11" y="8" width="26" height="33" rx="5" fill="#fff"/>' + TICK(18.5) + TICK(29.5) + '<rect x="26.5" y="17" width="6" height="2.6" rx="1.3" fill="{c}" opacity=".45"/><rect x="26.5" y="28" width="6" height="2.6" rx="1.3" fill="{c}" opacity=".45"/>',
  flashcards: '<rect x="7" y="13" width="22" height="27" rx="4.5" fill="#fff" opacity=".5" transform="rotate(-12 18 26.5)"/><rect x="17" y="9" width="23" height="28" rx="4.5" fill="#fff"/><path d="M25.2 18.6a3.4 3.4 0 1 1 4.6 3.2c-1 .5-1.4 1.1-1.4 2.2" stroke="{c}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="28.4" cy="28.4" r="1.6" fill="{c}"/>',
  millionaire: '<path d="M14.5 11 H33.5 L41 20 L24 39.5 L7 20 Z" fill="#fff"/><path d="M7 20 H41 M19.5 20 L24 11 L28.5 20 M19.5 20 L24 39.5 L28.5 20" stroke="{c}" stroke-width="1.5" fill="none" opacity=".35" stroke-linejoin="round"/>',
  jeopardy: JEOPARDY,
  show: '<rect x="18" y="6.5" width="12" height="20.5" rx="6" fill="#fff"/><path d="M12.5 22a11.5 11.5 0 0 0 23 0" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M24 33.5v6M17.5 40.5h13" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>',
  race: '<path d="M12.5 8 V41" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><rect x="14" y="10" width="24" height="16" rx="1.5" fill="#fff"/>' + CHECKER,
  swim: '<circle cx="31" cy="11.5" r="3.8" fill="#fff"/>' + WAVE(21, 1) + WAVE(30, 0.6) + WAVE(39, 0.35),
  shooting: '<circle cx="24" cy="24" r="16" fill="#fff"/><circle cx="24" cy="24" r="11" fill="{c}" opacity=".85"/><circle cx="24" cy="24" r="6.5" fill="#fff"/><circle cx="24" cy="24" r="2.6" fill="{c}"/>',
  penalty: '<circle cx="24" cy="24" r="16" fill="#fff"/><path d="M24 17.2l6.4 4.6-2.4 7.5h-8l-2.4-7.5z" fill="{c}"/><path d="M24 17.2V9.2M30.4 21.8l7.6-2.6M28 29.3l4.6 6.6M20 29.3l-4.6 6.6M17.6 21.8l-7.6-2.6" stroke="{c}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>',
  escape: '<circle cx="16.5" cy="24" r="8.2" fill="none" stroke="#fff" stroke-width="4.2"/><path d="M24.5 24H41.5M35 24v6.5M40.2 24v5" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>',
  snakes: '<rect x="9" y="9" width="30" height="30" rx="8" fill="#fff"/><circle cx="17" cy="17" r="3" fill="{c}"/><circle cx="31" cy="17" r="3" fill="{c}"/><circle cx="24" cy="24" r="3" fill="{c}"/><circle cx="17" cy="31" r="3" fill="{c}"/><circle cx="31" cy="31" r="3" fill="{c}"/>',
  picture: '<rect x="7" y="9" width="34" height="30" rx="5" fill="#fff"/><circle cx="16" cy="18" r="3.4" fill="{c}" opacity=".55"/><path d="M7 34 L17.5 25 L24.5 31 L30 26.5 L41 35 V34 a5 5 0 0 1-5 5 H12 a5 5 0 0 1-5-5z" fill="{c}" opacity=".55"/><rect x="24" y="9" width="17" height="15" fill="{c}" opacity=".9"/><path d="M24 9 V39 M7 24 H41" stroke="{c}" stroke-width="1.2" opacity=".35"/>',
  free: '<rect x="9" y="9" width="30" height="30" rx="8" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/><path d="M19.6 19.6a4.6 4.6 0 1 1 6.3 4.3c-1.3.6-1.9 1.4-1.9 2.9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="24" cy="31.6" r="2" fill="#fff"/>'
};

export const GAME_COLOR = {
  classic: '#0F8A5F', team: '#2E86DE', mastery: '#0E9488', test: '#5C6B82', flashcards: '#E8A20E',
  millionaire: '#4338CA', jeopardy: '#1F5BD6', show: '#C0398F', race: '#EE6A2C', swim: '#0EA5C6',
  shooting: '#DC3F4A', penalty: '#4FA12E', escape: '#8B4FD8', snakes: '#D98A1A', picture: '#E05293', free: '#8A94A3'
};
export const STAGE_BG = '#1B2350';

/* Ανάμειξη με λευκό: p = πόσο από το χρώμα μένει (0..1). */
export function tint(hex, p) {
  const h = String(hex || '#888888').replace('#', '');
  const v = (i) => parseInt(h.slice(i, i + 2), 16);
  const f = (x) => Math.round(x * p + 255 * (1 - p)).toString(16).padStart(2, '0');
  return `#${f(v(0))}${f(v(2))}${f(v(4))}`;
}

/* id: τρόπος (π.χ. 'penalty'), 'stage-millionaire', ή '' για «χωρίς παιχνίδι».
   o: { size (px), soft, cls, label } */
export function gameIcon(id, o = {}) {
  const raw = String(id || '');
  const stage = /^stage-/.test(raw);
  const base = stage ? raw.slice(6) : raw;
  const key = GLYPH[base] ? base : 'free';
  const color = GAME_COLOR[key];
  const size = o.size || 44;
  const bg = o.soft ? tint(color, 0.13) : stage ? STAGE_BG : color;
  let svg = GLYPH[key].replace(/\{c\}/g, bg);
  if (o.soft) svg = svg.replace(/#fff/g, color);
  const r = Math.round(size * 0.28);
  const a11y = o.label ? `role="img" aria-label="${String(o.label).replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<span class="gi${o.cls ? ' ' + o.cls : ''}" style="width:${size}px;height:${size}px;border-radius:${r}px;background:${bg}" ${a11y}><svg viewBox="0 0 48 48" focusable="false">${svg}</svg></span>`;
}

/* Απαλό πλακίδιο που γεμίζει το κελί του (για την αρχική σελίδα). */
export function softTile(id, style = '') {
  const key = GLYPH[id] ? id : 'free';
  const color = GAME_COLOR[key];
  const bg = tint(color, 0.13);
  const svg = GLYPH[key].replace(/\{c\}/g, bg).replace(/#fff/g, color);
  return `<span class="st" style="background:${bg};${style}" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false">${svg}</svg></span>`;
}
