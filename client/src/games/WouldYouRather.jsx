import { useEffect, useRef, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer, EditButton } from '../components/ui.jsx';

export default function WouldYouRather({ g }) {
  return (
    <div className="card bg-blue-100">
      <GameHeader title="🤔 מה אתה מעדיף" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-pink-100 text-pink-800">
          הקובע: <PlayerTag id={g.deciderId} />
        </span>
      </GameHeader>
      {g.phase === 'write' && <WritePhase g={g} />}
      {g.phase === 'vote' && <VotePhase g={g} />}
      {g.phase === 'guess' && <GuessPhase g={g} key={g.round} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
    </div>
  );
}

function WritePhase({ g }) {
  const { act } = useRoom();
  const decider = usePlayer(g.deciderId);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const t = useRef();

  // טיוטה נשמרת בשרת, כדי שאם הזמן נגמר - מה שנכתב לא יאבד
  useEffect(() => {
    if (!g.isDecider) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', { a, b }), 400);
    return () => clearTimeout(t.current);
  }, [a, b, g.isDecider, act]);

  if (!g.isDecider) {
    return <Waiting emoji="✍️">{decider.name} כותב/ת דילמה קשה…</Waiting>;
  }
  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-2xl">אתם הקובעים! מה אתם מעדיפים…</p>
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <input className="input border-pink-300 bg-blue-200/70 text-center focus:bg-blue-200" placeholder="אפשרות א׳" value={a} maxLength={80} onChange={(e) => setA(e.target.value)} autoFocus />
        <span className="text-center font-display text-2xl text-indigo-300">או</span>
        <input className="input border-sky-300 bg-blue-200/70 text-center focus:bg-blue-200" placeholder="אפשרות ב׳" value={b} maxLength={80} onChange={(e) => setB(e.target.value)} />
      </div>
      <div className="mt-5 flex justify-center">
        <button className="btn-pink px-10" disabled={!a.trim() || !b.trim()} onClick={() => act('submit', { a, b })}>
          שליחה ✨
        </button>
      </div>
    </div>
  );
}

function OptionCard({ label, text, color, selected, onClick, disabled, children }) {
  const colors = {
    A: 'from-pink-500 to-rose-500 shadow-[0_6px_0_#be185d]',
    B: 'from-sky-500 to-indigo-500 shadow-[0_6px_0_#3730a3]',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`relative min-h-[140px] rounded-3xl bg-gradient-to-br ${colors[color]} p-5 text-white transition-all
        ${disabled ? 'cursor-default' : 'hover:-translate-y-1 active:translate-y-1 active:shadow-none'}
        ${selected ? 'ring-4 ring-sun ring-offset-2' : ''}`}
    >
      <div className="absolute right-4 top-3 font-display text-lg opacity-70">{label}</div>
      <div className="flex h-full items-center justify-center font-display text-2xl leading-snug sm:text-3xl">{text}</div>
      {selected && <div className="absolute left-3 top-3 animate-pop text-2xl">✅</div>}
      {children}
    </button>
  );
}

