import { useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

export default function Party({ g }) {
  return (
    <div className="card">
      <GameHeader title="🎉 מי בא למסיבה?" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-amber-100 text-amber-900">
          המארח/ת: <PlayerTag id={g.hostId} />
        </span>
      </GameHeader>
      {g.isPartyHost && g.category && g.phase !== 'reveal' && (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-2 text-center">
          <span className="text-sm font-bold text-amber-700">הקטגוריה הסודית שלך: </span>
          <span className="font-display text-xl">{g.category}</span>
          {g.autoCategory && <span className="text-xs text-amber-600"> (נבחרה אוטומטית)</span>}
        </div>
      )}
      {g.phase === 'category' && <CategoryPhase g={g} />}
      {(g.phase === 'turn' || g.phase === 'review') && <PlayPhase g={g} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
    </div>
  );
}

function CategoryPhase({ g }) {
  const { act } = useRoom();
  const host = usePlayer(g.hostId);
  const [category, setCategory] = useState('');
  const [accepts, setAccepts] = useState('');
  if (!g.isPartyHost) return <Waiting emoji="🎈">{host.name} מתכנן/ת מסיבה סודית…</Waiting>;
  return (
    <div className="mx-auto max-w-lg animate-rise">
      <p className="mb-4 text-center font-display text-2xl">את/ה המארח/ת! מי מוזמן למסיבה?</p>
      <label className="label">קטגוריה סודית</label>
      <input className="input font-display" autoFocus maxLength={60} placeholder="למשל: בתים" value={category} onChange={(e) => setCategory(e.target.value)} />
      <label className="label mt-4">דוגמאות שכבר במסיבה (לא חובה, מופרדות בפסיק)</label>
      <textarea
        className="input min-h-[90px] text-base"
        placeholder="וילה, דירה, צריף, אוהל…"
        value={accepts}
        onChange={(e) => setAccepts(e.target.value)}
      />
      <p className="mt-1 text-xs text-indigo-400">כל האורחים יראו את הדוגמאות האלה כרמז. כל השאר יגיע אליך לאישור.</p>
      <button className="btn-primary mt-5 w-full" disabled={!category.trim()} onClick={() => act('category', { category, accepts })}>
        🎊 פותחים את הדלת!
      </button>
    </div>
  );
}

function EntryChip({ e }) {
  const styles = {
    in: 'bg-emerald-100 text-emerald-900',
    out: 'bg-rose-100 text-rose-800 line-through decoration-2',
    pending: 'bg-amber-100 text-amber-900 animate-pulse',
    wrong: 'bg-slate-100 text-slate-500',
    correct: 'bg-sun text-ink',
  };
  const p = usePlayer(e.pid);
  return (
    <span className={`chip animate-pop ${styles[e.status]}`} title={p.name}>
      {p.emoji} {e.type === 'category' ? `“${e.text}”?` : e.text}
    </span>
  );
}

// דוגמאות שהמארח נתן מראש - כולם רואים אותן כרמז
function HostExample({ id, text }) {
  const p = usePlayer(id);
  return (
    <span className="chip animate-pop border-2 border-dashed border-emerald-300 bg-white text-emerald-900" title={`דוגמה של ${p.name}`}>
      🎟️ {text}
    </span>
  );
}

function PlayPhase({ g }) {
  const { state } = useRoom();
  const inItems = g.entries.filter((e) => e.type === 'item' && e.status === 'in');
  const outItems = g.entries.filter((e) => e.type === 'item' && e.status === 'out');
  const catGuesses = g.entries.filter((e) => e.type === 'category' && e.status !== 'pending');
  const pending = g.pendingIdx != null && g.phase === 'review' ? g.entries[g.pendingIdx] : null;
  const myTurn = g.phase === 'turn' && g.currentId === state.me;
  const inParty = new Set(inItems.map((e) => e.pid));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
          <div className="mb-2 font-display text-lg text-emerald-700">🪩 בתוך המסיבה</div>
          <div className="flex flex-wrap gap-1.5">
            {g.accepts.map((a, i) => (
              <HostExample key={'h' + i} id={g.hostId} text={a} />
            ))}
            {inItems.map((e, i) => (
              <EntryChip key={i} e={e} />
            ))}
            {!inItems.length && !g.accepts.length && <span className="text-sm text-emerald-600/60">עוד אף אחד…</span>}
          </div>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50 p-4">
          <div className="mb-2 font-display text-lg text-rose-700">🚫 נשארו בחוץ</div>
          <div className="flex flex-wrap gap-1.5">
            {outItems.length ? outItems.map((e, i) => <EntryChip key={i} e={e} />) : <span className="text-sm text-rose-600/60">עוד אף אחד…</span>}
          </div>
          {catGuesses.length > 0 && (
            <div className="mt-3 border-t border-rose-100 pt-2">
              <div className="mb-1 text-xs font-bold text-slate-500">ניחושי קטגוריה שגויים</div>
              <div className="flex flex-wrap gap-1.5">
                {catGuesses.map((e, i) => (
                  <EntryChip key={i} e={e} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {pending ? (
        <ReviewBox g={g} entry={pending} />
      ) : myTurn ? (
        <MyTurn g={g} />
      ) : (
        <TurnBanner id={g.currentId} />
      )}

      <div className="flex flex-wrap gap-2">
        {g.guests.map((id) => (
          <span key={id} className={`chip ${id === g.currentId ? 'bg-sun' : ''}`}>
            <PlayerTag id={id} suffix={inParty.has(id) ? '🪩' : ''} />
            <span className="text-xs text-indigo-400">
              {g.turnsUsed[id] || 0}/{g.turnsPerGuest}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TurnBanner({ id }) {
  const p = usePlayer(id);
  return (
    <div className="rounded-3xl bg-indigo-50 p-5 text-center font-display text-xl">
      <span className="text-3xl">{p.emoji}</span> התור של {p.name}…
    </div>
  );
}

function MyTurn({ g }) {
  const { act, state } = useRoom();
  const [item, setItem] = useState('');
  const [cat, setCat] = useState('');
  const catLeft = g.maxCategoryGuesses - (g.catUsed[state.me] || 0);
  return (
    <div className="animate-pop rounded-3xl bg-sun/30 p-5">
      <p className="mb-3 text-center font-display text-2xl">התור שלך! 🎯</p>
      <div className="flex gap-2">
        <input
          className="input"
          autoFocus
          maxLength={60}
          placeholder="מה אני מביא/ה למסיבה?"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && item.trim() && act('item', item)}
        />
        <button className="btn-mint shrink-0" disabled={!item.trim()} onClick={() => act('item', item)}>
          להביא
        </button>
      </div>
      <div className="mt-4 border-t-2 border-dashed border-amber-300/60 pt-4">
        <label className="label">יודע/ת מה הקטגוריה? ({catLeft} ניחושים נשארו · +2 נקודות)</label>
        <div className="flex gap-2">
          <input
            className="input"
            maxLength={60}
            disabled={catLeft <= 0}
            placeholder="הקטגוריה היא…"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          />
          <button className="btn-pink shrink-0" disabled={!cat.trim() || catLeft <= 0} onClick={() => act('category', cat)}>
            ניחוש!
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewBox({ g, entry }) {
  const { act } = useRoom();
  const p = usePlayer(entry.pid);
  const isCat = entry.type === 'category';
  return (
    <div className="animate-pop rounded-3xl border-4 border-dashed border-amber-300 bg-amber-50 p-5 text-center">
      <div className="text-sm font-bold text-amber-700">
        {p.emoji} {p.name} {isCat ? 'מנחש/ת שהקטגוריה היא:' : 'רוצה להביא:'}
      </div>
      <div className="my-2 font-display text-3xl">{entry.text}</div>
      {g.isPartyHost ? (
        <div className="mt-3 flex justify-center gap-3">
          <button className="btn-mint" onClick={() => act('judge', true)}>
            {isCat ? '✅ נכון!' : '✅ נכנס/ת!'}
          </button>
          <button className="btn-pink" onClick={() => act('judge', false)}>
            {isCat ? '❌ לא' : '❌ לא מתאים'}
          </button>
        </div>
      ) : (
        <div className="text-indigo-400">המארח/ת מחליט/ה… 🧐</div>
      )}
    </div>
  );
}

function RevealPhase({ g }) {
  const host = usePlayer(g.hostId);
  const winner = usePlayer(g.winnerId);
  return (
    <div className="animate-rise text-center">
      <div className="text-sm font-bold text-indigo-400">הקטגוריה הייתה</div>
      <div className="my-2 animate-pop font-display text-4xl text-grape">{g.category}</div>
      <p className="mt-3 font-display text-xl">
        {g.winnerId ? `🎯 ${winner.name} פיצח/ה את הקטגוריה! (+2)` : `🕵️ אף אחד לא ניחש - ${host.name} מקבל/ת 5 נקודות!`}
      </p>
      <div className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-1.5">
        {g.entries
          .filter((e) => e.type === 'item' && e.status !== 'skip')
          .map((e, i) => (
            <EntryChip key={i} e={e} />
          ))}
      </div>
      <h3 className="mb-2 mt-6 font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton />
    </div>
  );
}
