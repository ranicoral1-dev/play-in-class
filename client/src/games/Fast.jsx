import { useEffect, useLayoutEffect, useRef } from 'react';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, DoneRow, NextButton } from '../components/ui.jsx';

const DECOY_BG = { blue: 'bg-azure', yellow: 'bg-sun', pink: 'bg-bubble', red: 'bg-red-600' };
const MEDALS = ['🥇', '🥈', '🥉'];

export default function Fast({ g }) {
  return (
    <div className="card">
      <GameHeader title="⚡ מי יותר מהיר" round={g.round} totalRounds={g.totalRounds} noTimer={g.phase !== 'results'} />
      {g.phase === 'results' ? <Results g={g} /> : <TapPad g={g} key={g.round} />}
    </div>
  );
}

function TapPad({ g }) {
  const { state, act } = useRoom();
  const goAt = useRef(null);
  const sent = useRef(false);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  // זמן התגובה נמדד כאן, מהרגע שהירוק הופיע על המסך הזה
  useLayoutEffect(() => {
    if (g.phase === 'go' && goAt.current == null) goAt.current = performance.now();
  }, [g.phase]);

  useEffect(() => {
    if (g.myTap?.early) fail();
  }, [g.myTap?.early]);

  function tap() {
    if (sent.current || g.myTap) return;
    sent.current = true;
    const data = g.phase === 'go' && goAt.current != null ? { ms: Math.round(performance.now() - goAt.current) } : undefined;
    act('tap', data).then((res) => {
      if (res.error) sent.current = false;
    });
  }

  // גם רווח במקלדת
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.target.matches?.('input, textarea')) return;
      e.preventDefault();
      tapRef.current();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const go = g.phase === 'go';
  const flash = g.flash;
  let bg = 'bg-slate-800';
  let content = (
    <>
      <div className="text-7xl">✋</div>
      <div className="mt-2 font-display text-3xl">{g.kind === 'emoji' ? 'חכו לאימוג׳י…' : 'חכו לירוק…'}</div>
    </>
  );
  if (go && g.kind !== 'emoji') {
    bg = 'bg-green-500';
    content = <div className="font-display text-6xl">👆 עכשיו!</div>;
  } else if (flash?.color) {
    bg = DECOY_BG[flash.color];
    content = null;
  } else if (flash?.emoji) {
    bg = go ? 'bg-green-500' : 'bg-white';
    content = (
      <div key={flash.id} className="animate-pop text-[7rem] leading-none">
        {flash.emoji}
      </div>
    );
  }
  if (g.myTap) {
    content = g.myTap.early ? (
      <>
        <div className="text-7xl">😬</div>
        <div className="mt-2 font-display text-3xl">מוקדם מדי! -1</div>
      </>
    ) : (
      <>
        <div className="text-6xl">⏱️</div>
        <div className="mt-2 font-display text-5xl tabular-nums" dir="ltr">
          {g.myTap.ms}ms
        </div>
      </>
    );
  }

  return (
    <div className="animate-rise">
      <p className="mb-3 text-center font-display text-xl">
        {g.kind === 'emoji' ? (
          <>
            לחצו רק כשמופיע <span className="text-4xl align-middle">{g.target}</span>
          </>
        ) : g.kind === 'decoy' ? (
          'רק על ירוק! 😈'
        ) : (
          'לחצו ברגע שהמסך נהיה ירוק'
        )}
      </p>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        className={`flex h-[55vh] max-h-[420px] w-full select-none flex-col items-center justify-center rounded-3xl text-white shadow-inner transition-colors duration-75 ${bg} ${
          g.myTap ? 'opacity-90' : ''
        } ${flash?.emoji && !go ? 'text-ink' : ''}`}
        style={{ touchAction: 'manipulation' }}
      >
        {content}
      </button>
      <DoneRow ids={ids} doneIds={g.tappedIds} label="מי כבר לחץ" />
    </div>
  );
}

function Results({ g }) {
  const { state } = useRoom();
  const last = g.round >= g.totalRounds;
  const mine = g.results.find((r) => r.id === state.me);

  useEffect(() => {
    if (mine?.points > 0) success();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-rise">
      <ul className="space-y-2">
        {g.results.map((r, i) => (
          <li
            key={r.id}
            style={{ animationDelay: `${i * 0.08}s` }}
            className={`flex animate-rise items-center gap-3 rounded-2xl px-3 py-2 ${
              r.early ? 'bg-rose-50' : r.missed ? 'bg-slate-50 text-slate-400' : i === 0 ? 'bg-amber-100 ring-4 ring-sun' : 'bg-indigo-50'
            }`}
          >
            <span className="w-8 text-center text-2xl">{r.ms != null ? MEDALS[i] || `#${i + 1}` : r.early ? '😬' : '💤'}</span>
            <PlayerTag id={r.id} className="flex-1" />
            <span className="font-display text-lg tabular-nums" dir="ltr">
              {r.ms != null ? `${r.ms}ms` : r.early ? 'מוקדם מדי' : 'לא לחץ'}
            </span>
            {r.points !== 0 && (
              <span className={`chip font-display ${r.points > 0 ? 'bg-amber-200' : 'bg-rose-200'}`}>
                {r.points > 0 ? `+${r.points}` : r.points}
              </span>
            )}
          </li>
        ))}
      </ul>
      <BestTimes best={g.best} />
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}

function BestTimes({ best }) {
  const entries = Object.entries(best).sort((a, b) => a[1] - b[1]).slice(0, 5);
  if (!entries.length) return null;
  return (
    <div className="mt-5 border-t-2 border-dashed border-indigo-100 pt-4">
      <div className="label">🏎️ הזמנים הכי טובים במשחק</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([id, ms]) => (
          <span key={id} className="chip bg-white py-1.5 shadow-sm">
            <PlayerTag id={id} size="sm" />
            <span className="font-display tabular-nums" dir="ltr">
              {ms}ms
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
