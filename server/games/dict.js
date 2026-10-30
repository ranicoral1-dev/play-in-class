// משחק: מילון מזויף - כולם ממציאים הגדרה למילה נדירה, ומנסים למצוא את האמיתית
import { shuffle, clampInt, cleanText, normalize, sanitizeTimes } from '../utils.js';
import { DICT_WORDS } from './content.js';

const TIMES = { write: 60, vote: 45 };
const MAX_LEN = 120;
const REAL_POINTS = 2; // למי שמצא את ההגדרה האמיתית
const FOOL_POINTS = 1; // לכותב, על כל מי שבחר בהגדרה המזויפת שלו

// שורה לכל מילה: ״מילה - הגדרה״ (גם : או = או פסיק מפרידים)
function parseCustom(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => /^\s*([^,:=\-–]+?)\s*[,:=\-–]\s*(.+)$/.exec(line))
    .filter(Boolean)
    .map((m) => [cleanText(m[1], 30), cleanText(m[2], MAX_LEN)])
    .filter(([w, d]) => w && d)
    .slice(0, 200);
}

const writers = (room, api) => api.activeIds();
const voters = (room, api) => api.activeIds();

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds || !g.deck.length) return api.endGame();
  const [word, real] = g.deck.pop();
  Object.assign(g, { phase: 'write', word, real, answers: {}, drafts: {}, list: [], votes: {}, points: {} });
  api.setTimer(api.time('write'), () => toVote(room, api));
}

function toVote(room, api) {
  const g = room.game;
  for (const id of writers(room, api)) {
    if (!g.answers[id] && g.drafts[id]) g.answers[id] = g.drafts[id];
  }
  // ההגדרה האמיתית מעורבבת עם המזויפות (author = null)
  g.list = shuffle([{ author: null, text: g.real }, ...Object.entries(g.answers).map(([author, text]) => ({ author, text }))]);
  g.phase = 'vote';
  api.setTimer(api.time('vote'), () => reveal(room, api));
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  const add = (id, pts) => {
    g.points[id] = (g.points[id] || 0) + pts;
    api.addScore(id, pts);
  };
  for (const [voter, idx] of Object.entries(g.votes)) {
    const author = g.list[idx].author;
    if (author === null) add(voter, REAL_POINTS);
    else if (author !== voter) add(author, FOOL_POINTS);
  }
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

export default {
  id: 'dict',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 20, 5),
      builtin: s.builtin !== false,
      // נשאר סודי (ראו publicSettings) - אחרת כולם היו רואים את ההגדרות האמיתיות
      customWords: s.customWords == null ? null : String(s.customWords).slice(0, 12000),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    if (room.settings.customWords != null) room.dictCustom = parseCustom(room.settings.customWords);
    const custom = room.dictCustom || [];
    // קודם המילים שלכם (pop לוקח מהסוף), ואחריהן של המשחק
    const builtin = room.settings.builtin || !custom.length ? shuffle(DICT_WORDS) : [];
    g.deck = [...builtin, ...shuffle(custom)];
    g.round = 0;
    g.totalRounds = Math.min(room.settings.rounds, g.deck.length);
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'reveal') return;
      return nextRound(room, api);
    }
    if (g.phase === 'write') {
      const text = cleanText(data, MAX_LEN);
      if (type === 'draft') {
        g.drafts[pid] = text;
        return;
      }
      if (type === 'write') {
        if (!text) return 'צריך לכתוב הגדרה';
        if (normalize(text) === normalize(g.real)) return 'כתבת בדיוק את ההגדרה האמיתית! 😮 תמציאו משהו אחר';
        const dup = Object.entries(g.answers).some(([id, t]) => id !== pid && normalize(t) === normalize(text));
        if (dup) return 'מישהו כבר כתב בדיוק את זה - תמציאו משהו אחר';
        g.answers[pid] = text;
        if (writers(room, api).every((id) => g.answers[id])) toVote(room, api);
        return;
      }
    }
    if (g.phase === 'vote' && type === 'vote') {
      const idx = clampInt(data, 0, g.list.length - 1, null);
      if (idx === null || g.list[idx].author === pid) return;
      g.votes[pid] = idx;
      if (voters(room, api).every((id) => g.votes[id] != null)) reveal(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && writers(room, api).every((id) => g.answers[id])) toVote(room, api);
    else if (g.phase === 'vote' && voters(room, api).every((id) => g.votes[id] != null)) reveal(room, api);
  },

  view(room, pid, api) {
    const g = room.game;
    const v = { phase: g.phase, round: g.round, totalRounds: g.totalRounds, word: g.word };
    if (g.phase === 'write') {
      v.myAnswer = g.answers[pid] ?? null;
      v.writerIds = writers(room, api);
      v.submittedIds = Object.keys(g.answers);
      return v;
    }
    const shown = g.phase === 'reveal';
    v.list = g.list.map((e, i) => ({
      text: e.text,
      mine: e.author === pid,
      real: shown ? e.author === null : undefined,
      author: shown ? e.author : undefined,
      voters: shown ? Object.keys(g.votes).filter((id) => g.votes[id] === i) : undefined,
    }));
    v.myVote = g.votes[pid] ?? null;
    v.voterIds = voters(room, api);
    v.votedIds = Object.keys(g.votes);
    if (shown) v.points = g.points;
    return v;
  },
};
