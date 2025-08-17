import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

let socket;

export default function DMRoom({ roomId, user }) {
  const [messages, setMessages] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [input, setInput] = useState('');
  const [participants, setParticipants] = useState({});
  const listRef = useRef(null);
  const prevRoomRef = useRef(null);
  const messageIdsRef = useRef(new Set());
  const earliestRef = useRef(null);

  function normalizeMessage(raw) {
    if (!raw) return raw;
    const id = raw._id ? String(raw._id) : undefined;
    const senderId = raw.senderId ? String(raw.senderId) : undefined;
    const roomIdStr = raw.roomId ? String(raw.roomId) : undefined;
    return { ...raw, _id: id, senderId, roomId: roomIdStr };
  }

  function appendMessageUnique(rawMsg) {
    const msg = normalizeMessage(rawMsg);
    const key = msg?._id || `${msg?.senderId || 'unknown'}:${msg?.content || ''}:${msg?.createdAt || ''}`;
    if (!key) return;
    if (messageIdsRef.current.has(key)) return;
    messageIdsRef.current.add(key);
    setMessages((prev) => [...prev, msg]);
  }

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      try {
        const res = await fetch(`/api/chat/messages?roomId=${roomId}`, { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data.messages)) {
          const normalized = data.messages.map((m) => normalizeMessage(m));
          const ids = new Set(normalized.map((m) => m._id || ''));
          messageIdsRef.current = ids;
          setMessages(normalized);
          earliestRef.current = normalized[0]?.createdAt || null;
        }
      } catch {}
    }
    loadHistory();

    async function loadParticipants() {
      try {
        const res = await fetch(`/api/chat/participants?roomId=${roomId}`, { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        const map = {};
        for (const u of data.users || []) {
          map[String(u._id)] = u;
        }
        map[String(user._id)] = map[String(user._id)] || { _id: user._id, username: user.username, profilePictureUrl: user.profilePictureUrl };
        if (mounted) setParticipants(map);
      } catch {}
    }
    loadParticipants();

    const socketBase = (process.env.NEXT_PUBLIC_SOCKET_BASE || '').trim() || undefined;
    const usingExternal = Boolean(socketBase);
    if (!usingExternal) fetch(`/api/socket`);
    if (!socket) {
      socket = io(socketBase, { path: usingExternal ? '/socket.io' : '/api/socket/io', transports: ['websocket', 'polling'] });
      socket.on('connect_error', (e) => console.error('Socket connect_error', e?.message || e));
    }

    if (prevRoomRef.current && prevRoomRef.current !== roomId) {
      socket.emit('leave', { roomId: prevRoomRef.current });
    }
    prevRoomRef.current = roomId;
    socket.emit('join', { roomId });
    socket.on('message', (msg) => appendMessageUnique(msg));
    socket.on('typing', ({ userId }) => {
      setTypingUserId(userId);
      setTimeout(() => setTypingUserId(null), 1500);
    });
    return () => {
      mounted = false;
      socket.off('message');
      socket.off('typing');
    };
  }, [roomId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!earliestRef.current) return;
    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&before=${encodeURIComponent(earliestRef.current)}&limit=100`, { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = (data.messages || []).map((m) => normalizeMessage(m));
      if (!normalized.length) return;
      earliestRef.current = normalized[0]?.createdAt || earliestRef.current;
      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m._id || ''));
        const deduped = normalized.filter((m) => !prevIds.has(m._id || ''));
        return [...deduped, ...prev];
      });
    } catch {}
  }

  function onTyping() {
    socket.emit('typing', { roomId, userId: user._id });
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ roomId, content, isDebate: false }),
      });
      if (res.ok) {
        const { message } = await res.json();
        appendMessageUnique(message);
        socket.emit('message', { roomId, userId: user._id, content, isDebate: false, alreadySaved: true, _id: message?._id });
      }
    } catch {}
  }

  function Avatar({ senderId }) {
    const meta = participants[String(senderId)] || {};
    const url = meta.profilePictureUrl;
    const name = meta.username || 'User';
    if (url) {
      return <img src={url} alt={name} title={name} className="w-7 h-7 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-200" />;
    }
    const initial = (name || '?').slice(0, 1).toUpperCase();
    return (
      <div title={name} className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-slate-300 text-slate-700 text-xs flex items-center justify-center border border-slate-200">
        {initial}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop <= 0) loadOlder();
        }}
        className="flex-1 overflow-y-auto space-y-2 p-3 pb-40 sm:pb-3"
      >
        {messages.map((m) => {
          const mine = String(m.senderId) === String(user._id);
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <Avatar senderId={m.senderId} />
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-base sm:text-sm shadow ${mine ? 'bubble-mine' : 'bubble-other'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
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
            placeholder={'Type a message'}
            className="flex-1 rounded-full bg-white border border-slate-300 px-4 py-3 text-base text-slate-800"
          />
          <button className="rounded-full px-5 py-3 text-base font-medium btn-mint">Send</button>
        </div>
      </form>
    </div>
  );
}


