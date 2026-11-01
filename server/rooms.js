import { GAMES } from './games/index.js';
import { cleanText } from './utils.js';

const rooms = new Map();
let IO = null;
const MAX_PLAYERS = 24;
const EMPTY_ROOM_TTL = 30 * 60 * 1000;
const REVEAL_SEC = 15;
const CHAT_MAX = 200;
const CHAT_GAP_MS = 400;
const COUNTDOWN_MS = 4000; // 3, 2, 1, 0 ויוצאים לדרך

function genCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(code));
  return code;
}

function getPlayer(room, pid) {
  return room.players.find((p) => p.id === pid);
}

// אפשר כמה מארחים בחדר. hosts[0] הוא המארח ה"ראשי" (בשביל התצוגה)
function isHostOf(room, pid) {
  return room.hosts.includes(pid);
}

// מנקה מארחים שיצאו, ואם לא נשאר מארח מחובר - הראשון שמחובר נהיה מארח
function fixHosts(room) {
  room.hosts = room.hosts.filter((id) => getPlayer(room, id));
  if (!room.hosts.some((id) => getPlayer(room, id).connected)) {
    const next = room.players.find((p) => p.connected) || room.players[0];
    if (next) room.hosts = [next.id, ...room.hosts.filter((id) => id !== next.id)];
  }
  if (room.hostRequests) room.hostRequests = room.hostRequests.filter((id) => getPlayer(room, id) && !isHostOf(room, id));
  // הצבעות הוצאה: בלי מי שיצא (לא כמטרה ולא כמצביע), ובלי מארחים כמטרה
  for (const [target, voters] of Object.entries(room.kickVotes || {})) {
    const left = voters.filter((id) => getPlayer(room, id));
    if (!getPlayer(room, target) || isHostOf(room, target) || !left.length) delete room.kickVotes[target];
    else room.kickVotes[target] = left;
  }
}

function emitTo(room, pid, event, data) {
  const p = getPlayer(room, pid);
  if (p?.connected && p.socketId) IO.to(p.socketId).emit(event, data);
}

// קבצים שמשחק מגיש בכתובת נפרדת (למשל תמונות בצור ריל) - לא נשלחים בתוך המצב
export function roomFile(code, token) {
  const room = rooms.get(code);
  if (!room || room.status === 'lobby') return null;
  return GAMES[room.gameId]?.file?.(room, token) || null;
}

// ---------- API שניתן למודולי המשחקים ----------
function makeApi(room) {
  const api = {
    // sec = null: שלב בלי הגבלת זמן. הפעולה נשמרת כדי שהמארח יוכל לדלג
    setTimer(sec, cb) {
      api.clearTimer();
      room.timerCb = cb;
      if (!sec) return;
      room.deadline = Date.now() + sec * 1000;
      room.timer = setTimeout(() => {
        api.runTimer();
        broadcast(room);
      }, sec * 1000);
    },
    runTimer() {
      const cb = room.timerCb;
      api.clearTimer();
      if (!cb) return;
      try {
        cb();
      } catch (e) {
        console.error('timer error', e);
      }
    },
    clearTimer() {
      clearTimeout(room.timer);
      room.timer = null;
      room.deadline = null;
      room.timerCb = null;
    },
    // משחקים בזמן אמת: פעולה שרצה כל ms מילישניות ומסנכרנת את כולם, עד שהמשחק נגמר
    setTick(ms, cb) {
      api.clearTick();
      room.tick = setInterval(() => {
        if (room.status !== 'game' || !rooms.has(room.code)) return api.clearTick();
        try {
          cb();
        } catch (e) {
          console.error('tick error', e);
        }
        broadcast(room);
      }, ms);
    },
    clearTick() {
      clearInterval(room.tick);
      room.tick = null;
    },
    // טיימר נסתר: בלי ספירה לאחור אצל השחקנים (למשל כדי שלא יידעו מתי יופיע הירוק).
    // אם המשחק נגמר או התחלף בינתיים - לא קורה כלום
    later(ms, cb) {
      const game = room.game;
      setTimeout(() => {
        if (room.status !== 'game' || room.game !== game || !rooms.has(room.code)) return;
        try {
          cb();
        } catch (e) {
          console.error('later error', e);
        }
        broadcast(room);
      }, ms);
    },
    // זמן השלב לפי הגדרות המארח, או null כשמשחקים בלי זמן
    time(key) {
      return room.settings.timed ? room.settings.times[key] : null;
    },
    revealTime() {
      return room.settings.timed ? REVEAL_SEC : null;
    },
    isConnected(pid) {
      return !!getPlayer(room, pid)?.connected;
    },
    // משתתפי המשחק הנוכחי שמחוברים כרגע
    activeIds() {
      return room.game.participants.filter((id) => api.isConnected(id));
    },
    addScore(pid, pts) {
      const p = getPlayer(room, pid);
      if (p && pts) p.score += pts;
    },
    isHost(pid) {
      return isHostOf(room, pid);
    },
    endGame() {
      api.clearTimer();
      api.clearTick();
      room.status = 'final';
    },
  };
  return api;
}

