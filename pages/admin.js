import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AdminPage() {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const { data: prompts, mutate } = useSWR('/api/debate/prompts', fetcher);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('general');

  if (!user || !user.roles?.includes('admin')) return <div className="p-4">Admins only.</div>;

  async function createPrompt() {
    await fetch('/api/debate/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category }),
    });
    setText('');
    mutate();
  }

  async function exportData(format) {
    const res = await fetch(`/api/export/conversations?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations.${format}`;
    a.click();
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="font-medium">Prompts</div>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Prompt text" className="flex-1 rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-40 rounded-md bg-white border border-slate-300 px-3 py-2 text-sm text-slate-800" />
          <button onClick={createPrompt} className="rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 text-sm text-white">Create</button>
          <button onClick={async () => { await fetch('/api/prompts/ensure-active'); alert('Ensured 5 active prompts'); }} className="rounded-md bg-slate-200 hover:bg-slate-300 px-3 py-2 text-sm">Ensure 5 Active</button>
          <button onClick={async () => { await fetch('/api/cron/sweep'); alert('Cron sweep executed'); }} className="rounded-md bg-slate-200 hover:bg-slate-300 px-3 py-2 text-sm">Run Sweep</button>
        </div>
        <ul className="space-y-2">
          {prompts?.items?.map((p) => (
            <li key={p._id} className="text-sm text-slate-700 flex items-center justify-between gap-2">
              <div>
                <div>{p.text} <span className="text-slate-500">({p.category})</span></div>
                <div className="text-xs text-slate-500">Active: {String(p.active)}{p.scheduledFor ? ` • Deadline: ${new Date(p.scheduledFor).toLocaleString()}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { await fetch('/api/debate/prompts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p._id, active: !p.active }) }); mutate(); }}
                  className="rounded-md bg-slate-200 hover:bg-slate-300 px-2 py-1 text-xs"
                >
                  {p.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={async () => { const h = prompt('Reset deadline in hours from now:', '24'); if (!h) return; await fetch('/api/debate/prompts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p._id, durationHours: Number(h) }) }); mutate(); }}
                  className="rounded-md bg-slate-200 hover:bg-slate-300 px-2 py-1 text-xs"
                >
                  Set deadline
                </button>
                <button
                  onClick={async () => { await fetch('/api/triads/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promptId: p._id, force: true, allowPairs: true }) }); alert('Scheduling started'); }}
                  className="rounded-md bg-brand-600 hover:bg-brand-500 px-2 py-1 text-xs text-white"
                >
                  Schedule triads
                </button>
                <button
                  onClick={async () => { await fetch('/api/triads/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ promptId: p._id }) }); alert('Debates sent to vote and tokens awarded'); }}
                  className="rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 px-2 py-1 text-xs text-white"
                >
                  End debate & award
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="font-medium">Export</div>
        <div className="flex gap-2">
          <button onClick={() => exportData('json')} className="rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 text-sm text-white">Download JSON</button>
          <button onClick={() => exportData('csv')} className="rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 text-sm text-white">Download CSV</button>
        </div>
      </div>
    </div>
  );
} 