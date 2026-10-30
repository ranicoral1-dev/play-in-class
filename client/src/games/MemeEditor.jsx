import { useEffect, useRef, useState } from 'react';

// ---------- הגדרות ----------
export const FORMATS = [
  { id: 'square', label: '⬛ ריבוע', w: 1080, h: 1080 },
  { id: 'post', label: '📱 פוסט 4:5', w: 1080, h: 1350 },
  { id: 'reel', label: '🎬 ריל 9:16', w: 1080, h: 1920 },
  { id: 'wide', label: '🖥️ רחב 16:9', w: 1920, h: 1080 },
];

const FONTS = [
  { id: 'impact', label: 'מים קלאסי', css: 'Impact, "Secular One", "Arial Black", sans-serif' },
  { id: 'secular', label: 'סקולר', css: '"Secular One", sans-serif' },
  { id: 'rubik', label: 'רוביק', css: 'Rubik, sans-serif' },
  { id: 'arial', label: 'אריאל', css: 'Arial, sans-serif' },
  { id: 'comic', label: 'קומיקס', css: '"Comic Sans MS", "Secular One", cursive' },
  { id: 'serif', label: 'עיתון', css: '"Times New Roman", David, serif' },
];
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const COLORS = ['#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffd23f', '#34c759', '#2ec4b6', '#3a86ff', '#7b2ff7', '#ff5d8f', '#8e5a2b', '#8e8e93'];

const GRADIENTS = [
  ['#7b2ff7', '#ff5d8f'],
  ['#3a86ff', '#2ec4b6'],
  ['#ff9500', '#ff3b30'],
  ['#ffd23f', '#ff9500'],
  ['#0f0c29', '#302b63'],
  ['#34c759', '#3a86ff'],
  ['#ff5d8f', '#ffd23f'],
  ['#000000', '#434343'],
];

// התמונות המובנות של המשחק: מדבקות אימוג'י בגדול
const STICKERS = {
  פרצופים: ['😂', '🤣', '😭', '😱', '😡', '🥺', '😎', '🤡', '💀', '🗿', '🤔', '🙄', '😏', '🥶', '🤯', '😴', '🤓', '😬', '🫠', '🥴', '😇', '🤢', '😤', '🤩'],
  ידיים: ['👍', '👎', '👏', '🙌', '🤌', '✌️', '🤦', '🤷', '🙅', '🙆', '💪', '👀', '🫡', '🤝'],
  חיות: ['🐸', '🐶', '🐱', '🐵', '🙈', '🦆', '🐔', '🦄', '🐷', '🐍', '🦖', '🐟', '🐌', '🦥', '🐧', '🐻'],
  דברים: ['🔥', '💯', '💩', '🎉', '🍕', '⭐', '❤️', '💔', '⚡', '💸', '🚀', '🏆', '📱', '🍔', '🧠', '💣', '🎮', '📚', '⏰', '☕', '🍩', '🌈', '💥', '❓'],
  סימנים: ['➡️', '⬅️', '⬆️', '⬇️', '❌', '✅', '⭕', '❗', '💬', '💭', '🔴', '🚫'],
};

const LH = 1.15;
const HEB = /[֐-׿]/;
let seq = 0;
const uid = () => `l${Date.now().toString(36)}${seq++}`;

// תמונות שהועלו - מחוץ ל-state כדי שביטול/חזרה יהיו זולים
export const IMAGES = new Map();

export function blankDoc() {
  return { format: 'square', bg: { type: 'color', color: '#ffffff' }, layers: [] };
}

const fmt = (doc) => FORMATS.find((f) => f.id === doc.format) || FORMATS[0];

// ---------- ציור ----------
const measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

function fontStr(l) {
  const css = l.font === 'emoji' ? EMOJI_FONT : FONTS.find((f) => f.id === l.font)?.css || FONTS[0].css;
  return `${l.bold ? 'bold ' : ''}${Math.round(l.size)}px ${css}`;
}

function textBox(l) {
  measureCtx.font = fontStr(l);
  const lines = (l.text || ' ').split('\n');
  const tw = Math.max(...lines.map((s) => measureCtx.measureText(s || ' ').width));
  const pad = l.bgColor ? l.size * 0.3 : l.size * 0.12 + l.size * (l.stroke || 0);
  return { w: tw + pad * 2, h: lines.length * l.size * LH + pad * 2, pad, lines };
}

