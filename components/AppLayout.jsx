import Link from 'next/link';
import useSWR from 'swr';
import Image from 'next/image';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AppLayout({ children }) {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;

  return (
    <div className="min-h-screen text-gray-100">
      <header className="sticky top-0 z-20 border-b border-gray-900/70 bg-black/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-gray-100">
            <span className="brand-mark brand-gold">ArguMint</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/prompt" className="hover:text-white text-gray-300">Prompt</Link>
              <Link href="/chat" className="hover:text-white text-gray-300">Chat</Link>
              <Link href="/profile" className="hover:text-white text-gray-300">Profile</Link>
              <Link href="/admin" className="hover:text-white text-gray-300">Admin</Link>
            </nav>
            {user ? (
              <div className="text-xs sm:text-sm text-gray-300 border-gold rounded-full px-3 py-1 inline-block">
                {user.username}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <Link href="/login" className="text-gray-300 hover:text-white">Log in</Link>
                <Link href="/signup" className="rounded-full bg-brand-600 hover:bg-brand-500 px-3 py-1 text-gray-50">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-20 sm:pb-6">{children}</main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-900/70 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-2 grid grid-cols-4 text-xs text-gray-300">
          <Link href="/prompt" className="text-center py-2 hover:text-white">Prompt</Link>
          <Link href="/chat" className="text-center py-2 hover:text-white">Chat</Link>
          <Link href="/profile" className="text-center py-2 hover:text-white">Profile</Link>
          <Link href="/admin" className="text-center py-2 hover:text-white">Admin</Link>
        </div>
      </nav>
    </div>
  );
} 