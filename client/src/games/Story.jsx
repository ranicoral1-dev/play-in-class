import { useEffect, useRef, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton } from '../components/ui.jsx';

export default function Story({ g }) {
  const inVote = g.phase !== 'write';
  return (
    <div className="card">
      <GameHeader title="📜 סיפור בהמשכים" round={inVote ? null : g.round} totalRounds={g.totalRounds}>
        {inVote && <span className="chip">{g.phase === 'vote' ? 'שלב הדירוג' : 'תוצאות'}</span>}
      </GameHeader>
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase === 'vote' && <VotePhase g={g} />}
      {g.phase === 'results' && <ResultsPhase g={g} />}
    </div>
  );
}

function countWords(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function WritePhase({ g }) {
  const { act, state } = useRoom();
  const [text, setText] = useState('');
  const t = useRef();
  const words = countWords(text);
  const over = words > g.maxWords;
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  useEffect(() => {
    if (g.submitted) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', text), 500);
    return () => clearTimeout(t.current);
  }, [text, g.submitted, act]);

  return (
    <div className="animate-rise">
      {g.submitted ? (
        <Waiting emoji="📮">הקטע נשלח! מחכים לשאר הסופרים…</Waiting>
      ) : (
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-center font-display text-2xl">
            {g.prompt ? 'המשיכו את הסיפור מהמילה הזו:' : 'פתחו סיפור חדש! ✍️'}
          </p>
          <div className="flex flex-wrap items-start gap-2 rounded-3xl border-2 border-indigo-100 bg-indigo-50/60 p-3 focus-within:border-grape focus-within:bg-white">
            {g.prompt && <span className="mt-1.5 animate-pop rounded-xl bg-grape px-3 py-1 font-display text-xl text-white">{g.prompt}</span>}
            <textarea
              className="min-h-[110px] flex-1 resize-none bg-transparent text-xl leading-relaxed"
              autoFocus
              placeholder={g.prompt ? '...והמשך הסיפור' : 'היה היה פעם…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-sm font-bold ${over ? 'text-bubble' : 'text-indigo-400'}`}>
              {words}/{g.maxWords} מילים {over && '· רק המילים הראשונות יישמרו'}
            </span>
            <button className="btn-sky" disabled={!text.trim()} onClick={() => act('submit', text)}>
              שליחה ←
            </button>
          </div>
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר כתב" />
    </div>
  );
}

function VotePhase({ g }) {
  const { act, state } = useRoom();
  const [ratings, setRatings] = useState(g.myRatings || {});
  const submitted = !!g.myRatings;
  const toRate = g.stories.filter((s) => !s.mine);
  const complete = toRate.every((s) => ratings[s.idx]);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-2xl">{submitted ? 'הדירוג נשלח! 🌟' : 'קראו ודרגו כל סיפור מ-1 עד 10'}</p>
      <div className="space-y-4">
        {g.stories.map((s, k) => (
          <div key={s.idx} className="rounded-3xl bg-gradient-to-br from-indigo-50 to-sky-50 p-4 sm:p-5">
            <div className="mb-2 font-display text-lg text-indigo-400">
              סיפור #{k + 1} {s.mine && <span className="text-sm text-grape">· הסיפור שפתחת ✍️</span>}
            </div>
            <p className="text-lg leading-relaxed">{s.text}</p>
            {!s.mine && (
              <div className="mt-3 flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    disabled={submitted}
                    onClick={() => setRatings((r) => ({ ...r, [s.idx]: n }))}
                    className={`h-9 w-9 rounded-xl font-display transition ${
                      ratings[s.idx] === n ? 'scale-110 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-white text-indigo-400 hover:bg-indigo-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {!submitted && (
        <div className="mt-5 flex justify-center">
          <button className="btn-mint px-10" disabled={!complete} onClick={() => act('rate', ratings)}>
            שליחת דירוג
          </button>
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.votedIds} label="מי כבר דירג" />
    </div>
  );
}

function ResultsPhase({ g }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="animate-rise space-y-3">
      {g.results.map((r, i) => (
        <div
          key={r.idx}
          className={`rounded-3xl p-4 animate-rise sm:p-5 ${r.rank === 1 ? 'bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun' : 'bg-indigo-50'}`}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-xl">
              <span className="text-3xl">{medals[r.rank - 1] || `#${r.rank}`}</span>
              <PlayerTag id={r.ownerId} />
            </div>
            <div className="flex items-center gap-2">
              <span className="chip bg-white">⭐ {r.avg}</span>
              <span className="chip bg-amber-200 font-display">+{r.points}</span>
            </div>
          </div>
          <p className="text-lg leading-relaxed">{r.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-indigo-400">
            נכתב ע״י:
            {r.authors.map((a) => (
              <PlayerTag key={a} id={a} size="sm" className="text-xs" />
            ))}
          </div>
        </div>
      ))}
      <NextButton label="לטבלה הסופית 🏆" />
    </div>
  );
}
