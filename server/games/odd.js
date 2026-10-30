// משחק 12: מי השונה
import { shuffle, pick, clampInt, sanitizeTimes, cleanText, fuzzyEqual } from '../utils.js';
import { ODD_PAIRS } from './wordlists.js';

const TIMES = { describe: 30, vote: 45 };
const MAX_CUSTOM = 100;

// מילים של השחקנים: כל שורה ״מילה, מילה דומה, קטגוריה״ (אפשר להפריד גם ב-| או ב-/)
function parseCustom(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.split(/[,|/،]/).map((x) => cleanText(x, 30)).filter(Boolean))
    .filter((parts) => parts.length >= 2)
    .slice(0, MAX_CUSTOM)
    .map(([a, b, cat]) => [a, b, cat || '']);
}

// כמה שונים אפשר: תמיד פחות מחצי מהשחקנים
const maxOdds = (n) => Math.max(1, Math.floor((n - 1) / 2));

function alive(g) {
  return g.order.filter((id) => !g.out[id]);
}

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const ids = g.participants.filter((id) => api.isConnected(id));
  if (ids.length < 3) return api.endGame();

  const pool = [...(room.settings.builtin || !g.custom.length ? ODD_PAIRS : []), ...g.custom];
  let pair = pick(pool);
  // לא אותו זוג פעמיים ברצף
  if (pool.length > 1) while (pair === g.lastPair) pair = pick(pool);
  g.lastPair = pair;
  const flip = Math.random() < 0.5;
  const odds = shuffle(ids).slice(0, Math.min(room.settings.odds, maxOdds(ids.length)));

  Object.assign(g, {
    word: flip ? pair[1] : pair[0],
    oddWord: flip ? pair[0] : pair[1],
    category: pair[2] || '',
    odds,
    order: shuffle(ids),
    out: {},
    cycle: 0,
    history: [],
    outcome: null,
    roundPoints: {},
  });
  startCycle(room, api);
}

// סבב תיאורים: כל מי שעוד במשחק מתאר בתורו
function startCycle(room, api) {
  const g = room.game;
  g.cycle++;
  g.descs = {};
  g.votes = {};
  g.lastVote = null;
  g.turnIdx = -1;
  nextDescriber(room, api);
}

function nextDescriber(room, api) {
  const g = room.game;
  const list = alive(g);
  for (g.turnIdx++; g.turnIdx < list.length; g.turnIdx++) {
    if (api.isConnected(list[g.turnIdx])) {
      g.phase = 'describe';
      g.current = list[g.turnIdx];
      api.setTimer(api.time('describe'), () => {
        g.descs[g.current] = '…';
        nextDescriber(room, api);
      });
      return;
    }
  }
  g.current = null;
  g.phase = 'vote';
  api.setTimer(api.time('vote'), () => resolveVote(room, api));
}

function voters(g, api) {
  return alive(g).filter((id) => api.isConnected(id));
}

