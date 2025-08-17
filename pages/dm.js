import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import ChatRoom from '@/components/ChatRoom';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function DMPage() {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const [activeRoom, setActiveRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  const { data: roomsData, mutate: mutateRooms } = useSWR(user ? '/api/chat/rooms' : null, fetcher);
  const dmRooms = useMemo(() => (roomsData?.rooms || []).filter((r) => !r.isGroup), [roomsData]);

  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    const q = username.trim();
    if (!q) { setSuggestions([]); return; }
    setSearching(true);
    fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => setSuggestions(data.users || []))
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [username, user]);

  if (!user) return <div className="p-4">Please log in.</div>;

  async function startDM(targetUsername) {
    if (!targetUsername) return;
    try {
      const res = await fetch('/api/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: targetUsername }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveRoom(data.room);
      mutateRooms();
      setUsername('');
      setSuggestions([]);
    } catch {}
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 h-[calc(100vh-120px)] sm:h-[85vh]">
      <aside className="border-r border-slate-200 p-3 space-y-3 overflow-y-auto">
        <div>
          <div className="text-xs text-slate-500 mb-1">Start a DM</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="w-full rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800"
          />
          {username && (
            <div className="mt-2 border rounded-md bg-white overflow-hidden">
              {searching && <div className="p-2 text-xs text-slate-500">Searching...</div>}
              {!searching && suggestions.length === 0 && (
                <div className="p-2 text-xs text-slate-500">No users</div>
              )}
              {!searching && suggestions.map((u) => (
                <div key={u._id} className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer" onClick={() => startDM(u.username)}>
                  {u.username}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="text-xs text-slate-500 mb-2">Your DMs</div>
          <div className="space-y-2">
            {dmRooms.map((r) => (
              <div
                key={r._id}
                onClick={() => setActiveRoom(r)}
                className={`rounded-lg p-3 cursor-pointer border ${activeRoom?._id === r._id ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200'}`}
              >
                <div className="text-sm font-medium">{r.name || 'Direct Message'}</div>
              </div>
            ))}
            {dmRooms.length === 0 && <div className="text-xs text-slate-500">No DMs yet</div>}
          </div>
        </div>
      </aside>
      <main className="sm:col-span-2 p-2 sm:p-3 space-y-3 relative flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          {activeRoom ? (
            <ChatRoom roomId={activeRoom._id} user={user} />
          ) : (
            <div className="p-4 text-slate-500">Start or select a DM</div>
          )}
        </div>
      </main>
    </div>
  );
}


