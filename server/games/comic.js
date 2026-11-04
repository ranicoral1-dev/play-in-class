// משחק: קומיקס בהמשכים - כל אחד פותח קומיקס, ובכל תור הקומיקס עובר הלאה.
// מי שמקבל אותו בוחר כמה גדולה תהיה המשבצת שלו בעמוד ומצייר בה.
// עמוד = רשת של COLS×ROWS תאים; כל משבצת תופסת מלבן של תאים, והיא תמיד נכנסת
// לתא הפנוי הראשון בסדר הקריאה (מלמעלה למטה, מימין לשמאל) - כך שהעמוד מתמלא בלי חורים.
import crypto from 'crypto';
import { shuffle, clampInt, sanitizeTimes } from '../utils.js';

const TIMES = { draw: 120, vote: 150 };
const RESULTS_SEC = 40;
const COLS = 3;
const ROWS = 3;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MODES = ['all', 'page', 'last'];

function decodeImage(data) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(data ?? ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  return { type: `image/${m[1]}`, buf };
}

// ---------- פריסת העמוד ----------
function grid(page) {
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (const b of page.blocks) {
    for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) cells[r][c] = true;
  }
  return cells;
}

function isFull(page) {
  return grid(page).every((row) => row.every(Boolean));
}

// התא הפנוי הראשון בעמוד (c=0 הוא הטור הימני)
function firstFree(page) {
  const cells = grid(page);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!cells[r][c]) return { r, c, cells };
  return null;
}

function fits(cells, r, c, w, h) {
  if (r + h > ROWS || c + w > COLS) return false;
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (cells[y][x]) return false;
  return true;
}

// העמוד שמציירים בו עכשיו: האחרון אם יש בו מקום, אחרת עמוד חדש (עוד לא נשמר)
function currentPage(comic) {
  const last = comic.pages[comic.pages.length - 1];
  return last && !isFull(last) ? last : null;
}

// איפה תיכנס המשבצת הבאה ואילו גדלים אפשריים
function slotFor(comic) {
  const page = currentPage(comic) || { blocks: [] };
  const { r, c, cells } = firstFree(page);
  const sizes = [];
  for (let h = 1; h <= ROWS; h++) for (let w = 1; w <= COLS; w++) if (fits(cells, r, c, w, h)) sizes.push({ w, h });
  return { r, c, sizes };
}

function fullPages(comic) {
  return comic.pages.filter(isFull).length;
}

// ---------- תורות ----------
function comicIndexFor(g, pid) {
  const i = g.order.indexOf(pid);
  const n = g.order.length;
  return (((i - (g.turn - 1)) % n) + n) % n;
}

function allDone(room) {
  const g = room.game;
  return g.comics.every((c) => fullPages(c) >= room.settings.pages);
}

function startTurn(room, api) {
  const g = room.game;
  if (g.turn > 0 && allDone(room)) return startVote(room, api);
  // רשת ביטחון: שני תורות ברצף שאף אחד לא צייר בהם - עוברים לדירוג
  if (g.emptyTurns >= 2) return startVote(room, api);
  g.turn++;
  g.phase = 'draw';
  g.drawings = {};
  api.setTimer(api.time('draw'), () => endTurn(room, api));
}

function endTurn(room, api) {
  const g = room.game;
  let added = 0;
  for (const id of g.order) {
    const d = g.drawings[id];
    if (!d) continue;
    const comic = g.comics[comicIndexFor(g, id)];
    const slot = slotFor(comic);
    if (!slot.sizes.some((s) => s.w === d.w && s.h === d.h)) continue;
    let page = currentPage(comic);
    if (!page) {
      page = { blocks: [] };
      comic.pages.push(page);
    }
    const token = crypto.randomBytes(12).toString('hex');
    g.files[token] = { type: d.type, buf: d.buf };
    page.blocks.push({ pid: id, r: slot.r, c: slot.c, w: d.w, h: d.h, token });
    comic.count++;
    added++;
  }
  g.emptyTurns = added ? 0 : g.emptyTurns + 1;
  startTurn(room, api);
}

function startVote(room, api) {
  const g = room.game;
  g.phase = 'vote';
  g.ratings = {};
  g.displayOrder = shuffle(g.comics.map((_, i) => i));
  api.setTimer(api.time('vote'), () => showResults(room, api));
}

function votersPending(room, api) {
  const g = room.game;
  return api.activeIds().filter((id) => !g.ratings[id]);
}

