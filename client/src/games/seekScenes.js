// סצנות אקראיות לצבע ומחבואים. אותו seed = אותה תמונה אצל כולם (בלי לשלוח תמונה דרך השרת)
export const SCENE_W = 1200;
export const SCENE_H = 900;

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateScene(seed) {
  const c = document.createElement('canvas');
  c.width = SCENE_W;
  c.height = SCENE_H;
  const ctx = c.getContext('2d');
  const r = rng(seed);
  const R = (a, b) => a + r() * (b - a);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const hsl = (h, s, l) => `hsl(${h % 360},${s}%,${l}%)`;
  const scenes = [garden, city, confetti, shelf];
  scenes[Math.floor(r() * scenes.length)](ctx, { r, R, pick, hsl });
  return c;
}

function circle(ctx, x, y, rad, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}

function garden(ctx, { R, hsl }) {
  const sky = ctx.createLinearGradient(0, 0, 0, SCENE_H * 0.6);
  sky.addColorStop(0, hsl(R(195, 215), 80, 62));
  sky.addColorStop(1, hsl(R(185, 200), 70, 85));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  circle(ctx, R(100, 1100), R(70, 160), R(45, 70), '#ffe066');
  for (let i = 0; i < 5; i++) {
    const cx = R(0, SCENE_W);
    const cy = R(60, 260);
    for (let j = 0; j < 5; j++) circle(ctx, cx + R(-70, 70), cy + R(-15, 15), R(25, 45), 'rgba(255,255,255,0.9)');
  }
  // גבעות בכמה שכבות
  for (let layer = 0; layer < 4; layer++) {
    const base = SCENE_H * (0.45 + layer * 0.13);
    const amp = R(20, 60);
    const freq = R(0.004, 0.01);
    const ph = R(0, 6);
    ctx.fillStyle = hsl(R(85, 140), R(40, 70), 45 - layer * 7);
    ctx.beginPath();
    ctx.moveTo(0, SCENE_H);
    for (let x = 0; x <= SCENE_W; x += 20) ctx.lineTo(x, base + Math.sin(x * freq + ph) * amp);
    ctx.lineTo(SCENE_W, SCENE_H);
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const x = R(0, SCENE_W);
    const y = R(SCENE_H * 0.45, SCENE_H * 0.85);
    const s = R(0.6, 1.4);
    ctx.fillStyle = hsl(R(20, 35), 45, 28);
    ctx.fillRect(x - 10 * s, y - 20 * s, 20 * s, 110 * s);
    for (let j = 0; j < 7; j++) circle(ctx, x + R(-50, 50) * s, y - R(20, 110) * s, R(30, 50) * s, hsl(R(90, 150), R(45, 70), R(25, 42)));
  }
  for (let i = 0; i < 1400; i++) {
    const x = R(0, SCENE_W);
    const y = R(SCENE_H * 0.55, SCENE_H);
    ctx.strokeStyle = hsl(R(80, 140), R(40, 80), R(20, 50));
    ctx.lineWidth = R(1, 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + R(-8, 8), y - R(8, 26));
    ctx.stroke();
  }
  for (let i = 0; i < 160; i++) {
    const x = R(0, SCENE_W);
    const y = R(SCENE_H * 0.6, SCENE_H);
    const color = hsl(R(0, 360), 85, R(55, 70));
    for (let p = 0; p < 5; p++) circle(ctx, x + Math.cos(p * 1.26) * 6, y + Math.sin(p * 1.26) * 6, 5, color);
    circle(ctx, x, y, 4, '#ffd23f');
  }
}

