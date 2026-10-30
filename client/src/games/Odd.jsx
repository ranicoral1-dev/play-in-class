import { useEffect, useState } from 'react';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

export default function Odd({ g }) {
  const oddName = g.white ? 'איש לבן' : 'מתחזה';
  return (
    <div className="card">
      <GameHeader title="🕵️ מי השונה" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-stone-100 text-stone-800">
          {g.white ? '🤍' : '🕵️'} {g.oddsCount} {g.oddsCount > 1 ? (g.white ? 'אנשים לבנים' : 'מתחזים') : oddName}
        </span>
        {g.phase !== 'end' && <span className="chip">סבב {g.cycle}</span>}
      </GameHeader>
      {!g.inRound ? (
        <Waiting emoji="🍿">הסיבוב התחיל בלעדיכם - תצטרפו בסיבוב הבא 🙂</Waiting>
      ) : (
        <>
          {g.phase !== 'end' && <WordCard g={g} key={g.round} />}
          {g.phase === 'describe' && <DescribePhase g={g} />}
          {g.phase === 'vote' && <VotePhase g={g} />}
          {g.phase === 'result' && <ResultPhase g={g} />}
          {g.phase === 'end' && <EndPhase g={g} />}
          {g.phase !== 'end' && <History g={g} />}
        </>
      )}
    </div>
  );
}

