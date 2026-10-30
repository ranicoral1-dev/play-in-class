import { useEffect, useRef, useState } from 'react';
import { emit, serverUrl } from '../socket.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, EditButton } from '../components/ui.jsx';
import MemeEditor, { blankDoc, exportDoc, IMAGES } from './MemeEditor.jsx';

export default function Reel({ g }) {
  const phaseName = { create: null, vote: 'שלב הדירוג', results: 'תוצאות' }[g.phase];
  return (
    <div className="card">
      <GameHeader title="🎬 צור ריל" round={g.round} totalRounds={g.totalRounds}>
        {phaseName && <span className="chip">{phaseName}</span>}
      </GameHeader>
      <CategoryBanner category={g.category} />
      {g.phase === 'create' && <CreatePhase g={g} key={g.round} />}
      {g.phase === 'vote' && <VotePhase g={g} key={g.round} />}
      {g.phase === 'results' && <ResultsPhase g={g} />}
    </div>
  );
}

function CategoryBanner({ category }) {
  if (!category) return null;
  return (
    <div className="mb-4 flex animate-pop items-center gap-3 rounded-3xl bg-gradient-to-l from-fuchsia-500 to-violet-600 p-4 text-white">
      <span className="text-4xl">🎯</span>
      <div>
        <div className="text-sm font-bold text-white/80">הקטגוריה של הסיבוב</div>
        <div className="font-display text-2xl leading-tight sm:text-3xl">{category}</div>
      </div>
    </div>
  );
}