function apiFor(room) {
  if (!room.api) room.api = makeApi(room);
  return room.api;
}

// ---------- תצוגה לכל שחקן ----------
// מילים שהמארח הוסיף נשארות סודיות - אחרת כולם היו רואים אותן
function publicSettings({ customWords, ...rest }) {
  return rest;
}

// ההגדרות שהמארח בוחר עכשיו בלובי - רק ערכים פשוטים (בלי טקסט חופשי, שנשאר אצל המארח)
const plain = (v) => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 40);

function cleanDraft(gameId, settings) {
  if (!GAMES[gameId]) return null;
  const out = {};
  for (const [k, v] of Object.entries(settings || {}).slice(0, 30)) {
    if (k === 'times' && v && typeof v === 'object') {
      out.times = {};
      for (const [tk, tv] of Object.entries(v).slice(0, 10)) if (typeof tv === 'number') out.times[String(tk).slice(0, 20)] = tv;
    } else if (plain(v)) out[String(k).slice(0, 30)] = v;
  }
  return { gameId, settings: publicSettings(out) };
}

function viewFor(room, pid) {
  const game = GAMES[room.gameId];
  return {
    code: room.code,
    me: pid,
    hostId: room.hosts[0],
    hosts: room.hosts,
    // בקשות /host שמחכות לתשובה - רק המארחים רואים
    hostRequests: isHostOf(room, pid) ? room.hostRequests || [] : [],
    status: room.status,
    gameId: room.gameId,
    settings: publicSettings(room.settings),
    // בלובי: מה המארח מגדיר עכשיו, ומה כל שחקן היה רוצה
    draft: room.status === 'lobby' ? room.draft || null : null,
    wishes: room.status === 'lobby' ? room.wishes || {} : {},
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      score: p.score,
      connected: p.connected,
      inGame: room.status !== 'lobby' && !!room.game?.participants.includes(p.id),
    })),
    countdown: room.status === 'countdown' ? Math.max(0, room.startsAt - Date.now()) : null,
    timeLeft: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
    canSkip: !!room.timerCb,
    game: room.status === 'game' && game ? game.view(room, pid, apiFor(room)) : null,
  };
}

function broadcast(room) {
  for (const p of room.players) {
    if (p.connected && p.socketId) {
      IO.to(p.socketId).emit('state', viewFor(room, p.id));
    }
  }
}

// סנכרון במנות: לפעולות שקורות הרבה פעמים בשנייה (תנועה בצבע ומחבואים) - שידור אחד לכל LAZY_MS
const LAZY_MS = 90;
function broadcastSoon(room) {
  if (room.lazyTimer) return;
  room.lazyTimer = setTimeout(() => {
    room.lazyTimer = null;
    if (rooms.has(room.code)) broadcast(room);
  }, LAZY_MS);
}

function scheduleCleanup(room) {
  clearTimeout(room.cleanupTimer);
  if (room.players.some((p) => p.connected)) return;
  room.cleanupTimer = setTimeout(() => {
    if (!room.players.some((p) => p.connected)) {
      clearTimeout(room.timer);
      clearTimeout(room.countdownTimer);
      clearInterval(room.tick);
      rooms.delete(room.code);
    }
  }, EMPTY_ROOM_TTL);
}

