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
    out.timed = values[id]?.timed ?? true;
    out.times = {};
    for (const t of meta.timers) out.times[t.key] = values[id]?.times?.[t.key] ?? t.def;
    return out;
  }

  function setValue(id, key, v) {
    setValues((old) => ({ ...old, [id]: { ...old[id], [key]: v } }));
  }

  function setTime(id, key, v) {
    setValues((old) => ({ ...old, [id]: { ...old[id], times: { ...old[id]?.times, [key]: v } } }));
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
                    <Stepper value={v} min={s.min} max={s.max} step={s.step} onChange={(x) => setValue(selected, s.key, x)} />
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
          <TimeSettings
            timers={GAME_META[selected].timers}
            settings={settingsFor(selected)}
            onTimed={(v) => setValue(selected, 'timed', v)}
            onTime={(key, v) => setTime(selected, key, v)}
          />
          <button className="btn-pink mt-6 w-full py-4 text-2xl" disabled={busy} onClick={start}>
            🚀 מתחילים!
          </button>
        </div>
      )}
    </div>
  );
}

function TimeSettings({ timers, settings, onTimed, onTime }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-3xl border-2 border-indigo-100 p-4">
      <label className="label">⏱️ הגבלת זמן</label>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-indigo-50 p-1.5">
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onTimed(opt)}
            className={`rounded-xl py-2.5 font-display transition ${settings.timed === opt ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}
          >
            {opt ? 'עם זמן' : 'בלי זמן'}
          </button>
        ))}
      </div>
      {settings.timed ? (
        <>
          <button className="mt-3 text-sm font-bold text-indigo-500 hover:text-grape" onClick={() => setOpen((o) => !o)}>
            {open ? '▲' : '▼'} התאמת זמנים ({timers.map((t) => settings.times[t.key]).join(' / ')} שניות)
          </button>
          {open && (
            <div className="mt-3 grid animate-rise gap-4 sm:grid-cols-2">
              {timers.map((t) => (
                <div key={t.key}>
                  <label className="label">{t.label} (שניות)</label>
                  <Stepper value={settings.times[t.key]} min={5} max={600} step={5} onChange={(v) => onTime(t.key, v)} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-indigo-400">כל שלב מחכה עד שכולם עונים. למארח יש כפתור דילוג אם מישהו נתקע.</p>
      )}
    </div>
  );
}

function Stepper({ value, min, max, step = 1, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-indigo-50 p-1.5">
      <button
        className="h-11 w-11 rounded-xl bg-white font-display text-2xl text-grape shadow disabled:opacity-40"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
      <span className="font-display text-3xl tabular-nums">{value}</span>
      <button
        className="h-11 w-11 rounded-xl bg-white font-display text-2xl text-grape shadow disabled:opacity-40"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
    </div>
  );
}
