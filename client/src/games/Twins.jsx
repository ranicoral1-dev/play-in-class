import { useEffect, useRef, useState } from 'react';
import { pop, success, fail, ding } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

export default function Twins({ g }) {
  return (
    <div className="card">
      <GameHeader title="👯 נחש את המספר" round={g.round} totalRounds={g.totalRounds} />
      {g.phase === 'play' && <Play g={g} />}
      {g.phase === 'results' && <Results g={g} />}
    </div>
  );
}

function Play({ g }) {
  const { state } = useRoom();
  const me = g.status[state.me];
  const [chatWith, setChatWith] = useState(null);
  const others = g.players.filter((id) => id !== state.me);

  useEffect(() => {
    if (me === 'dead') fail();
    if (me === 'found') success();
  }, [me]);

  return (
    <div className="animate-rise space-y-4">
      <MyNumber g={g} />
      {me === 'alive' && <Shoot g={g} />}
      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <PlayerList g={g} others={others} chatWith={chatWith} setChatWith={setChatWith} />
        {chatWith ? (
          <Dm g={g} other={chatWith} onClose={() => setChatWith(null)} />
        ) : (
          <div className="flex items-center justify-center rounded-3xl bg-indigo-50/60 p-6 text-center text-indigo-400">
            בחרו שחקן ברשימה ולחצו 💬 כדי לדבר איתו בפרטי.
            <br />
            הצ׳אט של החדר סגור - רק אתם והוא רואים 🤫
          </div>
        )}
      </div>
      <Log g={g} />
    </div>
  );
}

