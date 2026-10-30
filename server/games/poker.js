// משחק 8: פוקר (טקסס הולדם). הנקודות הן הכסף של כל שחקן
import { shuffle, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { turn: 30 };
const SUITS = ['♠', '♥', '♦', '♣'];
const STREETS = ['preflop', 'flop', 'turn', 'river'];
const HAND_NAMES = ['קלף גבוה', 'זוג', 'שני זוגות', 'שלישייה', 'רצף', 'צבע', 'פול האוס', 'רביעייה', 'רצף בצבע'];

// חפיסה מלאה של 52 קלפים: כל ערך מופיע 4 פעמים בדיוק (אחד מכל צורה)
function newDeck() {
  const deck = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return shuffle(deck);
}

// ---------- דירוג ידיים ----------
function eval5(cards) {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === '14,5,4,3,2') straightHigh = 5; // A-2-3-4-5
  }
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  // ממוינים לפי כמות ואז לפי גובה הקלף
  const groups = Object.entries(counts)
    .map(([r, n]) => [n, +r])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map((x) => x[1]);
  const shape = groups.map((x) => x[0]).join('');

  if (straightHigh && flush) return [8, straightHigh];
  if (shape === '41') return [7, ...byGroup];
  if (shape === '32') return [6, ...byGroup];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (shape === '311') return [3, ...byGroup];
  if (shape === '221') return [2, ...byGroup];
  if (shape === '2111') return [1, ...byGroup];
  return [0, ...ranks];
}

function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

function combos(arr, k, start = 0, pick = [], out = []) {
  if (pick.length === k) out.push([...pick]);
  else for (let i = start; i < arr.length; i++) combos(arr, k, i + 1, [...pick, arr[i]], out);
  return out;
}

// היד הטובה ביותר מכל 5 קלפים מתוך הקלפים הזמינים (5 עד 7)
function bestHand(cards) {
  let best = null;
  for (const five of combos(cards, 5)) {
    const score = eval5(five);
    if (!best || compare(score, best.score) > 0) best = { score, cards: five };
  }
  const cat = best.score[0];
  const name = cat === 8 && best.score[1] === 14 ? 'רויאל פלאש' : HAND_NAMES[cat];
  return { ...best, name };
}

// ---------- מהלך יד ----------
function seatsFrom(g, startId) {
  // סדר הישיבה החל מהשחקן שאחרי startId, רק מי שבתוך היד
  const ids = g.handIds;
  const i = ids.indexOf(startId);
  return [...ids.slice(i + 1), ...ids.slice(0, i + 1)];
}

function canAct(g, id) {
  const p = g.ps[id];
  return !p.folded && !p.allIn;
}

function alive(g) {
  return g.handIds.filter((id) => !g.ps[id].folded);
}

function putChips(g, api, id, amount) {
  const p = g.ps[id];
  const amt = Math.min(amount, g.chips[id]);
  g.chips[id] -= amt;
  p.bet += amt;
  p.total += amt;
  if (g.chips[id] === 0) p.allIn = true;
  api.addScore(id, -amt);
  return amt;
}

function nextHand(room, api) {
  const g = room.game;
  g.hand++;
  const ready = g.seats.filter((id) => g.chips[id] > 0 && api.isConnected(id));
  if (g.hand > g.totalHands || ready.length < 2) return api.endGame();

  // הדילר זז בכל יד לשחקן הבא בסדר הישיבה שיכול לשחק
  const n = g.seats.length;
  let start = g.seats.indexOf(g.dealerId);
  for (let k = 1; k <= n; k++) {
    const id = g.seats[(start + k) % n];
    if (ready.includes(id)) {
      g.dealerId = id;
      break;
    }
  }
  g.handIds = g.seats.filter((id) => ready.includes(id));
  g.deck = newDeck();
  g.board = [];
  g.ps = {};
  for (const id of g.handIds) {
    g.ps[id] = { cards: [g.deck.pop(), g.deck.pop()], bet: 0, total: 0, folded: false, allIn: false, acted: false };
  }
  g.phase = 'bet';
  g.street = 0;
  g.results = null;
  g.lastAction = null;

  // בלינדים. בשניים: הדילר הוא הסמול בליינד
  const bb = room.settings.bigBlind;
  const order = seatsFrom(g, g.dealerId);
  const heads = g.handIds.length === 2;
  g.sbId = heads ? g.dealerId : order[0];
  g.bbId = heads ? order[0] : order[1];
  putChips(g, api, g.sbId, Math.floor(bb / 2));
  putChips(g, api, g.bbId, bb);
  g.currentBet = bb;
  g.minRaise = bb;

  const first = seatsFrom(g, g.bbId).find((id) => canAct(g, id));
  if (!first) return advance(room, api);
  setTurn(room, api, first);
}

