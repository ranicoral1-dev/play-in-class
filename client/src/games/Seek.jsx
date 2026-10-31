import { memo, useEffect, useRef, useState } from 'react';
import { emit, socket, serverUrl } from '../socket.js';
import { success, fail, pop } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints } from '../components/ui.jsx';
import { generateScene } from './seekScenes.js';

// צורת בן האדם - חייב להיות זהה לשרת (server/games/seek.js)
const BODY = [
  '...####...',
  '..######..',
  '..######..',
  '..######..',
  '...####...',
  '....##....',
  '##########',
  '##########',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '..######..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '.###..###.',
];
const COLS = 10;
const ROWS = 20;
// מספר המשבצת בעור לכל משבצת גוף, או -1
const CELL = [];
let CELLS = 0;
for (let r = 0; r < ROWS; r++) {
  CELL.push([]);
  for (let c = 0; c < COLS; c++) CELL[r].push(BODY[r][c] === '#' ? CELLS++ : -1);
}
const inBody = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && CELL[r][c] >= 0;
const splitSkin = (s) => (s ? s.match(/.{6}/g) : Array(CELLS).fill('888888'));

const SPEED = 0.3; // גבהי תמונה בשנייה
const SLOW = 0.07; // עם Shift - לכיוון מדויק
const KEYS = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const PALETTE = ['#000000', '#ffffff', '#7f7f7f', '#e63946', '#ff8a00', '#ffd23f', '#2a9d3c', '#2ec4b6', '#3a86ff', '#7b2ff7', '#ff5d8f', '#8b5a2b'];

export default function Seek({ g }) {
  const img = useBoardImage(g);
  const phaseName = { choose: 'בחירת תמונה', hide: 'מתחבאים', seek: 'מחפשים!', results: 'תוצאות' }[g.phase];
  return (
    <div className="card">
      <GameHeader title="🦎 צבע ומחבואים" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip">{phaseName}</span>
      </GameHeader>
      <RoleBanner g={g} />
      {g.phase === 'choose' && <ChoosePhase g={g} key={g.round} />}
      {g.phase === 'hide' && <HidePhase g={g} img={img} key={g.round} />}
      {g.phase === 'seek' && <SeekPhase g={g} img={img} />}
      {g.phase === 'results' && <ResultsPhase g={g} img={img} />}
    </div>
  );
}

