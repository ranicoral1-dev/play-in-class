import { useEffect, useRef, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, Waiting, NextButton, usePlayer } from '../components/ui.jsx';

const TEAM_STYLES = [
  { token: '🔴', bg: 'bg-rose-100', text: 'text-rose-900', ring: 'ring-rose-400' },
  { token: '🔵', bg: 'bg-sky-100', text: 'text-sky-900', ring: 'ring-sky-400' },
  { token: '🟢', bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-400' },
  { token: '🟡', bg: 'bg-amber-100', text: 'text-amber-900', ring: 'ring-amber-400' },
];

// צבע לכל מספר על הלוח (1-8)
const SQUARE_COLORS = [
  'bg-rose-200', 'bg-orange-200', 'bg-amber-200', 'bg-lime-200',
  'bg-emerald-200', 'bg-cyan-200', 'bg-indigo-200', 'bg-fuchsia-200',
];

export default function Alias({ g }) {
  const playing = g.phase !== 'teams';
  return (
    <div className="card">
      <GameHeader title="🗣️ אליאס" round={playing ? g.round : null} totalRounds={g.totalRounds}>
        {playing && g.cur >= 0 && (
          <span className={`chip ${TEAM_STYLES[g.cur].bg} ${TEAM_STYLES[g.cur].text}`}>
            {TEAM_STYLES[g.cur].token} התור של {g.teams[g.cur].name}
          </span>
        )}
      </GameHeader>
      {g.phase === 'teams' && <TeamsPhase g={g} />}
      {playing && (
        <>
          <Board g={g} />
          {g.phase === 'ready' && <ReadyPhase g={g} />}
          {g.phase === 'turn' && <TurnPhase g={g} />}
          {g.phase === 'summary' && <SummaryPhase g={g} />}
        </>
      )}
    </div>
  );
}

// ראש הקבוצה (הראשון בה) יכול לשנות את השם
function TeamName({ g, i }) {
  const { state, act } = useRoom();
  const team = g.teams[i];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const leader = team.members[0] === state.me;

  if (editing) {
    const save = () => {
      act('rename', { team: i, name });
      setEditing(false);
    };
    return (
      <div className="flex gap-1">
        <input
          className="input py-1.5 text-base"
          autoFocus
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className="rounded-xl bg-white px-3 font-bold" onClick={save}>
          ✓
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 font-display text-xl">
      {TEAM_STYLES[i].token} {team.name}
      {leader && (
        <button
          title="שינוי שם הקבוצה"
          className="text-sm opacity-60 hover:opacity-100"
          onClick={() => {
            setName(team.name);
            setEditing(true);
          }}
        >
          ✏️
        </button>
      )}
    </div>
  );
}

function TeamsPhase({ g }) {
  const { state, act } = useRoom();
  const isHost = state.hostId === state.me;
  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">מתחלקים לקבוצות 🤝</p>
      <p className="mb-4 text-center text-sm text-indigo-400">
        לוחצים על קבוצה כדי לעבור אליה. הראשון בכל קבוצה הוא ראש הקבוצה 👑 ויכול לשנות את השם.
      </p>
      <div className={`grid gap-3 ${g.teams.length > 2 ? 'sm:grid-cols-2' : 'grid-cols-2'}`}>
        {g.teams.map((t, i) => {
          const st = TEAM_STYLES[i];
          const mine = g.myTeam === i;
          return (
            <div key={i} className={`rounded-3xl p-4 ${st.bg} ${st.text} ${mine ? `ring-4 ${st.ring}` : ''}`}>
              <TeamName g={g} i={i} />
              <div className="mt-3 flex min-h-[2.5rem] flex-wrap gap-1.5">
                {t.members.map((id, k) => (
                  <span key={id} className="chip bg-white/70">
                    <PlayerTag id={id} />
                    {k === 0 && '👑'}
                  </span>
                ))}
              </div>
              {!mine && (
                <button className="mt-3 w-full rounded-2xl bg-white/80 py-2 font-display hover:bg-white" onClick={() => act('join', { team: i })}>
                  הצטרפות ←
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className={`mt-4 text-center font-bold ${g.balanced ? 'text-emerald-600' : 'text-rose-500'}`}>
        {g.balanced
          ? '✅ הקבוצות מאוזנות'
          : '⚠️ הקבוצות לא מאוזנות: צריך לפחות 2 בכל קבוצה, והפרש של שחקן אחד לכל היותר'}
      </p>
      {isHost ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button className="btn-ghost" onClick={() => act('shuffle')}>
            🎲 ערבוב
          </button>
          <button className="btn-mint px-10" disabled={!g.balanced} onClick={() => act('go')}>
            יאללה, מתחילים! 🚀
          </button>
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-indigo-400">המארח יתחיל כשהקבוצות מוכנות</p>
      )}
      {state.settings.timed && <p className="mt-2 text-center text-xs text-indigo-300">כשהזמן נגמר - הקבוצות מתאזנות לבד ומתחילים</p>}
    </div>
  );
}

function Board({ g }) {
  const squares = Array.from({ length: g.target + 1 }, (_, i) => i);
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap gap-2">
        {g.teams.map((t, i) => (
          <span key={i} className={`chip ${TEAM_STYLES[i].bg} ${TEAM_STYLES[i].text} ${g.cur === i ? `ring-2 ${TEAM_STYLES[i].ring}` : ''}`}>
            {TEAM_STYLES[i].token} {t.name} · משבצת {Math.min(t.pos, g.target)}/{g.target}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" dir="rtl">
        {squares.map((i) => {
          const here = g.teams.map((t, k) => (Math.min(t.pos, g.target) === i ? k : -1)).filter((k) => k >= 0);
          const finish = i === g.target;
          return (
            <div
              key={i}
              className={`relative flex h-11 w-11 flex-col items-center justify-center rounded-xl text-sm font-bold sm:h-12 sm:w-12 ${
                finish ? 'bg-sun' : SQUARE_COLORS[i % 8]
              } ${here.includes(g.cur) && g.phase !== 'summary' ? 'ring-2 ring-grape' : ''}`}
            >
              <span className="text-xs text-ink/60">{finish ? '🏁' : (i % 8) + 1}</span>
              {here.length > 0 && <span className="text-xs leading-none">{here.map((k) => TEAM_STYLES[k].token).join('')}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadyPhase({ g }) {
  const { state, act } = useRoom();
  const teller = usePlayer(g.teller);
  const st = TEAM_STYLES[g.cur];
  if (state.me === g.teller) {
    return (
      <div className={`animate-pop rounded-3xl p-6 text-center ${st.bg} ${st.text}`}>
        <div className="font-display text-3xl">אתם המסבירים! 🎤</div>
        <p className="mt-2">
          יש לכם כרטיס עם 8 מילים. הקבוצה שלכם על משבצת <b>{g.square}</b> - אז מסבירים את מילה מספר {g.square}.
          <br />
          בלי המילה עצמה, בלי השורש שלה ובלי באנגלית - אחרת חוזרים משבצת אחורה!
        </p>
        <button className="btn-pink mt-5 px-10 text-2xl" onClick={() => act('begin')}>
          מוכנים? מתחילים! ⏱️
        </button>
      </div>
    );
  }
  return (
    <Waiting emoji="🎤">
      {teller.name} מסביר/ה ל{g.teams[g.cur].name}
      {g.myTeam === g.cur ? ' - תתכוננו לנחש!' : ''}
    </Waiting>
  );
}

function TurnPhase({ g }) {
  const { state } = useRoom();
  const amTeller = state.me === g.teller;
  return (
    <div className="grid gap-4 md:grid-cols-[230px_1fr]">
      {amTeller ? <WordCard g={g} /> : <TellerBox g={g} />}
      <TeamChat g={g} />
    </div>
  );
}

function WordCard({ g }) {
  const { act } = useRoom();
  return (
    <div className="animate-pop rounded-3xl bg-gradient-to-br from-cyan-100 to-blue-100 p-4">
      <div className="mb-2 text-center font-display text-lg">🃏 הכרטיס שלכם</div>
      <ol className="space-y-1">
        {g.card.map((w, i) => {
          const active = i + 1 === g.square;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 ${active ? 'scale-105 bg-sun font-display text-xl shadow' : 'text-indigo-400'}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${SQUARE_COLORS[i]}`}>{i + 1}</span>
              {w}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="rounded-xl bg-white/80 py-2 text-sm font-bold hover:bg-white" onClick={() => act('skip')}>
          ⏭ דילוג (−1)
        </button>
        <button className="rounded-xl bg-white/80 py-2 text-sm font-bold hover:bg-white" onClick={() => confirm('לסיים את התור?') && act('done')}>
          ✋ סיימתי
        </button>
      </div>
    </div>
  );
}

function TellerBox({ g }) {
  const st = TEAM_STYLES[g.cur];
  const correct = g.turn?.words.filter((w) => w.result === 'correct').length || 0;
  return (
    <div className={`rounded-3xl p-4 text-center ${st.bg} ${st.text}`}>
      <div className="text-sm font-bold">מסביר/ה עכשיו</div>
      <div className="my-2 flex justify-center">
        <PlayerTag id={g.teller} size="md" />
      </div>
      <div className="text-sm">
        מילה מספר <b className="font-display text-xl">{g.square}</b>
      </div>
      <div className="mt-2 text-sm">✅ {correct} ניחושים בתור הזה</div>
      {g.myTeam !== g.cur && <p className="mt-3 text-xs opacity-70">זה לא התור שלכם - רק צופים 👀</p>}
    </div>
  );
}

function ChatLine({ m }) {
  const p = usePlayer(m.pid);
  if (m.kind === 'system') return <div className="text-center text-xs font-bold text-indigo-300">{m.text}</div>;
  if (m.kind === 'correct') {
    return (
      <div className="animate-pop rounded-2xl bg-emerald-100 px-3 py-2 text-center font-display text-emerald-900">
        ✅ {p.emoji} {p.name} ניחש/ה: {m.word}! משבצת קדימה
      </div>
    );
  }
  if (m.kind === 'foul') {
    return (
      <div className="animate-pop rounded-2xl bg-rose-100 px-3 py-2 text-center font-display text-rose-900">
        🚫 {p.name} השתמש/ה במילה, בשורש או באנגלית ({m.word}) - משבצת אחורה
      </div>
    );
  }
  if (m.kind === 'skip') {
    return (
      <div className="animate-pop rounded-2xl bg-amber-100 px-3 py-2 text-center text-amber-900">
        ⏭ {p.name} דילג/ה על ״{m.word}״ - משבצת אחורה
      </div>
    );
  }
  const clue = m.kind === 'clue';
  return (
    <div className={`flex items-start gap-2 ${clue ? '' : 'flex-row-reverse'}`}>
      <span className="text-xl">{p.emoji}</span>
      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${clue ? 'bg-sun/40' : 'bg-indigo-50'}`}>
        <div className="text-xs font-bold text-indigo-400">
          {p.name}
          {clue && ' 🎤'}
        </div>
        <div className="break-words">{m.text}</div>
      </div>
    </div>
  );
}

function TeamChat({ g }) {
  const { state, act } = useRoom();
  const [text, setText] = useState('');
  const listRef = useRef();
  const amTeller = state.me === g.teller;
  const canWrite = g.myTeam === g.cur;
  const lastId = g.chat.length ? g.chat[g.chat.length - 1].id : 0;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  async function send(e) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    const res = await act('msg', msg);
    if (res.error) setText(msg);
  }

  return (
    <div className="flex min-h-[320px] flex-col rounded-3xl border-2 border-indigo-100">
      <div className="border-b-2 border-indigo-50 px-4 py-2 font-display">💬 הצ׳אט של {g.teams[g.cur].name}</div>
      <div ref={listRef} className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: 380 }}>
        {g.chat.map((m) => (
          <ChatLine key={m.id} m={m} />
        ))}
      </div>
      {canWrite && (
        <form onSubmit={send} className="flex gap-2 border-t-2 border-indigo-50 p-2">
          <input
            className="input py-2 text-base"
            autoFocus
            maxLength={amTeller ? 120 : 60}
            placeholder={amTeller ? 'מסבירים… (בלי המילה, בלי השורש, בלי אנגלית)' : 'מה המילה? מנחשים כאן…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className={`${amTeller ? 'btn-primary' : 'btn-mint'} shrink-0 py-2`} disabled={!text.trim()}>
            {amTeller ? 'רמז' : 'ניחוש'}
          </button>
        </form>
      )}
    </div>
  );
}

function SummaryPhase({ g }) {
  const st = TEAM_STYLES[g.cur];
  const words = g.turn?.words || [];
  const net = words.reduce((n, w) => n + (w.result === 'correct' ? 1 : -1), 0);
  const icons = { correct: '✅', skip: '⏭', foul: '🚫' };
  return (
    <div className="animate-rise text-center">
      <div className={`inline-block rounded-3xl px-6 py-3 font-display text-2xl ${st.bg} ${st.text}`}>
        {st.token} {g.teams[g.cur].name}: {net > 0 ? `+${net}` : net} משבצות
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {words.length ? (
          words.map((w, i) => (
            <span key={i} className={`chip ${w.result === 'correct' ? 'bg-emerald-100' : 'bg-rose-50 line-through'}`}>
              {icons[w.result]} {w.word}
            </span>
          ))
        ) : (
          <span className="text-indigo-400">לא ניחשו אף מילה הפעם 😅</span>
        )}
      </div>
      <NextButton label="לתור הבא ←" />
    </div>
  );
}
