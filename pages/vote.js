import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function VotePage() {
  const { data: debates, mutate } = useSWR('/api/debate/finished', fetcher);

  async function vote(debateId, winnerUserId) {
    await fetch('/api/debate/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debateId, winnerUserId }),
    });
    mutate();
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Vote on Debates</h1>
      {debates?.items?.map((d) => (
        <div key={d._id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="text-sm text-slate-600">Prompt</div>
          <div className="text-sm font-medium">{d.prompt?.text}</div>
          <div className="text-xs text-slate-500">Participants: {d.userA?.username} vs {d.userB?.username}</div>
          <div className="flex gap-2">
            <button onClick={() => vote(d._id, d.userA?._id)} className="rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-1 text-sm text-white">Vote {d.userA?.username}</button>
            <button onClick={() => vote(d._id, d.userB?._id)} className="rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-1 text-sm text-white">Vote {d.userB?.username}</button>
          </div>
        </div>
      ))}
    </div>
  );
} 