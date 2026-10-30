import { useEffect, useState } from 'react';
import { emit, saveProfile } from '../socket.js';
import { EMOJIS } from '../lib.js';
import { useRoom } from './ui.jsx';

// שם + בחירת אימוג'י - משותף למסך הפתיחה ולעריכה בתוך החדר
export function ProfileFields({ name, setName, emoji, setEmoji, onEnter }) {
  return (
    <>
      <label className="label">השם שלי</label>
      <input
        className="input font-display"
        value={name}
        maxLength={16}
        placeholder="למשל: נועה"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />

      <label className="label mt-5">התמונה שלי</label>
      <div className="mb-1 flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-pink-100 text-4xl shadow-inner">
          {emoji}
        </span>
        <span className="text-sm text-indigo-400">בחרו אימוג׳י שייצג אתכם</span>
      </div>
      <div className="mt-2 grid max-h-36 grid-cols-8 gap-1.5 overflow-y-auto scrollbar-thin">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={`aspect-square rounded-xl text-2xl transition hover:scale-110 ${
              e === emoji ? 'bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}

// עריכת הפרופיל מתוך החדר - גם באמצע משחק
export function ProfileModal({ onClose }) {
  const { state, showToast } = useRoom();
  const me = state.players.find((p) => p.id === state.me);
  const [name, setName] = useState(me?.name || '');
  const [emoji, setEmoji] = useState(me?.emoji || EMOJIS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    const profile = { name: name.trim(), emoji };
    if (!profile.name) return showToast('איך קוראים לך? ✍️');
    setBusy(true);
    const res = await emit('profile', profile);
    setBusy(false);
    if (res.error) return showToast(res.error);
    saveProfile({ name: res.name, emoji: res.emoji });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md animate-pop" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-2xl">✏️ עריכת הפרופיל</h2>
        <ProfileFields name={name} setName={setName} emoji={emoji} setEmoji={setEmoji} onEnter={save} />
        <div className="mt-6 grid grid-cols-[1fr_auto] gap-3">
          <button className="btn-primary" disabled={busy} onClick={save}>
            שמירה
          </button>
          <button className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
