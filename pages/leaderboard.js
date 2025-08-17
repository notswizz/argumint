import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function LeaderboardPage() {
  const { data } = useSWR('/api/admin/leaderboard', fetcher);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-3 text-xs text-slate-500 px-3 py-2 border-b border-slate-200">
          <div>User</div>
          <div>Tokens</div>
          <div>Wins</div>
        </div>
        <div>
          {data?.items?.map((u) => (
            <div key={u._id} className="grid grid-cols-3 px-3 py-2 border-b border-slate-200">
              <div className="truncate">{u.username}</div>
              <div>{u.tokens}</div>
              <div>{u.wins}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 