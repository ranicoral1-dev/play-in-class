import { useEffect, useRef, useState } from 'react';
import { GAME_META, GENRES } from '../lib.js';
import { useRoom, Avatar } from './ui.jsx';

// הלובי מאזין לזה: המארח בוחר את המשחק, כל השאר רק גוללים אליו
export const PICK_GAME = 'search:pick-game';

const norm = (s) => String(s || '').toLowerCase().trim();

// חיפוש משחקים ושחקנים. לחיצה על משחק - מעבר אליו בלובי; על שחקן - שיחה פרטית
export function SearchModal({ onClose, onDm }) {
  const { state, showToast } = useRoom();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(0);
  const inputRef = useRef();
  const query = norm(q);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const players = state.players.filter((p) => !query || norm(p.name).includes(query));
  const games = Object.entries(GAME_META).filter(
    ([id, g]) => !query || [g.name, g.desc, id, ...g.genres].some((x) => norm(x).includes(query)),
  );
  // השם מתאים קודם, אחר כך תיאור/נושא
  games.sort(([, a], [, b]) => Number(!norm(a.name).includes(query)) - Number(!norm(b.name).includes(query)));
  const items = [...players.map((p) => ({ kind: 'player', p })), ...games.map(([id, g]) => ({ kind: 'game', id, g }))];

  useEffect(() => setPick(0), [query]);

  function choose(item) {
    if (!item) return;
    if (item.kind === 'player') {
      if (item.p.id === state.me) return showToast('זה אתם 😄');
      onDm(item.p.id);
    } else {
      if (state.status !== 'lobby') return showToast('אפשר לבחור משחק רק בלובי');
      window.dispatchEvent(new CustomEvent(PICK_GAME, { detail: item.id }));
    }
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setPick((i) => (i + d + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[pick]);
    }
  }

  const row = (i) => `flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-right transition ${i === pick ? 'bg-amber-50' : 'hover:bg-indigo-50'}`;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg animate-pop p-4" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="input py-2.5 text-lg"
          placeholder="🔍 חיפוש משחק או שחקן…"
          value={q}
          maxLength={40}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
          {players.length > 0 && (
            <div>
              <div className="mb-1 px-1 text-sm font-bold text-indigo-400">👥 שחקנים</div>
              {players.map((p, i) => (
                <button key={p.id} className={row(i)} onMouseEnter={() => setPick(i)} onClick={() => choose(items[i])}>
                  <Avatar emoji={p.emoji} size="sm" dim={!p.connected} />
                  <span className="flex-1 truncate font-semibold">
                    {p.name}
                    {state.hosts?.includes(p.id) && ' 👑'}
                    {!p.connected && <span className="text-xs text-slate-400"> (מנותק)</span>}
                  </span>
                  {p.id !== state.me && <span className="text-sm text-indigo-400">💬 הודעה פרטית</span>}
                </button>
              ))}
            </div>
          )}
          {games.length > 0 && (
            <div>
              <div className="mb-1 px-1 text-sm font-bold text-indigo-400">🎮 משחקים</div>
              {games.map(([id, g], j) => {
                const i = players.length + j;
                return (
                  <button key={id} className={row(i)} onMouseEnter={() => setPick(i)} onClick={() => choose(items[i])}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${g.color}`}>{g.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg leading-tight">{g.name}</span>
                      <span className="block truncate text-xs text-indigo-400">
                        {g.genres.map((n) => `${GENRES[n] || ''} ${n}`).join(' · ')} · {g.minPlayers}+ שחקנים
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!items.length && <p className="py-6 text-center text-indigo-300">לא מצאנו כלום 🤷</p>}
        </div>
      </div>
    </div>
  );
}