function VotePhase({ g }) {
  const { act } = useRoom();
  const canVote = !g.isDecider;
  return (
    <div className="animate-rise">
      {g.autoOptions && <p className="mb-2 text-center text-sm text-indigo-400">(הזמן נגמר, אז בחרנו דילמה בשבילכם 😉)</p>}
      <p className="mb-4 text-center font-display text-2xl">{canVote ? 'מה אתם מעדיפים?' : 'מחכים שכולם יבחרו…'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <OptionCard label="א׳" color="A" text={g.options[0]} selected={g.myVote === 'A'} disabled={!canVote} onClick={() => act('vote', 'A')} />
        <OptionCard label="ב׳" color="B" text={g.options[1]} selected={g.myVote === 'B'} disabled={!canVote} onClick={() => act('vote', 'B')} />
      </div>
      <DoneRow ids={g.voterIds} doneIds={g.votedIds} label="מי כבר בחר" />
    </div>
  );
}

function CountsBar({ g }) {
  const total = g.counts.A + g.counts.B || 1;
  const pa = (g.counts.A / total) * 100;
  return (
    <div className="mb-5">
      <div className="flex h-12 overflow-hidden rounded-2xl font-display text-lg text-white">
        <div className="flex items-center justify-center bg-gradient-to-l from-pink-500 to-rose-500 transition-all duration-700" style={{ width: `${Math.max(pa, 12)}%` }}>
          {g.counts.A}
        </div>
        <div className="flex flex-1 items-center justify-center bg-gradient-to-l from-sky-500 to-indigo-500">{g.counts.B}</div>
      </div>
      <div className="mt-1 flex justify-between gap-4 text-sm font-semibold">
        <span className="truncate text-pink-600">א׳: {g.options[0]}</span>
        <span className="truncate text-indigo-600">ב׳: {g.options[1]}</span>
      </div>
    </div>
  );
}

function GuessPhase({ g }) {
  const { act, state } = useRoom();
  const targets = g.targets.filter((id) => id !== state.me);
  const [guesses, setGuesses] = useState(g.myGuesses || {});
  const [editing, setEditing] = useState(false);
  const submitted = !!g.myGuesses && !editing;
  const complete = targets.every((id) => guesses[id]);
  const allGuessers = state.players.filter((p) => p.inGame).map((p) => p.id);

  return (
    <div className="animate-rise">
      <CountsBar g={g} />
      <p className="mb-3 text-center font-display text-2xl">
        {submitted ? 'הניחושים נשלחו! 🤞' : 'מי בחר מה? נחשו!'}
      </p>
      <div className="space-y-2">
        {targets.map((id) => (
          <div key={id} className="flex items-center justify-between gap-3 rounded-2xl bg-blue-200 px-3 py-2">
            <PlayerTag id={id} />
            <div className="flex gap-2">
              {['A', 'B'].map((opt) => (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setGuesses((x) => ({ ...x, [id]: opt }))}
                  className={`rounded-xl px-4 py-2 font-display transition ${
                    guesses[id] === opt
                      ? opt === 'A'
                        ? 'bg-bubble text-white shadow-[0_3px_0_#c2185b]'
                        : 'bg-indigo-600 text-white shadow-[0_3px_0_#312e81]'
                      : 'bg-blue-400 text-white hover:bg-blue-500'
                  }`}
                >
                  {opt === 'A' ? 'א׳' : 'ב׳'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!submitted && targets.length > 0 && (
        <div className="mt-5 flex justify-center">
          <button
            className="btn-mint px-10"
            disabled={!complete}
            onClick={async () => !(await act('guess', guesses)).error && setEditing(false)}
          >
            שליחת ניחושים
          </button>
        </div>
      )}
      {submitted && targets.length > 0 && (
        <div className="text-center">
          <EditButton onClick={() => setEditing(true)} />
        </div>
      )}
      <DoneRow ids={allGuessers} doneIds={g.guessedIds} label="מי כבר ניחש" />
    </div>
  );
}

function RevealPhase({ g }) {
  const { state } = useRoom();
  const voters = g.voterIds.filter((id) => g.votes?.[id]);
  return (
    <div className="animate-rise">
      <div className="grid gap-4 sm:grid-cols-2">
        {['A', 'B'].map((opt, i) => (
          <div key={opt} className={`rounded-3xl p-4 ${opt === 'A' ? 'bg-pink-200' : 'bg-sky-200'}`}>
            <div className={`font-display text-xl ${opt === 'A' ? 'text-pink-600' : 'text-indigo-600'}`}>{g.options[i]}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {voters
                .filter((id) => g.votes[id] === opt)
                .map((id) => {
                  const myGuess = g.myGuesses?.[id];
                  const mark = id === state.me ? '' : myGuess ? (myGuess === opt ? ' ✅' : ' ❌') : '';
                  return (
                    <span key={id} className="chip animate-pop bg-blue-200 text-blue-950">
                      <PlayerTag id={id} suffix={mark} />
                    </span>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <h3 className="mb-2 mt-6 text-center font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton />
    </div>
  );
}