export function layerSize(l) {
  if (l.type === 'text') return textBox(l);
  if (l.type === 'path') return { w: l.bw * l.scale, h: l.bh * l.scale };
  return { w: l.w, h: l.h };
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLayer(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rot || 0);
  if (l.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = l.opacity ?? 1;
  if (l.type === 'image') {
    const img = IMAGES.get(l.img);
    if (img) ctx.drawImage(img, -l.w / 2, -l.h / 2, l.w, l.h);
  } else if (l.type === 'rect') {
    ctx.fillStyle = l.color;
    if (l.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
    } else {
      roundRect(ctx, -l.w / 2, -l.h / 2, l.w, l.h, l.radius || 0);
    }
    ctx.fill();
  } else if (l.type === 'path') {
    ctx.scale(l.scale, l.scale);
    ctx.strokeStyle = l.color;
    ctx.lineWidth = l.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (l.pts.length === 1) ctx.lineTo(l.pts[0][0] + 0.1, l.pts[0][1]);
    ctx.stroke();
  } else if (l.type === 'text') {
    const { w, h, pad, lines } = textBox(l);
    if (l.bgColor) {
      ctx.fillStyle = l.bgColor;
      roundRect(ctx, -w / 2, -h / 2, w, h, l.size * 0.25);
      ctx.fill();
    }
    ctx.font = fontStr(l);
    ctx.textBaseline = 'middle';
    ctx.direction = HEB.test(l.text) ? 'rtl' : 'ltr';
    const align = l.align || 'center';
    ctx.textAlign = align;
    const ax = align === 'center' ? 0 : align === 'right' ? w / 2 - pad : -w / 2 + pad;
    lines.forEach((line, i) => {
      const y = (i - (lines.length - 1) / 2) * l.size * LH;
      if (l.stroke > 0) {
        ctx.lineWidth = l.size * l.stroke * 2;
        ctx.strokeStyle = l.strokeColor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, ax, y);
      }
      ctx.fillStyle = l.color;
      ctx.fillText(line, ax, y);
    });
  }
  ctx.restore();
}

function drawBg(ctx, doc, W, H) {
  const bg = doc.bg;
  if (bg.type === 'gradient') {
    const gr = ctx.createLinearGradient(0, 0, W * 0.3, H);
    gr.addColorStop(0, bg.from);
    gr.addColorStop(1, bg.to);
    ctx.fillStyle = gr;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);
}

export function renderDoc(doc, canvas = document.createElement('canvas')) {
  const { w: W, h: H } = fmt(doc);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawBg(ctx, doc, W, H);
  for (const l of doc.layers) drawLayer(ctx, l);
  return canvas;
}

// JPEG כדי שהקובץ יהיה קטן; מורידים איכות אם צריך
export function exportDoc(doc) {
  const c = renderDoc(doc);
  let q = 0.88;
  let image = c.toDataURL('image/jpeg', q);
  while (image.length > 5_000_000 && q > 0.4) {
    q -= 0.15;
    image = c.toDataURL('image/jpeg', q);
  }
  return { image, w: c.width, h: c.height };
}

