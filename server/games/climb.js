// משחק: יום בחיי זרוע - זוגות, כל שחקן שולט ביד אחת של מטפס (שמאל או ימין).
// לוחצים כדי לתפוס בקיר וגוררים למטה כדי למשוך את הגוף למעלה. הגוף זז לפי הממוצע של הידיים שתופסות:
// אם יד אחת מושכת שמאלה והשנייה ימינה - לא זזים. יד שנמתחת יותר מדי עוזבת, ובלי ידיים על הקיר - נופלים.
// עציצים נופלים וציפורים עפות - מכה מפילה את הידיים מהקיר. מי שמגיע ראשון לגג מנצח.
import { shuffle, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { climb: 180 };
const RESULTS_SEC = 12;
const TICK_MS = 50;
// יחידות עולם: רוחב הבניין 100, הגובה לפי ההגדרות. y=0 הקרקע, y גדל למעלה
const W = 100;
const REACH = 30; // אורך היד
const SNAP = REACH * 1.35; // יד שנמתחת יותר מזה עוזבת
const SH_X = 7; // הכתפיים ביחס למרכז הגוף
const SH_Y = 10;
const MAX_STEP = 5; // כמה הגוף יכול לזוז בכל טיק
const GRAVITY = 0.7;
const MAX_FALL = 7;
const BODY_R = 9;
const POT_R = 4;
const BIRD_R = 5;
const STUN_MS = 1200;
const PLACE_PTS = [6, 4, 3, 2];
const HANDS = ['L', 'R'];

const shoulder = (t, h) => ({ x: t.x + (h === 'L' ? -SH_X : SH_X), y: t.y + SH_Y });

function clampOffset(x, y) {
  const d = Math.hypot(x, y);
  if (d <= REACH || !d) return { x, y };
  return { x: (x / d) * REACH, y: (y / d) * REACH };
}

function handPos(t, h) {
  const hand = t.hands[h];
  if (hand.grip) return { x: hand.gx, y: hand.gy };
  const s = shoulder(t, h);
  return { x: s.x + hand.ox, y: s.y + hand.oy };
}

function grab(t, h) {
  const hand = t.hands[h];
  const p = handPos(t, h);
  Object.assign(hand, { grip: true, gx: p.x, gy: p.y });
}

function release(t, h) {
  const hand = t.hands[h];
  if (!hand.grip) return;
  // היד נשארת איפה שהיא ביחס לכתף, כדי שלא תקפוץ
  const s = shoulder(t, h);
  const o = clampOffset(hand.gx - s.x, hand.gy - s.y);
  Object.assign(hand, { grip: false, ox: o.x, oy: o.y });
}

// ציפורים: אותו מסלול לכל הקבוצות, כדי שיהיה הוגן
function makeBirds(height) {
  const birds = [];
  for (let y = 160; y < height - 40; y += 90 + Math.random() * 80) {
    birds.push({ y, speed: 0.6 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2 });
  }
  return birds;
}

const birdX = (b, t) => W / 2 + (W / 2 - 8) * Math.sin(b.phase + (t / 1000) * b.speed);

function startRound(room, api) {
  const g = room.game;
  api.clearTimer();
  api.clearTick();
  g.round++;
  const ids = shuffle(api.activeIds());
  if (g.round > g.totalRounds || ids.length < 2) return api.endGame();

  // זוגות; אם נשאר אחד - הוא שולט בשתי הידיים לבד
  const teams = [];
  for (let i = 0; i < ids.length; i += 2) {
    const L = ids[i];
    const R = ids[i + 1] ?? ids[i];
    teams.push({
      ctrl: { L, R },
      x: W / 2,
      y: 0,
      vy: 0,
      hands: {
        L: { grip: false, ox: -4, oy: 22, gx: 0, gy: 0 },
        R: { grip: false, ox: 4, oy: 22, gx: 0, gy: 0 },
      },
      pots: [],
      nextPot: Date.now() + 2000 + Math.random() * 2000,
      stunUntil: 0,
      snapAt: { L: 0, R: 0 },
      hitAt: 0,
      best: 0,
      place: null,
      doneAt: null,
    });
  }
  Object.assign(g, {
    phase: 'climb',
    teams,
    height: room.settings.height,
    birds: makeBirds(room.settings.height),
    startedAt: Date.now(),
    places: 0,
    potSeq: 0,
    roundPoints: {},
  });
  api.setTimer(api.time('climb'), () => endRound(room, api));
  api.setTick(TICK_MS, () => tick(room, api));
}

function knock(t, now) {
  release(t, 'L');
  release(t, 'R');
  t.stunUntil = now + STUN_MS;
  t.hitAt = now;
}

function tick(room, api) {
  const g = room.game;
  if (g.phase !== 'climb') return;
  const now = Date.now();
  const time = now - g.startedAt;
  for (const t of g.teams) {
    if (t.place) continue;
    const gripping = HANDS.filter((h) => t.hands[h].grip);
    if (gripping.length) {
      // כל יד שתופסת "רוצה" שהגוף יהיה במקום שבו הכתף נמצאת ביחס ליד - והגוף הולך לממוצע
      let tx = 0;
      let ty = 0;
      for (const h of gripping) {
        const hand = t.hands[h];
        tx += hand.gx - (h === 'L' ? -SH_X : SH_X) - hand.ox;
        ty += hand.gy - SH_Y - hand.oy;
      }
      tx /= gripping.length;
      ty /= gripping.length;
      const dx = tx - t.x;
      const dy = ty - t.y;
      const d = Math.hypot(dx, dy);
      const k = d > MAX_STEP ? MAX_STEP / d : 1;
      t.x += dx * k;
      t.y += dy * k;
      t.vy = 0;
    } else {
      t.vy = Math.max(t.vy - GRAVITY, -MAX_FALL);
      t.y += t.vy;
    }
    if (t.y <= 0) {
      t.y = 0;
      t.vy = 0;
    }
    t.x = Math.max(12, Math.min(W - 12, t.x));
    // יד שנמתחה יותר מדי עוזבת
    for (const h of gripping) {
      const s = shoulder(t, h);
      if (Math.hypot(t.hands[h].gx - s.x, t.hands[h].gy - s.y) > SNAP) {
        release(t, h);
        t.snapAt[h] = now;
      }
    }

    // עציצים
    if (now >= t.nextPot && t.y > 30) {
      t.pots.push({ id: ++g.potSeq, x: 12 + Math.random() * (W - 24), y: t.y + 120, vy: 1.6 + Math.random() * 1.4 });
      t.nextPot = now + 1300 + Math.random() * 2200;
    }
    for (const p of t.pots) p.y -= p.vy;
    t.pots = t.pots.filter((p) => p.y > t.y - 120 && p.y > -10);
    if (now >= t.stunUntil) {
      const hitPot = t.pots.find((p) => Math.hypot(p.x - t.x, p.y - t.y) < BODY_R + POT_R);
      const hitBird = g.birds.find((b) => Math.abs(b.y - t.y) < 30 && Math.hypot(birdX(b, time) - t.x, b.y - t.y) < BODY_R + BIRD_R);
      if (hitPot || hitBird) {
        knock(t, now);
        if (hitPot) t.pots = t.pots.filter((p) => p !== hitPot);
      } else {
        // מכה ביד בלבד - רק היד הזאת עוזבת
        for (const h of HANDS) {
          const hp = handPos(t, h);
          const hit = t.pots.find((p) => Math.hypot(p.x - hp.x, p.y - hp.y) < POT_R + 3);
          if (hit && t.hands[h].grip) {
            release(t, h);
            t.pots = t.pots.filter((p) => p !== hit);
          }
        }
      }
    }

    t.best = Math.max(t.best, t.y);
    if (t.y >= g.height) {
      t.y = g.height;
      t.place = ++g.places;
      t.doneAt = now - g.startedAt;
    }
  }
  if (g.teams.every((t) => t.place)) endRound(room, api);
}

function endRound(room, api) {
  const g = room.game;
  if (g.phase !== 'climb') return;
  api.clearTimer();
  api.clearTick();
  // מי שלא הגיע לגג - לפי הגובה
  const rest = g.teams.filter((t) => !t.place).sort((a, b) => b.y - a.y);
  for (const t of rest) t.place = ++g.places;
  for (const t of g.teams) {
    const pts = PLACE_PTS[t.place - 1] ?? 1;
    for (const id of new Set([t.ctrl.L, t.ctrl.R])) {
      api.addScore(id, pts);
      g.roundPoints[id] = pts;
    }
  }
  g.phase = 'results';
  api.setTimer(room.settings.timed ? RESULTS_SEC : null, () => startRound(room, api));
}

const r1 = (n) => Math.round(n * 10) / 10;

export default {
  id: 'climb',
  minPlayers: 2,
  lazy: ['hand'], // התנועה מסונכרנת ממילא בכל טיק

  sanitize(s) {
    return {
      rounds: clampInt(s.rounds, 1, 10, 3),
      height: clampInt(s.height, 200, 3000, 700),
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
    if (type !== 'hand' || g.phase !== 'climb') return;
    const h = data?.h === 'L' ? 'L' : data?.h === 'R' ? 'R' : null;
    const t = h && g.teams.find((x) => x.ctrl[h] === pid);
    if (!t || t.place) return;
    const x = Number(data.x);
    const y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const hand = t.hands[h];
    const o = clampOffset(x, y);
    hand.ox = o.x;
    hand.oy = o.y;
    if (data.grip === true && !hand.grip && Date.now() >= t.stunUntil) grab(t, h);
    else if (data.grip === false) release(t, h);
  },

  check(room, api) {
    const g = room.game;
    if (g.phase !== 'climb') return;
    // אם כל מי שעוד מטפס יצא - מסיימים
    if (g.teams.every((t) => t.place || (!api.isConnected(t.ctrl.L) && !api.isConnected(t.ctrl.R)))) endRound(room, api);
  },

  view(room, pid) {
    const g = room.game;
    const now = Date.now();
    const time = now - g.startedAt;
    const mine = g.teams.findIndex((t) => t.ctrl.L === pid || t.ctrl.R === pid);
    const my = g.teams[mine];
    return {
      phase: g.phase,
      round: g.round,
      totalRounds: g.totalRounds,
      height: g.height,
      reach: REACH,
      shX: SH_X,
      shY: SH_Y,
      mine,
      teams: g.teams.map((t) => ({
        ctrl: t.ctrl,
        x: r1(t.x),
        y: r1(t.y),
        hands: Object.fromEntries(HANDS.map((h) => [h, { ...mapPos(handPos(t, h)), grip: t.hands[h].grip }])),
        stunned: now < t.stunUntil,
        place: t.place,
        doneAt: t.doneAt,
      })),
      pots: my ? my.pots.map((p) => ({ id: p.id, x: r1(p.x), y: r1(p.y) })) : [],
      birds: my ? g.birds.filter((b) => Math.abs(b.y - my.y) < 200).map((b) => ({ x: r1(birdX(b, time)), y: r1(b.y), dir: Math.cos(b.phase + (time / 1000) * b.speed) > 0 ? 1 : -1 })) : [],
      snap: my ? { L: now - my.snapAt.L < 900, R: now - my.snapAt.R < 900 } : null,
      hit: my ? now - my.hitAt < 900 : false,
      roundPoints: g.phase === 'results' ? g.roundPoints : null,
    };
  },
};

const mapPos = (p) => ({ x: r1(p.x), y: r1(p.y) });
