import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

export const RoomContext = createContext(null);
export const useRoom = () => useContext(RoomContext);

export function usePlayer(id) {
  const { state } = useRoom();
  return state.players.find((p) => p.id === id) || { id, name: '?', emoji: '❔', connected: false };
}

export function Avatar({ emoji, size = 'md', dim = false, ring = false }) {
  const sizes = { sm: 'h-8 w-8 text-lg', md: 'h-11 w-11 text-2xl', lg: 'h-16 w-16 text-4xl', xl: 'h-24 w-24 text-6xl' };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-pink-50 shadow-inner
        ${sizes[size]} ${dim ? 'opacity-40 grayscale' : ''} ${ring ? 'ring-4 ring-sun' : ''}`}
    >
      {emoji}
    </span>
  );
}

export function PlayerTag({ id, size = 'sm', suffix, className = '' }) {
  const p = usePlayer(id);
  const { state } = useRoom();
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <Avatar emoji={p.emoji} size={size} dim={!p.connected} />
      <span className="truncate">
        {p.name}
        {id === state.me && <span className="text-indigo-400"> (אני)</span>}
      </span>
      {suffix}
    </span>
  );
}

// שורת אווטרים של מי כבר סיים/שלח
export function DoneRow({ ids, doneIds, label = 'מחכים ל...' }) {
  const done = new Set(doneIds);
  return (
    <div className="mt-4">
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <DoneBadge key={id} id={id} done={done.has(id)} />
        ))}
      </div>
    </div>
  );
}

function DoneBadge({ id, done }) {
  const p = usePlayer(id);
  return (
    <span
      className={`chip transition-all ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
      title={p.name}
    >
      <span className={done ? '' : 'opacity-50 grayscale'}>{p.emoji}</span>
      {p.name}
      {done ? ' ✓' : <span className="animate-pulse">…</span>}
    </span>
  );
}

// טיימר: השרת שולח כמה זמן נשאר, ואנחנו סופרים מקומית
export function Timer() {
  const { state, receivedAt } = useRoom();
  const deadline = state.timeLeft != null ? receivedAt + state.timeLeft : null;
  const totalRef = useRef({ deadline: null, total: 1 });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);

  if (!deadline) return null;
  if (!totalRef.current.deadline || Math.abs(totalRef.current.deadline - deadline) > 1500) {
    totalRef.current = { deadline, total: Math.max(1, state.timeLeft) };
  }
  const left = Math.max(0, deadline - now);
  const sec = Math.ceil(left / 1000);
  const frac = Math.min(1, left / totalRef.current.total);
  const urgent = sec <= 10;

  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-28 overflow-hidden rounded-full bg-indigo-100 sm:w-40">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${urgent ? 'bg-bubble' : 'bg-mint'}`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <span
        className={`min-w-[3ch] font-display text-2xl tabular-nums ${urgent ? 'animate-pulse text-bubble' : 'text-ink'}`}
      >
        {sec}
      </span>
    </div>
  );
}

// כותרת עליונה בכל משחק: שם, סיבוב, טיימר
// noTimer: בלי טיימר ובלי דילוג (במי יותר מהיר הספירה הייתה מגלה מתי יופיע הירוק)
export function GameHeader({ title, round, totalRounds, noTimer = false, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-indigo-100 pb-4">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
        {round != null && (
          <div className="text-sm font-semibold text-indigo-400">
            סיבוב {Math.max(1, round)} מתוך {totalRounds}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {!noTimer && <Timer />}
        {!noTimer && <SkipButton />}
      </div>
    </div>
  );
}

// המארח יכול לדלג על שלב (שימושי במיוחד כשמשחקים בלי זמן)
function SkipButton() {
  const { state } = useRoom();
  if (state.hostId !== state.me || !state.canSkip) return null;
  return (
    <button
      title="דילוג לשלב הבא"
      className="rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-500 hover:bg-indigo-100"
      onClick={() => confirm('לדלג לשלב הבא? מי שעוד לא ענה יפספס.') && socket.emit('host:skip')}
    >
      ⏭ דילוג
    </button>
  );
}

// כפתור "ערוך" אחרי שליחה - אפשר לשנות עד שכולם שלחו
export function EditButton({ onClick }) {
  return (
    <button className="mt-2 text-sm font-bold text-indigo-500 underline-offset-4 hover:text-grape hover:underline" onClick={onClick}>
      ✏️ שינוי התשובה
    </button>
  );
}

export function Waiting({ emoji = '⏳', children }) {
  return (
    <div className="flex flex-col items-center py-8 text-center animate-rise">
      <div className="mb-3 text-6xl animate-wiggle">{emoji}</div>
      <div className="font-display text-xl text-indigo-900">{children}</div>
    </div>
  );
}

export function NextButton({ label = 'הבא ←' }) {
  const { state, act } = useRoom();
  if (state.hostId !== state.me) {
    return (
      <p className="mt-4 text-center text-sm text-indigo-400">
        {state.settings.timed ? 'ממשיכים אוטומטית בעוד רגע…' : 'מחכים שהמארח ימשיך…'}
      </p>
    );
  }
  return (
    <div className="mt-5 flex justify-center">
      <button className="btn-primary" onClick={() => act('next')}>
        {label}
      </button>
    </div>
  );
}

export function RoundPoints({ points }) {
  const entries = Object.entries(points || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-center text-indigo-400">אף אחד לא קיבל נקודות הסיבוב 😅</p>;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {entries.map(([id, v]) => (
        <span key={id} className="chip animate-pop bg-amber-100 py-1.5 text-amber-900">
          <PlayerTag id={id} size="sm" />
          <span className="font-display text-lg">+{v}</span>
        </span>
      ))}
    </div>
  );
}

// כותב השאלה של הסיבוב (מטבע הסודות, מה חושבים עליך)
export function AskForm({ title, placeholder, maxLength = 120 }) {
  const { act } = useRoom();
  const [text, setText] = useState('');
  return (
    <form
      className="mx-auto max-w-xl animate-rise"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) act('ask', text);
      }}
    >
      <p className="mb-3 text-center font-display text-2xl">{title}</p>
      <div className="flex gap-2">
        <input className="input" autoFocus maxLength={maxLength} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-pink shrink-0" disabled={!text.trim()}>
          שליחה ✨
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-indigo-400">בסיבוב הזה אתם רק צופים 👀</p>
    </form>
  );
}
