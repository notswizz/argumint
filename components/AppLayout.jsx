import Link from 'next/link';
import useSWR from 'swr';
import Image from 'next/image';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AppLayout({ children }) {
  const { data: me } = useSWR('/api/auth/me', fetcher);
  const user = me?.user;

  return (
    <div className="min-h-screen text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            <span className="brand-mark brand-gold">ArguMint</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/prompt" className="hover:text-slate-900 text-slate-600">Prompt</Link>
              <Link href="/chat" className="hover:text-slate-900 text-slate-600">Chat</Link>
              <Link href="/profile" className="hover:text-slate-900 text-slate-600">Profile</Link>
              <Link href="/admin" className="hover:text-slate-900 text-slate-600">Admin</Link>
            </nav>
            {user ? (
              <div className="text-xs sm:text-sm text-slate-700 border-gold rounded-full px-3 py-1 inline-block bg-white/60">
                {user.username}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <Link href="/login" className="text-slate-600 hover:text-slate-900">Log in</Link>
                <Link href="/signup" className="rounded-full bg-brand-600 hover:bg-brand-500 px-3 py-1 text-white">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:pb-6">{children}</main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-4 text-base text-slate-600">
          <Link href="/prompt" className="text-center py-3 hover:text-slate-900">Prompt</Link>
          <Link href="/chat" className="text-center py-3 hover:text-slate-900">Chat</Link>
          <Link href="/profile" className="text-center py-3 hover:text-slate-900">Profile</Link>
          <Link href="/admin" className="text-center py-2 hover:text-slate-900">Admin</Link>
        </div>
      </nav>
    </div>
  );
} 