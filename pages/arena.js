import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ArenaPage() {
  const { data: me } = useSWR('/api/auth/me', (url) => fetch(url, { credentials: 'include' }).then((r) => r.json()));
  const user = me?.user;
  const { data, mutate } = useSWR('/api/arena/takes', fetcher);
  const items = data?.items || [];

  const [activeTab, setActiveTab] = useState('create');
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

  // Allow viewing/using Arena without login (testing)
  // Note: creation will still attempt API calls; the APIs will allow guest mode too.

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
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to create');
      }
      
      const data = await res.json();
      setNewStatement('');
      setSelectedId(String(data.item._id));
      setActiveTab('train');
      mutate();
      setSuccess('Take created! Now train your AI.');
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
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to send');
      }
      
      setUserMessage('');
      mutate();
      setSuccess('Message sent! AI will respond with a question.');
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
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to finalize');
      }
      
      mutate();
      setSuccess('AI trained! Switch to Debate tab to test it.');
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
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to argue');
      }
      
      const data = await res.json();
      const reply = data.reply || '';
      setAgentReply(reply);
      
      // Add AI response to debate history
      if (reply && selected) {
        const newHistory = [...(selected.debateHistory || []), { role: 'ai', content: reply }];
        selected.debateHistory = newHistory;
        // Force re-render
        setSelectedId(selectedId);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function gradeDebate() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/arena/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to grade');
      }
      
      const data = await res.json();
      selected.debateResult = data;
      mutate();
      setSuccess('Debate graded!');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const trainedTakes = items.filter(t => t.status === 'trained');
  const trainingTakes = items.filter(t => t.status === 'interviewing');
  const draftTakes = items.filter(t => t.status === 'draft');

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-4 app-main-scroll">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Arena</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Create takes, train AI interviewers, and debate with your personalized argument bots
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'create' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🎯 Create Takes
          </button>
          <button
            onClick={() => setActiveTab('train')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'train' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧠 Train AI
          </button>
          <button
            onClick={() => setActiveTab('debate')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'debate' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚔️ Debate
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{items.length}</div>
          <div className="text-sm text-slate-600">Total Takes</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{trainedTakes.length}</div>
          <div className="text-sm text-slate-600">AI Trained</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{trainingTakes.length}</div>
          <div className="text-sm text-slate-600">In Training</div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-center space-y-4">
            <div className="text-2xl font-semibold text-slate-900">Create Your Take</div>
            <p className="text-slate-600 max-w-lg mx-auto">
              Start with a statement you want to defend. The AI will interview you to understand your position completely.
            </p>
            <form onSubmit={createTake} className="max-w-md mx-auto space-y-3">
              <textarea
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm resize-none"
                rows={3}
                placeholder="e.g., Pineapple belongs on pizza, Trae Young is the best NBA player, etc."
                value={newStatement}
                onChange={(e) => setNewStatement(e.target.value)}
              />
              <button 
                disabled={busy || !newStatement.trim()} 
                className="w-full rounded-lg px-4 py-3 font-medium btn-mint disabled:opacity-50"
              >
                {busy ? 'Creating...' : 'Create Take'}
              </button>
            </form>
            {error && <div className="text-sm text-rose-600">{error}</div>}
            {success && <div className="text-sm text-emerald-600">{success}</div>}
          </div>
        </div>
      )}

      {activeTab === 'train' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Takes List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-lg font-semibold text-slate-900 mb-4">Your Takes</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {items.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedId(String(t._id))}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      String(t._id) === String(selectedId) 
                        ? 'border-slate-400 bg-slate-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-slate-900 line-clamp-2 mb-1">{t.statement}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        t.status === 'trained' ? 'bg-emerald-100 text-emerald-700' :
                        t.status === 'interviewing' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {t.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {t.interview?.length || 0} messages
                      </span>
                    </div>
                  </button>
                ))}
                {!items.length && (
                  <div className="text-sm text-slate-500 text-center py-8">
                    No takes yet. Create one first!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Training Interface */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Training: {selected.statement}</div>
                    <div className="text-sm text-slate-600">Interview your AI to train it on your position</div>
                  </div>
                  <div className={`text-xs px-3 py-1 rounded-full ${
                    selected.status === 'trained' ? 'bg-emerald-100 text-emerald-700' :
                    selected.status === 'interviewing' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selected.status}
                  </div>
                </div>

                {/* Interview Chat */}
                <div className="h-80 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-3">
                  {(selected.interview || []).map((turn, idx) => (
                    <div key={idx} className={`flex ${turn.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        turn.role === 'assistant' 
                          ? 'bg-white border border-slate-200 text-slate-800' 
                          : 'bg-blue-500 text-white'
                      }`}>
                        <div className="text-[11px] font-medium mb-1">
                          {turn.role === 'assistant' ? '🤖 AI' : '👤 You'}
                        </div>
                        <div className="whitespace-pre-wrap">{turn.content}</div>
                      </div>
                    </div>
                  ))}
                  {!selected.interview?.length && (
                    <div className="text-center text-slate-500 py-8">
                      Start the interview by adding details to your take
                    </div>
                  )}
                </div>

                {/* Input */}
                <form onSubmit={sendInterview} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Add details, answer questions, or explain your reasoning..."
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                  />
                  <button disabled={busy || !userMessage.trim()} className="px-4 py-2 rounded-lg btn-mint disabled:opacity-50">
                    Send
                  </button>
                </form>

                {/* Train Button */}
                {selected.status !== 'trained' && (
                  <div className="flex justify-end">
                    <button 
                      onClick={finalizeProfile} 
                      disabled={busy || !(selected?.interview || []).length} 
                      className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50"
                    >
                      {busy ? 'Training...' : 'Train AI'}
                    </button>
                  </div>
                )}

                {error && <div className="text-sm text-rose-600">{error}</div>}
                {success && <div className="text-sm text-emerald-600">{success}</div>}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                Select a take from the left to start training
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'debate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trained Takes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-lg font-semibold text-slate-900 mb-4">Trained AIs</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trainedTakes.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedId(String(t._id))}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      String(t._id) === String(selectedId) 
                        ? 'border-slate-400 bg-slate-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-slate-900 line-clamp-2 mb-1">{t.statement}</div>
                    <div className="text-xs text-emerald-600">🤖 AI Ready</div>
                  </button>
                ))}
                {!trainedTakes.length && (
                  <div className="text-sm text-slate-500 text-center py-8">
                    No trained AIs yet. Train one first!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debate Interface */}
          <div className="lg:col-span-2">
            {selected && selected.status === 'trained' ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900">Debate with: {selected.statement}</div>
                  <div className="text-sm text-slate-600">Your AI will defend your position using what it learned</div>
                </div>

                {/* Debate Simulator */}
                <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-slate-800">Debate Simulator</div>
                    {selected.debateHistory?.length >= 2 && (
                      <button 
                        onClick={gradeDebate}
                        className="px-3 py-1 text-xs rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-medium"
                      >
                        Grade Debate
                      </button>
                    )}
                  </div>
                  <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-white space-y-2 mb-3">
                    {selected.debateHistory?.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'opponent' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === 'opponent' 
                            ? 'bg-slate-100 text-slate-800' 
                            : 'bg-emerald-500 text-white'
                        }`}>
                          <div className="text-[11px] font-medium mb-1">
                            {msg.role === 'opponent' ? '👤 Opponent' : '🤖 Your AI'}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))}
                    {!selected.debateHistory?.length && (
                      <div className="text-center text-slate-500 py-8">
                        Start the debate below...
                      </div>
                    )}
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!opponentMsg.trim()) return;
                    // Add to debate history
                    const newHistory = [...(selected.debateHistory || []), { role: 'opponent', content: opponentMsg }];
                    selected.debateHistory = newHistory;
                    setOpponentMsg('');
                    // Get AI response
                    testArgue(e);
                  }} className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Type your argument..."
                      value={opponentMsg}
                      onChange={(e) => setOpponentMsg(e.target.value)}
                    />
                    <button disabled={busy || !opponentMsg.trim()} className="px-4 py-2 rounded-lg btn-mint disabled:opacity-50">
                      Send
                    </button>
                  </form>
                </div>

                {/* Debate Results */}
                {selected.debateResult && (
                  <div className="rounded-lg border border-slate-200 p-4 bg-white">
                    <div className="text-sm font-medium text-slate-800 mb-2">Debate Results</div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`text-lg font-bold ${
                        selected.debateResult.winner === 'ai' ? 'text-emerald-600' : 'text-slate-600'
                      }`}>
                        {selected.debateResult.winner === 'ai' ? '🤖 AI Wins!' : '👤 Opponent Wins!'}
                      </div>
                      <div className="text-sm text-slate-600">
                        Score: {selected.debateResult.aiScore} - {selected.debateResult.opponentScore}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700">{selected.debateResult.reasoning}</div>
                  </div>
                )}

                {error && <div className="text-sm text-rose-600">{error}</div>}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                {selected ? 'This take needs to be trained first' : 'Select a trained AI to debate with'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


