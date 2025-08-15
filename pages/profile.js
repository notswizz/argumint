import useSWR from 'swr';
import TokenDisplay from '@/components/TokenDisplay';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ProfilePage() {
  const { data } = useSWR('/api/auth/me', fetcher);
  const user = data?.user;
  const { data: tx } = useSWR(user ? `/api/tokens/history?userId=${user._id}` : null, fetcher);

  if (!user) return <div className="p-4">Please log in.</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/40">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-800" />
          <div>
            <div className="text-lg font-semibold">{user.username}</div>
            <div className="text-xs text-gray-400">{user.email}</div>
          </div>
        </div>
      </div>
      <TokenDisplay tokens={user.tokens} history={tx?.history || []} />
    </div>
  );
} 