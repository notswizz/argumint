import useSWR from 'swr';
import DebateRoom from '@/components/DebateRoom';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function DebateRedirect() {
  if (typeof window !== 'undefined') {
    window.location.replace('/chat');
  }
  return null;
} 