import { useRouter } from 'next/router';
import useSWR from 'swr';
import ChatRoom from '@/components/ChatRoom';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function RoomPage() {
  const router = useRouter();
  const { roomId } = router.query;
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;
  if (!user) return <div className="p-4">Please log in.</div>;
  if (!roomId) return null;
  return (
    <div className="max-w-3xl mx-auto p-4">
      <ChatRoom roomId={roomId} user={user} />
    </div>
  );
} 