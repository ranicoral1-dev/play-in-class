import { useEffect, useState } from 'react';
import { socket, emit } from '../socket.js';
import { drumRoll } from '../sound.js';
import { GAME_META } from '../lib.js';
import { useRoom, Avatar } from './ui.jsx';

const DRUM_SEC = 2.6;
const CONFETTI = ['🎉', '🎊', '⭐', '✨', '🥳', '🏆', '🎈', '💫'];

export default function Final() {
  const [drumming, setDrumming] = useState(true);

  useEffect(() => {
    drumRoll(DRUM_SEC);
    const t = setTimeout(() => setDrumming(false), DRUM_SEC * 1000);
    return () => clearTimeout(t);
  }, []);

  return drumming ? <DrumRoll /> : <Results />;
}

// תיפוף לפני חשיפת הטבלה
function DrumRoll() {
  const { state } = useRoom();
  return (
    <div className="card relative overflow-hidden py-14 text-center">
      <div className="text-sm font-bold text-indigo-400">{GAME_META[state.gameId]?.name} · סוף המשחק</div>
      <div className="mt-6 flex items-end justify-center gap-2 text-7xl sm:text-8xl">
        <span className="inline-block animate-drum">🥁</span>
        <span className="inline-block animate-drum" style={{ animationDelay: '.09s' }}>
          🥁
        </span>
      </div>
      <h2 className="mt-6 font-display text-3xl animate-shake sm:text-4xl">ו… המנצח הוא</h2>
      <div className="mt-3 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-3 w-3 rounded-full bg-grape animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-xs items-end justify-center gap-3 opacity-60">
        {['h-16', 'h-24', 'h-10'].map((h, i) => (
          <div key={i} className={`flex-1 rounded-t-2xl bg-indigo-100 animate-shake ${h}`} style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="text-2xl">❔</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Results() {
  const { state, showToast } = useRoom();
  const isHost = state.hostId === state.me;
  const players = state.players.filter((p) => p.inGame).sort((a, b) => b.score - a.score);
  const top = players[0]?.score ?? 0;
  const winners = players.filter((p) => p.score === top && top > 0);
  const podium = [players[1], players[0], players[2]];
  const heights = ['h-24', 'h-32', 'h-16'];
  const medals = ['🥈', '🥇', '🥉'];

  async function again() {
    const res = await emit('host:start', { gameId: state.gameId, settings: state.settings });
    if (res.error) showToast(res.error);
  }

  return (
    <div className="card relative overflow-hidden text-center animate-pop">
      {CONFETTI.concat(CONFETTI).map((e, i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-0 text-2xl animate-confetti"
          style={{ left: `${(i * 61) % 96}%`, animationDelay: `${(i % 8) * 0.12}s` }}
        >
          {e}
        </span>
      ))}
      <div className="pointer-events-none mb-1 text-5xl">🎊🏆🎊</div>
      <div className="text-sm font-bold text-indigo-400">{GAME_META[state.gameId]?.name} · סוף המשחק</div>
      <h2 className="mt-1 font-display text-4xl sm:text-5xl">
        {winners.length === 0
          ? 'תיקו מאופס!'
          : winners.length === 1
            ? `${winners[0].name} ניצח/ה!`
            : `תיקו! ${winners.map((w) => w.name).join(' ו')}`}
      </h2>

      <div className="mx-auto mt-8 flex max-w-md items-end justify-center gap-3">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className="flex flex-1 flex-col items-center animate-rise" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <Avatar emoji={p.emoji} size={i === 1 ? 'xl' : 'lg'} ring={i === 1} />
              <div className="mt-2 max-w-full truncate font-display text-lg">{p.name}</div>
              <div
                className={`mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl pt-2 ${heights[i]} ${
                  i === 1 ? 'bg-sun' : i === 0 ? 'bg-slate-200' : 'bg-amber-600/30'
                }`}
              >
                <span className="text-3xl">{medals[i]}</span>
                <span className="font-display text-2xl">{p.score}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex-1" />
          ),
        )}
      </div>

      {players.length > 3 && (
        <ol className="mx-auto mt-6 max-w-md space-y-1.5 text-right">
          {players.slice(3).map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-indigo-50 px-3 py-2">
              <span className="w-6 font-display text-indigo-400">{i + 4}</span>
              <Avatar emoji={p.emoji} size="sm" />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="font-display text-xl text-grape">{p.score}</span>
            </li>
          ))}
        </ol>
      )}

      {isHost ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-pink" onClick={again}>
            🔁 עוד סיבוב מאותו משחק
          </button>
          <button className="btn-ghost" onClick={() => socket.emit('host:lobby')}>
            🎮 בחירת משחק אחר
          </button>
        </div>
      ) : (
        <p className="mt-8 text-indigo-400">המארח יחליט מה משחקים עכשיו…</p>
      )}
    </div>
  );
}
