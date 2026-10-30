// משחק 9: עיירה
import { shuffle, pick, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { night: 60 };
const EVENT_SEC = 2.5; // הלקוח חושף אירוע כל 2.5 שניות
const SPECIAL = ['police', 'locker', 'medic'];
// תפקידים שחייבים לבחור מישהו לפני שהולכים לישון
const MUST_PICK = ['imposter', 'police', 'locker', 'medic'];

// אם ביקשו יותר תפקידים משחקנים - מורידים מהפחות חשובים
function fitRoles(s, n) {
  const total = () => s.imposters + s.police + s.lockers + s.medics + s.jesters;
  for (const key of ['jesters', 'medics', 'lockers']) {
    while (total() > n && s[key] > 0) s[key]--;
  }
  // מתחזים ושוטרים יורדים לסירוגין, כדי לשמור על איזון
  while (total() > n && s.imposters + s.police > 2) {
    if (s.imposters >= s.police && s.imposters > 1) s.imposters--;
    else s.police--;
  }
  return s;
}

function alive(g) {
  return g.ids.filter((id) => g.status[id] !== 'dead');
}

function free(g) {
  return g.ids.filter((id) => g.status[id] === 'free');
}

function validTargets(g, pid) {
  const role = g.roles[pid];
  const f = free(g);
  if (role === 'imposter') return f.filter((id) => g.roles[id] !== 'imposter');
  if (role === 'police') return f.filter((id) => g.roles[id] !== 'police');
  if (role === 'locker') return alive(g).filter((id) => id !== pid);
  if (role === 'medic') return f;
  return f.filter((id) => id !== pid);
}

function nextRound(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  const ids = shuffle(g.participants.filter((id) => api.isConnected(id)));
  if (ids.length < 3) return api.endGame();

  const s = fitRoles({ ...room.settings }, ids.length);
  const roles = {};
  let i = 0;
  for (const [role, count] of [
    ['imposter', s.imposters],
    ['police', s.police],
    ['locker', s.lockers],
    ['medic', s.medics],
    ['jester', s.jesters],
  ]) {
    for (let k = 0; k < count; k++) roles[ids[i++]] = role;
  }
  while (i < ids.length) roles[ids[i++]] = 'civilian';

  Object.assign(g, {
    ids: shuffle(ids),
    roles,
    status: Object.fromEntries(ids.map((id) => [id, 'free'])),
    day: 0,
    events: [],
    outcome: null,
    roundPoints: {},
    nightPoints: {},
  });
  startNight(room, api);
}

function startNight(room, api) {
  const g = room.game;
  g.day++;
  g.phase = 'night';
  g.choices = {};
  g.ready = {};
  api.setTimer(api.time('night'), () => resolveNight(room, api));
}

function pending(g, api) {
  return free(g).filter((id) => api.isConnected(id) && !g.ready[id]);
}

function resolveNight(room, api) {
  const g = room.game;
  api.clearTimer();
  const f = free(g);
  const withRole = (r) => f.filter((id) => g.roles[id] === r);
  const choice = (id) => {
    const t = g.choices[id];
    return t && validTargets(g, id).includes(t) ? t : null;
  };

  // מתחזים: אם בחרו אנשים שונים - מגרילים מבין הבחירות
  const imposters = withRole('imposter');
  const impPicks = imposters.map(choice).filter(Boolean);
  const victim = impPicks.length ? pick(impPicks) : null;
  const killers = imposters.filter((id) => choice(id) === victim);

  const arrests = new Map(); // נעצר -> השוטרים שעצרו אותו
  for (const id of withRole('police')) {
    const t = choice(id);
    if (t) arrests.set(t, [...(arrests.get(t) || []), id]);
  }
  const unlocked = new Set(withRole('locker').map(choice).filter(Boolean));
  const heals = new Map(); // מטופל -> החובשים
  for (const id of withRole('medic')) {
    const t = choice(id);
    if (t) heals.set(t, [...(heals.get(t) || []), id]);
  }

  const events = [];
  const pts = {};
  const add = (id, n) => (pts[id] = (pts[id] || 0) + n);
  // נקודות שמתבטלות אם שני הצדדים הפילו זה את זה
  const sidePts = [];

  let dead = null;
  if (victim) {
    if (heals.has(victim)) {
      events.push({ type: 'saved', id: victim });
      heals.get(victim).forEach((m) => add(m, 3));
      if (g.roles[victim] === 'jester') add(victim, -1);
    } else {
      dead = victim;
      events.push({ type: 'killed', id: victim });
      if (SPECIAL.includes(g.roles[victim])) killers.forEach((k) => sidePts.push([k, 1]));
      if (g.roles[victim] === 'jester') add(victim, 3);
    }
  }

  const jailed = [];
  for (const [t, cops] of arrests) {
    if (t === dead) continue;
    if (unlocked.has(t)) {
      events.push({ type: 'rescued', id: t });
      if (g.roles[t] === 'jester') add(t, -1);
    } else {
      jailed.push(t);
      events.push({ type: 'arrested', id: t });
      if (g.roles[t] === 'imposter') cops.forEach((c) => sidePts.push([c, 5]));
      if (g.roles[t] === 'jester') add(t, 5);
    }
  }
  const released = [...unlocked].filter((t) => g.status[t] === 'jailed');
  for (const t of released) {
    events.push({ type: 'released', id: t });
    if (g.roles[t] === 'jester') add(t, -1);
  }
  if (!events.length) events.push({ type: 'quiet' });

  if (dead) g.status[dead] = 'dead';
  jailed.forEach((t) => (g.status[t] = 'jailed'));
  released.forEach((t) => (g.status[t] = 'free'));

  const freeImps = free(g).filter((id) => g.roles[id] === 'imposter');
  const freeCops = free(g).filter((id) => g.roles[id] === 'police');
  if (!freeImps.length && !freeCops.length) g.outcome = 'both';
  else if (!freeImps.length) g.outcome = 'town';
  else if (!freeCops.length) g.outcome = 'imposters';
  if (g.outcome !== 'both') sidePts.forEach(([id, n]) => add(id, n));
  if (g.outcome === 'imposters') g.ids.filter((id) => g.roles[id] === 'imposter').forEach((id) => add(id, 3));

  // נקודה לכל יום שורדים - גלוי לכולם, אז נכנס לניקוד מיד
  for (const id of alive(g)) api.addScore(id, 1);
  // נקודות התפקידים נשמרות בסוד עד סוף הסיבוב, כדי שהטבלה לא תסגיר מי מה
  for (const [id, n] of Object.entries(pts)) g.roundPoints[id] = (g.roundPoints[id] || 0) + n;
  g.nightPoints = pts;
  g.events = events;
  g.phase = 'morning';

  const sec = api.revealTime() && Math.ceil((events.length + (g.outcome ? 1 : 0)) * EVENT_SEC + 8);
  api.setTimer(sec, () => (g.outcome ? endRound(room, api) : startNight(room, api)));
}

function endRound(room, api) {
  const g = room.game;
  g.phase = 'end';
  for (const [id, n] of Object.entries(g.roundPoints)) api.addScore(id, n);
  api.setTimer(api.revealTime(), () => nextRound(room, api));
}

export default {
  id: 'town',
  minPlayers: 3,

  sanitize(s, playerCount) {
    return fitRoles(
      {
        rounds: clampInt(s.rounds, 1, 20, 3),
        imposters: clampInt(s.imposters, 1, 5, 1),
        police: clampInt(s.police, 1, 5, 1),
        lockers: clampInt(s.lockers, 0, 5, 1),
        medics: clampInt(s.medics, 0, 5, 1),
        jesters: clampInt(s.jesters, 0, 5, 0),
        ...sanitizeTimes(s, TIMES),
      },
      playerCount,
    );
  },

  start(room, api) {
    const g = room.game;
    g.round = 0;
    g.totalRounds = room.settings.rounds;
    nextRound(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid)) return;
      if (g.phase === 'morning') {
        api.clearTimer();
        return g.outcome ? endRound(room, api) : startNight(room, api);
      }
      if (g.phase === 'end') {
        api.clearTimer();
        return nextRound(room, api);
      }
      return;
    }
    if (g.phase !== 'night' || g.status[pid] !== 'free') return;
    if (type === 'pick') {
      if (g.ready[pid]) return;
      const t = data?.target ?? null;
      if (t !== null && !validTargets(g, pid).includes(t)) return 'אי אפשר לבחור את השחקן הזה';
      g.choices[pid] = t;
      return;
    }
    if (type === 'ready') {
      const targets = validTargets(g, pid);
      if (MUST_PICK.includes(g.roles[pid]) && targets.length && !targets.includes(g.choices[pid])) {
        return 'צריך לבחור מישהו קודם';
      }
      g.ready[pid] = true;
      if (pending(g, api).length === 0) resolveNight(room, api);
      return;
    }
    if (type === 'unready') delete g.ready[pid];
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'night' && pending(g, api).length === 0) resolveNight(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const role = g.roles[pid] || null;
    const v = {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      day: g.day,
      ids: g.ids,
      status: g.status,
      myRole: role,
      myStatus: g.status[pid] || null,
      awakeIds: free(g),
      readyIds: Object.keys(g.ready || {}),
      myPick: g.choices?.[pid] ?? null,
      mustPick: MUST_PICK.includes(role),
    };
    // מתחזים מכירים זה את זה, וכך גם השוטרים - כולל מה השותפים בוחרים
    if (role === 'imposter' || role === 'police') {
      v.team = g.ids.filter((id) => g.roles[id] === role && id !== pid);
      if (g.phase === 'night') v.teamPicks = Object.fromEntries(v.team.map((id) => [id, g.choices[id] ?? null]));
    }
    if (g.phase === 'night' && g.status[pid] === 'free') v.targets = validTargets(g, pid);
    if (g.phase === 'morning' || g.phase === 'end') {
      v.events = g.events;
      v.outcome = g.outcome;
      v.myNightPoints = g.nightPoints[pid] || 0;
    }
    if (g.phase === 'end') {
      v.roles = g.roles;
      v.roundPoints = g.roundPoints;
    }
    return v;
  },
};
