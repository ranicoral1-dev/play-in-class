import { useEffect, useRef, useState } from 'react';
import { success } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, EditButton, usePlayer, AskForm } from '../components/ui.jsx';

export default function About({ g }) {
  return (
    <div className="card">
      <GameHeader title="🪞 מה חושבים עליך" round={g.round} totalRounds={g.totalRounds}>
        {g.asker && (
          <span className="chip bg-violet-100 text-violet-800">
            ✍️ כותב/ת השאלה: <PlayerTag id={g.asker} />
          </span>
        )}
      </GameHeader>
      <Subject g={g} />
      {g.phase === 'ask' && <AskPhase g={g} />}
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {(g.phase === 'pick' || g.phase === 'reveal') && <AnswersPhase g={g} key={g.round} />}
    </div>
  );
}

function Subject({ g }) {
  return (
    <div className="mb-4 rounded-3xl bg-gradient-to-l from-pink-100 to-violet-100 p-4 text-center">
      <div className="mb-2 text-sm font-bold text-indigo-500">{g.amSubject ? 'הסיבוב הזה עליך! 👀' : 'הסיבוב הזה על'}</div>
      <div className="inline-flex font-display text-2xl">
        <PlayerTag id={g.subject} size="lg" />
      </div>
      {g.question && <div className="mt-3 animate-pop font-display text-2xl leading-snug sm:text-3xl">{g.question}</div>}
    </div>
  );
}

function AskPhase({ g }) {
  const subject = usePlayer(g.subject);
  const asker = usePlayer(g.asker);
  if (g.amAsker) {
    return <AskForm title={`כתבו שאלה על ${subject.name}`} placeholder={`אם ${subject.name} היה/תה סרט, איזה סרט?`} maxLength={140} />;
  }
  return <Waiting emoji="✍️">{asker.name} כותב/ת שאלה{g.amSubject ? ' עליך' : ''}…</Waiting>;
}

function WritePhase({ g }) {
  const { act } = useRoom();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const sent = g.myAnswer != null && !editing;
  const t = useRef();

  useEffect(() => {
    if (sent || g.amSubject || g.amAsker) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', text), 500);
    return () => clearTimeout(t.current);
  }, [text, sent, act, g.amSubject, g.amAsker]);

  const submit = async () => {
    if (!(await act('write', text)).error) setEditing(false);
  };

  return (
    <div className="animate-rise">
      {g.autoQuestion && <p className="mb-3 text-center text-sm text-indigo-400">⏰ לא נכתבה שאלה בזמן - השאלה מהמשחק</p>}
      {g.amSubject ? (
        <Waiting emoji="👀">כולם כותבים עליך עכשיו… השאלה תיחשף כשכולם יסיימו</Waiting>
      ) : g.amAsker ? (
        <Waiting emoji="🍿">כולם עונים על השאלה שלך… בסיבוב הזה אתם צופים</Waiting>
      ) : sent ? (
        <div className="text-center">
          <Waiting emoji="📮">נשלח! מחכים לשאר…</Waiting>
          <p className="mx-auto max-w-xl rounded-2xl bg-indigo-50 px-4 py-2 text-lg">{g.myAnswer}</p>
          <EditButton
            onClick={() => {
              setText(g.myAnswer);
              setEditing(true);
            }}
          />
        </div>
      ) : (
        <form
          className="mx-auto flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit();
          }}
        >
          <input className="input" autoFocus maxLength={120} placeholder="התשובה שלך (אף אחד לא יידע שזה אתם 🤫)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-sky shrink-0" disabled={!text.trim()}>
            שליחה
          </button>
        </form>
      )}
      <DoneRow ids={g.writerIds} doneIds={g.submittedIds} label="מי כבר כתב" />
    </div>
  );
}

function AnswersPhase({ g }) {
  const { state, act } = useRoom();
  const subject = usePlayer(g.subject);
  const [choice, setChoice] = useState(null);
  const picking = g.phase === 'pick' && g.amSubject;
  const revealed = g.phase === 'reveal';

  useEffect(() => {
    if (revealed && g.picked != null) success();
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g.answers.length) return <Waiting emoji="🦗">אף אחד לא כתב כלום הסיבוב…</Waiting>;

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-xl">
        {picking
          ? 'איזו תשובה הכי אהבת - או הכי רוצה לדעת מי כתב?'
          : revealed
            ? g.randomPick
              ? 'הזמן נגמר - נבחרה תשובה אקראית 🎲'
              : `${subject.name} בחר/ה:`
            : `מחכים ש${subject.name} יבחר/תבחר תשובה…`}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {g.answers.map((a) => {
          const isPicked = revealed && a.idx === g.picked;
          return (
            <button
              key={a.idx}
              disabled={!picking}
              onClick={() => setChoice(a.idx)}
              className={`rounded-3xl p-4 text-right text-lg transition ${
                isPicked
                  ? 'animate-pop bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun sm:col-span-2'
                  : revealed
                    ? 'bg-slate-50 text-slate-400'
                    : choice === a.idx
                      ? 'bg-sun/40 ring-4 ring-sun'
                      : picking
                        ? 'bg-indigo-50 hover:bg-indigo-100'
                        : 'bg-indigo-50'
              }`}
            >
              <div className="font-semibold">{a.text}</div>
              {a.mine && !isPicked && <div className="mt-1 text-xs font-bold text-grape">· שלך (רק אתם רואים)</div>}
              {isPicked && (
                <div className="mt-3 flex items-center gap-2 text-base">
                  נכתב ע״י: <PlayerTag id={g.author} />
                  <span className="chip bg-amber-200 font-display">+2</span>
                </div>
              )}
              {revealed && !isPicked && <div className="mt-1 text-xs">❓ נשאר סוד</div>}
            </button>
          );
        })}
      </div>
      {picking && (
        <div className="mt-5 flex justify-center">
          <button className="btn-pink px-10" disabled={choice == null} onClick={() => act('pick', choice)}>
            מי כתב את זה? 🔍
          </button>
        </div>
      )}
      {revealed && (state.hostId === state.me || g.amSubject) && (
        <div className="mt-5 flex justify-center">
          <button className="btn-primary" onClick={() => act('next')}>
            {g.round >= g.totalRounds ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'}
          </button>
        </div>
      )}
    </div>
  );
}