function showResults(room, api) {
  const g = room.game;
  g.phase = 'results';
  const n = g.order.length;
  const stats = g.comics.map((c, i) => {
    const vals = Object.values(g.ratings).map((r) => r[i]).filter((x) => typeof x === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { idx: i, ownerId: c.ownerId, avg: Math.round(avg * 10) / 10, votes: vals.length };
  });
  stats.sort((a, b) => b.avg - a.avg);
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

// ---------- תצוגה ----------
const src = (room, token) => `/img/${room.code}/${token}`;

function pageView(room, page, { images = true, authors = false } = {}) {
  return {
    full: isFull(page),
    blocks: page.blocks.map((b) => ({
      r: b.r,
      c: b.c,
      w: b.w,
      h: b.h,
      src: images ? src(room, b.token) : null,
      ...(authors ? { pid: b.pid } : {}),
    })),
  };
}

// מה רואה מי שמצייר עכשיו בקומיקס, לפי המצב שנבחר
function drawView(room, comic) {
  const mode = room.settings.mode;
  const cur = currentPage(comic);
  const out = { pages: [], last: null };
  const allBlocks = comic.pages.flatMap((p) => p.blocks);
  const lastBlock = allBlocks[allBlocks.length - 1];
  if (mode === 'all') {
    out.pages = comic.pages.filter((p) => p !== cur).map((p) => pageView(room, p));
  } else if (mode === 'page' && !cur && comic.pages.length) {
    // עמוד חדש מתחיל - מראים את העמוד הקודם בשביל ההקשר
    out.pages = [pageView(room, comic.pages[comic.pages.length - 1])];
  }
  if (mode === 'last' && lastBlock) out.last = { w: lastBlock.w, h: lastBlock.h, src: src(room, lastBlock.token) };
  // העמוד שמציירים בו - במצב "משבצת אחרונה" רואים רק את הצורה שלו, בלי הציורים
  out.current = cur ? pageView(room, cur, { images: mode !== 'last' }) : { full: false, blocks: [] };
  out.pageNum = cur ? comic.pages.length : comic.pages.length + 1;
  out.slot = slotFor(comic);
  out.isNew = comic.count === 0;
  return out;
}

export default {
  id: 'comic',
  minPlayers: 2,

  sanitize(s) {
    return {
      pages: clampInt(s.pages, 1, 10, 2),
      mode: MODES.includes(s.mode) ? s.mode : 'page',
      ...sanitizeTimes(s, TIMES),
    };
  },

  start(room, api) {
    const g = room.game;
    g.order = shuffle(g.participants);
    g.comics = g.order.map((id) => ({ ownerId: id, pages: [], count: 0 }));
    g.files = {};
    g.turn = 0;
    g.emptyTurns = 0;
    startTurn(room, api);
  },

  action(room, api, pid, type, data) {
    const g = room.game;
    if (type === 'next') {
      if (!api.isHost(pid) || g.phase !== 'results') return;
      return api.endGame();
    }
    if (g.phase === 'draw' && type === 'submit') {
      const comic = g.comics[comicIndexFor(g, pid)];
      const w = clampInt(data?.w, 1, COLS, 1);
      const h = clampInt(data?.h, 1, ROWS, 1);
      if (!slotFor(comic).sizes.some((s) => s.w === w && s.h === h)) return 'המשבצת לא נכנסת בעמוד';
      const img = decodeImage(data?.image);
      if (!img) return 'הציור גדול מדי או לא תקין';
      g.drawings[pid] = { ...img, w, h };
      if (api.activeIds().every((id) => g.drawings[id])) endTurn(room, api);
      return;
    }
    if (g.phase === 'vote' && type === 'rate') {
      const mine = g.order.indexOf(pid);
      const out = {};
      g.comics.forEach((_, i) => {
        if (i === mine) return;
        const v = clampInt(data?.[i], 1, 10, null);
        if (v !== null) out[i] = v;
      });
      if (Object.keys(out).length < g.comics.length - 1) return 'צריך לדרג את כל הקומיקסים';
      g.ratings[pid] = out;
      if (votersPending(room, api).length === 0) showResults(room, api);
    }
  },

  check(room, api) {
    const g = room.game;
    if (g.phase === 'draw' && api.activeIds().every((id) => g.drawings[id])) {
      endTurn(room, api);
    } else if (g.phase === 'vote' && votersPending(room, api).length === 0) {
      showResults(room, api);
    }
  },

  // הציורים לא נשלחים בתוך המצב (הוא נשלח לכולם בכל שינוי) אלא בכתובת נפרדת
  file(room, token) {
    return room.game?.files?.[token] || null;
  },

  view(room, pid) {
    const g = room.game;
    const target = room.settings.pages;
    const v = {
      phase: g.phase,
      turn: g.turn,
      target,
      mode: room.settings.mode,
      cols: COLS,
      rows: ROWS,
      // כמה עמודים מלאים יש בכל קומיקס (בלי לגלות של מי)
      progress: g.comics.map((c) => Math.min(fullPages(c), target)),
    };
    if (g.phase === 'draw') {
      const idx = comicIndexFor(g, pid);
      const comic = g.comics[idx];
      v.comic = drawView(room, comic);
      v.mine = idx === g.order.indexOf(pid);
      v.done = fullPages(comic) >= target;
      v.submittedIds = Object.keys(g.drawings);
      v.mySize = g.drawings[pid] ? { w: g.drawings[pid].w, h: g.drawings[pid].h } : null;
    }
    if (g.phase === 'vote' || g.phase === 'results') {
      const mine = g.order.indexOf(pid);
      v.comics = g.displayOrder.map((i) => ({
        idx: i,
        mine: i === mine,
        pages: g.comics[i].pages.map((p) => pageView(room, p)),
      }));
      v.votedIds = Object.keys(g.ratings);
      v.myRatings = g.ratings[pid] || null;
    }
    if (g.phase === 'results') {
      v.results = g.results.map((r) => ({
        ...r,
        pages: g.comics[r.idx].pages.map((p) => pageView(room, p, { authors: true })),
        authors: [...new Set(g.comics[r.idx].pages.flatMap((p) => p.blocks.map((b) => b.pid)))],
      }));
    }
    return v;
  },
};
