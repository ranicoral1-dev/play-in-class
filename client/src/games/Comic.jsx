import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { emit, serverUrl } from '../socket.js';
import { useRoom, usePlayer, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, EditButton } from '../components/ui.jsx';

// גודל תא אחד ברשת העמוד בפיקסלים של הציור (עמוד 3×3 = 720×900, לאורך כמו עמוד קומיקס)
const CW = 240;
const CH = 300;

export default function Comic({ g }) {
  const doneCount = g.progress.filter((p) => p >= g.target).length;
  return (
    <div className="card">
      <GameHeader title="🗯️ קומיקס בהמשכים">
        {g.phase === 'draw' && <span className="chip">תור {g.turn}</span>}
        {g.phase === 'draw' && (
          <span className="chip bg-amber-100 text-amber-900" title="קומיקסים שהגיעו למספר העמודים">
            📚 {doneCount}/{g.progress.length} גמורים
          </span>
        )}
        {g.phase !== 'draw' && <span className="chip">{g.phase === 'vote' ? 'שלב הדירוג' : 'תוצאות'}</span>}
      </GameHeader>
      {g.phase === 'draw' && <DrawPhase g={g} key={g.turn} />}
      {g.phase === 'vote' && <VotePhase g={g} />}
      {g.phase === 'results' && <ResultsPhase g={g} />}
    </div>
  );
}