// המילה מוסתרת בלחיצה, כדי שמי שיושב לידכם לא יציץ
function WordCard({ g }) {
  const [hidden, setHidden] = useState(false);
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-3xl p-4 ${hidden ? 'bg-slate-100' : g.amWhite ? 'bg-stone-800 text-white' : 'bg-sun/40'}`}>
      <span className="text-4xl">{hidden ? '🙈' : g.amWhite ? '🤍' : '🔤'}</span>
      <div className="flex-1">
        {hidden ? (
          <div className="font-display text-xl">המילה מוסתרת</div>
        ) : g.amWhite ? (
          <>
            <div className="font-display text-2xl">אתם האיש הלבן!</div>
            <p className="text-sm">
              אין לכם מילה. הקטגוריה: <b className="font-display text-lg">{g.category || 'לא ידועה 🤷'}</b>. תתארו כאילו אתם יודעים - ואל תיתפסו!
            </p>
          </>
        ) : (
          <>
            <div className="text-sm font-bold opacity-70">המילה שלכם</div>
            <div className="font-display text-3xl">{g.myWord}</div>
            {!g.white && <p className="text-xs opacity-70">אולי יש לכם מילה קצת אחרת משל כולם… ואולי לא 🤔</p>}
          </>
        )}
        {g.myOut && <p className="mt-1 text-sm font-bold">הודחתם - עכשיו רק צופים 👀</p>}
      </div>
      <button className="rounded-xl bg-white/70 px-3 py-1.5 text-sm font-bold text-ink" onClick={() => setHidden((h) => !h)}>
        {hidden ? '👁 הצגה' : '🙈 הסתרה'}
      </button>
    </div>
  );
}

function Descriptions({ order, descs, out, current }) {
  return (
    <div className="space-y-1.5">
      {order.map((id) => (
        <div
          key={id}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
            out[id] ? 'bg-slate-50 opacity-50' : id === current ? 'animate-pulse bg-sun/40' : 'bg-indigo-50'
          }`}
        >
          <PlayerTag id={id} className="w-32 shrink-0" />
          <span className="flex-1 font-semibold">
            {out[id] ? '❌ הודח/ה' : descs[id] ? `״${descs[id]}״` : id === current ? 'מתאר/ת…' : <span className="text-indigo-300">…</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function DescribePhase({ g }) {
  const { state, act } = useRoom();
  const [text, setText] = useState('');
  const current = usePlayer(g.current);
  const mine = g.current === state.me;

  async function send() {
    const res = await act('describe', text);
    if (!res.error) setText('');
  }

  return (
    <div className="animate-rise">
      {mine ? (
        <div className="mb-4 animate-pop rounded-3xl bg-sun/30 p-5">
          <p className="mb-3 text-center font-display text-2xl">התור שלכם לתאר! ✍️</p>
          <div className="flex gap-2">
            <input
              className="input"
              autoFocus
              maxLength={80}
              placeholder="מילה או משפט קצר - בלי לגלות יותר מדי…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && text.trim() && send()}
            />
            <button className="btn-mint shrink-0" disabled={!text.trim()} onClick={send}>
              שליחה
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-center font-display text-xl">
          {current.emoji} {current.name} מתאר/ת…
        </p>
      )}
      <Descriptions order={g.order} descs={g.descs} out={g.out} current={g.current} />
    </div>
  );
}

function VotePhase({ g }) {
  const { state, act } = useRoom();
  const alive = g.order.filter((id) => !g.out[id]);
  const canVote = !g.myOut;
  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">מי השונה? 🗳️</p>
      <p className="mb-4 text-center text-sm text-indigo-400">לא בטוחים? אפשר לדלג - ואם רוב מדלגים (או תיקו) יש עוד סבב תיאורים</p>
      <Descriptions order={g.order} descs={g.descs} out={g.out} />
      {canVote ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {alive
            .filter((id) => id !== state.me)
            .map((id) => (
              <VoteButton key={id} id={id} active={g.myVote === id} onClick={() => act('vote', id)} />
            ))}
          <button
            onClick={() => act('vote', 'skip')}
            className={`rounded-2xl px-3 py-2.5 font-display transition ${
              g.myVote === 'skip' ? 'scale-[1.02] bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            ⏭ דילוג - עוד סבב
          </button>
        </div>
      ) : (
        <Waiting emoji="👀">הודחתם - מחכים להצבעה של השאר</Waiting>
      )}
      <DoneRow ids={alive} doneIds={g.votedIds} label="מי כבר הצביע" />
    </div>
  );
}

function VoteButton({ id, active, onClick }) {
  const p = usePlayer(id);
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-right font-semibold transition ${
        active ? 'scale-[1.02] bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-indigo-50 hover:bg-indigo-100'
      }`}
    >
      <span className="text-2xl">{p.emoji}</span>
      <span className="flex-1 truncate">{p.name}</span>
    </button>
  );
}

const OUTCOMES = {
  normal: { emoji: '🎉', color: 'bg-emerald-100 text-emerald-900' },
  odd: { emoji: '🕵️', color: 'bg-rose-100 text-rose-900' },
};

function outcomeText(g) {
  const odd = g.white ? 'האיש הלבן' : 'המתחזה';
  if (g.outcome === 'normal') return `תפסתם את כל השונים! (+2 לכל מי שלא היה ${odd})`;
  return `${g.oddsCount > 1 ? (g.white ? 'האנשים הלבנים' : 'המתחזים') : odd} ניצח${g.oddsCount > 1 ? 'ו' : ''}! (+5)`;
}

function ResultPhase({ g }) {
  const v = g.lastVote;
  const outP = usePlayer(v.outId);
  const odd = g.white ? 'איש לבן' : 'מתחזה';
  useEffect(() => {
    if (v.outId) (v.wasOdd ? success : fail)();
  }, []);
  return (
    <div className="animate-rise text-center">
      {v.outId ? (
        <div className={`animate-pop rounded-3xl p-5 font-display text-2xl ${v.wasOdd ? 'bg-emerald-100' : 'bg-rose-100'}`}>
          {outP.emoji} {outP.name} הודח/ה… {v.wasOdd ? `וזה היה ${odd}! 🎯` : `אבל זה לא היה ${odd} 😬`}
        </div>
      ) : (
        <div className="animate-pop rounded-3xl bg-indigo-50 p-5 font-display text-2xl">
          {v.tally.skip ? '⏭ דילגתם' : '🤝 תיקו'} - אף אחד לא הודח
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {Object.entries(v.votes).map(([voter, target]) => (
          <VoteChip key={voter} voter={voter} target={target} />
        ))}
      </div>
      {g.outcome ? (
        <div className={`mt-4 rounded-3xl p-4 font-display text-xl ${OUTCOMES[g.outcome].color}`}>
          {OUTCOMES[g.outcome].emoji} {outcomeText(g)}
        </div>
      ) : (
        <p className="mt-4 font-display text-lg text-indigo-500">ממשיכים לעוד סבב תיאורים 🔁</p>
      )}
      <NextButton label={g.outcome ? 'לתוצאות הסיבוב ←' : 'לסבב הבא ←'} />
    </div>
  );
}

function VoteChip({ voter, target }) {
  const a = usePlayer(voter);
  const b = usePlayer(target);
  return (
    <span className="chip">
      {a.emoji} {a.name} ← {target === 'skip' ? '⏭' : `${b.emoji} ${b.name}`}
    </span>
  );
}

function EndPhase({ g }) {
  return (
    <div className="animate-rise text-center">
      <div className={`rounded-3xl p-4 font-display text-2xl ${OUTCOMES[g.outcome].color}`}>
        {OUTCOMES[g.outcome].emoji} {outcomeText(g)}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-indigo-50 p-4">
          <div className="text-sm font-bold text-indigo-400">המילה של כולם</div>
          <div className="font-display text-3xl">{g.word}</div>
        </div>
        <div className="rounded-3xl bg-stone-800 p-4 text-white">
          <div className="text-sm font-bold opacity-70">{g.white ? 'הקטגוריה של האיש הלבן' : 'המילה של המתחזה'}</div>
          <div className="font-display text-3xl">{g.white ? g.category || '—' : g.oddWord}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="font-bold">{g.white ? '🤍 האיש הלבן:' : '🕵️ המתחזה:'}</span>
        {g.odds.map((id) => (
          <span key={id} className="chip bg-stone-100">
            <PlayerTag id={id} />
          </span>
        ))}
      </div>
      <h3 className="mb-2 mt-6 font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton label={g.round >= g.totalRounds ? 'לסיכום 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}

// תיאורים מסבבים קודמים באותו סיבוב
function History({ g }) {
  const past = g.history.filter((h) => h.cycle < g.cycle);
  if (!past.length || g.phase === 'result') return null;
  return (
    <details className="mt-5 rounded-3xl border-2 border-indigo-100 p-3">
      <summary className="cursor-pointer font-display">📜 סבבים קודמים ({past.length})</summary>
      <div className="mt-3 space-y-4">
        {past.map((h) => (
          <div key={h.cycle}>
            <div className="label">סבב {h.cycle}</div>
            <Descriptions order={g.order} descs={h.descs} out={{}} />
          </div>
        ))}
      </div>
    </details>
  );
}