function RoleBanner({ g }) {
  const { state } = useRoom();
  const seeker = g.seekers.includes(state.me);
  const hider = g.hiders.includes(state.me);
  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-3xl p-3 text-white ${
        seeker ? 'bg-gradient-to-l from-rose-500 to-orange-500' : hider ? 'bg-gradient-to-l from-emerald-500 to-teal-600' : 'bg-slate-500'
      }`}
    >
      <span className="text-3xl">{seeker ? '🔍' : hider ? '🦎' : '🍿'}</span>
      <span className="font-display text-xl">{seeker ? 'אתם מחפשים!' : hider ? 'אתם מתחבאים!' : 'הסיבוב הזה אתם צופים'}</span>
      <span className="flex flex-wrap items-center gap-1 text-sm font-bold text-white/90">
        {g.seekers.length > 1 ? 'המחפשים:' : 'המחפש:'}
        {g.seekers.map((id) => (
          <span key={id} className="rounded-full bg-white/90 px-1.5 text-ink">
            <PlayerTag id={id} size="sm" />
          </span>
        ))}
      </span>
    </div>
  );
}

// ---------- התמונה: מהשרת או סצנה אקראית לפי seed, עם דגימת צבעים ----------
function useBoardImage(g) {
  const key = g.image || (g.seed != null ? `seed:${g.seed}` : null);
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (!key) return;
    let dead = false;
    const done = (canvas, src) => !dead && setRes(makeImage(key, canvas, src));
    if (g.image) {
      const src = serverUrl(g.image);
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * scale));
        c.height = Math.max(1, Math.round(im.naturalHeight * scale));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        done(c, src);
      };
      im.onerror = () => done(null, src);
      im.src = src;
    } else {
      const c = generateScene(g.seed);
      done(c, c.toDataURL('image/jpeg', 0.9));
    }
    return () => {
      dead = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return res && res.key === key ? res : null;
}

function makeImage(key, canvas, src) {
  let data = null;
  try {
    data = canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    // התמונה לא מאפשרת לקרוא צבעים - אפשר עדיין לצבוע מהפלטה
  }
  const W = canvas?.width || 1;
  const H = canvas?.height || 1;
  return {
    key,
    src,
    canvas,
    // הצבע הממוצע סביב נקודה (0-1) בתמונה
    sample(nx, ny) {
      if (!data) return null;
      const cx = Math.round(nx * W);
      const cy = Math.round(ny * H);
      let r = 0;
      let gr = 0;
      let b = 0;
      let n = 0;
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = (y * W + x) * 4;
          r += data[i];
          gr += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      if (!n) return null;
      return [r, gr, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
    },
  };
}

function bodyBox(g) {
  return { w: (g.size * (COLS / ROWS)) / g.aspect, h: g.size };
}

// ---------- הלוח ----------
function Board({ g, img, zoom = 1, onPoint, cursor, children }) {
  const ref = useRef();
  if (!img) return <Waiting emoji="🖼️">טוען את התמונה…</Waiting>;
  return (
    <div
      dir="ltr"
      className="mx-auto overflow-auto rounded-2xl bg-slate-900 shadow-inner"
      style={{ maxWidth: `min(100%, calc(62vh * ${g.aspect}))`, maxHeight: '62vh' }}
    >
      <div
        ref={ref}
        className="relative select-none overflow-hidden"
        style={{ width: `${zoom * 100}%`, aspectRatio: g.aspect, cursor, touchAction: zoom > 1 ? 'pan-x pan-y' : 'manipulation' }}
        onClick={(e) => {
          if (!onPoint) return;
          const r = ref.current.getBoundingClientRect();
          onPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
      >
        <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        {children}
      </div>
    </div>
  );
}

function ZoomBar({ zoom, setZoom, children }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-2xl bg-indigo-50 p-1">
        {[1, 2, 3].map((z) => (
          <button key={z} onClick={() => setZoom(z)} className={`rounded-xl px-3 py-1 font-display ${zoom === z ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
            🔍 x{z}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

// בן אדם אחד על הלוח: קנבס של 10x20 פיקסלים שמוגדל בלי טשטוש
const Sprite = memo(function Sprite({ skin, ghost, x, y, w, h, glow, z = 0 }) {
  const ref = useRef();
  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    const im = ctx.createImageData(COLS, ROWS);
    const colors = skin ? splitSkin(skin) : null;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = CELL[r][c];
        if (k < 0) continue;
        const i = (r * COLS + c) * 4;
        const hex = ghost || !colors ? 'ffffff' : colors[k];
        im.data[i] = parseInt(hex.slice(0, 2), 16);
        im.data[i + 1] = parseInt(hex.slice(2, 4), 16);
        im.data[i + 2] = parseInt(hex.slice(4, 6), 16);
        im.data[i + 3] = ghost ? 120 : 255;
      }
    }
    ctx.putImageData(im, 0, 0);
  }, [skin, ghost]);
  const glows = { red: '#ff2d55', green: '#22c55e', me: '#ffd23f' };
  return (
    <canvas
      ref={ref}
      width={COLS}
      height={ROWS}
      className="pointer-events-none absolute"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        imageRendering: 'pixelated',
        zIndex: 10 + z,
        filter: glow ? `drop-shadow(0 0 1px ${glows[glow]}) drop-shadow(0 0 1px ${glows[glow]}) drop-shadow(0 0 3px ${glows[glow]})` : undefined,
      }}
    />
  );
});

