import { useEffect, useRef, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer, EditButton, Avatar } from '../components/ui.jsx';

const BLANK = '_____';
const BLANK_RE = /_{3,}/g;

export default function Complete({ g }) {
  return (
    <div className="card">
      <GameHeader title="✏️ המשך את המשפט" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-lime-100 text-lime-800">
          נותן המשפט: <PlayerTag id={g.giverId} />
        </span>
      </GameHeader>
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase === 'fill' && <FillPhase g={g} key={g.round} />}
      {g.phase === 'vote' && <VotePhase g={g} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
    </div>
  );
}

// המשפט עם המילים החסרות: ריקות (קו) או ממולאות (מודגשות)
function Sentence({ parts, words, className = '' }) {
  return (
    <p className={`text-xl leading-loose ${className}`}>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 &&
            (words ? (
              <span className="mx-1 rounded-lg bg-sun/60 px-2 py-0.5 font-bold">{words[i]}</span>
            ) : (
              <span className="mx-1 inline-block w-16 border-b-4 border-indigo-300 align-middle" />
            ))}
        </span>
      ))}
    </p>
  );
}

function WritePhase({ g }) {
  const { act } = useRoom();
  const giver = usePlayer(g.giverId);
  const [text, setText] = useState('');
  const ref = useRef();
  const t = useRef();
  const blanks = (text.match(BLANK_RE) || []).length;
  const hasWords = text.replace(BLANK_RE, '').trim().length > 0;

  // טיוטה נשמרת בשרת, כדי שאם הזמן נגמר - מה שנכתב לא יאבד
  useEffect(() => {
    if (!g.isGiver) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', text), 400);
    return () => clearTimeout(t.current);
  }, [text, g.isGiver, act]);

  // מכניסים מילה חסרה במקום שבו נמצא הסמן, ואפשר להמשיך לכתוב אחריה
  const putBlank = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const pre = before && !before.endsWith(' ') ? ' ' : '';
    const post = after.startsWith(' ') ? '' : ' ';
    const next = before + pre + BLANK + post + after;
    setText(next);
    const pos = (before + pre + BLANK + post).length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  if (!g.isGiver) {
    return <Waiting emoji="✍️">{giver.name} כותב/ת משפט עם מילים חסרות…</Waiting>;
  }
  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <p className="mb-1 text-center font-display text-2xl">כתבו משפט ✍️</p>
      <p className="mb-4 text-center text-indigo-500">
        איפה שתרצו (בהתחלה, באמצע או בסוף) לחצו על ״שים מילה״, וכולם ישלימו את מה שחסר. אפשר עד {g.maxBlanks}{' '}
        {g.maxBlanks === 1 ? 'מילה חסרה' : 'מילים חסרות'}.
      </p>
      <textarea
        ref={ref}
        className="input min-h-[96px] resize-none"
        placeholder="למשל: הדבר הכי מוזר שמצאתי בתיק היה _____"
        maxLength={160}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button className="btn-sky" disabled={blanks >= g.maxBlanks} onClick={putBlank}>
          ➕ שים מילה {BLANK}
        </button>
        <span className="chip">
          מילים חסרות: {blanks}/{g.maxBlanks}
        </span>
      </div>
      {blanks > 0 && (
        <div className="mt-4 rounded-3xl bg-indigo-50 p-4">
          <div className="label">ככה זה ייראה:</div>
          <Sentence parts={text.split(BLANK_RE)} />
        </div>
      )}
      <div className="mt-5 flex justify-center">
        <button
          className="btn-pink px-10"
          disabled={blanks < 1 || blanks > g.maxBlanks || !hasWords}
          onClick={() => act('submit', text)}
        >
          שליחה ✨
        </button>
      </div>
      {blanks > g.maxBlanks && <p className="mt-2 text-center text-sm text-rose-500">יותר מדי מילים חסרות (מקסימום {g.maxBlanks})</p>}
    </div>
  );
}

