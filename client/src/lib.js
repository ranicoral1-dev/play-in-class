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
