import { useEffect, useRef, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer, EditButton, Avatar } from '../components/ui.jsx';

export default function Quote({ g }) {
  return (
    <div className="card">
      <GameHeader title="💬 ציטוט" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-orange-100 text-orange-800">
          המנחש: <PlayerTag id={g.guesserId} />
        </span>
      </GameHeader>
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase === 'guess' && <GuessPhase g={g} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
    </div>
  );
}

function WritePhase({ g }) {
  const { act } = useRoom();
  const guesser = usePlayer(g.guesserId);
  const [lines, setLines] = useState(() => Array(g.perPerson).fill(''));
  const [editing, setEditing] = useState(false);
  const sent = g.mySentences != null && !editing;
  const t = useRef();

  // טיוטה נשמרת בשרת, כדי שאם הזמן נגמר - מה שנכתב לא יאבד
  useEffect(() => {
    if (g.isGuesser || sent) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', lines), 400);
    return () => clearTimeout(t.current);
  }, [lines, sent, g.isGuesser, act]);

  const submit = async () => {
    if (!(await act('submit', lines)).error) setEditing(false);
  };

  let body;
  if (g.isGuesser) {
    body = <Waiting emoji="🕵️">כולם כותבים משפטים… תתכוננו לזהות מי כתב מה!</Waiting>;
  } else if (sent) {
    body = (
      <div className="text-center">
        <Waiting emoji="📮">המשפטים נשלחו! מחכים לשאר הכותבים…</Waiting>
        <ul className="mx-auto max-w-xl space-y-2">
          {g.mySentences.map((s, i) => (
            <li key={i} className="rounded-2xl bg-indigo-50 px-4 py-2 text-lg">
              {s}
            </li>
          ))}
        </ul>
        <EditButton
          onClick={() => {
            setLines(g.mySentences);
            setEditing(true);
          }}
        />
      </div>
    );
  } else {
    body = (
      <div className="mx-auto max-w-2xl">
        <p className="mb-1 text-center font-display text-2xl">כתבו {g.perPerson === 1 ? 'משפט אחד' : `${g.perPerson} משפטים`} ✍️</p>
        <p className="mb-4 text-center text-indigo-500">{guesser.name} ינסה לנחש שאתם כתבתם אותם. תבלבלו אותו 😉</p>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <input
              key={i}
              className="input"
              placeholder={`משפט ${i + 1}`}
              maxLength={120}
              autoFocus={i === 0}
              value={line}
              onChange={(e) => setLines((old) => old.map((x, k) => (k === i ? e.target.value : x)))}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <button className="btn-pink px-10" disabled={lines.some((x) => !x.trim())} onClick={submit}>
            שליחה ✨
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      {body}
      <DoneRow ids={g.writerIds} doneIds={g.submittedIds} label="מי כבר כתב" />
    </div>
  );
}

function CandidateButtons({ g, idx, selected, disabled }) {
  const { act } = useRoom();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {g.candidates.map((id) => (
        <CandidateButton
          key={id}
          id={id}
          active={selected === id}
          disabled={disabled}
          onClick={() => act('pick', { idx, author: selected === id ? null : id })}
        />
      ))}
    </div>
  );
}

function CandidateButton({ id, active, disabled, onClick }) {
  const p = usePlayer(id);
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`chip py-1.5 transition ${
        active ? 'scale-105 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-white text-indigo-500'
      } ${disabled ? 'cursor-default' : active ? '' : 'hover:bg-indigo-100'}`}
    >
      <span>{p.emoji}</span>
      {p.name}
    </button>
  );
}

function GuessPhase({ g }) {
  const { act } = useRoom();
  const guesser = usePlayer(g.guesserId);
  const complete = g.items.every((item) => item.guess);
  const done = g.items.filter((item) => item.guess).length;

  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">
        {g.isGuesser ? 'מי כתב מה? 🕵️' : `${guesser.name} מנחש/ת מי כתב מה…`}
      </p>
      <p className="mb-4 text-center text-sm text-indigo-400">
        הוגרלו {g.items.length} משפטים מתוך {g.poolSize} · שויכו {done}/{g.items.length}
      </p>
      <div className="space-y-3">
        {g.items.map((item, i) => (
          <div key={i} className={`rounded-3xl p-4 ${item.mine ? 'bg-amber-50 ring-2 ring-sun' : 'bg-indigo-50'}`}>
            <div className="flex items-start gap-2">
              <span className="font-display text-lg text-indigo-300">#{i + 1}</span>
              <p className="flex-1 text-lg leading-relaxed">״{item.text}״</p>
              {item.mine && <span className="chip bg-white text-xs">המשפט שלי 🤫</span>}
            </div>
            <CandidateButtons g={g} idx={i} selected={item.guess} disabled={!g.isGuesser} />
          </div>
        ))}
      </div>
      {g.isGuesser && (
        <div className="mt-5 flex justify-center">
          <button className="btn-mint px-10" disabled={!complete} onClick={() => act('submit')}>
            סיימתי! חשיפה 🎭
          </button>
        </div>
      )}
    </div>
  );
}

function RevealPhase({ g }) {
  const right = g.items.filter((item) => item.guess === item.author).length;
  return (
    <div className="animate-rise">
      {g.items.length === 0 ? (
        <p className="mb-4 text-center font-display text-xl">אף אחד לא כתב משפטים הסיבוב 😅</p>
      ) : (
        <>
          <p className="mb-4 text-center font-display text-2xl">
            <PlayerTag id={g.guesserId} /> צדק/ה ב-{right} מתוך {g.items.length}
          </p>
          <div className="space-y-2">
            {g.items.map((item, i) => {
              const ok = item.guess === item.author;
              return (
                <div
                  key={i}
                  className={`rounded-3xl p-4 animate-rise ${ok ? 'bg-emerald-50' : 'bg-rose-50'}`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <p className="text-lg leading-relaxed">״{item.text}״</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1">
                      ✍️ נכתב ע״י <PlayerTag id={item.author} size="sm" />
                    </span>
                    {!ok && <Guessed id={item.guess} />}
                    <span className="mr-auto text-xl">{ok ? '✅' : '❌'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <h3 className="mb-2 mt-6 text-center font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton />
    </div>
  );
}

function Guessed({ id }) {
  const p = usePlayer(id);
  if (!id) return <span className="text-rose-500">לא נוחש</span>;
  return (
    <span className="flex items-center gap-1 text-rose-500">
      ניחוש: <Avatar emoji={p.emoji} size="sm" /> {p.name}
    </span>
  );
}
