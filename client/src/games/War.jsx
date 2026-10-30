import { useMemo, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, DoneRow } from '../components/ui.jsx';

const RES = {
  food: ['🍖', 'אוכל'],
  wood: ['🪵', 'עץ'],
  wool: ['🧶', 'צמר'],
  sand: ['⏳', 'חול'],
  glass: ['🪟', 'זכוכית'],
  gold: ['🪙', 'זהב'],
  metal: ['⚙️', 'מתכת'],
  emerald: ['💎', 'אמרלד'],
  magic: ['✨', 'קסם'],
  stone: ['🪨', 'אבן'],
  ore: ['⛏️', 'עפרות'],
};
const RES_KEYS = Object.keys(RES);

const TERRAIN = {
  g: { emoji: '🌿', name: 'דשא', color: '#6fcf5b', makes: 'אוכל (פרות, חזירים, חיטה), עץ, צמר (כבשים)' },
  s: { emoji: '🏜️', name: 'חול', color: '#f4d58d', makes: 'חול, זכוכית' },
  v: { emoji: '🦒', name: 'סוואנה', color: '#d4a24c', makes: 'עץ, זהב, מתכת' },
  n: { emoji: '❄️', name: 'שלג', color: '#eef4fb', makes: 'אמרלד, קסם' },
  c: { emoji: '🪨', name: 'מערה', color: '#8a817c', makes: 'אבן, עפרות, אוכל (פטריות)' },
};
// איזו אדמה מגדלת כל משאב - כמו PRODUCES בשרת
const GROWS_ON = { food: 'gc', wood: 'gv', wool: 'g', sand: 's', glass: 's', gold: 'v', metal: 'v', emerald: 'n', magic: 'n', stone: 'c', ore: 'c' };

// העלויות זהות ל-ITEMS בשרת (server/games/war.js)
const ITEMS = {
  house: { emoji: '🏠', name: 'בית', desc: '+6 מקום מגורים - ככה העם גדל. עד 3 לכל אדמה', cost: { wood: 15 }, building: true },
  tower: { emoji: '🗼', name: 'מגדל שמירה', desc: '+20% הגנה (עד 5)', cost: { stone: 10, wood: 5 }, building: true },
  training: { emoji: '🏟️', name: 'מגרש אימונים', desc: 'אבירים בבית משתפרים פי 3 מהר', cost: { wood: 20, metal: 5 }, building: true },
  market: { emoji: '🏪', name: 'שוק', desc: 'החלפה בשוק העולמי 3:1 במקום 5:1', cost: { wood: 15, gold: 5 }, building: true },
  castle: { emoji: '🏰', name: 'טירה', desc: '+50% הגנה, +10 מקום, ושומרת על המלך', cost: { stone: 30, gold: 10, glass: 5 }, building: true },
  club: { emoji: '🏏', name: 'אלה', desc: 'נשק: כוח האביר ×1.3', cost: { wood: 4 } },
  sword: { emoji: '🗡️', name: 'חרב', desc: 'נשק: כוח האביר ×1.8', cost: { wood: 2, metal: 4 } },
  staff: { emoji: '🪄', name: 'מטה קסם', desc: 'נשק: כוח האביר ×2.5', cost: { wood: 2, magic: 3, emerald: 1 } },
  armor: { emoji: '🛡️', name: 'שריון', desc: 'חצי סיכוי לשרוד מכה קטלנית', cost: { metal: 3, wool: 2 } },
  bomb: { emoji: '💣', name: 'פצצה', desc: '+3 כוח בהתקפה (מתפוצצת בקרב)', cost: { ore: 3, sand: 2 } },
  ship: { emoji: '⛵', name: 'ספינה', desc: 'לוקחת 10 אבירים מעבר לים, ושומרת על מגלי ארצות', cost: { wood: 25, wool: 5 } },
  compass: { emoji: '🧭', name: 'מצפן', desc: 'מגלה ארצות עם מצפן שורד יותר', cost: { metal: 1, glass: 2 } },
  potion: { emoji: '🧪', name: 'שיקוי', desc: 'מציל אביר אחד ממוות בקרב', cost: { magic: 2, glass: 1 } },
};

const JOBS = {
  idle: { emoji: '🧍', name: 'פנויים' },
  builder: { emoji: '👷', name: 'בנאים', skill: 4, desc: 'בונים את מה שבתור הבנייה' },
  knight: { emoji: '⚔️', name: 'אבירים', skill: 5, desc: 'שומרים על הבית ויוצאים לקרבות' },
  explorer: { emoji: '🧭', name: 'מגלי ארצות', skill: 6, desc: 'יוצאים מחוץ למפה ומביאים אדמות, משאבים ואנשים' },
};
const SKILLS = [
  [3, '👨‍🌾'],
  [4, '👷'],
  [5, '⚔️'],
  [6, '🧭'],
];
const GOALS = {
  king: ['👑', 'להפיל את המלך', '+5 נקודות ושלל'],
  land: ['🏞️', 'לכבוש אדמה', 'ככל שמנצחים בגדול - כובשים יותר'],
  people: ['💀', 'להרוג אנשים', 'ולקחת הרבה שלל'],
};

// פריט באדם: [id, name, job, farm, build, fight, explore, away]
const jobOf = (p) => p[2];
const skillFor = (job) => (job.startsWith('farm:') ? 3 : JOBS[job]?.skill);

// ---------- גאומטריה: ריצוף קהיר, בדיוק כמו בשרת - הסדר של האריחים חייב להיות זהה ----------
const SEG = 0.2743;

function segment(i, j) {
  const cx = i + 0.5;
  const cy = j + 0.5;
  return (i + j) % 2 === 0
    ? [
        [cx - SEG, cy],
        [cx + SEG, cy],
      ]
    : [
        [cx, cy - SEG],
        [cx, cy + SEG],
      ];
}

