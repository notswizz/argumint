import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url, { credentials: 'include' }).then(res => res.json());

export default function Arena() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'debate'
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="text-center py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Arena</h1>
        <p className="text-slate-600 max-w-2xl mx-auto mt-2">
          Create takes, train AI interviewers, and debate with your personalized argument bots
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 sm:px-6 mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <div className="flex">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'create'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                🎯 Train
              </button>
              <button
                onClick={() => setActiveTab('debate')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'debate'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                ⚔️ Debate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-20 sm:pb-6">
        {activeTab === 'create' ? (
          <CreateTrainTab />
        ) : (
          <DebateTab />
        )}
      </div>
    </div>
  );
}

// Create & Train Tab Component
function CreateTrainTab() {
  const [newStatement, setNewStatement] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [userMessage, setUserMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data, mutate } = useSWR('/api/arena/takes', fetcher);
  const items = data?.items || [];
  const selected = items.find(t => String(t._id) === String(selectedId));
  const trainedTakes = items.filter(t => t.status === 'trained');
  const trainingTakes = items.filter(t => t.status === 'interviewing');

  const createTake = async (e) => {
    e.preventDefault();
    if (!newStatement.trim()) return;
    
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
        throw new Error(errorText || 'Failed to create take');
      }
      
      const data = await res.json();
      setNewStatement('');
      setSuccess('Take created! Start training your AI.');
      mutate();
      setSelectedId(String(data._id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendInterview = async (e) => {
    e.preventDefault();
    if (!userMessage.trim() || !selected) return;
    
    setIsSending(true);
    setError('');
    
    try {
      const res = await fetch('/api/arena/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id, userMessage }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to send message');
      }
      
      setUserMessage('');
      mutate();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSending(false);
    }
  };

  const finalizeProfile = async () => {
    if (!selected) return;
    
    setIsTraining(true);
    setError('');
    
    try {
      const res = await fetch('/api/arena/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to finalize profile');
      }
      
      setSuccess('AI training complete! Your bot is ready to debate.');
      mutate();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Status Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-center shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-slate-700">{items.length}</div>
            <div className="text-xs sm:text-sm text-slate-600">Total Takes</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-center shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{trainedTakes.length}</div>
            <div className="text-xs sm:text-sm text-slate-600">AI Trained</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-center shadow-sm">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{trainingTakes.length}</div>
            <div className="text-xs sm:text-sm text-slate-600">In Training</div>
          </div>
        </div>
      </div>

      {/* Create Take Section */}
      <div className="max-w-2xl mx-auto mb-12">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="text-center space-y-4">
            <div className="text-2xl font-semibold text-slate-900">Create Your Take</div>
            <p className="text-slate-600">
              Start with a statement you want to defend. The AI will interview you to understand your position completely.
            </p>
            <form onSubmit={createTake} className="space-y-4">
              <textarea
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                rows={4}
                placeholder="e.g., Pineapple belongs on pizza, Trae Young is the best NBA player, etc."
                value={newStatement}
                onChange={(e) => setNewStatement(e.target.value)}
              />
              <button 
                disabled={busy || !newStatement.trim()} 
                className="w-full py-3 px-6 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none disabled:shadow-lg"
              >
                {busy ? 'Creating...' : 'Create Take'}
              </button>
            </form>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-600">
                {success}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Training Section */}
      <div className="space-y-6">
        {/* Takes List - Mobile Stacked, Desktop Sidebar */}
        <div className="lg:hidden">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-3">Your Takes</h3>
            <div className="space-y-2">
              {items.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedId(String(t._id))}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    String(t._id) === String(selectedId)
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900 mb-1 line-clamp-2">
                    {t.statement}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`px-2 py-1 rounded-full ${
                      t.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                      t.status === 'interviewing' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {t.status}
                    </span>
                    <span>{t.interview?.length || 0} questions</span>
                  </div>
                </button>
              ))}
              {!items.length && (
                <div className="text-center text-slate-500 py-8">
                  No takes yet. Create one first!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Takes List - Desktop Sidebar */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm sticky top-6">
              <h3 className="font-semibold text-slate-900 mb-4">Your Takes</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {items.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedId(String(t._id))}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                      String(t._id) === String(selectedId)
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
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
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold text-slate-900 line-clamp-2">
                      Training: {selected.statement}
                    </div>
                    <div className="text-sm text-slate-600">Interview your AI to train it on your position</div>
                  </div>
                  <div className={`ml-3 text-xs px-3 py-1 rounded-full ${
                    selected.status === 'trained' ? 'bg-emerald-100 text-emerald-700' :
                    selected.status === 'interviewing' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selected.status}
                  </div>
                </div>

                {/* Chat Interface */}
                <div className="space-y-4">
                  {/* Conversation History */}
                  <div className="h-80 sm:h-96 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                    {(selected.interview || []).map((turn, idx) => (
                      <div key={idx} className={`flex ${turn.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          turn.role === 'assistant' 
                            ? 'bg-white border border-slate-200 text-slate-800 shadow-sm' 
                            : 'bg-blue-500 text-white shadow-sm'
                        }`}>
                          <div className="text-[11px] font-medium mb-1 opacity-75">
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

                  {/* Input Form */}
                  <form onSubmit={sendInterview} className="space-y-3">
                    <textarea
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      rows={3}
                      placeholder="Add details, answer questions, or explain your reasoning..."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button 
                        disabled={busy || !userMessage.trim()} 
                        className="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
                      >
                        {isSending ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Train Button - Always visible */}
                {selected.status !== 'trained' && (
                  <div className="flex justify-end">
                    <button 
                      onClick={finalizeProfile} 
                      disabled={busy || !(selected?.interview || []).length} 
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none disabled:shadow-lg"
                    >
                      {isTraining ? 'Training...' : 'Train AI'}
                    </button>
                  </div>
                )}

                {/* Argument Profile Display */}
                {selected.status === 'trained' && selected.profile && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Argument Profile</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Core Position</h4>
                          <p className="text-sm text-slate-900 bg-slate-50 p-3 rounded-lg">
                            {selected.profile.claim || selected.statement}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Key Supporting Points</h4>
                          <div className="space-y-2">
                            {selected.profile.key_points?.map((point, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg">
                                • {point}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Facts & Evidence</h4>
                          <div className="space-y-2">
                            {selected.profile.facts?.map((fact, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg">
                                • {fact}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Communication Style</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-xs text-slate-500">Tone:</span>
                              <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg">
                                {selected.profile.tone || 'Not specified'}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-500">Confidence:</span>
                              <p className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg">
                                {selected.profile.confidence || 'Not specified'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Opponent Arguments</h4>
                          <div className="space-y-2">
                            {selected.profile.opponent_arguments?.map((arg, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-red-50 p-2 rounded-lg border-l-4 border-red-200">
                                • {arg}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Your Counters</h4>
                          <div className="space-y-2">
                            {selected.profile.counters?.map((counter, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-green-50 p-2 rounded-lg border-l-4 border-green-200">
                                • {counter}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Potential Concerns</h4>
                          <div className="space-y-2">
                            {selected.profile.potential_hang_ups?.map((concern, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-yellow-50 p-2 rounded-lg border-l-4 border-yellow-200">
                                • {concern}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 mb-2">Scope & Limits</h4>
                          <div className="space-y-2">
                            {selected.profile.scope_limits?.map((limit, idx) => (
                              <div key={idx} className="text-sm text-slate-900 bg-slate-50 p-2 rounded-lg">
                                • {limit}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selected.profile.summary && (
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <h4 className="font-medium text-slate-700 mb-2">Summary</h4>
                        <p className="text-sm text-slate-900 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                          {selected.profile.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 shadow-sm">
                Select a take from the left to start training
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Debate Tab Component
function DebateTab() {
  const [selectedId, setSelectedId] = useState(null);
  const [opponentMessage, setOpponentMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState('');

  const { data, mutate } = useSWR('/api/arena/takes', fetcher);
  const items = data?.items || [];
  const selected = items.find(t => String(t._id) === String(selectedId));
  const trainedTakes = items.filter(t => t.status === 'trained');

  const gradeDebate = async () => {
    if (!selected || !selected.debateHistory || selected.debateHistory.length < 2) return;
    
    setIsGrading(true);
    setError('');
    
    try {
      const res = await fetch('/api/arena/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ takeId: selected._id }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to grade debate');
      }
      
      mutate();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Debate with Your Trained AIs</h2>
        <p className="text-slate-600">Test your trained AIs in debates and see how they perform</p>
      </div>

      {/* Trained Takes - Mobile Stacked, Desktop Sidebar */}
      <div className="lg:hidden">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Trained AIs</h3>
          <div className="space-y-2">
            {trainedTakes.map((t) => (
              <button
                key={t._id}
                onClick={() => setSelectedId(String(t._id))}
                className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                  String(t._id) === String(selectedId)
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
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

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Trained Takes - Desktop Sidebar */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm sticky top-6">
            <h3 className="font-semibold text-slate-900 mb-4">Trained AIs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trainedTakes.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedId(String(t._id))}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    String(t._id) === String(selectedId)
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
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
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
              <div>
                <div className="text-lg font-semibold text-slate-900 line-clamp-2">
                  Debate with: {selected.statement}
                </div>
                <div className="text-sm text-slate-600">Your AI will defend your position using what it learned</div>
              </div>

              {/* Debate Simulator */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-slate-800">Debate Simulator</div>
                  {selected.debateHistory?.length >= 2 && (
                    <button 
                      onClick={gradeDebate}
                      disabled={isGrading}
                      className="px-3 py-1 text-xs rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
                    >
                      {isGrading ? 'Grading...' : 'Grade Debate'}
                    </button>
                  )}
                </div>

                {/* Chat Interface */}
                <div className="space-y-4">
                  {/* Conversation History */}
                  <div className="h-64 sm:h-80 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-white space-y-2 mb-3">
                    {selected.debateHistory?.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'opponent' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === 'opponent' 
                            ? 'bg-slate-100 text-slate-800 shadow-sm' 
                            : 'bg-emerald-500 text-white shadow-sm'
                        }`}>
                          <div className="text-[11px] font-medium mb-1 opacity-75">
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

                  {/* Input Form */}
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!opponentMessage.trim()) return;
                    
                    setBusy(true);
                    setError('');
                    
                    try {
                      const res = await fetch('/api/arena/debate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ takeId: selected._id, opponentMessage: opponentMessage }),
                      });
                      
                      if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(errorText || 'Failed to send message');
                      }
                      
                      const data = await res.json();
                      setOpponentMessage('');
                      // Refresh the data to show new messages
                      mutate();
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }} className="space-y-3">
                    <textarea
                      className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      rows={3}
                      placeholder="Type your argument..."
                      value={opponentMessage}
                      onChange={(e) => setOpponentMessage(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button 
                        disabled={busy || !opponentMessage.trim()} 
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:transform-none"
                      >
                        {busy ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Debate Results */}
              {selected.debateResult && (
                <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm">
                  <div className="text-sm font-medium text-slate-800 mb-3">Debate Results</div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`text-lg font-bold ${
                      selected.debateResult.winner === 'ai' ? 'text-emerald-600' : 'text-slate-600'
                    }`}>
                      {selected.debateResult.winner === 'ai' ? '🤖 AI Wins!' : '👤 Opponent Wins!'}
                    </div>
                    <div className="text-sm text-slate-600">
                      Score: {selected.debateResult.aiScore} - {selected.debateResult.opponentScore}
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {selected.debateResult.reasoning}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 shadow-sm">
              {selected ? 'This take needs to be trained first' : 'Select a trained AI to debate with'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


