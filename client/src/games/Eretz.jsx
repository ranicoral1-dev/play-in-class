import { useEffect, useRef, useState } from 'react';
import { ding } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Waiting, DoneRow, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

export default function Eretz({ g }) {
  const phaseName = { write: null, review: 'בדיקה ופסילה', results: 'תוצאות' }[g.phase];
  return (
    <div className="card">
      <GameHeader title="🌍 ארץ עיר" round={g.round} totalRounds={g.totalRounds}>
        {phaseName && <span className="chip">{phaseName}</span>}
      </GameHeader>
      <div className="mb-4 flex items-center justify-center gap-4 rounded-3xl bg-gradient-to-l from-sky-100 to-emerald-100 p-4">
        <span className="text-sm font-bold text-sky-700">האות של הסיבוב</span>
        <span className="flex h-20 w-20 animate-pop items-center justify-center rounded-3xl bg-white font-display text-6xl text-emerald-700 shadow">
          {g.letter}
        </span>
      </div>
      {g.phase === 'write' && <WritePhase g={g} key={g.round} />}
      {g.phase === 'review' && <ReviewPhase g={g} />}
      {g.phase === 'results' && <ResultsPhase g={g} />}
    </div>
  );
}

function WritePhase({ g }) {
  const { state, act } = useRoom();
  const [answers, setAnswers] = useState(() => g.mine || g.cats.map(() => ''));
  const stopper = usePlayer(g.stoppedBy);
  const stopMode = state.settings.stop;
  const t = useRef();
  const allFilled = answers.every((a) => a.trim());
  const locked = g.amDone && !g.stoppedBy;

  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => act('draft', answers), 400);
    return () => clearTimeout(t.current);
  }, [answers, act]);

  useEffect(() => {
    if (g.stoppedBy) ding();
  }, [g.stoppedBy]);

  return (
    <div className="animate-rise">
      {g.stoppedBy && (
        <div className="mb-4 animate-pop rounded-3xl bg-rose-500 p-4 text-center font-display text-2xl text-white">
          ✋ {stopper.name} אמר/ה סטופ! עוד רגע נגמר…
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {g.cats.map((cat, i) => {
          const a = answers[i];
          const bad = a.trim() && !startsWith(a, g.letter);
          return (
            <label key={i} className="block">
              <span className="label">{cat}</span>
              <input
                className={`input ${bad ? 'border-rose-300 bg-rose-50' : ''}`}
                maxLength={30}
                autoFocus={i === 0}
                disabled={locked}
                placeholder={`${cat} ב-${g.letter}…`}
                value={a}
                onChange={(e) => setAnswers((old) => old.map((x, k) => (k === i ? e.target.value : x)))}
              />
              {bad && <span className="text-xs text-rose-500">צריך להתחיל באות {g.letter}</span>}
            </label>
          );
        })}
      </div>
      {!g.stoppedBy && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {locked ? (
            <>
              <span className="chip bg-emerald-100 py-2 text-emerald-800">סיימת ✓ מחכים לשאר…</span>
              <button className="btn-ghost" onClick={() => act('edit')}>
                ✏️ לשנות
              </button>
            </>
          ) : stopMode ? (
            <>
              <button className="btn-pink px-10 text-2xl" disabled={!allFilled} onClick={() => act('stop', answers)}>
                ✋ סטופ!
              </button>
              <button className="btn-ghost" onClick={() => act('done', answers)}>
                סיימתי ✓
              </button>
            </>
          ) : (
            <button className="btn-mint px-10" onClick={() => act('done', answers)}>
              סיימתי ✓
            </button>
          )}
        </div>
      )}
      {stopMode && !g.stoppedBy && !locked && (
        <p className="mt-2 text-center text-xs text-indigo-400">סטופ - כשמילאתם הכל, עוצרים את כולם. ״סיימתי״ - מחכים שכולם יסיימו או שהזמן ייגמר.</p>
      )}
      <DoneRow ids={g.playerIds} doneIds={g.doneIds} label="מי כבר סיים" />
    </div>
  );
}

