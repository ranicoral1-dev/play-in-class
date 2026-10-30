import { useEffect, useRef, useState } from 'react';
import { emit } from '../socket.js';
import { useRoom, Avatar } from './ui.jsx';

const wide = () => window.matchMedia?.('(min-width: 1024px)').matches;

// צ'אט החדר - זמין בלובי ובכל משחק. בטלפון מקופל, עם מונה הודעות שלא נקראו
export default function Chat() {
  const { state, chat, showToast } = useRoom();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seenId, setSeenId] = useState(0);
  const listRef = useRef();
  const lastId = chat.length ? chat[chat.length - 1].id : 0;
  const unread = chat.filter((m) => m.id > seenId && m.pid !== state.me).length;

  useEffect(() => {
    if (open || wide()) setSeenId(lastId);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, open]);

  async function send(e) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setText('');
    const res = await emit('chat:send', msg);
    if (res.error) {
      setText(msg);
      showToast(res.error);
    }
  }

  return (
    <section className="card p-4">
      <button className="flex w-full items-center justify-between lg:cursor-default" onClick={() => setOpen((o) => !o)}>
        <h3 className="font-display text-xl">💬 צ׳אט</h3>
        <span className="flex items-center gap-2 lg:hidden">
          {unread > 0 && !open && (
            <span className="rounded-full bg-bubble px-2 text-sm font-bold text-white animate-pop">{unread}</span>
          )}
          <span className="text-indigo-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      <div className={`mt-3 ${open ? '' : 'hidden'} lg:block`}>
        <div ref={listRef} className="h-64 space-y-2 overflow-y-auto rounded-2xl bg-indigo-50/60 p-2">
          {chat.length === 0 && <p className="py-8 text-center text-sm text-indigo-300">עוד אין הודעות. תגידו שלום 👋</p>}
          {chat.map((m) => {
            const mine = m.pid === state.me;
            return (
              <div key={m.id} className={`flex items-end gap-1.5 ${mine ? '' : 'flex-row-reverse'}`}>
                <Avatar emoji={m.emoji} size="sm" />
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? 'bg-grape text-white' : 'bg-white text-ink shadow-sm'
                  }`}
                >
                  {!mine && <div className="text-xs font-bold text-indigo-400">{m.name}</div>}
                  <div dir="auto" className="break-words">
                    {m.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input
            className="input min-w-0 flex-1 py-2 text-base"
            placeholder="כתבו הודעה…"
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn-primary shrink-0 px-4 py-2 text-base" disabled={!text.trim()}>
            שליחה
          </button>
        </form>
      </div>
    </section>
  );
}
