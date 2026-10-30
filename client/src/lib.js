export const EMOJIS = [
  '😎', '🤓', '🥳', '😜', '🤠', '👻', '🤖', '👽', '🦄', '🐶', '🐱', '🦊',
  '🐼', '🐸', '🐵', '🦁', '🐯', '🐙', '🦖', '🐧', '🍕', '🍩', '🌮', '⚽',
  '🎸', '🚀', '🌈', '🔥', '⭐', '💎', '🎩', '🧠',
];

// ז'אנרים: אימוג'י וצבע לכל אחד
export const GENRES = {
  אסטרטגיה: '♟️',
  'זמן אמת': '⚡',
  קלפים: '🃏',
  'תפקידים סודיים': '🎭',
  בלוף: '🤥',
  מילים: '🔤',
  ניחושים: '🔍',
  קבוצות: '🤝',
  שיתופי: '🫂',
  חברתי: '💬',
  יצירתי: '🎨',
  כתיבה: '✍️',
};

export const GAME_META = {
  wyr: {
    name: 'מה אתה מעדיף',
    emoji: '🤔',
    genres: ['חברתי', 'ניחושים'],
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
    genres: ['מילים', 'ניחושים'],
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
    genres: ['ניחושים', 'מילים'],
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
    genres: ['יצירתי', 'כתיבה'],
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
    genres: ['מילים', 'שיתופי'],
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
    genres: ['חברתי', 'כתיבה', 'ניחושים'],
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
    genres: ['יצירתי', 'כתיבה'],
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
    genres: ['קלפים', 'אסטרטגיה'],
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
    genres: ['תפקידים סודיים', 'בלוף'],
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
    genres: ['אסטרטגיה', 'זמן אמת'],
    color: 'from-red-700 to-amber-600',
    desc: 'כל אחד בונה ממלכה על מפה של מחומשים. חקלאים, בנאים, אבירים ומגלי ארצות - בזמן אמת, בלי תורות. כורתים בריתות, סוחרים, ונלחמים!',
    minPlayers: 2,
    settings: [{ key: 'minutes', label: 'אורך המשחק (דקות)', type: 'number', min: 5, max: 120, step: 5, def: () => 20 }],
    note: 'בלי זמן - המשחק נמשך עד שהמארח לוחץ ״סיום משחק״.',
    timers: [{ key: 'place', label: 'הנחת האדמות בהתחלה', def: 60 }],
  },
  alias: {
    name: 'אליאס',
    emoji: '🗣️',
    genres: ['קבוצות', 'מילים'],
    color: 'from-cyan-500 to-blue-600',
    desc: 'מתחלקים לקבוצות. המסביר מקבל כרטיס עם 8 מילים ומסביר לקבוצה בצ׳אט - בלי המילה, בלי השורש ובלי אנגלית. כל ניחוש = משבצת קדימה!',
    minPlayers: 4,
    settings: [
      { key: 'teams', label: 'מספר קבוצות', type: 'number', min: 2, max: 4, def: () => 2 },
      { key: 'turnsPerPlayer', label: 'כמה פעמים כל אחד מסביר', type: 'number', min: 1, max: 10, def: () => 2 },
      { key: 'laps', label: 'אורך הלוח (סיבובים של 1-8)', type: 'number', min: 1, max: 10, def: () => 4 },
    ],
    note: 'בכל קבוצה לפחות 2, והקבוצות כמעט שוות (4 → 2+2, 5 → 3+2). אם אין מספיק שחקנים - פחות קבוצות. דילוג או שימוש במילה/בשורש/באנגלית = משבצת אחורה.',
    timers: [
      { key: 'teams', label: 'חלוקה לקבוצות', def: 60 },
      { key: 'turn', label: 'זמן לכל תור', def: 60 },
    ],
  },
  odd: {
    name: 'מי השונה',
    emoji: '🕵️',
    genres: ['תפקידים סודיים', 'בלוף', 'מילים'],
    color: 'from-zinc-600 to-stone-800',
    desc: 'כולם מקבלים מילה - חוץ מהשונה. כל אחד מתאר בתורו, ואז מצביעים מי השונה. מתחזה (שלא יודע שהוא מתחזה) או איש לבן (שיודע, ומקבל רק קטגוריה).',
    minPlayers: 3,
    settings: [
      { key: 'white', label: 'מצב משחק', type: 'toggle', on: '🤍 איש לבן', off: '🕵️ מתחזה', def: () => false },
      { key: 'odds', label: 'כמה שונים', type: 'number', min: 1, max: 5, def: (n) => (n >= 7 ? 2 : 1) },
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 20, def: () => 3 },
      { key: 'builtin', label: 'אילו מילים', type: 'toggle', on: 'שלנו + של המשחק', off: 'רק שלנו', def: () => true },
      {
        key: 'customWords',
        label: 'המילים שלנו (לא חובה) - שורה לכל זוג: מילה, מילה דומה, קטגוריה',
        type: 'textarea',
        placeholder: 'פיצה, פסטה, אוכל\nכדורגל, כדורסל, ספורט',
        hint: 'בכל סיבוב מוגרל מי מהשתיים היא המילה האמיתית ומי של המתחזה. הקטגוריה הולכת לאיש הלבן. אף אחד חוץ מכם לא רואה את הרשימה.',
        def: () => '',
      },
    ],
    note: 'השונים תמיד פחות מחצי מהשחקנים. בהצבעה אפשר גם לדלג - ואז עוד סבב תיאורים.',
    timers: [
      { key: 'describe', label: 'תיאור בכל תור', def: 30 },
      { key: 'vote', label: 'הצבעה', def: 45 },
    ],
  },
  reel: {
    name: 'צור ריל',
    emoji: '🎬',
    genres: ['יצירתי', 'חברתי'],
    color: 'from-fuchsia-500 to-purple-700',
    desc: 'כל סיבוב יוצרים מים או ריל - מתמונות שלכם, תמונות שמדביקים או המדבקות והתבניות של המשחק. אחר כך כולם מדרגים 1-10.',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'מספר סיבובים', type: 'number', min: 1, max: 20, def: () => 3 },
      { key: 'withCategory', label: 'קטגוריה', type: 'toggle', on: '🎯 עם קטגוריה', off: '🤪 חופשי', def: () => true },
      {
        key: 'customCategories',
        label: 'קטגוריות משלנו (לא חובה) - שורה לכל קטגוריה',
        type: 'textarea',
        placeholder: 'כשהמורה מאחר\nהאוכל בקפיטריה',
        hint: 'הקטגוריות שלכם יוצאות קודם, ואחריהן של המשחק. עובד רק ״עם קטגוריה״.',
        def: () => '',
      },
    ],
    note: 'הממים אנונימיים בזמן הדירוג, ואי אפשר לדרג את של עצמך. ניקוד לפי הממוצע: מקום ראשון מקבל הכי הרבה.',
    timers: [
      { key: 'create', label: 'יצירת המים', def: 180 },
      { key: 'vote', label: 'דירוג', def: 90 },
    ],
  },
  coin: {
    name: 'מטבע הסודות',
    emoji: '🪙',
    genres: ['חברתי', 'בלוף'],
    color: 'from-yellow-400 to-amber-600',
    desc: 'הבוחר מקבל שאלה סודית כמו ״מי יעשה הכל בשביל שקל?״ ועונה בשם של מישהו. כולם רואים את השם - לא את השאלה. ואז עץ או פלי: צדק - השאלה נשארת סוד, טעה - כולם רואים!',
    minPlayers: 2,
    settings: [
      { key: 'rounds', label: 'כמה פעמים כל אחד בוחר', type: 'number', min: 1, max: 10, def: () => 2 },
      { key: 'builtin', label: 'אילו שאלות', type: 'toggle', on: 'שלנו + של המשחק', off: 'רק שלנו', def: () => true },
      {
        key: 'customWords',
        label: 'השאלות שלנו (לא חובה) - שורה לכל שאלה',
        type: 'textarea',
        placeholder: 'מי הכי סביר שיאחר לטיול?\nמי שר במקלחת הכי חזק?',
        hint: 'אף אחד חוץ מכם לא רואה את הרשימה.',
        def: () => '',
      },
    ],
    note: 'אפשר לבחור גם בעצמך. +1 למי שנבחר בכל פעם.',
    timers: [
      { key: 'choose', label: 'בחירת שחקן', def: 30 },
      { key: 'call', label: 'בחירת עץ או פלי', def: 15 },
    ],
  },
  about: {
    name: 'מה חושבים עליך',
    emoji: '🪞',
    genres: ['חברתי', 'כתיבה'],
    color: 'from-pink-400 to-violet-600',
    desc: 'כולם עונים על שאלה על שחקן אחד - ״אם הוא היה סרט, איזה סרט?״. התשובות מופיעות בלי שמות, והוא בוחר אחת כדי לגלות מי כתב אותה. כל השאר נשארות סוד.',
    minPlayers: 3,
    settings: [
      { key: 'rounds', label: 'כמה פעמים כל אחד במרכז', type: 'number', min: 1, max: 10, def: () => 1 },
      { key: 'builtin', label: 'אילו שאלות', type: 'toggle', on: 'שלנו + של המשחק', off: 'רק שלנו', def: () => true },
      {
        key: 'customWords',
        label: 'השאלות שלנו (לא חובה) - שורה לכל שאלה, {name} = השם של השחקן',
        type: 'textarea',
        placeholder: 'אם {name} היה/תה שיר, איזה שיר?\nמה {name} עושה בהפסקה?',
        hint: 'אף אחד חוץ מכם לא רואה את הרשימה.',
        def: () => '',
      },
    ],
    note: 'מי שהשאלה עליו רואה אותה רק כשהתשובות נחשפות. +2 לכותב של התשובה שנבחרה.',
    timers: [
      { key: 'write', label: 'כתיבת תשובה', def: 60 },
      { key: 'pick', label: 'בחירת תשובה', def: 45 },
    ],
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
