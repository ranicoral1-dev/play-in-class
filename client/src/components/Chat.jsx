import { useEffect, useRef, useState } from 'react';
import { emit } from '../socket.js';
import { GAME_META } from '../lib.js';
import { useRoom, Avatar } from './ui.jsx';

const WIDE = '(min-width: 1024px)';

function useWide() {
  const [wide, setWide] = useState(() => !!window.matchMedia?.(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE);
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

// לאיזו שיחה שייכת הודעה: 'all' לצ'אט הכללי, או המזהה של השחקן השני בשיחה הפרטית
export const convOf = (m, me) => (!m.to ? 'all' : m.pid === me ? m.to : m.pid);

// מצב הצ'אט שמשותף לכפתור בכותרת ולצ'אט עצמו: מה נקרא, כמה תיוגים, האם הצ'אט על המסך, ובאיזו שיחה
export function useChatTracker() {
  const { state, chat } = useRoom();
  const ref = useRef();
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  // null = הצ'אט של כולם; אחרת - שיחה פרטית עם השחקן הזה
  const [peer, setPeer] = useState(null);
  const [seen, setSeen] = useState({});
  const conv = peer || 'all';
  const fresh = chat.filter((m) => m.pid !== state.me && m.id > (seen[convOf(m, state.me)] || 0));
  const unread = fresh.length;
  const mentions = fresh.filter((m) => m.to === state.me || m.mentions?.includes(state.me)).length;
  const unreadIn = (key) => fresh.filter((m) => convOf(m, state.me) === key).length;
  const visible = inView && (open || wide);
  const convMsgs = chat.filter((m) => convOf(m, state.me) === conv);
  const lastId = convMsgs.length ? convMsgs[convMsgs.length - 1].id : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.IntersectionObserver) return setInView(true);
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (visible && lastId) setSeen((old) => (old[conv] === lastId ? old : { ...old, [conv]: lastId }));
  }, [visible, lastId, conv]);

  function goTo() {
    setOpen(true);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  // פתיחת שיחה פרטית (או חזרה לכולם עם null)
  function openDm(pid) {
    setPeer(pid === state.me ? null : pid);
    goTo();
  }

  // בטלפון הצ'אט למטה ומקופל - הכפתור תמיד שם. במחשב רק כשגללו והצ'אט לא נראה
  const showButton = !wide || !inView;

  return { ref, open, setOpen, unread, mentions, unreadIn, visible, goTo, showButton, lastId, peer, setPeer, openDm, convMsgs };
}

export function Badges({ unread, mentions }) {
  return (
    <>
      {mentions > 0 && (
        <span title="תייגו אותך" className="rounded-full bg-sun px-2 text-sm font-bold text-ink animate-pop">
          @{mentions}
        </span>
      )}
      {unread > 0 && <span className="rounded-full bg-bubble px-2 text-sm font-bold text-white animate-pop">{unread}</span>}
    </>
  );
}

