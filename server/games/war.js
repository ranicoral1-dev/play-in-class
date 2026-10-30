// משחק 10: מלחמה - ממלכות על מפה של מחומשים, בזמן אמת (בלי תורות)
import { shuffle, pick, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { place: 60 };
const TICK_MS = 1000;
const START_TILES = 5;
const START_PEOPLE = 20;
const RESPAWN_TILES = 3;
const RESPAWN_PEOPLE = 8;
const KING_RESPAWN = 45;
const OFFER_TTL = 90;
const PER_TILE = 5; // כמה חקלאים יכולים לעבוד על כל אדמה, לכל משאב
const EAT = 0.05; // כל אדם אוכל 1 אוכל כל 20 שניות
const BOMB_POWER = 3;
const LOG_MAX = 40;

const LAND = 'gsvnc'; // דשא, חול, סוואנה, שלג, מערה. '.' = מים
const RES = ['food', 'wood', 'wool', 'sand', 'glass', 'gold', 'metal', 'emerald', 'magic', 'stone', 'ore'];
const PRODUCES = {
  food: 'gc',
  wood: 'gv',
  wool: 'g',
  sand: 's',
  glass: 's',
  gold: 'v',
  metal: 'v',
  emerald: 'n',
  magic: 'n',
  stone: 'c',
  ore: 'c',
};
// כמה חקלאי ברמה 1 מייצר בשנייה
const RATE = { food: 0.45, wood: 0.4, wool: 0.3, sand: 0.5, glass: 0.2, gold: 0.15, metal: 0.2, emerald: 0.08, magic: 0.1, stone: 0.35, ore: 0.25 };
// כמה מגלה ארצות מביא ממסע
const FIND = { food: 20, wood: 18, wool: 12, sand: 20, glass: 8, gold: 6, metal: 8, emerald: 3, magic: 4, stone: 15, ore: 10 };

const ITEMS = {
  house: { cost: { wood: 15 }, work: 15, building: true },
  tower: { cost: { stone: 10, wood: 5 }, work: 30, building: true, max: 5 },
  training: { cost: { wood: 20, metal: 5 }, work: 40, building: true, max: 1 },
  market: { cost: { wood: 15, gold: 5 }, work: 30, building: true, max: 1 },
  castle: { cost: { stone: 30, gold: 10, glass: 5 }, work: 80, building: true, max: 1 },
  club: { cost: { wood: 4 }, work: 4 },
  sword: { cost: { wood: 2, metal: 4 }, work: 8 },
  staff: { cost: { wood: 2, magic: 3, emerald: 1 }, work: 12 },
  armor: { cost: { metal: 3, wool: 2 }, work: 8 },
  bomb: { cost: { ore: 3, sand: 2 }, work: 6 },
  ship: { cost: { wood: 25, wool: 5 }, work: 40 },
  compass: { cost: { metal: 1, glass: 2 }, work: 5 },
  potion: { cost: { magic: 2, glass: 1 }, work: 6 },
};
const WEAPONS = [
  ['staff', 2.5],
  ['sword', 1.8],
  ['club', 1.3],
];
const GEAR = ['staff', 'sword', 'club', 'armor'];

const SKILL = { builder: 'build', knight: 'fight', explorer: 'explore' };
const LEVELS = [30, 90, 200, 400]; // ניסיון שצריך לרמות 2-5
const START_JOBS = [
  ['farm:food', 6],
  ['farm:wood', 4],
  ['builder', 3],
  ['knight', 4],
  ['explorer', 3],
];

const NAMES = [
  'אבי', 'בני', 'גיל', 'דנה', 'הדר', 'ורד', 'זיו', 'חן', 'טל', 'יעל', 'כרמל', 'ליאור', 'מאיה', 'נועה', 'סהר',
  'עדי', 'פז', 'צליל', 'קרן', 'רון', 'שי', 'תמר', 'אורי', 'בר', 'גלעד', 'דור', 'הילה', 'יונתן', 'לירון', 'מתן',
  'נטע', 'עומר', 'רותם', 'שגיא', 'תום', 'אלון', 'ברק', 'גאיה', 'דפנה', 'יואב', 'לביא', 'מור', 'ניר', 'עמית',
  'רז', 'שחר', 'אסף', 'יובל', 'ענבר', 'איתי', 'נדב', 'רוני', 'אדם', 'שקד', 'אגם', 'ליה', 'אריאל', 'עידו', 'אלה',
];
const DANGERS = ['🐉 דרקון', '🌊 סערה בים', '🐺 להקת זאבים', '🏴‍☠️ שודדים', '🌋 הר געש', '🕳️ בור עמוק', '🥶 קור מקפיא'];

const COLORS = [
  '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#84cc16',
  '#6366f1', '#06b6d4', '#f43f5e', '#22c55e', '#8b5cf6', '#f59e0b', '#0ea5e9', '#d946ef',
  '#10b981', '#e11d48', '#65a30d', '#7c3aed', '#ea580c', '#0891b2', '#be185d', '#4d7c0f',
];

// ---------- המפה: ריצוף קהיר (כל אריח הוא מחומש) ----------
// כל צלע פנימית ברשת ריבועים הופכת למחומש. בכל ריבוע יש קו קצר במרכז - אופקי ובמשבצת הסמוכה אנכי.
// הלקוח מחשב את אותה גאומטריה בדיוק (client/src/games/War.jsx), אז הסדר חייב להישאר זהה.
const SEG = 0.2743; // באורך הזה המחומשים יוצאים כמעט שווי צלעות

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

function cairoTiles(W, H) {
  const tiles = [];
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) tiles.push(pentagon([i, j + 1], [i + 1, j + 1], [[i, j], [i, j + 1]]));
  }
  for (let i = 0; i < W - 1; i++) {
    for (let j = 0; j < H; j++) tiles.push(pentagon([i + 1, j], [i + 1, j + 1], [[i, j], [i + 1, j]]));
  }
  return tiles;
}

