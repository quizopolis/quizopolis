/* Μικροί ήχοι με το Web Audio (χωρίς αρχεία). Σβήνουν με το κουμπί του ηχείου. */
import { local } from '../ui.js';

let ac = null;
let muted = !!local.get('qz:mute', false);
function ctx() {
  if (muted) return null;
  try {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch (e) { return null; }
}
function tone(freq, dur, { type = 'sine', vol = 0.12, at = 0, to = null } = {}) {
  const c = ctx();
  if (!c) return;
  try {
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch (e) { /* ignore */ }
}
function noise(dur, { vol = 0.1, at = 0, freq = 1200, q = 0.8 } = {}) {
  const c = ctx();
  if (!c) return;
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime + at;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  } catch (e) { /* ignore */ }
}
export const sfx = {
  ok() { tone(660, 0.12); tone(990, 0.22, { at: 0.1 }); },
  bad() { tone(240, 0.3, { type: 'square', vol: 0.05, to: 140 }); },
  tick() { tone(1250, 0.04, { vol: 0.04 }); },
  click() { tone(520, 0.05, { vol: 0.05 }); },
  pop() { tone(900, 0.08, { to: 420, vol: 0.1 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.24, { at: i * 0.12, type: 'triangle', vol: 0.12 })); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.32, { at: i * 0.2, type: 'triangle', vol: 0.1 })); },
  whoosh() { noise(0.35, { vol: 0.1, freq: 700 }); },
  kick() { noise(0.1, { vol: 0.3, freq: 180, q: 1.2 }); tone(90, 0.12, { vol: 0.12, to: 50 }); },
  cheer() { noise(1.4, { vol: 0.09, freq: 1600, q: 0.5 }); noise(1.1, { vol: 0.06, freq: 900, q: 0.6, at: 0.15 }); },
  splash() { noise(0.45, { vol: 0.12, freq: 2400, q: 0.4 }); },
  bang() { noise(0.14, { vol: 0.3, freq: 3000, q: 0.6 }); tone(140, 0.12, { type: 'square', vol: 0.06, to: 60 }); },
  dice() { for (let i = 0; i < 6; i++) tone(280 + Math.random() * 260, 0.03, { at: i * 0.07, type: 'square', vol: 0.03 }); },
  unlock() { tone(1300, 0.05, { vol: 0.08 }); tone(1750, 0.09, { at: 0.07, vol: 0.08 }); },
  drum() { for (let i = 0; i < 10; i++) tone(110 + (i % 2) * 20, 0.05, { at: i * 0.11, type: 'triangle', vol: 0.06 }); },
  whistle() { tone(2100, 0.35, { vol: 0.06, type: 'sine' }); tone(2300, 0.25, { vol: 0.05, at: 0.36 }); }
};
export const isMuted = () => muted;
export function setMuted(v) { muted = !!v; local.set('qz:mute', muted); }
