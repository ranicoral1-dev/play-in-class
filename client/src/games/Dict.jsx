import { useEffect, useRef, useState } from 'react';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, Waiting, DoneRow, EditButton, NextButton, RoundPoints } from '../components/ui.jsx';

export default function Dict({ g }) {
  return (
    <div className="card">
      <GameHeader title="📖 מילון מזויף" round={g.round} totalRounds={g.totalRounds} />
      <div className="mb-4 rounded-3xl bg-gradient-to-l from-amber-100 to-yellow-50 p-5 text-center">
        <div className="text-sm font-bold text-amber-700">מה פירוש המילה</div>
        <div className="animate-pop font-display text-5xl leading-tight text-amber-900">{g.word}</div>
      </div>
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase !== 'write' && <VotePhase g={g} key={g.round} />}
    </div>
  );
}

function WritePhase({ g }) {
  const { act } = useRoom();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const sent = g.myAnswer != null && !editing;
  const t = useRef();

  // טיוטה נשמרת בשרת, כדי שאם הזמן נגמר - מה שנכתב לא יאבד
  useEffect(() => {
    if (sent) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', text), 500);
    return () => clearTimeout(t.current);
  }, [text, sent, act]);

  const submit = async () => {
    if (!(await act('write', text)).error) setEditing(false);
  };

  return (
    <div className="animate-rise">
      {sent ? (
        <div className="text-center">
          <Waiting emoji="📮">ההגדרה נשלחה! מחכים לשאר…</Waiting>
          <p className="mx-auto max-w-xl rounded-2xl bg-indigo-50 px-4 py-2 text-lg">{g.myAnswer}</p>
          <EditButton
            onClick={() => {
              setText(g.myAnswer);
              setEditing(true);
            }}
          />
        </div>
      ) : (
        <>
          <p className="mb-3 text-center font-display text-xl">תמציאו הגדרה שנשמעת אמיתית 🤥</p>
          <form
            className="mx-auto flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) submit();
            }}
          >
            <input className="input" autoFocus maxLength={120} placeholder="למשל: כלי נגינה עתיק עם שלושה מיתרים" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-sky shrink-0" disabled={!text.trim()}>
              שליחה
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-indigo-400">יודעים מה זה באמת? תכתבו משהו אחר - ותמצאו אותה בשלב הבא (+2)</p>
        </>
      )}
      <DoneRow ids={g.writerIds} doneIds={g.submittedIds} label="מי כבר כתב" />
    </div>
  );
}

function VotePhase({ g }) {
  const { state, act } = useRoom();
  const revealed = g.phase === 'reveal';
  const name = (id) => state.players.find((p) => p.id === id);

  useEffect(() => {
    if (!revealed || g.myVote == null) return;
    if (g.list[g.myVote].real) success();
    else fail();
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-xl">
        {revealed ? 'וזו ההגדרה האמיתית:' : g.myVote != null ? 'נבחר! אפשר עוד לשנות עד שכולם בוחרים' : 'איזו הגדרה אמיתית? 🔍'}
      </p>
      <div className="space-y-2">
        {g.list.map((e, i) => {
          const selected = g.myVote === i;
          return (
            <button
              key={i}
              disabled={revealed || e.mine}
              onClick={() => act('vote', i)}
              className={`relative block w-full rounded-3xl p-4 text-right text-lg transition ${
                revealed && e.real
                  ? 'animate-pop bg-gradient-to-br from-emerald-100 to-green-50 ring-4 ring-emerald-400'
                  : selected
                    ? 'bg-sun/40 ring-4 ring-sun'
                    : e.mine
                      ? 'bg-amber-50 ring-2 ring-amber-200'
                      : revealed
                        ? 'bg-indigo-50'
                        : 'bg-indigo-50 hover:-translate-y-0.5 hover:bg-indigo-100'
              }`}
            >
              <div className="font-semibold">{e.text}</div>
              {e.mine && <span className="chip mt-1 bg-white text-xs">שלי 🤫</span>}
              {revealed && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {e.real ? <span className="chip bg-emerald-200 font-bold">✅ ההגדרה האמיתית</span> : <span>🤥 של <PlayerTag id={e.author} /></span>}
                  {e.voters.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      · בחרו:
                      {e.voters.map((id) => (
                        <span key={id} title={name(id)?.name}>
                          <Avatar emoji={name(id)?.emoji || '❔'} size="sm" />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {revealed ? (
        <div className="mt-5">
          <RoundPoints points={g.points} />
          <NextButton label={g.round >= g.totalRounds ? 'לטבלה הסופית 🏆' : 'למילה הבאה ←'} />
        </div>
      ) : (
        <DoneRow ids={g.voterIds} doneIds={g.votedIds} label="מי כבר בחר" />
      )}
    </div>
  );
}