function resolveVote(room, api) {
  const g = room.game;
  api.clearTimer();
  const tally = {};
  for (const t of Object.values(g.votes)) tally[t] = (tally[t] || 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((k) => tally[k] === top);
  // רוב לדילוג או תיקו - אף אחד לא יוצא, וממשיכים לעוד סבב
  const outId = top > 0 && leaders.length === 1 && leaders[0] !== 'skip' ? leaders[0] : null;
  const wasOdd = outId ? g.odds.includes(outId) : false;

  const add = (id, n) => (g.roundPoints[id] = (g.roundPoints[id] || 0) + n);
  if (outId) {
    g.out[outId] = true;
    // נקודה לכל מי שהצביע נכון
    if (wasOdd) for (const [v, t] of Object.entries(g.votes)) if (t === outId) add(v, 1);
  }
  // השונים ששרדו את ההצבעה מקבלים נקודה
  for (const id of g.odds) if (!g.out[id]) add(id, 1);

  g.history.push({ cycle: g.cycle, descs: g.descs, votes: g.votes, outId, wasOdd });
  g.lastVote = { votes: g.votes, tally, outId, wasOdd };

  const left = alive(g);
  const oddsLeft = left.filter((id) => g.odds.includes(id)).length;
  if (oddsLeft === 0) g.outcome = 'normal';
  else if (oddsLeft >= left.length - oddsLeft) g.outcome = 'odd';
  if (g.outcome === 'normal') g.order.filter((id) => !g.odds.includes(id)).forEach((id) => add(id, 2));
  if (g.outcome === 'odd') g.odds.forEach((id) => add(id, 5));

  g.phase = 'result';
  api.setTimer(api.revealTime(), () => afterResult(room, api));
}

function afterResult(room, api) {
  const g = room.game;
  if (!g.outcome) return startCycle(room, api);
  g.phase = 'end';
  for (const [id, n] of Object.entries(g.roundPoints)) api.addScore(id, n);
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

export default {
  id: 'odd',
  minPlayers: 3,

  sanitize(s, playerCount) {
    return {
      rounds: clampInt(s.rounds, 1, 20, 3),
      white: !!s.white,
      odds: clampInt(s.odds, 1, maxOdds(playerCount), 1),
      builtin: s.builtin !== false,
      // לא נשלח לשחקנים (ראו publicSettings). ב״משחקים שוב״ מהסיכום הוא לא מגיע - ואז נשארות המילים מהפעם הקודמת
      customWords: s.customWords == null ? null : String(s.customWords).slice(0, 5000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    if (room.settings.customWords != null) room.oddCustom = parseCustom(room.settings.customWords);
    g.custom = room.oddCustom || [];
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid)) return;
      if (g.phase === 'result' || g.phase === 'end') {
        api.clearTimer();
        return g.phase === 'result' ? afterResult(room, api) : nextRound(room, api);
      }
      return;
    }
    if (g.out[pid] || !g.order.includes(pid)) return;
    if (type === 'describe') {
      if (g.phase !== 'describe' || g.current !== pid) return;
      const text = cleanText(data, 80);
      if (!text) return;
      const mine = room.settings.white && g.odds.includes(pid) ? null : g.odds.includes(pid) ? g.oddWord : g.word;
      if (mine && (fuzzyEqual(text, mine) || text.split(' ').some((w) => fuzzyEqual(w, mine)))) {
        return 'אסור לכתוב את המילה עצמה 🙊';
      }
      g.descs[pid] = text;
      return nextDescriber(room, api);
    }
    if (type === 'vote') {
      if (g.phase !== 'vote') return;
      const t = data === 'skip' ? 'skip' : String(data ?? '');
      if (t !== 'skip' && (!alive(g).includes(t) || t === pid)) return 'אי אפשר להצביע לשחקן הזה';
      g.votes[pid] = t;
      if (voters(g, api).every((id) => g.votes[id])) resolveVote(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'describe' && !api.isConnected(g.current)) nextDescriber(room, api);
    else if (g.phase === 'vote' && voters(g, api).every((id) => g.votes[id])) resolveVote(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const white = room.settings.white;
    const isOdd = g.odds.includes(pid);
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      white,
      oddsCount: g.odds.length,
      order: g.order,
      out: g.out,
      cycle: g.cycle,
      current: g.current,
      descs: g.descs,
      history: g.history.map(({ cycle, descs, outId }) => ({ cycle, descs, outId })),
      inRound: g.order.includes(pid),
      myOut: !!g.out[pid],
      votedIds: Object.keys(g.votes || {}),
      myVote: g.votes?.[pid] ?? null,
    };
    // המתחזה לא יודע שהוא מתחזה - הוא פשוט מקבל מילה אחרת. האיש הלבן יודע, ומקבל רק קטגוריה
    if (white && isOdd) {
      v.amWhite = true;
      v.category = g.category;
    } else if (v.inRound) {
      v.myWord = isOdd ? g.oddWord : g.word;
    }
    if (g.phase === 'result' || g.phase === 'end') {
      v.lastVote = g.lastVote;
      v.outcome = g.outcome;
    }
    if (g.phase === 'end') {
      v.word = g.word;
      v.oddWord = g.oddWord;
      v.category = g.category;
      v.odds = g.odds;
      v.roundPoints = g.roundPoints;
    }
    return v;
  },
};
