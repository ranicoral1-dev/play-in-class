// משחק: ארץ עיר - אות אקראית, ממלאים קטגוריות, פוסלים תשובות לא נכונות וסופרים נקודות
import { shuffle, clampInt, cleanText, normalize, fuzzyEqual, sanitizeTimes } from '../utils.js';
import { ERETZ_CATEGORIES } from './content.js';

const TIMES = { write: 90, review: 45 };
const STOP_SEC = 3; // אחרי ״סטופ!״ יש לכולם עוד רגע לסיים את המילה
const RESULTS_SEC = 20;
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
const MAX_LEN = 30;

function parseCategories(text) {
  return String(text ?? '')
    .split(/[\n,]/)
    .map((s) => cleanText(s, 24))
    .filter(Boolean)
    .slice(0, 12);
}

const startsWith = (answer, letter) => normalize(answer).replace(/[^א-ת]/g, '')[0] === letter;

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  if (!g.letters.length) g.letters = shuffle(LETTERS);
  Object.assign(g, {
    phase: 'write',
    letter: g.letters.pop(),
    answers: {},
    done: [],
    stoppedBy: null,
    rejects: {},
    reviewed: [],
    points: {},
    totals: {},
  });
  api.setTimer(api.time('write'), () => toReview(room, api));
}

function toReview(room, api) {
  const g = room.game;
  g.phase = 'review';
  const anything = Object.values(g.answers).some((a) => a.some(Boolean));
  if (!anything) return score(room, api);
  api.setTimer(api.time('review'), () => score(room, api));
}

// key של תשובה: שחקן + קטגוריה
const key = (pid, ci) => `${pid}:${ci}`;

// תשובה נפסלת אם היא לא מתחילה באות, או שרוב השופטים (כל השאר) פסלו אותה
function isValid(room, api, pid, ci) {
  const g = room.game;
  const a = g.answers[pid]?.[ci];
  if (!a || !startsWith(a, g.letter)) return false;
  const judges = api.activeIds().filter((id) => id !== pid).length;
  const rejects = (g.rejects[key(pid, ci)] || []).length;
  return !(judges > 0 && rejects * 2 > judges);
}

function score(room, api) {
  const g = room.game;
  g.phase = 'results';
  const ids = g.participants;
  g.cats.forEach((_, ci) => {
    const valid = ids.filter((id) => isValid(room, api, id, ci));
    for (const id of ids) {
      if (!valid.includes(id)) {
        (g.points[id] ||= [])[ci] = 0;
        continue;
      }
      const mine = g.answers[id][ci];
      const same = valid.some((o) => o !== id && fuzzyEqual(g.answers[o][ci], mine));
      // 15 - רק לך יש תשובה בקטגוריה, 10 - תשובה שרק לך, 5 - עוד מישהו כתב אותו דבר
      const pts = valid.length === 1 ? 15 : same ? 5 : 10;
      (g.points[id] ||= [])[ci] = pts;
    }
  });
  for (const id of ids) {
    g.totals[id] = (g.points[id] || []).reduce((s, x) => s + (x || 0), 0);
    api.addScore(id, g.totals[id]);
  }
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => nextRound(room, api));
}

function cleanAnswers(g, data) {
  return g.cats.map((_, i) => cleanText(Array.isArray(data) ? data[i] : '', MAX_LEN));
}

export default {
  id: 'eretz',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 20, 5),
      stop: s.stop !== false,
      customCategories: String(s.customCategories ?? '').slice(0, 1000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    const custom = parseCategories(room.settings.customCategories);
    g.cats = custom.length ? custom : ERETZ_CATEGORIES;
    g.letters = [];
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return nextRound(room, api);
    }
    if (g.phase === 'write') {
      // הטיוטה נשמרת כל הזמן, כך שכשהזמן נגמר או שמישהו אמר סטופ - מה שכתבתם נכנס
      if (type === 'draft') {
        g.answers[pid] = cleanAnswers(g, data);
        return;
      }
      if (type === 'done' || type === 'stop') {
        const answers = cleanAnswers(g, data);
        g.answers[pid] = answers;
        if (type === 'stop' && room.settings.stop && !g.stoppedBy) {
          if (answers.some((a) => !a)) return 'כדי להגיד סטופ צריך למלא את כל הקטגוריות';
          if (answers.some((a) => !startsWith(a, g.letter))) return `כל התשובות צריכות להתחיל באות ${g.letter}`;
          g.stoppedBy = pid;
          if (!g.done.includes(pid)) g.done.push(pid);
          api.setTimer(STOP_SEC, () => toReview(room, api));
          return;
        }
        if (!g.done.includes(pid)) g.done.push(pid);
        if (!g.stoppedBy && api.activeIds().every((id) => g.done.includes(id))) toReview(room, api);
        return;
      }
      if (type === 'edit') {
        g.done = g.done.filter((id) => id !== pid);
        return;
      }
    }
    if (g.phase === 'review') {
      if (type === 'reject') {
        const owner = String(data?.pid ?? '');
        const ci = clampInt(data?.ci, 0, g.cats.length - 1, null);
        if (ci === null || owner === pid || !g.answers[owner]?.[ci]) return;
        const k = key(owner, ci);
        const list = g.rejects[k] || [];
        g.rejects[k] = list.includes(pid) ? list.filter((id) => id !== pid) : [...list, pid];
        return;
      }
      if (type === 'reviewed') {
        if (!g.reviewed.includes(pid)) g.reviewed.push(pid);
        if (api.activeIds().every((id) => g.reviewed.includes(id))) score(room, api);
      }
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && !g.stoppedBy && api.activeIds().every((id) => g.done.includes(id))) toReview(room, api);
    else if (g.phase === 'review' && api.activeIds().every((id) => g.reviewed.includes(id))) score(room, api);
  },

  view(room, pid, api) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      letter: g.letter,
      cats: g.cats,
      stoppedBy: g.stoppedBy,
      playerIds: api.activeIds(),
    };
    if (g.phase === 'write') {
      v.mine = g.answers[pid] || null;
      v.doneIds = g.done;
      v.amDone = g.done.includes(pid);
      return v;
    }
    // בבדיקה ובתוצאות כולם רואים את כל התשובות
    const ids = g.participants.filter((id) => g.answers[id]?.some(Boolean));
    v.rows = ids.map((id) => ({
      pid: id,
      answers: g.cats.map((_, ci) => {
        const a = g.answers[id][ci];
        return {
          text: a,
          wrongLetter: !!a && !startsWith(a, g.letter),
          rejects: g.rejects[key(id, ci)] || [],
          valid: g.phase === 'results' ? isValid(room, api, id, ci) : undefined,
          points: g.phase === 'results' ? g.points[id]?.[ci] ?? 0 : undefined,
        };
      }),
    }));
    if (g.phase === 'review') {
      v.reviewedIds = g.reviewed;
      v.amReviewed = g.reviewed.includes(pid);
    } else {
      v.totals = g.totals;
    }
    return v;
  },
};