function pentagon(P, Q, squares) {
  const horizontal = P[1] === Q[1];
  const mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
  const pts = [P, Q];
  for (const [i, j] of squares) {
    const [a, b] = segment(i, j);
    const parallel = horizontal ? a[1] === b[1] : a[0] === b[0];
    if (parallel) pts.push(a, b);
    else pts.push(Math.hypot(a[0] - mid[0], a[1] - mid[1]) < Math.hypot(b[0] - mid[0], b[1] - mid[1]) ? a : b);
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / 5;
  const cy = pts.reduce((s, p) => s + p[1], 0) / 5;
  return pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

function geometry(W, H) {
  const polys = [];
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) polys.push(pentagon([i, j + 1], [i + 1, j + 1], [[i, j], [i, j + 1]]));
  }
  for (let i = 0; i < W - 1; i++) {
    for (let j = 0; j < H; j++) polys.push(pentagon([i + 1, j], [i + 1, j + 1], [[i, j], [i + 1, j]]));
  }
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const edges = new Map();
  polys.forEach((poly, t) => {
    for (let e = 0; e < 5; e++) {
      const p = poly[e];
      const q = poly[(e + 1) % 5];
      const a = key(p);
      const b = key(q);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(k, [...(edges.get(k) || []), { t, p, q }]);
    }
  });
  const adj = polys.map(() => []);
  const borders = polys.map(() => []); // לכל אריח: [נקודה, נקודה, השכן מעבר לצלע או -1]
  for (const list of edges.values()) {
    for (const { t, p, q } of list) {
      const other = list.find((x) => x.t !== t);
      borders[t].push([p, q, other ? other.t : -1]);
      if (other) adj[t].push(other.t);
    }
  }
  const center = polys.map((poly) => [poly.reduce((s, p) => s + p[0], 0) / 5, poly.reduce((s, p) => s + p[1], 0) / 5]);
  const points = polys.map((poly) => poly.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' '));
  return { adj, borders, center, points };
}

function useGeo(g) {
  return useMemo(() => geometry(g.W, g.H), [g.W, g.H]);
}

function useMyIndex(g) {
  const { state } = useRoom();
  return g.kingdoms.findIndex((k) => k.id === state.me);
}

const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ---------- המסך הראשי ----------
export default function War({ g }) {
  const placing = g.phase === 'place' || g.me?.placing;
  return (
    <div className="card">
      <GameHeader title="⚔️ מלחמה">
        {g.timeLeft != null && g.phase === 'play' && (
          <span className={`chip font-display text-lg tabular-nums ${g.timeLeft <= 60 ? 'animate-pulse bg-rose-100 text-rose-700' : ''}`}>
            ⏳ {clock(g.timeLeft)}
          </span>
        )}
      </GameHeader>
      {!g.me ? <MapView g={g} /> : placing ? <PlacePhase g={g} /> : <PlayPhase g={g} />}
    </div>
  );
}

