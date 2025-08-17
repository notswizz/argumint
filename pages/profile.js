import useSWR from 'swr';
import TokenDisplay from '@/components/TokenDisplay';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ProfilePage() {
  const { data } = useSWR('/api/auth/me', fetcher);
  const user = data?.user;
  const { data: tx } = useSWR(user ? `/api/tokens/history?userId=${user._id}` : null, fetcher);
  const { data: perf } = useSWR(user ? '/api/users/performance' : null, fetcher);

  if (!user) return <div className="p-4">Please log in.</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="rounded-xl border border-slate-200 p-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200" />
          <div>
            <div className="text-lg font-semibold">{user.username}</div>
            <div className="text-xs text-slate-600">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Performance Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Performance</div>
            <div className="text-xs text-slate-400">overall + peaks</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 text-sm">
              <div><div className="text-slate-500">Debates</div><div className="text-lg font-semibold">{perf?.summary?.debatesParticipated ?? 0}</div></div>
              <div><div className="text-slate-500">Group wins</div><div className="text-lg font-semibold">{perf?.summary?.groupWins ?? 0}</div></div>
              <div><div className="text-slate-500">My avg</div><div className="text-lg font-semibold">{perf?.summary?.indAvg ?? 0}</div></div>
              <div><div className="text-slate-500">Group avg</div><div className="text-lg font-semibold">{perf?.summary?.groupAvg ?? 0}</div></div>
            </div>
            <div className="space-y-2 text-sm">
              <div><div className="text-slate-500">My best</div><div className="text-lg font-semibold">{perf?.summary?.indBest ?? 0}</div></div>
              <div><div className="text-slate-500">Group best</div><div className="text-lg font-semibold">{perf?.summary?.groupBest ?? 0}</div></div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 bg-white">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Tokens</div>
          <TokenDisplay tokens={user.tokens} history={tx?.history || []} />
        </div>
      </div>

      {/* Recent history */}
      <div className="rounded-xl border border-slate-200 p-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recent debates</div>
          <div className="text-xs text-slate-500">Most recent first</div>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Prompt</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">My score</th>
                <th className="py-2 pr-3">Members</th>
              </tr>
            </thead>
            <tbody>
              {(perf?.recent || []).map((r) => (
                <tr key={r.triadId} className="border-t border-slate-100">
                  <td className="py-2 pr-3 max-w-[420px] truncate" title={r.promptText}>{r.promptText || '—'}</td>
                  <td className="py-2 pr-3 text-slate-600">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                  <td className="py-2 pr-3"><span className="rounded-md bg-slate-200 text-slate-800 px-2 py-0.5 text-[11px] font-mono">{r.groupScore ?? 0}</span> {r.isGroupWinner && (<span className="ml-1 rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>)}</td>
                  <td className="py-2 pr-3 font-mono">{r.myScore ?? 0}</td>
                  <td className="py-2 pr-3 text-slate-600">{r.participants ?? 0}</td>
                </tr>
              ))}
              {(!perf?.recent || perf.recent.length === 0) && (
                <tr><td colSpan="5" className="py-6 text-center text-slate-500 text-sm">No debates yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 