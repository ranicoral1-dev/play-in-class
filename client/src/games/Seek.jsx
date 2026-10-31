import { useEffect, useRef, useState } from 'react';
import { emit, socket, serverUrl } from '../socket.js';
import { success, fail, pop } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints } from '../components/ui.jsx';
import { generateScene } from './seekScenes.js';

// צורת בן האדם ביחידות גוף (רוחב 1, גובה 2): ראש עגול ואיברים מעוגלים.
// חייבת להיות זהה לשרת (server/games/seek.js), שבודק לפיה אם המחפש פגע
const HEAD = { x: 0.5, y: 0.2, r: 0.17 };
const LIMBS = [
  [0.5, 0.3, 0.5, 0.45, 0.08], // צוואר
  [0.5, 0.55, 0.5, 1.0, 0.22], // גוף
  [0.3, 0.5, 0.12, 1.02, 0.075], // ידיים
  [0.7, 0.5, 0.88, 1.02, 0.075],
  [0.4, 1.1, 0.36, 1.88, 0.095], // רגליים
  [0.6, 1.1, 0.64, 1.88, 0.095],
];
const SKIN_W = 100; // פיקסלים ליחידת גוף בעור
const SKIN_H = 200;

// מצייר את הצורה בצבע אחד. k = פיקסלים ליחידת גוף
function drawShape(ctx, k, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(HEAD.x * k, HEAD.y * k, HEAD.r * k, 0, Math.PI * 2);
  ctx.fill();
  for (const [ax, ay, bx, by, r] of LIMBS) {
    ctx.lineWidth = r * 2 * k;
    ctx.beginPath();
    ctx.moveTo(ax * k, ay * k);
    ctx.lineTo(bx * k, by * k);
    ctx.stroke();
  }
}

const MASKS = new Map();
function maskFor(k) {
  if (!MASKS.has(k)) {
    const c = document.createElement('canvas');
    c.width = k;
    c.height = k * 2;
    drawShape(c.getContext('2d'), k, '#000');
    MASKS.set(k, c);
  }
  return MASKS.get(k);
}

// מצייר את העור על out (בגודל k על 2k), חתוך בדיוק לצורת הגוף
function drawMasked(skin, out, k) {
  const ctx = out.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.drawImage(skin, 0, 0, k, k * 2);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskFor(k), 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

// בן אדם בצבע אחד (לפני שצבעו, או רוח רפאים של מתחבא אחר)
const SILHOUETTES = new Map();
function silhouette(color) {
  if (!SILHOUETTES.has(color)) {
    const c = document.createElement('canvas');
    c.width = SKIN_W;
    c.height = SKIN_H;
    drawShape(c.getContext('2d'), SKIN_W, color);
    SILHOUETTES.set(color, c.toDataURL());
  }
  return SILHOUETTES.get(color);
}

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
  return { w: (g.size * 0.5) / g.aspect, h: g.size };
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

// בן אדם אחד על הלוח
const GLOWS = { red: '#ff2d55', green: '#22c55e', me: '#ffd23f' };
function Sprite({ src, ghost, x, y, w, h, glow, z = 0 }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        zIndex: 10 + z,
        opacity: ghost ? 0.5 : 1,
        filter: glow ? `drop-shadow(0 0 1px ${GLOWS[glow]}) drop-shadow(0 0 1px ${GLOWS[glow]}) drop-shadow(0 0 3px ${GLOWS[glow]})` : undefined,
      }}
    />
  );
}

