// משחק: צור ריל - כל סיבוב יוצרים מים/ריל (אפשר לפי קטגוריה) ומדרגים 1-10
import crypto from 'crypto';
import { shuffle, clampInt, cleanText, sanitizeTimes } from '../utils.js';
import { REEL_CATEGORIES } from './content.js';

const TIMES = { create: 180, vote: 90 };
const RESULTS_SEC = 25;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// "שורה לכל קטגוריה" - גם פסיקים מפרידים
function parseCategories(text) {
  return String(text ?? '')
    .split(/[\n,]/)
    .map((s) => cleanText(s, 60))
    .filter(Boolean)
    .slice(0, 100);
}

function decodeImage(data) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data ?? ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { type: `image/${m[1]}`, buf };
}

function startRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  g.phase = 'create';
  // תמונות של הסיבוב הקודם נמחקות כדי לא למלא את הזיכרון
  g.memes = {};
  g.ratings = {};
  g.results = null;
  g.category = g.categories.length ? g.categories[(g.round - 1) % g.categories.length] : null;
  api.setTimer(api.time('create'), () => startVote(room, api));
}

function startVote(room, api) {
  const g = room.game;
  if (Object.keys(g.memes).length === 0) return showResults(room, api);
  g.phase = 'vote';
  g.displayOrder = shuffle(Object.keys(g.memes));
  if (votersPending(room, api).length === 0) return showResults(room, api);
  api.setTimer(api.time('vote'), () => showResults(room, api));
}

// מי עוד צריך לדרג - רק מי שיש לו מה לדרג (מים שאינו שלו)
function votersPending(room, api) {
  const g = room.game;
  return api.activeIds().filter((id) => !g.ratings[id] && g.displayOrder.some((o) => o !== id));
}

function showResults(room, api) {
  const g = room.game;
  g.phase = 'results';
  const owners = Object.keys(g.memes);
  const stats = owners.map((owner) => {
    const vals = Object.values(g.ratings).map((r) => r[owner]).filter((x) => typeof x === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { ownerId: owner, avg: Math.round(avg * 10) / 10, votes: vals.length };
  });
  stats.sort((a, b) => b.avg - a.avg);
  // ניקוד מדורג כמו בסיפור בהמשכים: מקום ראשון מקבל הכי הרבה, תיקו חולק את המקום
  let rank = 0;
  stats.forEach((s, k) => {
    if (k > 0 && s.avg < stats[k - 1].avg) rank = k;
    s.rank = rank + 1;
    s.points = s.votes > 0 ? stats.length - rank : 0;
    api.addScore(s.ownerId, s.points);
  });
  g.results = stats;
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => startRound(room, api));
}

function memeView(room, owner) {
  const m = room.game.memes[owner];
  return { owner, src: `/img/${room.code}/${m.token}`, w: m.w, h: m.h };
}

export default {
  id: 'reel',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 20, 3),
      withCategory: s.withCategory !== false,
      customCategories: String(s.customCategories ?? '').slice(0, 3000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    if (room.settings.withCategory) {
      // קודם הקטגוריות שלכם, ואחריהן של המשחק
      const custom = shuffle(parseCategories(room.settings.customCategories));
      const builtin = shuffle(REEL_CATEGORIES.filter((c) => !custom.includes(c)));
      g.categories = [...custom, ...builtin];
    } else {
      g.categories = [];
    }
    startRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return startRound(room, api);
    }
    if (g.phase === 'create' && type === 'submit') {
      const img = decodeImage(data?.image);
      if (!img) return 'התמונה גדולה מדי או לא תקינה';
      g.memes[pid] = {
        ...img,
        token: crypto.randomBytes(12).toString('hex'),
        w: clampInt(data?.w, 1, 4000, 1080),
        h: clampInt(data?.h, 1, 4000, 1080),
      };
      if (api.activeIds().every((id) => g.memes[id])) startVote(room, api);
      return;
    }
    if (g.phase === 'vote' && type === 'rate') {
      // הדירוג מגיע לפי מיקום בתצוגה (key), כדי שלא יידעו של מי כל מים
      const out = {};
      g.displayOrder.forEach((owner, i) => {
        if (owner === pid) return;
        const v = clampInt(data?.[i], 1, 10, null);
        if (v !== null) out[owner] = v;
      });
      const need = g.displayOrder.filter((o) => o !== pid).length;
      if (Object.keys(out).length < need) return 'צריך לדרג את כל הממים';
      g.ratings[pid] = out;
      if (votersPending(room, api).length === 0) showResults(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'create' && api.activeIds().every((id) => g.memes[id])) {
      startVote(room, api);
    } else if (g.phase === 'vote' && votersPending(room, api).length === 0) {
      showResults(room, api);
    }
  },

  // התמונות לא נשלחות בתוך המצב (הוא נשלח לכולם בכל שינוי) אלא בכתובת נפרדת
  file(room, token) {
    const m = Object.values(room.game?.memes || {}).find((x) => x.token === token);
    return m ? { type: m.type, buf: m.buf } : null;
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      category: g.category,
      submittedIds: Object.keys(g.memes),
    };
    if (g.phase === 'create') {
      v.submitted = !!g.memes[pid];
    }
    if (g.phase === 'vote') {
      // הבעלים נשארים אנונימיים בזמן הדירוג - הלקוח מזהה כל מים לפי מפתח
      v.memes = g.displayOrder.map((o, i) => ({ ...memeView(room, o), owner: undefined, key: i, mine: o === pid }));
      v.votedIds = Object.keys(g.ratings);
      const mine = g.ratings[pid];
      v.myRatings = mine ? Object.fromEntries(g.displayOrder.map((o, i) => [i, mine[o]]).filter(([, x]) => x)) : null;
    }
    if (g.phase === 'results') {
      v.results = (g.results || []).map((r) => ({ ...r, ...memeView(room, r.ownerId) }));
    }
    return v;
  },
};
