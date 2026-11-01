import { useEffect, useRef } from 'react';
import { socket } from '../socket.js';
import { pop, success, fail } from '../sound.js';
import { useRoom, GameHeader, PlayerTag, Avatar, NextButton, RoundPoints, usePlayer } from '../components/ui.jsx';

const HANDS = ['L', 'R'];
const HAND_NAME = { L: '👈 שמאל', R: 'ימין 👉' };
const SEND_MS = 45;
// מה רואים מסביב למטפס (יחידות עולם)
const VIEW_W = 100;
const VIEW_H = 180;
const VIEW_ABOVE = 110;
const r1 = (n) => Math.round(n * 10) / 10;

export default function Climb({ g }) {
  return (
    <div className="card">
      <GameHeader title="💪 יום בחיי זרוע" round={g.round} totalRounds={g.totalRounds} />
      {g.phase === 'climb' && <ClimbPhase g={g} />}
      {g.phase === 'results' && <Results g={g} />}
    </div>
  );
}

function ClimbPhase({ g }) {
  const { state } = useRoom();
  const team = g.teams[g.mine];
  const myHands = team ? HANDS.filter((h) => team.ctrl[h] === state.me) : [];
  const partner = team && myHands.length === 1 ? team.ctrl[myHands[0] === 'L' ? 'R' : 'L'] : null;
  const partnerP = usePlayer(partner);

  useEffect(() => {
    if (g.hit) fail();
  }, [g.hit]);
  useEffect(() => {
    if (team?.place) success();
  }, [team?.place]);

  return (
    <div className="animate-rise space-y-3">
      {team && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-indigo-600">
          {myHands.length === 2 ? (
            <span className="font-bold">אתם מטפסים לבד - שתי הידיים שלכם! (צד שמאל של המסך = יד שמאל) · בטלפון אפשר בשתי אצבעות</span>
          ) : (
            <>
              <span className="font-bold">את/ה היד ה{HAND_NAME[myHands[0]]}</span>·
              <span className="flex items-center gap-1">
                השותף: <Avatar emoji={partnerP.emoji} size="sm" /> {partnerP.name}
              </span>
            </>
          )}
        </div>
      )}
      <p className="text-center text-sm text-indigo-400">לוחצים כדי לתפוס בקיר, גוררים למטה כדי לעלות, משחררים כדי להזיז את היד. תתאמו - יד אחת תמיד על הקיר!</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
        {team ? <Wall g={g} team={team} myHands={myHands} /> : <p className="text-indigo-400">צופים 🍿</p>}
        <Progress g={g} />
      </div>
    </div>
  );
}