function Label({ id, x, y, w, children }) {
  const { state } = useRoom();
  const p = state.players.find((q) => q.id === id);
  return (
    <div
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/60 px-1.5 text-[11px] font-bold text-white"
      style={{ left: `${(x + w / 2) * 100}%`, top: `calc(${y * 100}% - 2px)` }}
    >
      {children ?? `${p?.emoji || ''} ${p?.name || ''}`}
    </div>
  );
}

// כל הגופים, מהגבוה לנמוך (מי שלמטה מצויר מעל)
function Bodies({ g, labels, glowFor, labelText }) {
  const { w, h } = bodyBox(g);
  const ids = Object.keys(g.bodies || {}).sort((a, b) => g.bodies[a].y - g.bodies[b].y);
  return ids.map((id, i) => {
    const b = g.bodies[id];
    return (
      <div key={id}>
        <Sprite skin={b.skin} x={b.x} y={b.y} w={w} h={h} glow={glowFor?.(id)} z={i} />
        {labels?.(id) && (
          <Label id={id} x={b.x} y={b.y} w={w}>
            {labelText?.(id)}
          </Label>
        )}
      </div>
    );
  });
}

// ---------- שלב 1: בחירת תמונה ----------
function ChoosePhase({ g }) {
  const { state } = useRoom();
  if (state.me === g.chooser) return <ImageMaker />;
  return (
    <Waiting emoji="🖌️">
      <span className="inline-flex items-center gap-1">
        <PlayerTag id={g.chooser} /> בוחר/ת תמונה להתחבא בה…
      </span>
    </Waiting>
  );
}

