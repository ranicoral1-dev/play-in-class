export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

// הגדרות זמן משותפות לכל המשחקים: defs = { key: ברירת מחדל בשניות }
export function sanitizeTimes(s, defs) {
  const times = {};
  for (const [key, def] of Object.entries(defs)) {
    times[key] = clampInt(s.times?.[key], 5, 600, def);
  }
  return { timed: s.timed !== false, times };
}

export function cleanText(s, max = 200) {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// נרמול עברית: הסרת ניקוד, אותיות סופיות לרגילות, רווחים ואותיות קטנות
export function normalize(s) {
  return String(s ?? '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'״׳`.,!?\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// אותיות עבריות בלבד (מנורמלות) כמערך
export function hebrewLetters(s) {
  return normalize(s).replace(/[^א-ת]/g, '').split('');
}

// אותיות עבריות כפי שנכתבו (כולל אותיות סופיות) - לתצוגה
export function rawHebrewLetters(s) {
  return String(s ?? '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^א-ת]/g, '')
    .split('');
}

// השוואה "רכה" - יחיד/רבים, ה' הידיעה
export function stem(s) {
  return normalize(s)
    .split(' ')
    .map((w) => {
      let x = w;
      if (x.length > 2 && x.startsWith('ה')) x = x.slice(1);
      if (x.length > 3 && (x.endsWith('ימ') || x.endsWith('ות'))) x = x.slice(0, -2);
      if (x.length > 3 && x.endsWith('ה')) x = x.slice(0, -1);
      return x;
    })
    .join(' ');
}

export function fuzzyEqual(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || stem(na) === stem(nb);
}
