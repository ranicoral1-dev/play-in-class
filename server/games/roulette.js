// משחק: רולטת תמונות - כל אחד שולח תמונות (אקראיות מהגלריה או שבחר), ומנחשים של מי כל תמונה
import crypto from 'crypto';
import { shuffle, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { collect: 120, guess: 30 };
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const POINTS = 1; // לכל ניחוש נכון
const FAST_BONUS = 1; // למי שניחש נכון ראשון

function decodeImage(data) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data ?? ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { type: `image/${m[1]}`, buf };
}

// מי שלא הסכים לתת גישה לגלריה צופה במשחק, עד שהוא מסכים
const players = (room, api) => api.activeIds().filter((id) => !room.game.spectators.includes(id));

const allSubmitted = (room, api) => players(room, api).every((id) => room.game.photos[id]);

// מי שהתמונה שלו לא מנחש
const guessers = (room, api) => players(room, api).filter((id) => id !== room.game.current?.owner);

// מי שהסכים באמצע הניחושים: התמונות שלו מחליפות תמונות שעוד לא הוצגו, כך שהמספר לא משתנה
function lateJoin(room, pid, photos) {
  const g = room.game;
  const free = shuffle(Array.from({ length: g.deck.length - g.round }, (_, k) => g.round + k));
  photos.forEach((p, k) => {
    if (k < free.length) g.deck[free[k]] = { ...p, owner: pid };
  });
  if (!g.owners.includes(pid)) g.owners.push(pid);
}

function startGuessing(room, api) {
  const g = room.game;
  const pool = Object.entries(g.photos).flatMap(([owner, list]) => list.map((p) => ({ ...p, owner })));
  // נבחרות תמונות אקראיות מכל מה שנשלח, והשאר נמחקות כדי לא למלא את הזיכרון
  g.deck = shuffle(pool).slice(0, room.settings.show);
  g.owners = Object.keys(g.photos).filter((id) => g.photos[id].length);
  g.photos = {};
  g.totalRounds = g.deck.length;
  g.round = 0;
  if (g.owners.length < 2) {
    g.phase = 'empty';
    return api.setTimer(api.revealTime(), () => api.endGame());
  }
  nextPhoto(room, api);
}

function nextPhoto(room, api) {
  const g = room.game;
  g.round++;
  if (g.round > g.totalRounds) return api.endGame();
  Object.assign(g, { phase: 'guess', current: g.deck[g.round - 1], guesses: {}, firstCorrect: null });
  if (!guessers(room, api).length) return reveal(room, api);
  api.setTimer(api.time('guess'), () => reveal(room, api));
}

function reveal(room, api) {
  const g = room.game;
  g.phase = 'reveal';
  g.points = {};
  for (const [id, guess] of Object.entries(g.guesses)) {
    if (guess !== g.current.owner) continue;
    g.points[id] = POINTS + (id === g.firstCorrect ? FAST_BONUS : 0);
    api.addScore(id, g.points[id]);
  }
  api.setTimer(api.revealTime(), () => nextPhoto(room, api));
}

export default {
  id: 'roulette',
  minPlayers: 3,

  sanitize(s) {
    return {
      random: s.random !== false,
      perPlayer: clampInt(s.perPlayer, 1, 10, 3),
      show: clampInt(s.show, 1, 100, 10),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.phase = 'collect';
    g.photos = {};
    g.spectators = [];
    g.round = 0;
    g.totalRounds = room.settings.show;
    api.setTimer(api.time('collect'), () => startGuessing(room, api));
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'reveal') return;
      return nextPhoto(room, api);
    }
    if (type === 'spectate' && g.phase === 'collect' && room.settings.random) {
      if (!g.spectators.includes(pid)) g.spectators.push(pid);
      delete g.photos[pid];
      if (allSubmitted(room, api)) startGuessing(room, api);
      return;
    }
    const late = g.spectators.includes(pid) && (g.phase === 'guess' || g.phase === 'reveal');
    if (type === 'submit' && (g.phase === 'collect' || late)) {
      const list = Array.isArray(data) ? data.slice(0, room.settings.perPlayer) : [];
      const photos = list.map(decodeImage);
      if (!photos.length || photos.some((p) => !p)) return 'אחת התמונות גדולה מדי או לא תקינה';
      const withTokens = photos.map((p) => ({ ...p, token: crypto.randomBytes(12).toString('hex') }));
      g.spectators = g.spectators.filter((id) => id !== pid);
      if (late) return lateJoin(room, pid, withTokens);
      g.photos[pid] = withTokens;
      if (allSubmitted(room, api)) startGuessing(room, api);
      return;
    }
    if (g.phase === 'guess' && type === 'guess' && pid !== g.current.owner) {
      if (g.guesses[pid] || !g.owners.includes(data) || data === pid) return;
      g.guesses[pid] = data;
      if (!g.firstCorrect && data === g.current.owner) g.firstCorrect = pid;
      if (guessers(room, api).every((id) => g.guesses[id])) reveal(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'collect' && allSubmitted(room, api)) startGuessing(room, api);
    else if (g.phase === 'guess' && guessers(room, api).every((id) => g.guesses[id])) reveal(room, api);
  },

  // התמונות לא נשלחות בתוך המצב אלא בכתובת נפרדת
  file(room, token) {
    const g = room.game;
    const all = [...(g?.deck || []), ...Object.values(g?.photos || {}).flat()];
    const p = all.find((x) => x.token === token);
    return p ? { type: p.type, buf: p.buf } : null;
  },

  view(room, pid, api) {
    const g = room.game;
    const v = { phase: g.phase, round: g.round, totalRounds: g.totalRounds, spectator: g.spectators.includes(pid), spectatorIds: g.spectators };
    if (g.phase === 'collect') {
      v.playerIds = players(room, api);
      v.submittedIds = Object.keys(g.photos);
      v.mine = (g.photos[pid] || []).map((p) => `/img/${room.code}/${p.token}`);
      return v;
    }
    if (g.phase === 'empty') return v;
    v.src = `/img/${room.code}/${g.current.token}`;
    v.options = g.owners;
    v.mineNow = g.current.owner === pid;
    v.myGuess = g.guesses[pid] ?? null;
    v.guesserIds = guessers(room, api);
    v.guessedIds = Object.keys(g.guesses);
    if (g.phase === 'reveal') {
      v.owner = g.current.owner;
      v.guesses = g.guesses;
      v.points = g.points;
      v.firstCorrect = g.firstCorrect;
    }
    return v;
  },
};
