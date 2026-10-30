// משחק: ספירה משותפת - כל הכיתה סופרת יחד בלי תורות. שניים באותו מספר = מתחילים מההתחלה
import { clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { count: 120 };
const COLLIDE_MS = 1000; // שניים שאמרו את אותו מספר בתוך שנייה - התנגשות
const BOOM_MS = 2500;
const RESULTS_SEC = 10;

function startRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  g.collisions = 0;
  g.best = 0;
  g.success = null;
  g.points = null;
  restart(room, api);
  api.setTimer(api.time('count'), () => endRound(room, api, false));
}

// ניסיון חדש מאפס
function restart(room, api) {
  const g = room.game;
  Object.assign(g, { phase: 'count', said: [], lastAt: 0, boom: null });
  g.target = room.settings.once ? api.activeIds().length : room.settings.target;
}

const current = (g) => g.said.length;

function endRound(room, api, success) {
  const g = room.game;
  api.clearTimer();
  g.phase = 'results';
  g.success = success;
  const pts = success ? 5 + Math.max(0, 5 - g.collisions) : Math.floor((5 * g.best) / Math.max(1, g.target));
  g.points = pts;
  for (const id of g.participants) api.addScore(id, pts);
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => startRound(room, api));
}

// בכל ספירה, מי שכבר אמר מספר (במצב ״כל אחד פעם אחת״) לא יכול שוב
function canSay(room, g, pid) {
  if (room.settings.once) return !g.said.some((s) => s.pid === pid);
  return g.said[g.said.length - 1]?.pid !== pid;
}

export default {
  id: 'count',
  minPlayers: 2,
  noChat: true,

  sanitize(s, n) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 3),
      once: s.once !== false,
      target: clampInt(s.target, 5, 100, Math.max(10, n * 2)),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    startRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return startRound(room, api);
    }
    if (type !== 'say' || g.phase !== 'count') return;
    const n = clampInt(data, 1, 1000, null);
    const now = Date.now();
    const last = g.said[g.said.length - 1];
    // אמר את המספר שמישהו אחר אמר הרגע - התנגשות!
    if (n === current(g) && last && last.pid !== pid && now - g.lastAt < COLLIDE_MS && canSay(room, g, pid)) {
      g.phase = 'boom';
      g.boom = { n, ids: [last.pid, pid] };
      g.collisions++;
      api.later(BOOM_MS, () => g.phase === 'boom' && restart(room, api));
      return;
    }
    if (n !== current(g) + 1) return 'מישהו הקדים אותך';
    if (!canSay(room, g, pid)) return room.settings.once ? 'כבר אמרת מספר בספירה הזאת' : 'אי אפשר פעמיים ברצף';
    g.said.push({ n, pid });
    g.lastAt = now;
    g.best = Math.max(g.best, n);
    if (n >= g.target) endRound(room, api, true);
  },

  check(room, api) {
    const g = room.game;
    // מישהו יצא באמצע: ב״כל אחד פעם אחת״ היעד יורד למה שעוד אפשר להגיע אליו
    if (g.phase !== 'count' || !room.settings.once) return;
    const left = api.activeIds().filter((id) => !g.said.some((s) => s.pid === id)).length;
    g.target = Math.min(g.target, current(g) + left);
    if (current(g) > 0 && current(g) >= g.target) endRound(room, api, true);
  },

  view(room, pid) {
    const g = room.game;
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      once: room.settings.once,
      target: g.target,
      said: g.said,
      canSay: g.phase === 'count' && canSay(room, g, pid),
      boom: g.boom,
      collisions: g.collisions,
      best: g.best,
      success: g.success,
      points: g.points,
    };
  },
};
