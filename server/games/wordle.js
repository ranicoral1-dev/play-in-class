// משחק 2: נחש את המילה (וורדל תחרותי)
import { shuffle, pick, clampInt, hebrewLetters, rawHebrewLetters, sanitizeTimes } from '../utils.js';
import { WORDS } from './content.js';

const TIMES = { secret: 45, guess: 120 };

// guess ו-secret מנורמלים (סופיות = רגילות). אות שנמצאת במילה במקום אחר שעוד לא נפתר
// תמיד צהובה - גם אם היא מופיעה פעמיים בניחוש
function colorize(guess, secret) {
  const green = guess.map((ch, i) => ch === secret[i]);
  const open = new Set(secret.filter((_, i) => !green[i]));
  return guess.map((ch, i) => (green[i] ? 'green' : open.has(ch) ? 'yellow' : 'gray'));
}

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  Object.assign(g, { phase: 'secret', secrets: {}, secretNorm: {}, autoSecret: {}, boards: {}, solveOrder: [], roundPoints: {} });
  api.setTimer(api.time('secret'), () => startGuess(room, api));
}

function startGuess(room, api) {
  const g = room.game;
  const len = room.settings.wordLength;
  for (const id of g.order) {
    if (!g.secrets[id]) {
      g.secrets[id] = pick(WORDS[len]);
      g.secretNorm[id] = hebrewLetters(g.secrets[id]).join('');
      g.autoSecret[id] = true;
    }
  }
  // כל שחקן מנחש את המילה של שחקן אחר, בהיסט שמתחלף כל סיבוב
  const n = g.order.length;
  const offset = 1 + ((g.round - 1) % (n - 1));
  g.order.forEach((id, i) => {
    const owner = g.order[(i + offset) % n];
    g.boards[id] = { owner, guesses: [], solved: false, greens: new Set() };
  });
  g.phase = 'guess';
  g.guessStart = Date.now();
  api.setTimer(api.time('guess'), () => finishRound(room, api));
}

function boardDone(b, max) {
  return b.solved || b.guesses.length >= max;
}

function allDone(room, api) {
  const g = room.game;
  return api.activeIds().every((id) => boardDone(g.boards[id], room.settings.maxGuesses));
}

function finishRound(room, api) {
  const g = room.game;
  const n = g.order.length;
  g.phase = 'reveal';
  if (g.solveOrder.length > 0) {
    // הכי מהיר מקבל הכי הרבה
    g.solveOrder.forEach((id, idx) => {
      g.roundPoints[id] = Math.max(1, n - idx);
    });
  } else {
    // אף אחד לא פתר - דירוג לפי כמות האותיות הירוקות
    const levels = [...new Set(g.order.map((id) => g.boards[id].greens.size).filter((x) => x > 0))].sort((a, b) => b - a);
    for (const id of g.order) {
      const gr = g.boards[id].greens.size;
      if (gr > 0) g.roundPoints[id] = levels.length - levels.indexOf(gr);
    }
  }
  for (const [id, pts] of Object.entries(g.roundPoints)) api.addScore(id, pts);
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

function validWord(word, len) {
  const letters = hebrewLetters(word);
  if (letters.length !== len) return { error: `המילה צריכה להיות בת ${len} אותיות בעברית` };
  return { letters, raw: rawHebrewLetters(word) };
}

export default {
  id: 'wordle',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 3),
      wordLength: clampInt(s.wordLength, 3, 6, 5),
      maxGuesses: clampInt(s.maxGuesses, 3, 10, 6),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.order = shuffle(g.participants);
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    const { wordLength, maxGuesses } = room.settings;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'reveal') return;
      return nextRound(room, api);
    }
    if (g.phase === 'secret' && type === 'secret') {
      const r = validWord(data, wordLength);
      if (r.error) return r.error;
      g.secrets[pid] = r.raw.join('');
      g.secretNorm[pid] = r.letters.join('');
      if (api.activeIds().every((id) => g.secrets[id])) startGuess(room, api);
      return;
    }
    if (g.phase === 'guess' && type === 'guess') {
      const b = g.boards[pid];
      if (!b || boardDone(b, maxGuesses)) return 'סיימת את הניחושים לסיבוב הזה';
      const r = validWord(data, wordLength);
      if (r.error) return r.error;
      const secret = g.secretNorm[b.owner].split('');
      const colors = colorize(r.letters, secret);
      colors.forEach((c, i) => c === 'green' && b.greens.add(i));
      b.guesses.push({ letters: r.raw, colors });
      if (colors.every((c) => c === 'green')) {
        b.solved = true;
        b.solvedIn = Math.round((Date.now() - g.guessStart) / 1000);
        g.solveOrder.push(pid);
      }
      if (allDone(room, api)) finishRound(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'secret' && api.activeIds().every((id) => g.secrets[id])) startGuess(room, api);
    else if (g.phase === 'guess' && allDone(room, api)) finishRound(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const { maxGuesses } = room.settings;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      wordLength: room.settings.wordLength,
      maxGuesses,
      submittedIds: Object.keys(g.secrets).filter((id) => !g.autoSecret[id]),
      mySecret: g.secrets[pid] || null,
    };
    if (g.phase === 'guess' || g.phase === 'reveal') {
      const b = g.boards[pid];
      v.myBoard = b && {
        owner: b.owner,
        guesses: b.guesses,
        solved: b.solved,
        done: boardDone(b, maxGuesses),
      };
      v.boards = g.order.map((id) => {
        const ob = g.boards[id];
        return {
          id,
          owner: ob.owner,
          colors: ob.guesses.map((x) => x.colors),
          solved: ob.solved,
          solvedIn: ob.solvedIn,
          done: boardDone(ob, maxGuesses),
          greens: ob.greens.size,
        };
      });
      v.solveOrder = g.solveOrder;
    }
    if (g.phase === 'reveal') {
      v.secrets = g.secrets;
      v.autoSecret = g.autoSecret;
      v.roundPoints = g.roundPoints;
    }
    return v;
  },
};
