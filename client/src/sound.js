// צלילים מסונתזים עם Web Audio - בלי קבצים. דפדפנים חוסמים צליל עד הלחיצה הראשונה בדף
let ctx = null;

function audio() {
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
