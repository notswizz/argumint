import { useState } from 'react';
import { AuthKitProvider, SignInButton } from '@farcaster/auth-kit';

export default function FarcasterAuthKitSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSuccess(payload) {
    setLoading(true);
    setError('');
    try {
      const fid = payload?.fid;
      const username = payload?.username || (fid ? `fid-${fid}` : '');
      const pfpUrl = payload?.pfpUrl || payload?.pfp?.url || null;
      const address = payload?.address || payload?.ethAddress || null;
      const message = payload?.message || payload?.signInMessage || null;
      const signature = payload?.signature || payload?.signInSignature || null;

      let endpoint = '/api/auth/farcaster';
      let body = { fid, username, pfpUrl, custodyAddress: address };

      if (message && signature && address && fid && username) {
        endpoint = '/api/auth/farcaster-verify';
        body = { message, signature, address, fid: Number(fid), username, pfpUrl };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data && (data.error || data.detail)
          ? [data.error, data.detail].filter(Boolean).join(': ')
          : `Failed to sign in (${res.status})`;
        throw new Error(msg);
      }
      window.location.href = '/profile';
    } catch (e) {
      setError(e?.message || 'Failed to sign in');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      <AuthKitProvider>
        <SignInButton
          onSuccess={handleSuccess}
          onError={(err) => setError(err?.message || 'Authorization failed')}
          disabled={loading}
        />
      </AuthKitProvider>
    </div>
  );
}