function FillPhase({ g }) {
  const { act } = useRoom();
  const n = g.parts.length - 1;
  const [words, setWords] = useState(() => Array(n).fill(''));
  const [editing, setEditing] = useState(false);
  const sent = g.myAnswer != null && !editing;
  const t = useRef();

  useEffect(() => {
    if (g.isGiver || sent) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', words), 400);
    return () => clearTimeout(t.current);
  }, [words, sent, g.isGiver, act]);

  const submit = async () => {
    if (!(await act('submit', words)).error) setEditing(false);
  };

  let body;
  if (g.isGiver) {
    body = (
      <>
        <Waiting emoji="🧩">כולם משלימים את המשפט שלך…</Waiting>
        <div className="rounded-3xl bg-indigo-50 p-4 text-center">
          <Sentence parts={g.parts} />
        </div>
      </>
    );
  } else if (sent) {
    body = (
      <div className="text-center">
        <Waiting emoji="📮">נשלח! מחכים לשאר המשלימים…</Waiting>
        <div className="rounded-3xl bg-indigo-50 p-4">
          <Sentence parts={g.parts} words={g.myAnswer} />
        </div>
        <EditButton
          onClick={() => {
            setWords(g.myAnswer);
            setEditing(true);
          }}
        />
      </div>
    );
  } else {
    body = (
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 text-center font-display text-2xl">השלימו את המשפט 🧩</p>
        <div className="rounded-3xl bg-indigo-50 p-4 text-xl leading-[3rem]">
          {g.parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < n && (
                <input
                  className="mx-1 inline-block w-40 rounded-xl border-2 border-indigo-200 bg-white px-2 py-1 text-center text-lg focus:border-grape"
                  placeholder={n > 1 ? `מילה ${i + 1}` : 'מילה'}
                  maxLength={40}
                  autoFocus={i === 0}
                  value={words[i]}
                  onChange={(e) => setWords((old) => old.map((x, k) => (k === i ? e.target.value : x)))}
                  onKeyDown={(e) => e.key === 'Enter' && words.every((x) => x.trim()) && submit()}
                />
              )}
            </span>
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <button className="btn-pink px-10" disabled={words.some((x) => !x.trim())} onClick={submit}>
            שליחה ✨
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      {body}
      <DoneRow ids={g.fillerIds} doneIds={g.submittedIds} label="מי כבר השלים" />
    </div>
  );
}

function VotePhase({ g }) {
  const { act, state } = useRoom();
  const giver = usePlayer(g.giverId);
  const canVote = g.voterIds.includes(state.me);

  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">
        {canVote ? 'מה הכי אהבתם? 💖' : `${giver.name} בוחר/ת את ההשלמה הכי טובה…`}
      </p>
      <p className="mb-4 text-center text-sm text-indigo-400">
        {g.allVote ? 'כולם מצביעים (אי אפשר להצביע לעצמך)' : 'רק נותן המשפט בוחר'} · כל קול = נקודה לכותב
      </p>
      <div className="space-y-3">
        {g.entries.map((e, i) => {
          const selected = g.myVote === i;
          const disabled = !canVote || e.mine;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => act('vote', i)}
              className={`relative block w-full rounded-3xl p-4 text-right transition
                ${e.mine ? 'bg-amber-50 ring-2 ring-sun' : selected ? 'bg-pink-100 ring-4 ring-bubble' : 'bg-indigo-50'}
                ${disabled ? 'cursor-default' : 'hover:-translate-y-0.5 hover:bg-indigo-100'}`}
            >
              <Sentence parts={g.parts} words={e.words} />
              {e.mine && <span className="chip mt-1 bg-white text-xs">שלי 🤫</span>}
              {selected && <span className="absolute left-4 top-4 animate-pop text-2xl">💖</span>}
            </button>
          );
        })}
      </div>
      <DoneRow ids={g.voterIds} doneIds={g.votedIds} label="מי כבר בחר" />
    </div>
  );
}

function RevealPhase({ g }) {
  const entries = (g.entries || []).map((e, i) => ({ ...e, i })).sort((a, b) => b.voters.length - a.voters.length);
  return (
    <div className="animate-rise">
      {!g.parts ? (
        <p className="mb-4 text-center font-display text-xl">לא נכתב משפט הסיבוב 😅</p>
      ) : entries.length === 0 ? (
        <>
          <p className="mb-4 text-center font-display text-xl">אף אחד לא השלים את המשפט 😅</p>
          <div className="rounded-3xl bg-indigo-50 p-4 text-center">
            <Sentence parts={g.parts} />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {entries.map((e, k) => (
            <div
              key={e.i}
              className={`rounded-3xl p-4 animate-rise ${e.voters.length && k === 0 ? 'bg-amber-50 ring-2 ring-sun' : 'bg-indigo-50'}`}
              style={{ animationDelay: `${k * 0.06}s` }}
            >
              <Sentence parts={g.parts} words={e.words} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1">
                  ✍️ <PlayerTag id={e.author} size="sm" />
                </span>
                {e.voters.length > 0 && (
                  <span className="flex items-center gap-1 text-pink-600">
                    💖 {e.voters.map((id) => <VoterAvatar key={id} id={id} />)}
                  </span>
                )}
                <span className="mr-auto font-display text-xl">+{e.voters.length}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="mb-2 mt-6 text-center font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton />
    </div>
  );
}

function VoterAvatar({ id }) {
  const p = usePlayer(id);
  return (
    <span title={p.name}>
      <Avatar emoji={p.emoji} size="sm" />
    </span>
  );
}
