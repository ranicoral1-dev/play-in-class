import { useEffect, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, NextButton, usePlayer, Avatar } from '../components/ui.jsx';

const RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const STREET_NAMES = { preflop: 'לפני הפלופ', flop: 'פלופ', turn: 'טרן', river: 'ריבר' };
const ACTION_NAMES = { fold: 'קיפל/ה', check: 'צ׳ק', call: 'השווה/תה', raise: 'העלה/תה ל-', allin: 'אול-אין! ' };

const sameCard = (a, b) => a.r === b.r && a.s === b.s;

export default function Poker({ g }) {
  return (
    <div className="card">
      <GameHeader title="🃏 פוקר" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip bg-emerald-100 text-emerald-800">קופה: 💰 {g.pot}</span>
      </GameHeader>
      <Table g={g} />
      {g.phase === 'bet' ? <MyTurn g={g} /> : <Results g={g} />}
    </div>
  );
}

function Card({ card, size = 'md', dim = false, glow = false }) {
  const sizes = { sm: 'h-12 w-9 text-sm', md: 'h-20 w-14 text-xl', lg: 'h-28 w-20 text-3xl' };
  if (!card) {
    return (
      <span
        className={`${sizes[size]} inline-flex shrink-0 rounded-lg border-2 border-white bg-gradient-to-br from-rose-600 to-rose-800 shadow`}
      />
    );
  }
  const red = card.s === '♥' || card.s === '♦';
  return (
    <span
      dir="ltr"
      className={`${sizes[size]} inline-flex shrink-0 animate-flip flex-col items-center justify-center rounded-lg bg-white font-display leading-none shadow
        ${red ? 'text-rose-600' : 'text-slate-900'} ${dim ? 'opacity-40' : ''} ${glow ? 'ring-4 ring-sun' : ''}`}
    >
      <span>{RANKS[card.r] || card.r}</span>
      <span>{card.s}</span>
    </span>
  );
}

function Table({ g }) {
  const { state } = useRoom();
  const winHand = winningCards(g);
  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] border-8 border-amber-900/80 bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-center text-white shadow-inner">
        <div className="mb-2 text-sm font-bold opacity-80">{g.phase === 'bet' ? STREET_NAMES[g.street] : 'סוף היד'}</div>
        <div className="flex justify-center gap-1.5 sm:gap-2">
          {Array.from({ length: 5 }, (_, i) =>
            g.board[i] ? (
              <Card key={i} card={g.board[i]} glow={winHand.some((c) => sameCard(c, g.board[i]))} />
            ) : (
              <span key={i} className="inline-flex h-20 w-14 rounded-lg border-2 border-dashed border-white/30" />
            ),
          )}
        </div>
        <div className="mt-3 font-display text-2xl">💰 {g.pot}</div>
        {g.lastAction && g.phase === 'bet' && <LastAction a={g.lastAction} />}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {g.players.map((p) => (
          <Seat key={p.id} p={p} g={g} me={p.id === state.me} winHand={winHand} />
        ))}
      </div>
    </div>
  );
}

// הקלפים של היד המנצחת (מודגשים)
function winningCards(g) {
  if (g.phase !== 'showdown' || !g.results?.showdown) return [];
  const main = g.results.pots[0]?.winners || [];
  return main.flatMap((id) => g.results.hands[id]?.cards || []);
}

function LastAction({ a }) {
  const p = usePlayer(a.id);
  const amount = a.type === 'raise' || a.type === 'allin' || a.type === 'call' ? ` ${a.amount}` : '';
  return (
    <div className="mt-1 text-sm opacity-90">
      {p.emoji} {p.name}: {ACTION_NAMES[a.type]}
      {amount}
    </div>
  );
}

