import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import ChatRoom from '@/components/ChatRoom';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function DebatePage() {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const { data: roomsData } = useSWR(user ? '/api/chat/rooms' : null, fetcher);
  const [activeRoom, setActiveRoom] = useState(null);
  const [query, setQuery] = useState('');
  const [showRooms, setShowRooms] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const { data: triadData } = useSWR(activeRoom ? `/api/triads/by-room?roomId=${activeRoom._id}` : null, fetcher);
  const triad = triadData?.triad;
  const activeTriad = triad && triad.status === 'active' ? triad : null;
  const triadExists = Boolean(triad && triad._id);
  const { data: introData } = useSWR(triad ? `/api/triads/intro?triadId=${triad._id}` : null, fetcher);

  useEffect(() => {
    if (roomsData?.rooms?.length && !activeRoom) {
      const firstGroup = roomsData.rooms.find((r) => r.isGroup);
      if (firstGroup) setActiveRoom(firstGroup);
    }
  }, [roomsData, activeRoom]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (roomsData?.rooms || []).filter((r) => r.isGroup);
    if (!q) return list;
    return list.filter((r) => (r.name || '').toLowerCase().includes(q));
  }, [roomsData, query]);

  if (!user) return <div className="p-4">Please log in.</div>;

  function ScoreBadge({ triad }) {
    if (!triad || triad.myPlace == null) return null;
    const placeColors = triad.myPlace === 1 ? 'bg-emerald-100 text-emerald-700' : triad.myPlace === 2 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700';
    return (
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide ${placeColors}`}>#{triad.myPlace}</span>
        <span className="rounded-md bg-slate-200 text-slate-800 px-2 py-0.5 text-[10px] font-mono">{triad.myScore ?? 0}</span>
      </div>
    );
  }

  const gridClasses = roomsOpen
    ? 'grid grid-cols-1 lg:grid-cols-[300px_1fr]'
    : 'grid grid-cols-1';

  return (
    <div className={`${gridClasses} h-[calc(100dvh-120px)] w-full`}>
      {roomsOpen && (
      <aside className="border-r border-slate-200 p-3 space-y-3 lg:block hidden overflow-y-auto max-w-full w-[300px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search debates..."
          className="w-full rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800"
        />
        <div className="space-y-2">
          {filteredRooms.map((r) => (
            <div
              key={r._id}
              onClick={() => setActiveRoom(r)}
              className={`rounded-lg p-3 cursor-pointer border ${activeRoom?._id === r._id ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{r.name || 'Debate Room'}</div>
                  <div className="text-xs text-slate-500">{r.participants.length} members{r.triad?.status ? ` • ${r.triad.status}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.triad?.isWinner && (
                    <span className="rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>
                  )}
                  <ScoreBadge triad={r.triad} />
                </div>
              </div>
            </div>
          ))}
          {filteredRooms.length === 0 && <div className="text-xs text-slate-500">No matches</div>}
        </div>
      </aside>
      )}
      <main className={`p-2 lg:p-2 space-y-2 relative flex flex-col min-h-0 w-full`}>
        <div className="lg:hidden flex items-center justify-between mb-1">
          <button onClick={() => setShowRooms(true)} className="rounded-md bg-slate-200 border border-slate-300 px-3 py-2 text-xs text-slate-800">Debates</button>
          {activeRoom && <div className="text-xs text-slate-500 truncate max-w-[60%]">{activeRoom.name || 'Debate Room'}</div>}
        </div>
        <div className="hidden lg:flex items-center justify-between mb-1">
          <button onClick={() => setRoomsOpen((v) => !v)} className="rounded-md bg-slate-200 border border-slate-300 px-3 py-1.5 text-[11px] text-slate-800">
            {roomsOpen ? 'Hide Past Debates' : 'Show Past Debates'}
          </button>
          {activeRoom && <div className="text-xs text-slate-500 truncate max-w-[60%]">{activeRoom.name || 'Debate Room'}</div>}
        </div>

        {triad && (
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <div className="text-[11px] text-slate-500 mb-1">Participants&apos; responses</div>
            <ul className="space-y-1">
              {introData?.items?.map((it) => (
                <li key={it.userId} className="text-xs">
                  <span className="text-slate-500 mr-2">{it.username}:</span>
                  <span className="text-slate-700">{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {activeRoom ? (
            <ChatRoom
              roomId={activeRoom._id}
              user={user}
              triadId={triadExists ? triad._id : null}
              promptId={triadExists ? (triad?.prompt?._id || triad?.promptId || null) : null}
              triadStartedAt={triadExists ? (triad?.startedAt || null) : null}
              triadDurationSec={triadExists ? (triad?.durationSec || 600) : 600}
            />
          ) : (
            <div className="p-4 text-slate-500">Select a debate</div>
          )}
        </div>

        {showRooms && (
          <div className="md:hidden absolute inset-0 z-40 bg-black/20 backdrop-blur">
            <div className="absolute inset-0 bg-white p-3">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search debates..."
                  className="flex-1 rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
                <button onClick={() => setShowRooms(false)} className="rounded-md bg-slate-200 border border-slate-300 px-3 py-2 text-xs text-slate-800">Close</button>
              </div>
              <div className="overflow-y-auto h-[calc(100vh-160px)] space-y-2">
                {filteredRooms.map((r) => (
                  <div
                    key={r._id}
                    onClick={() => { setActiveRoom(r); setShowRooms(false); }}
                    className={`rounded-lg p-3 cursor-pointer border ${activeRoom?._id === r._id ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{r.name || 'Debate Room'}</div>
                      <div className="flex items-center gap-2">
                        {r.triad?.isWinner && (
                          <span className="rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>
                        )}
                        <ScoreBadge triad={r.triad} />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{r.participants.length} members{r.triad?.status ? ` • ${r.triad.status}` : ''}</div>
                  </div>
                ))}
                {filteredRooms.length === 0 && <div className="text-xs text-slate-500 p-2">No matches</div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}