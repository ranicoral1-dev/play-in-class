import { useEffect, useState } from 'react';
import { pop, success, ding } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, EditButton, usePlayer } from '../components/ui.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Auction({ g }) {
  const selling = g.phase === 'bid' || g.phase === 'sold';
  return (
    <div className="card">
      <GameHeader title={`🔨 מכירה פומבית: ${g.theme.emoji} ${g.theme.name}`}>
        {selling && (
          <span className="chip">
            פריט {g.index + 1} מתוך {g.total}
          </span>
        )}
        {g.phase === 'rate' && <span className="chip">שלב הדירוג</span>}
      </GameHeader>
      {g.phase === 'bid' && <BidPhase g={g} />}
      {g.phase === 'sold' && <SoldPhase g={g} />}
      {selling && (
        <>
          <MyBuild g={g} />
          <Wallets g={g} />
        </>
      )}
      {g.phase === 'rate' && <RatePhase g={g} key="rate" />}
      {g.phase === 'results' && <Results g={g} />}
      {selling && g.upcoming.length > 0 && (
        <p className="mt-4 text-center text-sm text-indigo-400">
          בהמשך: {g.upcoming.map((it) => `${it.e} ${it.name}`).join(' · ')}
          {g.total - g.index - 1 > g.upcoming.length ? ' · …' : ''}
        </p>
      )}
    </div>
  );
}

function ItemCard({ item, children }) {
  return (
    <div className="mx-auto flex max-w-md animate-pop flex-col items-center rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 p-5 text-center">
      <div className="text-7xl">{item.e}</div>
      <div className="mt-1 font-display text-3xl">{item.name}</div>
      {children}
    </div>
  );
}

