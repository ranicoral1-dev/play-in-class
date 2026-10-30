import { useState } from 'react';
import { emit, getPlayerId, loadProfile, saveProfile } from '../socket.js';
import { EMOJIS, GAME_META } from '../lib.js';
import { ProfileFields } from './Profile.jsx';

export default function Home({ showToast }) {
  const saved = loadProfile();
  const urlCode = new URLSearchParams(location.search).get('code') || '';
  const [name, setName] = useState(saved?.name || '');
  const [emoji, setEmoji] = useState(saved?.emoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const [mode, setMode] = useState(urlCode ? 'join' : null);
  const [code, setCode] = useState(urlCode);
  const [busy, setBusy] = useState(false);

  async function go(kind) {
    const profile = { name: name.trim(), emoji };
    if (!profile.name) return showToast('איך קוראים לך? ✍️');
    if (kind === 'join' && code.length !== 4) return showToast('קוד החדר הוא 4 ספרות');
    saveProfile(profile);
    setBusy(true);
    const res = await emit(kind, { ...profile, code, playerId: getPlayerId() });
    setBusy(false);
    if (res.error) return showToast(res.error);
    sessionStorage.setItem('room', res.code);
    if (urlCode) history.replaceState(null, '', location.pathname);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-4 py-8 sm:py-14">
      <header className="mb-8 text-center animate-rise">
        <div className="mb-3 flex justify-center gap-2 text-4xl sm:text-5xl">
          {Object.values(GAME_META).map((g, i) => (
            <span key={g.name} className="animate-wiggle" style={{ animationDelay: `${i * 0.15}s` }}>
              {g.emoji}
            </span>
          ))}
        </div>
        <h1 className="font-display text-5xl leading-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-7xl">
          לשחק בכיתה
          <br />
          <span className="text-sun">כי למה לא</span>
        </h1>
        <p className="mt-3 text-lg font-medium text-indigo-100">5 משחקים מטורפים. קוד אחד. כל הכיתה.</p>
      </header>

      <div className="card w-full max-w-md animate-rise" style={{ animationDelay: '.1s' }}>
        <ProfileFields name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} />

        <div className="mt-6 grid gap-3">
          {mode !== 'join' ? (
            <>
              <button className="btn-primary py-4 text-xl" disabled={busy} onClick={() => go('create')}>
                ✨ יצירת משחק
              </button>
              <button className="btn-sky py-4 text-xl" onClick={() => setMode('join')}>
                🚪 הכנסה למשחק
              </button>
            </>
          ) : (
            <div className="animate-rise">
              <label className="label">קוד החדר</label>
              <input
                className="input text-center font-display text-4xl tracking-[0.4em]"
                inputMode="numeric"
                autoFocus
                maxLength={4}
                value={code}
                placeholder="••••"
                dir="ltr"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && go('join')}
              />
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
                <button className="btn-sky py-4 text-xl" disabled={busy} onClick={() => go('join')}>
                  יאללה, נכנסים!
                </button>
                <button className="btn-ghost" onClick={() => setMode(null)}>
                  חזרה
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