function buildMap(players) {
  const side = Math.max(6, Math.ceil(Math.sqrt(players * 14)));
  const polys = cairoTiles(side, side);
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const edges = new Map();
  polys.forEach((poly, t) => {
    for (let e = 0; e < 5; e++) {
      const a = key(poly[e]);
      const b = key(poly[(e + 1) % 5]);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(k, [...(edges.get(k) || []), t]);
    }
  });
  const adj = polys.map(() => []);
  for (const ts of edges.values()) {
    if (ts.length === 2) {
      adj[ts[0]].push(ts[1]);
      adj[ts[1]].push(ts[0]);
    }
  }
  const center = polys.map((poly) => [poly.reduce((s, p) => s + p[0], 0) / 5, poly.reduce((s, p) => s + p[1], 0) / 5]);
  return { W: side, H: side, adj, center, terrain: polys.map(() => '.'), owner: polys.map(() => null) };
}

// ---------- עזרים ----------
function level(xp) {
  return 1 + LEVELS.filter((t) => xp >= t).length;
}
const workMult = (lvl) => 1 + 0.25 * (lvl - 1);
const fightMult = (lvl) => 1 + 0.35 * (lvl - 1);
const skillOf = (job) => (job.startsWith('farm:') ? 'farm' : SKILL[job]);
const validJob = (job) => job === 'idle' || !!SKILL[job] || (job.startsWith('farm:') && RES.includes(job.slice(5)));

function nameOf(room, pid) {
  return room.players.find((p) => p.id === pid)?.name || 'ממלכה נעלמה';
}

function tilesOf(g, pid) {
  const out = [];
  for (let t = 0; t < g.owner.length; t++) if (g.owner[t] === pid) out.push(t);
  return out;
}

// כמה אדמות מכל סוג יש לכל ממלכה
function landCounts(g) {
  const counts = {};
  for (let t = 0; t < g.owner.length; t++) {
    const o = g.owner[t];
    if (!o) continue;
    const c = (counts[o] ||= { total: 0 });
    c.total++;
    c[g.terrain[t]] = (c[g.terrain[t]] || 0) + 1;
  }
  return counts;
}

function farmCap(c, res) {
  if (!c) return 0;
  return [...PRODUCES[res]].reduce((s, t) => s + (c[t] || 0), 0) * PER_TILE;
}

function housing(k, c) {
  return (c?.total || 0) * 4 + k.built.house * 6 + k.built.castle * 10;
}

function maxOf(k, item, c) {
  if (item === 'house') return (c?.total || 0) * 3;
  return ITEMS[item].max ?? Infinity;
}

