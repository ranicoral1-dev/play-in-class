import { useCallback, useEffect, useState } from 'react';
import { useRoom, GameHeader, PlayerTag, DoneRow, NextButton, RoundPoints, usePlayer, Waiting } from '../components/ui.jsx';
import { withFinals, regular, hebrewOnly } from '../lib.js';

const COLOR = {
  green: 'bg-emerald-500 text-white border-emerald-500',
  yellow: 'bg-amber-400 text-white border-amber-400',
  gray: 'bg-slate-400 text-white border-slate-400',
};

// מקלדת עברית בסדר הפיזי הרגיל
const KEYBOARD = [
  ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
  ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
  ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ'],
];

export default function Wordle({ g }) {
  return (
    <div className="card">
      <GameHeader title="🟩 נחש את המילה" round={g.round} totalRounds={g.totalRounds}>
        <span className="chip">
          {g.wordLength} אותיות · {g.maxGuesses} ניחושים
        </span>
      </GameHeader>
      {g.phase === 'secret' && <SecretPhase g={g} />}
      {g.phase === 'guess' && <GuessPhase g={g} key={g.round} />}
      {g.phase === 'reveal' && <RevealPhase g={g} />}
    </div>
  );
}

function SecretPhase({ g }) {
  const { act, state } = useRoom();
  const [word, setWord] = useState('');
  const letters = hebrewOnly(word);
  const ids = state.players.filter((p) => p.inGame).map((p) => p.id);
  const sent = g.submittedIds.includes(state.me);

  return (
    <div className="animate-rise text-center">
      {sent ? (
        <Waiting emoji="🤫">
          המילה הסודית שלך: <span className="text-grape">{withFinals(g.mySecret)}</span>
          <br />
          מחכים לשאר…
        </Waiting>
      ) : (
        <>
          <p className="font-display text-2xl">בחרו מילה סודית בת {g.wordLength} אותיות</p>
          <p className="mt-1 text-sm text-indigo-400">מישהו אחר ינסה לנחש אותה. בלי רווחים, בעברית בלבד.</p>
          <div className="mx-auto mt-5 max-w-xs">
            <input
              className="input text-center font-display text-3xl tracking-widest"
              value={word}
              autoFocus
              onChange={(e) => setWord(hebrewOnly(e.target.value).slice(0, g.wordLength))}
              onKeyDown={(e) => e.key === 'Enter' && letters.length === g.wordLength && act('secret', word)}
            />
            <div className="mt-2 flex justify-center gap-1.5">
              {Array.from({ length: g.wordLength }, (_, i) => (
                <span key={i} className={`h-2 w-6 rounded-full ${i < letters.length ? 'bg-grape' : 'bg-indigo-100'}`} />
              ))}
            </div>
            <button className="btn-mint mt-5 w-full" disabled={letters.length !== g.wordLength} onClick={() => act('secret', word)}>
              🔒 נעילת מילה
            </button>
          </div>
        </>
      )}
      <DoneRow ids={ids} doneIds={g.submittedIds} label="מי כבר בחר מילה" />
    </div>
  );
}

function Tile({ ch, color, delay = 0, pending }) {
  return (
    <div
      className={`flex aspect-square w-full items-center justify-center rounded-xl border-2 font-display text-2xl sm:text-3xl
        ${color ? `${COLOR[color]} animate-flip` : pending ? 'border-indigo-300 bg-white animate-pop' : 'border-indigo-100 bg-indigo-50/50'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {ch}
    </div>
  );
}

function Board({ len, max, guesses, current = '', showCurrent }) {
  const rows = [];
  for (let r = 0; r < max; r++) {
    const guess = guesses[r];
    const isCurrent = showCurrent && r === guesses.length;
    rows.push(
      <div key={r} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${len}, minmax(0, 1fr))` }}>
        {Array.from({ length: len }, (_, i) => {
          if (guess) {
            const ch = i === len - 1 ? withFinals(guess.letters[i]) : guess.letters[i];
            return <Tile key={i} ch={ch} color={guess.colors[i]} delay={i * 90} />;
          }
          if (isCurrent) return <Tile key={i} ch={current[i] || ''} pending={!!current[i]} />;
          return <Tile key={i} ch="" />;
        })}
      </div>,
    );
  }
  return <div className="mx-auto grid w-full max-w-[min(100%,22rem)] gap-1.5">{rows}</div>;
}

