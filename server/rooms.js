import { GAMES } from './games/index.js';
import { cleanText } from './utils.js';

const rooms = new Map();
let IO = null;
const MAX_PLAYERS = 24;
const EMPTY_ROOM_TTL = 30 * 60 * 1000;

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

// ---------- API שניתן למודולי המשחקים ----------
function makeApi(room) {
  const api = {
    setTimer(sec, cb) {
      clearTimeout(room.timer);
      room.deadline = Date.now() + sec * 1000;
      room.timer = setTimeout(() => {
        room.timer = null;
        room.deadline = null;
        try {
          cb();
        } catch (e) {
          console.error('timer error', e);
        }
        broadcast(room);
      }, sec * 1000);
    },
    clearTimer() {
      clearTimeout(room.timer);
      room.timer = null;
      room.deadline = null;
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
      return room.hostId === pid;
    },
    endGame() {
      api.clearTimer();
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
function viewFor(room, pid) {
  const game = GAMES[room.gameId];
  return {
    code: room.code,
    me: pid,
    hostId: room.hostId,
    status: room.status,
    gameId: room.gameId,
    settings: room.settings,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      score: p.score,
      connected: p.connected,
      inGame: room.status !== 'lobby' && !!room.game?.participants.includes(p.id),
    })),
    timeLeft: room.deadline ? Math.max(0, room.deadline - Date.now()) : null,
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

function scheduleCleanup(room) {
  clearTimeout(room.cleanupTimer);
  if (room.players.some((p) => p.connected)) return;
  room.cleanupTimer = setTimeout(() => {
    if (!room.players.some((p) => p.connected)) {
      clearTimeout(room.timer);
      rooms.delete(room.code);
    }
  }, EMPTY_ROOM_TTL);
}

function sanitizeProfile({ name, emoji }) {
  return {
    name: cleanText(name, 16) || 'שחקן',
    emoji: cleanText(emoji, 8) || '😎',
  };
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
    if (!getPlayer(room, room.hostId)?.connected) room.hostId = pid;
    socket.data.code = room.code;
    socket.data.pid = pid;
    socket.join(room.code);
    clearTimeout(room.cleanupTimer);
  }

  socket.on('create', (data = {}, ack) => {
    const pid = cleanText(data.playerId, 64);
    if (!pid) return ack?.({ error: 'שגיאה בזיהוי השחקן' });
    const code = genCode();
    const room = {
      code,
      hostId: pid,
      players: [],
      status: 'lobby',
      gameId: null,
      settings: {},
      game: null,
      timer: null,
      deadline: null,
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
    socket.leave(room.code);
    socket.data.code = null;
    if (room.players.length === 0) {
      clearTimeout(room.timer);
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === pid) room.hostId = (room.players.find((p) => p.connected) || room.players[0]).id;
    if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
    broadcast(room);
  });

  socket.on('host:start', ({ gameId, settings } = {}, ack) => {
    const { room, pid, api } = ctx();
    if (!room) return ack?.({ error: 'אין חדר' });
    if (room.hostId !== pid) return ack?.({ error: 'רק המארח יכול להתחיל' });
    const game = GAMES[gameId];
    if (!game) return ack?.({ error: 'משחק לא קיים' });
    const connected = room.players.filter((p) => p.connected);
    if (connected.length < game.minPlayers) {
      return ack?.({ error: `צריך לפחות ${game.minPlayers} שחקנים למשחק הזה` });
    }
    api.clearTimer();
    room.players.forEach((p) => (p.score = 0));
    room.gameId = gameId;
    room.settings = game.sanitize(settings || {}, connected.length);
    room.status = 'game';
    room.game = { participants: connected.map((p) => p.id) };
    try {
      game.start(room, api);
    } catch (e) {
      console.error(e);
      room.status = 'lobby';
      return ack?.({ error: 'שגיאה בהפעלת המשחק' });
    }
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('host:lobby', () => {
    const { room, pid, api } = ctx();
    if (!room || room.hostId !== pid) return;
    api.clearTimer();
    room.status = 'lobby';
    room.game = null;
    broadcast(room);
  });

  socket.on('host:end', () => {
    const { room, pid, api } = ctx();
    if (!room || room.hostId !== pid || room.status !== 'game') return;
    api.endGame();
    broadcast(room);
  });

  socket.on('host:kick', (targetId) => {
    const { room, pid, api } = ctx();
    if (!room || room.hostId !== pid || targetId === pid) return;
    const target = getPlayer(room, targetId);
    if (!target) return;
    if (target.socketId) io.to(target.socketId).emit('kicked');
    room.players = room.players.filter((p) => p.id !== targetId);
    if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
    broadcast(room);
  });

  socket.on('game:action', ({ type, data } = {}, ack) => {
    const { room, pid, api } = ctx();
    if (!room || room.status !== 'game') return ack?.({ error: 'אין משחק פעיל' });
    if (!room.game.participants.includes(pid)) return ack?.({ error: 'תצטרף בסיבוב הבא 🙂' });
    try {
      const err = GAMES[room.gameId].action(room, api, pid, String(type), data);
      if (err) return ack?.({ error: err });
      ack?.({ ok: true });
    } catch (e) {
      console.error('action error', e);
      ack?.({ error: 'משהו השתבש' });
    }
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const { room, pid, api } = ctx();
    if (!room) return;
    const player = getPlayer(room, pid);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    if (room.hostId === pid) {
      const next = room.players.find((p) => p.connected);
      if (next) room.hostId = next.id;
    }
    if (room.status === 'game') GAMES[room.gameId].check?.(room, api);
    broadcast(room);
    scheduleCleanup(room);
  });
}
