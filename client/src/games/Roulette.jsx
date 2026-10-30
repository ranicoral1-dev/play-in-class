import { useEffect, useMemo, useRef, useState } from 'react';
import { emit, serverUrl } from '../socket.js';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, Waiting, DoneRow, EditButton, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';
import { Lightbox } from './Reel.jsx';

export default function Roulette({ g }) {
  const collecting = g.phase === 'collect';
  return (
    <div className="card">
      <GameHeader title="📸 רולטת תמונות" round={collecting || g.phase === 'empty' ? null : g.round} totalRounds={g.totalRounds}>
        {collecting && <span className="chip">בחירת תמונות</span>}
      </GameHeader>
      {collecting && <CollectPhase g={g} />}
      {g.phase === 'empty' && <Waiting emoji="🙈">לא נשלחו מספיק תמונות - צריך לפחות 2 שחקנים ששלחו</Waiting>}
      {(g.phase === 'guess' || g.phase === 'reveal') && <GuessPhase g={g} key={g.round} />}
    </div>
  );
}

// התמונות מוקטנות ל-JPEG לפני השליחה, כדי שיעלו מהר
async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let q = 0.82;
    let out = c.toDataURL('image/jpeg', q);
    while (out.length > 900_000 && q > 0.4) {
      q -= 0.15;
      out = c.toDataURL('image/jpeg', q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pickRandom(files, n) {
  const a = [...files];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function CollectPhase({ g }) {
  const { state, receivedAt, showToast } = useRoom();
  const { random, perPlayer } = state.settings;
  const [gallery, setGallery] = useState([]); // מצב אקראי: כל התמונות שמגרילים מהן
  const [chosen, setChosen] = useState([]); // התמונות שיישלחו
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);
  const input = useRef();
  const submitted = g.mine.length > 0 && !editing;
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  const previews = useMemo(() => chosen.map((f) => URL.createObjectURL(f)), [chosen]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function onFiles(e) {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    if (random) {
      setGallery(files);
      setChosen(pickRandom(files, perPlayer));
    } else {
      setChosen((c) => {
        const next = [...c, ...files];
        if (next.length > perPlayer) showToast(`אפשר עד ${perPlayer} תמונות`);
        return next.slice(0, perPlayer);
      });
    }
  }

  async function submit(auto = false) {
    if (busy || !chosen.length) return;
    setBusy(true);
    try {
      const images = (await Promise.all(chosen.map((f) => compress(f).catch(() => null)))).filter(Boolean);
      if (!images.length) return showToast('לא הצלחנו לפתוח את התמונות 😕 נסו אחרות');
      const res = await emit('game:action', { type: 'submit', data: images }, 60000);
      if (res.error) return showToast(res.error);
      if (images.length < chosen.length && !auto) showToast('חלק מהתמונות לא נפתחו ולא נשלחו');
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  // רגע לפני שהזמן נגמר - שולחים אוטומטית את מה שנבחר
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const sentAuto = useRef(false);
  const deadline = state.timeLeft != null ? receivedAt + state.timeLeft : null;
  useEffect(() => {
    if (!deadline || submitted) return;
    const t = setInterval(() => {
      if (deadline - Date.now() < 4000 && !sentAuto.current) {
        sentAuto.current = true;
        submitRef.current(true);
      }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, submitted]);

  if (submitted) {
    return (
      <div className="animate-rise text-center">
        <Waiting emoji="📮">התמונות נשלחו! מחכים לשאר…</Waiting>
        <Thumbs srcs={g.mine.map(serverUrl)} onZoom={setZoom} />
        <EditButton onClick={() => setEditing(true)} />
        <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר שלח" />
        {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <p className="mb-2 text-center font-display text-2xl">
        {random ? `🎲 המשחק יגריל ${perPlayer} תמונות מהגלריה שלך` : `🖼️ בחרו ${perPlayer === 1 ? 'תמונה אחת' : `עד ${perPlayer} תמונות`}`}
      </p>
      <p className="mb-4 text-center text-sm text-indigo-400">
        {random
          ? 'בחרו הרבה תמונות (בטלפון אפשר לסמן את כל הגלריה) - רק התמונות שהוגרלו יישלחו'
          : 'אף אחד לא יודע של מי כל תמונה - עד שמנחשים 😉'}
      </p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />

      {chosen.length > 0 && (
        <>
          {random && (
            <p className="mb-2 text-center text-sm font-semibold text-indigo-500">
              הוגרלו {chosen.length} מתוך {gallery.length} תמונות
              {gallery.length < perPlayer && ' - בחרו עוד תמונות כדי שיהיה מה להגריל'}
            </p>
          )}
          <Thumbs
            srcs={previews}
            onZoom={setZoom}
            onRemove={random ? null : (i) => setChosen((c) => c.filter((_, k) => k !== i))}
          />
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button className={chosen.length ? 'btn-ghost' : 'btn-sky px-8 text-xl'} disabled={busy} onClick={() => input.current.click()}>
          {random ? (gallery.length ? '📂 גלריה אחרת' : '📂 בחירת תמונות מהגלריה') : chosen.length ? '➕ עוד תמונות' : '📂 בחירת תמונות'}
        </button>
        {random && gallery.length > perPlayer && (
          <button className="btn-sky" disabled={busy} onClick={() => setChosen(pickRandom(gallery, perPlayer))}>
            🎲 הגרלה מחדש
          </button>
        )}
        {chosen.length > 0 && (
          <button className="btn-pink px-10 text-xl" disabled={busy} onClick={() => submit()}>
            {busy ? 'שולח…' : `שליחה (${chosen.length}) 🚀`}
          </button>
        )}
        {g.mine.length > 0 && (
          <button className="btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
            חזרה בלי לשנות
          </button>
        )}
      </div>
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר שלח" />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Thumbs({ srcs, onZoom, onRemove }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {srcs.map((src, i) => (
        <div key={src} className="relative animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>
          <img src={src} alt="" className="h-28 w-28 cursor-zoom-in rounded-2xl object-cover shadow sm:h-36 sm:w-36" onClick={() => onZoom(src)} />
          {onRemove && (
            <button
              className="absolute -left-2 -top-2 h-7 w-7 rounded-full bg-white text-sm font-bold text-rose-500 shadow hover:bg-rose-50"
              onClick={() => onRemove(i)}
              title="הסרה"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function GuessPhase({ g }) {
  const { state, act } = useRoom();
  const owner = usePlayer(g.owner);
  const [zoom, setZoom] = useState(null);
  const revealed = g.phase === 'reveal';
  const canGuess = !revealed && !g.mineNow && !g.myGuess && g.guesserIds.includes(state.me);
  const last = g.round >= g.totalRounds;

  useEffect(() => {
    if (!revealed || !g.myGuess) return;
    if (g.myGuess === g.owner) success();
    else fail();
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // מי ניחש כל שחקן (נחשף רק בסוף)
  const byOption = {};
  if (revealed) for (const [who, guess] of Object.entries(g.guesses)) (byOption[guess] ||= []).push(who);

  return (
    <div className="animate-rise">
      <p className="mb-3 text-center font-display text-2xl">
        {revealed ? `זו התמונה של ${owner.name}! 📸` : g.mineNow ? 'זו התמונה שלך! 🤫 פרצוף פוקר…' : g.myGuess ? 'ניחשת! מחכים לשאר…' : 'של מי התמונה? 🤔'}
      </p>
      <img
        src={serverUrl(g.src)}
        alt=""
        className="mx-auto max-h-[55vh] cursor-zoom-in rounded-3xl bg-white shadow-lg"
        onClick={() => setZoom(serverUrl(g.src))}
      />

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {g.options.map((id) => {
          const isOwner = revealed && id === g.owner;
          const isMine = id === g.myGuess;
          const self = id === state.me;
          return (
            <button
              key={id}
              disabled={!canGuess || self}
              onClick={() => act('guess', id)}
              className={`rounded-2xl p-3 text-right transition ${
                isOwner
                  ? 'animate-pop bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun'
                  : revealed && isMine
                    ? 'bg-rose-50 ring-2 ring-rose-300'
                    : isMine
                      ? 'bg-sun/40 ring-4 ring-sun'
                      : canGuess && !self
                        ? 'bg-indigo-50 hover:bg-indigo-100'
                        : 'bg-indigo-50 opacity-60'
              }`}
            >
              <PlayerTag id={id} />
              {revealed && byOption[id]?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {byOption[id].map((who) => (
                    <span key={who} title={`ניחוש של ${state.players.find((p) => p.id === who)?.name || '?'}`}>
                      <Avatar emoji={state.players.find((p) => p.id === who)?.emoji || '❔'} size="sm" />
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {revealed ? (
        <div className="mt-5">
          <RoundPoints points={g.points} />
          {g.firstCorrect && (
            <p className="mt-2 text-center text-sm text-indigo-500">
              ⚡ הכי מהיר/ה: {state.players.find((p) => p.id === g.firstCorrect)?.name} (+1 בונוס)
            </p>
          )}
          <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לתמונה הבאה ←'} />
        </div>
      ) : (
        <DoneRow ids={g.guesserIds} doneIds={g.guessedIds} label="מי כבר ניחש" />
      )}
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