// כמו בשרת: האות הראשונה (בלי ניקוד, אותיות סופיות כרגילות)
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
function startsWith(answer, letter) {
  const first = String(answer).replace(/[^א-ת]/g, '')[0];
  return (FINALS[first] || first) === letter;
}

function ReviewPhase({ g }) {
  const { state, act } = useRoom();
  const answered = (ci) => g.rows.filter((r) => r.answers[ci].text);
  return (
    <div className="animate-rise">
      <p className="mb-1 text-center font-display text-2xl">בודקים! 🔎</p>
      <p className="mb-4 text-center text-sm text-indigo-400">לחצו 👎 על תשובה לא נכונה. תשובה שרוב השאר פסלו - לא מקבלת נקודות.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {g.cats.map((cat, ci) => (
          <div key={ci} className="rounded-3xl bg-indigo-50 p-3">
            <div className="mb-2 font-display text-lg text-indigo-500">{cat}</div>
            {!answered(ci).length && <div className="text-sm text-indigo-300">אף אחד לא כתב 🦗</div>}
            <div className="space-y-1.5">
              {answered(ci).map((r) => {
                const a = r.answers[ci];
                const mine = r.pid === state.me;
                const rejected = a.rejects.includes(state.me);
                return (
                  <div key={r.pid} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className={`font-bold ${a.wrongLetter ? 'text-rose-400 line-through' : ''}`}>{a.text}</div>
                      <div className="text-xs">
                        <PlayerTag id={r.pid} size="sm" />
                      </div>
                    </div>
                    {a.wrongLetter ? (
                      <span className="chip shrink-0 bg-rose-100 text-xs text-rose-600">לא ב-{g.letter}</span>
                    ) : (
                      <button
                        disabled={mine}
                        onClick={() => act('reject', { pid: r.pid, ci })}
                        className={`chip shrink-0 transition ${rejected ? 'bg-rose-500 text-white' : 'bg-slate-100 hover:bg-rose-100'} ${mine ? 'opacity-40' : ''}`}
                      >
                        👎 {a.rejects.length || ''}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-center">
        {g.amReviewed ? (
          <span className="chip bg-emerald-100 py-2 text-emerald-800">סיימת לבדוק ✓ (אפשר עוד לשנות)</span>
        ) : (
          <button className="btn-mint px-10" onClick={() => act('reviewed')}>
            סיימתי לבדוק ✓
          </button>
        )}
      </div>
      <DoneRow ids={g.playerIds} doneIds={g.reviewedIds} label="מי כבר בדק" />
    </div>
  );
}

function ResultsPhase({ g }) {
  const rows = [...g.rows].sort((a, b) => (g.totals[b.pid] || 0) - (g.totals[a.pid] || 0));
  return (
    <div className="animate-rise">
      {!rows.length && <Waiting emoji="🦗">אף אחד לא כתב כלום הסיבוב…</Waiting>}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r, k) => (
          <div key={r.pid} className="animate-rise rounded-3xl bg-indigo-50 p-3" style={{ animationDelay: `${k * 0.08}s` }}>
            <div className="mb-2 flex items-center justify-between">
              <PlayerTag id={r.pid} />
              <span className="chip bg-amber-200 font-display text-lg">+{g.totals[r.pid] || 0}</span>
            </div>
            <div className="space-y-1">
              {g.cats.map((cat, ci) => {
                const a = r.answers[ci];
                return (
                  <div key={ci} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-1.5 text-sm">
                    <span className="shrink-0 text-indigo-400">{cat}</span>
                    <span className={`truncate font-bold ${a.text && !a.valid ? 'text-rose-400 line-through' : ''}`}>{a.text || '—'}</span>
                    <span className={`chip shrink-0 ${a.points === 15 ? 'bg-emerald-200' : a.points === 10 ? 'bg-sky-100' : a.points === 5 ? 'bg-amber-100' : 'bg-slate-100 text-slate-400'}`}>
                      {a.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <RoundPoints points={g.totals} />
      </div>
      <NextButton label={g.round >= g.totalRounds ? 'לטבלה הסופית 🏆' : 'לאות הבאה ←'} />
    </div>
  );
}
