import { useEffect, useRef, useState } from 'react';
import { emit } from '../socket.js';
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

// מצב הצ'אט שמשותף לכפתור בכותרת ולצ'אט עצמו: מה נקרא, כמה תיוגים, האם הצ'אט על המסך
export function useChatTracker() {
  const { state, chat } = useRoom();
  const ref = useRef();
  const wide = useWide();
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const [seenId, setSeenId] = useState(0);
  const lastId = chat.length ? chat[chat.length - 1].id : 0;
  const fresh = chat.filter((m) => m.id > seenId && m.pid !== state.me);
  const unread = fresh.length;
  const mentions = fresh.filter((m) => m.mentions?.includes(state.me)).length;
  const visible = inView && (open || wide);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.IntersectionObserver) return setInView(true);
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (visible) setSeenId(lastId);
  }, [visible, lastId]);

  function goTo() {
    setOpen(true);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  // בטלפון הצ'אט למטה ומקופל - הכפתור תמיד שם. במחשב רק כשגללו והצ'אט לא נראה
  const showButton = !wide || !inView;

  return { ref, open, setOpen, unread, mentions, visible, goTo, showButton, lastId };
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
  const { ref, open, setOpen, unread, mentions, visible, lastId } = tracker;
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const listRef = useRef();
  const inputRef = useRef();
  const names = state.players.map((p) => p.name);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, open]);

  // השלמה אוטומטית: הטקסט מה-@ האחרון ועד הסמן
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  const query = at >= 0 && (at === 0 || /\s/.test(before[at - 1])) ? before.slice(at + 1) : null;
  const suggestions =
    query != null && query.length <= 16
      ? state.players.filter((p) => p.id !== state.me && p.name.startsWith(query) && p.name !== query).slice(0, 6)
      : [];

  useEffect(() => setPick(0), [query]);

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
      mention(suggestions[pick].name);
    }
  }

  async function send(e) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    setCaret(0);
    const res = await emit('chat:send', msg);
    if (res.error) {
      setText(msg);
      showToast(res.error);
    }
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
        <div ref={listRef} className="h-64 space-y-2 overflow-y-auto rounded-2xl bg-indigo-50/60 p-2">
          {chat.length === 0 && <p className="py-8 text-center text-sm text-indigo-300">עוד אין הודעות. תגידו שלום 👋</p>}
          {chat.map((m) => {
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
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => mention(p.name)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-right font-semibold ${
                      i === pick ? 'bg-amber-50' : 'hover:bg-indigo-50'
                    }`}
                  >
                    <Avatar emoji={p.emoji} size="sm" />
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            className="input min-w-0 flex-1 py-2 text-base"
            placeholder="כתבו הודעה… (@ לתיוג)"
            maxLength={200}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={(e) => setCaret(e.target.selectionStart ?? 0)}
            onKeyDown={onKeyDown}
          />
          <button className="btn-primary shrink-0 px-4 py-2 text-base" disabled={!text.trim()}>
            שליחה
          </button>
        </form>
      </div>
    </section>
  );
}
