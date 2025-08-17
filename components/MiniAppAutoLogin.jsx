import { useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';

export default function MiniAppAutoLogin() {
  const { isSDKLoaded, context } = useMiniApp();
  const attemptedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (attemptedRef.current) return;
      if (!isSDKLoaded) return;
      const fid = context?.user?.fid ?? context?.fid;
      const username = context?.user?.username ?? context?.username ?? (fid ? `fid-${fid}` : '');
      const pfpUrl = context?.user?.pfpUrl || context?.user?.pfp?.url || null;
      if (!fid) return;
      attemptedRef.current = true;
      try {
        // If already logged in, skip
        const me = await fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json()).catch(() => null);
        if (me?.user) return;
        await fetch('/api/auth/farcaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fid, username, pfpUrl, custodyAddress: null }),
        });
      } catch (_) {
        // silent fail; user can use manual login page
      }
    };
    run();
  }, [isSDKLoaded, context]);

  return null;
}