function ImageMaker() {
  const { state, receivedAt, showToast } = useRoom();
  const canvasRef = useRef();
  const fileRef = useRef();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [touched, setTouched] = useState(false); // ציירו או העלו - שולחים תמונה ולא seed
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#e63946');
  const [size, setSize] = useState(16);
  const [busy, setBusy] = useState(false);
  const [dims, setDims] = useState({ w: 1200, h: 900 });
  const undo = useRef([]);
  const drawing = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const scene = generateScene(seed);
    c.width = scene.width;
    c.height = scene.height;
    c.getContext('2d').drawImage(scene, 0, 0);
    setDims({ w: c.width, h: c.height });
  }, [seed]);

  function snapshot() {
    const c = canvasRef.current;
    undo.current.push({ data: c.getContext('2d').getImageData(0, 0, c.width, c.height), touched, w: c.width, h: c.height });
    if (undo.current.length > 8) undo.current.shift();
  }

  function restore() {
    const s = undo.current.pop();
    if (!s) return;
    const c = canvasRef.current;
    c.width = s.w;
    c.height = s.h;
    c.getContext('2d').putImageData(s.data, 0, 0);
    setDims({ w: s.w, h: s.h });
    setTouched(s.touched);
  }

  function point(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height];
  }

  function down(e) {
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    const [x, y] = point(e);
    snapshot();
    setTouched(true);
    if (tool === 'fill') return floodFill(c, Math.floor(x), Math.floor(y), color);
    c.setPointerCapture(e.pointerId);
    drawing.current = [x, y];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function move(e) {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const [x, y] = point(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...drawing.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawing.current = [x, y];
  }

  function upload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = canvasRef.current;
      snapshot();
      c.width = Math.round(im.naturalWidth * scale);
      c.height = Math.round(im.naturalHeight * scale);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setDims({ w: c.width, h: c.height });
      setTouched(true);
      URL.revokeObjectURL(url);
    };
    im.onerror = () => showToast('לא הצלחנו לפתוח את התמונה');
    im.src = url;
  }

  function blank() {
    const c = canvasRef.current;
    snapshot();
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    setDims({ w: 1200, h: 900 });
    setTouched(true);
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    const c = canvasRef.current;
    const data = touched ? { image: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height } : { seed };
    const res = await emit('game:action', { type: 'image', data }, 30000);
    setBusy(false);
    if (res.error) showToast(res.error);
  }

  // רגע לפני שהזמן נגמר - שולחים את מה שיש
  const sendRef = useRef(send);
  sendRef.current = send;
  const deadline = state.timeLeft != null ? receivedAt + state.timeLeft : null;
  useEffect(() => {
    if (!deadline) return;
    let sent = false;
    const t = setInterval(() => {
      if (!sent && deadline - Date.now() < 2500) {
        sent = true;
        sendRef.current();
      }
    }, 300);
    return () => clearInterval(t);
  }, [deadline]);

  return (
    <div className="animate-rise">
      <p className="mb-3 text-center font-display text-xl">בחרו או ציירו תמונה שבה כולם יתחבאו 🖼️</p>
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        <button className="btn-sky px-4 py-2 text-base" onClick={() => fileRef.current.click()}>
          📷 העלאת תמונה
        </button>
        <button
          className="btn-ghost px-4 py-2 text-base"
          onClick={() => {
            undo.current = [];
            setTouched(false);
            setSeed(Math.floor(Math.random() * 1e9));
          }}
        >
          🎲 סצנה אקראית
        </button>
        <button className="btn-ghost px-4 py-2 text-base" onClick={blank}>
          ⬜ דף לבן
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
        <div className="flex gap-1 rounded-2xl bg-indigo-50 p-1">
          {[
            ['brush', '🖌️ מכחול'],
            ['fill', '🪣 דלי'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => setTool(k)} className={`rounded-xl px-3 py-1 font-display ${tool === k ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-indigo-50 p-1">
          {[6, 16, 40, 90].map((s) => (
            <button key={s} onClick={() => setSize(s)} className={`flex h-8 w-8 items-center justify-center rounded-xl ${size === s ? 'bg-white shadow' : ''}`}>
              <span className="rounded-full bg-ink" style={{ width: Math.max(4, s / 4), height: Math.max(4, s / 4) }} />
            </button>
          ))}
        </div>
        <Swatches color={color} setColor={setColor} />
        <button className="rounded-xl bg-indigo-50 px-3 py-1.5 font-bold text-indigo-500" onClick={restore}>
          ↩️ ביטול
        </button>
      </div>
      <div dir="ltr" className="mx-auto" style={{ maxWidth: `min(100%, calc(58vh * ${dims.w / dims.h}))` }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-2xl shadow-lg"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = null)}
          onPointerCancel={() => (drawing.current = null)}
        />
      </div>
      <div className="mt-4 flex justify-center">
        <button className="btn-pink px-8 py-3 text-xl" disabled={busy} onClick={send}>
          {busy ? 'שולחים…' : '✅ זאת התמונה! שיתחבאו'}
        </button>
      </div>
    </div>
  );
}

function Swatches({ color, setColor, extra = [] }) {
  const colors = [...new Set([...extra, ...PALETTE])].slice(0, 20);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => setColor(c)}
          title={c}
          className={`h-7 w-7 rounded-full border-2 ${color === c ? 'scale-110 border-ink' : 'border-white shadow'}`}
          style={{ background: c }}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] shadow" title="צבע אחר">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0" />
      </label>
    </div>
  );
}

function floodFill(canvas, x0, y0, hex) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
  const im = ctx.getImageData(0, 0, W, H);
  const d = im.data;
  const fr = parseInt(hex.slice(1, 3), 16);
  const fg = parseInt(hex.slice(3, 5), 16);
  const fb = parseInt(hex.slice(5, 7), 16);
  const s = (y0 * W + x0) * 4;
  const [sr, sg, sb] = [d[s], d[s + 1], d[s + 2]];
  if (Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 6) return;
  const seen = new Uint8Array(W * H);
  const stack = [y0 * W + x0];
  const near = (i) => Math.abs(d[i * 4] - sr) + Math.abs(d[i * 4 + 1] - sg) + Math.abs(d[i * 4 + 2] - sb) < 60;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !near(p)) continue;
    seen[p] = 1;
    d[p * 4] = fr;
    d[p * 4 + 1] = fg;
    d[p * 4 + 2] = fb;
    d[p * 4 + 3] = 255;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * (H - 1)) stack.push(p + W);
  }
  ctx.putImageData(im, 0, 0);
}

// ---------- שלב 2: מתחבאים ----------
function HidePhase({ g, img }) {
  const { state } = useRoom();
  if (g.seekers.includes(state.me)) {
    return (
      <div className="text-center">
        <Waiting emoji="🙈">עיניים עצומות! כולם מתחבאים…</Waiting>
        <DoneRow ids={g.hiders} doneIds={g.readyIds} label="מי כבר מוכן" />
      </div>
    );
  }
  if (!g.bodies?.[state.me]) return <Waiting emoji="🍿">המתחבאים מתחבאים… תצטרפו בסיבוב הבא</Waiting>;
  return <Hider g={g} img={img} />;
}

function Hider({ g, img }) {
  const { state, act, showToast } = useRoom();
  const me = g.bodies[state.me];
  const [pos, setPos] = useState({ x: me.x, y: me.y });
  const [skin, setSkin] = useState(() => splitSkin(me.skin));
  const [color, setColor] = useState('#2a9d3c');
  const [recent, setRecent] = useState([]);
  const [brush, setBrush] = useState(1);
  const [peek, setPeek] = useState(false);
  const [zoom, setZoom] = useState(1);
  const keys = useRef(new Set());
  const posRef = useRef(pos);
  const { w, h } = bodyBox(g);
  const ready = g.readyIds.includes(state.me);

  // תנועה: WASD או חצים (גם במקלדת עברית - לפי מיקום המקש), Shift = לאט
  useEffect(() => {
    const ks = keys.current;
    let slow = false;
    const down = (e) => {
      slow = e.shiftKey;
      if (e.target.matches?.('input, textarea')) return;
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      ks.add(k);
    };
    const up = (e) => {
      slow = e.shiftKey;
      const k = KEYS[e.code];
      if (k) ks.delete(k);
    };
    const blur = () => ks.clear();
    let raf;
    let last = performance.now();
    let lastSent = 0;
    let dirty = false;
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (ks.size) {
        const v = slow ? SLOW : SPEED;
        let { x, y } = posRef.current;
        if (ks.has('u')) y -= v * dt;
        if (ks.has('d')) y += v * dt;
        if (ks.has('l')) x -= (v * dt) / g.aspect;
        if (ks.has('r')) x += (v * dt) / g.aspect;
        x = Math.max(0, Math.min(1 - w, x));
        y = Math.max(0, Math.min(1 - h, y));
        if (x !== posRef.current.x || y !== posRef.current.y) {
          posRef.current = { x, y };
          setPos(posRef.current);
          dirty = true;
        }
      }
      if (dirty && t - lastSent > 70) {
        socket.emit('game:action', { type: 'move', data: posRef.current });
        lastSent = t;
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('blur', blur);
    };
  }, [g.aspect, w, h]);

  // הצבעים נשלחים קצת אחרי שמפסיקים לצבוע
  const skinStr = skin.join('');
  useEffect(() => {
    const t = setTimeout(() => socket.emit('game:action', { type: 'paint', data: skinStr }), 200);
    return () => clearTimeout(t);
  }, [skinStr]);

  function pickColor(hex) {
    if (!hex) return showToast('אי אפשר לקחת צבע מהתמונה הזאת - בחרו מהפלטה');
    const c = `#${hex}`;
    setColor(c);
    setRecent((old) => [c, ...old.filter((x) => x !== c)].slice(0, 8));
  }

  function paint(c, r) {
    const hex = color.slice(1).toLowerCase();
    setSkin((old) => {
      const next = [...old];
      if (brush === 'all') return next.fill(hex);
      const rad = brush === 2 ? 1 : 0;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) if (inBody(c + dc, r + dr)) next[CELL[r + dr][c + dc]] = hex;
      return next;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <ZoomBar zoom={zoom} setZoom={setZoom}>
          <span className="text-sm font-bold text-indigo-400">לחיצה על התמונה = לקחת ממנה צבע 💧</span>
        </ZoomBar>
        <Board g={g} img={img} zoom={zoom} cursor="crosshair" onPoint={(x, y) => pickColor(img.sample(x, y))}>
          {Object.entries(g.bodies)
            .filter(([id]) => id !== state.me)
            .map(([id, b]) => (
              <div key={id}>
                <Sprite ghost x={b.x} y={b.y} w={w} h={h} />
                <Label id={id} x={b.x} y={b.y} w={w} />
              </div>
            ))}
          <Sprite skin={skinStr} x={pos.x} y={pos.y} w={w} h={h} glow={peek ? 'me' : undefined} z={100} />
          <div
            className="pointer-events-none absolute z-[200] -translate-x-1/2 -translate-y-full animate-bounce text-xl"
            style={{ left: `${(pos.x + w / 2) * 100}%`, top: `${pos.y * 100}%` }}
          >
            🔻
          </div>
        </Board>
        <p className="mt-2 text-center text-sm text-indigo-400">
          זזים עם <b dir="ltr">W A S D</b> או החצים (Shift = לאט). אחרים רואים רק איפה אתם - לא את הצבעים 🤫
        </p>
      </div>

      <div className="mx-auto w-full max-w-[340px] space-y-3">
        <SkinEditor g={g} img={img} pos={pos} skin={skin} peek={peek} onPaint={paint} onPick={(x, y) => pickColor(img?.sample(x, y))} />
        <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-indigo-50 p-1">
          {[
            [1, '• קטן'],
            [2, '⬤ גדול'],
            ['all', '🪣 הכל'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => setBrush(k)} className={`rounded-xl px-3 py-1 font-display ${brush === k ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => setPeek((p) => !p)} className={`rounded-xl px-3 py-1 font-display ${peek ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
            👁️ מה מאחוריי
          </button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="h-9 w-9 shrink-0 rounded-xl border-4 border-white shadow" style={{ background: color }} title="הצבע הנוכחי" />
          <Swatches color={color} setColor={setColor} extra={recent} />
        </div>
        <DPad keys={keys.current} />
        <button className={`${ready ? 'btn-ghost' : 'btn-mint'} w-full py-3 text-xl`} onClick={() => act('ready')}>
          {ready ? '✋ רגע, עוד לא' : '✅ התחבאתי!'}
        </button>
        <DoneRow ids={g.hiders} doneIds={g.readyIds} label="מי כבר מוכן" />
      </div>
    </div>
  );
}

// עורך העור: הרקע שמאחוריכם בהגדלה, והגוף מעליו. לחיצה על הגוף = צביעה, מחוץ לגוף = לקחת צבע
const MARGIN_C = 3;
const MARGIN_R = 2;
const EC = COLS + MARGIN_C * 2;
const ER = ROWS + MARGIN_R * 2;
const PX = 20;

function SkinEditor({ g, img, pos, skin, peek, onPaint, onPick }) {
  const ref = useRef();
  const painting = useRef(false);
  const { w, h } = bodyBox(g);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, EC * PX, ER * PX);
    const src = img?.canvas;
    if (src) {
      // האזור בתמונה שמאחורי הגוף + שוליים
      const cw = (w * src.width) / COLS;
      const ch = (h * src.height) / ROWS;
      let sx = pos.x * src.width - MARGIN_C * cw;
      let sy = pos.y * src.height - MARGIN_R * ch;
      let sw = EC * cw;
      let sh = ER * ch;
      let dx = 0;
      let dy = 0;
      let dw = EC * PX;
      let dh = ER * PX;
      // חיתוך לגבולות התמונה
      if (sx < 0) {
        dx = (-sx / sw) * dw;
        dw -= dx;
        sw += sx;
        sx = 0;
      }
      if (sy < 0) {
        dy = (-sy / sh) * dh;
        dh -= dy;
        sh += sy;
        sy = 0;
      }
      if (sx + sw > src.width) {
        const cut = sx + sw - src.width;
        dw -= (cut / sw) * dw;
        sw -= cut;
      }
      if (sy + sh > src.height) {
        const cut = sy + sh - src.height;
        dh -= (cut / sh) * dh;
        sh -= cut;
      }
      if (sw > 0 && sh > 0) ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    ctx.globalAlpha = peek ? 0.25 : 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = CELL[r][c];
        if (k < 0) continue;
        ctx.fillStyle = `#${skin[k]}`;
        ctx.fillRect((c + MARGIN_C) * PX, (r + MARGIN_R) * PX, PX, PX);
      }
    }
    ctx.globalAlpha = 1;
    // קווי מתאר דקים לגוף
    ctx.strokeStyle = peek ? 'rgba(255,210,63,0.9)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (CELL[r][c] >= 0) ctx.strokeRect((c + MARGIN_C) * PX + 0.5, (r + MARGIN_R) * PX + 0.5, PX - 1, PX - 1);
  }, [img, pos, skin, peek, w, h]);

  function at(e) {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * EC;
    const py = ((e.clientY - r.top) / r.height) * ER;
    return { c: Math.floor(px) - MARGIN_C, r: Math.floor(py) - MARGIN_R, px, py };
  }

  function handle(e, first) {
    const { c, r, px, py } = at(e);
    if (!peek && inBody(c, r)) {
      if (first) painting.current = true;
      if (painting.current) onPaint(c, r);
    } else if (first) {
      // המיקום בתמונה של הנקודה שנלחצה
      onPick(pos.x + ((px - MARGIN_C) / COLS) * w, pos.y + ((py - MARGIN_R) / ROWS) * h);
    }
  }

  return (
    <div dir="ltr">
      <canvas
        ref={ref}
        width={EC * PX}
        height={ER * PX}
        className="mx-auto block w-full max-w-[300px] rounded-2xl shadow-lg"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          handle(e, true);
        }}
        onPointerMove={(e) => painting.current && handle(e, false)}
        onPointerUp={() => (painting.current = false)}
        onPointerCancel={() => (painting.current = false)}
      />
      <p dir="rtl" className="mt-1 text-center text-xs text-indigo-400">
        על הגוף = צביעה · מסביב = לקחת צבע · ״מה מאחוריי״ = לראות ולקחת צבע מתחת לגוף
      </p>
    </div>
  );
}

// חצים לטלפון: לוחצים ומחזיקים
function DPad({ keys }) {
  const btn = (k, label, cls) => (
    <button
      className={`flex h-12 w-12 select-none items-center justify-center rounded-2xl bg-indigo-100 text-2xl active:bg-indigo-300 ${cls}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        keys.add(k);
      }}
      onPointerUp={() => keys.delete(k)}
      onPointerCancel={() => keys.delete(k)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
  return (
    <div dir="ltr" className="mx-auto grid w-fit grid-cols-3 gap-1 lg:hidden">
      {btn('u', '⬆️', 'col-start-2')}
      {btn('l', '⬅️', 'col-start-1 row-start-2')}
      {btn('d', '⬇️', 'col-start-2 row-start-2')}
      {btn('r', '➡️', 'col-start-3 row-start-2')}
    </div>
  );
}

// ---------- שלב 3: מחפשים ----------
function SeekPhase({ g, img }) {
  const { state, receivedAt } = useRoom();
  const [zoom, setZoom] = useState(1);
  const [now, setNow] = useState(Date.now());
  const seeker = g.seekers.includes(state.me);
  const foundCount = Object.keys(g.found).length;
  const cooldownUntil = receivedAt + (g.cooldownLeft || 0);
  const waiting = seeker && now < cooldownUntil;
  const prevFound = useRef(g.found);

  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setNow(Date.now()), cooldownUntil - Date.now() + 20);
    return () => clearTimeout(t);
  }, [waiting, cooldownUntil]);

  // צלילים כשמישהו נמצא
  useEffect(() => {
    const fresh = Object.keys(g.found).filter((id) => !prevFound.current[id]);
    prevFound.current = g.found;
    if (!fresh.length) return;
    if (fresh.includes(state.me)) fail();
    else if (seeker) success();
    else pop();
  }, [g.found]); // eslint-disable-line react-hooks/exhaustive-deps

  // פספוס שלי = צליל
  const lastMiss = g.misses[g.misses.length - 1];
  const prevMiss = useRef(lastMiss?.id);
  useEffect(() => {
    if (lastMiss && lastMiss.id !== prevMiss.current && lastMiss.by === state.me) fail();
    prevMiss.current = lastMiss?.id;
  }, [lastMiss?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function find(x, y) {
    if (!seeker || Date.now() < cooldownUntil) return;
    await emit('game:action', { type: 'find', data: { x, y } });
    setNow(Date.now());
  }

  return (
    <div>
      <ZoomBar zoom={zoom} setZoom={setZoom}>
        <span className="chip bg-amber-100 font-display text-lg text-amber-900">
          נמצאו {foundCount} / {g.hiders.length}
        </span>
      </ZoomBar>
      <p className="mb-2 text-center font-display text-lg">
        {seeker ? (waiting ? '⏳ פספוס… רגע' : '👆 לחצו על מי שמתחבא!') : g.found[state.me] ? '😵 מצאו אתכם!' : '🤫 אל תזוזו… מחפשים אתכם'}
      </p>
      <Board g={g} img={img} zoom={zoom} onPoint={seeker ? find : null} cursor={seeker ? (waiting ? 'wait' : 'crosshair') : 'default'}>
        <Bodies
          g={g}
          glowFor={(id) => (g.found[id] ? 'red' : !seeker && id === state.me ? 'me' : undefined)}
          labels={(id) => g.found[id] || (!seeker && id === state.me)}
          labelText={(id) => (id === state.me && !g.found[id] ? 'אתם' : undefined)}
        />
        {g.misses.map((m) => (
          <span
            key={m.id}
            className="pointer-events-none absolute z-[300] -translate-x-1/2 -translate-y-1/2 animate-pop text-lg opacity-70"
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
          >
            ❌
          </span>
        ))}
      </Board>
      {g.seekers.length > 1 && <p className="mt-2 text-center text-sm text-indigo-400">כל מי שנמצא = נקודה לכל המחפשים 🤝</p>}
    </div>
  );
}

// ---------- שלב 4: תוצאות ----------
function ResultsPhase({ g, img }) {
  const { state } = useRoom();
  const last = g.round >= g.totalRounds;
  const foundCount = Object.keys(g.found).length;
  const safe = g.hiders.filter((id) => !g.found[id]);

  useEffect(() => {
    if (g.points?.[state.me] > 0) success();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-rise">
      <p className="mb-3 text-center font-display text-2xl">
        {foundCount === g.hiders.length ? '🔍 המחפשים מצאו את כולם!' : safe.length === g.hiders.length ? '🦎 אף אחד לא נמצא!' : `🔍 נמצאו ${foundCount} מתוך ${g.hiders.length}`}
      </p>
      <Board g={g} img={img}>
        <Bodies
          g={g}
          glowFor={(id) => (g.found[id] ? 'red' : 'green')}
          labels={() => true}
          labelText={(id) => {
            const p = state.players.find((q) => q.id === id);
            return `${g.found[id] ? '🔍' : '😎'} ${p?.emoji || ''} ${p?.name || ''}`;
          }}
        />
      </Board>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {g.hiders.map((id) => (
          <span key={id} className={`chip py-1.5 ${g.found[id] ? 'bg-rose-100' : 'bg-emerald-100'}`}>
            <PlayerTag id={id} size="sm" />
            {g.found[id] ? (
              <span className="inline-flex items-center gap-1 text-sm">
                נמצא ע״י <PlayerTag id={g.found[id]} size="sm" />
              </span>
            ) : (
              <span className="text-sm">לא נמצא 😎</span>
            )}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <RoundPoints points={g.points} />
      </div>
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}