function connected(g, tiles) {
  if (tiles.length <= 1) return true;
  const set = new Set(tiles);
  const seen = new Set([tiles[0]]);
  const stack = [tiles[0]];
  while (stack.length) {
    for (const n of g.adj[stack.pop()]) {
      if (set.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === tiles.length;
}

const allyKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const isAlly = (g, a, b) => g.allies.has(allyKey(a, b));

function log(g, pid, text) {
  const k = g.k[pid];
  if (!k) return;
  k.log.push({ t: g.time, text });
  if (k.log.length > LOG_MAX) k.log.shift();
}

function news(g, text) {
  g.news.push({ t: g.time, text });
  if (g.news.length > LOG_MAX) g.news.shift();
}

function newPerson(k, xp = {}) {
  const p = { id: ++k.seq, name: pick(NAMES), job: 'idle', away: false, xp: { farm: 0, build: 0, fight: 0, explore: 0, ...xp } };
  k.people.push(p);
  return p;
}

function removePeople(k, list) {
  const dead = new Set(list);
  k.people = k.people.filter((p) => !dead.has(p));
}

function emptyRes() {
  return Object.fromEntries(RES.map((r) => [r, 0]));
}

function hasCost(k, cost, n = 1) {
  return Object.entries(cost).every(([r, v]) => k.res[r] >= v * n);
}

function payCost(k, cost, n = 1) {
  for (const [r, v] of Object.entries(cost)) k.res[r] -= v * n;
}

// ---------- הנחת אדמות ----------
function canPlace(g, pid, t, strict = true) {
  if (g.terrain[t] !== '.' || g.owner[t]) return false;
  if (strict && g.adj[t].some((n) => g.owner[n] && g.owner[n] !== pid)) return false;
  const mine = tilesOf(g, pid);
  return !mine.length || g.adj[t].some((n) => g.owner[n] === pid);
}

function placeTile(g, pid, t) {
  g.owner[t] = pid;
  g.terrain[t] = 'g';
  g.k[pid].placeLeft--;
}

// מי שלא סיים להניח בזמן - משלימים לו באקראי
function autoFill(g, pid) {
  const k = g.k[pid];
  for (let guard = 0; k.placeLeft > 0 && guard < 50; guard++) {
    const all = g.terrain.map((_, t) => t);
    let options = all.filter((t) => canPlace(g, pid, t));
    if (!options.length) options = all.filter((t) => canPlace(g, pid, t, false));
    if (!options.length) break;
    placeTile(g, pid, pick(options));
  }
}

function finishPlacing(g, pid) {
  const k = g.k[pid];
  const mine = tilesOf(g, pid);
  k.placing = false;
  k.ready = true;
  k.placeLeft = 0;
  // הבירה היא האדמה הכי מוגנת - זו שיש לה הכי הרבה שכנים מהממלכה
  const own = (t) => g.adj[t].filter((n) => g.owner[n] === pid).length;
  k.capital = mine.sort((a, b) => own(b) - own(a))[0] ?? null;
}

function pendingPlace(g, api) {
  return g.order.filter((id) => api.isConnected(id) && !g.k[id].ready);
}

function startPlay(room, api) {
  const g = room.game;
  if (g.phase !== 'place') return;
  api.clearTimer();
  for (const pid of g.order) {
    autoFill(g, pid);
    finishPlacing(g, pid);
  }
  g.phase = 'play';
  g.time = 0;
  g.endAt = room.settings.timed ? room.settings.minutes * 60 : null;
  news(g, '⚔️ המלחמה התחילה! בהצלחה לכל הממלכות');
  api.setTick(TICK_MS, () => tick(room, api));
}

// ממלכה שאיבדה את כל האדמות בורחת עם מעט אנשים ומתחילה מחדש
function eliminate(room, g, pid) {
  const k = g.k[pid];
  Object.assign(k, { placing: true, ready: false, placeLeft: RESPAWN_TILES, capital: null, queue: [] });
  const home = shuffle(k.people.filter((p) => !p.away));
  removePeople(k, home.slice(RESPAWN_PEOPLE));
  while (k.people.length < RESPAWN_PEOPLE) newPerson(k);
  for (const r of RES) k.res[r] = Math.floor(k.res[r] / 2);
  for (const b of Object.keys(k.built)) k.built[b] = 0;
  news(g, `🏳️ הממלכה של ${nameOf(room, pid)} נפלה! השורדים מחפשים אדמה חדשה`);
  log(g, pid, `🏳️ איבדתם את כל האדמות. ${k.people.length} אנשים ברחו איתכם - הניחו ${RESPAWN_TILES} אדמות חדשות כדי להתחיל מחדש`);
}

// ---------- כל שנייה ----------
function tick(room, api) {
  const g = room.game;
  g.time++;
  const counts = landCounts(g);

  for (const pid of g.order) {
    const k = g.k[pid];
    if (k.placing) continue;
    const c = counts[pid];
    const home = k.people.filter((p) => !p.away);

    // חקלאים: הכי מנוסים עובדים ראשונים, עד שהאדמה מלאה
    for (const r of RES) {
      const cap = farmCap(c, r);
      const farmers = home.filter((p) => p.job === 'farm:' + r).sort((a, b) => b.xp.farm - a.xp.farm);
      for (const p of farmers.slice(0, cap)) {
        k.res[r] += RATE[r] * workMult(level(p.xp.farm));
        p.xp.farm++;
      }
    }

    // בנאים
    if (k.queue.length) {
      const builders = home.filter((p) => p.job === 'builder');
      let work = 0;
      for (const p of builders) {
        work += workMult(level(p.xp.build));
        p.xp.build++;
      }
      while (work > 0 && k.queue.length) {
        const q = k.queue[0];
        const need = ITEMS[q.item].work - q.progress;
        if (work < need) {
          q.progress += work;
          break;
        }
        work -= need;
        q.progress = 0;
        q.left--;
        if (ITEMS[q.item].building) k.built[q.item]++;
        else k.stock[q.item]++;
        if (q.left <= 0) k.queue.shift();
      }
    }

    // אבירים בבית מתאמנים
    const trainXp = k.built.training ? 0.6 : 0.2;
    for (const p of home) if (p.job === 'knight') p.xp.fight += trainXp;

    // אוכל ורעב
    k.res.food -= k.people.length * EAT;
    if (k.res.food < 0) {
      k.res.food = 0;
      k.hunger++;
      if (k.hunger % 10 === 0 && home.length) {
        const victim = pick(home);
        removePeople(k, [victim]);
        log(g, pid, `😵 ${victim.name} מת מרעב! צריך עוד חקלאי אוכל`);
      }
    } else k.hunger = 0;

    // לידות: יש אוכל ויש מקום בבתים -> העם גדל
    if (g.time % 8 === 0) {
      const room_ = housing(k, c) - k.people.length;
      const births = Math.min(room_, 1 + Math.floor(k.people.length / 25), Math.floor(k.res.food / 5) - 1);
      if (k.res.food >= 10 && births > 0) {
        for (let i = 0; i < births; i++) newPerson(k);
        k.res.food -= births * 5;
        k.born += births;
      }
    }

    if (!k.king && g.time >= k.kingAt) {
      k.king = true;
      log(g, pid, '👑 מלך חדש הוכתר!');
    }
  }

  for (const a of [...g.armies]) {
    if (a.phase === 'go' && g.time >= a.arriveAt) battle(room, a);
    else if (a.phase === 'back' && g.time >= a.returnAt) armyHome(g, a);
  }
  for (const trip of [...g.trips]) if (g.time >= trip.returnAt) tripHome(g, trip);
  for (const o of [...g.offers]) {
    if (g.time >= o.until) {
      g.k[o.from].res[o.give] += o.giveN;
      g.offers = g.offers.filter((x) => x !== o);
    }
  }

  // ניקוד: 5 לכל מלך שהופל, נקודה לכל אדמה, ונקודה לכל 10 אנשים
  const fresh = landCounts(g);
  for (const pid of g.order) {
    const k = g.k[pid];
    const s = k.kingKills * 5 + (fresh[pid]?.total || 0) + Math.floor(k.people.length / 10);
    api.addScore(pid, s - k.score);
    k.score = s;
  }

  if (g.endAt && g.time >= g.endAt) api.endGame();
}

// ---------- קרבות ----------
function armyPower(knights, gear) {
  const left = { ...gear };
  let sum = 0;
  for (const p of [...knights].sort((a, b) => b.xp.fight - a.xp.fight)) {
    let m = 1;
    for (const [w, mul] of WEAPONS) {
      if (left[w] > 0) {
        left[w]--;
        m = mul;
        break;
      }
    }
    sum += fightMult(level(p.xp.fight)) * m;
  }
  return sum;
}

function casualties(list, frac, armor, potions) {
  const n = Math.round(list.length * Math.min(1, frac));
  const armored = new Set(shuffle(list).slice(0, armor));
  const dead = [];
  for (const p of shuffle(list).slice(0, n)) {
    if (armored.has(p) && Math.random() < 0.5) continue;
    if (potions.n > 0) {
      potions.n--;
      continue;
    }
    dead.push(p);
  }
  return dead;
}

// ציוד הולך לאיבוד לפי החלק של האבירים שמתו
function loseGear(gear, used, frac) {
  for (const w of GEAR) gear[w] -= Math.round(Math.min(gear[w] || 0, used) * frac);
}

function takeLoot(def, a, frac) {
  for (const r of RES) {
    const n = Math.floor(def.res[r] * frac);
    def.res[r] -= n;
    a.loot[r] = (a.loot[r] || 0) + n;
  }
}

function sendBack(g, a) {
  if (!a.knights.length) {
    g.armies = g.armies.filter((x) => x !== a);
    return;
  }
  a.phase = 'back';
  a.backAt = g.time;
  a.returnAt = g.time + a.travel;
}

function battle(room, a) {
  const g = room.game;
  const att = g.k[a.owner];
  const defId = g.owner[a.target];
  if (!defId || defId === a.owner || isAlly(g, a.owner, defId) || g.k[defId].placing) {
    log(g, a.owner, '🔙 הצבא הגיע ליעד, אבל אין שם עם מי להילחם - חוזרים הביתה');
    return sendBack(g, a);
  }
  const def = g.k[defId];
  const attName = nameOf(room, a.owner);
  const defName = nameOf(room, defId);
  const defKnights = def.people.filter((p) => !p.away && p.job === 'knight');
  const militia = def.people.filter((p) => !p.away && p.job !== 'knight');

  let defMul = 1 + 0.2 * def.built.tower + (def.built.castle ? 0.5 : 0);
  if (!def.king) defMul *= 0.75;
  if (a.goal === 'king' && def.built.castle) defMul *= 1.5;
  let A = armyPower(a.knights, a.gear) + a.bombs * BOMB_POWER;
  let D = (armyPower(defKnights, def.stock) + militia.length * 0.2) * defMul;
  A *= 0.85 + Math.random() * 0.3;
  D = Math.max(0.5, D * (0.85 + Math.random() * 0.3));
  const win = A > D;
  const ratio = A / D;

  const attPotions = { n: a.potions };
  let attDead = casualties(a.knights, 0.5 / ratio, a.gear.armor, attPotions);
  if (win && attDead.length >= a.knights.length) attDead = attDead.slice(1); // מנצחים - לפחות אחד חוזר לספר
  const defPotions = { n: def.stock.potion };
  const defDead = casualties(defKnights, 0.5 * ratio, def.stock.armor, defPotions);
  def.stock.potion = defPotions.n;

  loseGear(a.gear, a.knights.length, a.knights.length ? attDead.length / a.knights.length : 0);
  loseGear(def.stock, defKnights.length, defKnights.length ? defDead.length / defKnights.length : 0);
  const attSet = new Set(attDead);
  a.knights = a.knights.filter((p) => !attSet.has(p));
  a.potions = attPotions.n;
  a.bombs = 0;
  removePeople(att, attDead);
  removePeople(def, defDead);
  for (const p of a.knights) p.xp.fight += win ? 40 : 20;
  for (const p of defKnights) if (!defDead.includes(p)) p.xp.fight += 25;

  const losses = `(אבדו ${attDead.length} אבירים תוקפים ו-${defDead.length} מגינים)`;
  let result = '';
  let fell = false;
  if (!win) {
    result = `🛡️ ${defName} הדפו את ההתקפה של ${attName}! ${losses}`;
    log(g, a.owner, `💥 ההתקפה על ${defName} נכשלה. ${losses}`);
    log(g, defId, `🛡️ הדפתם התקפה של ${attName}! ${losses}`);
  } else if (a.goal === 'king') {
    takeLoot(def, a, 0.25);
    if (def.king) {
      def.king = false;
      def.kingAt = g.time + KING_RESPAWN;
      att.kingKills++;
      result = `👑💀 ${attName} הפילו את המלך של ${defName}! (+5)`;
      log(g, a.owner, `👑💀 הפלתם את המלך של ${defName}! +5 נקודות, ולקחתם שלל. ${losses}`);
      log(g, defId, `👑💀 ${attName} הפילו את המלך שלכם! מלך חדש יוכתר בעוד ${KING_RESPAWN} שניות. ${losses}`);
    } else {
      result = `⚔️ ${attName} פשטו על ${defName} (המלך כבר היה מת) ולקחו שלל`;
      log(g, a.owner, `⚔️ המלך של ${defName} כבר מת - לקחתם שלל במקום. ${losses}`);
      log(g, defId, `⚔️ ${attName} פשטו עליכם ולקחו שלל. ${losses}`);
    }
  } else if (a.goal === 'land') {
    const taken = [a.target];
    const extra = Math.min(3, Math.floor(ratio - 1));
    for (let i = 0; i < extra; i++) {
      const cand = [...new Set(taken.flatMap((t) => g.adj[t]))].filter((t) => g.owner[t] === defId && !taken.includes(t));
      if (!cand.length) break;
      taken.push(pick(cand));
    }
    for (const t of taken) g.owner[t] = a.owner;
    const lands = taken.length === 1 ? 'אדמה אחת' : `${taken.length} אדמות`;
    result = `🏞️ ${attName} כבשו ${lands} מ${defName}!`;
    log(g, a.owner, `🏞️ כבשתם ${lands} מ${defName}! ${losses}`);
    log(g, defId, `🏞️ ${attName} כבשו לכם ${lands}! ${losses}`);
    const left = tilesOf(g, defId);
    if (!left.length) fell = true;
    else if (taken.includes(def.capital)) {
      def.capital = pick(left);
      log(g, defId, '🏰 הבירה נפלה! עברתם לבירה חדשה');
    }
  } else {
    const home = def.people.filter((p) => !p.away);
    const n = Math.min(Math.floor(home.length / 2), Math.ceil((A - D) / 2) + 2);
    removePeople(def, shuffle(home).slice(0, n));
    takeLoot(def, a, 0.35);
    result = `💀 ${attName} פשטו על ${defName} - ${n} אנשים נהרגו`;
    log(g, a.owner, `💀 פשטתם על ${defName}: ${n} אנשים שלהם נהרגו ולקחתם שלל. ${losses}`);
    log(g, defId, `💀 ${attName} פשטו עליכם: ${n} אנשים נהרגו ונגנב שלל. ${losses}`);
  }
  news(g, result);
  if (fell) eliminate(room, g, defId);
  sendBack(g, a);
}

function armyHome(g, a) {
  const k = g.k[a.owner];
  for (const p of a.knights) p.away = false;
  for (const w of GEAR) k.stock[w] += a.gear[w] || 0;
  k.stock.potion += a.potions;
  k.stock.ship += a.ships;
  let loot = 0;
  for (const [r, n] of Object.entries(a.loot)) {
    k.res[r] += n;
    loot += n;
  }
  log(g, a.owner, `🏠 ${a.knights.length} אבירים חזרו הביתה${loot ? ` עם ${loot} יחידות שלל` : ''}`);
  g.armies = g.armies.filter((x) => x !== a);
}

// ---------- מסעות ----------
function tripHome(g, trip) {
  const k = g.k[trip.owner];
  const survivors = [];
  const lost = [];
  trip.people.forEach((p, i) => {
    const risk = 0.3 - 0.04 * (level(p.xp.explore) - 1) - (i < trip.compasses ? 0.1 : 0) - (trip.ship ? 0.1 : 0);
    if (Math.random() < Math.max(0.05, risk)) lost.push(p);
    else survivors.push(p);
  });
  removePeople(k, lost);
  const compassBack = trip.people.slice(0, trip.compasses).filter((p) => !lost.includes(p)).length;
  k.stock.compass += compassBack;
  if (trip.ship && survivors.length) k.stock.ship++;
  for (const p of survivors) {
    p.away = false;
    p.xp.explore += 30;
  }
  g.trips = g.trips.filter((x) => x !== trip);

  let text = lost.length ? `🧭 ${pick(DANGERS)}! ${lost.length} מגלי ארצות לא חזרו. ` : '🧭 ';
  if (!survivors.length) return log(g, trip.owner, text + 'אף אחד לא שרד את המסע 😢');
  text += `${survivors.length} חזרו`;
  if (trip.goal === 'land') {
    let found = 0;
    for (const p of survivors) if (Math.random() < 0.35 + 0.05 * (level(p.xp.explore) - 1)) found++;
    k.landTokens[trip.terrain] += found;
    text += found ? ` ומצאו ${found} אדמות חדשות! לחצו על מים ליד הממלכה כדי להניח אותן` : ', אבל לא מצאו אדמה';
  } else if (trip.goal === 'res') {
    let n = 0;
    for (const p of survivors) n += Math.round(FIND[trip.res] * workMult(level(p.xp.explore)) * (0.7 + Math.random() * 0.6));
    k.res[trip.res] += n;
    text += ` עם ${n} יחידות`;
  } else {
    let n = 0;
    for (const p of survivors) {
      if (Math.random() < 0.4) {
        const extra = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < extra; i++) {
          const rnd = () => Math.floor(Math.random() * 60);
          newPerson(k, { farm: rnd(), build: rnd(), fight: rnd(), explore: rnd() });
        }
        n += extra;
      }
    }
    text += n ? ` עם ${n} אנשים חדשים שרוצים להצטרף!` : ', אבל לא מצאו אף אחד';
  }
  if (Math.random() < 0.12) {
    const gold = 5 + Math.floor(Math.random() * 11);
    k.res.gold += gold;
    text += ` 🎁 ובדרך מצאו אוצר: ${gold} זהב!`;
  }
  log(g, trip.owner, text);
}

// ---------- המשחק ----------
export default {
  id: 'war',
  minPlayers: 2,

  sanitize(s) {
    return {
      minutes: clampInt(s.minutes, 5, 120, 20),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    const order = shuffle(g.participants);
    Object.assign(g, buildMap(order.length), {
      phase: 'place',
      order,
      time: 0,
      endAt: null,
      armies: [],
      trips: [],
      offers: [],
      allies: new Set(),
      allyReq: new Set(),
      news: [],
      seq: 0,
      k: {},
    });
    order.forEach((pid, i) => {
      const k = {
        color: COLORS[i % COLORS.length],
        placing: true,
        ready: false,
        placeLeft: START_TILES,
        capital: null,
        people: [],
        seq: 0,
        res: { ...emptyRes(), food: 40, wood: 30 },
        built: { house: 0, tower: 0, training: 0, market: 0, castle: 0 },
        stock: { club: 0, sword: 0, staff: 0, armor: 0, bomb: 0, ship: 0, compass: 0, potion: 0 },
        queue: [],
        king: true,
        kingAt: 0,
        kingKills: 0,
        landTokens: Object.fromEntries([...LAND].map((t) => [t, 0])),
        log: [],
        hunger: 0,
        born: 0,
        score: 0,
      };
      for (const [job, n] of START_JOBS) for (let j = 0; j < n; j++) newPerson(k).job = job;
      g.k[pid] = k;
    });
    api.setTimer(api.time('place'), () => startPlay(room, api));
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    const k = g.k[pid];
    if (!k) return 'אתם לא בתוך המשחק הזה';
    const tile = clampInt(data?.tile, 0, g.owner.length - 1, -1);

    // ---- הנחת אדמות (בהתחלה, או אחרי שממלכה נפלה) ----
    if (type === 'place') {
      if (!k.placing || tile < 0) return;
      if (g.owner[tile] === pid) {
        if (k.ready) return;
        g.owner[tile] = null;
        g.terrain[tile] = '.';
        k.placeLeft++;
        return;
      }
      if (k.ready) return 'כבר סיימתם - לחצו ״רגע, עוד לא״ כדי לשנות';
      if (k.placeLeft <= 0) return 'כבר הנחתם את כל האדמות. לחיצה על אדמה שלכם מורידה אותה';
      const strictExists = g.terrain.some((_, t) => canPlace(g, pid, t));
      if (!canPlace(g, pid, tile, strictExists)) {
        return tilesOf(g, pid).length ? 'האדמה חייבת לגעת באדמה שלכם (ולא בממלכה אחרת)' : 'אי אפשר כאן - קרוב מדי לממלכה אחרת';
      }
      placeTile(g, pid, tile);
      return;
    }
    if (type === 'ready') {
      if (!k.placing || k.ready) return;
      if (k.placeLeft > 0) return `נשארו עוד ${k.placeLeft} אדמות להניח`;
      if (!connected(g, tilesOf(g, pid))) return 'כל האדמות צריכות לגעת זו בזו';
      if (g.phase === 'place') {
        k.ready = true;
        if (pendingPlace(g, api).length === 0) startPlay(room, api);
      } else {
        finishPlacing(g, pid);
        log(g, pid, '🌱 הממלכה קמה מחדש!');
        news(g, `🌱 הממלכה של ${nameOf(room, pid)} קמה מחדש`);
      }
      return;
    }
    if (type === 'unready') {
      if (g.phase === 'place') k.ready = false;
      return;
    }

    if (g.phase !== 'play') return 'מחכים שכולם יניחו אדמות';
    const counts = landCounts(g);
    const c = counts[pid];

    // ---- עבודות ----
    if (type === 'assign') {
      const job = String(data?.job || '');
      const delta = clampInt(data?.delta, -100, 100, 0);
      if (!validJob(job) || job === 'idle') return 'עבודה לא קיימת';
      const skill = skillOf(job);
      if (delta > 0) {
        if (job.startsWith('farm:') && !farmCap(c, job.slice(5))) return 'אין לכם אדמה שמגדלת את זה';
        const pool = k.people.filter((p) => !p.away && p.job === 'idle').sort((a, b) => b.xp[skill] - a.xp[skill]);
        if (!pool.length) return 'אין אנשים פנויים - הורידו מישהו מעבודה אחרת קודם';
        pool.slice(0, delta).forEach((p) => (p.job = job));
      } else if (delta < 0) {
        const pool = k.people.filter((p) => !p.away && p.job === job).sort((a, b) => a.xp[skill] - b.xp[skill]);
        pool.slice(0, -delta).forEach((p) => (p.job = 'idle'));
      }
      return;
    }
    if (type === 'setJob') {
      const p = k.people.find((x) => x.id === data?.person);
      const job = String(data?.job || '');
      if (!p || !validJob(job)) return;
      if (p.away) return `${p.name} לא בבית כרגע`;
      if (job.startsWith('farm:') && !farmCap(c, job.slice(5))) return 'אין לכם אדמה שמגדלת את זה';
      p.job = job;
      return;
    }

    // ---- בנייה ----
    if (type === 'build') {
      const item = String(data?.item || '');
      const def = ITEMS[item];
      const n = clampInt(data?.count, 1, 20, 1);
      if (!def) return 'אין דבר כזה';
      if (k.placing) return 'קודם צריך אדמה';
      if (k.queue.length >= 12) return 'תור הבנייה מלא';
      const queued = k.queue.filter((q) => q.item === item).reduce((s, q) => s + q.left, 0);
      const have = (def.building ? k.built[item] : 0) + queued;
      if (have + n > maxOf(k, item, c)) return item === 'house' ? 'אין מקום - עד 3 בתים לכל אדמה' : 'הגעתם למקסימום';
      if (!hasCost(k, def.cost, n)) return 'אין מספיק חומרים';
      payCost(k, def.cost, n);
      const last = k.queue[k.queue.length - 1];
      if (last && last.item === item) last.left += n;
      else k.queue.push({ item, left: n, progress: 0 });
      return;
    }
    if (type === 'cancel') {
      const i = clampInt(data?.index, 0, 99, -1);
      const q = k.queue[i];
      if (!q) return;
      for (const [r, v] of Object.entries(ITEMS[q.item].cost)) k.res[r] += v * q.left;
      k.queue.splice(i, 1);
      return;
    }

    // ---- אדמה שמגלי הארצות מצאו ----
    if (type === 'placeLand') {
      const t = String(data?.terrain || '');
      if (!LAND.includes(t) || !(k.landTokens[t] > 0)) return 'אין לכם אדמה כזאת להניח';
      if (tile < 0 || g.terrain[tile] !== '.' || g.owner[tile]) return 'אפשר להניח רק על מים';
      if (!g.adj[tile].some((n) => g.owner[n] === pid)) return 'האדמה צריכה לגעת בממלכה שלכם';
      g.terrain[tile] = t;
      g.owner[tile] = pid;
      k.landTokens[t]--;
      return;
    }

    // ---- התקפה ----
    if (type === 'attack') {
      if (k.placing) return 'קודם צריך אדמה';
      const target = g.owner[tile];
      if (tile < 0 || !target) return 'בחרו אדמה של ממלכה אחרת';
      if (target === pid) return 'זאת האדמה שלכם 🙂';
      if (isAlly(g, pid, target)) return 'אי אפשר לתקוף בעלי ברית';
      if (g.k[target].placing) return 'הממלכה הזאת עוד בונה את עצמה מחדש';
      const goal = ['king', 'land', 'people'].includes(data?.goal) ? data.goal : 'land';
      const pool = k.people.filter((p) => !p.away && p.job === 'knight').sort((a, b) => b.xp.fight - a.xp.fight);
      const n = clampInt(data?.knights, 1, pool.length || 1, 1);
      if (!pool.length) return 'אין אבירים בבית';
      const mine = tilesOf(g, pid);
      const byLand = g.adj[tile].some((t) => g.owner[t] === pid);
      const ships = byLand ? 0 : Math.ceil(n / 10);
      if (ships > k.stock.ship) return `היעד מעבר לים - צריך ${ships} ספינות (כל ספינה לוקחת 10 אבירים)`;
      const dist = (t) => Math.hypot(g.center[t][0] - g.center[tile][0], g.center[t][1] - g.center[tile][1]);
      const from = mine.sort((a, b) => dist(a) - dist(b))[0];
      const knights = pool.slice(0, n);
      const gear = {};
      let armed = 0;
      for (const [w] of WEAPONS) {
        gear[w] = Math.min(k.stock[w], n - armed);
        armed += gear[w];
        k.stock[w] -= gear[w];
      }
      gear.armor = Math.min(k.stock.armor, n);
      k.stock.armor -= gear.armor;
      const bombs = clampInt(data?.bombs, 0, k.stock.bomb, 0);
      const potions = clampInt(data?.potions, 0, k.stock.potion, 0);
      k.stock.bomb -= bombs;
      k.stock.potion -= potions;
      k.stock.ship -= ships;
      for (const p of knights) p.away = true;
      const travel = Math.round(5 + dist(from) * 1.5);
      g.armies.push({
        id: ++g.seq,
        owner: pid,
        from,
        target: tile,
        goal,
        knights,
        gear,
        bombs,
        potions,
        ships,
        loot: {},
        travel,
        phase: 'go',
        departAt: g.time,
        arriveAt: g.time + travel,
      });
      log(g, pid, `⚔️ ${n} אבירים יצאו לקרב נגד ${nameOf(room, target)} (מגיעים בעוד ${travel} שניות)`);
      log(g, target, `🚨 צבא של ${nameOf(room, pid)} בדרך אליכם!`);
      return;
    }

    // ---- מסע של מגלי ארצות ----
    if (type === 'explore') {
      if (k.placing) return 'קודם צריך אדמה';
      const pool = k.people.filter((p) => !p.away && p.job === 'explorer').sort((a, b) => b.xp.explore - a.xp.explore);
      if (!pool.length) return 'אין מגלי ארצות בבית';
      const n = clampInt(data?.count, 1, pool.length, 1);
      const goal = ['land', 'res', 'people'].includes(data?.goal) ? data.goal : 'res';
      const res = RES.includes(data?.res) ? data.res : 'wood';
      const terrain = LAND.includes(data?.terrain) ? data.terrain : 'v';
      if (k.res.food < n * 2) return `צריך ${n * 2} אוכל לדרך`;
      const ship = !!data?.ship && k.stock.ship > 0;
      k.res.food -= n * 2;
      if (ship) k.stock.ship--;
      const compasses = Math.min(k.stock.compass, n);
      k.stock.compass -= compasses;
      const people = pool.slice(0, n);
      for (const p of people) p.away = true;
      const base = goal === 'land' ? 50 : goal === 'people' ? 40 : 35;
      const duration = base + Math.floor(Math.random() * 16);
      g.trips.push({ id: ++g.seq, owner: pid, people, goal, res, terrain, ship, compasses, departAt: g.time, returnAt: g.time + duration });
      log(g, pid, `🧭 ${n} מגלי ארצות יצאו למסע אל מחוץ למפה`);
      return;
    }

    // ---- שוק עולמי ----
    if (type === 'exchange') {
      const give = data?.give;
      const want = data?.want;
      const n = clampInt(data?.amount, 1, 1000, 1);
      if (!RES.includes(give) || !RES.includes(want) || give === want) return 'בחרו שני משאבים שונים';
      const rate = k.built.market ? 3 : 5;
      if (k.res[give] < n * rate) return `צריך ${n * rate} כדי לקבל ${n}`;
      k.res[give] -= n * rate;
      k.res[want] += n;
      return;
    }

    // ---- סחר בין ממלכות ----
    if (type === 'offer') {
      const to = data?.to;
      if (!g.k[to] || to === pid) return 'בחרו ממלכה';
      const give = RES.includes(data?.give) ? data.give : null;
      const want = RES.includes(data?.want) ? data.want : null;
      const giveN = give ? clampInt(data?.giveN, 0, 100000, 0) : 0;
      const wantN = want ? clampInt(data?.wantN, 0, 100000, 0) : 0;
      if (!giveN && !wantN) return 'ההצעה ריקה';
      if (giveN && k.res[give] < giveN) return 'אין לכם מספיק';
      if (g.offers.filter((o) => o.from === pid).length >= 5) return 'יש לכם כבר 5 הצעות פתוחות';
      if (giveN) k.res[give] -= giveN;
      g.offers.push({ id: ++g.seq, from: pid, to, give: give || 'food', giveN, want: want || 'food', wantN, until: g.time + OFFER_TTL });
      log(g, to, `🤝 ${nameOf(room, pid)} שלחו לכם הצעת סחר`);
      return;
    }
    if (type === 'acceptOffer' || type === 'declineOffer') {
      const o = g.offers.find((x) => x.id === data?.id);
      if (!o || (o.to !== pid && !(type === 'declineOffer' && o.from === pid))) return 'ההצעה כבר לא קיימת';
      const from = g.k[o.from];
      if (type === 'acceptOffer') {
        if (k.res[o.want] < o.wantN) return 'אין לכם מספיק בשביל העסקה';
        k.res[o.want] -= o.wantN;
        from.res[o.want] += o.wantN;
        k.res[o.give] += o.giveN;
        log(g, o.from, `🤝 ${nameOf(room, pid)} קיבלו את הצעת הסחר שלכם`);
      } else {
        from.res[o.give] += o.giveN;
        if (o.to === pid) log(g, o.from, `🙅 ${nameOf(room, pid)} סירבו להצעת הסחר`);
      }
      g.offers = g.offers.filter((x) => x !== o);
      return;
    }

    // ---- בריתות ----
    if (type === 'ally') {
      const to = data?.to;
      if (!g.k[to] || to === pid || isAlly(g, pid, to)) return;
      if (g.allyReq.has(`${to}>${pid}`)) {
        g.allyReq.delete(`${to}>${pid}`);
        g.allies.add(allyKey(pid, to));
        news(g, `🤝 ${nameOf(room, pid)} ו${nameOf(room, to)} כרתו ברית!`);
      } else {
        g.allyReq.add(`${pid}>${to}`);
        log(g, to, `🤝 ${nameOf(room, pid)} מציעים לכם ברית`);
      }
      return;
    }
    if (type === 'unally') {
      const to = data?.to;
      g.allyReq.delete(`${pid}>${to}`);
      g.allyReq.delete(`${to}>${pid}`);
      if (g.allies.delete(allyKey(pid, to))) news(g, `💔 ${nameOf(room, pid)} שברו את הברית עם ${nameOf(room, to)}`);
      return;
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'place' && pendingPlace(g, api).length === 0) startPlay(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const counts = landCounts(g);
    const k = g.k[pid];
    const idx = Object.fromEntries(g.order.map((id, i) => [id, i]));
    const v = {
      phase: g.phase,
      W: g.W,
      H: g.H,
      terrain: g.terrain.join(''),
      owner: g.owner.map((o) => (o ? idx[o] : -1)),
      time: g.time,
      timeLeft: g.endAt ? Math.max(0, g.endAt - g.time) : null,
      kingdoms: g.order.map((id) => {
        const x = g.k[id];
        return {
          id,
          color: x.color,
          tiles: counts[id]?.total || 0,
          pop: x.people.length,
          king: x.king,
          placing: x.placing,
          ready: x.ready,
          capital: x.capital,
          ally: isAlly(g, pid, id),
          reqOut: g.allyReq.has(`${pid}>${id}`),
          reqIn: g.allyReq.has(`${id}>${pid}`),
        };
      }),
      armies: g.armies.map((a) => {
        const mine = a.owner === pid;
        const vs = g.owner[a.target] === pid && a.phase === 'go';
        const p = a.phase === 'go' ? (g.time - a.departAt) / a.travel : 1 - (g.time - a.backAt) / a.travel;
        return {
          id: a.id,
          o: idx[a.owner],
          from: a.from,
          to: a.target,
          p: Math.max(0, Math.min(1, p)),
          back: a.phase === 'back',
          ship: a.ships > 0,
          mine,
          vs,
          ...(mine || vs ? { n: a.knights.length, goal: a.goal, eta: (a.phase === 'go' ? a.arriveAt : a.returnAt) - g.time } : {}),
        };
      }),
      news: g.news.slice(-15),
      me: null,
    };
    if (!k) return v;

    const c = counts[pid];
    const home = k.people.filter((p) => !p.away);
    const rates = emptyRes();
    const farmCaps = {};
    for (const r of RES) {
      farmCaps[r] = farmCap(c, r);
      const farmers = home.filter((p) => p.job === 'farm:' + r).sort((a, b) => b.xp.farm - a.xp.farm);
      for (const p of farmers.slice(0, farmCaps[r])) rates[r] += RATE[r] * workMult(level(p.xp.farm));
    }
    rates.food -= k.people.length * EAT;

    v.me = {
      placing: k.placing,
      placeLeft: k.placeLeft,
      ready: k.ready,
      res: Object.fromEntries(RES.map((r) => [r, Math.floor(k.res[r])])),
      rates,
      farmCaps,
      pop: k.people.length,
      cap: housing(k, c),
      houseMax: maxOf(k, 'house', c),
      hungry: k.hunger > 0,
      people: k.people.map((p) => [
        p.id,
        p.name,
        p.job,
        level(p.xp.farm),
        level(p.xp.build),
        level(p.xp.fight),
        level(p.xp.explore),
        p.away ? 1 : 0,
      ]),
      built: k.built,
      stock: k.stock,
      queue: k.queue.map((q) => ({ item: q.item, left: q.left, progress: q.progress / ITEMS[q.item].work })),
      landTokens: k.landTokens,
      king: k.king,
      kingIn: k.king ? null : Math.max(0, k.kingAt - g.time),
      kingKills: k.kingKills,
      score: k.score,
      rate: k.built.market ? 3 : 5,
      log: k.log.slice(-25),
      trips: g.trips
        .filter((t) => t.owner === pid)
        .map((t) => ({ id: t.id, n: t.people.length, goal: t.goal, res: t.res, terrain: t.terrain, eta: t.returnAt - g.time })),
      offersIn: g.offers.filter((o) => o.to === pid).map(({ id, from, give, giveN, want, wantN, until }) => ({ id, from, give, giveN, want, wantN, left: until - g.time })),
      offersOut: g.offers.filter((o) => o.from === pid).map(({ id, to, give, giveN, want, wantN, until }) => ({ id, to, give, giveN, want, wantN, left: until - g.time })),
    };
    return v;
  },
};