// ---------- גאומטריה ----------
function toLocal(l, p) {
  const dx = p.x - l.x;
  const dy = p.y - l.y;
  const c = Math.cos(-(l.rot || 0));
  const s = Math.sin(-(l.rot || 0));
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

function toWorld(l, q) {
  const c = Math.cos(l.rot || 0);
  const s = Math.sin(l.rot || 0);
  return { x: l.x + q.x * c - q.y * s, y: l.y + q.x * s + q.y * c };
}

function hitLayer(l, p) {
  const { w, h } = layerSize(l);
  const q = toLocal(l, p);
  return Math.abs(q.x) <= w / 2 && Math.abs(q.y) <= h / 2;
}

function handlesFor(l, k) {
  const { w, h } = layerSize(l);
  const hs = [
    { kind: 'scale', x: -w / 2, y: -h / 2 },
    { kind: 'scale', x: w / 2, y: -h / 2 },
    { kind: 'scale', x: -w / 2, y: h / 2 },
    { kind: 'scale', x: w / 2, y: h / 2 },
    { kind: 'rotate', x: 0, y: -h / 2 - 46 * k },
  ];
  if (l.type === 'image' || l.type === 'rect') {
    hs.push({ kind: 'sx', x: -w / 2, y: 0 }, { kind: 'sx', x: w / 2, y: 0 }, { kind: 'sy', x: 0, y: -h / 2 }, { kind: 'sy', x: 0, y: h / 2 });
  }
  return hs.map((hd) => ({ ...hd, ...toWorld(l, hd) }));
}

// שינוי גודל אחיד ביחס לגודל שהיה בתחילת הגרירה
function resized(base, f) {
  if (base.type === 'text') return { ...base, size: Math.max(8, Math.min(1200, base.size * f)) };
  if (base.type === 'path') return { ...base, scale: Math.max(0.05, base.scale * f) };
  const min = 16 / Math.min(base.w, base.h);
  const ff = Math.max(f, min);
  return { ...base, w: base.w * ff, h: base.h * ff };
}

function snapAngle(a) {
  const step = Math.PI / 2;
  const near = Math.round(a / step) * step;
  return Math.abs(a - near) < 0.08 ? near : a;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- תבניות מובנות ----------
const T = (o) => ({ id: uid(), type: 'text', rot: 0, font: 'impact', bold: false, color: '#ffffff', strokeColor: '#000000', stroke: 0.08, align: 'center', ...o });
const R = (o) => ({ id: uid(), type: 'rect', rot: 0, color: '#ffffff', radius: 0, ...o });
const E = (text, x, y, size = 260) => T({ text, x, y, size, font: 'emoji', stroke: 0 });

const TEMPLATES = [
  {
    name: 'דף ריק',
    emoji: '📄',
    make: () => blankDoc(),
  },
  {
    name: 'מים קלאסי',
    emoji: '🖼️',
    hint: 'הוסיפו תמונה וגררו אותה מתחת לטקסט',
    make: () => ({
      format: 'square',
      bg: { type: 'color', color: '#222222' },
      layers: [T({ text: 'טקסט למעלה', x: 540, y: 110, size: 100 }), T({ text: 'טקסט למטה', x: 540, y: 970, size: 100 })],
    }),
  },
  {
    name: 'כיתוב מעל תמונה',
    emoji: '🐦',
    make: () => ({
      format: 'square',
      bg: { type: 'color', color: '#ffffff' },
      layers: [
        R({ x: 540, y: 620, w: 1000, h: 860, color: '#e5e7eb', radius: 30 }),
        T({ text: 'כשאתה...', x: 540, y: 95, size: 72, font: 'rubik', bold: true, color: '#111111', stroke: 0 }),
        E('🤔', 540, 620, 300),
      ],
    }),
  },
  {
    name: 'לא זה / כן זה',
    emoji: '🙅',
    make: () => ({
      format: 'square',
      bg: { type: 'color', color: '#ffffff' },
      layers: [
        R({ x: 270, y: 270, w: 540, h: 540, color: '#ffd23f' }),
        R({ x: 270, y: 810, w: 540, h: 540, color: '#ffe9a8' }),
        R({ x: 540, y: 540, w: 1080, h: 8, color: '#111111' }),
        E('🙅', 270, 270, 300),
        E('😍', 270, 810, 300),
        T({ text: 'לא זה', x: 810, y: 270, size: 80, font: 'secular', color: '#111111', stroke: 0 }),
        T({ text: 'כן זה', x: 810, y: 810, size: 80, font: 'secular', color: '#111111', stroke: 0 }),
      ],
    }),
  },
  {
    name: 'ציפיות מול מציאות',
    emoji: '🥴',
    make: () => ({
      format: 'square',
      bg: { type: 'color', color: '#ffffff' },
      layers: [
        R({ x: 270, y: 540, w: 540, h: 1080, color: '#c7f0ec' }),
        R({ x: 810, y: 540, w: 540, h: 1080, color: '#ffd0dc' }),
        T({ text: 'ציפיות', x: 810, y: 110, size: 90, font: 'secular', color: '#111111', stroke: 0 }),
        T({ text: 'מציאות', x: 270, y: 110, size: 90, font: 'secular', color: '#111111', stroke: 0 }),
        E('😎', 810, 560, 320),
        E('🥴', 270, 560, 320),
      ],
    }),
  },
  {
    name: 'רמות',
    emoji: '🧠',
    make: () => ({
      format: 'square',
      bg: { type: 'color', color: '#111111' },
      layers: [
        ...['#1f2937', '#312e81', '#5b21b6', '#7c3aed'].map((color, i) => R({ x: 540, y: 135 + i * 270, w: 1080, h: 262, color })),
        ...['😐', '🙂', '😎', '🤯'].map((e, i) => E(e, 160, 135 + i * 270, 200)),
        ...['רמה 1', 'רמה 2', 'רמה 3', 'רמה 4'].map((text, i) => T({ text, x: 680, y: 135 + i * 270, size: 80, font: 'secular', stroke: 0 })),
      ],
    }),
  },
  {
    name: 'ריל עם כותרת',
    emoji: '🎬',
    make: () => ({
      format: 'reel',
      bg: { type: 'gradient', from: '#0f0c29', to: '#302b63' },
      layers: [
        T({ text: 'כשאתה מגלה ש...', x: 540, y: 260, size: 96, font: 'secular', stroke: 0.06 }),
        E('🤯', 540, 960, 480),
        T({ text: 'הסוף 💀', x: 540, y: 1660, size: 110, font: 'secular', color: '#ffd23f', stroke: 0.06 }),
      ],
    }),
  },
  {
    name: 'מבזק חדשות',
    emoji: '📺',
    make: () => ({
      format: 'wide',
      bg: { type: 'gradient', from: '#1e3a8a', to: '#0f172a' },
      layers: [
        E('📺', 960, 430, 380),
        R({ x: 960, y: 900, w: 1920, h: 150, color: '#ffffff' }),
        R({ x: 1720, y: 900, w: 400, h: 150, color: '#ff3b30' }),
        T({ text: 'מבזק', x: 1720, y: 900, size: 84, font: 'secular', stroke: 0 }),
        T({ text: 'הכותרת שלכם כאן', x: 800, y: 900, size: 72, font: 'rubik', bold: true, color: '#111111', stroke: 0 }),
      ],
    }),
  },
];

// ---------- העורך ----------
export default function MemeEditor({ doc, setDoc, onToast }) {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const hist = useRef({ undo: [], redo: [], key: null, at: 0 });
  const gesture = useRef(null);
  const pointers = useRef(new Map());
  const stroke = useRef(null);
  const [sel, setSel] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [pen, setPen] = useState(null); // { color, width } כשמצב ציור פעיל
  const [guides, setGuides] = useState({ v: false, h: false });
  const [, force] = useState(0);
  const [hint, setHint] = useState(null);
  const { w: W, h: H } = fmt(doc);
  const selected = doc.layers.find((l) => l.id === sel) || null;

  // key זהה ברצף (גרירה, סליידר) = צעד אחד בביטול
  function update(fn, key) {
    const prev = docRef.current;
    const next = fn(prev);
    if (next === prev) return;
    const h = hist.current;
    const now = Date.now();
    if (!(key && key === h.key && now - h.at < 1500)) {
      h.undo.push(prev);
      if (h.undo.length > 80) h.undo.shift();
      h.redo = [];
    }
    h.key = key;
    h.at = now;
    docRef.current = next;
    setDoc(next);
  }

  function patch(id, changes, key) {
    update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...(typeof changes === 'function' ? changes(l) : changes) } : l)) }), key);
  }

  function undo() {
    const h = hist.current;
    if (!h.undo.length) return;
    h.redo.push(docRef.current);
    const d = h.undo.pop();
    h.key = null;
    docRef.current = d;
    setDoc(d);
  }

  function redo() {
    const h = hist.current;
    if (!h.redo.length) return;
    h.undo.push(docRef.current);
    const d = h.redo.pop();
    h.key = null;
    docRef.current = d;
    setDoc(d);
  }

  function addLayer(l) {
    update((d) => ({ ...d, layers: [...d.layers, l] }));
    setSel(l.id);
    setPen(null);
  }

  function removeLayer(id) {
    update((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSel(null);
  }

  function duplicate(id) {
    const l = docRef.current.layers.find((x) => x.id === id);
    if (!l) return;
    addLayer({ ...l, id: uid(), x: l.x + 40, y: l.y + 40 });
  }

  // dir: 1 קדימה, -1 אחורה, 'top' / 'bottom'
  function reorder(id, dir) {
    update((d) => {
      const arr = [...d.layers];
      const i = arr.findIndex((l) => l.id === id);
      if (i < 0) return d;
      const [l] = arr.splice(i, 1);
      const j = dir === 'top' ? arr.length : dir === 'bottom' ? 0 : Math.max(0, Math.min(arr.length, i + dir));
      arr.splice(j, 0, l);
      return { ...d, layers: arr };
    });
  }

  function addText(text = 'טקסט') {
    const { w, h } = fmt(docRef.current);
    const dark = docRef.current.bg.type === 'gradient' || ['#000000', '#111111', '#222222'].includes(docRef.current.bg.color);
    addLayer(T({ text, x: w / 2, y: h / 2, size: Math.round(Math.min(w, h) / 10), color: '#ffffff', stroke: dark ? 0.05 : 0.08 }));
    setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.select();
    }, 30);
  }

  function addSticker(e) {
    const { w, h } = fmt(docRef.current);
    addLayer(E(e, w / 2 + (Math.random() - 0.5) * 120, h / 2 + (Math.random() - 0.5) * 120, Math.round(Math.min(w, h) / 4)));
  }

  function addShape(shape) {
    const { w, h } = fmt(docRef.current);
    addLayer(R({ x: w / 2, y: h / 2, w: shape === 'bar' ? w : w * 0.4, h: shape === 'bar' ? h * 0.16 : w * 0.4, shape: shape === 'ellipse' ? 'ellipse' : 'rect', color: shape === 'ellipse' ? '#ff3b30' : '#ffffff', radius: shape === 'rect' ? 30 : 0 }));
  }

  async function addImageBlob(blob) {
    if (!blob || !blob.type.startsWith('image/')) return;
    let src;
    try {
      src = await loadImage(blob);
    } catch {
      onToast?.('לא הצלחנו לפתוח את התמונה 😕');
      return;
    }
    const id = uid();
    IMAGES.set(id, src);
    const d = docRef.current;
    const { w, h } = fmt(d);
    // תמונה ראשונה על דף ריק נכנסת בגודל מלא - כמו בסיס של מים
    const first = !d.layers.some((l) => l.type === 'image');
    const k = first ? Math.min(w / src.width, h / src.height) : Math.min((w * 0.55) / src.width, (h * 0.55) / src.height);
    const layer = { id: uid(), type: 'image', img: id, x: w / 2, y: h / 2, w: src.width * k, h: src.height * k, rot: 0 };
    update((dd) => ({ ...dd, layers: first ? [layer, ...dd.layers] : [...dd.layers, layer] }));
    setSel(layer.id);
    setPen(null);
  }

  async function pasteButton() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return addImageBlob(await item.getType(type));
      }
      onToast?.('אין תמונה בלוח. העתיקו תמונה (קליק ימני ← העתקת תמונה) ונסו שוב');
    } catch {
      onToast?.('הדפדפן לא נתן גישה ללוח - לחצו Ctrl+V');
    }
  }

  function fitImage(l, mode) {
    const src = IMAGES.get(l.img);
    if (!src) return;
    const k = mode === 'cover' ? Math.max(W / src.width, H / src.height) : Math.min(W / src.width, H / src.height);
    patch(l.id, { x: W / 2, y: H / 2, w: src.width * k, h: src.height * k, rot: 0 });
    if (mode === 'cover') reorder(l.id, 'bottom');
  }

  function setFormat(id) {
    update((d) => {
      const a = fmt(d);
      const b = FORMATS.find((f) => f.id === id);
      const fx = b.w / a.w;
      const fy = b.h / a.h;
      return { ...d, format: id, layers: d.layers.map((l) => ({ ...l, x: l.x * fx, y: l.y * fy })) };
    });
  }

  function applyTemplate(t) {
    if (docRef.current.layers.length && !confirm('להחליף את מה שעשיתם בתבנית?')) return;
    update(() => t.make());
    setSel(null);
    setDrawer(null);
    setHint(t.hint || null);
  }

  // ---------- ציור הקנבס ----------
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    renderDoc(doc, c);
    const ctx = c.getContext('2d');
    const k = W / (c.getBoundingClientRect().width || W);
    if (stroke.current) {
      const s = stroke.current;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = '#ff2fb4';
    ctx.lineWidth = 2 * k;
    ctx.setLineDash([10 * k, 8 * k]);
    if (guides.v) {
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
    }
    if (guides.h) {
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    }
    ctx.restore();
    if (selected && !pen) {
      const { w, h } = layerSize(selected);
      ctx.save();
      ctx.translate(selected.x, selected.y);
      ctx.rotate(selected.rot || 0);
      ctx.strokeStyle = '#7b2ff7';
      ctx.lineWidth = 3 * k;
      ctx.setLineDash([12 * k, 8 * k]);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(0, -h / 2 - 46 * k);
      ctx.stroke();
      ctx.restore();
      for (const hd of handlesFor(selected, k)) {
        ctx.beginPath();
        ctx.arc(hd.x, hd.y, (hd.kind === 'scale' || hd.kind === 'rotate' ? 11 : 8) * k, 0, Math.PI * 2);
        ctx.fillStyle = hd.kind === 'rotate' ? '#ffd23f' : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 3 * k;
        ctx.strokeStyle = '#7b2ff7';
        ctx.stroke();
      }
    }
  });

  // הגופנים נטענים מאוחר - מציירים שוב כשהם מוכנים
  useEffect(() => {
    document.fonts?.ready.then(() => force((n) => n + 1));
    const onResize = () => force((n) => n + 1);
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (selected?.type === 'text' && document.fonts) {
      document.fonts.load(fontStr(selected), selected.text).then(() => force((n) => n + 1));
    }
  }, [selected?.font, selected?.bold]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- עכבר ומגע ----------
  function toCanvas(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  const kNow = () => W / (canvasRef.current?.getBoundingClientRect().width || W);

  function onPointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);
    const key = 'g' + Date.now();

    if (pen) {
      stroke.current = { ...pen, pts: [[p.x, p.y]] };
      force((n) => n + 1);
      return;
    }

    const cur = docRef.current.layers.find((l) => l.id === sel);
    // שתי אצבעות: צביטה לשינוי גודל וסיבוב
    if (pointers.current.size === 2 && cur) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { type: 'pinch', base: cur, d0: dist(a, b), a0: Math.atan2(b.y - a.y, b.x - a.x), key };
      return;
    }
    if (pointers.current.size > 1) return;

    const k = kNow();
    if (cur) {
      const hd = handlesFor(cur, k).find((x) => dist(x, p) < 22 * k);
      if (hd) {
        gesture.current = { type: hd.kind, base: cur, p0: p, key };
        return;
      }
    }
    const hit = [...docRef.current.layers].reverse().find((l) => hitLayer(l, p));
    if (hit) {
      setSel(hit.id);
      gesture.current = { type: 'move', base: hit, off: { x: p.x - hit.x, y: p.y - hit.y }, key };
    } else {
      setSel(null);
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toCanvas(e);
    pointers.current.set(e.pointerId, p);

    if (stroke.current) {
      stroke.current.pts.push([p.x, p.y]);
      force((n) => n + 1);
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const b = g.base;

    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const f = dist(p1, p2) / g.d0;
      const rot = snapAngle((b.rot || 0) + Math.atan2(p2.y - p1.y, p2.x - p1.x) - g.a0);
      patch(b.id, { ...resized(b, f), id: b.id, rot, x: b.x, y: b.y }, g.key);
    } else if (g.type === 'move') {
      const snap = 14 * kNow();
      let x = p.x - g.off.x;
      let y = p.y - g.off.y;
      const v = Math.abs(x - W / 2) < snap;
      const h = Math.abs(y - H / 2) < snap;
      if (v) x = W / 2;
      if (h) y = H / 2;
      if (v !== guides.v || h !== guides.h) setGuides({ v, h });
      patch(b.id, { x, y }, g.key);
    } else if (g.type === 'scale') {
      const f = dist(p, b) / Math.max(1, dist(g.p0, b));
      patch(b.id, { ...resized(b, f), x: b.x, y: b.y, rot: b.rot }, g.key);
    } else if (g.type === 'sx' || g.type === 'sy') {
      const q = toLocal(b, p);
      patch(b.id, g.type === 'sx' ? { w: Math.max(16, Math.abs(q.x) * 2) } : { h: Math.max(16, Math.abs(q.y) * 2) }, g.key);
    } else if (g.type === 'rotate') {
      const rot = snapAngle(Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / 2);
      patch(b.id, { rot }, g.key);
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (stroke.current) {
      const s = stroke.current;
      stroke.current = null;
      const xs = s.pts.map((q) => q[0]);
      const ys = s.pts.map((q) => q[1]);
      const minX = Math.min(...xs) - s.width / 2;
      const maxX = Math.max(...xs) + s.width / 2;
      const minY = Math.min(...ys) - s.width / 2;
      const maxY = Math.max(...ys) + s.width / 2;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const layer = {
        id: uid(),
        type: 'path',
        x: cx,
        y: cy,
        rot: 0,
        scale: 1,
        color: s.color,
        width: s.width,
        bw: maxX - minX,
        bh: maxY - minY,
        pts: s.pts.map(([x, y]) => [x - cx, y - cy]),
      };
      update((d) => ({ ...d, layers: [...d.layers, layer] }));
      return;
    }
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (guides.v || guides.h) setGuides({ v: false, h: false });
    } else if (gesture.current?.type === 'pinch') {
      gesture.current = null;
    }
  }

  function onDoubleClick(e) {
    const p = toCanvas(e);
    const hit = [...docRef.current.layers].reverse().find((l) => hitLayer(l, p));
    if (hit?.type === 'text') {
      setSel(hit.id);
      setTimeout(() => {
        textRef.current?.focus();
        textRef.current?.select();
      }, 30);
    } else if (!hit && !pen) {
      addText();
    }
  }

  // גלגלת העכבר משנה גודל של מה שנבחר
  useEffect(() => {
    const c = canvasRef.current;
    const onWheel = (e) => {
      const cur = docRef.current.layers.find((l) => l.id === sel);
      if (!cur || pen) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.06 : 1 / 1.06;
      patch(cur.id, (l) => resized(l, f), 'wheel' + cur.id);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  });

  // מקלדת והדבקה
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.matches?.('input, textarea, select');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        return redo();
      }
      if (typing) return;
      const cur = docRef.current.layers.find((l) => l.id === sel);
      if (!cur) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeLayer(cur.id);
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate(cur.id);
      } else if (e.key === 'Escape') {
        setSel(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        patch(cur.id, (l) => ({ x: l.x + dx, y: l.y + dy }), 'nudge' + cur.id);
      }
    };
    const onPaste = (e) => {
      const file = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
      if (file) {
        e.preventDefault();
        addImageBlob(file);
      }
    };
    addEventListener('keydown', onKey);
    addEventListener('paste', onPaste);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('paste', onPaste);
    };
  });

  function onDrop(e) {
    e.preventDefault();
    for (const f of e.dataTransfer.files) addImageBlob(f);
  }

  const toggle = (name) => setDrawer((d) => (d === name ? null : name));
  const h = hist.current;

  return (
    <div className="select-none">
      {/* סרגל כלים */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Tool onClick={() => fileRef.current.click()}>🖼️ תמונה</Tool>
        <Tool onClick={pasteButton}>📋 הדבקה</Tool>
        <Tool onClick={() => addText()}>🔤 טקסט</Tool>
        <Tool active={drawer === 'stickers'} onClick={() => toggle('stickers')}>😂 מדבקות</Tool>
        <Tool active={drawer === 'shapes'} onClick={() => toggle('shapes')}>🟦 צורות</Tool>
        <Tool active={!!pen} onClick={() => (pen ? setPen(null) : (setPen({ color: '#ff3b30', width: 14 }), setSel(null)))}>✏️ ציור</Tool>
        <Tool active={drawer === 'bg'} onClick={() => toggle('bg')}>🎨 רקע וגודל</Tool>
        <Tool active={drawer === 'templates'} onClick={() => toggle('templates')}>📐 תבניות</Tool>
        <span className="flex-1" />
        <Tool disabled={!h.undo.length} onClick={undo} title="ביטול (Ctrl+Z)">↩️</Tool>
        <Tool disabled={!h.redo.length} onClick={redo} title="חזרה (Ctrl+Y)">↪️</Tool>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            for (const f of e.target.files) addImageBlob(f);
            e.target.value = '';
          }}
        />
      </div>

      {drawer === 'stickers' && (
        <Drawer>
          {Object.entries(STICKERS).map(([group, list]) => (
            <div key={group} className="mb-2">
              <div className="label mb-1">{group}</div>
              <div className="flex flex-wrap gap-1">
                {list.map((s) => (
                  <button key={s} className="h-11 w-11 rounded-xl bg-white text-2xl shadow-sm transition hover:scale-110" onClick={() => addSticker(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Drawer>
      )}

      {drawer === 'shapes' && (
        <Drawer>
          <div className="flex flex-wrap gap-2">
            <Tool onClick={() => addShape('bar')}>▬ פס לכיתוב</Tool>
            <Tool onClick={() => addShape('rect')}>⬜ מלבן</Tool>
            <Tool onClick={() => addShape('ellipse')}>⚪ עיגול</Tool>
          </div>
        </Drawer>
      )}

      {drawer === 'bg' && (
        <Drawer>
          <div className="label mb-1">גודל</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <Tool key={f.id} active={doc.format === f.id} onClick={() => setFormat(f.id)}>
                {f.label}
              </Tool>
            ))}
          </div>
          <div className="label mb-1">צבע רקע</div>
          <ColorRow value={doc.bg.type === 'color' ? doc.bg.color : null} onChange={(color) => update((d) => ({ ...d, bg: { type: 'color', color } }), 'bg')} />
          <div className="label mb-1 mt-3">מעבר צבעים</div>
          <div className="flex flex-wrap gap-1.5">
            {GRADIENTS.map(([from, to]) => (
              <button
                key={from + to}
                className={`h-9 w-14 rounded-xl shadow-sm ring-offset-2 ${doc.bg.from === from && doc.bg.to === to ? 'ring-2 ring-grape' : ''}`}
                style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
                onClick={() => update((d) => ({ ...d, bg: { type: 'gradient', from, to } }))}
              />
            ))}
          </div>
        </Drawer>
      )}

      {drawer === 'templates' && (
        <Drawer>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button key={t.name} className="rounded-2xl bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow" onClick={() => applyTemplate(t)}>
                <div className="text-3xl">{t.emoji}</div>
                <div className="mt-1 text-sm font-bold">{t.name}</div>
              </button>
            ))}
          </div>
        </Drawer>
      )}

      {pen && (
        <Drawer>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold">✏️ מצב ציור - ציירו על התמונה</span>
            <ColorRow value={pen.color} onChange={(color) => setPen((p) => ({ ...p, color }))} />
            <Slider label="עובי" min={3} max={80} value={pen.width} onChange={(width) => setPen((p) => ({ ...p, width }))} />
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setPen(null)}>
              סיום ציור ✓
            </button>
          </div>
        </Drawer>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* הקנבס */}
        <div className="flex min-w-0 flex-1 flex-col items-center" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <div className="rounded-2xl bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f8fafc_0%_50%)] bg-[length:20px_20px] p-2 shadow-inner">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className={`block rounded-lg shadow-lg ${pen ? 'cursor-crosshair' : 'cursor-move'}`}
              style={{ maxWidth: '100%', maxHeight: '62vh', touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
            />
          </div>
          <p className="mt-2 text-center text-xs leading-relaxed text-indigo-400">
            {hint ? `💡 ${hint} · ` : ''}גררו להזזה · עיגולים לבנים = גודל · צהוב = סיבוב · גלגלת/שתי אצבעות = זום · דאבל-קליק = טקסט · Ctrl+V = הדבקת תמונה · אפשר לגרור קובץ לכאן
          </p>
        </div>

        {/* לוח מאפיינים */}
        <div className="w-full shrink-0 space-y-3 md:w-72">
          {selected ? (
            <Props
              l={selected}
              textRef={textRef}
              patch={(c, key) => patch(selected.id, c, key)}
              onDelete={() => removeLayer(selected.id)}
              onDuplicate={() => duplicate(selected.id)}
              onReorder={(dir) => reorder(selected.id, dir)}
              onFit={(mode) => fitImage(selected, mode)}
              canvasW={W}
            />
          ) : (
            <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-500">
              <div className="mb-1 font-display text-lg text-ink">👆 לחצו על משהו כדי לערוך אותו</div>
              הוסיפו תמונה מהמחשב, הדביקו תמונה שהעתקתם, או בחרו מדבקה ותבנית מהמשחק.
            </div>
          )}
          <Layers layers={doc.layers} sel={sel} onSelect={setSel} onReorder={reorder} />
          {doc.layers.length > 0 && (
            <button
              className="text-sm font-bold text-slate-400 hover:text-bubble"
              onClick={() => confirm('למחוק הכל ולהתחיל מחדש?') && (update((d) => ({ ...d, layers: [] })), setSel(null))}
            >
              🗑️ ניקוי הכל
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// תמונות גדולות מוקטנות כבר בטעינה, כדי שהציור יהיה מהיר
async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- רכיבי ממשק ----------
function Tool({ active, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`rounded-xl px-3 py-2 text-sm font-bold shadow-sm transition disabled:opacity-40 ${
        active ? 'bg-grape text-white' : 'bg-indigo-50 text-ink hover:bg-indigo-100'
      }`}
    >
      {children}
    </button>
  );
}

function Drawer({ children }) {
  return <div className="mb-3 animate-rise rounded-2xl bg-indigo-50/70 p-3">{children}</div>;
}

function ColorRow({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {COLORS.map((c) => (
        <button
          key={c}
          title={c}
          className={`h-7 w-7 rounded-full border border-black/10 shadow-sm transition hover:scale-110 ${value?.toLowerCase() === c ? 'ring-2 ring-grape ring-offset-2' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-black/10 bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] shadow-sm" title="צבע אחר">
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs font-bold text-indigo-900/70">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <input type="range" className="w-full accent-grape" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Props({ l, textRef, patch, onDelete, onDuplicate, onReorder, onFit, canvasW }) {
  const deg = Math.round(((l.rot || 0) * 180) / Math.PI);
  const isEmoji = l.type === 'text' && l.font === 'emoji';
  return (
    <div className="space-y-3 rounded-2xl border-2 border-indigo-100 p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg">
          {l.type === 'image' ? '🖼️ תמונה' : l.type === 'rect' ? '🟦 צורה' : l.type === 'path' ? '✏️ ציור' : isEmoji ? '😂 מדבקה' : '🔤 טקסט'}
        </span>
        <div className="flex gap-1">
          <Mini title="שכפול (Ctrl+D)" onClick={onDuplicate}>⧉</Mini>
          <Mini title="מחיקה (Delete)" onClick={onDelete}>🗑️</Mini>
        </div>
      </div>

      {l.type === 'text' && !isEmoji && (
        <>
          <textarea
            ref={textRef}
            dir="auto"
            className="input min-h-[70px] py-2 text-base"
            value={l.text}
            onChange={(e) => patch({ text: e.target.value }, 'text' + l.id)}
            placeholder="מה כתוב?"
          />
          <div className="flex flex-wrap gap-1">
            {FONTS.map((f) => (
              <button
                key={f.id}
                className={`rounded-lg px-2 py-1 text-sm ${l.font === f.id ? 'bg-grape text-white' : 'bg-indigo-50 hover:bg-indigo-100'}`}
                style={{ fontFamily: f.css }}
                onClick={() => patch({ font: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Mini active={l.bold} onClick={() => patch({ bold: !l.bold })}>
              <b>B</b>
            </Mini>
            {[
              ['right', '⇥'],
              ['center', '≡'],
              ['left', '⇤'],
            ].map(([a, icon]) => (
              <Mini key={a} active={(l.align || 'center') === a} title="יישור" onClick={() => patch({ align: a })}>
                {icon}
              </Mini>
            ))}
          </div>
          <Slider label="גודל" min={10} max={400} value={Math.round(l.size)} onChange={(size) => patch({ size }, 'size' + l.id)} />
          <div>
            <div className="label mb-1">צבע</div>
            <ColorRow value={l.color} onChange={(color) => patch({ color }, 'color' + l.id)} />
          </div>
          <Slider label="מסגרת לאותיות" min={0} max={20} value={Math.round((l.stroke || 0) * 100)} suffix="%" onChange={(v) => patch({ stroke: v / 100 }, 'stroke' + l.id)} />
          {l.stroke > 0 && <ColorRow value={l.strokeColor} onChange={(strokeColor) => patch({ strokeColor }, 'sc' + l.id)} />}
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-indigo-900/70">
              <input type="checkbox" className="accent-grape" checked={!!l.bgColor} onChange={(e) => patch({ bgColor: e.target.checked ? '#ffffff' : null })} />
              רקע מאחורי הטקסט
            </label>
            {l.bgColor && (
              <div className="mt-1">
                <ColorRow value={l.bgColor} onChange={(bgColor) => patch({ bgColor }, 'bgc' + l.id)} />
              </div>
            )}
          </div>
        </>
      )}

      {isEmoji && <Slider label="גודל" min={20} max={1200} value={Math.round(l.size)} onChange={(size) => patch({ size }, 'size' + l.id)} />}

      {l.type === 'image' && (
        <>
          <Slider
            label="גודל"
            min={2}
            max={300}
            value={Math.round((l.w / canvasW) * 100)}
            suffix="%"
            onChange={(v) => patch((x) => resized(x, (v / 100) * canvasW / x.w), 'size' + l.id)}
          />
          <div className="flex flex-wrap gap-1">
            <Mini wide onClick={() => onFit('cover')}>מילוי כל הרקע</Mini>
            <Mini wide onClick={() => onFit('contain')}>התאמה לגודל</Mini>
          </div>
        </>
      )}

      {l.type === 'rect' && (
        <>
          <ColorRow value={l.color} onChange={(color) => patch({ color }, 'color' + l.id)} />
          {l.shape !== 'ellipse' && <Slider label="פינות עגולות" min={0} max={300} value={l.radius || 0} onChange={(radius) => patch({ radius }, 'radius' + l.id)} />}
        </>
      )}

      {l.type === 'path' && (
        <>
          <ColorRow value={l.color} onChange={(color) => patch({ color }, 'color' + l.id)} />
          <Slider label="עובי" min={2} max={80} value={l.width} onChange={(width) => patch({ width }, 'width' + l.id)} />
        </>
      )}

      <Slider label="סיבוב" min={-180} max={180} value={deg} suffix="°" onChange={(v) => patch({ rot: (v * Math.PI) / 180 }, 'rot' + l.id)} />
      <Slider label="שקיפות" min={10} max={100} value={Math.round((l.opacity ?? 1) * 100)} suffix="%" onChange={(v) => patch({ opacity: v / 100 }, 'op' + l.id)} />
      <div className="flex flex-wrap gap-1">
        {l.type !== 'text' || isEmoji ? (
          <Mini wide active={l.flip} onClick={() => patch({ flip: !l.flip })}>
            ↔️ היפוך
          </Mini>
        ) : null}
        <Mini wide title="הכי קדימה" onClick={() => onReorder('top')}>⏫ קדימה</Mini>
        <Mini wide title="הכי אחורה" onClick={() => onReorder('bottom')}>⏬ אחורה</Mini>
      </div>
    </div>
  );
}

function Mini({ active, wide, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`${wide ? 'px-2.5' : 'w-9'} h-9 rounded-lg text-sm font-bold transition ${active ? 'bg-grape text-white' : 'bg-indigo-50 hover:bg-indigo-100'}`}
    >
      {children}
    </button>
  );
}

function Layers({ layers, sel, onSelect, onReorder }) {
  if (!layers.length) return null;
  const icon = (l) => (l.type === 'image' ? '🖼️' : l.type === 'rect' ? '🟦' : l.type === 'path' ? '✏️' : l.font === 'emoji' ? l.text : '🔤');
  const label = (l) => (l.type === 'text' && l.font !== 'emoji' ? l.text.split('\n')[0] || 'טקסט' : l.type === 'image' ? 'תמונה' : l.type === 'rect' ? 'צורה' : l.type === 'path' ? 'ציור' : 'מדבקה');
  return (
    <div className="rounded-2xl bg-indigo-50/70 p-2">
      <div className="label mb-1 px-1">שכבות (למעלה = מקדימה)</div>
      <ul className="scrollbar-thin max-h-48 space-y-1 overflow-y-auto">
        {[...layers].reverse().map((l) => (
          <li
            key={l.id}
            className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-sm ${l.id === sel ? 'bg-white font-bold shadow-sm' : 'hover:bg-white/60'}`}
            onClick={() => onSelect(l.id)}
          >
            <span>{icon(l)}</span>
            <span className="flex-1 truncate">{label(l)}</span>
            <button className="px-1 text-indigo-400 hover:text-grape" onClick={(e) => (e.stopPropagation(), onReorder(l.id, 1))}>
              ▲
            </button>
            <button className="px-1 text-indigo-400 hover:text-grape" onClick={(e) => (e.stopPropagation(), onReorder(l.id, -1))}>
              ▼
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
