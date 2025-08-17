import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

let socket;

export default function ChatRoom({ roomId, user, triadId = null, promptId = null, triadStartedAt = null, triadDurationSec = 600 }) {
  const [messages, setMessages] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [input, setInput] = useState('');
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [participants, setParticipants] = useState({});
  const listRef = useRef(null);
  const prevRoomRef = useRef(null);
  const messageIdsRef = useRef(new Set());
  const earliestRef = useRef(null);
  const latestRef = useRef(null);
  const lastSocketAtRef = useRef(0);

  function normalizeMessage(raw) {
    if (!raw) return raw;
    const id = raw._id ? String(raw._id) : undefined;
    const senderId = raw.senderId ? String(raw.senderId) : undefined;
    const roomIdStr = raw.roomId ? String(raw.roomId) : undefined;
    const triadIdStr = raw.triadId ? String(raw.triadId) : null;
    const promptIdStr = raw.promptId ? String(raw.promptId) : null;
    return { ...raw, _id: id, senderId, roomId: roomIdStr, triadId: triadIdStr, promptId: promptIdStr };
  }

  function appendMessageUnique(rawMsg) {
    const msg = normalizeMessage(rawMsg);
    const key = msg?._id || `${msg?.senderId || 'unknown'}:${msg?.content || ''}:${msg?.createdAt || ''}`;
    if (!key) return;
    if (messageIdsRef.current.has(key)) return;
    messageIdsRef.current.add(key);
    setMessages((prev) => [...prev, msg]);
    // Track latest createdAt for polling since
    if (msg?.createdAt) {
      const ts = new Date(msg.createdAt).getTime();
      if (!latestRef.current || ts > new Date(latestRef.current).getTime()) latestRef.current = msg.createdAt;
    }
    lastSocketAtRef.current = Date.now();
  }

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
      try {
        const res = await fetch(`/api/chat/messages?roomId=${roomId}`, { credentials: 'same-origin' });
        if (!res.ok) {
          console.error('Failed to load messages', res.status);
          return;
        }
        const data = await res.json();
        if (mounted && Array.isArray(data.messages)) {
          const normalized = data.messages.map((m) => normalizeMessage(m));
          const ids = new Set(normalized.map((m) => m._id || '')); 
          messageIdsRef.current = ids;
          setMessages(normalized);
          earliestRef.current = normalized[0]?.createdAt || null;
          latestRef.current = normalized[normalized.length - 1]?.createdAt || null;
        }
      } catch (err) {
        console.error('Error loading messages', err);
      }
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
        // include self as fallback
        map[String(user._id)] = map[String(user._id)] || { _id: user._id, username: user.username, profilePictureUrl: user.profilePictureUrl };
        if (mounted) setParticipants(map);
      } catch {}
    }
    loadParticipants();

    const socketBase = (process.env.NEXT_PUBLIC_SOCKET_BASE || '').trim() || undefined;
    const usingExternal = Boolean(socketBase);
    if (!usingExternal) {
      // Warm up Next.js Socket.IO server only for same-origin
      fetch(`/api/socket`);
    }
    if (!socket) {
      socket = io(socketBase, {
        path: usingExternal ? '/socket.io' : '/api/socket/io',
        transports: ['websocket', 'polling'],
      });
      socket.on('connect_error', (e) => console.error('Socket connect_error', e?.message || e));
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
      appendMessageUnique(msg);
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

  // Fallback polling if socket is quiet
  useEffect(() => {
    let timer;
    async function poll() {
      try {
        const since = latestRef.current ? `&since=${encodeURIComponent(latestRef.current)}` : '';
        const res = await fetch(`/api/chat/messages?roomId=${roomId}${since}`, { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        const incoming = Array.isArray(data.messages) ? data.messages : [];
        for (const m of incoming) appendMessageUnique(m);
      } catch {}
    }
    function tick() {
      const quietMs = Date.now() - (lastSocketAtRef.current || 0);
      if (quietMs > 4000) poll();
    }
    timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
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
      // prepend without duplicates
      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m._id || ''));
        const deduped = normalized.filter((m) => !prevIds.has(m._id || ''));
        return [...deduped, ...prev];
      });
    } catch {}
  }

  function onTyping() {
    if (locked) return;
    socket.emit('typing', { roomId, userId: user._id });
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (locked || !input.trim()) return;
    const content = input;
    setInput('');
    try {
      // Persist first via REST (works on Vercel and local)
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ roomId, content, isDebate: Boolean(triadId), triadId, promptId }),
      });
      if (res.ok) {
        const { message } = await res.json();
        // Add once; socket echo will be deduped
        appendMessageUnique(message);
        // Fire-and-forget socket broadcast for other clients
        socket.emit('message', { roomId, userId: user._id, content, isDebate: Boolean(triadId), triadId, promptId, alreadySaved: true, _id: message?._id });
      } else {
        console.error('POST /api/chat/messages failed', res.status);
      }
    } catch (err) {
      console.error('sendMessage error', err);
    }
  }

  const mins = remaining != null ? Math.floor(remaining / 60) : null;
  const secs = remaining != null ? remaining % 60 : null;

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
      {triadId && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-700 border-b border-slate-200 bg-white/70">
          <div>Debate time</div>
          <div className="rounded-md bg-slate-200 text-slate-800 px-2 py-1 font-mono">{mins != null ? `${mins}:${secs.toString().padStart(2, '0')}` : '--:--'}</div>
        </div>
      )}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop <= 0) loadOlder();
        }}
        className="flex-1 overflow-y-auto space-y-2 p-3 pb-44 sm:pb-3"
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
      <form onSubmit={sendMessage} className="sm:static fixed z-40 bottom-16 inset-x-0 sm:inset-auto p-3 sm:p-3 border-t border-slate-200 bg-white/90 backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <div className="mx-auto max-w-3xl flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={onTyping}
            placeholder={locked ? 'Debate is closed' : 'Type a message'}
            className={`flex-1 rounded-full bg-white border border-slate-300 px-4 py-3 text-base text-slate-800 ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={locked}
          />
          <button disabled={locked} className={`rounded-full px-5 py-3 text-base font-medium btn-mint ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>{locked ? 'Closed' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
} 