function city(ctx, { R, pick, hsl }) {
  const sky = ctx.createLinearGradient(0, 0, 0, SCENE_H);
  const h = R(0, 360);
  sky.addColorStop(0, hsl(h + 220, 60, 30));
  sky.addColorStop(0.6, hsl(h + 330, 70, 60));
  sky.addColorStop(1, hsl(h + 30, 90, 70));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  for (let row = 0; row < 2; row++) {
    let x = R(-40, 0);
    while (x < SCENE_W) {
      const w = R(70, 170);
      const top = R(row ? 260 : 120, row ? 560 : 420);
      const color = hsl(R(0, 360), R(15, 55), row ? R(30, 55) : R(18, 32));
      ctx.fillStyle = color;
      ctx.fillRect(x, top, w, SCENE_H - top);
      const lit = pick(['#ffe8a3', '#ffd23f', '#bde0fe', '#fff']);
      for (let wy = top + 15; wy < SCENE_H - 140; wy += 28) {
        for (let wx = x + 10; wx < x + w - 18; wx += 22) {
          ctx.fillStyle = R(0, 1) < 0.55 ? lit : 'rgba(0,0,0,0.35)';
          ctx.fillRect(wx, wy, 12, 16);
        }
      }
      x += w + R(0, 12);
    }
  }
  ctx.fillStyle = '#3d3d46';
  ctx.fillRect(0, SCENE_H - 120, SCENE_W, 120);
  ctx.fillStyle = '#f1f1f1';
  for (let x = 0; x < SCENE_W; x += 90) ctx.fillRect(x, SCENE_H - 65, 50, 8);
  for (let i = 0; i < 7; i++) {
    const x = R(0, SCENE_W - 120);
    ctx.fillStyle = hsl(R(0, 360), 75, 50);
    ctx.fillRect(x, SCENE_H - 110, 110, 34);
    ctx.fillRect(x + 20, SCENE_H - 135, 65, 28);
    circle(ctx, x + 25, SCENE_H - 74, 12, '#111');
    circle(ctx, x + 85, SCENE_H - 74, 12, '#111');
  }
}

function confetti(ctx, { R, pick, hsl }) {
  const base = R(0, 360);
  const palette = Array.from({ length: 6 }, (_, i) => hsl(base + i * R(30, 70), R(60, 90), R(45, 70)));
  ctx.fillStyle = hsl(base + 180, 40, 92);
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  for (let i = 0; i < 650; i++) {
    const x = R(-30, SCENE_W + 30);
    const y = R(-30, SCENE_H + 30);
    const s = R(10, 60);
    ctx.fillStyle = pick(palette);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(R(0, Math.PI));
    const kind = Math.floor(R(0, 3));
    if (kind === 0) circle(ctx, 0, 0, s / 2, ctx.fillStyle);
    else if (kind === 1) ctx.fillRect(-s / 2, -s / 4, s, s / 2);
    else {
      ctx.beginPath();
      ctx.moveTo(0, -s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function shelf(ctx, { R, hsl }) {
  ctx.fillStyle = hsl(R(0, 360), 30, 80);
  ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  const wood = hsl(R(20, 35), 45, 32);
  for (let top = 30; top < SCENE_H; top += 210) {
    let x = 20;
    while (x < SCENE_W - 20) {
      const w = R(18, 46);
      const h = R(110, 175);
      if (R(0, 1) < 0.08) {
        // עציץ
        ctx.fillStyle = hsl(R(10, 30), 55, 45);
        ctx.fillRect(x, top + 180 - 50, 60, 50);
        for (let j = 0; j < 8; j++) circle(ctx, x + 30 + R(-30, 30), top + 120 - R(0, 50), R(12, 22), hsl(R(90, 150), 55, R(25, 45)));
        x += 70;
        continue;
      }
      ctx.fillStyle = hsl(R(0, 360), R(35, 80), R(30, 65));
      ctx.fillRect(x, top + 180 - h, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 3, top + 180 - h + 15, w - 6, 5);
      ctx.fillRect(x + 3, top + 180 - 25, w - 6, 5);
      x += w + R(0, 4);
    }
    ctx.fillStyle = wood;
    ctx.fillRect(0, top + 180, SCENE_W, 26);
  }
}
