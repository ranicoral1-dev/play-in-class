// צלילים מסונתזים עם Web Audio - בלי קבצים. דפדפנים חוסמים צליל עד הלחיצה הראשונה בדף
let ctx = null;

let muted = (() => {
  try {
    return localStorage.getItem('muted') === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;

export function setMuted(v) {
  muted = v;
  try {
    localStorage.setItem('muted', v ? '1' : '0');
  } catch {
    /* לא קריטי */
  }
}

function audio() {
  if (muted) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => audio();
  addEventListener('pointerdown', unlock, { once: true });
  addEventListener('keydown', unlock, { once: true });
}

let noiseBuf = null;
function noise(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

// צפצוף של ספירה לאחור
export function beep(freq = 660, dur = 0.18, vol = 0.25) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function hit(a, t, vol) {
  const src = noise(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.8;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t, Math.random() * 0.5, 0.1);
}

// תיפוף מסנר שהולך ומתחזק, ואז מצילה
export function drumRoll(sec = 2.6) {
  const a = audio();
  if (!a) return;
  const start = a.currentTime + 0.05;
  let t = start;
  while (t < start + sec) {
    const p = (t - start) / sec;
    hit(a, t, 0.08 + p * 0.3);
    t += 0.075 - p * 0.03;
  }
  crash(start + sec);
}

function crash(t) {
  const a = audio();
  if (!a) return;
  const src = noise(a);
  const filter = a.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 5000;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t, 0, 1.5);
  // מכה עמוקה מתחת למצילה
  const osc = a.createOscillator();
  const g2 = a.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.4);
  g2.gain.setValueAtTime(0.6, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(g2).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.5);
}

// ---------- צלילי ממשק ----------

// טון קצר שגולש מתדר לתדר
function tone(freq, to, dur, vol, type = 'sine', delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// רעש קצר מסונן - הבסיס של קליק והקלדה
function tick(freq, dur, vol) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const src = noise(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.5;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

export function click() {
  tick(2500, 0.03, 0.25);
  tone(900, 500, 0.05, 0.08, 'triangle');
}

// הקלדה: כל מקש בגובה קצת אחר, כמו מקלדת אמיתית
export function keyTap(kind = 'key') {
  if (kind === 'enter') {
    tick(1200, 0.05, 0.22);
    tone(500, 300, 0.06, 0.06, 'triangle');
  } else if (kind === 'back') {
    tick(1600, 0.03, 0.12);
  } else {
    tick(2800 + Math.random() * 1600, 0.025, 0.12);
  }
}

// הודעה חדשה בצ'אט
export function pop() {
  tone(450, 900, 0.09, 0.15);
}

// תייגו אותי
export function ding() {
  tone(880, 880, 0.15, 0.15, 'triangle');
  tone(1320, 1320, 0.25, 0.12, 'triangle', 0.1);
}

export function success() {
  tone(660, 660, 0.12, 0.18, 'triangle');
  tone(880, 880, 0.12, 0.18, 'triangle', 0.09);
  tone(1320, 1320, 0.25, 0.16, 'triangle', 0.18);
}

export function fail() {
  tone(330, 220, 0.18, 0.18, 'sawtooth');
  tone(220, 140, 0.3, 0.16, 'sawtooth', 0.15);
}

// קליק על כל כפתור וצליל הקלדה בכל שדה - בלי לגעת בכל רכיב בנפרד
export function installUiSounds() {
  if (typeof window === 'undefined' || window.__uiSounds) return;
  window.__uiSounds = true;
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.target.closest?.('button:not(:disabled), a[href], summary, [role="button"]')) click();
    },
    true,
  );
  addEventListener(
    'keydown',
    (e) => {
      if (!e.target.matches?.('input, textarea') || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter') keyTap('enter');
      else if (e.key === 'Backspace' || e.key === 'Delete') keyTap('back');
      else if (e.key.length === 1) keyTap();
    },
    true,
  );
}
