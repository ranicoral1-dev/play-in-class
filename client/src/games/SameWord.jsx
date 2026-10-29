import { useState } from 'react';
import { useRoom, GameHeader, Waiting, DoneRow, NextButton, usePlayer, EditButton } from '../components/ui.jsx';

export default function SameWord({ g }) {
  return (
    <div className="card">
      <GameHeader title="🧠 אותה מילה" round={g.round || null} totalRounds={g.totalRounds}>
        {g.category && <span className="chip bg-violet-100 text-violet-800">קטגוריה: {g.category}</span>}
      </GameHeader>
      {g.phase === 'category' && <CategoryPhase g={g} />}
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
      {g.history.length > 1 && <History g={g} />}
    </div>
  );
}

function CategoryPhase({ g }) {
  const { act, state } = useRoom();
  const chooser = usePlayer(g.chooserId);
  const [cat, setCat] = useState('');
  if (g.chooserId !== state.me) return <Waiting emoji="🎯">{chooser.name} בוחר/ת קטגוריה…</Waiting>;
  return (
    <div className="mx-auto max-w-md animate-rise text-center">
      <p className="mb-4 font-display text-2xl">נבחרת לבחור קטגוריה! 🎯</p>
      <input
        className="input text-center font-display"
        autoFocus
        maxLength={40}
        placeholder="למשל: חיות, אוכל, מקומות…"
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && cat.trim() && act('category', cat)}
      />
      <button className="btn-primary mt-4 w-full" disabled={!cat.trim()} onClick={() => act('category', cat)}>
        קדימה!
      </button>
    </div>
  );
}

function Groups({ groups, points }) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {groups.map((grp, i) => {
        const matched = grp.ids.length >= 2;
        return (
          <div
            key={i}
            className={`animate-pop rounded-2xl px-4 py-2.5 text-center ${matched ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg' : 'bg-indigo-50'}`}
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="font-display text-2xl">{grp.word}</div>
            <div className="mt-1 flex flex-wrap justify-center gap-1">
              {grp.ids.map((id) => (
                <GroupMember key={id} id={id} />
              ))}
            </div>
            {points && matched && <div className="mt-1 font-display text-sun">+{grp.ids.length} לכל אחד</div>}
          </div>
        );
      })}
    </div>
  );
}

function GroupMember({ id }) {
  const p = usePlayer(id);
  return (
    <span className="text-lg" title={p.name}>
      {p.emoji}
    </span>
  );
}

function WritePhase({ g }) {
  const { act, state } = useRoom();
  const [word, setWord] = useState('');
  const [editing, setEditing] = useState(false);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);
  const first = !g.previous;
  const send = async () => {
    if (!word.trim()) return;
    if (!(await act('word', word)).error) setEditing(false);
  };

  return (
    <div className="animate-rise">
      {first ? (
        <p className="mb-4 text-center font-display text-2xl">
          {g.category ? `כתבו מילה שקשורה ל״${g.category}״` : 'כתבו מילה כלשהי - הראשונה שעולה לכם!'}
        </p>
      ) : (
        <>
          <p className="mb-3 text-center font-display text-2xl">איזו מילה מחברת בין כל אלה? 🔗</p>
          <Groups groups={g.previous.groups} />
        </>
      )}
      {g.myWord && !editing ? (
        <div className="text-center">
          <Waiting emoji="🤞">
            כתבת: <span className="text-grape">{g.myWord}</span> · מחכים לשאר…
          </Waiting>
          <EditButton
            onClick={() => {
              setWord(g.myWord);
              setEditing(true);
            }}
          />
        </div>
      ) : (
        <div className="mx-auto mt-6 flex max-w-md gap-2">
          <input
            className="input text-center font-display text-2xl"
            autoFocus
            maxLength={30}
            placeholder="המילה שלי"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn-mint shrink-0" disabled={!word.trim()} onClick={send}>
            שליחה
          </button>
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר כתב" />
    </div>
  );
}

function RevealPhase({ g }) {
  const last = g.previous;
  return (
    <div className="animate-rise text-center">
      {g.allMatch ? (
        <div className="mb-5 animate-pop">
          <div className="text-6xl">🎊🧠🎊</div>
          <h3 className="mt-2 font-display text-4xl text-grape">כולם אמרו אותה מילה!</h3>
        </div>
      ) : (
        <h3 className="mb-4 font-display text-2xl">מה כולם כתבו?</h3>
      )}
      {last && <Groups groups={last.groups} points={last.points} />}
      {!g.allMatch && last && last.groups.every((x) => x.ids.length < 2) && (
        <p className="mt-4 text-indigo-400">אף התאמה הפעם… ממשיכים! 💪</p>
      )}
      <NextButton label={g.allMatch || g.round >= g.totalRounds ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}

function History({ g }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border-t-2 border-dashed border-indigo-100 pt-4">
      <button className="text-sm font-bold text-indigo-400 hover:text-grape" onClick={() => setOpen((o) => !o)}>
        {open ? '▲' : '▼'} היסטוריית סיבובים
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {g.history.map((h) => (
            <div key={h.round} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="font-bold text-indigo-300">סיבוב {h.round}:</span>
              {h.groups.map((grp, i) => (
                <span key={i} className={`chip ${grp.ids.length >= 2 ? 'bg-violet-100 text-violet-800' : ''}`}>
                  {grp.word}
                  {grp.ids.length >= 2 && ` ×${grp.ids.length}`}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
