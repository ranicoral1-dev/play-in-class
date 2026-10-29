import { io } from 'socket.io-client';

// בפיתוח עובדים דרך ה-proxy של Vite; בפריסה נפרדת (למשל Vercel) מגדירים VITE_SERVER_URL
const URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(URL, { transports: ['websocket', 'polling'] });

export function emit(event, data) {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, data, (err, res) => {
      resolve(err ? { error: 'אין חיבור לשרת, נסו שוב' } : res || {});
    });
  });
}

// מזהה לכל לשונית - שורד רענון, מאפשר כמה שחקנים מאותו דפדפן
export function getPlayerId() {
  let id = sessionStorage.getItem('pid');
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('pid', id);
  }
  return id;
}

export function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('profile')) || null;
  } catch {
    return null;
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem('profile', JSON.stringify(p));
  } catch {
    /* לא קריטי */
  }
}
