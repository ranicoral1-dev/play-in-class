// משחק: מי יותר מהיר - המסך נהיה ירוק ברגע אקראי, ומי שלוחץ ראשון מנצח. לחיצה מוקדמת = פסילה
import { pick, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { results: 6 };
const TAP_WINDOW_MS = 2500; // כמה זמן אפשר ללחוץ אחרי שהירוק מופיע
const MIN_REACTION_MS = 90; // מהר מזה זה ניחוש, לא תגובה
const POINTS = [3, 2, 1];
const DECOY_COLORS = ['blue', 'yellow', 'pink', 'red'];
const TARGETS = ['🐸', '🍕', '🦄', '⚽', '🚀', '🍩', '🐙', '🌈', '🎸', '🦖'];
const OTHERS = ['🐶', '🍔', '🐱', '🏀', '✈️', '🍪', '🦀', '⭐', '🎺', '🐢', '🍉', '🐵', '🍟', '🦋', '🎈'];

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function startRound(room, api) {
  const g = room.game;
  // אם המארח לחץ ״הבא״ - הטיימר של התוצאות לא צריך להתחיל עוד סיבוב
  api.clearTimer();
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  // כל שלב נסתר מסומן במספר, כדי שטיימר ישן מסיבוב קודם לא יפעל
  const token = ++g.token;
  const step = (ms, fn) => api.later(ms, () => g.token === token && fn());
  Object.assign(g, {
    phase: 'ready',
    kind: room.settings.tricks ? pick(['color', 'color', 'decoy', 'emoji']) : 'color',
    flash: null,
    target: null,
    taps: {},
    results: null,
  });

  if (g.kind === 'color') {
    step(rand(1800, 5000), () => go(room, api));
  } else if (g.kind === 'decoy') {
    // צבע מטעה מופיע לרגע לפני הירוק
    step(rand(1200, 2800), () => {
      g.flash = { color: pick(DECOY_COLORS), id: token };
      step(rand(600, 1000), () => {
        g.flash = null;
        step(rand(700, 2500), () => go(room, api));
      });
    });
  } else {
    // אימוג'ים מתחלפים, ולוחצים רק כשמופיע האימוג'י שנבחר
    g.target = pick(TARGETS);
    const count = rand(2, 6);
    let i = 0;
    const next = () => {
      if (i++ >= count) return go(room, api);
      // כל פעם אימוג'י אחר, אחרת לא רואים שהתחלף
      g.flash = { emoji: pick(OTHERS.filter((e) => e !== g.flash?.emoji)), id: i };
      step(rand(650, 1000), next);
    };
    step(rand(1500, 2500), next);
  }
}

function go(room, api) {
  const g = room.game;
  const token = g.token;
  g.phase = 'go';
  g.flash = g.kind === 'emoji' ? { emoji: g.target, id: 'go' } : null;
  if (allTapped(room, api)) return endRound(room, api);
  // קצת זמן נוסף בשביל מי שהחיבור שלו איטי
  api.later(TAP_WINDOW_MS + 500, () => g.token === token && g.phase === 'go' && endRound(room, api));
}

function allTapped(room, api) {
  return api.activeIds().every((id) => room.game.taps[id]);
}

function endRound(room, api) {
  const g = room.game;
  g.phase = 'results';
  g.flash = null;
  const fast = Object.entries(g.taps)
    .filter(([, t]) => t.ms != null)
    .sort((a, b) => a[1].ms - b[1].ms);
  const results = fast.map(([id, t], i) => ({ id, ms: t.ms, points: POINTS[i] || 0 }));
  for (const [id, t] of Object.entries(g.taps)) if (t.early) results.push({ id, early: true, points: -1 });
  for (const id of g.participants) if (!g.taps[id]) results.push({ id, missed: true, points: 0 });
  for (const r of results) {
    api.addScore(r.id, r.points);
    if (r.ms != null && (!g.best[r.id] || r.ms < g.best[r.id])) g.best[r.id] = r.ms;
  }
  g.results = results;
  api.setTimer(api.time('results'), () => startRound(room, api));
}

export default {
  id: 'fast',
  minPlayers: 2,

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 3, 30, 10),
      tricks: s.tricks !== false,
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    g.token = 0;
    g.best = {};
    startRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return startRound(room, api);
    }
    if (type !== 'tap' || g.taps[pid]) return;
    if (g.phase === 'ready') {
      g.taps[pid] = { early: true };
    } else if (g.phase === 'go') {
      // את זמן התגובה מודד המכשיר עצמו, כדי שחיבור איטי לא יפגע במי שמהיר
      const ms = clampInt(data?.ms, 0, TAP_WINDOW_MS + 500, null);
      if (ms === null) return;
      g.taps[pid] = ms < MIN_REACTION_MS ? { early: true } : { ms };
      if (allTapped(room, api)) endRound(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'go' && allTapped(room, api)) endRound(room, api);
  },

  view(room, pid) {
    const g = room.game;
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      kind: g.kind,
      target: g.target,
      flash: g.flash,
      myTap: g.taps[pid] || null,
      tappedIds: Object.keys(g.taps),
      results: g.results,
      best: g.best,
    };
  },
};
