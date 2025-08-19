import Link from 'next/link';
import useSWR from 'swr';
import Image from 'next/image';
import { useRouter } from 'next/router';
import MiniAppAutoLogin from './MiniAppAutoLogin';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function AppLayout({ children }) {
  const { data: me } = useSWR('/api/auth/me', (url) => fetch(url, { credentials: 'include' }).then((r) => r.json()));
  const user = me?.user;
  const router = useRouter();
  const isHome = router.pathname === '/';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    // Force refresh client-side data and redirect to home
    router.replace('/');
  };

  return (
    <div className="min-h-screen text-slate-800 app-root">
      <MiniAppAutoLogin />
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-none sm:max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            <span className="brand-mark brand-gold">ArguMint</span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/prompt" className="hover:text-slate-900 text-slate-600">Prompt</Link>
              <Link href="/debate" className="hover:text-slate-900 text-slate-600">Debate</Link>
              <Link href="/profile" className="hover:text-slate-900 text-slate-600">Profile</Link>
            </nav>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm text-slate-700 border-gold rounded-full px-3 py-1 inline-block bg-white/60">
                  {user.username}
                </div>
                <button onClick={handleLogout} className="text-xs sm:text-sm text-slate-600 hover:text-slate-900 underline">
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <Link href="/login" className="text-slate-600 hover:text-slate-900">Log in</Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className={`mx-auto max-w-none sm:max-w-6xl px-3 sm:px-4 py-3 sm:py-6 pb-28 sm:pb-6 app-main ${isHome ? 'app-main-scroll' : ''}`}>{children}</main>
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/80 bg-white/85 backdrop-blur" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
        <div className="mx-auto max-w-none px-3 py-2 grid grid-cols-3 text-sm text-slate-600">
          <Link href="/prompt" className="text-center py-2 hover:text-slate-900 flex flex-col items-center gap-1">
            <Image src="/file.svg" alt="Prompt" width={22} height={22} />
            <span>Prompt</span>
          </Link>
          <Link href="/debate" className="text-center py-2 hover:text-slate-900 flex flex-col items-center gap-1">
            <Image src="/globe.svg" alt="Debate" width={22} height={22} />
            <span>Debate</span>
          </Link>
          <Link href="/profile" className="text-center py-2 hover:text-slate-900 flex flex-col items-center gap-1">
            <Image src="/window.svg" alt="Profile" width={22} height={22} />
            <span>Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
} 