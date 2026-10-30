import { useCallback, useEffect, useMemo, useState } from 'react';
import { socket, emit, getPlayerId, loadProfile } from './socket.js';
import { RoomContext } from './components/ui.jsx';
import Home from './components/Home.jsx';
import Room from './components/Room.jsx';

export default function App() {
  const [state, setState] = useState(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState(null);
  const [chat, setChat] = useState([]);

  const showToast = useCallback((msg) => {
    setToast({ msg, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onState = (s) => {
      setState(s);
      setReceivedAt(Date.now());
    };
    // חיבור מחדש אוטומטי לחדר אחרי רענון או ניתוק
    const onConnect = async () => {
      setConnected(true);
      const code = sessionStorage.getItem('room');
      const profile = loadProfile();
      if (code && profile) {
        const res = await emit('join', { code, playerId: getPlayerId(), ...profile });
        if (res.error) {
          sessionStorage.removeItem('room');
          setState(null);
        }
      }
    };
    const onDisconnect = () => setConnected(false);
    const onChatHistory = (list) => setChat(list || []);
    const onChat = (m) => setChat((old) => [...old, m].slice(-100));
    const onKicked = () => {
      sessionStorage.removeItem('room');
      setState(null);
      setChat([]);
      showToast('הוצאת מהחדר 👋');
    };
    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('kicked', onKicked);
    socket.on('chat:history', onChatHistory);
    socket.on('chat', onChat);
    if (socket.connected) onConnect();
    return () => {
      socket.off('state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('kicked', onKicked);
      socket.off('chat:history', onChatHistory);
      socket.off('chat', onChat);
    };
  }, [showToast]);

  const act = useCallback(
    async (type, data) => {
      const res = await emit('game:action', { type, data });
      if (res.error) showToast(res.error);
      return res;
    },
    [showToast],
  );

  const leave = useCallback(() => {
    socket.emit('leave');
    sessionStorage.removeItem('room');
    setState(null);
    setChat([]);
  }, []);

  const ctx = useMemo(
    () => (state ? { state, receivedAt, act, showToast, leave, chat } : null),
    [state, receivedAt, act, showToast, leave, chat],
  );

  return (
    <div dir="rtl" className="min-h-screen">
      {!connected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-bubble py-1.5 text-center text-sm font-bold text-white">
          מתחבר לשרת… 🔌
        </div>
      )}
      {state ? (
        <RoomContext.Provider value={ctx}>
          <Room />
        </RoomContext.Provider>
      ) : (
        <Home showToast={showToast} />
      )}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise rounded-2xl bg-ink px-5 py-3 font-semibold text-white shadow-2xl"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
