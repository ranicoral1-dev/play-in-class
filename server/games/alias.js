// משחק 11: אליאס
import { shuffle, clampInt, sanitizeTimes, cleanText, normalize, stem, fuzzyEqual } from '../utils.js';
import { ALIAS_WORDS } from './wordlists.js';

const TIMES = { teams: 60, turn: 60 };
const CARD = 8; // 8 מילים בכרטיס, והלוח ממוספר 1-8 שוב ושוב
const CHAT_MAX = 80;
const DEFAULT_NAMES = ['האדומים', 'הכחולים', 'הירוקים', 'הצהובים'];
const PREFIXES = 'והבכלמש';

const WORDS = ALIAS_WORDS.map((s) => {
  const [he, en, root] = s.split(':');
  // אותיות אהו״י לא נחשבות בשורש, כדי ש״סיפור״ ו״ספר״ ייתפסו יחד
  const r = root ? root.replace(/[וי]/g, '') : '';
  return { he, en: en?.toLowerCase(), root: r.length >= 3 ? r : null };
});

function newCard(g) {
  if (g.deck.length < CARD) g.deck = shuffle(WORDS.map((_, i) => i));
  g.card = g.deck.splice(0, CARD);
}

const square = (pos) => (pos % CARD) + 1;
const currentWord = (g) => WORDS[g.card[square(g.teams[g.cur].pos) - 1]];

// האם המסביר השתמש במילה, בשורש שלה או במילה באנגלית
function violates(text, w) {
  const norm = normalize(text);
  const tokens = norm.split(/[^א-תa-z]+/).filter(Boolean);
  const word = normalize(w.he);
  if (word.includes(' ') && norm.includes(word)) return true;
  for (const t of tokens) {
    if (w.en && (t === w.en || (w.en.length >= 4 && t.startsWith(w.en)))) return true;
    // גם בלי אותיות שימוש בהתחלה: ״והכלב״, ״לכלב״
    const forms = [t];
    for (let i = 0; i < 2 && forms[i].length > 2 && PREFIXES.includes(forms[i][0]); i++) forms.push(forms[i].slice(1));
    for (const part of word.split(' ')) {
      if (part.length < 2) continue;
      if (forms.some((f) => f === part || stem(f) === stem(part) || (part.length >= 3 && f.includes(part)))) return true;
    }
    if (w.root && t.replace(/[וי]/g, '').includes(w.root)) return true;
  }
  return false;
}

// קבוצות מאוזנות: הפרש של שחקן אחד לכל היותר, ולפחות 2 בכל קבוצה
function balanced(g) {
  const sizes = g.teams.map((t) => t.members.length);
  return Math.min(...sizes) >= 2 && Math.max(...sizes) - Math.min(...sizes) <= 1;
}

function removeFromTeams(g, pid) {
  for (const t of g.teams) t.members = t.members.filter((id) => id !== pid);
}

function shuffleTeams(g, api) {
  g.teams.forEach((t) => (t.members = []));
  shuffle(g.participants.filter((id) => api.isConnected(id))).forEach((id, i) => g.teams[i % g.teams.length].members.push(id));
}

// כשנגמר הזמן לבחירה: מעבירים שחקנים מהקבוצה הגדולה לקטנה עד שמאוזן
function fixBalance(g) {
  for (let guard = 0; guard < 50 && !balanced(g); guard++) {
    const bySize = [...g.teams].sort((a, b) => b.members.length - a.members.length);
    const big = bySize[0];
    const small = bySize[bySize.length - 1];
    small.members.push(big.members.pop());
  }
}

function addTeamScore(api, team, n) {
  team.members.forEach((id) => api.addScore(id, n));
}

function move(room, api, delta) {
  const g = room.game;
  const team = g.teams[g.cur];
  const before = team.pos;
  team.pos = Math.max(0, Math.min(g.target, team.pos + delta));
  addTeamScore(api, team, team.pos - before);
  if (team.pos >= g.target) return endTurn(room, api);
  newCard(g);
}

function say(g, msg) {
  g.chat.push({ id: ++g.chatSeq, ...msg });
  if (g.chat.length > CHAT_MAX) g.chat.shift();
}

// מי מסביר: מי שהסביר הכי מעט פעמים בקבוצה, לפי הסדר
function pickTeller(g, api) {
  const team = g.teams[g.cur];
  const n = team.members.length;
  let best = null;
  for (let k = 0; k < n; k++) {
    const id = team.members[(team.next + k) % n];
    if (!api.isConnected(id)) continue;
    if (best === null || (team.tells[id] || 0) < (team.tells[best] || 0)) best = id;
  }
  return best;
}

function startPlay(room, api) {
  const g = room.game;
  api.clearTimer();
  fixBalance(g);
  g.teams.forEach((t) => {
    t.next = 0;
    t.tells = {};
  });
  // כל שחקן מסביר אותו מספר פעמים: סבבים = פעמים לכל שחקן × גודל הקבוצה הכי גדולה
  g.totalRounds = room.settings.turnsPerPlayer * Math.max(...g.teams.map((t) => t.members.length));
  g.round = 1;
  g.cur = -1;
  nextTurn(room, api);
}