function GuessPhase({ g }) {
  const { act } = useRoom();
  const b = g.myBoard;
  const owner = usePlayer(b.owner);
  const [current, setCurrent] = useState('');
  const len = g.wordLength;

  // מצב כל אות במקלדת: ירוק > צהוב > אפור
  const keyState = {};
  const rank = { gray: 1, yellow: 2, green: 3 };
  for (const guess of b.guesses) {
    guess.letters.forEach((l, i) => {
      const c = guess.colors[i];
      if (!keyState[l] || rank[c] > rank[keyState[l]]) keyState[l] = c;
    });
  }

  const submit = useCallback(async () => {
    if (current.length !== len) return;
    const res = await act('guess', current);
    if (!res.error) setCurrent('');
  }, [current, len, act]);

  const press = useCallback(
    (k) => {
      if (b.done) return;
      if (k === 'Enter') return submit();
      if (k === 'Backspace') return setCurrent((c) => c.slice(0, -1));
      if (/^[א-ת]$/.test(k)) setCurrent((c) => (c.length < len ? c + k : c));
    },
    [b.done, len, submit],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[א-ת]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="animate-rise">
        <p className="mb-4 text-center font-display text-xl">
          מנחשים את המילה של <span className="text-grape">{owner.emoji} {owner.name}</span>
        </p>
        <Board len={len} max={g.maxGuesses} guesses={b.guesses} current={current} showCurrent={!b.done} />
        {b.done ? (
          <div className="mt-5 animate-pop text-center font-display text-2xl">
            {b.solved ? '🎉 פיצחת! מחכים לשאר…' : '😬 נגמרו הניחושים. מחכים לשאר…'}
          </div>
        ) : (
          <div dir="ltr" className="mx-auto mt-5 max-w-lg space-y-1.5">
            {KEYBOARD.map((row, r) => (
              <div key={r} className="flex justify-center gap-1">
                {r === 2 && (
                  <button className="rounded-lg bg-mint px-2 font-display text-sm text-white sm:px-3" onClick={() => press('Enter')}>
                    שלח
                  </button>
                )}
                {row.map((k) => {
                  const st = keyState[regular(k)];
                  return (
                    <button
                      key={k}
                      onClick={() => press(k)}
                      className={`h-12 flex-1 rounded-lg font-display text-lg transition active:scale-95 sm:max-w-[2.75rem] ${
                        st ? COLOR[st] : 'bg-indigo-100 text-ink hover:bg-indigo-200'
                      }`}
                    >
                      {k}
                    </button>
                  );
                })}
                {r === 2 && (
                  <button className="rounded-lg bg-indigo-200 px-2 font-display text-lg sm:px-3" onClick={() => press('Backspace')}>
                    ⌫
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <OthersPanel g={g} />
    </div>
  );
}

function OthersPanel({ g }) {
  const { state } = useRoom();
  return (
    <div className="space-y-2">
      <div className="label">ההתקדמות של כולם</div>
      {g.boards
        .filter((x) => x.id !== state.me)
        .map((x) => (
          <div key={x.id} className="rounded-2xl bg-indigo-50 p-2.5">
            <div className="flex items-center justify-between">
              <PlayerTag id={x.id} />
              {x.solved ? <span className="chip bg-emerald-100 text-emerald-800">✓ {x.solvedIn}ש׳</span> : x.done ? <span>😵</span> : null}
            </div>
            {x.owner === state.me && <div className="mt-1 text-xs font-bold text-bubble">מנחש/ת את המילה שלך!</div>}
            <div className="mt-2 space-y-0.5">
              {x.colors.map((row, i) => (
                <div key={i} className="flex gap-0.5">
                  {row.map((c, j) => (
                    <span key={j} className={`h-3 w-3 rounded-sm ${COLOR[c].split(' ')[0]}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function RevealPhase({ g }) {
  return (
    <div className="animate-rise">
      <h3 className="mb-4 text-center font-display text-2xl">
        {g.solveOrder.length ? '⏱️ סוף הסיבוב!' : 'אף אחד לא פיצח 😮 - ניקוד לפי אותיות ירוקות'}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {g.boards.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-50 px-3 py-2.5">
            <div className="min-w-0">
              <PlayerTag id={x.id} />
              <div className="mt-1 text-xs text-indigo-400">
                {x.solved ? `פיצח/ה ב-${x.colors.length} ניחושים (${x.solvedIn} שניות)` : `${x.greens} אותיות ירוקות`}
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs text-indigo-400">המילה של</div>
              <OwnerWord id={x.owner} word={g.secrets[x.owner]} auto={g.autoSecret[x.owner]} />
            </div>
          </div>
        ))}
      </div>
      <h3 className="mb-2 mt-6 text-center font-display text-xl">נקודות בסיבוב</h3>
      <RoundPoints points={g.roundPoints} />
      <NextButton />
    </div>
  );
}

function OwnerWord({ id, word, auto }) {
  const p = usePlayer(id);
  return (
    <div className="font-display text-lg" title={auto ? 'נבחרה אוטומטית' : ''}>
      {p.emoji} <span className="text-grape">{withFinals(word)}</span>
      {auto && <span className="text-xs text-indigo-300"> 🎲</span>}
    </div>
  );
}
