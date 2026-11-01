// משחק: נחש את המספר - לכל אחד מספר סודי שיש בדיוק לעוד שחקן אחד (במספר אי-זוגי: קבוצה אחת של 3).
// מדברים בהודעות פרטיות ומנסים להבין מי התאום. מי שכותב מספר של אחרים - פוסל את כולם עם המספר הזה.
// מי שכותב מספר שאין לאף אחד שעוד במשחק - נפסל יחד עם התאום שלו. ניחוש נכון של התאום = הרבה נקודות.
import { shuffle, clampInt, sanitizeTimes, cleanText } from '../utils.js';

const TIMES = { play: 300 };
const RESULTS_SEC = 20;
const KILL_PTS = 3; // לכל שחקן שנפסל מהמספר שכתבת
const foundPts = (i) => Math.max(2, 10 - 2 * i); // הזוג הראשון שמוצא 10, אחריו 8, 6...
const MSG_GAP_MS = 300;
const MSGS_PER_CHAT = 60;

function startRound(room, api) {
  const g = room.game;
  api.clearTimer();
  g.round++;
  const ids = shuffle(api.activeIds());
  if (g.round > g.totalRounds || ids.length < 2) return api.endGame();

  // זוגות, ואם נשאר אחד - מצטרף לזוג האחרון
  const groups = [];
  for (let i = 0; i + 1 < ids.length; i += 2) groups.push([ids[i], ids[i + 1]]);
  if (ids.length % 2) groups[groups.length - 1].push(ids[ids.length - 1]);

  const max = Math.max(room.settings.max, groups.length);
  const pool = shuffle(Array.from({ length: max }, (_, i) => i + 1));
  const num = {};
  groups.forEach((grp, i) => grp.forEach((id) => (num[id] = pool[i])));

  Object.assign(g, {
    phase: 'play',
    players: ids,
    max,
    num,
    status: Object.fromEntries(ids.map((id) => [id, 'alive'])), // alive | dead | found
    why: {}, // למה נפסלת - רק אתה רואה: { type: 'kill' | 'miss' | 'wrong', by }
    found: 0,
    log: [],
    logSeq: 0,
    chats: {},
    msgSeq: 0,
    lastMsg: {},
    roundPoints: {},
  });
  api.setTimer(api.time('play'), () => endRound(room, api));
}

const alive = (g, id) => g.status[id] === 'alive';
const chatKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function addLog(g, entry) {
  g.log.push({ id: ++g.logSeq, ...entry });
  if (g.log.length > 80) g.log.shift();
}

function score(api, g, id, pts) {
  api.addScore(id, pts);
  g.roundPoints[id] = (g.roundPoints[id] || 0) + pts;
}

function knockOut(g, ids, why) {
  for (const id of ids) {
    g.status[id] = 'dead';
    g.why[id] = why;
  }
}

// אין יותר מה לעשות כשלאף שחקן במשחק אין תאום שעוד במשחק
function maybeEnd(room, api) {
  const g = room.game;
  if (g.phase !== 'play') return;
  const live = g.players.filter((id) => alive(g, id) && api.isConnected(id));
  const canFind = live.some((a) => live.some((b) => a !== b && g.num[a] === g.num[b]));
  if (!canFind) endRound(room, api);
}

function endRound(room, api) {
  const g = room.game;
  api.clearTimer();
  g.phase = 'results';
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => startRound(room, api));
}

export default {
  id: 'twins',
  minPlayers: 3,
  noChat: true, // מדברים רק בהודעות פרטיות בתוך המשחק

  sanitize(s, n) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 1),
      max: clampInt(s.max, 5, 500, Math.max(10, n * 2)),
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
    if (g.phase !== 'play' || !g.players.includes(pid)) return;

    if (type === 'dm') {
      const to = String(data?.to ?? '');
      const text = cleanText(data?.text, 150);
      if (!text || to === pid || !g.players.includes(to)) return;
      if (g.status[pid] === 'dead') return 'נפסלת - אי אפשר לשלוח הודעות 💀';
      const now = Date.now();
      if (now - (g.lastMsg[pid] || 0) < MSG_GAP_MS) return 'לאט לאט 🙂';
      g.lastMsg[pid] = now;
      const key = chatKey(pid, to);
      const list = (g.chats[key] ||= []);
      list.push({ id: ++g.msgSeq, from: pid, text });
      if (list.length > MSGS_PER_CHAT) list.shift();
      return;
    }

    if (!alive(g, pid)) return 'כבר לא במשחק';

    if (type === 'shoot') {
      const n = clampInt(data, 1, g.max, null);
      if (n == null) return `מספר בין 1 ל-${g.max}`;
      if (n === g.num[pid]) return 'זה המספר שלך 🙃';
      const victims = g.players.filter((id) => alive(g, id) && g.num[id] === n);
      if (victims.length) {
        knockOut(g, victims, { type: 'kill', by: pid });
        score(api, g, pid, KILL_PTS * victims.length);
        addLog(g, { type: 'out', ids: victims });
      } else {
        // אין לאף אחד במשחק את המספר הזה - אתה והתאום שלך בחוץ
        const mine = g.players.filter((id) => alive(g, id) && g.num[id] === g.num[pid]);
        knockOut(g, mine, { type: 'miss', by: pid });
        addLog(g, { type: 'out', ids: mine });
      }
      return maybeEnd(room, api);
    }

    if (type === 'guess') {
      const target = String(data ?? '');
      if (target === pid || !g.players.includes(target)) return;
      if (!alive(g, target)) return 'השחקן הזה כבר לא במשחק';
      if (g.num[target] !== g.num[pid]) {
        knockOut(g, [pid], { type: 'wrong', by: target });
        addLog(g, { type: 'out', ids: [pid] });
        return maybeEnd(room, api);
      }
      const group = g.players.filter((id) => alive(g, id) && g.num[id] === g.num[pid]);
      const pts = foundPts(g.found++);
      for (const id of group) {
        g.status[id] = 'found';
        score(api, g, id, pts);
      }
      addLog(g, { type: 'found', ids: group, pts, by: pid });
      return maybeEnd(room, api);
    }
  },

  check(room, api) {
    maybeEnd(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const inGame = g.players.includes(pid);
    const results = g.phase === 'results';
    const chats = {};
    if (inGame) {
      for (const id of g.players) {
        if (id !== pid && g.chats[chatKey(pid, id)]) chats[id] = g.chats[chatKey(pid, id)];
      }
    }
    // בסוף הסיבוב מגלים את כל המספרים
    let groups = null;
    if (results) {
      const by = {};
      for (const id of g.players) (by[g.num[id]] ||= []).push(id);
      groups = Object.entries(by)
        .map(([n, ids]) => ({ n: Number(n), ids }))
        .sort((a, b) => a.n - b.n);
    }
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      max: g.max,
      players: g.players,
      status: g.status,
      myNum: inGame ? g.num[pid] : null,
      why: g.why[pid] || null,
      log: g.log,
      chats,
      groups,
      roundPoints: results ? g.roundPoints : null,
      killPts: KILL_PTS,
      nextFoundPts: foundPts(g.found),
    };
  },
};