function nextTurn(room, api) {
  const g = room.game;
  for (let tries = 0; tries < g.teams.length; tries++) {
    g.cur++;
    if (g.cur >= g.teams.length) {
      g.cur = 0;
      g.round++;
      // הסבב נגמר - כל הקבוצות שיחקו אותו מספר תורות
      if (g.round > g.totalRounds || g.teams.some((t) => t.pos >= g.target)) return finish(room, api);
    }
    const teller = pickTeller(g, api);
    if (!teller) continue;
    const team = g.teams[g.cur];
    team.tells[teller] = (team.tells[teller] || 0) + 1;
    team.next = (team.members.indexOf(teller) + 1) % team.members.length;
    g.teller = teller;
    g.phase = 'ready';
    g.chat = [];
    g.turn = { words: [] };
    newCard(g);
    api.setTimer(api.revealTime(), () => beginTurn(room, api));
    return;
  }
  finish(room, api);
}

function beginTurn(room, api) {
  const g = room.game;
  g.phase = 'turn';
  say(g, { kind: 'system', text: 'הזמן התחיל! ⏱️' });
  api.setTimer(api.time('turn'), () => endTurn(room, api));
}

function endTurn(room, api) {
  const g = room.game;
  if (g.phase !== 'turn' && g.phase !== 'ready') return;
  g.phase = 'summary';
  api.setTimer(api.revealTime(), () => nextTurn(room, api));
}

function finish(room, api) {
  const g = room.game;
  // בונוס לקבוצה שהגיעה הכי רחוק
  const best = Math.max(...g.teams.map((t) => t.pos));
  g.teams.filter((t) => t.pos === best && best > 0).forEach((t) => addTeamScore(api, t, 5));
  api.endGame();
}

export default {
  id: 'alias',
  minPlayers: 4,

  sanitize(s, playerCount) {
    return {
      teams: clampInt(s.teams, 2, Math.max(2, Math.min(4, Math.floor(playerCount / 2))), 2),
      turnsPerPlayer: clampInt(s.turnsPerPlayer, 1, 10, 2),
      laps: clampInt(s.laps, 1, 10, 4),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    const count = Math.min(room.settings.teams, Math.floor(g.participants.length / 2));
    Object.assign(g, {
      phase: 'teams',
      teams: Array.from({ length: count }, (_, i) => ({ name: DEFAULT_NAMES[i], members: [], pos: 0 })),
      target: room.settings.laps * CARD,
      deck: [],
      card: [],
      chat: [],
      chatSeq: 0,
      round: 0,
      totalRounds: 0,
    });
    shuffleTeams(g, api);
    api.setTimer(api.time('teams'), () => startPlay(room, api));
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'rename') {
      const team = g.teams[data?.team];
      if (!team || team.members[0] !== pid) return 'רק ראש הקבוצה יכול לשנות את השם';
      const name = cleanText(data.name, 20);
      if (name) team.name = name;
      return;
    }

    if (g.phase === 'teams') {
      if (type === 'join') {
        const team = g.teams[data?.team];
        if (!team || team.members.includes(pid)) return;
        removeFromTeams(g, pid);
        team.members.push(pid);
        return;
      }
      if (!api.isHost(pid)) return;
      if (type === 'shuffle') return shuffleTeams(g, api);
      if (type === 'go') {
        if (!balanced(g)) return 'הקבוצות לא מאוזנות - צריך לפחות 2 בכל קבוצה והפרש של שחקן אחד לכל היותר';
        return startPlay(room, api);
      }
      return;
    }

    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'summary') return;
      api.clearTimer();
      return nextTurn(room, api);
    }

    if (type === 'begin') {
      if (g.phase !== 'ready' || pid !== g.teller) return;
      api.clearTimer();
      return beginTurn(room, api);
    }

    if (g.phase !== 'turn') return;
    const team = g.teams[g.cur];
    if (!team.members.includes(pid)) return 'רק הקבוצה שבתור יכולה לכתוב כאן';
    const word = currentWord(g);

    if (pid === g.teller) {
      if (type === 'skip') {
        g.turn.words.push({ word: word.he, result: 'skip' });
        say(g, { kind: 'skip', pid, word: word.he });
        return move(room, api, -1);
      }
      if (type === 'done') return endTurn(room, api);
      if (type !== 'msg') return;
      const text = cleanText(data, 120);
      if (!text) return;
      if (violates(text, word)) {
        g.turn.words.push({ word: word.he, result: 'foul' });
        say(g, { kind: 'foul', pid, word: word.he });
        return move(room, api, -1);
      }
      say(g, { kind: 'clue', pid, text });
      return;
    }

    if (type !== 'msg') return;
    const text = cleanText(data, 60);
    if (!text) return;
    if (fuzzyEqual(text, word.he)) {
      g.turn.words.push({ word: word.he, result: 'correct', by: pid });
      say(g, { kind: 'correct', pid, word: word.he });
      return move(room, api, 1);
    }
    say(g, { kind: 'guess', pid, text });
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'teams') {
      // מי שיצא מהחדר יוצא גם מהקבוצה
      for (const t of g.teams) t.members = t.members.filter((id) => room.players.some((p) => p.id === id));
      return;
    }
    if ((g.phase === 'turn' || g.phase === 'ready') && !api.isConnected(g.teller)) endTurn(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      teams: g.teams.map((t) => ({ name: t.name, members: t.members, pos: t.pos, tells: t.tells })),
      target: g.target,
      cur: g.cur,
      teller: g.teller,
      chat: g.chat,
      myTeam: g.teams.findIndex((t) => t.members.includes(pid)),
    };
    if (g.phase === 'teams') v.balanced = balanced(g);
    if (g.phase !== 'teams') v.square = square(g.teams[g.cur].pos);
    if ((g.phase === 'turn' || g.phase === 'ready') && pid === g.teller) v.card = g.card.map((i) => WORDS[i].he);
    if (g.phase === 'turn' || g.phase === 'summary') v.turn = g.turn;
    return v;
  },
};
