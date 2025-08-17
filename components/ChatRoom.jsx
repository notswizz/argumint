import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

let socket;

export default function ChatRoom({ roomId, user, triadId = null, promptId = null, triadStartedAt = null, triadDurationSec = 600 }) {
  const [messages, setMessages] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [input, setInput] = useState('');
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const listRef = useRef(null);
  const prevRoomRef = useRef(null);

  useEffect(() => {
    // Local countdown for triad
    if (!triadId || !triadStartedAt) return;
    const startMs = new Date(triadStartedAt).getTime();
    const endMs = startMs + (triadDurationSec || 600) * 1000;
    function tick() {
      const now = Date.now();
      const sec = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemaining(sec);
      if (sec === 0) setLocked(true);
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [triadId, triadStartedAt, triadDurationSec]);

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      const socketBase = process.env.NEXT_PUBLIC_SOCKET_BASE || '';
      const apiBase = socketBase || '';
      const res = await fetch(`${apiBase}/api/chat/messages?roomId=${roomId}`);
      const data = await res.json();
      if (mounted && Array.isArray(data.messages)) setMessages(data.messages);
    }
    loadHistory();

    const socketBase = process.env.NEXT_PUBLIC_SOCKET_BASE || '';
    fetch(`${socketBase}/api/socket`);
    if (!socket) {
      socket = io(socketBase || undefined, { path: '/api/socket/io', transports: ['websocket', 'polling'] });
    }

    // Leave the previous room to avoid receiving its events
    if (prevRoomRef.current && prevRoomRef.current !== roomId) {
      socket.emit('leave', { roomId: prevRoomRef.current });
    }
    prevRoomRef.current = roomId;

    // Reset local lock/timer whenever we switch rooms
    setLocked(false);
    setRemaining(null);

    socket.emit('join', { roomId });
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('typing', ({ userId }) => {
      setTypingUserId(userId);
      setTimeout(() => setTypingUserId(null), 1500);
    });
    socket.on('triad_locked', ({ roomId: rid }) => {
      if (rid === roomId) {
        setLocked(true);
        setRemaining(0);
      }
    });
    return () => {
      mounted = false;
      socket.off('message');
      socket.off('typing');
      socket.off('triad_locked');
    };
  }, [roomId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function onTyping() {
    if (locked) return;
    socket.emit('typing', { roomId, userId: user._id });
  }

  function sendMessage(e) {
    e.preventDefault();
    if (locked || !input.trim()) return;
    socket.emit('message', { roomId, userId: user._id, content: input, isDebate: Boolean(triadId), triadId, promptId });
    setInput('');
  }

  const mins = remaining != null ? Math.floor(remaining / 60) : null;
  const secs = remaining != null ? remaining % 60 : null;

  return (
    <div className="flex flex-col h-full">
      {triadId && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-700 border-b border-slate-200 bg-white/70">
          <div>Debate time</div>
          <div className="rounded-md bg-slate-200 text-slate-800 px-2 py-1 font-mono">{mins != null ? `${mins}:${secs.toString().padStart(2, '0')}` : '--:--'}</div>
        </div>
      )}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-3 pb-40 sm:pb-3">
        {messages.map((m) => (
          <div key={m._id} className={`flex ${m.senderId === user._id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${m.senderId === user._id ? 'bubble-mine' : 'bubble-other'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {typingUserId && typingUserId !== user._id && (
          <div className="text-xs text-slate-500">Someone is typing...</div>
        )}
      </div>
      <form onSubmit={sendMessage} className="sm:static fixed z-40 bottom-28 inset-x-0 sm:inset-auto p-3 sm:p-3 border-t border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-3xl flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={onTyping}
            placeholder={locked ? 'Debate is closed' : 'Type a message'}
            className={`flex-1 rounded-full bg-white border border-slate-300 px-4 py-2 text-sm text-slate-800 ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={locked}
          />
          <button disabled={locked} className={`rounded-full px-4 py-2 text-sm font-medium btn-mint ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>{locked ? 'Closed' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
} 