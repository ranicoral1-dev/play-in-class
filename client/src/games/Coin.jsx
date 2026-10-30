import { useEffect, useState } from 'react';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, usePlayer } from '../components/ui.jsx';

const FLIP_MS = 2800;
const SIDES = { heads: { label: 'עץ', icon: '🌳' }, tails: { label: 'פלי', icon: '1' } };

export default function Coin({ g }) {
  return (
    <div className="card">
      <GameHeader title="🪙 מטבע הסודות" round={g.round} totalRounds={g.totalRounds} />
      {g.phase === 'choose' && <ChoosePhase g={g} />}
      {g.phase === 'call' && <CallPhase g={g} />}
      {g.phase === 'flip' && <FlipPhase g={g} key={g.round} />}
      <History g={g} />
    </div>
  );
}

function SecretQuestion({ question, label = '🤫 רק אתם רואים את השאלה' }) {
  return (
    <div className="mx-auto mb-5 max-w-xl animate-pop rounded-3xl bg-ink p-5 text-center text-white">
      <div className="mb-1 text-sm font-bold text-white/60">{label}</div>
      <div className="font-display text-2xl leading-snug sm:text-3xl">{question}</div>
    </div>
  );
}

function ChoosePhase({ g }) {
  const { state, act } = useRoom();
  const chooser = usePlayer(g.chooser);
  if (g.chooser !== state.me) {
    return <Waiting emoji="🤫">{chooser.name} קורא/ת שאלה סודית ובוחר/ת מישהו…</Waiting>;
  }
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);
  return (
    <div className="animate-rise">
      <SecretQuestion question={g.question} />
      <p className="mb-3 text-center font-display text-xl">מי התשובה? (אפשר גם את עצמך 😉)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ids.map((id) => (
          <button key={id} className="btn-ghost justify-start" onClick={() => act('choose', id)}>
            <PlayerTag id={id} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Picked({ g }) {
  const chooser = usePlayer(g.chooser);
  return (
    <div className="mb-5 text-center">
      <div className="text-lg text-indigo-500">{chooser.name} בחר/ה ב…</div>
      <div className="mt-2 inline-flex animate-pop items-center rounded-3xl bg-sun/40 px-5 py-3 font-display text-2xl">
        <PlayerTag id={g.target} size="lg" />
      </div>
    </div>
  );
}

function CallPhase({ g }) {
  const { state, act } = useRoom();
  const mine = g.chooser === state.me;
  return (
    <div className="animate-rise">
      <Picked g={g} />
      {mine ? (
        <>
          <SecretQuestion question={g.question} label="🤫 השאלה (עדיין סודית)" />
          <p className="mb-3 text-center font-display text-xl">עץ או פלי? אם צדקת - השאלה נשארת סודית!</p>
          <div className="flex justify-center gap-4">
            {Object.entries(SIDES).map(([side, s]) => (
              <button key={side} className="btn-primary px-8 py-4 text-2xl" onClick={() => act('call', side)}>
                {s.icon === '1' ? '🪙' : s.icon} {s.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Waiting emoji="🪙">מחכים שיבחר/תבחר עץ או פלי…</Waiting>
      )}
    </div>
  );
}

function CoinFace({ side, back }) {
  const s = SIDES[side];
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-8 border-amber-500 bg-gradient-to-br from-yellow-200 via-amber-300 to-amber-500 shadow-[inset_0_-8px_0_rgba(0,0,0,0.15)]"
      style={{ backfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : undefined }}
    >
      <span className="font-display text-5xl text-amber-800">{s.icon}</span>
      <span className="font-display text-xl text-amber-800">{s.label}</span>
    </div>
  );
}

function FlipPhase({ g }) {
  const { state, act } = useRoom();
  const [angle, setAngle] = useState(0);
  const [done, setDone] = useState(false);
  const mine = g.chooser === state.me;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAngle(360 * 6 + (g.coin === 'tails' ? 180 : 0)));
    const t = setTimeout(() => {
      setDone(true);
      (g.won ? success : fail)();
    }, FLIP_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-rise">
      <Picked g={g} />
      <p className="mb-4 text-center text-indigo-500">
        ניחוש: <b>{SIDES[g.call].label}</b>
      </p>
      <div className="mx-auto h-40 w-40" style={{ perspective: 800 }}>
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${angle}deg)`,
            transition: `transform ${FLIP_MS}ms cubic-bezier(.15,.6,.25,1)`,
          }}
        >
          <CoinFace side="heads" />
          <CoinFace side="tails" back />
        </div>
      </div>
      {done && (
        <div className="mt-5 animate-pop text-center">
          <div className="font-display text-3xl">
            יצא {SIDES[g.coin].label}! {g.won ? '🔒 השאלה נשארת סודית' : '😱 השאלה נחשפת:'}
          </div>
          {!g.won && <SecretQuestion question={g.question} label="השאלה הייתה" />}
          {g.won && mine && <SecretQuestion question={g.question} label="🤫 רק אתם יודעים" />}
          {(state.hostId === state.me || mine) && (
            <button className="btn-primary mt-4" onClick={() => act('next')}>
              לתור הבא ←
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function History({ g }) {
  if (!g.history.length) return null;
  return (
    <div className="mt-6 border-t-2 border-dashed border-indigo-100 pt-4">
      <div className="label">תורות קודמים</div>
      <ul className="space-y-1.5">
        {g.history.map((h, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50 px-3 py-2 text-sm">
            <PlayerTag id={h.chooser} size="sm" />
            <span className="text-indigo-400">←</span>
            <PlayerTag id={h.target} size="sm" />
            <span className="flex-1 text-left font-semibold">{h.won ? '🔒 סוד' : `😱 ${h.question}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