function Seat({ p, g, me, winHand }) {
  const info = usePlayer(p.id);
  const turn = g.toAct === p.id;
  const won = g.results?.won?.[p.id] || 0;
  const hand = g.results?.hands?.[p.id];
  return (
    <div
      className={`relative rounded-3xl p-3 transition ${
        turn ? 'bg-amber-50 ring-4 ring-sun' : won ? 'bg-emerald-50 ring-2 ring-emerald-400' : me ? 'bg-indigo-50' : 'bg-slate-50'
      } ${!p.inHand || p.folded ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Avatar emoji={info.emoji} size="sm" dim={!info.connected} />
        <span className="flex-1 truncate font-semibold">
          {info.name}
          {me && <span className="text-indigo-400"> (אני)</span>}
        </span>
        {p.dealer && <Badge className="bg-white text-ink ring-1 ring-slate-300">D</Badge>}
        {p.sb && p.inHand && <Badge className="bg-sky-100 text-sky-700">SB</Badge>}
        {p.bb && p.inHand && <Badge className="bg-violet-100 text-violet-700">BB</Badge>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {p.inHand &&
            (p.cards
              ? p.cards.map((c, i) => <Card key={i} card={c} size="sm" glow={winHand.some((w) => sameCard(w, c))} dim={p.folded} />)
              : [0, 1].map((i) => <Card key={i} size="sm" />))}
        </div>
        <div className="text-left">
          <div className="font-display text-lg tabular-nums">💵 {p.chips}</div>
          {p.bet > 0 && g.phase === 'bet' && <div className="text-xs font-bold text-amber-700">הימור: {p.bet}</div>}
        </div>
      </div>
      <div className="mt-1 min-h-[1.25rem] text-xs font-bold">
        {!p.inHand ? (
          <span className="text-slate-400">{p.chips === 0 ? 'נגמר הכסף 💸' : 'לא ביד הזו'}</span>
        ) : p.folded ? (
          <span className="text-slate-500">קיפל/ה</span>
        ) : p.allIn && g.phase === 'bet' ? (
          <span className="text-rose-600">אול-אין!</span>
        ) : turn ? (
          <span className="animate-pulse text-amber-700">חושב/ת…</span>
        ) : null}
        {hand && <span className="text-indigo-600">{hand.name}</span>}
        {won > 0 && <span className="mr-1 text-emerald-700">+{won} 🏆</span>}
      </div>
    </div>
  );
}

function Badge({ className, children }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

function MyTurn({ g }) {
  const { act, state } = useRoom();
  const me = g.players.find((p) => p.id === state.me);
  const o = g.options;
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (o) setAmount(o.minRaiseTo);
  }, [o?.minRaiseTo, g.toAct, g.street]);

  if (!me?.inHand) return <p className="mt-4 text-center text-indigo-400">את/ה לא משחק/ת ביד הזו</p>;
  return (
    <div className="mt-5 rounded-3xl bg-indigo-50 p-4">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex gap-2">
          {me.cards?.map((c, i) => (
            <Card key={i} card={c} size="lg" dim={me.folded} />
          ))}
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-indigo-400">הכסף שלי</div>
          <div className="font-display text-3xl">💵 {me.chips}</div>
          {g.myHand && !me.folded && <div className="mt-1 chip bg-white text-indigo-700">יש לך: {g.myHand}</div>}
        </div>
      </div>

      {me.folded ? (
        <p className="mt-3 text-center font-display text-lg text-slate-500">קיפלת. מחכים לסוף היד…</p>
      ) : !o ? (
        <p className="mt-3 text-center font-display text-lg text-indigo-500">
          {me.allIn ? 'את/ה באול-אין! 🤞' : g.toAct && <>תור של <PlayerTag id={g.toAct} /></>}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-center font-display text-xl text-amber-700">התור שלך! 🎯</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button className="btn-ghost" onClick={() => act('fold')}>
              🏳️ קיפול
            </button>
            {o.canCheck ? (
              <button className="btn-mint" onClick={() => act('check')}>
                ✋ צ׳ק
              </button>
            ) : (
              <button className="btn-mint" onClick={() => act('call')}>
                {o.toCall >= me.chips ? `השוואה (אול-אין) ${o.toCall}` : `השוואה ${o.toCall}`}
              </button>
            )}
            <button className="btn-pink col-span-2 sm:col-span-1" onClick={() => confirm(`אול-אין עם ${me.chips}?`) && act('allin')}>
              🔥 אול-אין
            </button>
          </div>
          {o.canRaise && o.maxRaiseTo > o.minRaiseTo && (
            <div className="rounded-2xl bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-indigo-900/70">{o.currentBet ? 'העלאה ל:' : 'הימור:'}</span>
                <input
                  type="number"
                  dir="ltr"
                  className="w-28 rounded-xl border-2 border-indigo-100 px-2 py-1 text-center font-display text-xl"
                  min={o.minRaiseTo}
                  max={o.maxRaiseTo}
                  value={amount}
                  onChange={(e) => setAmount(+e.target.value)}
                />
              </div>
              <input
                type="range"
                className="w-full accent-pink-500"
                min={o.minRaiseTo}
                max={o.maxRaiseTo}
                step={1}
                value={Math.min(Math.max(amount, o.minRaiseTo), o.maxRaiseTo)}
                onChange={(e) => setAmount(+e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ['מינימום', o.minRaiseTo],
                  ['½ קופה', o.currentBet + Math.floor(g.pot / 2)],
                  ['קופה', o.currentBet + g.pot],
                ].map(([label, v]) => (
                  <button
                    key={label}
                    className="chip hover:bg-indigo-100"
                    onClick={() => setAmount(Math.min(o.maxRaiseTo, Math.max(o.minRaiseTo, v)))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="btn-sky mt-3 w-full"
                disabled={amount < o.minRaiseTo || amount > o.maxRaiseTo}
                onClick={() => act(amount === o.maxRaiseTo ? 'allin' : 'raise', amount)}
              >
                ⬆️ {o.currentBet ? `העלאה ל-${amount}` : `הימור ${amount}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Results({ g }) {
  const r = g.results;
  return (
    <div className="mt-5 animate-rise text-center">
      {r.pots.map((pot, i) => (
        <div key={i} className="mb-2 rounded-3xl bg-amber-50 p-4">
          {r.pots.length > 1 && <div className="text-sm font-bold text-amber-700">{i === 0 ? 'קופה ראשית' : `קופת צד ${i}`}</div>}
          <div className="flex flex-wrap items-center justify-center gap-2 font-display text-2xl">
            🏆
            {pot.winners.map((id) => (
              <PlayerTag key={id} id={id} size="md" />
            ))}
            <span>{pot.winners.length > 1 ? 'חולקים' : 'לוקח/ת'} 💰 {pot.amount}</span>
          </div>
          {r.showdown ? (
            <div className="mt-1 text-indigo-600">עם {r.hands[pot.winners[0]]?.name}</div>
          ) : (
            <div className="mt-1 text-indigo-600">כל השאר קיפלו</div>
          )}
        </div>
      ))}
      <p className="text-sm text-indigo-400">הקלפים של כולם גלויים למעלה 👆</p>
      <NextButton label="היד הבאה ←" />
    </div>
  );
}
