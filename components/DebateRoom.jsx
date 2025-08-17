import { useEffect, useState } from 'react';
import ChatRoom from './ChatRoom';

export default function DebateRoom({ debate, user }) {
  const [remaining, setRemaining] = useState(debate?.durationSec || 300);
  const [intros, setIntros] = useState([]);

  useEffect(() => {
    if (!debate?.startedAt) return;
    const start = new Date(debate.startedAt).getTime();
    const end = start + (debate.durationSec || 300) * 1000;
    const i = setInterval(() => {
      const now = Date.now();
      const secondsLeft = Math.max(0, Math.floor((end - now) / 1000));
      setRemaining(secondsLeft);
    }, 1000);
    return () => clearInterval(i);
  }, [debate?.startedAt, debate?.durationSec]);

  useEffect(() => {
    let mounted = true;
    async function loadIntros() {
      const res = await fetch(`/api/triads/intro?triadId=${debate._id}`);
      const data = await res.json();
      if (mounted && Array.isArray(data.items)) setIntros(data.items);
    }
    loadIntros();
    return () => {
      mounted = false;
    };
  }, [debate._id]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Prompt</div>
          <div className="text-sm font-medium">{debate.prompt?.text}</div>
        </div>
        <div className="text-sm rounded-md bg-slate-200 text-slate-800 px-3 py-1">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>

      {intros.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-2">Participants' responses</div>
          <ul className="space-y-2">
            {intros.map((it) => (
              <li key={it.userId} className="text-sm">
                <span className="text-slate-500 mr-2">{it.username}:</span>
                <span className="text-slate-700">{it.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ChatRoom roomId={debate.roomId} user={user} triadId={debate._id} promptId={debate.prompt?._id || debate.promptId} />
    </div>
  );
} 