// ---------- עמוד קומיקס ----------
function ComicPage({ page, cols, rows, ghost, label, onOpen, showAuthors = false, className = '' }) {
  return (
    <div className={className}>
      {label && <div className="mb-1 text-center text-xs font-bold text-indigo-400">{label}</div>}
      <div
        dir="rtl"
        onClick={onOpen}
        className={`grid gap-1.5 rounded-xl border-[3px] border-ink bg-white p-1.5 shadow-[0_4px_0_#1e1b4b33] ${onOpen ? 'cursor-zoom-in' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          aspectRatio: `${cols * CW} / ${rows * CH}`,
        }}
      >
        {page.blocks.map((b, i) => (
          <Block key={i} b={b} showAuthor={showAuthors} />
        ))}
        {ghost && (
          <div
            className="flex animate-pulse items-center justify-center rounded-md border-2 border-dashed border-grape bg-violet-100/70 text-2xl"
            style={{ gridColumn: `${ghost.c + 1} / span ${ghost.w}`, gridRow: `${ghost.r + 1} / span ${ghost.h}` }}
          >
            ✏️
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ b, showAuthor }) {
  const style = { gridColumn: `${b.c + 1} / span ${b.w}`, gridRow: `${b.r + 1} / span ${b.h}` };
  if (!b.src) {
    return (
      <div style={style} className="flex items-center justify-center rounded-md border-2 border-ink/70 bg-slate-200 text-2xl text-slate-400">
        ?
      </div>
    );
  }
  return (
    <div style={style} className="relative min-h-0 min-w-0 overflow-hidden rounded-md border-2 border-ink">
      <img src={serverUrl(b.src)} alt="" className="h-full w-full object-cover" draggable={false} />
      {showAuthor && b.pid && <AuthorBadge id={b.pid} />}
    </div>
  );
}

function AuthorBadge({ id }) {
  const p = usePlayer(id);
  return (
    <span title={p.name} className="absolute bottom-0.5 left-0.5 rounded-full bg-white/85 px-1 text-sm leading-tight shadow">
      {p.emoji}
    </span>
  );
}

// עמוד בגדול על כל המסך
function PageZoom({ page, cols, rows, onClose, showAuthors }) {
  if (!page) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div style={{ width: `min(100%, calc(90vh * ${(cols * CW) / (rows * CH)}))` }}>
        <ComicPage page={page} cols={cols} rows={rows} showAuthors={showAuthors} />
      </div>
    </div>
  );
}

// ---------- שלב הציור ----------
function DrawPhase({ g }) {
  const { state, receivedAt, showToast } = useRoom();
  const c = g.comic;
  const sizes = c.slot.sizes;
  const [size, setSize] = useState(g.mySize);
  const [editing, setEditing] = useState(!g.mySize);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  // הגודל שנשלח - נשמר כאן כי אישור השליחה מגיע לפני שהמצב מהשרת מתעדכן
  const [sent, setSent] = useState(g.mySize);
  const [hover, setHover] = useState(null);
  const board = useRef(null);
  const dirty = useRef(false);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);
  const sentSize = g.mySize || sent;
  const submitted = !!sentSize;
  const shown = hover || size;

  async function submit(auto = false) {
    if (busy || !size) return;
    if (!board.current?.hasContent()) {
      if (!auto) showToast('המשבצת עוד ריקה - תציירו משהו 🙂');
      return;
    }
    setBusy(true);
    const image = board.current.export();
    const res = await emit('game:action', { type: 'submit', data: { image, w: size.w, h: size.h } }, 30000);
    setBusy(false);
    if (res.error) return showToast(res.error);
    dirty.current = false;
    setPreview(image);
    setSent({ w: size.w, h: size.h });
    setEditing(false);
  }

  // רגע לפני שהזמן נגמר - שולחים אוטומטית את מה שיש
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const deadline = state.timeLeft != null ? receivedAt + state.timeLeft : null;
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      if (deadline - Date.now() < 3500 && (dirty.current || !submitted)) {
        dirty.current = false;
        submitRef.current(true);
      }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, submitted]);

  const ghost = shown ? { r: c.slot.r, c: c.slot.c, ...shown } : null;
  const title = c.isNew
    ? 'פתחו קומיקס חדש! 🎬 המשבצת הראשונה שלכם'
    : g.mine
      ? 'הקומיקס שלכם חזר אליכם! 🔄'
      : 'המשיכו את הקומיקס ✍️';

  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">{title}</p>
      <p className="mb-4 text-center text-sm font-bold text-indigo-400">
        עמוד {c.pageNum} · צריך לפחות {g.target} {g.target === 1 ? 'עמוד' : 'עמודים'}
        {g.done && ' · הקומיקס הזה כבר הגיע ליעד - ממשיכים בכיף 🎉'}
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Context g={g} ghost={ghost} />

        <div>
          {editing && (
            <SizePicker
              sizes={sizes}
              value={size}
              onHover={setHover}
              onPick={(s) => {
                setSize(s);
                dirty.current = true;
              }}
            />
          )}
          {!size && <p className="mt-4 text-center text-indigo-400">בחרו גודל למשבצת כדי להתחיל לצייר 👆</p>}
          {size && (
            <div className={editing ? '' : 'hidden'}>
              <DrawingBoard handle={board} w={size.w} h={size.h} onChange={() => (dirty.current = true)} />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                {submitted && (
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      dirty.current = false;
                      setSize(sentSize);
                      setEditing(false);
                    }}
                  >
                    חזרה בלי לשלוח
                  </button>
                )}
                <button className="btn-pink px-10 text-xl" disabled={busy} onClick={() => submit()}>
                  {busy ? 'שולחים…' : 'סיימתי ←'}
                </button>
              </div>
            </div>
          )}
          {!editing && (
            <div className="text-center">
              <Waiting emoji="📮">המשבצת נשלחה! מחכים לשאר המאיירים…</Waiting>
              {preview && sentSize && (
                <img
                  src={preview}
                  alt=""
                  className="mx-auto max-h-[40vh] rounded-xl border-[3px] border-ink"
                  style={{ aspectRatio: `${sentSize.w * CW} / ${sentSize.h * CH}` }}
                />
              )}
              <EditButton onClick={() => setEditing(true)} />
            </div>
          )}
        </div>
      </div>
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר צייר" />
    </div>
  );
}

// מה רואים מהקומיקס - לפי המצב שהמארח בחר
function Context({ g, ghost }) {
  const c = g.comic;
  const [zoom, setZoom] = useState(null);
  const modeText = {
    all: '📚 רואים את כל הקומיקס',
    page: '📄 רואים רק את העמוד האחרון',
    last: '🖼️ רואים רק את המשבצת האחרונה',
  }[g.mode];
  return (
    <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-3">
      <div className="mb-2 text-center text-sm font-bold text-rose-500">{modeText}</div>
      {g.mode === 'last' && c.last && (
        <div className="mb-3">
          <div className="mb-1 text-center text-xs font-bold text-indigo-400">המשבצת האחרונה</div>
          <img
            src={serverUrl(c.last.src)}
            alt=""
            className="mx-auto max-h-[38vh] rounded-lg border-[3px] border-ink bg-white"
            style={{ aspectRatio: `${c.last.w * CW} / ${c.last.h * CH}` }}
          />
        </div>
      )}
      <div className="max-h-[70vh] space-y-3 overflow-y-auto px-1">
        {c.pages.map((p, i) => (
          <ComicPage
            key={i}
            page={p}
            cols={g.cols}
            rows={g.rows}
            label={g.mode === 'page' ? 'העמוד הקודם' : `עמוד ${i + 1}`}
            onOpen={() => setZoom(p)}
            className="mx-auto max-w-[260px]"
          />
        ))}
        <ComicPage
          page={c.current}
          cols={g.cols}
          rows={g.rows}
          ghost={ghost}
          label={`עמוד ${c.pageNum} - כאן מציירים`}
          className="mx-auto max-w-[300px]"
        />
      </div>
      <PageZoom page={zoom} cols={g.cols} rows={g.rows} onClose={() => setZoom(null)} />
    </div>
  );
}

function SizePicker({ sizes, value, onPick, onHover }) {
  const maxW = Math.max(...sizes.map((s) => s.w));
  const maxH = Math.max(...sizes.map((s) => s.h));
  return (
    <div className="mb-3">
      <div className="label">גודל המשבצת (רוחב × גובה)</div>
      <div className="flex flex-wrap gap-2" onMouseLeave={() => onHover(null)}>
        {sizes.map((s) => {
          const on = value?.w === s.w && value?.h === s.h;
          return (
            <button
              key={`${s.w}x${s.h}`}
              onMouseEnter={() => onHover(s)}
              onClick={() => onPick(s)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2.5 py-2 transition ${
                on ? 'scale-105 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-indigo-50 hover:bg-indigo-100'
              }`}
            >
              <span
                dir="rtl"
                className="grid gap-0.5"
                style={{ gridTemplateColumns: `repeat(${maxW}, 9px)`, gridTemplateRows: `repeat(${maxH}, 11px)` }}
              >
                {Array.from({ length: maxW * maxH }, (_, k) => {
                  const x = k % maxW;
                  const y = Math.floor(k / maxW);
                  return <span key={k} className={`rounded-sm ${x < s.w && y < s.h ? 'bg-ink' : 'bg-white/70'}`} />;
                })}
              </span>
              <span className="text-xs font-bold">
                {s.w}×{s.h}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- לוח הציור ----------
const COLORS = ['#111111', '#ffffff', '#e63946', '#f4a261', '#ffd23f', '#2a9d8f', '#52b788', '#3a86ff', '#7b2ff7', '#ff5d8f', '#8d5524', '#f1c27d', '#9ca3af'];
const WIDTHS = [3, 7, 14, 28];

// הציור נשמר כרשימת קווים ובועות במסגרת "בסיס" (הגודל של המשבצת כשהתחלתם לצייר).
// כשמשנים גודל - הכל מוקטן/מוגדל באופן שווה כדי להיכנס למשבצת החדשה וממורכז, כך ששום דבר לא נחתך או נמתח,
// ואפשר לחזור לגודל הקודם בלי לאבד כלום.
function fitTransform(base, W, H) {
  const s = Math.min(W / base.W, H / base.H);
  return { s, ox: (W - base.W * s) / 2, oy: (H - base.H * s) / 2 };
}

function drawItem(ctx, it) {
  if (it.t === 'line') {
    ctx.strokeStyle = it.color;
    ctx.fillStyle = it.color;
    ctx.lineWidth = it.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (it.pts.length === 1) {
      const [x, y] = it.pts[0];
      ctx.beginPath();
      ctx.arc(x, y, it.width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(it.pts[0][0], it.pts[0][1]);
    for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i][0], it.pts[i][1]);
    ctx.stroke();
  } else if (it.t === 'bubble') {
    drawBubble(ctx, it);
  }
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawBubble(ctx, b) {
  const fs = b.size;
  ctx.font = `bold ${fs}px "Varela Round", "Rubik", sans-serif`;
  ctx.direction = 'rtl';
  const lines = wrapLines(ctx, b.text, fs * 9);
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const pad = fs * 0.6;
  const bw = tw + pad * 2;
  const bh = lines.length * fs * 1.25 + pad * 1.4;
  const x = b.x - bw / 2;
  const y = b.y - bh / 2;
  const r = Math.min(bh / 2, fs * 1.2);
  ctx.lineWidth = Math.max(2, fs / 9);
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#fff';
  // זנב הבועה
  ctx.beginPath();
  ctx.moveTo(b.x - bw * 0.15, y + bh - 2);
  ctx.lineTo(b.x - bw * 0.3, y + bh + fs * 1.1);
  ctx.lineTo(b.x + bw * 0.05, y + bh - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, r);
  ctx.fill();
  ctx.stroke();
  // מכסים את החיבור בין הזנב לבועה
  ctx.beginPath();
  ctx.moveTo(b.x - bw * 0.15 + ctx.lineWidth, y + bh - ctx.lineWidth);
  ctx.lineTo(b.x + bw * 0.05 - ctx.lineWidth, y + bh - ctx.lineWidth);
  ctx.lineWidth *= 1.6;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, b.x, y + pad * 0.7 + fs * 1.25 * (i + 0.5)));
}

function paint(ctx, doc, W, H) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  if (!doc.base) return;
  const { s, ox, oy } = fitTransform(doc.base, W, H);
  ctx.setTransform(s, 0, 0, s, ox, oy);
  for (const it of doc.items) drawItem(ctx, it);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function DrawingBoard({ handle, w, h, onChange }) {
  const W = w * CW;
  const H = h * CH;
  const canvasRef = useRef(null);
  const doc = useRef({ base: null, items: [] });
  const live = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [text, setText] = useState('');
  const [, force] = useState(0);
  const { showToast } = useRoom();

  const redraw = () => {
    const c = canvasRef.current;
    if (c) paint(c.getContext('2d'), doc.current, W, H);
  };
  useLayoutEffect(redraw, [W, H]);

  // הורה קורא לזה כדי לשלוח
  if (handle) {
    handle.current = {
      hasContent: () => doc.current.items.length > 0,
      export: () => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        paint(c.getContext('2d'), doc.current, W, H);
        return c.toDataURL('image/jpeg', 0.85);
      },
    };
  }

  const toBase = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    if (!doc.current.base) doc.current.base = { W, H };
    const { s, ox, oy } = fitTransform(doc.current.base, W, H);
    return { x: (px - ox) / s, y: (py - oy) / s, s };
  };

  const changed = () => {
    onChange?.();
    force((n) => n + 1);
  };

  const down = (e) => {
    e.preventDefault();
    const p = toBase(e);
    if (tool === 'bubble') {
      const t = text.trim();
      if (!t) return showToast('כתבו קודם מה הדמות אומרת 💬');
      doc.current.items.push({ t: 'bubble', x: p.x, y: p.y, text: t, size: (14 + width) / p.s });
      setText('');
      redraw();
      return changed();
    }
    canvasRef.current.setPointerCapture(e.pointerId);
    const it = { t: 'line', color: tool === 'eraser' ? '#ffffff' : color, width: (tool === 'eraser' ? width * 2 : width) / p.s, pts: [[p.x, p.y]] };
    doc.current.items.push(it);
    live.current = it;
    redraw();
  };

  const move = (e) => {
    const it = live.current;
    if (!it) return;
    const p = toBase(e);
    const [lx, ly] = it.pts[it.pts.length - 1];
    it.pts.push([p.x, p.y]);
    // מציירים רק את הקטע החדש - מהיר יותר מציור מחדש של הכל
    const ctx = canvasRef.current.getContext('2d');
    const { s, ox, oy } = fitTransform(doc.current.base, W, H);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.strokeStyle = it.color;
    ctx.lineWidth = it.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  const up = () => {
    if (!live.current) return;
    live.current = null;
    changed();
  };

  const undo = () => {
    doc.current.items.pop();
    if (!doc.current.items.length) doc.current.base = null;
    redraw();
    changed();
  };
  const clear = () => {
    if (!doc.current.items.length || !confirm('למחוק את כל הציור?')) return;
    doc.current = { base: null, items: [] };
    redraw();
    changed();
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
        {[
          ['pen', '✏️', 'עט'],
          ['eraser', '🧽', 'מחק'],
          ['bubble', '💬', 'בועת דיבור'],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            title={label}
            onClick={() => setTool(id)}
            className={`rounded-xl px-3 py-1.5 text-sm font-bold transition ${tool === id ? 'bg-grape text-white' : 'bg-indigo-50 hover:bg-indigo-100'}`}
          >
            {icon} {label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-indigo-100" />
        {WIDTHS.map((wd) => (
          <button
            key={wd}
            title="עובי"
            onClick={() => setWidth(wd)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${width === wd ? 'bg-sun' : 'bg-indigo-50 hover:bg-indigo-100'}`}
          >
            <span className="rounded-full bg-ink" style={{ width: Math.min(24, wd), height: Math.min(24, wd) }} />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-indigo-100" />
        <button title="ביטול" onClick={undo} disabled={!doc.current.items.length} className="rounded-xl bg-indigo-50 px-3 py-1.5 font-bold hover:bg-indigo-100 disabled:opacity-40">
          ↩️
        </button>
        <button title="ניקוי" onClick={clear} disabled={!doc.current.items.length} className="rounded-xl bg-indigo-50 px-3 py-1.5 font-bold hover:bg-indigo-100 disabled:opacity-40">
          🗑️
        </button>
      </div>
      {tool !== 'bubble' ? (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {COLORS.map((col) => (
            <button
              key={col}
              title={col}
              onClick={() => {
                setColor(col);
                if (tool === 'eraser') setTool('pen');
              }}
              className={`h-7 w-7 rounded-full border-2 transition ${color === col && tool === 'pen' ? 'scale-125 border-ink' : 'border-indigo-100'}`}
              style={{ background: col }}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto mb-2 flex max-w-md gap-2">
          <input
            className="flex-1 rounded-xl border-2 border-indigo-100 px-3 py-1.5 focus:border-grape"
            placeholder="מה הדמות אומרת? ואז לוחצים על הציור"
            maxLength={80}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={`mx-auto block touch-none rounded-xl border-[3px] border-ink bg-white shadow-lg ${tool === 'bubble' ? 'cursor-copy' : 'cursor-crosshair'}`}
        style={{ width: '100%', maxWidth: `calc(58vh * ${W / H})` }}
      />
    </div>
  );
}

// ---------- דירוג ----------
function ComicPages({ pages, cols, rows, showAuthors }) {
  const [zoom, setZoom] = useState(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pages.map((p, i) => (
          <ComicPage key={i} page={p} cols={cols} rows={rows} label={`עמוד ${i + 1}`} showAuthors={showAuthors} onOpen={() => setZoom(p)} />
        ))}
      </div>
      <PageZoom page={zoom} cols={cols} rows={rows} showAuthors={showAuthors} onClose={() => setZoom(null)} />
    </>
  );
}

function VotePhase({ g }) {
  const { act, state } = useRoom();
  const [ratings, setRatings] = useState(g.myRatings || {});
  const [editing, setEditing] = useState(false);
  const submitted = !!g.myRatings && !editing;
  const toRate = g.comics.filter((s) => !s.mine);
  const complete = toRate.every((s) => ratings[s.idx]);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">{submitted ? 'הדירוג נשלח! 🌟' : 'קראו ודרגו כל קומיקס מ-1 עד 10'}</p>
      <p className="mb-4 text-center text-sm text-indigo-400">לוחצים על עמוד כדי לראות אותו בגדול</p>
      <div className="space-y-4">
        {g.comics.map((s, k) => (
          <div key={s.idx} className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-4 sm:p-5">
            <div className="mb-2 font-display text-lg text-indigo-400">
              קומיקס #{k + 1} {s.mine && <span className="text-sm text-grape">· הקומיקס שפתחת ✍️</span>}
            </div>
            <ComicPages pages={s.pages} cols={g.cols} rows={g.rows} />
            {!s.mine && (
              <div className="mt-3 flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    disabled={submitted}
                    onClick={() => setRatings((r) => ({ ...r, [s.idx]: n }))}
                    className={`h-9 w-9 rounded-xl font-display transition ${
                      ratings[s.idx] === n ? 'scale-110 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-white text-indigo-400 hover:bg-indigo-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {submitted ? (
        <div className="text-center">
          <EditButton onClick={() => setEditing(true)} />
        </div>
      ) : (
        <div className="mt-5 flex justify-center">
          <button className="btn-mint px-10" disabled={!complete} onClick={async () => !(await act('rate', ratings)).error && setEditing(false)}>
            שליחת דירוג
          </button>
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.votedIds} label="מי כבר דירג" />
    </div>
  );
}

function ResultsPhase({ g }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="animate-rise space-y-3">
      {g.results.map((r, i) => (
        <div
          key={r.idx}
          className={`animate-rise rounded-3xl p-4 sm:p-5 ${r.rank === 1 ? 'bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun' : 'bg-indigo-50'}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-xl">
              <span className="text-3xl">{medals[r.rank - 1] || `#${r.rank}`}</span>
              <PlayerTag id={r.ownerId} />
            </div>
            <div className="flex items-center gap-2">
              <span className="chip bg-white">⭐ {r.avg}</span>
              <span className="chip bg-amber-200 font-display">+{r.points}</span>
            </div>
          </div>
          <ComicPages pages={r.pages} cols={g.cols} rows={g.rows} showAuthors />
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-indigo-400">
            צוירו ע״י:
            {r.authors.map((a) => (
              <PlayerTag key={a} id={a} size="sm" className="text-xs" />
            ))}
          </div>
        </div>
      ))}
      <NextButton label="לטבלה הסופית 🏆" />
    </div>
  );
}