function CreatePhase({ g }) {
  const { state, receivedAt, showToast } = useRoom();
  const [doc, setDoc] = useState(blankDoc);
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);
  const showEditor = editing || !g.submitted;

  // סיבוב חדש = מתחילים נקי (התמונות של הסיבוב הקודם לא צריכות להישאר בזיכרון)
  useEffect(() => {
    IMAGES.clear();
  }, []);

  const change = (d) => {
    dirty.current = true;
    setDoc(d);
  };

  async function submit(auto = false) {
    if (busy) return;
    if (!doc.layers.length) {
      if (!auto) showToast('המים עוד ריק - תוסיפו תמונה, טקסט או מדבקה 🙂');
      return;
    }
    setBusy(true);
    const out = exportDoc(doc);
    const res = await emit('game:action', { type: 'submit', data: out }, 30000);
    setBusy(false);
    if (res.error) return showToast(res.error);
    dirty.current = false;
    setPreview(out.image);
    setEditing(false);
  }

  // רגע לפני שהזמן נגמר - שולחים אוטומטית את מה שיש
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const deadline = state.timeLeft != null ? receivedAt + state.timeLeft : null;
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      if (deadline - Date.now() < 3500 && (dirty.current || !g.submitted)) {
        dirty.current = false;
        submitRef.current(true);
      }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, g.submitted]);

  return (
    <div className="animate-rise">
      {!g.category && (
        <p className="mb-3 text-center font-display text-xl text-indigo-500">בלי קטגוריה - תעשו מה שבא לכם 🤪</p>
      )}
      {showEditor ? (
        <>
          <MemeEditor doc={doc} setDoc={change} onToast={showToast} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {g.submitted && (
              <button
                className="btn-ghost"
                onClick={() => {
                  dirty.current = false;
                  setEditing(false);
                }}
              >
                חזרה בלי לשלוח
              </button>
            )}
            <button className="btn-pink px-10 text-xl" disabled={busy || !doc.layers.length} onClick={() => submit()}>
              {busy ? 'שולח…' : g.submitted ? 'שליחה מחדש 🚀' : 'שליחה 🚀'}
            </button>
          </div>
        </>
      ) : (
        <div className="text-center">
          <Waiting emoji="📮">המים נשלח! מחכים לשאר היוצרים…</Waiting>
          {preview && <img src={preview} alt="" className="mx-auto max-h-[45vh] rounded-2xl shadow-lg" />}
          <EditButton onClick={() => setEditing(true)} />
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר שלח" />
    </div>
  );
}

function RatingButtons({ value, disabled, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`h-9 w-9 rounded-xl font-display transition ${
            value === n ? 'scale-110 bg-sun shadow-[0_3px_0_#c99a00]' : 'bg-white text-indigo-400 hover:bg-indigo-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function VotePhase({ g }) {
  const { act, state } = useRoom();
  const [ratings, setRatings] = useState(g.myRatings || {});
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(null);
  const submitted = !!g.myRatings && !editing;
  const toRate = g.memes.filter((m) => !m.mine);
  const complete = toRate.every((m) => ratings[m.key]);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);

  if (!toRate.length) return <Waiting emoji="🍿">רק המים שלך נשלח - אין מה לדרג. מחכים לשאר…</Waiting>;

  return (
    <div className="animate-rise">
      <p className="mb-4 text-center font-display text-2xl">{submitted ? 'הדירוג נשלח! 🌟' : 'דרגו כל מים מ-1 עד 10 (לחיצה על תמונה מגדילה)'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {g.memes.map((m, k) => (
          <div key={m.key} className="rounded-3xl bg-gradient-to-br from-indigo-50 to-pink-50 p-3">
            <div className="mb-2 font-display text-lg text-indigo-400">
              #{k + 1} {m.mine && <span className="text-sm text-grape">· שלך 🎨</span>}
            </div>
            <img
              src={serverUrl(m.src)}
              alt=""
              className="mx-auto max-h-[50vh] cursor-zoom-in rounded-2xl bg-white shadow"
              onClick={() => setZoom(serverUrl(m.src))}
            />
            {!m.mine && (
              <div className="mt-3">
                <RatingButtons value={ratings[m.key]} disabled={submitted} onChange={(n) => setRatings((r) => ({ ...r, [m.key]: n }))} />
              </div>
            )}
          </div>
        ))}
      </div>
      {submitted ? (
        <div className="text-center">
          <EditButton onClick={() => setEditing(true)} />
        </div>
      ) : (
        <div className="mt-5 flex justify-center">
          <button className="btn-mint px-10" disabled={!complete} onClick={async () => !(await act('rate', ratings)).error && setEditing(false)}>
            שליחת דירוג
          </button>
        </div>
      )}
      <DoneRow ids={ids} doneIds={g.votedIds} label="מי כבר דירג" />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function ResultsPhase({ g }) {
  const [zoom, setZoom] = useState(null);
  const medals = ['🥇', '🥈', '🥉'];
  const last = g.round >= g.totalRounds;
  return (
    <div className="animate-rise space-y-3">
      {!g.results.length && <Waiting emoji="😅">אף אחד לא שלח מים בסיבוב הזה</Waiting>}
      <div className="grid gap-3 sm:grid-cols-2">
        {g.results.map((r, i) => (
          <div
            key={r.ownerId}
            className={`rounded-3xl p-3 animate-rise ${r.rank === 1 ? 'bg-gradient-to-br from-amber-100 to-yellow-50 ring-4 ring-sun sm:col-span-2' : 'bg-indigo-50'}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-display text-xl">
                <span className="text-3xl">{medals[r.rank - 1] || `#${r.rank}`}</span>
                <PlayerTag id={r.ownerId} />
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-white">⭐ {r.votes ? r.avg : '-'}</span>
                <span className="chip bg-amber-200 font-display">+{r.points}</span>
                <a className="chip bg-white hover:bg-indigo-100" href={serverUrl(r.src)} download={`meme-${i + 1}.jpg`} title="הורדה">
                  ⬇️
                </a>
              </div>
            </div>
            <img
              src={serverUrl(r.src)}
              alt=""
              className={`mx-auto cursor-zoom-in rounded-2xl bg-white shadow ${r.rank === 1 ? 'max-h-[55vh]' : 'max-h-[40vh]'}`}
              onClick={() => setZoom(serverUrl(r.src))}
            />
          </div>
        ))}
      </div>
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

export function Lightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-rise cursor-zoom-out items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <img src={src} alt="" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
    </div>
  );
}