// מדגיש @שם של שחקנים בחדר בתוך ההודעה
function MessageText({ text, names }) {
  if (!names.length || !text.includes('@')) return text;
  const esc = names
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(@(?:${esc.join('|')}))(?![\\p{L}\\p{N}])`, 'u'));
  return parts.map((part, i) =>
    i % 2 ? (
      <span key={i} className="rounded bg-sun/40 px-0.5 font-bold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// צ'אט החדר - זמין בלובי ובכל משחק. בטלפון מקופל, עם מונה הודעות שלא נקראו
export default function Chat({ tracker }) {
  const { state, chat, showToast } = useRoom();
  const { ref, open, setOpen, unread, mentions, unreadIn, visible, lastId, peer, setPeer, convMsgs } = tracker;
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const listRef = useRef();
  const inputRef = useRef();
  const names = state.players.map((p) => p.name);
  const closed = state.status === 'game' && GAME_META[state.gameId]?.noChat;
  const peerPlayer = peer && state.players.find((p) => p.id === peer);
  // לשוניות: כולם + כל מי שיש איתו שיחה פרטית (ומי שפתוח עכשיו)
  const dmIds = [...new Set(chat.filter((m) => m.to).map((m) => convOf(m, state.me)))];
  if (peer && !dmIds.includes(peer)) dmIds.push(peer);
  const tabs = dmIds.filter((id) => state.players.some((p) => p.id === id));

  // שחקן שעזב - חוזרים לכולם
  useEffect(() => {
    if (peer && !peerPlayer) setPeer(null);
  }, [peer, peerPlayer, setPeer]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, open, peer]);

  // השלמה אוטומטית: הטקסט מה-@ האחרון ועד הסמן
  const before = text.slice(0, caret);
  // אחרי "/chat " משלימים שם גם בלי @
  const cmd = /^\/chat\s+/i.exec(before);
  let at = -1;
  let query = null;
  if (cmd && !before.slice(cmd[0].length).includes('@')) {
    at = cmd[0].length;
    query = before.slice(at);
  } else {
    const i = before.lastIndexOf('@');
    if (i >= 0 && (i === 0 || /\s/.test(before[i - 1]))) {
      at = i;
      query = before.slice(i + 1);
    }
  }
  const isHost = state.hosts?.includes(state.me);
  // "/" בתחילת ההודעה (לפני רווח) - מציגים את כל הפקודות
  const cmdQuery = /^\/\S*$/.test(before) ? before.toLowerCase() : null;
  const commands = [
    { cmd: '/chat', emoji: '🔒', label: '/chat @שם', hint: 'הודעה פרטית', run: () => fill('/chat ') },
    peer && { cmd: '/chat', emoji: '👥', label: '/chat', hint: 'חזרה לצ׳אט של כולם', run: () => (setPeer(null), fill('')) },
    !isHost && { cmd: '/host', emoji: '👑', label: '/host', hint: 'בקשה להיות מארח', run: () => (fill(''), sendText('/host')) },
  ].filter(Boolean);
  const suggestions =
    cmdQuery != null
      ? commands.filter((c) => c.cmd.startsWith(cmdQuery)).map((c) => ({ key: c.label, ...c }))
      : query != null && query.length <= 16
        ? state.players
            .filter((p) => p.id !== state.me && p.name.startsWith(query) && p.name !== query)
            .slice(0, 6)
            .map((p) => ({ key: p.id, emoji: p.emoji, label: p.name, avatar: true, run: () => mention(p.name) }))
        : [];

  useEffect(() => setPick(0), [query, cmdQuery]);

  // מחליף את כל הטקסט ומשאיר את הסמן בסוף
  function fill(next) {
    setText(next);
    setCaret(next.length);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.length, next.length);
    });
  }

  function mention(name) {
    const next = `${text.slice(0, at)}@${name} ${text.slice(caret)}`;
    const pos = at + name.length + 2;
    setText(next.slice(0, 200));
    setCaret(pos);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setPick((i) => (i + d + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      suggestions[pick]?.run();
    }
  }

  function send(e) {
    e.preventDefault();
    sendText(text.trim());
  }

  async function sendText(msg) {
    if (!msg) return;
    setText('');
    setCaret(0);
    // /chat @שם - מעבר לשיחה פרטית (ואם כתבו גם הודעה אחרי השם - היא נשלחת לשם). /chat לבד - חזרה לכולם
    const dm = /^\/chat(?:\s+|$)(.*)$/is.exec(msg);
    if (dm) {
      const rest = dm[1].trim().replace(/^@/, '');
      if (!rest || rest === 'כולם' || rest === 'all') return setPeer(null);
      const target = [...state.players]
        .filter((p) => p.id !== state.me)
        .sort((a, b) => b.name.length - a.name.length)
        .find((p) => rest === p.name || rest.startsWith(p.name + ' '));
      if (!target) {
        setText(msg);
        return showToast('לא מצאנו שחקן בשם הזה 🤔');
      }
      setPeer(target.id);
      setOpen(true);
      const body = rest.slice(target.name.length).trim();
      if (!body) return requestAnimationFrame(() => inputRef.current?.focus());
      const res = await emit('chat:send', { text: body, to: target.id });
      if (res.error) {
        setText(body);
        showToast(res.error);
      }
      return;
    }
    const res = await emit('chat:send', peer && msg !== '/host' ? { text: msg, to: peer } : msg);
    if (res.error) {
      if (msg !== '/host') setText(msg);
      showToast(res.error);
    } else if (res.notice) showToast(res.notice);
  }

  return (
    <section ref={ref} className="card scroll-mt-4 p-4">
      <button className="flex w-full items-center justify-between lg:cursor-default" onClick={() => setOpen((o) => !o)}>
        <h3 className="font-display text-xl">💬 צ׳אט</h3>
        <span className="flex items-center gap-2">
          {!visible && <Badges unread={unread} mentions={mentions} />}
          <span className="text-indigo-400 lg:hidden">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      <div className={`mt-3 ${open ? '' : 'hidden'} lg:block`}>
        {tabs.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {[null, ...tabs].map((id) => {
              const p = id && state.players.find((x) => x.id === id);
              const n = unreadIn(id || 'all');
              return (
                <button
                  key={id || 'all'}
                  onClick={() => setPeer(id)}
                  className={`chip shrink-0 gap-1 py-1 text-sm transition ${peer === id ? 'bg-grape text-white shadow' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                >
                  {p ? (
                    <>
                      🔒 {p.emoji} <span className="max-w-[5rem] truncate">{p.name}</span>
                    </>
                  ) : (
                    '👥 כולם'
                  )}
                  {n > 0 && peer !== id && <span className="rounded-full bg-bubble px-1.5 text-xs font-bold text-white">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div ref={listRef} className={`h-64 space-y-2 overflow-y-auto rounded-2xl p-2 ${peer ? 'bg-pink-50/70' : 'bg-indigo-50/60'}`}>
          {convMsgs.length === 0 && (
            <p className="py-8 text-center text-sm text-indigo-300">
              {peerPlayer ? `שיחה פרטית עם ${peerPlayer.name} 🔒 רק שניכם רואים` : 'עוד אין הודעות. תגידו שלום 👋'}
            </p>
          )}
          {convMsgs.map((m) => {
            const mine = m.pid === state.me;
            const tagged = !mine && m.mentions?.includes(state.me);
            return (
              <div key={m.id} className={`flex items-end gap-1.5 ${mine ? '' : 'flex-row-reverse'}`}>
                <Avatar emoji={m.emoji} size="sm" />
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? 'bg-grape text-white' : 'bg-white text-ink shadow-sm'
                  } ${tagged ? 'ring-2 ring-sun' : ''}`}
                >
                  {!mine && <div className="text-xs font-bold text-indigo-400">{m.name}</div>}
                  <div dir="auto" className="break-words">
                    <MessageText text={m.text} names={names} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={send} className="relative mt-2 flex gap-2">
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 bottom-full z-10 mb-1 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-indigo-100">
              {suggestions.map((p, i) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={p.run}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-right font-semibold ${
                      i === pick ? 'bg-amber-50' : 'hover:bg-indigo-50'
                    }`}
                  >
                    {p.avatar ? <Avatar emoji={p.emoji} size="sm" /> : <span className="w-7 text-center text-lg">{p.emoji}</span>}
                    <span dir={p.avatar ? undefined : 'ltr'}>{p.label}</span>
                    {p.hint && <span className="mr-auto text-sm font-normal text-indigo-400">{p.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            className="input min-w-0 flex-1 py-2 text-base"
            placeholder={
              closed
                ? 'הצ׳אט סגור במשחק הזה 🤫'
                : peerPlayer
                  ? `הודעה פרטית ל${peerPlayer.name}… (/chat לחזרה לכולם)`
                  : 'כתבו הודעה… (@ לתיוג, /chat @שם לפרטי, /host למארח)'
            }
            disabled={closed}
            maxLength={200}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={(e) => setCaret(e.target.selectionStart ?? 0)}
            onKeyDown={onKeyDown}
          />
          <button className="btn-primary shrink-0 px-4 py-2 text-base" disabled={closed || !text.trim()}>
            שליחה
          </button>
        </form>
      </div>
    </section>
  );
}
