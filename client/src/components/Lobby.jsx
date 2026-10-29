import { useState } from 'react';
import { emit } from '../socket.js';
import { GAME_META } from '../lib.js';
import { useRoom, PlayerTag } from './ui.jsx';

export default function Lobby() {
  const { state, showToast } = useRoom();
  const isHost = state.hostId === state.me;
  const count = state.players.filter((p) => p.connected).length;
  const [selected, setSelected] = useState(state.gameId || null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);

  function settingsFor(id) {
    const meta = GAME_META[id];
    const out = {};
    for (const s of meta.settings) out[s.key] = values[id]?.[s.key] ?? s.def(count);
    return out;
  }

  function setValue(id, key, v) {
    setValues((old) => ({ ...old, [id]: { ...old[id], [key]: v } }));
  }

  async function start() {
    setBusy(true);
    const res = await emit('host:start', { gameId: selected, settings: settingsFor(selected) });
    setBusy(false);
    if (res.error) showToast(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="card animate-rise">
        {isHost ? (
          <>
            <h2 className="font-display text-3xl">בחרו משחק 🎮</h2>
            <p className="mt-1 text-indigo-500">אתם המארחים! בחרו משחק, כוונו הגדרות ויאללה.</p>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-5xl animate-wiggle">🎲</span>
            <div>
              <h2 className="font-display text-2xl">מחכים שהמארח יבחר משחק…</h2>
              <p className="mt-1 flex items-center gap-1 text-indigo-500">
                המארח: <PlayerTag id={state.hostId} />
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(GAME_META).map(([id, g], i) => {
          const active = selected === id;
          const enough = count >= g.minPlayers;
          return (
            <button
              key={id}
              disabled={!isHost}
              onClick={() => setSelected(id)}
              style={{ animationDelay: `${i * 0.05}s` }}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${g.color} p-5 text-right text-white shadow-lg transition-all animate-rise
                ${isHost ? 'hover:-translate-y-1 hover:shadow-2xl' : 'cursor-default'}
                ${active ? 'ring-4 ring-sun ring-offset-4 ring-offset-violet-900' : ''}`}
            >
              <span className="absolute -left-3 -top-3 text-7xl opacity-20 transition group-hover:scale-110">{g.emoji}</span>
              <div className="text-4xl">{g.emoji}</div>
              <div className="mt-2 font-display text-2xl">{g.name}</div>
              <p className="mt-1 text-sm leading-snug text-white/90">{g.desc}</p>
              <div className={`mt-3 text-xs font-bold ${enough ? 'text-white/70' : 'text-sun'}`}>
                {g.minPlayers}+ שחקנים {enough ? '' : '· צריך עוד חברים'}
              </div>
            </button>
          );
        })}
      </div>

      {isHost && selected && (
        <div className="card animate-rise">
          <h3 className="font-display text-2xl">
            {GAME_META[selected].emoji} הגדרות: {GAME_META[selected].name}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {GAME_META[selected].settings.map((s) => {
              const v = settingsFor(selected)[s.key];
              return (
                <div key={s.key}>
                  <label className="label">{s.label}</label>
                  {s.type === 'number' ? (
                    <Stepper value={v} min={s.min} max={s.max} onChange={(x) => setValue(selected, s.key, x)} />
                  ) : (
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-indigo-50 p-1.5">
                      {[true, false].map((opt) => (
                        <button
                          key={String(opt)}
                          onClick={() => setValue(selected, s.key, opt)}
                          className={`rounded-xl py-2.5 font-display transition ${
                            v === opt ? 'bg-white text-grape shadow' : 'text-indigo-400'
                          }`}
                        >
                          {opt ? s.on : s.off}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="btn-pink mt-6 w-full py-4 text-2xl" disabled={busy} onClick={start}>
            🚀 מתחילים!
          </button>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-indigo-50 p-1.5">
      <button
        className="h-11 w-11 rounded-xl bg-white font-display text-2xl text-grape shadow disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
      <span className="font-display text-3xl tabular-nums">{value}</span>
      <button
        className="h-11 w-11 rounded-xl bg-white font-display text-2xl text-grape shadow disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
    </div>
  );
}
