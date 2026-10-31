// משחק: צבע ומחבואים (Paint & Seek) - המחפש בוחר או מצייר תמונה, המתחבאים זזים עליה וצובעים את עצמם
// כדי להיטמע ברקע, ואז המחפש צריך למצוא את כולם
import crypto from 'crypto';
import { shuffle, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { choose: 60, hide: 90, seek: 60 };
const RESULTS_SEC = 15;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MISS_COOLDOWN_MS = 1200; // אחרי פספוס - רגע המתנה, כדי שלא ילחצו בכל מקום על התמונה
const SIZES = { small: 0.1, medium: 0.14, large: 0.2 }; // גובה המתחבא ביחס לגובה התמונה
const START_COLORS = ['ff3b6b', '7b2ff7', '00c2ff', 'ffd23f', '2ec4b6', 'ff8a00', '00e05a', 'ff4fd8'];

// צורת בן האדם: 10 משבצות רוחב, 20 גובה (# = גוף). חייב להיות זהה ללקוח
export const BODY = [
  '...####...',
  '..######..',
  '..######..',
  '..######..',
  '...####...',
  '....##....',
  '##########',
  '##########',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '#.######.#',
  '..######..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '..##..##..',
  '.###..###.',
];
const COLS = 10;
const ROWS = 20;
const CELLS = BODY.join('').split('').filter((c) => c === '#').length;
const SKIN_RE = new RegExp(`^[0-9a-f]{${CELLS * 6}}$`);

function decodeImage(data) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data ?? ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { type: `image/${m[1]}`, buf };
}

// גודל המתחבא בקואורדינטות של התמונה (0-1)
function bodySize(room) {
  const g = room.game;
  const h = SIZES[room.settings.size] || SIZES.medium;
  return { w: (h * (COLS / ROWS)) / g.aspect, h };
}

// בוחרים את המחפשים הבאים בסבב, רק מבין מי שמחובר
function pickSeekers(room, api) {
  const g = room.game;
  const seekers = [];
  const n = g.order.length;
  for (let tries = 0; tries < n && seekers.length < room.settings.seekers; tries++) {
    const id = g.order[g.ptr % n];
    g.ptr++;
    if (api.isConnected(id)) seekers.push(id);
  }
  return seekers;
}

function startRound(room, api) {
  const g = room.game;
  api.clearTimer();
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const seekers = pickSeekers(room, api);
  const hiders = api.activeIds().filter((id) => !seekers.includes(id));
  if (!seekers.length || !hiders.length) return api.endGame();
  Object.assign(g, {
    phase: 'choose',
    seekers,
    hiders,
    image: null,
    seed: null,
    aspect: 4 / 3,
    bodies: {},
    ready: {},
    found: {},
    misses: [],
    lastMiss: {},
    points: null,
  });
  api.setTimer(api.time('choose'), () => fallbackImage(room, api));
}

// המחפש לא בחר תמונה בזמן (או יצא) - כולם מציירים את אותה סצנה אקראית לפי seed
function fallbackImage(room, api) {
  const g = room.game;
  if (g.phase !== 'choose') return;
  g.seed = Math.floor(Math.random() * 1e9);
  g.aspect = 4 / 3;
  startHide(room, api);
}

function startHide(room, api) {
  const g = room.game;
  g.phase = 'hide';
  const { w, h } = bodySize(room);
  shuffle(g.hiders).forEach((id, i) => {
    g.bodies[id] = {
      x: Math.random() * (1 - w),
      y: Math.random() * (1 - h),
      skin: START_COLORS[i % START_COLORS.length].repeat(CELLS),
    };
  });
  api.setTimer(api.time('hide'), () => startSeek(room, api));
}

function startSeek(room, api) {
  const g = room.game;
  if (g.phase !== 'hide') return;
  g.phase = 'seek';
  api.setTimer(api.time('seek'), () => endRound(room, api));
}

function endRound(room, api) {
  const g = room.game;
  if (g.phase !== 'seek') return;
  g.phase = 'results';
  // כל מתחבא שנמצא = נקודה לכל המחפשים. מי שלא נמצא מקבל כמו המחפשים
  const foundCount = Object.keys(g.found).length;
  const points = {};
  for (const id of g.seekers) points[id] = foundCount;
  for (const id of g.hiders) points[id] = g.found[id] ? 0 : foundCount;
  for (const [id, pts] of Object.entries(points)) api.addScore(id, pts);
  g.points = points;
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => startRound(room, api));
}

function allReady(room, api) {
  const g = room.game;
  return g.hiders.filter((id) => api.isConnected(id)).every((id) => g.ready[id]);
}

// לחיצה של המחפש: פוגעת רק אם נפלה על משבצת של גוף (לא על הרווח בין הרגליים)
function hitTest(room, x, y) {
  const g = room.game;
  const { w, h } = bodySize(room);
  // מי שמצויר אחרון (הכי נמוך בתמונה) נמצא מעל כולם
  const order = g.hiders.filter((id) => !g.found[id] && g.bodies[id]).sort((a, b) => g.bodies[b].y - g.bodies[a].y);
  for (const id of order) {
    const b = g.bodies[id];
    const c = Math.floor(((x - b.x) / w) * COLS);
    const r = Math.floor(((y - b.y) / h) * ROWS);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS && BODY[r][c] === '#') return id;
  }
  return null;
}

