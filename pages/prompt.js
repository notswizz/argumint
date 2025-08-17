import { useEffect, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function PromptPage() {
  const { data: me, mutate: mutateMe } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const { data: aiData, mutate: mutateAi } = useSWR('/api/prompts/active?ai=1', fetcher);
  const { data: usersData, mutate: mutateUsers } = useSWR('/api/prompts/active?users=1', fetcher);
  const { data: mineData, mutate: mutateMine } = useSWR(user ? '/api/prompts/mine?limit=500' : null, fetcher);
  const aiPrompts = aiData?.prompts || [];
  const userPrompts = usersData?.prompts || [];
  const responses = new Map((mineData?.responses || []).map((r) => [r.promptId, r.response]));

  const [tab, setTab] = useState('active');
  const [textByPrompt, setTextByPrompt] = useState({});
  const [remainingByPrompt, setRemainingByPrompt] = useState({});
  const [loadingId, setLoadingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);

  // User-submitted state
  const [newText, setNewText] = useState('');
  const [newMinutes, setNewMinutes] = useState(10);
  const { data: myPrompts, mutate: mutateMyPrompts } = useSWR(user ? '/api/prompts/active?mine=1' : null, fetcher);

  useEffect(() => {
    const timers = [];
    const all = [...aiPrompts, ...userPrompts];
    for (const p of all) {
      if (!p?.scheduledFor) continue;
      const end = new Date(p.scheduledFor).getTime();
      const id = setInterval(() => {
        const now = Date.now();
        const s = Math.max(0, Math.floor((end - now) / 1000));
        setRemainingByPrompt((prev) => ({ ...prev, [p._id]: s }));
      }, 1000);
      timers.push(id);
    }
    return () => timers.forEach(clearInterval);
  }, [aiPrompts, userPrompts]);

  if (!user) return <div className="p-4">Please log in.</div>;

  async function submitResponse(e, promptId) {
    e.preventDefault();
    setLoadingId(promptId);
    setError('');
    setSuccess('');
    const text = (textByPrompt[promptId] || '').trim();
    if (!text) return;
    try {
      const res = await fetch('/api/prompts/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, promptId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSuccess('Response submitted');
      setTextByPrompt((prev) => ({ ...prev, [promptId]: '' }));
      mutateMine();
      mutateAi();
      mutateUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingId('');
    }
  }

  async function submitUserPrompt(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/prompts/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText, durationMinutes: Number(newMinutes) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSuccess('Prompt submitted');
      setNewText('');
      mutateMyPrompts();
      mutateAi();
      mutateUsers();
      mutateMe();
    } catch (err) {
      setError(err.message);
    }
  }

  function PromptBadge({ p }) {
    const isUser = p.category === 'user' || (user?._id && p.createdBy === user._id);
    return (
      <span className={`ml-2 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide ${isUser ? 'bg-fuchsia-700/30 text-fuchsia-300' : 'bg-sky-700/30 text-sky-300'}`}>
        {isUser ? 'User' : 'AI'}
      </span>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-800">
        <button onClick={() => setTab('active')} className={`px-3 py-2 text-sm ${tab === 'active' ? 'underline-gold text-white' : 'text-gray-400'}`}>Active Prompts</button>
        <button onClick={() => setTab('submit')} className={`px-3 py-2 text-sm ${tab === 'submit' ? 'underline-gold text-white' : 'text-gray-400'}`}>User Submitted</button>
        <div className="ml-auto text-xs text-gray-400">Tokens: {me?.user?.tokens ?? 0}</div>
      </div>

      {tab === 'active' && (
        <div className="space-y-5">
          {(aiPrompts.length === 0 && userPrompts.length === 0) && (
            <div className="text-gray-400">No active prompts right now. Check back later.</div>
          )}

          {aiPrompts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-400">AI</div>
              <div className="-mx-4 px-4 overflow-x-auto">
                <div className="flex gap-4 py-2">
                  {aiPrompts.map((p) => {
                    const remaining = remainingByPrompt[p._id] ?? null;
                    const mins = remaining != null ? Math.floor(remaining / 60) : null;
                    const secs = remaining != null ? remaining % 60 : null;
                    const myResponse = responses.get(p._id) || null;
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          setSelectedPrompt(p);
                          setError('');
                          setSuccess('');
                        }}
                        className={`relative text-left w-64 h-64 flex-shrink-0 rounded-xl border border-gold bg-gray-900/40 p-4 shadow-soft hover:bg-gray-900/60 transition flex flex-col overflow-hidden`}
                      >
                        {remaining != null && (
                          <div className="absolute top-2 right-2 text-[11px] bg-gray-800/80 text-gray-200 rounded px-2 py-0.5 font-mono">
                            {mins}:{secs?.toString().padStart(2, '0')}
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-100 break-words">
                          {p.text}
                        </div>
                        {myResponse && (
                          <div className="mt-3 p-2 rounded-md bg-gray-900/60 border border-gray-800">
                            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Your response</div>
                            <div className="text-xs text-gray-200 max-h-20 overflow-hidden break-words">{myResponse.text}</div>
                          </div>
                        )}
                        <div className="mt-auto pt-3 text-xs text-gray-400 flex items-center justify-between">
                          <span>{myResponse ? 'View' : 'Open'}</span>
                          <PromptBadge p={p} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {userPrompts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-400">User</div>
              <div className="-mx-4 px-4 overflow-x-auto">
                <div className="flex gap-4 py-2">
                  {userPrompts.map((p) => {
                    const remaining = remainingByPrompt[p._id] ?? null;
                    const mins = remaining != null ? Math.floor(remaining / 60) : null;
                    const secs = remaining != null ? remaining % 60 : null;
                    const myResponse = responses.get(p._id) || null;
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          setSelectedPrompt(p);
                          setError('');
                          setSuccess('');
                        }}
                        className={`relative text-left w-64 h-64 flex-shrink-0 rounded-xl border border-fuchsia-800 bg-gray-900/40 p-4 shadow-soft hover:bg-gray-900/60 transition flex flex-col overflow-hidden`}
                      >
                        {remaining != null && (
                          <div className="absolute top-2 right-2 text-[11px] bg-gray-800/80 text-gray-200 rounded px-2 py-0.5 font-mono">
                            {mins}:{secs?.toString().padStart(2, '0')}
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-100 break-words">
                          {p.text}
                        </div>
                        {myResponse && (
                          <div className="mt-3 p-2 rounded-md bg-gray-900/60 border border-gray-800">
                            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Your response</div>
                            <div className="text-xs text-gray-200 max-h-20 overflow-hidden break-words">{myResponse.text}</div>
                          </div>
                        )}
                        <div className="mt-auto pt-3 text-xs text-gray-400 flex items-center justify-between">
                          <span>{myResponse ? 'View' : 'Open'}</span>
                          <PromptBadge p={p} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'submit' && (
        <div className="space-y-4">
          <form onSubmit={submitUserPrompt} className="space-y-3">
            <div className="text-sm text-gray-300">Submit your prompt (costs 10 tokens)</div>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Your creative prompt..."
              className="w-full min-h-28 rounded-md bg-gray-900 border border-gray-800 px-3 py-2 text-sm focus-gold"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={newMinutes}
                onChange={(e) => setNewMinutes(e.target.value)}
                className="w-28 rounded-md bg-gray-900 border border-gray-800 px-3 py-2 text-sm focus-gold"
              />
              <span className="text-xs text-gray-400">minutes until expire</span>
              <button className="ml-auto rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 text-sm">Submit (10 tokens)</button>
            </div>
            {error && <div className="text-sm text-red-400">{error}</div>}
            {success && <div className="text-sm text-emerald-400">{success}</div>}
          </form>

          <div className="border-t border-gray-800 pt-3">
            <div className="text-sm text-gray-300 mb-2">Your active submissions</div>
            <ul className="space-y-2">
              {(myPrompts?.prompts || []).filter((p) => p.createdBy === user?._id).map((p) => (
                <li key={p._id} className="text-xs text-gray-200">
                  <span className="rounded-md bg-fuchsia-700/30 text-fuchsia-300 px-2 py-0.5 mr-2">User</span>
                  {p.text} • Expires {new Date(p.scheduledFor).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal for responding to a prompt */}
      {selectedPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedPrompt(null)} />
          <div className="relative w-full sm:max-w-xl bg-gray-950 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedPrompt(null)}
              className="absolute top-2 right-2 px-2 py-1 text-xs rounded-md bg-gray-800/80 hover:bg-gray-700"
            >
              Close
            </button>

            <div className="p-4 border-b border-gray-800">
              <div className="text-xs text-gray-400">Prompt</div>
              <div className="mt-1 text-base text-gray-100">{selectedPrompt.text}</div>
            </div>

            {(() => {
              const myResponse = responses.get(selectedPrompt._id) || null;
              if (myResponse) {
                return (
                  <div className="p-4 text-sm text-gray-300">
                    You already responded: &quot;{myResponse.text}&quot;
                  </div>
                );
              }
              return (
                <form onSubmit={(e) => submitResponse(e, selectedPrompt._id)} className="p-4 space-y-2">
                  <textarea
                    value={textByPrompt[selectedPrompt._id] || ''}
                    onChange={(e) => setTextByPrompt((prev) => ({ ...prev, [selectedPrompt._id]: e.target.value }))}
                    placeholder="Write your response..."
                    className="w-full min-h-40 rounded-md bg-gray-900 border border-gray-800 px-3 py-2 text-sm focus-gold"
                  />
                  {error && <div className="text-sm text-red-400">{error}</div>}
                  {success && <div className="text-sm text-emerald-400">{success}</div>}
                  <button
                    type="submit"
                    disabled={loadingId === selectedPrompt._id || !(textByPrompt[selectedPrompt._id] || '').trim()}
                    className="w-full rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 text-sm font-medium"
                  >
                    {loadingId === selectedPrompt._id ? 'Submitting...' : 'Submit Response'}
                  </button>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
} 