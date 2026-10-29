// משחק 4: סיפור בהמשכים
import { shuffle, clampInt, cleanText, sanitizeTimes } from '../utils.js';

const TIMES = { write: 60, vote: 120 };
const RESULTS_SEC = 30;

function limitWords(text, max) {
  return cleanText(text, 400).split(' ').filter(Boolean).slice(0, max).join(' ');
}

function lastWord(text) {
  const words = text.split(' ').filter(Boolean);
  return (words[words.length - 1] || '').replace(/[.,!?;:"']+$/g, '');
}

// חיבור הקטעים לסיפור אחד בלי לשכפל את מילת החיבור
function storyText(chain) {
  return chain.segments
    .map((s, i) => (i > 0 && s.prompt ? s.body : s.text))
    .filter(Boolean)
    .join(' ');
}

// באיזה סיפור כותב השחקן בסיבוב הנוכחי
function chainIndexFor(g, pid) {
  const i = g.order.indexOf(pid);
  const n = g.order.length;
  return (((i - (g.round - 1)) % n) + n) % n;
}

function promptFor(g, pid) {
  if (g.round === 1) return null;
  const chain = g.chains[chainIndexFor(g, pid)];
  const last = chain.segments[chain.segments.length - 1];
  return last ? lastWord(last.text) : null;
}

function startRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return startVote(room, api);
  g.phase = 'write';
  g.texts = {};
  g.drafts = {};
  api.setTimer(api.time('write'), () => endWriting(room, api));
}

// סוף סבב כתיבה: כל הקטעים נכנסים לסיפורים בבת אחת (עד אז אפשר לערוך)
function endWriting(room, api) {
  const g = room.game;
  for (const id of g.order) commit(room, id, g.texts[id] ?? g.drafts[id] ?? '');
  startRound(room, api);
}

function commit(room, pid, text) {
  const g = room.game;
  const body = limitWords(text, room.settings.maxWords);
  const prompt = promptFor(g, pid);
  let full = prompt ? `${prompt} ${body}`.trim() : body;
  if (!full) full = '...';
  g.chains[chainIndexFor(g, pid)].segments.push({ pid, text: full, body, prompt });
}

function startVote(room, api) {
  const g = room.game;
  g.phase = 'vote';
  g.round = g.totalRounds;
  g.ratings = {};
  g.displayOrder = shuffle(g.chains.map((_, i) => i));
  api.setTimer(api.time('vote'), () => showResults(room, api));
}

function showResults(room, api) {
  const g = room.game;
  g.phase = 'results';
  const n = g.order.length;
  const stats = g.chains.map((c, i) => {
    const vals = Object.values(g.ratings).map((r) => r[i]).filter((x) => typeof x === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { idx: i, ownerId: c.ownerId, avg: Math.round(avg * 10) / 10, votes: vals.length };
  });
  stats.sort((a, b) => b.avg - a.avg);
  // ניקוד מדורג: מקום ראשון מקבל הכי הרבה, תיקו חולק אותו מקום
  let rank = 0;
  stats.forEach((s, k) => {
    if (k > 0 && s.avg < stats[k - 1].avg) rank = k;
    s.rank = rank + 1;
    s.points = s.votes > 0 ? n - rank : 0;
    api.addScore(s.ownerId, s.points);
  });
  g.results = stats;
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => api.endGame());
}

function votersPending(room, api) {
  const g = room.game;
  return api.activeIds().filter((id) => !g.ratings[id]);
}

export default {
  id: 'story',
  minPlayers: 2,

  sanitize(s, playerCount) {
    return {
      rounds: clampInt(s.rounds, 2, 20, Math.max(3, playerCount)),
      maxWords: clampInt(s.maxWords, 3, 40, 12),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.order = shuffle(g.participants);
    g.chains = g.order.map((id) => ({ ownerId: id, segments: [] }));
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    startRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return api.endGame();
    }
    if (g.phase === 'write') {
      if (type === 'draft') {
        g.drafts[pid] = cleanText(data, 400);
        return;
      }
      if (type === 'submit') {
        const body = limitWords(data, room.settings.maxWords);
        if (!body) return 'צריך לכתוב משהו';
        g.texts[pid] = body;
        if (api.activeIds().every((id) => g.texts[id] != null)) endWriting(room, api);
        return;
      }
    }
    if (g.phase === 'vote' && type === 'rate') {
      const mine = g.order.indexOf(pid);
      const out = {};
      g.chains.forEach((_, i) => {
        if (i === mine) return;
        const v = clampInt(data?.[i], 1, 10, null);
        if (v !== null) out[i] = v;
      });
      if (Object.keys(out).length < g.chains.length - 1) return 'צריך לדרג את כל הסיפורים';
      g.ratings[pid] = out;
      if (votersPending(room, api).length === 0) showResults(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'write' && api.activeIds().every((id) => g.texts[id] != null)) {
      endWriting(room, api);
    } else if (g.phase === 'vote' && votersPending(room, api).length === 0) {
      showResults(room, api);
    }
  },

  view(room, pid) {
    const g = room.game;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      maxWords: room.settings.maxWords,
    };
    if (g.phase === 'write') {
      v.prompt = promptFor(g, pid);
      v.myText = g.texts[pid] ?? null;
      v.submittedIds = Object.keys(g.texts);
    }
    if (g.phase === 'vote' || g.phase === 'results') {
      const mine = g.order.indexOf(pid);
      v.stories = g.displayOrder.map((i) => ({
        idx: i,
        mine: i === mine,
        text: storyText(g.chains[i]),
      }));
      v.votedIds = Object.keys(g.ratings);
      v.myRatings = g.ratings[pid] || null;
    }
    if (g.phase === 'results') {
      v.results = g.results.map((r) => ({
        ...r,
        text: storyText(g.chains[r.idx]),
        authors: [...new Set(g.chains[r.idx].segments.map((s) => s.pid))],
      }));
    }
    return v;
  },
};
