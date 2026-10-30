import { useEffect, useState } from 'react';
import { GAME_META } from '../lib.js';
import { beep } from '../sound.js';
import { useRoom } from './ui.jsx';

const COLORS = {
  3: { ring: '#FF5D8F', glow: 'rgba(255,93,143,0.55)' },
  2: { ring: '#3A86FF', glow: 'rgba(58,134,255,0.55)' },
  1: { ring: '#2EC4B6', glow: 'rgba(46,196,182,0.55)' },
  0: { ring: '#FFD23F', glow: 'rgba(255,210,63,0.65)' },
};
const SPARKS = ['✨', '⭐', '🎉', '💫', '🎈', '✨', '⭐', '🎊'];
const R = 88;
const CIRC = 2 * Math.PI * R;

// ספירה לאחור 3-2-1-0 לפני תחילת משחק. השרת קובע מתי, כדי שכולם יראו אותו מספר
export default function Countdown() {
  const { state, receivedAt } = useRoom();
  const deadline = receivedAt + (state.countdown ?? 0);
  const [now, setNow] = useState(Date.now());
  const meta = GAME_META[state.gameId];
  const me = state.players.find((p) => p.id === state.me);

  useEffect(() => {
    let raf;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const left = Math.max(0, deadline - now);
  const n = Math.max(0, Math.ceil(left / 1000) - 1);
  const frac = n === 0 ? 1 : (left % 1000 || 1000) / 1000;
  const c = COLORS[n];

  useEffect(() => {
    beep(n === 0 ? 990 : 520, n === 0 ? 0.45 : 0.18);
  }, [n]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-ink/80 backdrop-blur-md transition-[background] duration-500"
      style={{ backgroundImage: `radial-gradient(circle at 50% 50%, ${c.glow} 0%, transparent 55%)` }}
    >
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="pointer-events-none absolute text-3xl animate-float sm:text-4xl"
          style={{
            left: `${8 + ((i * 37) % 84)}%`,
            top: `${10 + ((i * 53) % 75)}%`,
            animationDelay: `${i * 0.35}s`,
          }}
        >
          {s}
        </span>
      ))}

      <div className="mb-6 flex items-center gap-3 rounded-full bg-white/10 px-5 py-2 text-white animate-rise">
        <span className="text-3xl">{meta?.emoji}</span>
        <span className="font-display text-2xl sm:text-3xl">{meta?.name}</span>
      </div>

      <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
        <span
          key={`pulse-${n}`}
          className="absolute inset-0 rounded-full animate-ping-once"
          style={{ boxShadow: `0 0 0 6px ${c.ring}` }}
        />
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={R} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={c.ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - frac)}
            style={{ filter: `drop-shadow(0 0 12px ${c.ring})` }}
          />
        </svg>
        <span
          key={n}
          className="relative font-display text-[9rem] leading-none text-white animate-count sm:text-[11rem]"
          style={{ textShadow: `0 0 40px ${c.ring}, 0 8px 0 rgba(0,0,0,0.25)` }}
        >
          {n}
        </span>
      </div>

      <div className="mt-8 h-12 font-display text-3xl text-white sm:text-4xl">
        {n === 0 ? (
          <span key="go" className="inline-block text-sun animate-pop">
            🚀 יאללה!
          </span>
        ) : (
          <span className="text-indigo-200">{me?.inGame ? 'מתכוננים…' : 'המשחק מתחיל - תצטרפו בסיבוב הבא 🍿'}</span>
        )}
      </div>
    </div>
  );
}