const bodySrc = (b) => (b.skin ? serverUrl(b.skin) : silhouette(`#${b.color || '888888'}`));

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
        <Sprite src={bodySrc(b)} x={b.x} y={b.y} w={w} h={h} glow={glowFor?.(id)} z={i} />
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

  // Ctrl+Z = אחורה
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyZ' || e.target.matches?.('input, textarea')) return;
      e.preventDefault();
      restoreRef.current();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

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
        <div className="w-56">
          <BrushSize size={size} setSize={setSize} min={2} max={120} color={color} scale={0.3} />
        </div>
        <Swatches color={color} setColor={setColor} />
        <button className="rounded-xl bg-indigo-50 px-3 py-1.5 font-bold text-indigo-500" onClick={restore}>
          ↩️ אחורה
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
  const [color, setColor] = useState('#2a9d3c');
  const [recent, setRecent] = useState([]);
  const [size, setSize] = useState(8); // עובי המכחול בפיקסלים של העור (100 = רוחב הגוף)
  const [tool, setTool] = useState('brush');
  const [peek, setPeek] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ownSrc, setOwnSrc] = useState(() => silhouette(`#${me.color}`));
  const [ver, setVer] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const keys = useRef(new Set());
  const posRef = useRef(pos);
  const skin = useRef(null);
  const out = useRef(null);
  const undo = useRef([]);
  const upload = useRef(null);
  const { w, h } = bodyBox(g);
  const ready = g.readyIds.includes(state.me);

  // העור: קנבס חופשי שמציירים עליו. בהתחלה בצבע אחד (או מה שכבר צבעתם, אם התחברתם מחדש)
  if (!skin.current) {
    skin.current = document.createElement('canvas');
    skin.current.width = SKIN_W;
    skin.current.height = SKIN_H;
    const ctx = skin.current.getContext('2d');
    ctx.fillStyle = `#${me.color}`;
    ctx.fillRect(0, 0, SKIN_W, SKIN_H);
    out.current = document.createElement('canvas');
    out.current.width = SKIN_W;
    out.current.height = SKIN_H;
  }
  useEffect(() => {
    if (!me.skin) return;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      skin.current.getContext('2d').drawImage(im, 0, 0, SKIN_W, SKIN_H);
      changed(false);
    };
    im.src = serverUrl(me.skin);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // אחרי כל שינוי: מעדכנים את הלוח, ושולחים לשרת כשמפסיקים לצייר לרגע
  function changed(send = true) {
    drawMasked(skin.current, out.current, SKIN_W);
    setOwnSrc(out.current.toDataURL());
    setVer((v) => v + 1);
    if (!send) return;
    clearTimeout(upload.current);
    upload.current = setTimeout(() => socket.emit('game:action', { type: 'paint', data: out.current.toDataURL('image/png') }), 400);
  }

  function saveUndo() {
    const s = skin.current;
    undo.current.push(s.getContext('2d').getImageData(0, 0, s.width, s.height));
    if (undo.current.length > 40) undo.current.shift();
    setCanUndo(true);
  }

  function goBack() {
    const snap = undo.current.pop();
    setCanUndo(undo.current.length > 0);
    if (!snap) return;
    skin.current.getContext('2d').putImageData(snap, 0, 0);
    changed();
  }

  function fillAll() {
    saveUndo();
    const ctx = skin.current.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, SKIN_W, SKIN_H);
    changed();
  }

  // Ctrl+Z = אחורה
  const backRef = useRef(goBack);
  backRef.current = goBack;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.code !== 'KeyZ' || e.target.matches?.('input, textarea')) return;
      e.preventDefault();
      backRef.current();
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      clearTimeout(upload.current);
    };
  }, []);

  // תנועה: WASD או חצים (גם במקלדת עברית - לפי מיקום המקש), Shift = לאט
  useEffect(() => {
    const ks = keys.current;
    let slow = false;
    const down = (e) => {
      slow = e.shiftKey;
      if (e.ctrlKey || e.metaKey || e.target.matches?.('input, textarea')) return;
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

  function pickColor(hex) {
    if (!hex) return showToast('אי אפשר לקחת צבע מהתמונה הזאת - בחרו מהפלטה');
    const c = `#${hex}`;
    setColor(c);
    setTool('brush');
    setRecent((old) => [c, ...old.filter((x) => x !== c)].slice(0, 8));
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
                <Sprite ghost src={silhouette('#ffffff')} x={b.x} y={b.y} w={w} h={h} />
                <Label id={id} x={b.x} y={b.y} w={w} />
              </div>
            ))}
          <Sprite src={ownSrc} x={pos.x} y={pos.y} w={w} h={h} glow={peek ? 'me' : undefined} z={100} />
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
        <SkinEditor
          g={g}
          img={img}
          pos={pos}
          skin={skin.current}
          ver={ver}
          peek={peek}
          tool={tool}
          color={color}
          size={size}
          onBegin={saveUndo}
          onChange={changed}
          onPick={(x, y) => pickColor(img?.sample(x, y))}
        />
        <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-indigo-50 p-1">
          {[
            ['brush', '🖌️ מכחול'],
            ['pick', '💧 טפטפת'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => setTool(k)} className={`rounded-xl px-3 py-1 font-display ${tool === k ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
              {label}
            </button>
          ))}
          <button onClick={fillAll} className="rounded-xl px-3 py-1 font-display text-indigo-400 hover:bg-white">
            🪣 הכל
          </button>
          <button onClick={() => setPeek((p) => !p)} className={`rounded-xl px-3 py-1 font-display ${peek ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}>
            👁️ מה מאחוריי
          </button>
          <button onClick={goBack} disabled={!canUndo} className="rounded-xl px-3 py-1 font-display text-indigo-500 hover:bg-white disabled:opacity-40" title="Ctrl+Z">
            ↩️ אחורה
          </button>
        </div>
        <BrushSize size={size} setSize={setSize} min={1} max={40} color={color} scale={2} />
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

// גודל המכחול: פס גלילה עם תצוגה של העובי
function BrushSize({ size, setSize, min, max, color, scale = 1 }) {
  const dot = Math.max(3, Math.min(36, size * scale));
  return (
    <div dir="ltr" className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-3 py-1.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <span className="rounded-full border border-white shadow" style={{ width: dot, height: dot, background: color }} />
      </span>
      <input type="range" min={min} max={max} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-grape" title="גודל המכחול" />
    </div>
  );
}

// עורך העור: הרקע שמאחוריכם בהגדלה, והגוף מעליו. מציירים חופשי - רק מה שבתוך הגוף נשאר
const MX = 0.35; // שוליים מסביב לגוף, ביחידות גוף
const MY = 0.15;
const U = 180; // פיקסלים ליחידת גוף בעורך
const EW = Math.round((1 + MX * 2) * U);
const EH = Math.round((2 + MY * 2) * U);

function SkinEditor({ g, img, pos, skin, ver, peek, tool, color, size, onBegin, onChange, onPick }) {
  const ref = useRef();
  const body = useRef(null);
  const last = useRef(null);
  const { w, h } = bodyBox(g);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, EW, EH);
    const src = img?.canvas;
    if (src) {
      // האזור בתמונה שמאחורי הגוף + שוליים
      const cu = (h * src.height) / 2; // פיקסלים בתמונה ליחידת גוף
      let sx = pos.x * src.width - MX * cu;
      let sy = pos.y * src.height - MY * cu;
      let sw = (EW / U) * cu;
      let sh = (EH / U) * cu;
      let dx = 0;
      let dy = 0;
      let dw = EW;
      let dh = EH;
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
    if (!body.current) {
      body.current = document.createElement('canvas');
      body.current.width = U;
      body.current.height = U * 2;
    }
    drawMasked(skin, body.current, U);
    ctx.globalAlpha = peek ? 0.3 : 1;
    ctx.drawImage(body.current, MX * U, MY * U);
    ctx.globalAlpha = 1;
  }, [img, pos, skin, ver, peek, w, h]);

  // נקודה בעורך → פיקסל בעור
  function at(e) {
    const r = ref.current.getBoundingClientRect();
    const bu = (((e.clientX - r.left) / r.width) * EW) / U - MX;
    const bv = (((e.clientY - r.top) / r.height) * EH) / U - MY;
    return { bu, bv, x: bu * SKIN_W, y: bv * SKIN_W };
  }

  function stroke(from, to) {
    const ctx = skin.getContext('2d');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (from) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    onChange();
  }

  return (
    <div dir="ltr">
      <canvas
        ref={ref}
        width={EW}
        height={EH}
        className="mx-auto block w-full max-w-[300px] rounded-2xl shadow-lg"
        style={{ touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          e.preventDefault();
          const p = at(e);
          if (tool === 'pick' || peek) return onPick(pos.x + p.bu * w, pos.y + (p.bv * h) / 2);
          e.currentTarget.setPointerCapture(e.pointerId);
          onBegin();
          last.current = p;
          stroke(null, p);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const p = at(e);
          stroke(last.current, p);
          last.current = p;
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      />
      <p dir="rtl" className="mt-1 text-center text-xs text-indigo-400">
        מציירים חופשי על הגוף · 💧 טפטפת = לקחת צבע מהרקע · ״מה מאחוריי״ = לראות מה מתחת לגוף
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
