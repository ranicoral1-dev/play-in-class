import { useEffect } from 'react';
import { pop, success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, NextButton, usePlayer } from '../components/ui.jsx';

export default function Count({ g }) {
  return (
    <div className="card">
      <GameHeader title="🔢 ספירה משותפת" round={g.round} totalRounds={g.totalRounds}>
        {g.collisions > 0 && <span className="chip bg-rose-100 text-rose-700">💥 {g.collisions}</span>}
      </GameHeader>
      {g.phase === 'count' && <CountPhase g={g} />}
      {g.phase === 'boom' && <Boom g={g} />}
      {g.phase === 'results' && <Results g={g} />}
    </div>
  );
}

function CountPhase({ g }) {
  const { act } = useRoom();
  const n = g.said.length;

  useEffect(() => {
    if (n > 0) pop();
  }, [n]);

  return (
    <div className="animate-rise text-center">
      <p className="text-indigo-500">
        {g.once ? 'כל אחד אומר מספר אחד בדיוק' : 'אפשר לומר כמה מספרים - רק לא פעמיים ברצף'} · בלי תורות ובלי לתאם 🤫
      </p>
      <div className="my-4 font-display tabular-nums">
        <span key={n} className="inline-block animate-pop text-8xl text-grape">
          {n}
        </span>
        <span className="text-3xl text-indigo-300"> / {g.target}</span>
      </div>
      <button
        className="btn-pink w-full max-w-sm py-6 text-3xl"
        disabled={!g.canSay}
        onPointerDown={(e) => {
          e.preventDefault();
          if (g.canSay) act('say', n + 1);
        }}
        style={{ touchAction: 'manipulation' }}
      >
        {g.canSay ? `אני אומר/ת ${n + 1}!` : g.once ? 'כבר אמרת מספר ✓' : 'חכו שמישהו אחר יגיד'}
      </button>
      <Trail said={g.said} />
      {g.best > 0 && <p className="mt-3 text-sm text-indigo-400">השיא בסיבוב הזה: {g.best}</p>}
    </div>
  );
}

function Trail({ said }) {
  if (!said.length) return null;
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {said.map((s) => (
        <SaidChip key={s.n} {...s} />
      ))}
    </div>
  );
}

function SaidChip({ n, pid }) {
  const p = usePlayer(pid);
  return (
    <span className="chip animate-pop bg-indigo-50 py-1" title={p.name}>
      <span className="font-display text-lg">{n}</span>
      <Avatar emoji={p.emoji} size="sm" />
    </span>
  );
}

function Boom({ g }) {
  useEffect(() => {
    fail();
  }, []);
  const [a, b] = g.boom.ids;
  return (
    <div className="animate-rise py-6 text-center">
      <div className="animate-shake text-8xl">💥</div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 font-display text-2xl">
        <PlayerTag id={a} size="md" /> ו־ <PlayerTag id={b} size="md" />
      </div>
      <p className="mt-2 font-display text-2xl">
        אמרו <span className="text-bubble">{g.boom.n}</span> באותו רגע!
      </p>
      <p className="mt-2 text-indigo-400">מתחילים מההתחלה…</p>
    </div>
  );
}

function Results({ g }) {
  const last = g.round >= g.totalRounds;
  useEffect(() => {
    (g.success ? success : fail)();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="animate-rise py-4 text-center">
      <div className="text-7xl">{g.success ? '🎉' : '⏰'}</div>
      <h3 className="mt-3 font-display text-3xl">
        {g.success ? `הגעתם ל-${g.target}!` : `נגמר הזמן - הכי רחוק: ${g.best} מתוך ${g.target}`}
      </h3>
      <p className="mt-2 text-indigo-500">
        {g.collisions === 0 ? 'בלי אף התנגשות 😮' : `${g.collisions} התנגשויות בדרך`}
      </p>
      <div className="mt-4 inline-block animate-pop rounded-3xl bg-amber-100 px-6 py-3 font-display text-2xl">
        +{g.points} לכולם
      </div>
      <Trail said={g.said} />
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}