function BidPhase({ g }) {
  const { state, act } = useRoom();
  const myMoney = g.money[state.me] ?? 0;
  const leading = g.leader === state.me;
  const min = g.leader ? g.price + g.jump : g.start;
  const offers = [...new Set([min, min + g.jump, min + 4 * g.jump])].filter((x) => x <= myMoney);

  useEffect(() => {
    if (g.leader) pop();
  }, [g.price, g.leader]);

  return (
    <div className="animate-rise" key={g.index}>
      <ItemCard item={g.item}>
        <div className="mt-3 font-display text-5xl tabular-nums text-grape" key={g.price}>
          <span className="inline-block animate-pop">${g.price}</span>
        </div>
        <div className="mt-2 min-h-[2.75rem]">
          {g.leader ? (
            <span className="chip bg-white py-1.5 text-base">
              🙋 <PlayerTag id={g.leader} size="sm" />
            </span>
          ) : (
            <span className="text-indigo-400">מחיר פתיחה - מי פותח?</span>
          )}
        </div>
      </ItemCard>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {leading ? (
          <div className="font-display text-xl text-emerald-600">ההצעה שלך הכי גבוהה! 🤞</div>
        ) : offers.length ? (
          offers.map((x, i) => (
            <button key={x} className={i === 0 ? 'btn-pink px-8 text-2xl' : 'btn-ghost text-xl'} onClick={() => act('bid', x)}>
              🙋 ${x}
            </button>
          ))
        ) : (
          <div className="font-display text-xl text-rose-500">אין לך מספיק כסף לפריט הזה 💸</div>
        )}
      </div>
      {g.bids.length > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-sm">
          {g.bids.slice(1).map((b) => (
            <span key={b.to} className="chip bg-slate-50 text-slate-400">
              <PlayerTag id={b.pid} size="sm" /> ${b.to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SoldPhase({ g }) {
  const { state } = useRoom();
  const winner = usePlayer(g.sold?.pid);
  useEffect(() => {
    if (g.sold?.pid === state.me) success();
    else if (g.sold) ding();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="animate-rise">
      <ItemCard item={g.item}>
        {g.sold ? (
          <div className="mt-3 font-display text-3xl">
            🔨 נמכר ל{winner.emoji} {winner.name} ב-<span className="text-grape">${g.sold.price}</span>!
          </div>
        ) : (
          <div className="mt-3 font-display text-2xl text-indigo-400">🤷 אף אחד לא רצה - לא נמכר</div>
        )}
      </ItemCard>
    </div>
  );
}

function MyBuild({ g }) {
  const { state } = useRoom();
  return (
    <div className="mt-6 rounded-3xl border-2 border-dashed border-indigo-100 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">
          {g.theme.emoji} ה{g.theme.name} שלי
        </span>
        <span className="font-display text-2xl text-emerald-600">${g.money[state.me] ?? 0}</span>
      </div>
      <Creation theme={g.theme} items={g.builds[state.me] || []} />
    </div>
  );
}

// היצירה: האימוג'י של מה שבונים באמצע, והפריטים שנקנו מסביב
function Creation({ theme, items, big = false }) {
  const size = big ? 220 : 170;
  const r = size / 2 - (big ? 26 : 20);
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <div className={`absolute inset-0 flex items-center justify-center ${big ? 'text-8xl' : 'text-7xl'}`}>{theme.emoji}</div>
        {items.map((it, i) => {
          const a = (i / Math.max(items.length, 1)) * 2 * Math.PI - Math.PI / 2;
          return (
            <span
              key={i}
              title={it.name}
              className={`absolute -translate-x-1/2 -translate-y-1/2 animate-pop ${big ? 'text-4xl' : 'text-3xl'}`}
              style={{ left: size / 2 + r * Math.cos(a), top: size / 2 + r * Math.sin(a) }}
            >
              {it.e}
            </span>
          );
        })}
      </div>
      {items.length ? (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {items.map((it, i) => (
            <span key={i} className="chip bg-white text-xs shadow-sm">
              {it.e} {it.name}
              <span className="text-indigo-300">${it.price}</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-indigo-300">עוד ריק…</p>
      )}
    </div>
  );
}

function Wallets({ g }) {
  const { state } = useRoom();
  const ids = Object.keys(g.money).filter((id) => id !== state.me);
  return (
    <div className="mt-4">
      <div className="label">💰 כמה כסף נשאר לכל אחד</div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <span key={id} className="chip bg-white py-1 shadow-sm">
            <PlayerTag id={id} size="sm" />
            <span className="font-display text-emerald-600">${g.money[id]}</span>
            <span className="text-xs text-indigo-300">· {g.builds[id].length} פריטים</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RatingButtons({ value, disabled, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`h-9 w-9 rounded-xl font-display transition ${
            value === n ? 'scale-110 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-white text-indigo-400 hover:bg-indigo-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function RatePhase({ g }) {
  const { state, act } = useRoom();
  const [ratings, setRatings] = useState(g.myRatings || {});
  const [editing, setEditing] = useState(false);
  const submitted = !!g.myRatings && !editing;
  const owners = Object.keys(g.builds);
  const others = owners.filter((id) => id !== state.me);
  const complete = others.every((id) => ratings[id]);

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-2xl">
        {submitted ? 'הדירוג נשלח! 🌟' : `דרגו כל ${g.theme.name} מ-1 עד 10`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {owners.map((id) => (
          <div key={id} className="rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <PlayerTag id={id} />
              <span className="text-sm text-emerald-600">נשאר ${g.money[id]}</span>
            </div>
            <Creation theme={g.theme} items={g.builds[id]} />
            {id !== state.me && (
              <div className="mt-3">
                <RatingButtons
                  value={ratings[id]}
                  disabled={submitted}
                  onChange={(n) => setRatings((r) => ({ ...r, [id]: n }))}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {submitted ? (
        <div className="text-center">
          <EditButton onClick={() => setEditing(true)} />
        </div>
      ) : (
        <div className="mt-5 flex justify-center">
          <button
            className="btn-mint px-10"
            disabled={!complete}
            onClick={async () => !(await act('rate', ratings)).error && setEditing(false)}
          >
            שליחת דירוג
          </button>
        </div>
      )}
      <DoneRow ids={owners} doneIds={g.ratedIds} label="מי כבר דירג" />
    </div>
  );
}

function Results({ g }) {
  if (!g.results) return <Waiting />;
  return (
    <div className="animate-rise space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {g.results.map((r, i) => (
          <div
            key={r.ownerId}
            style={{ animationDelay: `${i * 0.1}s` }}
            className={`animate-rise rounded-3xl p-3 ${
              r.rank === 1 ? 'bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun sm:col-span-2' : 'bg-indigo-50'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-display text-xl">
                <span className="text-3xl">{MEDALS[r.rank - 1] || `#${r.rank}`}</span>
                <PlayerTag id={r.ownerId} />
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-white">⭐ {r.votes ? r.avg : '-'}</span>
                <span className="chip bg-amber-200 font-display">+{r.points}</span>
              </div>
            </div>
            <Creation theme={g.theme} items={g.builds[r.ownerId]} big={r.rank === 1} />
          </div>
        ))}
      </div>
      <NextButton label="לטבלה הסופית 🏆" />
    </div>
  );
}