// ---------- המפה ----------
function MapView({ g, onTile, marks, selected }) {
  const { state } = useRoom();
  const geo = useGeo(g);
  const [zoom, setZoom] = useState(1);
  const ownerKey = g.owner.join(',');

  const tiles = useMemo(
    () =>
      geo.points.map((pts, t) => {
        const ter = g.terrain[t];
        const fill = ter === '.' ? (t % 3 ? '#2f74c0' : '#2b6cb3') : TERRAIN[ter].color;
        return <polygon key={t} points={pts} fill={fill} stroke="#1e3a8a" strokeOpacity={0.25} strokeWidth={0.015} />;
      }),
    [geo, g.terrain],
  );

  const icons = useMemo(
    () =>
      g.terrain.split('').map((ter, t) =>
        ter === '.' ? null : (
          <text key={t} x={geo.center[t][0]} y={geo.center[t][1]} fontSize={0.26} textAnchor="middle" dominantBaseline="central" opacity={0.8}>
            {TERRAIN[ter].emoji}
          </text>
        ),
      ),
    [geo, g.terrain],
  );

  // גבולות: רק בין אריח לשכן של ממלכה אחרת, קצת פנימה כדי ששתי הממלכות ייראו
  const borders = useMemo(() => {
    const out = [];
    g.owner.forEach((o, t) => {
      if (o < 0) return;
      const [cx, cy] = geo.center[t];
      for (const [p, q, n] of geo.borders[t]) {
        if (n >= 0 && g.owner[n] === o) continue;
        const ins = (pt) => [pt[0] + (cx - pt[0]) * 0.13, pt[1] + (cy - pt[1]) * 0.13];
        const [a, b] = [ins(p), ins(q)];
        out.push(
          <line key={`${t}-${out.length}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={g.kingdoms[o].color} strokeWidth={0.08} strokeLinecap="round" />,
        );
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, ownerKey, g.kingdoms.length]);

  const emojiOf = (id) => state.players.find((p) => p.id === id)?.emoji || '👑';

  return (
    <div className="relative">
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
        <button className="h-9 w-9 rounded-xl bg-white/90 font-display text-xl shadow" onClick={() => setZoom((z) => Math.min(3, z + 0.5))}>
          +
        </button>
        <button className="h-9 w-9 rounded-xl bg-white/90 font-display text-xl shadow" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>
          −
        </button>
      </div>
      <div dir="ltr" className="max-h-[70vh] overflow-auto rounded-3xl bg-[#1d4f91]">
        <svg viewBox={`-0.15 -0.15 ${g.W + 0.3} ${g.H + 0.3}`} style={{ width: `${zoom * 100}%` }} className="block select-none">
          {tiles}
          {marks &&
            [...marks].map((t) => <polygon key={`m${t}`} points={geo.points[t]} fill="#fff" opacity={0.28} className="animate-pulse" pointerEvents="none" />)}
          {icons}
          {borders}
          {g.kingdoms.map((k, i) =>
            k.capital == null || g.owner[k.capital] !== i ? null : (
              <g key={k.id} pointerEvents="none">
                <circle cx={geo.center[k.capital][0]} cy={geo.center[k.capital][1]} r={0.24} fill="#fff" stroke={k.color} strokeWidth={0.06} />
                <text x={geo.center[k.capital][0]} y={geo.center[k.capital][1]} fontSize={0.3} textAnchor="middle" dominantBaseline="central">
                  {k.king ? emojiOf(k.id) : '💀'}
                </text>
              </g>
            ),
          )}
          {selected != null && <polygon points={geo.points[selected]} fill="none" stroke="#fff" strokeWidth={0.07} pointerEvents="none" />}
          {g.armies.map((a) => {
            const [x1, y1] = geo.center[a.from];
            const [x2, y2] = geo.center[a.to];
            const x = x1 + (x2 - x1) * a.p;
            const y = y1 + (y2 - y1) * a.p;
            return (
              <g key={a.id} style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 1s linear' }} pointerEvents="none">
                <circle r={0.22} fill={g.kingdoms[a.o]?.color} stroke={a.vs ? '#fff' : '#1e1b4b'} strokeWidth={0.05} />
                <text fontSize={0.24} textAnchor="middle" dominantBaseline="central">
                  {a.ship ? '⛵' : a.back ? '🏠' : '⚔️'}
                </text>
              </g>
            );
          })}
          {onTile &&
            geo.points.map((pts, t) => (
              <polygon key={`c${t}`} points={pts} fill="transparent" className="cursor-pointer hover:fill-white/20" onClick={() => onTile(t)} />
            ))}
        </svg>
      </div>
    </div>
  );
}

// ---------- הנחת אדמות ----------
function PlacePhase({ g }) {
  const { act } = useRoom();
  const geo = useGeo(g);
  const my = useMyIndex(g);
  const me = g.me;
  const respawn = g.phase === 'play';
  const total = respawn ? 3 : 5;

  const marks = useMemo(() => {
    const set = new Set();
    if (me.ready || me.placeLeft <= 0) return set;
    const hasLand = g.owner.includes(my);
    g.owner.forEach((o, t) => {
      if (o !== -1 || g.terrain[t] !== '.') return;
      const nb = geo.adj[t];
      if (hasLand && !nb.some((n) => g.owner[n] === my)) return;
      if (nb.some((n) => g.owner[n] !== -1 && g.owner[n] !== my)) return;
      set.add(t);
    });
    return set;
  }, [g.owner, g.terrain, geo, my, me.ready, me.placeLeft]);

  return (
    <div className="space-y-4">
      <div className={`rounded-3xl p-4 ${respawn ? 'bg-amber-50' : 'bg-sky-50'}`}>
        <div className="font-display text-2xl">{respawn ? '🏳️ הממלכה נפלה - מתחילים מחדש!' : '🗺️ בונים ממלכה'}</div>
        <p className="mt-1 text-sm leading-relaxed text-indigo-900/80">
          כל המפה היא מים 🌊. לחצו על המים כדי להניח <b>{total} אדמות דשא 🌿</b> שנוגעות זו בזו. אי אפשר לגעת בממלכה של מישהו
          אחר, ולחיצה על אדמה שלכם מורידה אותה. המקומות האפשריים מהבהבים.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="chip bg-white font-display text-lg">נשארו {me.placeLeft} 🌿</span>
          {me.ready ? (
            <button className="btn-ghost" onClick={() => act('unready')}>
              ✋ רגע, עוד לא
            </button>
          ) : (
            <button className="btn-primary" disabled={me.placeLeft > 0} onClick={() => act('ready')}>
              {respawn ? '🌱 מתחילים מחדש' : '✓ סיימתי'}
            </button>
          )}
        </div>
      </div>
      <MapView g={g} marks={marks} onTile={(t) => act('place', { tile: t })} />
      {!respawn && <DoneRow ids={g.kingdoms.map((k) => k.id)} doneIds={g.kingdoms.filter((k) => k.ready).map((k) => k.id)} label="מי מוכן?" />}
      {!respawn && <HowTo />}
    </div>
  );
}

// ---------- המשחק עצמו ----------
const TABS = [
  ['people', '👥 העם'],
  ['build', '🔨 בנייה'],
  ['army', '⚔️ צבא'],
  ['explore', '🧭 מסעות'],
  ['diplo', '🤝 ממלכות'],
  ['log', '📜 יומן'],
  ['help', '❓ חוקים'],
];

function PlayPhase({ g }) {
  const geo = useGeo(g);
  const my = useMyIndex(g);
  const [tab, setTab] = useState('people');
  const [sel, setSel] = useState(null);
  const me = g.me;
  const hasTokens = Object.values(me.landTokens).some((n) => n > 0);

  const marks = useMemo(() => {
    if (!hasTokens) return null;
    const set = new Set();
    g.owner.forEach((o, t) => {
      if (o === -1 && g.terrain[t] === '.' && geo.adj[t].some((n) => g.owner[n] === my)) set.add(t);
    });
    return set;
  }, [hasTokens, g.owner, g.terrain, geo, my]);

  return (
    <div className="space-y-3">
      <Alerts g={g} />
      <StatusBar g={g} />
      <MapView g={g} marks={marks} selected={sel} onTile={(t) => setSel((s) => (s === t ? null : t))} />
      {sel != null ? (
        <TilePanel g={g} tile={sel} key={sel} onClose={() => setSel(null)} />
      ) : (
        <p className="text-center text-sm text-indigo-400">לחצו על אדמה במפה כדי לראות מה יש בה - או כדי לתקוף אותה ⚔️</p>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-indigo-50 p-1.5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${tab === id ? 'bg-white text-grape shadow' : 'text-indigo-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="animate-rise" key={tab}>
        {tab === 'people' && <PeopleTab g={g} />}
        {tab === 'build' && <BuildTab g={g} />}
        {tab === 'army' && <ArmyTab g={g} />}
        {tab === 'explore' && <ExploreTab g={g} />}
        {tab === 'diplo' && <DiploTab g={g} />}
        {tab === 'log' && <LogTab g={g} />}
        {tab === 'help' && <HowTo open />}
      </div>
    </div>
  );
}

function Alerts({ g }) {
  const incoming = g.armies.filter((a) => a.vs);
  const me = g.me;
  return (
    <>
      {incoming.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-100 px-4 py-2 font-semibold text-rose-900 animate-pulse">
          🚨 צבא של <PlayerTag id={g.kingdoms[a.o].id} /> ({a.n} אבירים, {GOALS[a.goal][0]} {GOALS[a.goal][1]}) מגיע בעוד {a.eta} שנ׳!
        </div>
      ))}
      {me.hungry && <div className="rounded-2xl bg-amber-100 px-4 py-2 font-semibold text-amber-900">😵 העם רעב! אנשים ימותו - שימו עוד חקלאים על 🍖 אוכל</div>}
      {!me.king && <div className="rounded-2xl bg-slate-100 px-4 py-2 font-semibold">👑💀 המלך שלכם מת - ההגנה חלשה יותר. מלך חדש יוכתר בעוד {me.kingIn} שנ׳</div>}
    </>
  );
}

function StatusBar({ g }) {
  const me = g.me;
  const my = useMyIndex(g);
  const tiles = g.owner.filter((o) => o === my).length;
  return (
    <div className="rounded-3xl bg-indigo-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-white">
          👥 {me.pop} / {me.cap} אנשים
        </span>
        <span className="chip bg-white">🏞️ {tiles} אדמות</span>
        <span className="chip bg-white">{me.king ? '👑 המלך חי' : `💀 מלך חדש בעוד ${me.kingIn}`}</span>
        <span className="chip bg-amber-100 text-amber-900" title="5 לכל מלך שהפלתם + 1 לכל אדמה + 1 לכל 10 אנשים">
          🏆 {me.score} נק׳ {me.kingKills > 0 && `(👑×${me.kingKills})`}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
        {RES_KEYS.map((r) => {
          const rate = me.rates[r];
          const zero = !me.res[r] && !rate;
          return (
            <div key={r} title={RES[r][1]} className={`rounded-xl bg-white px-1.5 py-1 text-center ${zero ? 'opacity-40' : ''}`}>
              <div className="text-lg leading-none">{RES[r][0]}</div>
              <div className="font-display tabular-nums leading-tight">{fmt(me.res[r])}</div>
              {rate !== 0 && (
                <div className={`text-[10px] font-bold tabular-nums ${rate < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {rate > 0 ? '+' : ''}
                  {rate.toFixed(1)}/ש׳
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- אריח שנבחר ----------
function TilePanel({ g, tile, onClose }) {
  const { act } = useRoom();
  const geo = useGeo(g);
  const my = useMyIndex(g);
  const o = g.owner[tile];
  const ter = g.terrain[tile];
  const touchesMe = geo.adj[tile].some((n) => g.owner[n] === my);
  let body;

  if (ter === '.') {
    const tokens = Object.entries(g.me.landTokens).filter(([, n]) => n > 0);
    body = (
      <>
        <div className="font-display text-xl">🌊 מים</div>
        {tokens.length && touchesMe ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tokens.map(([t, n]) => (
              <button key={t} className="btn-mint py-2 text-base" onClick={() => act('placeLand', { tile, terrain: t }).then((r) => r.ok && onClose())}>
                {TERRAIN[t].emoji} להניח {TERRAIN[t].name} ({n})
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-indigo-500">
            {tokens.length
              ? 'אפשר להניח אדמה חדשה רק על מים שנוגעים בממלכה שלכם.'
              : 'מגלי ארצות יכולים למצוא אדמות חדשות - ואז מניחים אותן על מים ליד הממלכה.'}
          </p>
        )}
      </>
    );
  } else {
    const T = TERRAIN[ter];
    const header = (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xl">
          {T.emoji} {T.name}
        </span>
        {o >= 0 && <PlayerTag id={g.kingdoms[o].id} />}
        {g.kingdoms[o]?.capital === tile && <span className="chip bg-amber-100">🏰 בירה</span>}
      </div>
    );
    body =
      o === my ? (
        <>
          {header}
          <p className="mt-1 text-sm text-indigo-500">האדמה שלכם. מגדלים כאן: {T.makes}.</p>
        </>
      ) : (
        <>
          {header}
          <p className="mt-1 text-sm text-indigo-500">מגדלים כאן: {T.makes}.</p>
          <AttackForm g={g} tile={tile} owner={o} byLand={touchesMe} onDone={onClose} />
        </>
      );
  }

  return (
    <div className="relative rounded-3xl border-2 border-indigo-100 bg-white p-4 animate-rise">
      <button className="absolute left-3 top-3 text-indigo-300 hover:text-grape" onClick={onClose}>
        ✕
      </button>
      {body}
    </div>
  );
}

function Stepper({ value, min = 0, max, onChange, label }) {
  return (
    <div>
      {label && <div className="label">{label}</div>}
      <div className="flex items-center gap-1 rounded-2xl bg-indigo-50 p-1">
        <button className="h-9 w-9 rounded-xl bg-white font-display text-xl text-grape shadow disabled:opacity-40" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </button>
        <span className="min-w-[3ch] flex-1 text-center font-display text-xl tabular-nums">{value}</span>
        <button className="h-9 w-9 rounded-xl bg-white font-display text-xl text-grape shadow disabled:opacity-40" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <button className="rounded-xl px-2 text-xs font-bold text-indigo-400 hover:text-grape" onClick={() => onChange(max)}>
          הכל
        </button>
      </div>
    </div>
  );
}

function AttackForm({ g, tile, owner, byLand, onDone }) {
  const { act } = useRoom();
  const me = g.me;
  const k = g.kingdoms[owner];
  const home = me.people.filter((p) => jobOf(p) === 'knight' && !p[7]).length;
  const [n, setN] = useState(Math.min(home, 10));
  const [goal, setGoal] = useState('land');
  const [bombs, setBombs] = useState(0);
  const [potions, setPotions] = useState(0);
  const ships = byLand ? 0 : Math.ceil(n / 10);

  if (k.ally) return <p className="mt-3 font-semibold text-emerald-700">🤝 בעלי ברית שלכם - אי אפשר לתקוף אותם.</p>;
  if (k.placing) return <p className="mt-3 text-indigo-500">הממלכה הזאת בונה את עצמה מחדש.</p>;
  if (!home) return <p className="mt-3 font-semibold text-rose-600">אין לכם אבירים בבית. העבירו אנשים לאבירים בלשונית 👥 העם.</p>;

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-rose-50 p-3">
      <div className="font-display text-lg">⚔️ התקפה</div>
      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(GOALS).map(([id, [emoji, name, desc]]) => (
          <button
            key={id}
            onClick={() => setGoal(id)}
            className={`rounded-2xl p-2 text-right transition ${goal === id ? 'bg-white shadow ring-2 ring-bubble' : 'bg-white/50'}`}
          >
            <div className="font-display">
              {emoji} {name}
            </div>
            <div className="text-xs text-indigo-500">{desc}</div>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stepper label={`⚔️ אבירים (${home} בבית)`} value={n} min={1} max={home} onChange={setN} />
        {me.stock.bomb > 0 && <Stepper label="💣 פצצות" value={bombs} max={me.stock.bomb} onChange={setBombs} />}
        {me.stock.potion > 0 && <Stepper label="🧪 שיקויים" value={potions} max={me.stock.potion} onChange={setPotions} />}
      </div>
      <p className="text-sm text-indigo-600">
        {byLand ? '🥾 הולכים ברגל - האדמה נוגעת בממלכה שלכם.' : `⛵ היעד מעבר לים: צריך ${ships} ספינות (יש לכם ${me.stock.ship}).`} האבירים
        הכי מנוסים יוצאים ראשונים, ולוקחים את הנשקים והשריונים הכי טובים מהמחסן.
      </p>
      <button className="btn-pink w-full" disabled={ships > me.stock.ship} onClick={() => act('attack', { tile, knights: n, goal, bombs, potions }).then((r) => r.ok && onDone())}>
        ⚔️ יוצאים לקרב!
      </button>
    </div>
  );
}

// ---------- לשונית העם ----------
function Stars({ lvl }) {
  return <span className="text-xs text-amber-500">{'★'.repeat(lvl)}</span>;
}

function avgLevel(list, idx) {
  if (!list.length || idx == null) return null;
  return Math.round(list.reduce((s, p) => s + p[idx], 0) / list.length);
}

function JobRow({ job, emoji, name, desc, cap, rate }) {
  const { act, state } = useRoom();
  const g = state.game;
  const list = g.me.people.filter((p) => jobOf(p) === job);
  const away = list.filter((p) => p[7]).length;
  const idle = g.me.people.filter((p) => jobOf(p) === 'idle' && !p[7]).length;
  const avg = avgLevel(list, skillFor(job));
  const move = (delta) => act('assign', { job, delta });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2">
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-[8rem] flex-1">
        <div className="font-display">
          {name}: {list.length}
          {cap != null && <span className="text-indigo-300"> / {cap}</span>}
          {away > 0 && <span className="text-sm text-indigo-400"> ({away} בדרך)</span>}
          {avg && <span className="mr-2"><Stars lvl={avg} /></span>}
        </div>
        {(desc || rate) && (
          <div className="text-xs text-indigo-400">
            {desc}
            {rate ? `+${rate.toFixed(1)} בשנייה` : ''}
            {cap != null && list.length > cap ? ' · אין מספיק אדמה לכולם!' : ''}
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <button className="rounded-lg bg-indigo-50 px-2 py-1 text-sm font-bold disabled:opacity-30" disabled={list.length - away < 5} onClick={() => move(-5)}>
          −5
        </button>
        <button className="rounded-lg bg-indigo-50 px-2.5 py-1 font-bold disabled:opacity-30" disabled={list.length - away < 1} onClick={() => move(-1)}>
          −
        </button>
        <button className="rounded-lg bg-sun px-2.5 py-1 font-bold disabled:opacity-30" disabled={!idle} onClick={() => move(1)}>
          +
        </button>
        <button className="rounded-lg bg-sun px-2 py-1 text-sm font-bold disabled:opacity-30" disabled={idle < 5} onClick={() => move(5)}>
          +5
        </button>
      </div>
    </div>
  );
}

function PeopleTab({ g }) {
  const me = g.me;
  const idle = me.people.filter((p) => jobOf(p) === 'idle');
  const farmable = RES_KEYS.filter((r) => me.farmCaps[r] > 0 || me.people.some((p) => jobOf(p) === 'farm:' + r));
  const locked = RES_KEYS.filter((r) => !farmable.includes(r));
  return (
    <div className="space-y-3">
      <p className="text-sm text-indigo-500">
        מחליטים מה כל אחד עושה. אנשים משתפרים במה שהם עושים הרבה (עד ★★★★★): חקלאי ותיק מגדל פי 2, ואביר ותיק חזק פי 2.4. כשמעבירים
        אנשים - הכי מתאימים לעבודה עוברים ראשונים. העם גדל לבד כשיש אוכל ומקום בבתים 🏠.
      </p>
      <div className="rounded-2xl bg-indigo-50 px-3 py-2 font-display">
        🧍 פנויים: {idle.length} <span className="text-sm text-indigo-400">(לא עושים כלום - תנו להם עבודה!)</span>
      </div>
      <div className="space-y-1.5">
        {['builder', 'knight', 'explorer'].map((job) => (
          <JobRow key={job} job={job} {...JOBS[job]} />
        ))}
      </div>
      <div className="label mt-4">👨‍🌾 חקלאים (עד 5 לכל אדמה מתאימה)</div>
      <div className="space-y-1.5">
        {farmable.map((r) => (
          <JobRow key={r} job={'farm:' + r} emoji={RES[r][0]} name={RES[r][1]} cap={me.farmCaps[r]} rate={me.rates[r] + (r === 'food' ? me.pop * 0.05 : 0)} />
        ))}
      </div>
      {locked.length > 0 && (
        <p className="text-xs text-indigo-400">
          🔒 עוד אין לכם אדמה בשביל:{' '}
          {locked.map((r) => `${RES[r][0]} ${RES[r][1]} (${[...GROWS_ON[r]].map((t) => TERRAIN[t].emoji).join('')})`).join(' · ')}
        </p>
      )}
      <Roster g={g} />
    </div>
  );
}

function Roster({ g }) {
  const { act } = useRoom();
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const jobs = [
    ['idle', '🧍 פנוי'],
    ['builder', '👷 בנאי'],
    ['knight', '⚔️ אביר'],
    ['explorer', '🧭 מגלה ארצות'],
    ...RES_KEYS.filter((r) => g.me.farmCaps[r] > 0).map((r) => ['farm:' + r, `👨‍🌾 ${RES[r][0]} ${RES[r][1]}`]),
  ];
  const best = (p) => Math.max(p[3], p[4], p[5], p[6]);
  const people = [...g.me.people].sort((a, b) => best(b) - best(a) || b[3] + b[4] + b[5] + b[6] - (a[3] + a[4] + a[5] + a[6]));
  const shown = all ? people : people.slice(0, 15);
  return (
    <div className="rounded-2xl border-2 border-indigo-100 p-3">
      <button className="w-full text-right font-display text-lg" onClick={() => setOpen((o) => !o)}>
        {open ? '▲' : '▼'} ⭐ כל האנשים ({people.length}) - ותיקים ראשונים
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {shown.map((p) => (
            <div key={p[0]} className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50/60 px-2 py-1 text-sm">
              <span className="w-16 truncate font-bold">{p[1]}</span>
              <span className="flex flex-1 flex-wrap gap-2">
                {SKILLS.map(([idx, emoji]) => (
                  <span key={idx} className={p[idx] > 1 ? '' : 'opacity-30'}>
                    {emoji}
                    {p[idx]}
                  </span>
                ))}
              </span>
              {p[7] ? (
                <span className="text-xs text-indigo-400">🚶 בדרך…</span>
              ) : (
                <select className="rounded-lg border border-indigo-100 bg-white px-1 py-0.5" value={jobOf(p)} onChange={(e) => act('setJob', { person: p[0], job: e.target.value })}>
                  {jobs.map(([j, label]) => (
                    <option key={j} value={j}>
                      {label}
                    </option>
                  ))}
                  {!jobs.some(([j]) => j === jobOf(p)) && <option value={jobOf(p)}>{jobOf(p)}</option>}
                </select>
              )}
            </div>
          ))}
          {people.length > 15 && (
            <button className="text-sm font-bold text-indigo-500" onClick={() => setAll((a) => !a)}>
              {all ? 'להציג פחות' : `להציג את כל ${people.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- לשונית בנייה ----------
function Cost({ cost, res, times = 1 }) {
  return (
    <span className="flex flex-wrap gap-1">
      {Object.entries(cost).map(([r, v]) => (
        <span key={r} className={`chip px-2 py-0.5 text-xs ${res[r] >= v * times ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-600'}`}>
          {RES[r][0]} {v * times}
        </span>
      ))}
    </span>
  );
}

function BuildTab({ g }) {
  const { act } = useRoom();
  const me = g.me;
  const builders = me.people.filter((p) => jobOf(p) === 'builder').length;
  const owned = (id) => (ITEMS[id].building ? me.built[id] : me.stock[id]);
  const can = (id, n) => Object.entries(ITEMS[id].cost).every(([r, v]) => me.res[r] >= v * n);
  return (
    <div className="space-y-3">
      {!builders && <div className="rounded-2xl bg-amber-100 px-3 py-2 font-semibold text-amber-900">👷 אין לכם בנאים! בלי בנאים שום דבר לא נבנה - הוסיפו בלשונית 👥 העם.</div>}
      {me.queue.length > 0 && (
        <div className="rounded-2xl bg-indigo-50 p-3">
          <div className="label">🔨 בבנייה עכשיו ({builders} בנאים)</div>
          <div className="space-y-1.5">
            {me.queue.map((q, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5">
                <span className="text-xl">{ITEMS[q.item].emoji}</span>
                <span className="font-semibold">
                  {ITEMS[q.item].name} ×{q.left}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-indigo-100">
                  {i === 0 && <div className="h-full rounded-full bg-mint transition-[width] duration-1000 ease-linear" style={{ width: `${q.progress * 100}%` }} />}
                </div>
                <button title="ביטול (החומרים חוזרים)" className="text-slate-300 hover:text-bubble" onClick={() => act('cancel', { index: i })}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ITEMS).map(([id, it]) => (
          <div key={id} className="flex flex-col gap-1.5 rounded-2xl bg-white p-3 ring-1 ring-indigo-100">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{it.emoji}</span>
              <span className="flex-1 font-display text-lg">{it.name}</span>
              <span className="chip">יש: {owned(id)}{id === 'house' && ` / ${me.houseMax}`}</span>
            </div>
            <div className="text-xs text-indigo-500">{it.desc}</div>
            <div className="flex items-center justify-between gap-2">
              <Cost cost={it.cost} res={me.res} />
              <div className="flex gap-1">
                <button className="rounded-lg bg-sun px-3 py-1 font-bold disabled:opacity-30" disabled={!can(id, 1)} onClick={() => act('build', { item: id, count: 1 })}>
                  בנו
                </button>
                {!['tower', 'training', 'market', 'castle'].includes(id) && (
                  <button className="rounded-lg bg-sun px-2 py-1 text-sm font-bold disabled:opacity-30" disabled={!can(id, 5)} onClick={() => act('build', { item: id, count: 5 })}>
                    ×5
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- לשונית צבא ----------
function ArmyTab({ g }) {
  const me = g.me;
  const knights = me.people.filter((p) => jobOf(p) === 'knight');
  const home = knights.filter((p) => !p[7]);
  const mine = g.armies.filter((a) => a.mine);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="chip bg-white ring-1 ring-indigo-100">
          ⚔️ {home.length} אבירים בבית {home.length > 0 && <Stars lvl={avgLevel(home, 5)} />}
        </span>
        {['staff', 'sword', 'club', 'armor', 'bomb', 'potion', 'ship'].map((w) => (
          <span key={w} className={`chip bg-white ring-1 ring-indigo-100 ${me.stock[w] ? '' : 'opacity-40'}`}>
            {ITEMS[w].emoji} {me.stock[w]}
          </span>
        ))}
        <span className="chip bg-white ring-1 ring-indigo-100">🗼 {me.built.tower} מגדלים</span>
      </div>
      <p className="text-sm text-indigo-500">
        👆 כדי לתקוף - לחצו על אדמה של ממלכה אחרת במפה. אפשר לשלוח כמה צבאות בבת אחת לממלכות שונות. אבירים שנשארים בבית שומרים
        עליה (וגם שאר העם עוזר קצת). כל קרב - והאבירים שורדים משתפרים.
      </p>
      {mine.length === 0 ? (
        <p className="text-center text-indigo-400">אין צבאות בדרך כרגע</p>
      ) : (
        <div className="space-y-1.5">
          {mine.map((a) => {
            const target = g.owner[a.to];
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-indigo-100">
                <span className="text-xl">{a.back ? '🏠' : a.ship ? '⛵' : '⚔️'}</span>
                <span className="font-semibold">{a.n} אבירים</span>
                {a.back ? (
                  <span>חוזרים הביתה</span>
                ) : (
                  <>
                    <span>
                      {GOALS[a.goal][0]} {GOALS[a.goal][1]} אצל
                    </span>
                    {target >= 0 && <PlayerTag id={g.kingdoms[target].id} />}
                  </>
                )}
                <span className="mr-auto font-display tabular-nums text-indigo-400">{a.eta} שנ׳</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- לשונית מסעות ----------
function ExploreTab({ g }) {
  const { act } = useRoom();
  const me = g.me;
  const home = me.people.filter((p) => jobOf(p) === 'explorer' && !p[7]).length;
  const [n, setN] = useState(Math.min(3, home));
  const [goal, setGoal] = useState('land');
  const [terrain, setTerrain] = useState('v');
  const [res, setRes] = useState('metal');
  const [ship, setShip] = useState(false);
  const count = Math.min(n, home);
  const tokens = Object.entries(me.landTokens).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      {tokens.length > 0 && (
        <div className="rounded-2xl bg-emerald-100 px-3 py-2 font-semibold text-emerald-900">
          🗺️ יש לכם אדמות להניח: {tokens.map(([t, v]) => `${TERRAIN[t].emoji}×${v}`).join(' ')} - לחצו על המים המהבהבים במפה ליד הממלכה
        </div>
      )}
      <p className="text-sm text-indigo-500">
        מגלי ארצות יוצאים אל מחוץ למפה וחוזרים אחרי בערך דקה עם מה שביקשתם. הדרך מסוכנת - חלק עלולים לא לחזור. מגלי ארצות ותיקים, מצפנים
        🧭 וספינה ⛵ שומרים עליהם. כל אחד צריך 2 🍖 לדרך.
      </p>
      {!home ? (
        <p className="font-semibold text-rose-600">אין מגלי ארצות בבית - הוסיפו בלשונית 👥 העם.</p>
      ) : (
        <div className="space-y-3 rounded-2xl bg-sky-50 p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['land', '🗺️ אדמה חדשה'],
              ['res', '📦 משאבים'],
              ['people', '👥 אנשים'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setGoal(id)} className={`rounded-xl py-2 font-display transition ${goal === id ? 'bg-white text-grape shadow ring-2 ring-azure' : 'bg-white/50'}`}>
                {label}
              </button>
            ))}
          </div>
          {goal === 'land' && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TERRAIN).map(([t, T]) => (
                <button key={t} title={T.makes} onClick={() => setTerrain(t)} className={`chip ${terrain === t ? 'bg-white ring-2 ring-azure' : 'bg-white/50'}`}>
                  {T.emoji} {T.name}
                </button>
              ))}
              <div className="w-full text-xs text-indigo-500">
                {TERRAIN[terrain].emoji} {TERRAIN[terrain].name}: {TERRAIN[terrain].makes}
              </div>
            </div>
          )}
          {goal === 'res' && (
            <div className="flex flex-wrap gap-1.5">
              {RES_KEYS.map((r) => (
                <button key={r} onClick={() => setRes(r)} className={`chip ${res === r ? 'bg-white ring-2 ring-azure' : 'bg-white/50'}`}>
                  {RES[r][0]} {RES[r][1]}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Stepper label={`🧭 כמה יוצאים (${home} בבית)`} value={count} min={1} max={home} onChange={setN} />
            <div className="space-y-1 text-sm">
              <div>🧭 מצפנים: {Math.min(me.stock.compass, count)} מתוך {count}</div>
              {me.stock.ship > 0 && (
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={ship} onChange={(e) => setShip(e.target.checked)} /> ⛵ לקחת ספינה ({me.stock.ship})
                </label>
              )}
            </div>
          </div>
          <button className="btn-sky w-full" disabled={me.res.food < count * 2} onClick={() => act('explore', { count, goal, terrain, res, ship })}>
            🧭 יוצאים למסע ({count * 2} 🍖)
          </button>
        </div>
      )}
      {me.trips.length > 0 && (
        <div className="space-y-1.5">
          <div className="label">במסע עכשיו</div>
          {me.trips.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-indigo-100">
              <span className="text-xl animate-wiggle">🧭</span>
              <span className="font-semibold">{t.n} מגלי ארצות</span>
              <span>
                מחפשים {t.goal === 'land' ? `${TERRAIN[t.terrain].emoji} ${TERRAIN[t.terrain].name}` : t.goal === 'res' ? `${RES[t.res][0]} ${RES[t.res][1]}` : '👥 אנשים'}
              </span>
              <span className="mr-auto font-display tabular-nums text-indigo-400">{t.eta > 0 ? `${t.eta} שנ׳` : 'חוזרים…'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- לשונית ממלכות: בריתות וסחר ----------
function ResSelect({ value, onChange, allowNone }) {
  return (
    <select className="rounded-xl border-2 border-indigo-100 bg-white px-2 py-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowNone && <option value="">כלום</option>}
      {RES_KEYS.map((r) => (
        <option key={r} value={r}>
          {RES[r][0]} {RES[r][1]}
        </option>
      ))}
    </select>
  );
}

function NumInput({ value, onChange }) {
  return (
    <input type="number" min={0} className="w-20 rounded-xl border-2 border-indigo-100 bg-white px-2 py-1.5 text-center" value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))} />
  );
}

function OfferText({ o, mine }) {
  const give = o.giveN ? `${o.giveN} ${RES[o.give][0]}` : 'כלום';
  const want = o.wantN ? `${o.wantN} ${RES[o.want][0]}` : 'כלום';
  return mine ? (
    <span>
      אתם נותנים {give} ומבקשים {want}
    </span>
  ) : (
    <span>
      נותנים לכם {give} ומבקשים {want}
    </span>
  );
}

function DiploTab({ g }) {
  const { act, state } = useRoom();
  const me = g.me;
  const others = g.kingdoms.filter((k) => k.id !== state.me);
  const [to, setTo] = useState(others[0]?.id || '');
  const [give, setGive] = useState('wood');
  const [giveN, setGiveN] = useState(10);
  const [want, setWant] = useState('food');
  const [wantN, setWantN] = useState(10);
  const [mGive, setMGive] = useState('food');
  const [mWant, setMWant] = useState('metal');
  const [mN, setMN] = useState(1);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {others.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-indigo-100">
            <span className="h-4 w-4 rounded-full" style={{ background: k.color }} />
            <PlayerTag id={k.id} />
            <span className="text-sm text-indigo-500">
              🏞️ {k.tiles} · 👥 {k.pop} · {k.placing ? '🏳️ מתחילים מחדש' : k.king ? '👑' : '💀'}
            </span>
            <span className="mr-auto">
              {k.ally ? (
                <button className="chip bg-emerald-100 text-emerald-800" onClick={() => confirm('לשבור את הברית?') && act('unally', { to: k.id })}>
                  🤝 בעלי ברית · לשבור
                </button>
              ) : k.reqIn ? (
                <span className="flex gap-1">
                  <button className="chip bg-emerald-200 text-emerald-900" onClick={() => act('ally', { to: k.id })}>
                    ✓ לקבל ברית
                  </button>
                  <button className="chip" onClick={() => act('unally', { to: k.id })}>
                    ✕
                  </button>
                </span>
              ) : k.reqOut ? (
                <button className="chip" onClick={() => act('unally', { to: k.id })}>
                  ⏳ ביקשתם ברית · ביטול
                </button>
              ) : (
                <button className="chip bg-sky-100 text-sky-900" onClick={() => act('ally', { to: k.id })}>
                  🤝 להציע ברית
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {me.offersIn.length > 0 && (
        <div className="space-y-1.5">
          <div className="label">📨 הצעות סחר אליכם</div>
          {me.offersIn.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2">
              <PlayerTag id={o.from} />
              <OfferText o={o} />
              <span className="mr-auto flex gap-1">
                <button className="chip bg-emerald-200 text-emerald-900" onClick={() => act('acceptOffer', { id: o.id })}>
                  ✓ עסקה
                </button>
                <button className="chip" onClick={() => act('declineOffer', { id: o.id })}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-indigo-50 p-3">
        <div className="label">🤝 הצעת סחר (או מתנה - ״מבקשים כלום״)</div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border-2 border-indigo-100 bg-white px-2 py-1.5" value={to} onChange={(e) => setTo(e.target.value)}>
            {others.map((k) => (
              <option key={k.id} value={k.id}>
                {state.players.find((p) => p.id === k.id)?.name || '?'}
              </option>
            ))}
          </select>
          <span>נותנים</span>
          <NumInput value={giveN} onChange={setGiveN} />
          <ResSelect value={give} onChange={setGive} />
          <span>ומבקשים</span>
          <NumInput value={wantN} onChange={setWantN} />
          <ResSelect value={want} onChange={setWant} />
          <button className="btn-primary py-2 text-base" onClick={() => act('offer', { to, give, giveN, want, wantN })}>
            שליחה
          </button>
        </div>
        {me.offersOut.length > 0 && (
          <div className="mt-2 space-y-1">
            {me.offersOut.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                ⏳ ל-<PlayerTag id={o.to} /> <OfferText o={o} mine /> ({o.left} שנ׳)
                <button className="text-slate-400 hover:text-bubble" onClick={() => act('declineOffer', { id: o.id })}>
                  ביטול
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-indigo-50 p-3">
        <div className="label">
          🏪 שוק עולמי - כל {me.rate} יחידות שווים 1 {me.rate === 5 && '(עם שוק 🏪 רק 3)'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>רוצים</span>
          <NumInput value={mN} onChange={setMN} />
          <ResSelect value={mWant} onChange={setMWant} />
          <span>בתמורה ל-{mN * me.rate}</span>
          <ResSelect value={mGive} onChange={setMGive} />
          <button className="btn-primary py-2 text-base" disabled={me.res[mGive] < mN * me.rate || !mN} onClick={() => act('exchange', { give: mGive, want: mWant, amount: mN })}>
            החלפה
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- יומן ----------
function LogTab({ g }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="label">📜 מה קרה אצלכם</div>
        <ul className="space-y-1 text-sm">
          {[...g.me.log].reverse().map((l, i) => (
            <li key={i} className="rounded-xl bg-indigo-50/60 px-2 py-1">
              <span className="text-xs text-indigo-300">{clock(l.t)} </span>
              {l.text}
            </li>
          ))}
          {!g.me.log.length && <li className="text-indigo-400">עוד לא קרה כלום…</li>}
        </ul>
      </div>
      <div>
        <div className="label">🌍 חדשות מכל העולם</div>
        <ul className="space-y-1 text-sm">
          {[...g.news].reverse().map((l, i) => (
            <li key={i} className="rounded-xl bg-amber-50 px-2 py-1">
              <span className="text-xs text-amber-400">{clock(l.t)} </span>
              {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- חוקים ----------
function HowTo({ open: startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="rounded-3xl border-2 border-indigo-100 p-4">
      <button className="w-full text-right font-display text-xl" onClick={() => setOpen((o) => !o)}>
        {open ? '▲' : '▼'} ❓ איך משחקים
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          <p>
            <b>אין תורות!</b> כולם משחקים בו זמנית, מתי שרוצים. מתחילים עם 20 אנשים, מלך 👑 ו-5 אדמות דשא. העם גדל לבד כשיש מספיק 🍖 אוכל
            ומקום בבתים 🏠, ומגלי ארצות יכולים להביא עוד אנשים.
          </p>
          <ul className="space-y-1">
            <li>👨‍🌾 <b>חקלאים</b> - מגדלים את מה שהאדמה נותנת (עד 5 לכל אדמה).</li>
            <li>👷 <b>בנאים</b> - בונים בתים, נשקים, פצצות, ספינות ועוד. צריך לתת להם חומרים.</li>
            <li>⚔️ <b>אבירים</b> - שומרים על הבית ויוצאים לקרבות.</li>
            <li>🧭 <b>מגלי ארצות</b> - יוצאים מחוץ למפה ומביאים אדמה חדשה, משאבים או אנשים. חלק לא חוזרים…</li>
          </ul>
          <p>⭐ כל אחד משתפר במה שהוא עושה הרבה: חקלאי שמגדל הרבה נהיה חקלאי מעולה, ואביר שנלחם הרבה נהיה לוחם מעולה (עד 5 כוכבים).</p>
          <ul className="space-y-1">
            {Object.values(TERRAIN).map((T) => (
              <li key={T.name}>
                {T.emoji} <b>{T.name}</b> - {T.makes}
              </li>
            ))}
          </ul>
          <p>
            ⚔️ <b>קרב:</b> לוחצים על אדמה של ממלכה אחרת, בוחרים כמה אבירים ומטרה: 👑 להפיל את המלך (+5 נקודות), 🏞️ לכבוש אדמה, או 💀 להרוג
            אנשים ולקחת שלל. אם האדמה מעבר לים - צריך ספינות ⛵. ממלכה שאיבדה הכל מתחילה מחדש עם מעט אנשים.
          </p>
          <p>🤝 אפשר לכרות בריתות (בעלי ברית לא יכולים לתקוף זה את זה), לסחור, לתת מתנות, או להחליף בשוק העולמי.</p>
          <p>
            🏆 <b>ניקוד:</b> 5 לכל מלך שהפלתם + 1 לכל אדמה + 1 לכל 10 אנשים. מי שהכי גבוה כשהזמן נגמר - מנצח!
          </p>
        </div>
      )}
    </div>
  );
}
