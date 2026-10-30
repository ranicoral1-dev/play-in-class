// משחק: מה חושבים עליך - כולם עונים על שאלה על שחקן אחד, והוא חושף רק את הכותב של תשובה אחת
import { shuffle, clampInt, cleanText, sanitizeTimes } from '../utils.js';
import { ABOUT_QUESTIONS } from './content.js';

const TIMES = { write: 60, pick: 45 };
const POINTS = 2; // לכותב של התשובה שנבחרה

// שורה לכל שאלה; {name} מוחלף בשם. שאלה בלי {name} מקבלת את השם בסוף
function parseCustom(text) {
  return String(text ?? '')
    .split('\n')
    .map((s) => cleanText(s, 140))
    .filter(Boolean)
    .map((s) => (s.includes('{name}') ? s : `${s} ({name})`))
    .slice(0, 200);
}

function nextQuestion(g) {
  if (!g.deck.length) g.deck = shuffle(g.pool);
  return g.deck.pop();
}

const writers = (room, api) => api.activeIds().filter((id) => id !== room.game.subject);
const randomIdx = (g) => Math.floor(Math.random() * g.list.length);

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const n = g.order.length;
  let subject = null;
  for (let k = 0; k < n && !subject; k++) {
    const id = g.order[(g.round - 1 + k) % n];
    if (api.isConnected(id)) subject = id;
  }
  if (!subject || api.activeIds().length < 2) return api.endGame();
  Object.assign(g, { phase: 'write', subject, template: nextQuestion(g), answers: {}, drafts: {}, list: [], picked: null, randomPick: false });
  api.setTimer(api.time('write'), () => toPick(room, api));
}

function toPick(room, api) {
  const g = room.game;
  for (const id of writers(room, api)) {
    if (!g.answers[id] && g.drafts[id]) g.answers[id] = g.drafts[id];
  }
  // סדר אקראי, והכותבים נשמרים רק בשרת
  g.list = shuffle(Object.entries(g.answers).map(([author, text]) => ({ author, text })));
  if (!g.list.length) return reveal(room, api, null);
  g.phase = 'pick';
  if (!api.isConnected(g.subject)) return reveal(room, api, randomIdx(g), true);
  api.setTimer(api.time('pick'), () => reveal(room, api, randomIdx(g), true));
}

function reveal(room, api, idx, random = false) {
  const g = room.game;
  g.phase = 'reveal';
  g.picked = idx;
  g.randomPick = random;
  if (idx != null) api.addScore(g.list[idx].author, POINTS);
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

export default {
  id: 'about',
  minPlayers: 3,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 1),
      builtin: s.builtin !== false,
      // נשאר סודי (ראו publicSettings). ב״משחקים שוב״ הוא לא מגיע - ואז נשארות השאלות מהפעם הקודמת
      customWords: s.customWords == null ? null : String(s.customWords).slice(0, 8000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    if (room.settings.customWords != null) room.aboutCustom = parseCustom(room.settings.customWords);
    const custom = room.aboutCustom || [];
    g.pool = [...(room.settings.builtin || !custom.length ? ABOUT_QUESTIONS : []), ...custom];
    g.deck = [];
    g.order = shuffle(g.participants);
    g.round = 0;
    g.totalRounds = room.settings.rounds * g.order.length;
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (g.phase !== 'reveal' || !(api.isHost(pid) || pid === g.subject)) return;
      return nextRound(room, api);
    }
    if (g.phase === 'write' && pid !== g.subject) {
      if (type === 'draft') {
        g.drafts[pid] = cleanText(data, 120);
        return;
      }
      if (type === 'write') {
        const text = cleanText(data, 120);
        if (!text) return 'צריך לכתוב משהו';
        g.answers[pid] = text;
        if (writers(room, api).every((id) => g.answers[id])) toPick(room, api);
        return;
      }
    }
    if (g.phase === 'pick' && type === 'pick' && pid === g.subject) {
      const idx = clampInt(data, 0, g.list.length - 1, null);
      if (idx === null) return;
      return reveal(room, api, idx);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && writers(room, api).every((id) => g.answers[id])) toPick(room, api);
    else if (g.phase === 'pick' && !api.isConnected(g.subject)) reveal(room, api, randomIdx(g), true);
  },

  view(room, pid, api) {
    const g = room.game;
    const name = room.players.find((p) => p.id === g.subject)?.name || '?';
    const amSubject = pid === g.subject;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      subject: g.subject,
      amSubject,
      // מי שהשאלה עליו מגלה אותה רק כשהתשובות נחשפות
      question: amSubject && g.phase === 'write' ? null : g.template.replace(/\{name\}/g, name),
    };
    if (g.phase === 'write') {
      v.myAnswer = g.answers[pid] ?? null;
      v.writerIds = writers(room, api);
      v.submittedIds = Object.keys(g.answers);
    } else {
      v.answers = g.list.map((a, i) => ({ idx: i, text: a.text, mine: a.author === pid }));
      v.picked = g.picked;
      v.randomPick = g.randomPick;
      if (g.phase === 'reveal' && g.picked != null) v.author = g.list[g.picked].author;
    }
    return v;
  },
};
