// משחק 7: המשך את המשפט
import { shuffle, clampInt, cleanText, sanitizeTimes } from '../utils.js';

const TIMES = { write: 60, fill: 60, vote: 60 };
const MAX_LEN = 160;
const WORD_LEN = 40;
// במשפט, כל רצף של 3 קווים תחתונים ומעלה הוא מקום למילה חסרה
const BLANK_RE = /_{3,}/;

function parseSentence(text, maxBlanks) {
  const parts = cleanText(text, MAX_LEN).split(BLANK_RE);
  const blanks = parts.length - 1;
  if (blanks < 1 || blanks > maxBlanks) return null;
  return parts;
}

function cleanWords(data, n) {
  if (!Array.isArray(data)) return Array(n).fill('');
  return Array.from({ length: n }, (_, i) => cleanText(data[i], WORD_LEN));
}

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();

  // סבב הוגן: כל אחד בתורו נותן משפט, מדלגים על מי שלא מחובר
  const n = g.order.length;
  let giver = null;
  for (let k = 0; k < n; k++) {
    const id = g.order[g.turn % n];
    g.turn++;
    if (api.isConnected(id)) {
      giver = id;
      break;
    }
  }
  if (!giver) return api.endGame();

  Object.assign(g, {
    phase: 'write',
    giverId: giver,
    fillers: g.participants.filter((id) => id !== giver),
    // 4 שחקנים ומעלה - כולם מצביעים; 3 - רק נותן המשפט בוחר
    allVote: api.activeIds().length >= 4,
    parts: null,
    draft: '',
    answers: {},
    drafts: {},
    entries: [],
    votes: {},
    roundPoints: {},
  });
  api.setTimer(api.time('write'), () => {
    // נגמר הזמן: אם הטיוטה תקינה משתמשים בה, אחרת מדלגים על הסיבוב
    const parts = parseSentence(g.draft, room.settings.maxBlanks);
    if (parts) startFill(room, api, parts);
    else reveal(room, api);
  });
}

function startFill(room, api, parts) {
  const g = room.game;
  g.parts = parts;
  g.phase = 'fill';
  api.setTimer(api.time('fill'), () => startVote(room, api));
}

function blanksCount(g) {
  return g.parts ? g.parts.length - 1 : 0;
}

function fillersPending(g, api) {
  return g.fillers.filter((id) => api.isConnected(id) && !g.answers[id]);
}

function startVote(room, api) {
  const g = room.game;
  // כולל טיוטות של מי שלא הספיק לשלוח (אם מילא לפחות מילה אחת)
  const list = [];
  for (const id of g.fillers) {
    const words = g.answers[id] || g.drafts[id];
    if (words && words.some(Boolean)) list.push({ author: id, words: words.map((w) => w || '…') });
  }
  g.entries = shuffle(list);
  if (g.entries.length === 0) return reveal(room, api);
  g.phase = 'vote';
  if (votersPending(g, api).length === 0) return reveal(room, api);
  api.setTimer(api.time('vote'), () => reveal(room, api));
}

// מי מצביע: נותן המשפט תמיד, ובמצב "כולם מצביעים" גם כל מי שיש לו תשובה של מישהו אחר לבחור
function voters(g) {
  if (!g.allVote) return [g.giverId];
  return g.participants.filter((id) => g.entries.some((e) => e.author !== id));
}

function votersPending(g, api) {
  return voters(g).filter((id) => api.isConnected(id) && g.votes[id] == null);
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  for (const idx of Object.values(g.votes)) {
    const author = g.entries[idx].author;
    g.roundPoints[author] = (g.roundPoints[author] || 0) + 1;
    api.addScore(author, 1);
  }
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

function skipRound(room, api) {
  api.clearTimer();
  room.game.round--;
  nextRound(room, api);
}

export default {
  id: 'complete',
  minPlayers: 3,

  sanitize(s, playerCount) {
    return {
      rounds: clampInt(s.rounds, 1, 30, playerCount),
      maxBlanks: clampInt(s.maxBlanks, 1, 5, 2),
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
    if (g.phase === 'write' && pid === g.giverId) {
      if (type === 'draft') {
        g.draft = cleanText(data, MAX_LEN);
        return;
      }
      if (type === 'submit') {
        const parts = parseSentence(data, room.settings.maxBlanks);
        if (!parts) return `צריך משפט עם 1 עד ${room.settings.maxBlanks} מילים חסרות`;
        if (!parts.join('').trim()) return 'צריך לכתוב גם משהו מסביב למילה החסרה';
        return startFill(room, api, parts);
      }
    }
    if (g.phase === 'fill' && g.fillers.includes(pid)) {
      const words = cleanWords(data, blanksCount(g));
      if (type === 'draft') {
        g.drafts[pid] = words;
        return;
      }
      if (type === 'submit') {
        if (words.some((w) => !w)) return 'צריך למלא את כל המילים החסרות';
        g.answers[pid] = words;
        if (fillersPending(g, api).length === 0) startVote(room, api);
        return;
      }
    }
    if (g.phase === 'vote' && type === 'vote' && voters(g).includes(pid)) {
      const idx = clampInt(data, 0, g.entries.length - 1, null);
      if (idx === null || g.entries[idx].author === pid) return;
      g.votes[pid] = idx;
      if (votersPending(g, api).length === 0) reveal(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && !api.isConnected(g.giverId)) return skipRound(room, api);
    if (g.phase === 'fill' && fillersPending(g, api).length === 0) startVote(room, api);
    else if (g.phase === 'vote' && votersPending(g, api).length === 0) reveal(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      giverId: g.giverId,
      isGiver: pid === g.giverId,
      maxBlanks: room.settings.maxBlanks,
      allVote: g.allVote,
      fillerIds: g.fillers,
      parts: g.parts,
    };
    if (g.phase === 'fill') {
      v.submittedIds = Object.keys(g.answers);
      v.myAnswer = g.answers[pid] || null;
    }
    if (g.phase === 'vote' || g.phase === 'reveal') {
      const shown = g.phase === 'reveal';
      v.entries = g.entries.map((e, i) => ({
        words: e.words,
        mine: e.author === pid,
        author: shown ? e.author : undefined,
        voters: shown ? Object.keys(g.votes).filter((id) => g.votes[id] === i) : undefined,
      }));
      v.voterIds = voters(g);
      v.votedIds = Object.keys(g.votes);
      v.myVote = g.votes[pid] ?? null;
    }
    if (g.phase === 'reveal') v.roundPoints = g.roundPoints;
    return v;
  },
};
