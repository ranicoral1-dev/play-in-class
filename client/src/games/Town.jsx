import { useEffect, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

const ROLES = {
  imposter: {
    name: 'מתחזה',
    emoji: '🔪',
    color: 'bg-rose-100 text-rose-900',
    desc: 'כל לילה בוחרים מישהו לחסל. +1 על כל שוטר, חובש או מנעולן שחוסל. חיסלתם את כל השוטרים? ניצחתם (+3)!',
    verb: 'את מי מחסלים הלילה? 🔪',
  },
  police: {
    name: 'שוטר',
    emoji: '👮',
    color: 'bg-sky-100 text-sky-900',
    desc: 'כל לילה עוצרים מישהו. עצרתם מתחזה? +5. עצרתם מישהו אחר? רק המנעולן יוציא אותו מהכלא.',
    verb: 'את מי עוצרים הלילה? 🚔',
  },
  locker: {
    name: 'מנעולן',
    emoji: '🔑',
    color: 'bg-amber-100 text-amber-900',
    desc: 'כל לילה משחררים מישהו מהכלא - מישהו שכבר שם, או מישהו שאתם חושבים שייעצר הלילה.',
    verb: 'את מי משחררים הלילה? 🔓',
  },
  medic: {
    name: 'חובש',
    emoji: '🩺',
    color: 'bg-emerald-100 text-emerald-900',
    desc: 'כל לילה מרפאים מישהו (אפשר גם את עצמכם). אם הוא חוסל הלילה - הוא חוזר לחיים, ואתם מקבלים +3.',
    verb: 'את מי מרפאים הלילה? 💉',
  },
  jester: {
    name: 'ליצן',
    emoji: '🤡',
    color: 'bg-fuchsia-100 text-fuchsia-900',
    desc: 'אין לכם פעולה - אבל אתם רוצים שיחסלו אתכם (+3) או יעצרו אתכם (+5)! אם ריפאו או שחררו אתכם: −1.',
    verb: 'במי אתם חושדים? (לא משפיע - רק בשביל ההסוואה)',
  },
  civilian: {
    name: 'אזרח',
    emoji: '🧑',
    color: 'bg-slate-100 text-slate-800',
    desc: 'אין לכם פעולה - פשוט שורדים וצופים. +1 על כל יום שאתם שורדים (כמו כולם).',
    verb: 'במי אתם חושדים? (לא משפיע - רק בשביל ההסוואה)',
  },
};

const STATUS = { free: '', jailed: '🔒', dead: '💀' };

export default function Town({ g }) {
  const night = g.phase === 'night';
  return (
    <div className="card">
      <GameHeader title="🏘️ עיירה" round={g.round} totalRounds={g.totalRounds}>
        {g.phase !== 'end' && (
          <span className={`chip ${night ? 'bg-indigo-900 text-white' : 'bg-amber-100 text-amber-900'}`}>
            {night ? '🌙 לילה' : '☀️ בוקר'} · יום {g.day}
          </span>
        )}
      </GameHeader>
      {!g.myRole ? (
        <Waiting emoji="🍿">הסיבוב התחיל בלעדיכם - תצטרפו בסיבוב הבא 🙂</Waiting>
      ) : (
        <>
          {g.phase !== 'end' && <RoleCard g={g} key={g.round} />}
          {night && <NightPhase g={g} />}
          {g.phase === 'morning' && <MorningPhase g={g} key={`${g.round}-${g.day}`} />}
          {g.phase === 'end' && <EndPhase g={g} />}
        </>
      )}
    </div>
  );
}

// התפקיד מוסתר בלחיצה, כדי שמי שיושב לידכם לא יציץ
function RoleCard({ g }) {
  const [hidden, setHidden] = useState(false);
  const r = ROLES[g.myRole];
  return (
    <div className={`mb-4 rounded-3xl p-4 ${hidden ? 'bg-slate-100' : r.color}`}>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{hidden ? '🎭' : r.emoji}</span>
        <div className="flex-1">
          <div className="font-display text-xl">{hidden ? 'התפקיד מוסתר' : `אתם ${r.name}`}</div>
          {!hidden && <p className="text-sm leading-snug">{r.desc}</p>}
        </div>
        <button className="rounded-xl bg-white/70 px-3 py-1.5 text-sm font-bold" onClick={() => setHidden((h) => !h)}>
          {hidden ? '👁 הצגה' : '🙈 הסתרה'}
        </button>
      </div>
      {!hidden && g.team?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
          {g.myRole === 'imposter' ? 'המתחזים האחרים:' : 'השוטרים האחרים:'}
          {g.team.map((id) => (
            <span key={id} className="chip bg-white/70">
              <PlayerTag id={id} />
              {STATUS[g.status[id]]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({ g }) {
  return (
    <div className="mt-5">
      <div className="label">תושבי העיירה</div>
      <div className="flex flex-wrap gap-2">
        {g.ids.map((id) => (
          <span
            key={id}
            className={`chip ${g.status[id] === 'dead' ? 'bg-slate-100 line-through opacity-60' : g.status[id] === 'jailed' ? 'bg-amber-50' : 'bg-indigo-50'}`}
          >
            <PlayerTag id={id} />
            {STATUS[g.status[id]]}
          </span>
        ))}
      </div>
    </div>
  );
}

function NightPhase({ g }) {
  const { state, act } = useRoom();
  const ready = g.readyIds.includes(state.me);
  const r = ROLES[g.myRole];
  const needPick = g.mustPick && g.targets?.length > 0 && !g.myPick;

  let body;
  if (g.myStatus === 'dead') {
    body = <Waiting emoji="👻">חוסלתם… עכשיו רק צופים עד סוף הסיבוב</Waiting>;
  } else if (g.myStatus === 'jailed') {
    body = <Waiting emoji="🔒">אתם בכלא. רק המנעולן יכול לשחרר אתכם…</Waiting>;
  } else if (ready) {
    body = (
      <div className="text-center">
        <Waiting emoji="😴">לילה טוב! מחכים שכולם יילכו לישון…</Waiting>
        <button className="text-sm font-bold text-indigo-500 hover:text-grape" onClick={() => act('unready')}>
          ✏️ רגע, אני רוצה לשנות
        </button>
      </div>
    );
  } else {
    body = (
      <div>
        <p className="mb-1 text-center font-display text-2xl">{r.verb}</p>
        {g.myRole === 'imposter' && g.team?.length > 0 && (
          <p className="mb-2 text-center text-sm text-indigo-400">אם תבחרו אנשים שונים - יוגרל אחד מהם</p>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {g.targets.map((id) => (
            <Target
              key={id}
              id={id}
              g={g}
              active={g.myPick === id}
              onClick={() => act('pick', { target: g.myPick === id ? null : id })}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <button className="btn-mint px-10" disabled={needPick} onClick={() => act('ready')}>
            הולכים לישון 😴
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      {body}
      <DoneRow ids={g.awakeIds} doneIds={g.readyIds} label="מי כבר הלך לישון" />
      <Board g={g} />
    </div>
  );
}

function Target({ id, g, active, onClick }) {
  const p = usePlayer(id);
  const { state } = useRoom();
  // מה השותפים (מתחזים / שוטרים) בחרו
  const mates = Object.entries(g.teamPicks || {})
    .filter(([, t]) => t === id)
    .map(([mate]) => mate);
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-right font-semibold transition ${
        active ? 'scale-[1.02] bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-indigo-50 hover:bg-indigo-100'
      }`}
    >
      <span className="text-2xl">{p.emoji}</span>
      <span className="flex-1 truncate">
        {p.name}
        {id === state.me && <span className="text-indigo-400"> (אני)</span>}
        {g.status[id] === 'jailed' && ' 🔒'}
      </span>
      {mates.map((m) => (
        <MateBadge key={m} id={m} />
      ))}
    </button>
  );
}

function MateBadge({ id }) {
  const p = usePlayer(id);
  return (
    <span title={`${p.name} בחר/ה גם`} className="rounded-full bg-white px-1.5 text-lg">
      {p.emoji}
    </span>
  );
}

const OUTCOMES = {
  town: { emoji: '🎉', text: 'כל המתחזים מאחורי סורג ובריח או מחוסלים - העיירה ניצחה!', color: 'bg-emerald-100 text-emerald-900' },
  imposters: { emoji: '🔪', text: 'לא נשארו שוטרים - המתחזים ניצחו! (+3 לכל מתחזה)', color: 'bg-rose-100 text-rose-900' },
  both: { emoji: '💥', text: 'המתחזים והשוטרים הפילו אלה את אלה - שני הצדדים הפסידו!', color: 'bg-slate-200 text-slate-900' },
};

function EventCard({ e }) {
  if (e.type === 'outcome') {
    const o = OUTCOMES[e.outcome];
    return <div className={`animate-pop rounded-3xl p-4 text-center font-display text-xl ${o.color}`}>{o.emoji} {o.text}</div>;
  }
  if (e.type === 'quiet') {
    return <div className="animate-rise rounded-3xl bg-indigo-50 p-4 text-center font-display text-xl">😌 לילה שקט - לא קרה כלום</div>;
  }
  const map = {
    killed: ['💀', 'bg-rose-50', 'חוסל/ה בלילה'],
    saved: ['🩺', 'bg-emerald-50', 'הותקף/ה - אבל החובש ריפא והציל!'],
    arrested: ['🚔', 'bg-sky-50', 'נעצר/ה ונכנס/ה לכלא'],
    rescued: ['🔑', 'bg-amber-50', 'כמעט נעצר/ה - אבל המנעולן שחרר מיד!'],
    released: ['🔓', 'bg-amber-50', 'שוחרר/ה מהכלא'],
  };
  const [emoji, bg, text] = map[e.type];
  return (
    <div className={`flex animate-rise flex-wrap items-center gap-2 rounded-3xl p-4 text-lg ${bg}`}>
      <span className="text-3xl">{emoji}</span>
      <PlayerTag id={e.id} size="md" />
      <span>{text}</span>
    </div>
  );
}

// האירועים נחשפים אחד-אחד, לא הכל בבום
function MorningPhase({ g }) {
  const items = [...g.events, ...(g.outcome ? [{ type: 'outcome', outcome: g.outcome }] : [])];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= items.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 1500 : 2500);
    return () => clearTimeout(t);
  }, [shown, items.length]);
  const done = shown >= items.length;

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-2xl">☀️ בוקר טוב, עיירה! מה קרה בלילה…</p>
      <div className="space-y-2">
        {items.slice(0, shown).map((e, i) => (
          <EventCard key={i} e={e} />
        ))}
      </div>
      {!done && <div className="mt-4 animate-pulse text-center text-4xl">🥁</div>}
      {done && (
        <>
          {g.myNightPoints !== 0 && (
            <p className="mt-4 text-center font-display text-lg text-grape">
              🤫 בסוד: {g.myNightPoints > 0 ? '+' : ''}
              {g.myNightPoints} נקודות לכם הלילה (ייכנסו לטבלה בסוף הסיבוב)
            </p>
          )}
          <NextButton label={g.outcome ? 'לתוצאות הסיבוב ←' : 'הולכים לישון 🌙'} />
        </>
      )}
      <Board g={g} />
    </div>
  );
}

function EndPhase({ g }) {
  const o = OUTCOMES[g.outcome];
  const order = Object.keys(ROLES);
  const ids = [...g.ids].sort((a, b) => order.indexOf(g.roles[a]) - order.indexOf(g.roles[b]));
  return (
    <div className="animate-rise">
      <div className={`rounded-3xl p-4 text-center font-display text-2xl ${o.color}`}>
        {o.emoji} {o.text}
      </div>
      <h3 className="mb-2 mt-6 text-center font-display text-xl">מי היה מה? 🎭</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {ids.map((id, i) => {
          const r = ROLES[g.roles[id]];
          return (
            <div
              key={id}
              className={`flex animate-rise items-center gap-2 rounded-2xl p-3 ${r.color}`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <PlayerTag id={id} className="flex-1" />
              {STATUS[g.status[id]]}
              <span className="chip bg-white/70">
                {r.emoji} {r.name}
              </span>
            </div>
          );
        })}
      </div>
      <h3 className="mb-2 mt-6 text-center font-display text-xl">נקודות התפקידים בסיבוב</h3>
      <p className="mb-2 text-center text-sm text-indigo-400">(בנוסף לנקודה על כל יום ששרדתם)</p>
      <RoundPoints points={g.roundPoints} />
      <NextButton label={g.round >= g.totalRounds ? 'לסיכום 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}