// אחרי הספירה לאחור: מי שיצא בינתיים לא משתתף, ואם לא נשארו מספיק - חוזרים ללובי
function beginGame(room) {
  if (room.status !== 'countdown' || !rooms.has(room.code)) return;
  const game = GAMES[room.gameId];
  const api = apiFor(room);
  room.game.participants = room.game.participants.filter((id) => api.isConnected(id));
  room.status = 'game';
  if (room.game.participants.length < game.minPlayers) {
    room.status = 'lobby';
    room.game = null;
  } else {
    try {
      game.start(room, api);
    } catch (e) {
      console.error(e);
      api.clearTimer();
      api.clearTick();
      room.status = 'lobby';
      room.game = null;
    }
  }
  broadcast(room);
}

function sanitizeProfile({ name, emoji }) {
  return {
    name: cleanText(name, 16) || 'שחקן',
    emoji: cleanText(emoji, 8) || '😎',
  };
}

// מי תויג בהודעה עם @שם (השם צריך להיגמר בסוף מילה, כדי ש-@דן לא יתפוס את דניאל)
// כמה קולות צריך כדי להוציא: חצי מהמחוברים (מעוגל למעלה), ולפחות 2
const kickNeeded = (room) => Math.max(2, Math.ceil(room.players.filter((p) => p.connected).length / 2));

// מוצא שחקן לפי שם בתחילת הטקסט (השם הארוך ביותר שמתאים, כי יש שמות עם רווחים)
function playerByName(room, text) {
  const rest = text.trim().replace(/^@/, '');
  return [...room.players]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => rest === p.name || rest.startsWith(p.name + ' '));
}

// הודעת מערכת בצ'אט של כולם
function systemChat(room, text) {
  const m = { id: ++room.chatSeq, pid: null, system: true, text, mentions: [] };
  room.chat.push(m);
  if (room.chat.length > CHAT_MAX) room.chat.shift();
  for (const p of room.players) if (p.connected && p.socketId) IO.to(p.socketId).emit('chat', m);
}

// הוצאת שחקן מהחדר (על ידי מארח או בהצבעה)
function removePlayer(room, targetId, api) {
  const target = getPlayer(room, targetId);
  if (!target) return;
  if (target.socketId) IO.to(target.socketId).emit('kicked');
  room.players = room.players.filter((p) => p.id !== targetId);
  if (room.wishes) delete room.wishes[targetId];
  fixHosts(room);
  if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
  broadcast(room);
}

// הודעה פרטית רואים רק השולח והנמען
const canSee = (m, pid) => !m.to || m.to === pid || m.pid === pid;
const chatFor = (room, pid) => room.chat.filter((m) => canSee(m, pid));

function findMentions(room, text) {
  const ids = [];
  for (const p of room.players) {
    const tag = '@' + p.name;
    let i = text.indexOf(tag);
    while (i !== -1) {
      if (!/[\p{L}\p{N}]/u.test(text[i + tag.length] || '')) {
        ids.push(p.id);
        break;
      }
      i = text.indexOf(tag, i + 1);
    }
  }
  return ids;
}

