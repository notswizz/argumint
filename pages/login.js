import { useEffect, useState } from 'react';
import { useMiniApp } from '@neynar/react';
import dynamic from 'next/dynamic';

export default function LoginPage() {
  const { isSDKLoaded, context } = useMiniApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const FarcasterAuthKitSignIn = dynamic(() => import('@/components/FarcasterAuthKitSignIn'), { ssr: false });

  useEffect(() => {
    // SDK readiness is handled by the provider; nothing extra needed here.
  }, []);

  async function signInWithFarcaster() {
    if (!isSDKLoaded) {
      setError('Mini App SDK not loaded yet. Please try again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Attempt to extract identity details from Mini App context
      const fid = context?.user?.fid ?? context?.fid;
      const username = context?.user?.username ?? context?.username ?? (fid ? `fid-${fid}` : '');
      const pfpUrl = context?.user?.pfpUrl || context?.user?.pfp?.url || null;
      if (!fid) throw new Error('Missing Farcaster identity (fid) in context');

      // Mini App context-only session (no wallet signature)
      const res = await fetch('/api/auth/farcaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fid, username, pfpUrl, custodyAddress: null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data && (data.error || data.detail)
          ? [data.error, data.detail].filter(Boolean).join(': ')
          : `Failed to sign in (${res.status})`;
        throw new Error(message);
      }
      window.location.href = '/profile';
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-6">Continue with Farcaster</h1>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-2">Scan QR with Warpcast</p>
          <FarcasterAuthKitSignIn />
        </div>
        <div className="relative">
          <div className="my-2 text-center text-xs text-slate-400">or</div>
          <div className="space-y-3">
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              onClick={signInWithFarcaster}
              disabled={loading || !isSDKLoaded}
              className="w-full rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-3 py-2 font-medium text-white"
            >
              {loading ? 'Signing in…' : (isSDKLoaded ? 'Sign in via Mini App context' : 'Loading Mini App…')}
            </button>
            <p className="text-xs text-slate-500">Mini App fallback if you&apos;re opening from within Warpcast.</p>
          </div>
        </div>
      </div>
    </div>
  );
}