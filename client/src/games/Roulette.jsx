import { useEffect, useMemo, useRef, useState } from 'react';
import { emit, serverUrl } from '../socket.js';
import { success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, Waiting, DoneRow, EditButton, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';
import { Lightbox } from './Reel.jsx';

export default function Roulette({ g }) {
  const collecting = g.phase === 'collect';
  const guessing = g.phase === 'guess' || g.phase === 'reveal';
  return (
    <div className="card">
      <GameHeader title="📸 רולטת תמונות" round={collecting || g.phase === 'empty' ? null : g.round} totalRounds={g.totalRounds}>
        {collecting && <span className="chip">בחירת תמונות</span>}
        {g.spectator && <span className="chip">👀 צופה</span>}
      </GameHeader>
      {collecting && <CollectPhase g={g} />}
      {g.phase === 'empty' && <Waiting emoji="🙈">לא נשלחו מספיק תמונות - צריך לפחות 2 שחקנים ששלחו</Waiting>}
      {guessing && g.spectator && <LateJoin />}
      {guessing && <GuessPhase g={g} key={g.round} />}
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

// הגלריה והתמונות שנבחרו. במצב אקראי המשחק מגריל מהגלריה, ובמצב בחירה - מה שבחרתם
function useGallery() {
  const { state, showToast } = useRoom();
  const { random, perPlayer } = state.settings;
  const input = useRef();
  const [gallery, setGallery] = useState([]);
  const [chosen, setChosen] = useState([]);
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

  // הגרלה מחדש: אם יש מספיק תמונות - רק כאלה שלא הוצגו עכשיו
  function reroll() {
    const rest = gallery.filter((f) => !chosen.includes(f));
    setChosen(pickRandom(rest.length >= perPlayer ? rest : gallery, perPlayer));
  }

  const el = <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />;
  // חייב לקרות ישר מלחיצה, אחרת הדפדפן חוסם את פתיחת הגלריה
  const open = () => input.current?.click();
  return { el, open, gallery, chosen, setChosen, previews, reroll, random, perPlayer };
}

async function sendPhotos(files, showToast, auto = false) {
  const images = (await Promise.all(files.map((f) => compress(f).catch(() => null)))).filter(Boolean);
  if (!images.length) {
    showToast('לא הצלחנו לפתוח את התמונות 😕 נסו אחרות');
    return false;
  }
  const res = await emit('game:action', { type: 'submit', data: images }, 60000);
  if (res.error) {
    showToast(res.error);
    return false;
  }
  if (images.length < files.length && !auto) showToast('חלק מהתמונות לא נפתחו ולא נשלחו');
  return true;
}

// בקשת גישה לגלריה, עם הסבר למה זה בטוח
function Consent({ perPlayer, onAgree, onDecline }) {
  const [more, setMore] = useState(false);
  return (
    <div className="mx-auto max-w-lg animate-pop rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 p-5 text-center shadow-inner">
      <div className="mb-2 text-5xl">🔐🖼️</div>
      <h3 className="font-display text-2xl">המשחק מבקש גישה לגלריה שלך</h3>
      <p className="mt-2 text-indigo-600">
        כדי להגריל ממנה {perPlayer === 1 ? 'תמונה אחת' : `${perPlayer} תמונות`}. את מה שהוגרל תראו קודם - ותחליטו אם לשלוח או להגריל מחדש.
      </p>
      {more && (
        <ul className="mt-4 animate-rise space-y-2 rounded-2xl bg-white/80 p-4 text-right text-sm text-indigo-900">
          <li>📱 ההגרלה קורית אצלך במכשיר - הגלריה לא נשלחת לשום מקום.</li>
          <li>👀 רואים קודם את מה שהוגרל, ואפשר להגריל מחדש כמה פעמים שרוצים.</li>
          <li>🚀 רק התמונות שהוגרלו נשלחות, ורק אחרי שלוחצים ״שליחה״.</li>
          <li>🗑️ הן מוקטנות, נשמרות רק בשרת של המשחק ונמחקות כשהחדר נסגר או כשמתחיל משחק חדש.</li>
          <li>🚫 אנחנו לא שומרים, לא מעלים ולא רואים שום תמונה אחרת.</li>
          <li>📂 הטלפון יפתח את הגלריה - סמנו את כל התמונות (או כמה שיותר), וההגרלה תהיה מכולן.</li>
        </ul>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button className="btn-mint px-8 text-xl" onClick={onAgree}>
          ✅ מסכים/ה
        </button>
        <button className="btn-ghost" onClick={onDecline}>
          ❌ לא מסכים/ה
        </button>
      </div>
      <button className="mt-3 text-sm font-bold text-indigo-500 hover:text-grape" onClick={() => setMore((m) => !m)}>
        {more ? 'פחות ▲' : 'עוד… ▼'}
      </button>
    </div>
  );
}

function Spectating({ onAgree, children }) {
  return (
    <div className="mx-auto max-w-lg animate-rise rounded-3xl bg-indigo-50 p-5 text-center">
      <div className="mb-1 text-5xl">👀</div>
      <div className="font-display text-xl">את/ה צופה במשחק</div>
      <p className="mt-1 text-sm text-indigo-500">{children}</p>
      <button className="btn-mint mt-4" onClick={onAgree}>
        ✅ שיניתי את דעתי - מסכים/ה לגישה לגלריה
      </button>
    </div>
  );
}

// התמונות שנבחרו/הוגרלו, עם הגרלה מחדש ושליחה
function Picker({ gal, busy, onSend }) {
  const [zoom, setZoom] = useState(null);
  const { random, perPlayer, gallery, chosen } = gal;
  return (
    <>
      {!random && (
        <>
          <p className="mb-2 text-center font-display text-2xl">🖼️ בחרו {perPlayer === 1 ? 'תמונה אחת' : `עד ${perPlayer} תמונות`}</p>
          <p className="mb-4 text-center text-sm text-indigo-400">אף אחד לא יודע של מי כל תמונה - עד שמנחשים 😉</p>
        </>
      )}
      {random && chosen.length > 0 && (
        <p className="mb-3 text-center font-display text-2xl">
          🎲 הוגרלו לך {chosen.length === 1 ? 'תמונה אחת' : `${chosen.length} תמונות`}
          <span className="block font-sans text-sm font-semibold text-indigo-400">
            מתוך {gallery.length} בגלריה{gallery.length < perPlayer && ' - כדאי לסמן יותר תמונות'}
          </span>
        </p>
      )}
      {random && !chosen.length && <p className="mb-3 text-center font-display text-xl">פתחו את הגלריה וסמנו את כל התמונות 📂</p>}
      {chosen.length > 0 && (
        <Thumbs srcs={gal.previews} onZoom={setZoom} onRemove={random ? null : (i) => gal.setChosen((c) => c.filter((_, k) => k !== i))} />
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {random && gallery.length > perPlayer && (
          <button className="btn-sky px-8 text-xl" disabled={busy} onClick={gal.reroll}>
            🎲 הגרלה מחדש
          </button>
        )}
        {chosen.length > 0 && (
          <button className="btn-pink px-10 text-xl" disabled={busy} onClick={onSend}>
            {busy ? 'שולח…' : `שליחה (${chosen.length}) 🚀`}
          </button>
        )}
        <button className={chosen.length ? 'btn-ghost' : 'btn-sky px-8 text-xl'} disabled={busy} onClick={gal.open}>
          {random ? (gallery.length ? '📂 גלריה אחרת' : '📂 פתיחת הגלריה') : chosen.length ? '➕ עוד תמונות' : '📂 בחירת תמונות'}
        </button>
      </div>
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </>
  );
}

function CollectPhase({ g }) {
  const { state, receivedAt, showToast, act } = useRoom();
  const gal = useGallery();
  const [agreed, setAgreed] = useState(!gal.random);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null);
  const submitted = g.mine.length > 0 && !editing;

  const agree = () => {
    setAgreed(true);
    gal.open();
  };

  async function submit(auto = false) {
    if (busy || !gal.chosen.length) return;
    setBusy(true);
    const ok = await sendPhotos(gal.chosen, showToast, auto);
    setBusy(false);
    if (ok) setEditing(false);
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

  let body;
  if (submitted) {
    body = (
      <div className="text-center">
        <Waiting emoji="📮">התמונות נשלחו! מחכים לשאר…</Waiting>
        <Thumbs srcs={g.mine.map(serverUrl)} onZoom={setZoom} />
        <EditButton onClick={() => setEditing(true)} />
      </div>
    );
  } else if (!agreed) {
    body = g.spectator ? (
      <Spectating onAgree={agree}>לא נתת גישה לגלריה, אז רק צופים. אפשר להצטרף בכל רגע.</Spectating>
    ) : (
      <Consent perPlayer={gal.perPlayer} onAgree={agree} onDecline={() => act('spectate')} />
    );
  } else {
    body = (
      <>
        <Picker gal={gal} busy={busy} onSend={() => submit()} />
        {g.mine.length > 0 && (
          <div className="mt-3 text-center">
            <button className="btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
              חזרה בלי לשנות
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="animate-rise">
      {gal.el}
      {body}
      <DoneRow ids={g.playerIds} doneIds={g.submittedIds} label="מי כבר שלח" />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// צופה שהסכים באמצע: התמונות שלו נכנסות במקום תמונות שעוד לא הוצגו, ומצטרפים לניחושים
function LateJoin() {
  const { showToast } = useRoom();
  const gal = useGallery();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !gal.chosen.length) return;
    setBusy(true);
    await sendPhotos(gal.chosen, showToast);
    setBusy(false);
  }

  return (
    <div className="mb-5 animate-rise">
      {gal.el}
      {agreed ? (
        <div className="rounded-3xl bg-indigo-50 p-4">
          <Picker gal={gal} busy={busy} onSend={submit} />
          <p className="mt-2 text-center text-xs text-indigo-400">התמונות שלך ייכנסו במקום תמונות שעוד לא הוצגו, ותצטרפו לניחושים</p>
        </div>
      ) : (
        <Spectating
          onAgree={() => {
            setAgreed(true);
            gal.open();
          }}
        >
          לא נתת גישה לגלריה, אז רק צופים. אפשר להצטרף גם עכשיו.
        </Spectating>
      )}
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
        {revealed ? `זו התמונה של ${owner.name}! 📸` : g.mineNow ? 'זו התמונה שלך! 🤫 פרצוף פוקר…' : g.spectator ? 'של מי התמונה? 👀' : g.myGuess ? 'ניחשת! מחכים לשאר…' : 'של מי התמונה? 🤔'}
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