// ---------- אירועי סוקט ----------
export function registerSocket(io, socket) {
  IO = io;
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    if (!room) return {};
    return { room, pid: socket.data.pid, api: apiFor(room) };
  };

  function attach(room, pid, profile) {
    let player = getPlayer(room, pid);
    if (player) {
      // התחברות מחדש
      if (player.socketId && player.socketId !== socket.id) {
        io.sockets.sockets.get(player.socketId)?.disconnect(true);
      }
      Object.assign(player, profile, { socketId: socket.id, connected: true });
    } else {
      player = { id: pid, ...profile, score: 0, connected: true, socketId: socket.id };
      room.players.push(player);
    }
    if (!room.hosts.some((id) => getPlayer(room, id)?.connected)) room.hosts = [pid, ...room.hosts.filter((id) => id !== pid)];
    socket.data.code = room.code;
    socket.data.pid = pid;
    socket.join(room.code);
    clearTimeout(room.cleanupTimer);
    socket.emit('chat:history', chatFor(room, pid));
  }

  socket.on('create', (data = {}, ack) => {
    const pid = cleanText(data.playerId, 64);
    if (!pid) return ack?.({ error: 'שגיאה בזיהוי השחקן' });
    const code = genCode();
    const room = {
      code,
      hosts: [pid],
      hostRequests: [],
      players: [],
      status: 'lobby',
      gameId: null,
      settings: {},
      game: null,
      timer: null,
      deadline: null,
      chat: [],
      chatSeq: 0,
    };
    rooms.set(code, room);
    attach(room, pid, sanitizeProfile(data));
    ack?.({ ok: true, code });
    broadcast(room);
  });

  socket.on('join', (data = {}, ack) => {
    const pid = cleanText(data.playerId, 64);
    const code = cleanText(data.code, 8);
    const room = rooms.get(code);
    if (!room) return ack?.({ error: 'לא מצאנו חדר עם הקוד הזה 🤔' });
    if (!pid) return ack?.({ error: 'שגיאה בזיהוי השחקן' });
    if (!getPlayer(room, pid) && room.players.length >= MAX_PLAYERS) {
      return ack?.({ error: 'החדר מלא' });
    }
    attach(room, pid, sanitizeProfile(data));
    ack?.({ ok: true, code });
    broadcast(room);
  });

  socket.on('leave', () => {
    const { room, pid, api } = ctx();
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== pid);
    if (room.wishes) delete room.wishes[pid];
    socket.leave(room.code);
    socket.data.code = null;
    if (room.players.length === 0) {
      clearTimeout(room.timer);
      clearTimeout(room.countdownTimer);
      clearInterval(room.tick);
      rooms.delete(room.code);
      return;
    }
    fixHosts(room);
    if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
    broadcast(room);
  });

  socket.on('host:start', ({ gameId, settings } = {}, ack) => {
    const { room, pid, api } = ctx();
    if (!room) return ack?.({ error: 'אין חדר' });
    if (!isHostOf(room, pid)) return ack?.({ error: 'רק המארח יכול להתחיל' });
    const game = GAMES[gameId];
    if (!game) return ack?.({ error: 'משחק לא קיים' });
    const connected = room.players.filter((p) => p.connected);
    if (connected.length < game.minPlayers) {
      return ack?.({ error: `צריך לפחות ${game.minPlayers} שחקנים למשחק הזה` });
    }
    if (room.status === 'countdown') return ack?.({ error: 'המשחק כבר מתחיל…' });
    api.clearTimer();
    api.clearTick();
    room.players.forEach((p) => (p.score = 0));
    room.gameId = gameId;
    room.settings = game.sanitize(settings || {}, connected.length);
    room.status = 'countdown';
    room.wishes = {};
    room.game = { participants: connected.map((p) => p.id) };
    room.startsAt = Date.now() + COUNTDOWN_MS;
    room.countdownTimer = setTimeout(() => beginGame(room), COUNTDOWN_MS);
    ack?.({ ok: true });
    broadcast(room);
  });

  // המארח משתף את ההגדרות שהוא בוחר, כדי שכולם יראו
  socket.on('host:draft', ({ gameId, settings } = {}) => {
    const { room, pid } = ctx();
    if (!room || !isHostOf(room, pid) || room.status !== 'lobby') return;
    const draft = cleanDraft(gameId, settings);
    if (!draft || JSON.stringify(draft) === JSON.stringify(room.draft)) return;
    room.draft = draft;
    broadcast(room);
  });

  // שחקן מבקש משחק או הגדרה (key ריק = רק המשחק). לחיצה שוב על אותו דבר מבטלת
  socket.on('wish', ({ gameId, key, value } = {}) => {
    const { room, pid } = ctx();
    const player = room && getPlayer(room, pid);
    if (!player || isHostOf(room, pid) || room.status !== 'lobby' || !GAMES[gameId]) return;
    room.wishes ||= {};
    const old = room.wishes[pid];
    let w = old && old.gameId === gameId ? { gameId, picks: { ...old.picks } } : { gameId, picks: {} };
    if (key == null) {
      if (old && old.gameId === gameId && !Object.keys(old.picks).length) w = null;
    } else {
      key = String(key).slice(0, 30);
      if (!plain(value)) return;
      if (w.picks[key] === value) delete w.picks[key];
      else w.picks[key] = value;
    }
    if (w) room.wishes[pid] = w;
    else delete room.wishes[pid];
    if (w) for (const h of room.hosts) emitTo(room, h, 'wish', { pid, gameId, key: key ?? null, value: key == null ? null : w.picks[key] ?? null });
    broadcast(room);
  });

  socket.on('host:lobby', () => {
    const { room, pid, api } = ctx();
    if (!room || !isHostOf(room, pid)) return;
    api.clearTimer();
    api.clearTick();
    clearTimeout(room.countdownTimer);
    room.status = 'lobby';
    room.game = null;
    broadcast(room);
  });

  socket.on('host:end', () => {
    const { room, pid, api } = ctx();
    if (!room || !isHostOf(room, pid) || room.status !== 'game') return;
    api.endGame();
    broadcast(room);
  });

  socket.on('host:skip', () => {
    const { room, pid, api } = ctx();
    if (!room || !isHostOf(room, pid) || room.status !== 'game') return;
    api.runTimer();
    broadcast(room);
  });

  socket.on('host:kick', (targetId) => {
    const { room, pid, api } = ctx();
    if (!room || !isHostOf(room, pid) || targetId === pid) return;
    removePlayer(room, targetId, api);
  });

  // תשובה לבקשת /host: give - המארח מעביר את התפקיד, add - מארח נוסף, decline - לא
  socket.on('host:answer', ({ pid: target, answer } = {}) => {
    const { room, pid } = ctx();
    if (!room || !isHostOf(room, pid) || !room.hostRequests?.includes(target) || !getPlayer(room, target)) return;
    room.hostRequests = room.hostRequests.filter((id) => id !== target);
    const me = getPlayer(room, pid);
    if (answer === 'give') {
      room.hosts = [target, ...room.hosts.filter((id) => id !== pid && id !== target)];
      emitTo(room, target, 'host:reply', `${me.emoji} ${me.name} העביר/ה לך את המארח 👑`);
    } else if (answer === 'add') {
      if (!room.hosts.includes(target)) room.hosts.push(target);
      emitTo(room, target, 'host:reply', `${me.emoji} ${me.name} הוסיף/ה אותך כמארח 👑`);
    } else {
      emitTo(room, target, 'host:reply', 'הבקשה להיות מארח נדחתה 🙅');
    }
    fixHosts(room);
    broadcast(room);
  });

  // מארח קובע מי מארח (גם בלי בקשה, וגם את עצמו) - אבל תמיד נשאר לפחות מארח אחד
  socket.on('host:set', ({ pid: target, on } = {}, ack) => {
    const { room, pid } = ctx();
    if (!room || !isHostOf(room, pid) || !getPlayer(room, target)) return ack?.({ error: 'אין הרשאה' });
    if (on) {
      if (!room.hosts.includes(target)) room.hosts.push(target);
    } else {
      const rest = room.hosts.filter((id) => id !== target);
      if (!rest.some((id) => getPlayer(room, id)?.connected)) return ack?.({ error: 'חייב להישאר לפחות מארח אחד' });
      room.hosts = rest;
    }
    fixHosts(room);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('game:action', ({ type, data } = {}, ack) => {
    const { room, pid, api } = ctx();
    if (!room || room.status !== 'game') return ack?.({ error: 'אין משחק פעיל' });
    if (!room.game.participants.includes(pid)) return ack?.({ error: 'תצטרף בסיבוב הבא 🙂' });
    const game = GAMES[room.gameId];
    try {
      const err = game.action(room, api, pid, String(type), data);
      if (err) return ack?.({ error: err });
      ack?.({ ok: true });
    } catch (e) {
      console.error('action error', e);
      ack?.({ error: 'משהו השתבש' });
    }
    if (game.lazy?.includes(String(type))) broadcastSoon(room);
    else broadcast(room);
  });

  // צ'אט של החדר - פעיל בלובי ובכל המשחקים
  // אפשר לשלוח טקסט (לכולם) או { text, to } - הודעה פרטית לשחקן אחד
  socket.on('chat:send', (data, ack) => {
    const { room, pid, api } = ctx();
    const player = room && getPlayer(room, pid);
    const text = typeof data === 'object' && data ? data.text : data;
    const to = typeof data === 'object' && data ? data.to || null : null;
    const msg = cleanText(text, 200);
    if (!player || !msg) return ack?.({ error: 'אין חדר' });
    // משחקים שבהם תיאום בצ'אט הורס את כל העניין (ספירה משותפת)
    if (room.status === 'game' && GAMES[room.gameId]?.noChat) return ack?.({ error: 'הצ׳אט סגור במשחק הזה 🤫' });
    const now = Date.now();
    if (now - (player.lastChat || 0) < CHAT_GAP_MS) return ack?.({ error: 'לאט לאט 🙂' });
    player.lastChat = now;
    // /kickvote @שם - הצבעה להוציא שחקן. כשחצי מהמחוברים הצביעו (לפחות 2) הוא בחוץ, גם בלי המארח.
    // אי אפשר להצביע נגד מארח או נגד עצמך; לכתוב שוב על אותו שחקן מבטל את הקול
    const kv = /^\/kickvote(?:\s+(.*))?$/is.exec(msg);
    if (kv) {
      const target = kv[1] && playerByName(room, kv[1]);
      if (!target) return ack?.({ error: 'על מי? כתבו /kickvote @שם' });
      if (target.id === pid) return ack?.({ error: 'אי אפשר להצביע נגד עצמך 😅' });
      if (isHostOf(room, target.id)) return ack?.({ error: 'אי אפשר להוציא מארח 👑' });
      room.kickVotes ||= {};
      const voters = room.kickVotes[target.id] || [];
      if (voters.includes(pid)) {
        room.kickVotes[target.id] = voters.filter((id) => id !== pid);
        if (!room.kickVotes[target.id].length) delete room.kickVotes[target.id];
        const n = room.kickVotes[target.id]?.length || 0;
        systemChat(room, `${player.emoji} ${player.name} ביטל/ה את ההצבעה להוציא את ${target.name} (${n}/${kickNeeded(room)})`);
        return ack?.({ ok: true });
      }
      room.kickVotes[target.id] = [...voters, pid];
      // סופרים רק מצביעים מחוברים
      const n = room.kickVotes[target.id].filter((id) => getPlayer(room, id)?.connected).length;
      const need = kickNeeded(room);
      if (n >= need) {
        delete room.kickVotes[target.id];
        systemChat(room, `🗳️ ${target.emoji} ${target.name} הוצא/ה מהחדר בהצבעה (${n}/${need})`);
        removePlayer(room, target.id, api);
      } else {
        systemChat(room, `🗳️ ${player.emoji} ${player.name} מצביע/ה להוציא את ${target.name} (${n}/${need}) · /kickvote @${target.name} כדי להצטרף`);
      }
      return ack?.({ ok: true });
    }
    // /host - בקשה להיות מארח (לא נכנס לצ'אט)
    if (/^\/host$/i.test(msg)) {
      if (isHostOf(room, pid)) return ack?.({ error: 'אתם כבר מארחים 👑' });
      room.hostRequests ||= [];
      if (!room.hostRequests.includes(pid)) room.hostRequests.push(pid);
      broadcast(room);
      return ack?.({ ok: true, notice: 'הבקשה נשלחה למארח 👑' });
    }
    if (to && (to === pid || !getPlayer(room, to))) return ack?.({ error: 'השחקן לא בחדר 🤔' });
    const m = {
      id: ++room.chatSeq,
      pid,
      name: player.name,
      emoji: player.emoji,
      text: msg,
      mentions: to ? [] : findMentions(room, msg),
      ...(to && { to }),
    };
    room.chat.push(m);
    if (room.chat.length > CHAT_MAX) room.chat.shift();
    for (const p of room.players) {
      if (p.connected && p.socketId && canSee(m, p.id)) IO.to(p.socketId).emit('chat', m);
    }
    ack?.({ ok: true });
  });

  // שינוי שם ואימוג'י - אפשר גם באמצע משחק
  socket.on('profile', (data = {}, ack) => {
    const { room, pid } = ctx();
    const player = room && getPlayer(room, pid);
    if (!player) return ack?.({ error: 'אין חדר' });
    const profile = sanitizeProfile(data);
    Object.assign(player, profile);
    ack?.({ ok: true, ...profile });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const { room, pid, api } = ctx();
    if (!room) return;
    const player = getPlayer(room, pid);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    // מארח שהתנתק נשאר מארח אם יש עוד מארח מחובר; אחרת התפקיד עובר למישהו מחובר
    if (isHostOf(room, pid) && !room.hosts.some((id) => getPlayer(room, id)?.connected)) {
      room.hosts = room.hosts.filter((id) => id !== pid);
    }
    fixHosts(room);
    if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
    broadcast(room);
    scheduleCleanup(room);
  });
}
