import { useEffect, useRef, useState } from 'react';
import { emit, socket } from '../socket.js';
import { GAME_META, GENRES } from '../lib.js';
import { useRoom, PlayerTag } from './ui.jsx';

// מה שחקן ביקש, בשביל ההודעה למארח
function wishText(gameId, key, value) {
  const meta = GAME_META[gameId];
  if (!meta) return '';
  if (key == null) return `${meta.emoji} ${meta.name}`;
  if (key === 'timed') return `${meta.name}: ${value ? 'עם זמן' : 'בלי זמן'}`;
  const s = meta.settings.find((x) => x.key === key);
  if (!s) return meta.name;
  const label = s.type === 'toggle' ? (value ? s.on : s.off) : s.type === 'select' ? s.options.find((o) => o.value === value)?.label : value;
  return `${meta.name}: ${s.label} - ${label}`;
}

// אווטרים קטנים של מי שביקש
function Fans({ ids, className = '' }) {
  const { state } = useRoom();
  if (!ids.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-0.5 ${className}`}>
      {ids.map((id) => {
        const p = state.players.find((x) => x.id === id);
        return (
          <span key={id} title={p?.name} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow">
            {p?.emoji || '❔'}
          </span>
        );
      })}
    </span>
  );
}

export default function Lobby() {
  const { state, showToast } = useRoom();
  const isHost = state.hosts?.includes(state.me);
  const count = state.players.filter((p) => p.connected).length;
  const [selected, setSelected] = useState(state.gameId || null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  // אפשר לבחור כמה נושאים - מוצגים רק משחקים שיש להם את כולם
  const [genres, setGenres] = useState([]);
  const toggleGenre = (name) => setGenres((old) => (old.includes(name) ? old.filter((x) => x !== name) : [...old, name]));
  const wishes = state.wishes || {};
  const myWish = wishes[state.me];
  // המארח בוחר בעצמו; כל השאר רואים את מה שהמארח בוחר עכשיו
  const shownId = isHost ? selected : state.draft?.gameId || null;
  const gameFans = (id) => Object.keys(wishes).filter((pid) => wishes[pid].gameId === id);
  const settingFans = (key, v) => Object.keys(wishes).filter((pid) => wishes[pid].gameId === shownId && wishes[pid].picks[key] === v);
  const playersRef = useRef(state.players);
  playersRef.current = state.players;

  function settingsFor(id) {
    const meta = GAME_META[id];
    const out = {};
    for (const s of meta.settings) out[s.key] = values[id]?.[s.key] ?? (s.type === 'textarea' ? loadText(id, s.key) : null) ?? s.def(count);
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

  // המארח משתף את ההגדרות (בלי טקסט חופשי) כדי שכולם יראו מה הוא בוחר
  const draftJson = isHost && selected ? JSON.stringify(publicPart(selected, settingsFor(selected))) : null;
  useEffect(() => {
    if (draftJson) emit('host:draft', { gameId: selected, settings: JSON.parse(draftJson) });
  }, [draftJson]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isHost) return;
    const onWish = ({ pid, gameId, key, value }) => {
      const p = playersRef.current.find((x) => x.id === pid);
      if (key != null && value == null) return;
      showToast(`${p?.emoji || ''} ${p?.name || '?'} רוצה: ${wishText(gameId, key, value)}`);
    };
    socket.on('wish', onWish);
    return () => socket.off('wish', onWish);
  }, [isHost, showToast]);

  const wish = (gameId, key, value) => emit('wish', { gameId, key, value });

  // ערך שנבחר: המארח משנה, שחקן אחר מבקש
  function choose(key, v) {
    if (isHost) setValue(selected, key, v);
    else wish(shownId, key, v);
  }

  // מה שמוצג בהגדרות: אצל המארח - שלו; אצל השאר - של המארח
  const shown = isHost ? (selected ? settingsFor(selected) : null) : state.draft?.settings || null;

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
                {state.hosts?.length > 1 ? 'המארחים:' : 'המארח:'}
                {(state.hosts || [state.hostId]).map((id) => (
                  <PlayerTag key={id} id={id} />
                ))}
              </p>
              <p className="mt-1 text-sm text-indigo-400">רוצים משחק או הגדרה מסוימת? לחצו עליהם והמארח יראה 🙋</p>
              <p className="mt-0.5 text-sm text-indigo-400">רוצים להיות מארחים? כתבו /host בצ׳אט 👑</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[null, ...Object.keys(GENRES)].map((name) => (
          <button
            key={name ?? 'all'}
            onClick={() => (name ? toggleGenre(name) : setGenres([]))}
            className={`chip py-1.5 transition ${(name ? genres.includes(name) : !genres.length) ? 'bg-sun text-ink shadow' : 'bg-white/15 text-white hover:bg-white/25'}`}
          >
            {name ? `${GENRES[name]} ${name}` : '✨ הכל'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(GAME_META)
          .filter(([, g]) => genres.every((name) => g.genres.includes(name)))
          .map(([id, g], i) => {
          const active = shownId === id;
          const enough = count >= g.minPlayers;
          const fans = gameFans(id);
          return (
            <button
              key={id}
              onClick={() => (isHost ? setSelected(id) : wish(id, null))}
              style={{ animationDelay: `${i * 0.05}s` }}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${g.color} p-5 text-right text-white shadow-lg transition-all animate-rise
                hover:-translate-y-1 hover:shadow-2xl
                ${active ? 'ring-4 ring-sun ring-offset-4 ring-offset-violet-900' : !isHost && myWish?.gameId === id ? 'ring-4 ring-white/70 ring-offset-2 ring-offset-violet-900' : ''}`}
            >
              {fans.length > 0 && (
                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-xs font-bold">
                  🙋 <Fans ids={fans} />
                </span>
              )}
              <span className="absolute -left-3 -top-3 text-7xl opacity-20 transition group-hover:scale-110">{g.emoji}</span>
              <div className="text-4xl">{g.emoji}</div>
              <div className="mt-2 font-display text-2xl">{g.name}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {g.genres.map((name) => (
                  <span key={name} className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                    {GENRES[name]} {name}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-sm leading-snug text-white/90">{g.desc}</p>
              <div className={`mt-3 text-xs font-bold ${enough ? 'text-white/70' : 'text-sun'}`}>
                {g.minPlayers}+ שחקנים {enough ? '' : '· צריך עוד חברים'}
              </div>
            </button>
          );
        })}
      </div>
      {!Object.values(GAME_META).some((g) => genres.every((name) => g.genres.includes(name))) && (
        <p className="rounded-3xl bg-white/10 p-4 text-center font-bold text-white">אין משחק שיש לו את כל הנושאים האלה 🤷 נסו להוריד אחד</p>
      )}

      {shownId && shown && (
        <div className="card animate-rise">
          <h3 className="font-display text-2xl">
            {GAME_META[shownId].emoji} הגדרות: {GAME_META[shownId].name}
          </h3>
          {!isHost && <p className="mt-1 text-sm text-indigo-400">👀 ככה המארח מגדיר עכשיו. לחצו על מה שאתם רוצים והמארח יראה 🙋</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {GAME_META[shownId].settings.map((s) => {
              if (s.type === 'textarea' && !isHost) return null;
              const v = shown[s.key];
              const mine = !isHost && myWish?.gameId === shownId ? myWish.picks[s.key] : undefined;
              return (
                <div key={s.key} className={s.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="label">{s.label}</label>
                  {s.type === 'textarea' ? (
                    <>
                      <textarea
                        className="input min-h-[110px] text-base"
                        placeholder={s.placeholder}
                        value={v}
                        onChange={(e) => {
                          setValue(selected, s.key, e.target.value);
                          saveText(selected, s.key, e.target.value);
                        }}
                      />
                      {s.hint && <p className="mt-1 text-xs text-indigo-400">{s.hint}</p>}
                    </>
                  ) : s.type === 'number' ? (
                    <>
                      <Stepper value={mine ?? v} min={s.min} max={s.max} step={s.step} onChange={(x) => choose(s.key, x)} />
                      {mine != null && mine !== v && <p className="mt-1 text-xs text-indigo-400">🙋 ביקשת {mine} · אצל המארח: {v}</p>}
                      <NumberWishes key={s.key} fans={Object.keys(wishes).filter((pid) => wishes[pid].gameId === shownId && wishes[pid].picks[s.key] != null)} wishes={wishes} skey={s.key} current={v} onApply={isHost ? (x) => setValue(selected, s.key, x) : null} />
                    </>
                  ) : (
                    <Options
                      options={s.type === 'select' ? s.options : [{ value: true, label: s.on }, { value: false, label: s.off }]}
                      cols={s.type === 'select' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}
                      value={v}
                      mine={mine}
                      fans={(x) => settingFans(s.key, x)}
                      onPick={(x) => choose(s.key, x)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {GAME_META[shownId].note && <p className="mt-3 text-sm text-indigo-500">{GAME_META[shownId].note}</p>}
          <TimeSettings
            timers={GAME_META[shownId].timers}
            settings={shown}
            mine={!isHost && myWish?.gameId === shownId ? myWish.picks.timed : undefined}
            fans={(x) => settingFans('timed', x)}
            onTimed={(v) => choose('timed', v)}
            onTime={isHost ? (key, v) => setTime(selected, key, v) : null}
          />
          {isHost && (
            <button className="btn-pink mt-6 w-full py-4 text-2xl" disabled={busy} onClick={start}>
              🚀 מתחילים!
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// מה שנשלח לשאר השחקנים: בלי טקסט חופשי (מילים ושאלות של המארח נשארות סודיות)
function publicPart(id, settings) {
  const out = { ...settings };
  for (const s of GAME_META[id].settings) if (s.type === 'textarea') delete out[s.key];
  return out;
}

// כפתורי בחירה (כן/לא או רשימה), עם מי שביקש כל אפשרות
function Options({ options, cols, value, mine, fans, onPick }) {
  return (
    <div className={`grid gap-2 rounded-2xl bg-indigo-50 p-1.5 ${cols}`}>
      {options.map((opt) => {
        const f = fans(opt.value);
        return (
          <button
            key={String(opt.value)}
            onClick={() => onPick(opt.value)}
            className={`relative rounded-xl py-2.5 font-display transition ${value === opt.value ? 'bg-white text-grape shadow' : 'text-indigo-400'} ${
              mine === opt.value ? 'outline-dashed outline-2 outline-pink-400' : ''
            }`}
          >
            {opt.label}
            {f.length > 0 && <Fans ids={f} className="absolute -top-2 left-1" />}
          </button>
        );
      })}
    </div>
  );
}

// בקשות למספר: המארח יכול ללחוץ כדי לקבל
function NumberWishes({ fans, wishes, skey, current, onApply }) {
  const list = fans.filter((pid) => wishes[pid].picks[skey] !== current);
  if (!list.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {list.map((pid) => {
        const x = wishes[pid].picks[skey];
        return (
          <button key={pid} disabled={!onApply} onClick={() => onApply?.(x)} className="chip gap-1 bg-pink-50 text-pink-700 enabled:hover:bg-pink-100">
            <Fans ids={[pid]} /> רוצה {x}
          </button>
        );
      })}
    </div>
  );
}

// טקסט חופשי (למשל מילים שהמארח הוסיף) נשמר במכשיר, כדי שלא יצטרכו להקליד שוב
function loadText(id, key) {
  try {
    return localStorage.getItem(`setting:${id}:${key}`);
  } catch {
    return null;
  }
}

function saveText(id, key, v) {
  try {
    localStorage.setItem(`setting:${id}:${key}`, v);
  } catch {
    /* לא קריטי */
  }
}

function TimeSettings({ timers, settings, mine, fans, onTimed, onTime }) {
  const [open, setOpen] = useState(false);
  const summary = `(${timers.map((t) => settings.times?.[t.key] ?? t.def).join(' / ')} שניות)`;
  return (
    <div className="mt-5 rounded-3xl border-2 border-indigo-100 p-4">
      <label className="label">⏱️ הגבלת זמן</label>
      <Options
        options={[
          { value: true, label: 'עם זמן' },
          { value: false, label: 'בלי זמן' },
        ]}
        cols="grid-cols-2"
        value={settings.timed}
        mine={mine}
        fans={fans}
        onPick={onTimed}
      />
      {settings.timed ? (
        !onTime ? (
          <p className="mt-3 text-sm font-bold text-indigo-500">זמנים {summary}</p>
        ) : (
        <>
          <button className="mt-3 text-sm font-bold text-indigo-500 hover:text-grape" onClick={() => setOpen((o) => !o)}>
            {open ? '▲' : '▼'} התאמת זמנים {summary}
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
        )
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
