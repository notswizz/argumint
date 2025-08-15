import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import ChatRoom from '@/components/ChatRoom';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ChatPage() {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const { data: roomsData } = useSWR(user ? '/api/chat/rooms' : null, fetcher);
  const [activeRoom, setActiveRoom] = useState(null);
  const [query, setQuery] = useState('');
  const [showRooms, setShowRooms] = useState(false);
  const { data: triadData } = useSWR(activeRoom ? `/api/triads/by-room?roomId=${activeRoom._id}` : null, fetcher);
  const triad = triadData?.triad;
  const { data: introData } = useSWR(triad ? `/api/triads/intro?triadId=${triad._id}` : null, fetcher);

  useEffect(() => {
    if (roomsData?.rooms?.length && !activeRoom) setActiveRoom(roomsData.rooms[0]);
  }, [roomsData]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roomsData?.rooms || [];
    return (roomsData?.rooms || []).filter((r) => {
      const name = (r.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [roomsData, query]);

  if (!user) return <div className="p-4">Please log in.</div>;

  function ScoreBadge({ triad }) {
    if (!triad || triad.myPlace == null) return null;
    const placeColors = triad.myPlace === 1 ? 'bg-emerald-700/30 text-emerald-300' : triad.myPlace === 2 ? 'bg-sky-700/30 text-sky-300' : 'bg-gray-700/30 text-gray-300';
    return (
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide ${placeColors}`}>#{triad.myPlace}</span>
        <span className="rounded-md bg-gray-800/50 text-gray-300 px-2 py-0.5 text-[10px] font-mono">{triad.myScore ?? 0}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 h-[calc(100vh-120px)] sm:h-[85vh]">
      <aside className="border-r border-gray-800 p-3 space-y-3 sm:block hidden overflow-y-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats..."
          className="w-full rounded-md bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
        />
        <div className="space-y-2">
          {filteredRooms.map((r) => (
            <div
              key={r._id}
              onClick={() => setActiveRoom(r)}
              className={`rounded-lg p-3 cursor-pointer border ${activeRoom?._id === r._id ? 'bg-gray-800 border-gray-700' : 'bg-gray-900/40 border-gray-800'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{r.name || 'Group Chat'}</div>
                  <div className="text-xs text-gray-400">{r.participants.length} members{r.triad?.status ? ` • ${r.triad.status}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.triad?.isWinner && (
                    <span className="rounded-md bg-emerald-700/30 text-emerald-300 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>
                  )}
                  <ScoreBadge triad={r.triad} />
                </div>
              </div>
            </div>
          ))}
          {filteredRooms.length === 0 && <div className="text-xs text-gray-500">No matches</div>}
        </div>
      </aside>
      <main className="sm:col-span-2 p-2 sm:p-3 space-y-3 relative flex flex-col min-h-0">
        {/* Mobile open chats button */}
        <div className="sm:hidden flex items-center justify-between">
          <button onClick={() => setShowRooms(true)} className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200">Chats</button>
          {activeRoom && <div className="text-xs text-gray-400 truncate max-w-[60%]">{activeRoom.name || 'Group Chat'}</div>}
        </div>

        {triad && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-2 sm:p-3">
            <div className="text-xs text-gray-400 mb-2">Participants' responses</div>
            <ul className="space-y-2">
              {introData?.items?.map((it) => (
                <li key={it.userId} className="text-sm">
                  <span className="text-gray-400 mr-2">{it.username}:</span>
                  <span className="text-gray-200">{it.text}</span>
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
              triadId={triad?._id || null}
              promptId={triad?.prompt?._id || triad?.promptId || null}
              triadStartedAt={triad?.startedAt || null}
              triadDurationSec={triad?.durationSec || 600}
            />
          ) : (
            <div className="p-4 text-gray-400">Select a room</div>
          )}
        </div>

        {/* Mobile overlay for rooms & search */}
        {showRooms && (
          <div className="sm:hidden absolute inset-0 z-40 bg-black/70 backdrop-blur">
            <div className="absolute inset-0 bg-gray-950 p-3">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="flex-1 rounded-md bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
                />
                <button onClick={() => setShowRooms(false)} className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200">Close</button>
              </div>
              <div className="overflow-y-auto h-[calc(100vh-160px)] space-y-2">
                {filteredRooms.map((r) => (
                  <div
                    key={r._id}
                    onClick={() => { setActiveRoom(r); setShowRooms(false); }}
                    className={`rounded-lg p-3 cursor-pointer border ${activeRoom?._id === r._id ? 'bg-gray-800 border-gray-700' : 'bg-gray-900/40 border-gray-800'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{r.name || 'Group Chat'}</div>
                      <div className="flex items-center gap-2">
                        {r.triad?.isWinner && (
                          <span className="rounded-md bg-emerald-700/30 text-emerald-300 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>
                        )}
                        <ScoreBadge triad={r.triad} />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{r.participants.length} members{r.triad?.status ? ` • ${r.triad.status}` : ''}</div>
                  </div>
                ))}
                {filteredRooms.length === 0 && <div className="text-xs text-gray-500 p-2">No matches</div>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 