function setTurn(room, api, id) {
  const g = room.game;
  g.toAct = id || null;
  if (!id) return;
  if (!api.isConnected(id)) return autoAct(room, api);
  api.setTimer(api.time('turn'), () => autoAct(room, api));
}

// נגמר הזמן או שהשחקן התנתק: צ׳ק אם אפשר, אחרת מקפלים
function autoAct(room, api) {
  const g = room.game;
  if (g.phase !== 'bet' || !g.toAct) return;
  const p = g.ps[g.toAct];
  doAction(room, api, g.toAct, p.bet === g.currentBet ? 'check' : 'fold');
}

function roundDone(g) {
  return g.handIds.every((id) => !canAct(g, id) || (g.ps[id].acted && g.ps[id].bet === g.currentBet));
}

function doAction(room, api, id, type, data) {
  const g = room.game;
  const p = g.ps[id];
  const toCall = g.currentBet - p.bet;
  const stack = g.chips[id];

  if (type === 'fold') {
    p.folded = true;
  } else if (type === 'check') {
    if (toCall > 0) return 'אי אפשר צ׳ק, צריך להשוות או לקפל';
  } else if (type === 'call') {
    if (toCall <= 0) return 'אין מה להשוות, אפשר צ׳ק';
    putChips(g, api, id, toCall);
  } else if (type === 'raise' || type === 'allin') {
    const max = p.bet + stack;
    let to = type === 'allin' ? max : clampInt(data, 0, max, 0);
    if (to <= g.currentBet) {
      if (type !== 'allin') return 'ההעלאה צריכה להיות גבוהה מההימור הנוכחי';
      putChips(g, api, id, toCall); // אול-אין בלי מספיק כסף להשוות
    } else {
      const full = to - g.currentBet >= g.minRaise;
      if (!full && to < max) return `העלאה מינימלית: עד ${g.currentBet + g.minRaise}`;
      putChips(g, api, id, to - p.bet);
      if (full) g.minRaise = to - g.currentBet;
      g.currentBet = to;
      // כולם צריכים להגיב להעלאה
      for (const other of g.handIds) if (other !== id) g.ps[other].acted = false;
    }
  } else {
    return;
  }
  p.acted = true;
  g.lastAction = { id, type: p.allIn && type !== 'fold' ? 'allin' : type, amount: p.bet };

  if (alive(g).length === 1) return finishHand(room, api);
  if (roundDone(g)) return advance(room, api);
  setTurn(room, api, seatsFrom(g, id).find((x) => canAct(g, x)));
}

// סוף סבב הימורים: פותחים קלפים, ואם אין מי שיכול להמר - פותחים הכל עד הסוף
function advance(room, api) {
  const g = room.game;
  for (;;) {
    if (g.street === 3) return finishHand(room, api);
    g.street++;
    if (g.street === 1) g.board.push(g.deck.pop(), g.deck.pop(), g.deck.pop());
    else g.board.push(g.deck.pop());
    g.currentBet = 0;
    g.minRaise = room.settings.bigBlind;
    for (const id of g.handIds) {
      g.ps[id].bet = 0;
      g.ps[id].acted = false;
    }
    const canBet = g.handIds.filter((id) => canAct(g, id));
    if (canBet.length >= 2) {
      return setTurn(room, api, seatsFrom(g, g.dealerId).find((id) => canAct(g, id)));
    }
  }
}

