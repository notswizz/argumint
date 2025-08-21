import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ArenaPage() {
  const { data: me } = useSWR('/api/auth/me', (url) => fetch(url, { credentials: 'include' }).then((r) => r.json()));
  const user = me?.user;
  const { data, mutate } = useSWR(user ? '/api/arena/takes' : null, fetcher);
  const items = data?.items || [];

  const [newStatement, setNewStatement] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const selected = useMemo(() => items.find((t) => String(t._id) === String(selectedId)) || null, [items, selectedId]);
  const [userMessage, setUserMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [opponentMsg, setOpponentMsg] = useState('');
  const [agentReply, setAgentReply] = useState('');

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(String(items[0]._id));
  }, [items, selectedId]);

  if (!user) return <div className="p-4">Please log in.</div>;

  async function createTake(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/arena/takes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statement: newStatement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      setNewStatement('');
      setSelectedId(String(data.item._id));
      mutate();
      setSuccess('Created');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendInterview(e) {
    e.preventDefault();
    if (!selected) return;
    if (!userMessage.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/arena/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id, userMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setUserMessage('');
      mutate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function finalizeProfile() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/arena/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize');
      mutate();
      setSuccess('Profile trained');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function testArgue(e) {
    e.preventDefault();
    if (!selected || !selected.agentPrompt) return;
    setBusy(true);
    setError('');
    setAgentReply('');
    try {
      const res = await fetch('/api/arena/argue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id, opponentMessage: opponentMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to argue');
      setAgentReply(data.reply || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4 app-main-scroll">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Arena</h1>
        <div className="rounded-xl border border-slate-200 bg-white shadow-soft p-3 sm:p-4">
          <div className="text-sm text-slate-700 mb-2">Create a take (your statement), then the AI will interview you to fully understand it. Once trained, your AI can argue on your behalf.</div>
          <form onSubmit={createTake} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-300 px-3 py-2"
              placeholder="Enter your take (e.g., Pineapple belongs on pizza)"
              value={newStatement}
              onChange={(e) => setNewStatement(e.target.value)}
            />
            <button disabled={busy || !newStatement.trim()} className="rounded-md px-4 py-2 btn-mint disabled:opacity-50">Create</button>
          </form>
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
          {success && <div className="mt-2 text-sm text-emerald-600">{success}</div>}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 rounded-xl border border-slate-200 bg-white shadow-soft">
            <div className="px-3 py-2 border-b border-slate-200 text-sm font-medium text-slate-800">Your Takes</div>
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100">
              {items.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedId(String(t._id))}
                  className={`w-full text-left px-3 py-2 text-sm ${String(t._id) === String(selectedId) ? 'bg-slate-50' : ''}`}
                >
                  <div className="font-medium text-slate-900 line-clamp-2">{t.statement}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{t.status}</div>
                </button>
              ))}
              {!items.length && <div className="px-3 py-3 text-sm text-slate-500">No takes yet.</div>}
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white shadow-soft p-3 sm:p-4 space-y-3">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-700"><span className="font-medium text-slate-900">Take:</span> {selected.statement}</div>
                  <div className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{selected.status}</div>
                </div>
                <div className="h-[45vh] overflow-y-auto rounded-md border border-slate-200 p-2 bg-slate-50">
                  {(selected.interview || []).map((turn, idx) => (
                    <div key={idx} className="mb-2">
                      <div className={`text-[11px] ${turn.role === 'assistant' ? 'text-emerald-700' : 'text-slate-700'}`}>{turn.role === 'assistant' ? 'AI' : 'You'}</div>
                      <div className="text-sm text-slate-900 whitespace-pre-wrap">{turn.content}</div>
                    </div>
                  ))}
                  {!selected.interview?.length && (
                    <div className="text-sm text-slate-600">No interview messages yet. Add details or questions below.</div>
                  )}
                </div>
                <form onSubmit={sendInterview} className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Add details to your take or answer AI questions"
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                  />
                  <button disabled={busy || !userMessage.trim()} className="rounded-md px-4 py-2 btn-mint disabled:opacity-50">Send</button>
                </form>
                <div className="flex justify-end">
                  <button onClick={finalizeProfile} disabled={busy || !(selected?.interview || []).length} className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Train profile</button>
                </div>
                {selected?.profile && (
                  <div className="rounded-md border border-slate-200 p-3 bg-white">
                    <div className="text-sm font-medium text-slate-800 mb-1">Profile Summary</div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{selected.profile.summary}</div>
                  </div>
                )}

                {selected?.agentPrompt && (
                  <div className="rounded-md border border-slate-200 p-3 bg-white space-y-2">
                    <div className="text-sm font-medium text-slate-800">Try your AI against a message</div>
                    <form onSubmit={testArgue} className="flex gap-2">
                      <input
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2"
                        placeholder="Opponent says..."
                        value={opponentMsg}
                        onChange={(e) => setOpponentMsg(e.target.value)}
                      />
                      <button disabled={busy || !opponentMsg.trim()} className="rounded-md px-4 py-2 btn-mint disabled:opacity-50">Respond</button>
                    </form>
                    {agentReply && (
                      <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-sm text-slate-800 whitespace-pre-wrap">{agentReply}</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-600">Select or create a take to begin.</div>
            )}
          </div>
        </div>
      </div>
  );
}


