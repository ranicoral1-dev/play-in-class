// משחק 6: ציטוט
import { shuffle, clampInt, cleanText, sanitizeTimes } from '../utils.js';

const TIMES = { write: 90, guess: 120 };
const MAX_LEN = 120;

function cleanList(data, max) {
  if (!Array.isArray(data)) return [];
  return data.slice(0, max).map((s) => cleanText(s, MAX_LEN));
}

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();

  // סבב הוגן: כל אחד בתורו מנחש, מדלגים על מי שלא מחובר
  const n = g.order.length;
  let guesser = null;
  for (let k = 0; k < n; k++) {
    const id = g.order[g.turn % n];
    g.turn++;
    if (api.isConnected(id)) {
      guesser = id;
      break;
    }
  }
  if (!guesser) return api.endGame();

  Object.assign(g, {
    phase: 'write',
    guesserId: guesser,
    writers: g.participants.filter((id) => id !== guesser),
    sentences: {},
    drafts: {},
    items: [],
    candidates: [],
    poolSize: 0,
    guesses: {},
    roundPoints: {},
  });
  api.setTimer(api.time('write'), () => startGuess(room, api));
}

function writersPending(g, api) {
  return g.writers.filter((id) => api.isConnected(id) && !g.sentences[id]);
}

// מגרילים משפטים מכל מה שנכתב (כולל טיוטות של מי שלא הספיק לשלוח)
function startGuess(room, api) {
  const g = room.game;
  const pool = [];
  for (const id of g.writers) {
    const list = g.sentences[id] || g.drafts[id] || [];
    for (const text of list) if (text) pool.push({ author: id, text });
  }
  g.poolSize = pool.length;
  g.items = shuffle(pool).slice(0, room.settings.perRound);
  g.candidates = g.writers.filter((id) => pool.some((s) => s.author === id));
  if (g.items.length === 0) return reveal(room, api);
  g.phase = 'guess';
  api.setTimer(api.time('guess'), () => reveal(room, api));
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  g.items.forEach((item, i) => {
    const winner = g.guesses[i] === item.author ? g.guesserId : item.author;
    g.roundPoints[winner] = (g.roundPoints[winner] || 0) + 1;
    api.addScore(winner, 1);
  });
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

function skipRound(room, api) {
  api.clearTimer();
  room.game.round--;
  nextRound(room, api);
}

export default {
  id: 'quote',
  minPlayers: 3,

  sanitize(s, playerCount) {
    return {
      rounds: clampInt(s.rounds, 1, 30, playerCount),
      perRound: clampInt(s.perRound, 1, 50, 10),
      perPerson: clampInt(s.perPerson, 1, 10, 3),
      ...sanitizeTimes(s, TIMES),
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
    if (g.phase === 'write' && g.writers.includes(pid)) {
      const list = cleanList(data, room.settings.perPerson);
      if (type === 'draft') {
        g.drafts[pid] = list;
        return;
      }
      if (type === 'submit') {
        if (list.length < room.settings.perPerson || list.some((s) => !s)) return 'צריך למלא את כל המשפטים';
        g.sentences[pid] = list;
        if (writersPending(g, api).length === 0) startGuess(room, api);
        return;
      }
    }
    if (g.phase === 'guess' && pid === g.guesserId) {
      if (type === 'pick') {
        const i = clampInt(data?.idx, 0, g.items.length - 1, null);
        if (i === null) return;
        if (data?.author == null) delete g.guesses[i];
        else if (g.candidates.includes(data.author)) g.guesses[i] = data.author;
        return;
      }
      if (type === 'submit') {
        if (g.items.some((_, i) => !g.guesses[i])) return 'צריך לשייך כל משפט למישהו';
        reveal(room, api);
      }
    }
  },

  check(room, api) {
    const g = room.game;
    if ((g.phase === 'write' || g.phase === 'guess') && !api.isConnected(g.guesserId)) {
      return skipRound(room, api);
    }
    if (g.phase === 'write' && writersPending(g, api).length === 0) startGuess(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      guesserId: g.guesserId,
      isGuesser: pid === g.guesserId,
      perPerson: room.settings.perPerson,
      writerIds: g.writers,
      submittedIds: Object.keys(g.sentences),
      mySentences: g.sentences[pid] || null,
    };
    if (g.phase === 'guess' || g.phase === 'reveal') {
      v.items = g.items.map((item, i) => ({
        text: item.text,
        mine: item.author === pid,
        guess: g.guesses[i] || null,
        author: g.phase === 'reveal' ? item.author : undefined,
      }));
      v.candidates = g.candidates;
      v.poolSize = g.poolSize;
    }
    if (g.phase === 'reveal') v.roundPoints = g.roundPoints;
    return v;
  },
};
