// משחק 1: מה אתה מעדיף
import { shuffle, pick, clampInt, cleanText } from '../utils.js';
import { WYR_FALLBACK } from './content.js';

const WRITE_SEC = 20;
const VOTE_SEC = 60;
const GUESS_SEC = 60;
const REVEAL_SEC = 15;

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();

  // סבב הוגן: כל אחד בתורו, מדלגים על מי שלא מחובר
  const n = g.order.length;
  let decider = null;
  for (let k = 0; k < n; k++) {
    const id = g.order[g.turn % n];
    g.turn++;
    if (api.isConnected(id)) {
      decider = id;
      break;
    }
  }
  if (!decider) return api.endGame();

  Object.assign(g, {
    phase: 'write',
    deciderId: decider,
    options: null,
    draft: null,
    votes: {},
    guesses: {},
    roundPoints: {},
    correct: {},
  });
  api.setTimer(WRITE_SEC, () => {
    if (!g.options) {
      const d = g.draft;
      g.options = d && d[0] && d[1] ? d : pick(WYR_FALLBACK);
      g.autoOptions = !(d && d[0] && d[1]);
    }
    startVote(room, api);
  });
}

function startVote(room, api) {
  const g = room.game;
  g.phase = 'vote';
  g.voters = g.participants.filter((id) => id !== g.deciderId);
  api.setTimer(VOTE_SEC, () => startGuess(room, api));
}

function startGuess(room, api) {
  const g = room.game;
  g.targets = g.voters.filter((id) => g.votes[id]);
  if (g.targets.length === 0) return reveal(room, api);
  g.phase = 'guess';
  api.setTimer(GUESS_SEC, () => reveal(room, api));
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  for (const guesser of g.participants) {
    const gs = g.guesses[guesser] || {};
    let c = 0;
    for (const t of g.targets || []) {
      if (t !== guesser && gs[t] && gs[t] === g.votes[t]) c++;
    }
    g.correct[guesser] = c;
    if (guesser !== g.deciderId && c > 0) {
      g.roundPoints[guesser] = c;
      api.addScore(guesser, c);
    }
  }
  api.setTimer(REVEAL_SEC, () => nextRound(room, api));
}

function guessersPending(g, api) {
  return api.activeIds().filter((id) => {
    const targets = g.targets.filter((t) => t !== id);
    return targets.length > 0 && !g.guesses[id];
  });
}

export default {
  id: 'wyr',
  minPlayers: 3,

  sanitize(s, playerCount) {
    return { rounds: clampInt(s.rounds, 1, 30, playerCount) };
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
    if (g.phase === 'write' && pid === g.deciderId) {
      const a = cleanText(data?.a, 80);
      const b = cleanText(data?.b, 80);
      if (type === 'draft') {
        g.draft = [a, b];
        return;
      }
      if (type === 'submit') {
        if (!a || !b) return 'צריך למלא את שתי האפשרויות';
        g.options = [a, b];
        g.autoOptions = false;
        startVote(room, api);
        return;
      }
    }
    if (g.phase === 'vote' && type === 'vote') {
      if (!g.voters.includes(pid)) return 'הקובע לא מצביע הסיבוב 😉';
      if (data !== 'A' && data !== 'B') return;
      g.votes[pid] = data;
      if (g.voters.filter((id) => api.isConnected(id)).every((id) => g.votes[id])) startGuess(room, api);
      return;
    }
    if (g.phase === 'guess' && type === 'guess') {
      const out = {};
      for (const t of g.targets) {
        if (t !== pid && (data?.[t] === 'A' || data?.[t] === 'B')) out[t] = data[t];
      }
      g.guesses[pid] = out;
      if (guessersPending(g, api).length === 0) reveal(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && !api.isConnected(g.deciderId)) {
      api.clearTimer();
      g.round--;
      return nextRound(room, api);
    }
    if (g.phase === 'vote' && g.voters.filter((id) => api.isConnected(id)).every((id) => g.votes[id])) {
      return startGuess(room, api);
    }
    if (g.phase === 'guess' && guessersPending(g, api).length === 0) reveal(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      deciderId: g.deciderId,
      isDecider: pid === g.deciderId,
      options: g.phase === 'write' ? null : g.options,
      autoOptions: !!g.autoOptions,
      voterIds: g.voters || [],
      votedIds: Object.keys(g.votes),
      myVote: g.votes[pid] || null,
    };
    if (g.phase === 'guess' || g.phase === 'reveal') {
      const vals = Object.values(g.votes);
      v.counts = { A: vals.filter((x) => x === 'A').length, B: vals.filter((x) => x === 'B').length };
      v.targets = g.targets || [];
      v.guessedIds = Object.keys(g.guesses);
      v.myGuesses = g.guesses[pid] || null;
    }
    if (g.phase === 'reveal') {
      v.votes = g.votes;
      v.correct = g.correct;
      v.roundPoints = g.roundPoints;
      v.myGuesses = g.guesses[pid] || {};
    }
    return v;
  },
};
