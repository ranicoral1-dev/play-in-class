// משחק: מכירה פומבית - לכל אחד אותו סכום כסף, קונים פריטים במכירה פומבית לבנייה שלו, ובסוף מדרגים
import { shuffle, pick, clampInt, cleanText, sanitizeTimes } from '../utils.js';
import { AUCTION_THEMES } from './content.js';

const TIMES = { quiet: 5, rate: 60 };
const SOLD_SEC = 3;
const RESULTS_SEC = 25;

// ״🍓 תותים״ → { e: '🍓', name: 'תותים' }. בלי אימוג'י בהתחלה - מתנה
function parseItem(text) {
  const s = cleanText(text, 40);
  const m = /^(\S+)\s+(.+)$/u.exec(s);
  if (m && !/[\p{L}\p{N}]/u.test(m[1])) return { e: m[1], name: m[2] };
  return { e: '🎁', name: s };
}

// שורה ראשונה: מה בונים. כל השאר: פריט בשורה
function parseCustom(text) {
  const lines = String(text ?? '')
    .split('\n')
    .map((s) => cleanText(s, 40))
    .filter(Boolean);
  if (lines.length < 2) return null;
  const head = parseItem(lines[0]);
  return {
    id: 'custom',
    name: head.name,
    emoji: head.e === '🎁' ? '✨' : head.e,
    items: lines.slice(1, 61),
  };
}

function nextItem(room, api) {
  const g = room.game;
  g.index++;
  if (g.index >= g.queue.length) return startRate(room, api);
  Object.assign(g, { phase: 'bid', item: g.queue[g.index], price: room.settings.start, leader: null, bids: [], sold: null });
  // אם אף אחד לא פותח - הפריט לא נמכר
  api.setTimer(room.settings.times.quiet * 2, () => sell(room, api));
}

function sell(room, api) {
  const g = room.game;
  g.phase = 'sold';
  g.sold = g.leader ? { pid: g.leader, price: g.price } : null;
  if (g.leader) {
    g.money[g.leader] -= g.price;
    g.builds[g.leader].push({ ...g.item, price: g.price });
  }
  api.setTimer(SOLD_SEC, () => nextItem(room, api));
}

function startRate(room, api) {
  const g = room.game;
  g.phase = 'rate';
  g.item = null;
  g.ratings = {};
  if (votersPending(room, api).length === 0) return showResults(room, api);
  api.setTimer(api.time('rate'), () => showResults(room, api));
}

function votersPending(room, api) {
  const g = room.game;
  return api.activeIds().filter((id) => !g.ratings[id]);
}

function showResults(room, api) {
  const g = room.game;
  g.phase = 'results';
  const stats = g.participants.map((owner) => {
    const vals = Object.values(g.ratings).map((r) => r[owner]).filter((x) => typeof x === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { ownerId: owner, avg: Math.round(avg * 10) / 10, votes: vals.length };
  });
  stats.sort((a, b) => b.avg - a.avg);
  // ניקוד מדורג כמו בצור ריל: מקום ראשון מקבל הכי הרבה, תיקו חולק את המקום
  let rank = 0;
  stats.forEach((s, k) => {
    if (k > 0 && s.avg < stats[k - 1].avg) rank = k;
    s.rank = rank + 1;
    s.points = s.votes > 0 ? stats.length - rank : 0;
    api.addScore(s.ownerId, s.points);
  });
  g.results = stats;
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => api.endGame());
}

export default {
  id: 'auction',
  minPlayers: 2,

  sanitize(s) {
    const themes = ['random', ...AUCTION_THEMES.map((t) => t.id)];
    return {
      theme: themes.includes(s.theme) ? s.theme : 'random',
      items: clampInt(s.items, 3, 30, 10),
      money: clampInt(s.money, 50, 10000, 250),
      start: clampInt(s.start, 1, 1000, 10),
      jump: clampInt(s.jump, 1, 1000, 10),
      // נשאר סודי (ראו publicSettings) - כדי שהפריטים יהיו הפתעה
      customWords: s.customWords == null ? null : String(s.customWords).slice(0, 4000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    const { settings } = room;
    const custom = settings.customWords != null ? parseCustom(settings.customWords) : null;
    g.theme =
      custom ||
      (settings.theme === 'random' ? pick(AUCTION_THEMES) : AUCTION_THEMES.find((t) => t.id === settings.theme));
    g.queue = shuffle(g.theme.items).slice(0, settings.items).map(parseItem);
    g.index = -1;
    g.money = Object.fromEntries(g.participants.map((id) => [id, settings.money]));
    g.builds = Object.fromEntries(g.participants.map((id) => [id, []]));
    nextItem(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    const { settings } = room;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return api.endGame();
    }
    if (type === 'bid') {
      if (g.phase !== 'bid') return 'המכירה על הפריט הזה נגמרה';
      if (g.leader === pid) return 'ההצעה שלך כבר הכי גבוהה 😉';
      const min = g.leader ? g.price + settings.jump : settings.start;
      const to = clampInt(data, 0, 1e6, 0);
      if (to < min) return 'מישהו הקדים אותך!';
      if (to > g.money[pid]) return 'אין לך מספיק כסף 💸';
      g.price = to;
      g.leader = pid;
      g.bids.unshift({ pid, to });
      g.bids = g.bids.slice(0, 6);
      // כל הצעה מתחילה את הספירה מחדש
      api.setTimer(settings.times.quiet, () => sell(room, api));
      return;
    }
    if (type === 'rate' && g.phase === 'rate') {
      const out = {};
      for (const owner of g.participants) {
        if (owner === pid) continue;
        const v = clampInt(data?.[owner], 1, 10, null);
        if (v !== null) out[owner] = v;
      }
      if (Object.keys(out).length < g.participants.length - 1) return 'צריך לדרג את כולם';
      g.ratings[pid] = out;
      if (votersPending(room, api).length === 0) showResults(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'rate' && votersPending(room, api).length === 0) showResults(room, api);
  },

  view(room, pid) {
    const g = room.game;
    return {
      phase: g.phase,
      theme: { name: g.theme.name, emoji: g.theme.emoji },
      index: g.index,
      total: g.queue.length,
      upcoming: g.queue.slice(g.index + 1, g.index + 6),
      item: g.item,
      price: g.price,
      leader: g.leader,
      bids: g.bids,
      sold: g.sold,
      jump: room.settings.jump,
      start: room.settings.start,
      money: g.money,
      builds: g.builds,
      ratedIds: g.ratings ? Object.keys(g.ratings) : [],
      myRatings: g.ratings?.[pid] || null,
      results: g.results || null,
    };
  },
};
