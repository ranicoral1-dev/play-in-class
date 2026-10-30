import { useState } from 'react';
import { socket } from '../socket.js';
import { GAME_META } from '../lib.js';
import { useRoom, Avatar } from './ui.jsx';
import Lobby from './Lobby.jsx';
import Final from './Final.jsx';
import WouldYouRather from '../games/WouldYouRather.jsx';
import Wordle from '../games/Wordle.jsx';
import Party from '../games/Party.jsx';
import Story from '../games/Story.jsx';
import SameWord from '../games/SameWord.jsx';
import Quote from '../games/Quote.jsx';
import Complete from '../games/Complete.jsx';
import Poker from '../games/Poker.jsx';
import Town from '../games/Town.jsx';
import Chat from './Chat.jsx';

const GAME_COMPONENTS = { wyr: WouldYouRather, wordle: Wordle, party: Party, story: Story, sameword: SameWord, quote: Quote, complete: Complete, poker: Poker, town: Town };

export default function Room() {
  const { state } = useRoom();
  const me = state.players.find((p) => p.id === state.me);
  const spectator = state.status === 'game' && !me?.inGame;
  const GameComp = GAME_COMPONENTS[state.gameId];

  return (
    <div className="mx-auto max-w-6xl px-3 pb-10 pt-4 sm:px-6">
      <RoomHeader />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0">
          {state.status === 'lobby' && <Lobby />}
          {state.status === 'final' && <Final />}
          {state.status === 'game' &&
            (spectator ? (
              <div className="card text-center">
                <div className="mb-2 text-5xl">🍿</div>
                <h2 className="font-display text-2xl">משחק בעיצומו!</h2>
                <p className="mt-2 text-indigo-500">
                  כרגע משחקים ב״{GAME_META[state.gameId]?.name}״. תצטרפו מהמשחק הבא 🙂
                </p>
              </div>
            ) : (
              GameComp && state.game && <GameComp g={state.game} key={state.gameId} />
            ))}
        </main>
        <div className="h-fit space-y-4 lg:sticky lg:top-4">
          <Roster />
          <Chat />
        </div>
      </div>
    </div>
  );
}

function RoomHeader() {
  const { state, leave, showToast } = useRoom();
  const isHost = state.hostId === state.me;

  function copyLink() {
    const url = `${location.origin}${location.pathname}?code=${state.code}`;
    navigator.clipboard?.writeText(url).then(
      () => showToast('הקישור הועתק! 📋'),
      () => showToast(url),
    );
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/10 px-4 py-3 text-white backdrop-blur sm:px-6">
      <div className="font-display text-xl leading-tight sm:text-2xl">
        לשחק בכיתה <span className="text-sun">כי למה לא</span>
      </div>
      <button
        onClick={copyLink}
        title="העתקת קישור הזמנה"
        className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-1.5 text-ink shadow-[0_5px_0_rgba(0,0,0,0.2)] transition active:translate-y-1 active:shadow-none"
      >
        <span className="text-sm font-bold text-indigo-400">קוד חדר</span>
        <span dir="ltr" className="font-display text-3xl tracking-[0.25em] sm:text-4xl">
          {state.code}
        </span>
        <span className="text-lg opacity-60 group-hover:opacity-100">📋</span>
      </button>
      <div className="flex items-center gap-2">
        {isHost && state.status === 'game' && (
          <button
            className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"
            onClick={() => confirm('לסיים את המשחק עכשיו?') && socket.emit('host:end')}
          >
            סיום משחק
          </button>
        )}
        <button
          className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold hover:bg-white/25"
          onClick={() => confirm('לצאת מהחדר?') && leave()}
        >
          יציאה
        </button>
      </div>
    </header>
  );
}

function Roster() {
  const { state } = useRoom();
  const [open, setOpen] = useState(false);
  const isHost = state.hostId === state.me;
  const showScores = state.status !== 'lobby';
  const players = [...state.players].sort((a, b) => (showScores ? b.score - a.score : 0));
  const online = state.players.filter((p) => p.connected).length;

  return (
    <aside className="card p-4">
      <button className="flex w-full items-center justify-between lg:cursor-default" onClick={() => setOpen((o) => !o)}>
        <h3 className="font-display text-xl">
          {showScores ? '🏆 ניקוד' : '👥 שחקנים'}{' '}
          <span className="text-base text-indigo-400">({online})</span>
        </h3>
        <span className="text-indigo-400 lg:hidden">{open ? '▲' : '▼'}</span>
      </button>
      <ul className={`mt-3 space-y-1.5 ${open ? '' : 'hidden'} lg:block`}>
        {players.map((p, i) => (
          <li
            key={p.id}
            className={`group flex items-center gap-2 rounded-2xl px-2 py-1.5 animate-rise ${
              p.id === state.me ? 'bg-amber-50' : ''
            }`}
          >
            {showScores && <span className="w-5 text-center text-sm font-bold text-indigo-300">{i + 1}</span>}
            <Avatar emoji={p.emoji} size="sm" dim={!p.connected} />
            <span className={`flex-1 truncate font-semibold ${p.connected ? '' : 'text-slate-400'}`}>
              {p.name}
              {p.id === state.hostId && <span title="מארח החדר"> 👑</span>}
              {!p.connected && <span className="text-xs"> (מנותק)</span>}
            </span>
            {showScores && <span className="font-display text-lg text-grape">{p.score}</span>}
            {isHost && p.id !== state.me && (
              <button
                title="הוצאה מהחדר"
                className="hidden text-sm text-slate-300 hover:text-bubble group-hover:inline"
                onClick={() => confirm(`להוציא את ${p.name}?`) && socket.emit('host:kick', p.id)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