// המספר מוסתר עד שלוחצים - שלא יציצו במסך
function MyNumber({ g }) {
  const { state } = useRoom();
  const [show, setShow] = useState(false);
  const status = g.status[state.me];
  const why = g.why;
  const by = usePlayer(why?.by);

  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
      <button
        className="rounded-3xl bg-gradient-to-br from-fuchsia-600 to-purple-800 px-8 py-4 text-white shadow-lg"
        onPointerDown={() => setShow(true)}
        onPointerUp={() => setShow(false)}
        onPointerLeave={() => setShow(false)}
        onPointerCancel={() => setShow(false)}
        style={{ touchAction: 'none' }}
      >
        <div className="text-sm font-bold opacity-80">המספר הסודי שלך</div>
        <div className="font-display text-6xl tabular-nums">{show ? g.myNum : '🔒'}</div>
        <div className="text-xs opacity-70">{show ? 'שחררו כדי להסתיר' : 'לחצו והחזיקו כדי לראות'}</div>
      </button>
      <div className="flex items-center rounded-3xl bg-indigo-50 p-4">
        {status === 'alive' && (
          <p className="text-indigo-600">
            יש בדיוק עוד מישהו עם המספר שלך. מצאו אותו (+{g.nextFoundPts}), או כתבו מספר של מישהו אחר כדי לפסול אותו (+{g.killPts} לכל אחד). זהירות: מספר שאין לאף אחד = אתם בחוץ!
          </p>
        )}
        {status === 'found' && <p className="font-display text-2xl text-emerald-600">👯 מצאתם אחד את השני! אתם בטוחים עד סוף הסיבוב.</p>}
        {status === 'dead' && (
          <p className="font-display text-xl text-rose-600">
            💀{' '}
            {why?.type === 'kill' ? (
              <>
                <Avatar emoji={by.emoji} size="sm" /> {by.name} פסל/ה אותך!
              </>
            ) : why?.type === 'miss' ? (
              why.by === state.me ? (
                'כתבת מספר שאין לאף אחד במשחק - אתה והתאום שלך בחוץ'
              ) : (
                <>
                  התאום שלך <Avatar emoji={by.emoji} size="sm" /> {by.name} כתב מספר שאין לאף אחד - שניכם בחוץ
                </>
              )
            ) : (
              <>
                ניחשת ש־{by.name} התאום שלך - וזה לא נכון. אתה בחוץ
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Shoot({ g }) {
  const { act } = useRoom();
  const [n, setN] = useState('');

  async function shoot(e) {
    e.preventDefault();
    const x = parseInt(n, 10);
    if (!x) return;
    if (!confirm(`לכתוב ${x}? אם אף אחד במשחק לא מחזיק את המספר הזה - אתה והתאום שלך נפסלים!`)) return;
    const res = await act('shoot', x);
    if (!res.error) setN('');
  }

  return (
    <form onSubmit={shoot} className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 p-3">
      <span className="font-display text-lg">🎯 לפסול את מי שיש לו את המספר:</span>
      <input
        className="input w-28 py-2 text-center text-xl tabular-nums"
        type="number"
        inputMode="numeric"
        min={1}
        max={g.max}
        placeholder={`1-${g.max}`}
        value={n}
        onChange={(e) => setN(e.target.value)}
      />
      <button className="btn-pink px-4 py-2 text-base" disabled={!n}>
        פסילה!
      </button>
    </form>
  );
}

const STATUS = { alive: '', found: '👯', dead: '💀' };

function PlayerList({ g, others, chatWith, setChatWith }) {
  const { state, act } = useRoom();
  const amAlive = g.status[state.me] === 'alive';
  // הודעות שלא נקראו: כמה הודעות ראיתי בכל שיחה
  const seen = useRef({});
  if (chatWith) seen.current[chatWith] = g.chats[chatWith]?.length || 0;

  return (
    <ul className="space-y-1.5">
      {others.map((id) => {
        const status = g.status[id];
        const msgs = g.chats[id] || [];
        const unread = id === chatWith ? 0 : msgs.filter((m, i) => i >= (seen.current[id] || 0) && m.from !== state.me).length;
        return (
          <li key={id} className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 ${chatWith === id ? 'bg-amber-50' : 'bg-indigo-50/50'} ${status === 'dead' ? 'opacity-50' : ''}`}>
            <PlayerTag id={id} className="min-w-0 flex-1" suffix={STATUS[status] && <span>{STATUS[status]}</span>} />
            <button
              title="הודעה פרטית"
              className="relative rounded-xl bg-white px-2.5 py-1.5 text-lg shadow-sm hover:bg-indigo-100"
              onClick={() => setChatWith(chatWith === id ? null : id)}
            >
              💬
              {unread > 0 && <span className="absolute -left-1 -top-1 rounded-full bg-bubble px-1.5 text-xs font-bold text-white">{unread}</span>}
            </button>
            {amAlive && status === 'alive' && (
              <button
                title="זה התאום שלי!"
                className="rounded-xl bg-emerald-500 px-2.5 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600"
                onClick={async () => {
                  const p = state.players.find((x) => x.id === id);
                  if (!confirm(`בטוח ש${p?.name || ''} התאום שלך? אם לא - אתה בחוץ!`)) return;
                  await act('guess', id);
                }}
              >
                👯 התאום שלי
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Dm({ g, other, onClose }) {
  const { state, act } = useRoom();
  const p = usePlayer(other);
  const [text, setText] = useState('');
  const listRef = useRef();
  const msgs = g.chats[other] || [];
  const canSend = g.status[state.me] !== 'dead';
  const lastId = msgs[msgs.length - 1]?.id;
  const opened = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (opened.current && lastId && msgs[msgs.length - 1].from !== state.me) ding();
    opened.current = true;
  }, [lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    const res = await act('dm', { to: other, text: t });
    if (res.error) setText(t);
    else pop();
  }

  return (
    <div className="flex flex-col rounded-3xl border-2 border-indigo-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-lg">
          🔒 <Avatar emoji={p.emoji} size="sm" /> {p.name}
        </span>
        <button className="text-indigo-300 hover:text-indigo-600" onClick={onClose}>
          ✕
        </button>
      </div>
      <div ref={listRef} className="h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-indigo-50/60 p-2">
        {!msgs.length && <p className="py-8 text-center text-sm text-indigo-300">עוד אין הודעות. אולי לשאול רמז על המספר? 🤔</p>}
        {msgs.map((m) => {
          const mine = m.from === state.me;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
              <div dir="auto" className={`max-w-[80%] break-words rounded-2xl px-3 py-1.5 text-sm ${mine ? 'bg-grape text-white' : 'bg-white text-ink shadow-sm'}`}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          className="input min-w-0 flex-1 py-2 text-base"
          maxLength={150}
          disabled={!canSend}
          placeholder={canSend ? 'הודעה פרטית…' : 'נפסלת - אי אפשר לשלוח 💀'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0 px-4 py-2 text-base" disabled={!canSend || !text.trim()}>
          שליחה
        </button>
      </form>
    </div>
  );
}

function Log({ g }) {
  if (!g.log.length) return null;
  return (
    <div className="rounded-3xl bg-indigo-50/60 p-3">
      <h4 className="mb-2 font-display text-lg">📰 מה קרה</h4>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {[...g.log].reverse().map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-1.5 text-sm">
            {e.type === 'found' ? '👯' : '💀'}
            {e.ids.map((id) => (
              <PlayerTag key={id} id={id} />
            ))}
            <span className="font-semibold text-indigo-500">{e.type === 'found' ? `מצאו אחד את השני! +${e.pts}` : 'נפסלו'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RESULT_STYLE = { found: 'bg-emerald-50 ring-emerald-200', dead: 'bg-rose-50 ring-rose-200', alive: 'bg-indigo-50 ring-indigo-100' };

function Results({ g }) {
  const last = g.round >= g.totalRounds;
  return (
    <div className="animate-rise space-y-4 text-center">
      <h3 className="font-display text-3xl">🔓 כל המספרים</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {g.groups.map(({ n, ids }) => (
          <div key={n} className="flex items-center gap-3 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-indigo-100">
            <span className="w-14 font-display text-3xl tabular-nums text-grape">{n}</span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {ids.map((id) => (
                <span key={id} className={`rounded-xl px-1.5 py-0.5 ring-1 ${RESULT_STYLE[g.status[id]]}`}>
                  <PlayerTag id={id} suffix={STATUS[g.status[id]]} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <RoundPoints points={g.roundPoints} />
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}