function Wall({ g, team, myHands }) {
  const svgRef = useRef();
  const teamRef = useRef(team);
  teamRef.current = team;
  const pointers = useRef(new Map()); // pointerId -> יד
  const lastSend = useRef({ L: 0, R: 0 });
  const pending = useRef({});
  const solo = myHands.length === 2;

  useEffect(() => () => Object.values(pending.current).forEach(clearTimeout), []);

  function toWorld(e) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: -p.y };
  }

  // איפה היד ביחס לכתף
  function offset(h, w) {
    const t = teamRef.current;
    return { x: w.x - (t.x + (h === 'L' ? -g.shX : g.shX)), y: w.y - (t.y + g.shY) };
  }

  function send(h, o, grip) {
    const data = { h, x: r1(o.x), y: r1(o.y) };
    clearTimeout(pending.current[h]);
    const go = () => {
      lastSend.current[h] = Date.now();
      socket.emit('game:action', { type: 'hand', data });
    };
    if (grip !== undefined) {
      data.grip = grip;
      return go();
    }
    const wait = SEND_MS - (Date.now() - lastSend.current[h]);
    if (wait <= 0) go();
    else pending.current[h] = setTimeout(go, wait);
  }

  const busy = () => [...pointers.current.values()];

  function pickHand(w) {
    if (!myHands.length) return null;
    if (!solo) return myHands[0];
    let h = w.x < teamRef.current.x ? 'L' : 'R';
    if (busy().includes(h)) h = h === 'L' ? 'R' : 'L';
    return busy().includes(h) ? null : h;
  }

  function down(e) {
    e.preventDefault();
    const w = toWorld(e);
    const h = pickHand(w);
    if (!h || busy().includes(h)) return;
    pointers.current.set(e.pointerId, h);
    svgRef.current.setPointerCapture?.(e.pointerId);
    send(h, offset(h, w), true);
    pop();
  }

  function move(e) {
    const w = toWorld(e);
    const h = pointers.current.get(e.pointerId);
    if (h) return send(h, offset(h, w));
    // עכבר בלי לחיצה: היד עוקבת אחרי הסמן
    if (e.pointerType === 'mouse') {
      const free = pickHand(w);
      if (free) send(free, offset(free, w));
    }
  }

  function up(e) {
    const h = pointers.current.get(e.pointerId);
    if (!h) return;
    pointers.current.delete(e.pointerId);
    send(h, offset(h, toWorld(e)), false);
  }

  const vx = team.x - VIEW_W / 2;
  const top = team.y + VIEW_ABOVE;
  const bottom = top - VIEW_H;
  const H = g.height;

  // חלונות רק במה שרואים
  const windows = [];
  for (let wy = Math.max(10, Math.floor(bottom / 28) * 28 + 10); wy < Math.min(H - 10, top); wy += 28) {
    for (const wx of [10, 42, 74]) windows.push([wx, wy]);
  }
  const marks = [];
  for (let m = Math.ceil(Math.max(0, bottom) / 100) * 100; m <= Math.min(H, top); m += 100) marks.push(m);

  return (
    <svg
      ref={svgRef}
      viewBox={`${vx} ${-top} ${VIEW_W} ${VIEW_H}`}
      className="select-none rounded-3xl shadow-inner"
      style={{ width: 'min(100%, 40vh)', aspectRatio: `${VIEW_W} / ${VIEW_H}`, touchAction: 'none', background: 'linear-gradient(#7dd3fc, #e0f2fe)' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* הבניין */}
      <rect x={0} y={-H} width={100} height={H} fill="#c2410c" />
      <rect x={0} y={-H} width={100} height={H} fill="url(#bricks)" opacity={0.25} />
      <defs>
        <pattern id="bricks" width="10" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H10M0 3H10M5 0V3M0 3V6" stroke="#7c2d12" strokeWidth="0.4" fill="none" />
        </pattern>
      </defs>
      {windows.map(([wx, wy]) => (
        <g key={`${wx}:${wy}`}>
          <rect x={wx} y={-(wy + 14)} width={16} height={14} rx={1} fill="#bae6fd" stroke="#fef3c7" strokeWidth={1} />
          <line x1={wx + 8} y1={-(wy + 14)} x2={wx + 8} y2={-wy} stroke="#fef3c7" strokeWidth={0.6} />
        </g>
      ))}
      {marks.map((m) => (
        <text key={m} x={1.5} y={-m} fontSize={4} fill="#fff7ed" fontWeight="bold">
          {m === H ? '🏁' : m}
        </text>
      ))}
      {/* גג */}
      <rect x={-2} y={-(H + 4)} width={104} height={4} fill="#1e293b" />
      <line x1={50} y1={-(H + 4)} x2={50} y2={-(H + 22)} stroke="#1e293b" strokeWidth={0.8} />
      <path d={`M50 ${-(H + 22)} L64 ${-(H + 18)} L50 ${-(H + 14)} Z`} fill="#facc15" />
      {/* קרקע */}
      <rect x={vx - 10} y={0} width={VIEW_W + 20} height={60} fill="#65a30d" />

      {/* שאר הקבוצות - כרוחות שקופות */}
      {g.teams.map((t, i) => i !== g.mine && Math.abs(t.y - team.y) < VIEW_H && <Ghost key={i} t={t} />)}

      {g.pots.map((p) => (
        <text key={p.id} x={p.x} y={-p.y} fontSize={8} textAnchor="middle" dominantBaseline="central">
          🪴
        </text>
      ))}
      {g.birds.map((b, i) => (
        <text key={i} transform={`translate(${b.x} ${-b.y}) scale(${-b.dir} 1)`} fontSize={9} textAnchor="middle" dominantBaseline="central">
          🐦
        </text>
      ))}

      {myHands.map((h) => (
        <circle key={h} cx={team.x + (h === 'L' ? -g.shX : g.shX)} cy={-(team.y + g.shY)} r={g.reach} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.5} strokeDasharray="2 2" />
      ))}
      <Climber t={team} g={g} myHands={myHands} />
    </svg>
  );
}