function finishHand(room, api) {
  const g = room.game;
  g.phase = 'showdown';
  g.toAct = null;
  const live = alive(g);
  const showdown = live.length > 1;
  const hands = {};
  if (showdown) for (const id of live) hands[id] = bestHand([...g.ps[id].cards, ...g.board]);

  // קופות צדדיות לפי כמה כל אחד שם ביד
  const won = {};
  const pots = [];
  const levels = [...new Set(g.handIds.map((id) => g.ps[id].total))].filter((x) => x > 0).sort((a, b) => a - b);
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    const parts = {};
    for (const id of g.handIds) {
      parts[id] = Math.max(0, Math.min(g.ps[id].total, level) - prev);
      amount += parts[id];
    }
    const eligible = live.filter((id) => g.ps[id].total >= level);
    prev = level;
    if (!amount) continue;
    if (!eligible.length) {
      // כסף שאף אחד שנשאר ביד לא יכל להשוות - חוזר למי ששם אותו
      for (const [id, x] of Object.entries(parts)) if (x) won[id] = (won[id] || 0) + x;
      continue;
    }
    let winners = eligible;
    if (showdown && eligible.length > 1) {
      let best = null;
      for (const id of eligible) {
        const c = best ? compare(hands[id].score, best) : 1;
        if (c > 0) {
          best = hands[id].score;
          winners = [id];
        } else if (c === 0) winners.push(id);
      }
    }
    // חלוקה שווה, והשארית לראשון אחרי הדילר
    const share = Math.floor(amount / winners.length);
    let rest = amount - share * winners.length;
    for (const id of seatsFrom(g, g.dealerId).filter((x) => winners.includes(x))) {
      const add = share + (rest-- > 0 ? 1 : 0);
      won[id] = (won[id] || 0) + add;
    }
    const last = pots[pots.length - 1];
    if (last && last.winners.join() === winners.join()) last.amount += amount;
    else pots.push({ amount, winners });
  }
  for (const [id, amt] of Object.entries(won)) {
    g.chips[id] += amt;
    api.addScore(id, amt);
  }

  g.results = {
    showdown,
    pots,
    won,
    hands: Object.fromEntries(Object.entries(hands).map(([id, h]) => [id, { name: h.name, cards: h.cards }])),
  };
  api.setTimer(api.revealTime(), () => nextHand(room, api));
}

export default {
  id: 'poker',
  minPlayers: 2,

  sanitize(s) {
    return {
      hands: clampInt(s.hands, 1, 100, 15),
      startChips: clampInt(s.startChips, 100, 100000, 1000),
      bigBlind: clampInt(s.bigBlind, 2, 10000, 20),
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.seats = shuffle(g.participants);
    g.chips = {};
    for (const id of g.seats) {
      g.chips[id] = room.settings.startChips;
      api.addScore(id, room.settings.startChips);
    }
    g.dealerId = g.seats[g.seats.length - 1];
    g.hand = 0;
    g.totalHands = room.settings.hands;
    nextHand(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'showdown') return;
      return nextHand(room, api);
    }
    if (g.phase !== 'bet' || pid !== g.toAct) return;
    return doAction(room, api, pid, type, data);
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'bet' && g.toAct && !api.isConnected(g.toAct)) autoAct(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const end = g.phase === 'showdown';
    const me = g.ps[pid];
    const v = {
      phase: g.phase,
      round: g.hand,
      totalRounds: g.totalHands,
      street: STREETS[g.street],
      board: g.board,
      pot: g.handIds.reduce((sum, id) => sum + g.ps[id].total, 0),
      toAct: g.toAct,
      lastAction: g.lastAction,
      bigBlind: room.settings.bigBlind,
      // בסוף כל יד רואים את הקלפים של כולם
      players: g.seats.map((id) => {
        const p = g.ps[id];
        return {
          id,
          chips: g.chips[id],
          inHand: !!p,
          bet: p?.bet || 0,
          total: p?.total || 0,
          folded: !!p?.folded,
          allIn: !!p?.allIn,
          dealer: id === g.dealerId,
          sb: id === g.sbId,
          bb: id === g.bbId,
          cards: p && (end || id === pid) ? p.cards : null,
        };
      }),
    };
    if (me && pid === g.toAct) {
      const toCall = g.currentBet - me.bet;
      const max = me.bet + g.chips[pid];
      v.options = {
        toCall: Math.min(toCall, g.chips[pid]),
        canCheck: toCall <= 0,
        minRaiseTo: Math.min(max, g.currentBet + g.minRaise),
        maxRaiseTo: max,
        canRaise: max > g.currentBet,
        currentBet: g.currentBet,
      };
    }
    if (me && !end && g.board.length >= 3) v.myHand = bestHand([...me.cards, ...g.board]).name;
    if (end) v.results = g.results;
    return v;
  },
};
