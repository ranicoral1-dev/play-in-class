export const EMOJIS = [
  '😎', '🤓', '🥳', '😜', '🤠', '👻', '🤖', '👽', '🦄', '🐶', '🐱', '🦊',
  '🐼', '🐸', '🐵', '🦁', '🐯', '🐙', '🦖', '🐧', '🍕', '🍩', '🌮', '⚽',
  '🎸', '🚀', '🌈', '🔥', '⭐', '💎', '🎩', '🧠',
];

export const GAME_META = {
  wyr: {
    name: 'מה אתה מעדיף',
    emoji: '🤔',
    color: 'from-pink-500 to-rose-500',
    desc: 'הקובע כותב דילמה, כולם בוחרים - ואז מנחשים מי בחר מה.',
    minPlayers: 3,
    settings: [{ key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 30, def: (n) => n }],
    timers: [
      { key: 'write', label: 'כתיבת הדילמה', def: 20 },
      { key: 'vote', label: 'בחירה בין האפשרויות', def: 60 },
      { key: 'guess', label: 'ניחוש מי בחר מה', def: 60 },
    ],
  },
  wordle: {
    name: 'נחש את המילה',
    emoji: '🟩',
    color: 'from-emerald-500 to-teal-500',
    desc: 'כל אחד בוחר מילה סודית ומנחש מילה של מישהו אחר. מי הכי מהיר?',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 10, def: () => 3 },
      { key: 'wordLength', label: 'אורך המילה', type: 'number', min: 3, max: 6, def: () => 5 },
      { key: 'maxGuesses', label: 'מקסימום ניחושים', type: 'number', min: 3, max: 10, def: () => 6 },
    ],
    timers: [
      { key: 'secret', label: 'בחירת מילה סודית', def: 45 },
      { key: 'guess', label: 'ניחוש המילה', def: 120 },
    ],
  },
  party: {
    name: 'מי בא למסיבה?',
    emoji: '🎉',
    color: 'from-amber-400 to-orange-500',
    desc: 'המארח בוחר קטגוריה סודית. תביאו משהו שמתאים - ותנחשו את הקטגוריה!',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 20, def: (n) => n },
      { key: 'turnsPerGuest', label: 'תורות לכל אורח', type: 'number', min: 1, max: 10, def: () => 4 },
      { key: 'maxCategoryGuesses', label: 'ניחושי קטגוריה לאורח', type: 'number', min: 1, max: 10, def: () => 2 },
    ],
    timers: [
      { key: 'category', label: 'המארח בוחר קטגוריה', def: 40 },
      { key: 'turn', label: 'תור של אורח', def: 40 },
      { key: 'review', label: 'המארח מאשר/דוחה', def: 25 },
    ],
  },
  story: {
    name: 'סיפור בהמשכים',
    emoji: '📜',
    color: 'from-sky-500 to-indigo-500',
    desc: 'ממשיכים סיפור רק מהמילה האחרונה שקיבלתם. בסוף מדרגים את כולם.',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'כמה פעמים הסיפור עובר', type: 'number', min: 2, max: 20, def: (n) => Math.max(3, n) },
      { key: 'maxWords', label: 'מקסימום מילים בכל קטע', type: 'number', min: 3, max: 40, def: () => 12 },
    ],
    timers: [
      { key: 'write', label: 'כתיבת כל קטע', def: 60 },
      { key: 'vote', label: 'קריאה ודירוג', def: 120 },
    ],
  },
  sameword: {
    name: 'אותה מילה',
    emoji: '🧠',
    color: 'from-violet-500 to-fuchsia-500',
    desc: 'כולם כותבים מילה, ואז מחפשים מילה שמחברת. המטרה: שכולם יגידו אותו דבר!',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 20, def: () => 6 },
      { key: 'withCategory', label: 'קטגוריה', type: 'toggle', on: 'עם קטגוריה', off: 'בלי קטגוריה', def: () => false },
    ],
    timers: [
      { key: 'category', label: 'בחירת קטגוריה', def: 25 },
      { key: 'write', label: 'כתיבת מילה', def: 45 },
    ],
  },
  quote: {
    name: 'ציטוט',
    emoji: '💬',
    color: 'from-red-500 to-orange-500',
    desc: 'כולם כותבים משפטים, והמנחש צריך לזהות מי כתב מה. כל טעות - נקודה לכותב!',
    minPlayers: 3,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 30, def: (n) => n },
      { key: 'perRound', label: 'משפטים בכל סיבוב', type: 'number', min: 1, max: 50, def: () => 10 },
      { key: 'perPerson', label: 'משפטים לכל שחקן', type: 'number', min: 1, max: 10, def: () => 3 },
    ],
    timers: [
      { key: 'write', label: 'כתיבת המשפטים', def: 90 },
      { key: 'guess', label: 'ניחוש מי כתב מה', def: 120 },
    ],
  },
  complete: {
    name: 'המשך את המשפט',
    emoji: '✏️',
    color: 'from-lime-500 to-green-600',
    desc: 'נותן המשפט משאיר מילים חסרות, כולם משלימים - ובוחרים את ההשלמה הכי טובה.',
    minPlayers: 3,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 30, def: (n) => n },
      { key: 'maxBlanks', label: 'מקסימום מילים חסרות', type: 'number', min: 1, max: 5, def: () => 2 },
    ],
    timers: [
      { key: 'write', label: 'כתיבת המשפט', def: 60 },
      { key: 'fill', label: 'השלמת המילים', def: 60 },
      { key: 'vote', label: 'בחירת ההשלמה הכי טובה', def: 60 },
    ],
  },
  poker: {
    name: 'פוקר',
    emoji: '🃏',
    color: 'from-emerald-600 to-green-800',
    desc: 'טקסס הולדם אמיתי: הנקודות הן כסף. מהמרים, מעלים, מקפלים - ומי שנשאר עם הכי הרבה כסף מנצח.',
    minPlayers: 2,
    settings: [
      { key: 'hands', label: 'מספר ידיים', type: 'number', min: 1, max: 100, def: () => 15 },
      { key: 'startChips', label: 'כסף התחלתי לכל שחקן', type: 'number', min: 100, max: 100000, step: 100, def: () => 1000 },
      { key: 'bigBlind', label: 'ביג בליינד (הסמול הוא חצי)', type: 'number', min: 2, max: 10000, step: 2, def: () => 20 },
    ],
    timers: [{ key: 'turn', label: 'זמן לכל תור', def: 30 }],
  },
  town: {
    name: 'עיירה',
    emoji: '🏘️',
    color: 'from-slate-700 to-indigo-900',
    desc: 'כל אחד מקבל תפקיד סודי: מתחזים מחסלים, שוטרים עוצרים, חובש מרפא, מנעולן משחרר מהכלא - ומי ששורד מרוויח.',
    minPlayers: 3,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 20, def: () => 3 },
      { key: 'imposters', label: '🔪 מתחזים', type: 'number', min: 1, max: 5, def: (n) => (n >= 9 ? 2 : 1) },
      { key: 'police', label: '👮 שוטרים', type: 'number', min: 1, max: 5, def: (n) => (n >= 9 ? 2 : 1) },
      { key: 'lockers', label: '🔑 מנעולנים', type: 'number', min: 0, max: 5, def: (n) => (n >= 5 ? 1 : 0) },
      { key: 'medics', label: '🩺 חובשים', type: 'number', min: 0, max: 5, def: (n) => (n >= 4 ? 1 : 0) },
      { key: 'jesters', label: '🤡 ליצנים', type: 'number', min: 0, max: 5, def: (n) => (n >= 7 ? 1 : 0) },
    ],
    note: 'כל מי שלא קיבל תפקיד - אזרח 🧑. אם יש יותר תפקידים משחקנים, מורידים אוטומטית.',
    timers: [{ key: 'night', label: 'בחירה בלילה', def: 60 }],
  },
  war: {
    name: 'מלחמה',
    emoji: '⚔️',
    color: 'from-red-700 to-amber-600',
    desc: 'כל אחד בונה ממלכה על מפה של מחומשים. חקלאים, בנאים, אבירים ומגלי ארצות - בזמן אמת, בלי תורות. כורתים בריתות, סוחרים, ונלחמים!',
    minPlayers: 2,
    settings: [{ key: 'minutes', label: 'אורך המשחק (דקות)', type: 'number', min: 5, max: 120, step: 5, def: () => 20 }],
    note: 'בלי זמן - המשחק נמשך עד שהמארח לוחץ ״סיום משחק״.',
    timers: [{ key: 'place', label: 'הנחת האדמות בהתחלה', def: 60 }],
  },
};

const FINAL_FORMS = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };

// השרת מנרמל אותיות סופיות - כאן מחזירים אותן לתצוגה
export function withFinals(word) {
  if (!word) return '';
  const last = word[word.length - 1];
  return FINAL_FORMS[last] ? word.slice(0, -1) + FINAL_FORMS[last] : word;
}

const TO_REGULAR = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
export function regular(ch) {
  return TO_REGULAR[ch] || ch;
}

export function hebrewOnly(s) {
  return String(s || '').replace(/[^א-ת]/g, '');
}