export default {
  id: 'seek',
  minPlayers: 2,
  // תנועה נשלחת הרבה פעמים בשנייה - מסנכרנים את כולם במנות ולא על כל צעד
  lazy: ['move', 'paint'],

  sanitize(s, n) {
    const seekers = clampInt(s.seekers, 1, Math.max(1, n - 1), 1);
    return {
      rounds: clampInt(s.rounds, 1, 30, n),
      seekers,
      size: SIZES[s.size] ? s.size : 'medium',
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    g.order = shuffle(g.participants);
    g.ptr = 0;
    startRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return startRound(room, api);
    }
    if (type === 'image') {
      if (g.phase !== 'choose') return 'כבר מתחבאים!';
      if (!g.seekers.includes(pid)) return 'רק המחפש בוחר את התמונה';
      if (data?.seed != null) {
        g.seed = clampInt(data.seed, 0, 1e9, 1);
        g.aspect = 4 / 3;
      } else {
        const img = decodeImage(data?.image);
        if (!img) return 'התמונה גדולה מדי או לא תקינה';
        const w = clampInt(data?.w, 1, 5000, 1200);
        const h = clampInt(data?.h, 1, 5000, 900);
        g.image = { ...img, token: crypto.randomBytes(12).toString('hex') };
        g.aspect = Math.max(0.4, Math.min(2.5, w / h));
      }
      return startHide(room, api);
    }
    if (type === 'move') {
      if (g.phase !== 'hide' || !g.bodies[pid]) return;
      const { w, h } = bodySize(room);
      const x = Number(data?.x);
      const y = Number(data?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      g.bodies[pid].x = Math.max(0, Math.min(1 - w, x));
      g.bodies[pid].y = Math.max(0, Math.min(1 - h, y));
      return;
    }
    if (type === 'paint') {
      if (g.phase !== 'hide' || !g.bodies[pid]) return;
      const skin = String(data ?? '').toLowerCase();
      if (!SKIN_RE.test(skin)) return;
      g.bodies[pid].skin = skin;
      return;
    }
    if (type === 'ready') {
      if (g.phase !== 'hide' || !g.bodies[pid]) return;
      g.ready[pid] = !g.ready[pid];
      if (allReady(room, api)) startSeek(room, api);
      return;
    }
    if (type === 'find') {
      if (g.phase !== 'seek' || !g.seekers.includes(pid)) return;
      const now = Date.now();
      if (now - (g.lastMiss[pid] || 0) < MISS_COOLDOWN_MS) return 'רגע… 👀';
      const x = Number(data?.x);
      const y = Number(data?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const hit = hitTest(room, x, y);
      if (!hit) {
        g.lastMiss[pid] = now;
        g.misses.push({ x, y, by: pid, id: now + Math.random() });
        g.misses = g.misses.slice(-12);
        return;
      }
      g.found[hit] = pid;
      if (g.hiders.every((id) => g.found[id])) endRound(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'choose' && !g.seekers.some((id) => api.isConnected(id))) fallbackImage(room, api);
    else if (g.phase === 'hide' && allReady(room, api)) startSeek(room, api);
    else if (g.phase === 'seek' && !g.seekers.some((id) => api.isConnected(id))) endRound(room, api);
  },

  file(room, token) {
    const img = room.game?.image;
    return img && img.token === token ? { type: img.type, buf: img.buf } : null;
  },

  view(room, pid) {
    const g = room.game;
    const isSeeker = g.seekers.includes(pid);
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      seekers: g.seekers,
      hiders: g.hiders,
      // המחפש הראשון שמחובר בוחר את התמונה
      chooser: g.seekers.find((id) => room.players.find((p) => p.id === id)?.connected) || g.seekers[0],
      image: g.image ? `/img/${room.code}/${g.image.token}` : null,
      seed: g.seed,
      aspect: g.aspect,
      size: SIZES[room.settings.size] || SIZES.medium,
      readyIds: Object.keys(g.ready).filter((id) => g.ready[id]),
      found: g.found,
      misses: g.misses,
      points: g.points,
    };
    if (g.phase === 'hide') {
      // המחפשים לא רואים כלום. המתחבאים רואים איפה כולם, אבל את הצבעים רק של עצמם
      if (!isSeeker) {
        v.bodies = Object.fromEntries(
          Object.entries(g.bodies).map(([id, b]) => [id, id === pid ? b : { x: b.x, y: b.y }]),
        );
      }
    } else if (g.phase === 'seek' || g.phase === 'results') {
      v.bodies = g.bodies;
      v.cooldownLeft = isSeeker ? Math.max(0, MISS_COOLDOWN_MS - (Date.now() - (g.lastMiss[pid] || 0))) : 0;
    }
    return v;
  },
};
