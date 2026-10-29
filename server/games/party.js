// משחק 3: מי בא למסיבה?
import { shuffle, pick, clampInt, cleanText, fuzzyEqual } from '../utils.js';
import { PARTY_CATEGORIES } from './content.js';

const CATEGORY_SEC = 40;
const TURN_SEC = 40;
const REVIEW_SEC = 25;
const REVEAL_SEC = 15;
const HOST_WIN_POINTS = 5;
const CATEGORY_BONUS = 2;

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const n = g.order.length;
  let hostId = null;
  for (let k = 0; k < n; k++) {
    const id = g.order[g.turn % n];
    g.turn++;
    if (api.isConnected(id)) {
      hostId = id;
      break;
    }
  }
  if (!hostId) return api.endGame();
  const guests = shuffle(g.participants.filter((id) => id !== hostId));
  Object.assign(g, {
    phase: 'category',
    hostId,
    guests,
    category: null,
    autoCategory: false,
    accepts: [],
    entries: [],
    turnIdx: -1,
    currentId: null,
    turnsUsed: {},
    catUsed: {},
    winnerId: null,
    pendingIdx: null,
    roundPoints: {},
  });
  api.setTimer(CATEGORY_SEC, () => {
    g.category = pick(PARTY_CATEGORIES);
    g.autoCategory = true;
    nextTurn(room, api);
  });
}

function nextTurn(room, api) {
  const g = room.game;
  const { turnsPerGuest } = room.settings;
  const n = g.guests.length;
  for (let k = 1; k <= n; k++) {
    const idx = (g.turnIdx + k) % n;
    const id = g.guests[idx];
    if (api.isConnected(id) && (g.turnsUsed[id] || 0) < turnsPerGuest) {
      g.turnIdx = idx;
      g.currentId = id;
      g.phase = 'turn';
      api.setTimer(TURN_SEC, () => {
        g.turnsUsed[id] = (g.turnsUsed[id] || 0) + 1;
        g.entries.push({ pid: id, type: 'skip', text: '', status: 'skip' });
        nextTurn(room, api);
      });
      return;
    }
  }
  endRound(room, api, null);
}

function endRound(room, api, winnerId) {
  const g = room.game;
  g.phase = 'reveal';
  g.currentId = null;
  g.winnerId = winnerId;
  if (winnerId) {
    g.roundPoints[winnerId] = (g.roundPoints[winnerId] || 0) + CATEGORY_BONUS;
    api.addScore(winnerId, CATEGORY_BONUS);
  } else if (!g.hostLeft) {
    g.roundPoints[g.hostId] = HOST_WIN_POINTS;
    api.addScore(g.hostId, HOST_WIN_POINTS);
  }
  g.hostLeft = false;
  api.setTimer(REVEAL_SEC, () => nextRound(room, api));
}

function resolveEntry(room, api, entry, ok) {
  const g = room.game;
  if (entry.type === 'item') {
    entry.status = ok ? 'in' : 'out';
    if (ok) {
      g.roundPoints[entry.pid] = (g.roundPoints[entry.pid] || 0) + 1;
      api.addScore(entry.pid, 1);
    }
    nextTurn(room, api);
  } else {
    entry.status = ok ? 'correct' : 'wrong';
    if (ok) endRound(room, api, entry.pid);
    else nextTurn(room, api);
  }
}

function startReview(room, api, idx) {
  const g = room.game;
  g.phase = 'review';
  g.pendingIdx = idx;
  api.setTimer(REVIEW_SEC, () => {
    resolveEntry(room, api, g.entries[idx], false);
  });
}

export default {
  id: 'party',
  minPlayers: 2,

  sanitize(s, playerCount) {
    return {
      rounds: clampInt(s.rounds, 1, 20, playerCount),
      turnsPerGuest: clampInt(s.turnsPerGuest, 1, 10, 4),
      maxCategoryGuesses: clampInt(s.maxCategoryGuesses, 1, 10, 2),
    };
  },

  start(room, api) {
    const g = room.game;
    g.order = shuffle(g.participants);
    g.turn = 0;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'reveal') return;
      return nextRound(room, api);
    }
    if (g.phase === 'category' && type === 'category' && pid === g.hostId) {
      const cat = cleanText(data?.category, 60);
      if (!cat) return 'צריך לכתוב קטגוריה';
      g.category = cat;
      g.accepts = String(data?.accepts || '')
        .split(/[,،\n]/)
        .map((x) => cleanText(x, 40))
        .filter(Boolean)
        .slice(0, 50);
      nextTurn(room, api);
      return;
    }
    if (g.phase === 'turn' && pid === g.currentId && (type === 'item' || type === 'category')) {
      const text = cleanText(data, 60);
      if (!text) return 'צריך לכתוב משהו';
      if (type === 'category' && (g.catUsed[pid] || 0) >= room.settings.maxCategoryGuesses) {
        return 'נגמרו לך הניחושים לקטגוריה';
      }
      g.turnsUsed[pid] = (g.turnsUsed[pid] || 0) + 1;
      const entry = { pid, type, text, status: 'pending' };
      g.entries.push(entry);
      const idx = g.entries.length - 1;
      if (type === 'category') {
        g.catUsed[pid] = (g.catUsed[pid] || 0) + 1;
        if (fuzzyEqual(text, g.category)) return resolveEntry(room, api, entry, true);
        return startReview(room, api, idx);
      }
      // פריט: בדיקה אוטומטית מול רשימת המארח ופריטים שכבר נשפטו
      if (g.accepts.some((a) => fuzzyEqual(a, text))) return resolveEntry(room, api, entry, true);
      const prev = g.entries.find((e, i) => i !== idx && e.type === 'item' && e.status !== 'pending' && fuzzyEqual(e.text, text));
      if (prev) return resolveEntry(room, api, entry, prev.status === 'in');
      return startReview(room, api, idx);
    }
    if (g.phase === 'review' && type === 'judge' && pid === g.hostId) {
      return resolveEntry(room, api, g.entries[g.pendingIdx], !!data);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'reveal') return;
    if (!api.isConnected(g.hostId)) {
      // המארח עזב - עוברים לסיבוב הבא בלי נקודות
      api.clearTimer();
      g.hostLeft = true;
      return endRound(room, api, null);
    }
    if (g.phase === 'turn' && !api.isConnected(g.currentId)) nextTurn(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const isHostRole = pid === g.hostId;
    const showCategory = isHostRole || g.phase === 'reveal';
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      hostId: g.hostId,
      isPartyHost: isHostRole,
      guests: g.guests,
      currentId: g.currentId,
      category: showCategory ? g.category : null,
      autoCategory: g.autoCategory,
      accepts: isHostRole ? g.accepts : [],
      entries: g.entries.map((e) => ({ pid: e.pid, type: e.type, text: e.text, status: e.status })),
      pendingIdx: g.pendingIdx,
      turnsUsed: g.turnsUsed,
      catUsed: g.catUsed,
      turnsPerGuest: room.settings.turnsPerGuest,
      maxCategoryGuesses: room.settings.maxCategoryGuesses,
      winnerId: g.winnerId,
      roundPoints: g.phase === 'reveal' ? g.roundPoints : null,
    };
  },
};