function Climber({ t, g, myHands }) {
  const { x, y } = t;
  const left = usePlayer(t.ctrl.L);
  const right = usePlayer(t.ctrl.R);
  return (
    <g>
      {/* רגליים */}
      <line x1={x - 3} y1={-(y - 8)} x2={x - 6} y2={-(y - 22)} stroke="#1e3a8a" strokeWidth={3.5} strokeLinecap="round" />
      <line x1={x + 3} y1={-(y - 8)} x2={x + 6} y2={-(y - 22)} stroke="#1e3a8a" strokeWidth={3.5} strokeLinecap="round" />
      {/* ידיים */}
      {HANDS.map((h) => {
        const sx = x + (h === 'L' ? -g.shX : g.shX);
        const sy = y + g.shY;
        const hp = t.hands[h];
        const len = Math.hypot(hp.x - sx, hp.y - sy);
        const mine = myHands.includes(h);
        const color = len > g.reach * 1.1 ? '#ef4444' : mine ? '#facc15' : '#fde68a';
        return (
          <g key={h}>
            <line x1={sx} y1={-sy} x2={hp.x} y2={-hp.y} stroke={color} strokeWidth={mine ? 3.4 : 2.8} strokeLinecap="round" />
            <circle cx={hp.x} cy={-hp.y} r={hp.grip ? 3.6 : 3} fill={hp.grip ? '#b45309' : '#fde68a'} stroke={mine ? '#fff' : '#92400e'} strokeWidth={mine ? 1.2 : 0.6} />
            {g.snap?.[h] && (
              <text x={hp.x} y={-(hp.y + 6)} fontSize={6} textAnchor="middle">
                😣
              </text>
            )}
            <text x={hp.x} y={-(hp.y - 7)} fontSize={4.5} textAnchor="middle">
              {(h === 'L' ? left : right).emoji}
            </text>
          </g>
        );
      })}
      {/* גוף וראש */}
      <rect x={x - 7} y={-(y + 11)} width={14} height={20} rx={5} fill="#6d28d9" />
      <circle cx={x} cy={-(y + 17)} r={6} fill="#fcd34d" />
      <circle cx={x - 2} cy={-(y + 18)} r={0.8} fill="#1e293b" />
      <circle cx={x + 2} cy={-(y + 18)} r={0.8} fill="#1e293b" />
      {t.stunned && (
        <text x={x} y={-(y + 27)} fontSize={7} textAnchor="middle">
          💫
        </text>
      )}
      {t.place && (
        <text x={x} y={-(y + 30)} fontSize={9} textAnchor="middle">
          🏆
        </text>
      )}
    </g>
  );
}

function Ghost({ t }) {
  const p = usePlayer(t.ctrl.L);
  return (
    <g opacity={0.3}>
      <rect x={t.x - 6} y={-(t.y + 10)} width={12} height={18} rx={5} fill="#1e293b" />
      <circle cx={t.x} cy={-(t.y + 15)} r={5} fill="#1e293b" />
      <text x={t.x} y={-(t.y + 15)} fontSize={6} textAnchor="middle" dominantBaseline="central">
        {p.emoji}
      </text>
    </g>
  );
}

// כמה כל קבוצה טיפסה
function Progress({ g }) {
  return (
    <div className="flex h-48 items-end gap-2 rounded-3xl bg-indigo-50 p-3 sm:h-[40vh]">
      {g.teams.map((t, i) => (
        <div key={i} className="flex h-full w-10 flex-col items-center">
          <div className="relative w-4 flex-1 overflow-hidden rounded-full bg-white">
            <div className={`absolute inset-x-0 bottom-0 rounded-full ${i === g.mine ? 'bg-sun' : 'bg-grape/70'}`} style={{ height: `${Math.min(100, (t.y / g.height) * 100)}%` }} />
          </div>
          <TeamFaces t={t} />
          {t.place && <span className="text-xs font-bold">#{t.place}</span>}
        </div>
      ))}
    </div>
  );
}

function TeamFaces({ t }) {
  const a = usePlayer(t.ctrl.L);
  const b = usePlayer(t.ctrl.R);
  return (
    <div className="mt-1 flex flex-col items-center text-lg leading-tight" title={`${a.name}${t.ctrl.L !== t.ctrl.R ? ` + ${b.name}` : ''}`}>
      <span>{a.emoji}</span>
      {t.ctrl.L !== t.ctrl.R && <span>{b.emoji}</span>}
    </div>
  );
}

function Results({ g }) {
  const last = g.round >= g.totalRounds;
  const teams = [...g.teams].sort((a, b) => a.place - b.place);
  return (
    <div className="animate-rise space-y-4 text-center">
      <h3 className="font-display text-3xl">🏁 סוף הטיפוס</h3>
      <ol className="mx-auto max-w-md space-y-2">
        {teams.map((t, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-2xl p-2 ${t.place === 1 ? 'bg-amber-100' : 'bg-indigo-50'}`}>
            <span className="w-8 font-display text-2xl">{['🥇', '🥈', '🥉'][t.place - 1] || `#${t.place}`}</span>
            <span className="flex flex-1 flex-wrap gap-2">
              <PlayerTag id={t.ctrl.L} />
              {t.ctrl.R !== t.ctrl.L && <PlayerTag id={t.ctrl.R} />}
            </span>
            <span className="text-sm font-bold text-indigo-500">{t.doneAt ? `${(t.doneAt / 1000).toFixed(1)} שנ׳` : `${Math.round((t.y / g.height) * 100)}%`}</span>
          </li>
        ))}
      </ol>
      <RoundPoints points={g.roundPoints} />
      <NextButton label={last ? 'לטבלה הסופית 🏆' : 'לסיבוב הבא ←'} />
    </div>
  );
}
