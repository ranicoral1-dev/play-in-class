// משחק: מטבע הסודות - הבוחר עונה על שאלה סודית בשם של שחקן, ומטבע מחליט אם השאלה תיחשף
// במצב ״שחקן כותב״: בכל תור שחקן אחר כותב את השאלה, ולא משתתף בתור (רק צופה)
import { shuffle, pick, clampInt, cleanText, sanitizeTimes } from '../utils.js';
import { COIN_QUESTIONS } from './content.js';

const TIMES = { ask: 45, choose: 30, call: 15 };
const FLIP_SEC = 3; // האנימציה של המטבע
const RESULT_SEC = 10;

function parseCustom(text) {
  return String(text ?? '')
    .split('\n')
    .map((s) => cleanText(s, 120))
    .filter(Boolean)
    .slice(0, 200);
}

// שאלות בלי חזרות עד שנגמרת החבילה
function nextQuestion(g) {
  if (!g.deck.length) g.deck = shuffle(g.pool);
  return g.deck.pop();
}

function nextTurn(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const n = g.order.length;
  let chooser = null;
  for (let k = 0; k < n && !chooser; k++) {
    const id = g.order[(g.round - 1 + k) % n];
    if (api.isConnected(id)) chooser = id;
  }
  if (!chooser) return api.endGame();
  // הכותב: הבא בתור אחרי הבוחר. צריך לפחות עוד שחקן אחד שאפשר לבחור בו
  let asker = null;
  if (room.settings.asker && api.activeIds().length >= 3) {
    const start = g.order.indexOf(chooser);
    for (let k = 1; k < n && !asker; k++) {
      const id = g.order[(start + k) % n];
      if (api.isConnected(id)) asker = id;
    }
  }
  Object.assign(g, { chooser, asker, target: null, call: null, coin: null, won: null, question: null, autoQuestion: false });
  if (asker) {
    g.phase = 'ask';
    api.setTimer(api.time('ask'), () => toChoose(room, api, null));
  } else toChoose(room, api, null);
}

// בלי שאלה מהכותב (אין כותב, נגמר הזמן או שהתנתק) - שאלה של המשחק
function toChoose(room, api, question) {
  const g = room.game;
  g.autoQuestion = !question && !!g.asker;
  g.question = question || nextQuestion(g);
  g.phase = 'choose';
  api.setTimer(api.time('choose'), () => choose(room, api, pick(targets(room, api))));
}

const targets = (room, api) => api.activeIds().filter((id) => id !== room.game.asker);

function choose(room, api, target) {
  const g = room.game;
  g.target = target;
  g.phase = 'call';
  api.addScore(target, 1);
  api.setTimer(api.time('call'), () => flip(room, api, pick(['heads', 'tails'])));
}

function flip(room, api, call) {
  const g = room.game;
  g.call = call;
  g.coin = Math.random() < 0.5 ? 'heads' : 'tails';
  g.won = g.coin === call;
  g.phase = 'flip';
  g.history.unshift({ chooser: g.chooser, asker: g.asker, target: g.target, won: g.won, question: g.won ? null : g.question });
  api.setTimer(room.settings.timed ? FLIP_SEC + RESULT_SEC : null, () => nextTurn(room, api));
}

export default {
  id: 'coin',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 2),
      asker: s.asker !== false,
      builtin: s.builtin !== false,
      // נשאר סודי (ראו publicSettings) - אחרת כולם היו רואים את השאלות
      customWords: s.customWords == null ? null : String(s.customWords).slice(0, 8000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    if (room.settings.customWords != null) room.coinCustom = parseCustom(room.settings.customWords);
    const custom = room.coinCustom || [];
    g.pool = [...(room.settings.builtin || !custom.length ? COIN_QUESTIONS : []), ...custom];
    g.deck = [];
    g.order = shuffle(g.participants);
    g.round = 0;
    g.totalRounds = room.settings.rounds * g.order.length;
    g.history = [];
    nextTurn(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (g.phase !== 'flip' || !(api.isHost(pid) || pid === g.chooser)) return;
      return nextTurn(room, api);
    }
    if (g.phase === 'ask' && type === 'ask') {
      if (pid !== g.asker) return 'זה לא התור שלך';
      const text = cleanText(data, 120);
      if (!text) return 'צריך לכתוב שאלה';
      return toChoose(room, api, text);
    }
    if (pid !== g.chooser) return 'זה לא התור שלך';
    if (g.phase === 'choose' && type === 'choose') {
      if (!g.participants.includes(data) || data === g.asker) return 'אי אפשר לבחור בשחקן הזה';
      return choose(room, api, data);
    }
    if (g.phase === 'call' && type === 'call') {
      if (data !== 'heads' && data !== 'tails') return;
      return flip(room, api, data);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'ask') {
      if (!api.isConnected(g.asker)) toChoose(room, api, null);
      return;
    }
    if (api.isConnected(g.chooser)) return;
    if (g.phase === 'choose') choose(room, api, pick(targets(room, api)));
    if (g.phase === 'call') flip(room, api, pick(['heads', 'tails']));
  },

  view(room, pid) {
    const g = room.game;
    const revealed = g.phase === 'flip' && !g.won;
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      chooser: g.chooser,
      asker: g.asker,
      autoQuestion: g.autoQuestion,
      target: g.target,
      call: g.call,
      coin: g.coin,
      won: g.won,
      // השאלה רק אצל הבוחר (והכותב שלה), עד שהמטבע מחליט אחרת
      question: pid === g.chooser || pid === g.asker || revealed ? g.question : null,
      history: g.history.slice(g.phase === 'flip' ? 1 : 0, 12),
    };
  },
};
