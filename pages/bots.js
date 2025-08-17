import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((r) => r.json());

const BOT_PERSONAS = [
  {
    key: 'witty',
    name: 'WittyBot',
    description: 'Playful, punchy one-liners with clever analogies. Keeps it light but insightful.',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'professor',
    name: 'ProfessorBot',
    description: 'Structured, evidence-minded, teaches as they argue. Calm, respectful tone.',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'trash',
    name: 'TrashTalkBot',
    description: 'Friendly banter with competitive edge. Bold takes with swagger (but clean).',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700',
  },
];

export default function BotsPage() {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  const { data: aiData, mutate: mutateAi } = useSWR('/api/prompts/active?ai=1', fetcher);
  const { data: usersData, mutate: mutateUsers } = useSWR('/api/prompts/active?users=1', fetcher);
  const [assigning, setAssigning] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const aiPrompts = useMemo(() => aiData?.prompts || [], [aiData?.prompts]);
  const userPrompts = useMemo(() => usersData?.prompts || [], [usersData?.prompts]);

  if (!user) return <div className="p-4">Please log in.</div>;

  async function assignBot(promptId, botKey) {
    setAssigning(`${promptId}:${botKey}`);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/bots/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId, botKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign bot');
      setMessage(`Assigned ${data.bot?.username || 'bot'} to prompt.`);
      mutateAi();
      mutateUsers();
    } catch (e) {
      setError(e.message);
    } finally {
      setAssigning('');
    }
  }

  function PromptList({ title, prompts }) {
    if (!prompts?.length) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p._id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-sm font-medium text-slate-900">{p.text}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {BOT_PERSONAS.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => assignBot(p._id, b.key)}
                    disabled={assigning === `${p._id}:${b.key}`}
                    className={`px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:border-slate-400 bg-white ${assigning === `${p._id}:${b.key}` ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    Assign {b.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <div className="text-lg font-semibold text-slate-900">Bots</div>
        <div className="text-sm text-slate-600">Assign a bot to an upcoming prompt. When the prompt starts, the bot will auto-post its response in the room.</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {BOT_PERSONAS.map((b) => (
          <div key={b.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <div className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide ${b.badgeClass}`}>Bot</div>
              <div className="text-sm font-medium text-slate-900">{b.name}</div>
            </div>
            <div className="mt-2 text-xs text-slate-600">{b.description}</div>
          </div>
        ))}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {message && <div className="text-sm text-emerald-600">{message}</div>}

      <div className="space-y-6">
        <PromptList title="AI Prompts" prompts={aiPrompts} />
        <PromptList title="User Prompts" prompts={userPrompts} />
      </div>
    </div>
  );
}


