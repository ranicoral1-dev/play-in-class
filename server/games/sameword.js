// משחק 5: אותה מילה
import { pick, clampInt, cleanText, normalize } from '../utils.js';
import { SAME_CATEGORIES } from './content.js';

const CATEGORY_SEC = 25;
const WRITE_SEC = 45;
const REVEAL_SEC = 12;

function startWrite(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  g.phase = 'write';
  g.words = {};
  api.setTimer(WRITE_SEC, () => reveal(room, api));
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  const groups = {};
  for (const [pid, w] of Object.entries(g.words)) {
    const key = normalize(w);
    (groups[key] ||= { word: w, ids: [] }).ids.push(pid);
  }
  const points = {};
  for (const grp of Object.values(groups)) {
    if (grp.ids.length >= 2) {
      for (const id of grp.ids) {
        points[id] = grp.ids.length;
        api.addScore(id, grp.ids.length);
      }
    }
  }
  const groupList = Object.values(groups).sort((a, b) => b.ids.length - a.ids.length);
  const active = api.activeIds();
  g.allMatch =
    active.length >= 2 && groupList.length === 1 && active.every((id) => groupList[0].ids.includes(id));
  g.history.push({ round: g.round, words: { ...g.words }, groups: groupList, points });
  api.setTimer(REVEAL_SEC, () => advance(room, api));
}

function advance(room, api) {
  const g = room.game;
  if (g.allMatch) return api.endGame();
  startWrite(room, api);
}

export default {
  id: 'sameword',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 20, 6),
      withCategory: !!s.withCategory,
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    g.history = [];
    g.category = null;
    if (room.settings.withCategory) {
      g.phase = 'category';
      g.chooserId = pick(g.participants);
      api.setTimer(CATEGORY_SEC, () => {
        g.category = pick(SAME_CATEGORIES);
        startWrite(room, api);
      });
    } else {
      startWrite(room, api);
    }
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'reveal') return;
      return advance(room, api);
    }
    if (g.phase === 'category' && type === 'category' && pid === g.chooserId) {
      const cat = cleanText(data, 40);
      if (!cat) return 'צריך לכתוב קטגוריה';
      g.category = cat;
      return startWrite(room, api);
    }
    if (g.phase === 'write' && type === 'word') {
      const w = cleanText(data, 30);
      if (!w) return 'צריך לכתוב מילה';
      g.words[pid] = w;
      if (api.activeIds().every((id) => g.words[id])) reveal(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'category' && !api.isConnected(g.chooserId)) {
      api.clearTimer();
      g.category = pick(SAME_CATEGORIES);
      startWrite(room, api);
    } else if (g.phase === 'write' && api.activeIds().every((id) => g.words[id])) {
      reveal(room, api);
    }
  },

  view(room, pid) {
    const g = room.game;
    const last = g.history[g.history.length - 1];
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      category: g.category,
      chooserId: g.chooserId,
      withCategory: room.settings.withCategory,
      submittedIds: g.phase === 'write' ? Object.keys(g.words) : [],
      myWord: g.phase === 'write' ? g.words[pid] || null : null,
      // בשלב הכתיבה רואים את המילים של הסיבוב הקודם, בחשיפה - את הסיבוב הנוכחי
      previous: last ? { round: last.round, groups: last.groups, points: last.points } : null,
      allMatch: !!g.allMatch,
      history: g.history.map((h) => ({ round: h.round, groups: h.groups })),
    };
  },
};
