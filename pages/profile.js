import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { useMiniApp } from '@neynar/react';
import TokenDisplay from '@/components/TokenDisplay';

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function ProfilePage() {
  const { data } = useSWR('/api/auth/me', fetcher);
  const user = data?.user;
  const { data: tx } = useSWR(user ? `/api/tokens/history?userId=${user._id}` : null, fetcher);
  const { data: perf } = useSWR(user ? '/api/users/performance' : null, fetcher);
  const { context } = useMiniApp();
  const [miniSdk, setMiniSdk] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  useEffect(() => {
    let mounted = true;
    import('@farcaster/miniapp-sdk').then((m) => {
      if (mounted) setMiniSdk(m?.sdk || null);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Load cached wallet address quickly to avoid zeroing balance on remount
  useEffect(() => {
    try {
      const cached = typeof window !== 'undefined' ? window.localStorage.getItem('walletAddress') : null;
      if (cached) setWalletAddress(cached);
    } catch {}
  }, []);

  // Detect wallet address via Mini App provider or injected provider
  useEffect(() => {
    let active = true;
    async function detect() {
      try {
        if (miniSdk && miniSdk.wallet && typeof miniSdk.wallet.getEthereumProvider === 'function') {
          const provider = await miniSdk.wallet.getEthereumProvider();
          const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => []);
          const addr = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
          if (active && addr) {
            setWalletAddress(addr);
            try { window.localStorage.setItem('walletAddress', addr); } catch {}
            return;
          }
        }
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
          const addr = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
          if (active && addr) {
            setWalletAddress(addr);
            try { window.localStorage.setItem('walletAddress', addr); } catch {}
          }
        }
      } catch {}
    }
    detect();
    // Listen for account changes to refresh address
    function onAccountsChanged(accs) {
      const addr = Array.isArray(accs) && accs[0] ? String(accs[0]) : null;
      setWalletAddress(addr);
      try { if (addr) window.localStorage.setItem('walletAddress', addr); } catch {}
    }
    try { if (typeof window !== 'undefined' && window.ethereum && window.ethereum.on) window.ethereum.on('accountsChanged', onAccountsChanged); } catch {}
    return () => {
      active = false;
      try { if (typeof window !== 'undefined' && window.ethereum && window.ethereum.removeListener) window.ethereum.removeListener('accountsChanged', onAccountsChanged); } catch {}
    };
  }, [miniSdk]);
  const getFid = () => {
    const fid = context?.user?.fid ?? context?.fid ?? (typeof window !== 'undefined' && window.__FC ? window.__FC.fid : undefined);
    return fid ? String(fid) : undefined;
  };
  const fidHeaderFetcher = async (url) => {
    const fid = getFid();
    let address;
    try {
      if (miniSdk && miniSdk.wallet && typeof miniSdk.wallet.getEthereumProvider === 'function') {
        // Prefer cached address if available to avoid empty fetches
        address = walletAddress || undefined;
        if (!address) {
          const provider = await miniSdk.wallet.getEthereumProvider();
          const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => []);
          address = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : undefined;
        }
      }
    } catch {}
    // Fallback to injected provider if available
    if (!address && typeof window !== 'undefined' && window.ethereum && window.ethereum.request) {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
      address = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : undefined;
    }
    const headers = {};
    if (fid) headers['x-fid'] = fid;
    if (address) headers['x-address'] = address;
    return fetch(url, { headers }).then((r) => r.json());
  };
  const hasAddress = Boolean(walletAddress || (user && user.custodyAddress));
  const balanceKey = user && hasAddress ? `/api/token/balance?addr=${encodeURIComponent(walletAddress || user.custodyAddress)}` : null;
  const { data: onchain } = useSWR(balanceKey, fidHeaderFetcher, { keepPreviousData: true, revalidateOnFocus: false, dedupeInterval: 10000 });
  const [showRecent, setShowRecent] = useState(false);

  async function claimOffchainToWallet() {
    try {
      // Build user-signed tx for current off-chain balance
      const headers = { 'Content-Type': 'application/json' };
      const fid = getFid();
      if (fid) headers['x-fid'] = fid;
      // Attach wallet address if available
      try {
        if (miniSdk && miniSdk.wallet && typeof miniSdk.wallet.getEthereumProvider === 'function') {
          const provider = await miniSdk.wallet.getEthereumProvider();
          const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => []);
          const address = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : undefined;
          if (address) headers['x-address'] = address;
        }
      } catch {}
      const res = await fetch('/api/token/claim-balance-tx', { method: 'POST', headers, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to build claim tx');
      const txReq = data?.tx;
      if (!txReq) throw new Error('Missing tx payload');
      // Prefer Mini App transaction sheet if available
      if (miniSdk && miniSdk.actions && typeof miniSdk.actions.transaction === 'function') {
        const resTx = await miniSdk.actions.transaction({
          chainId: 84532,
          to: txReq.to,
          data: txReq.data,
          value: txReq.value || '0x0',
        });
        const txHash = resTx?.hash || resTx;
        await fetch('/api/token/zero-offchain', { method: 'POST', credentials: 'include' });
        console.log('Submitted:', txHash);
        window.location.reload();
        return;
      }
      // Next best: Mini App Ethereum provider per docs
      if (miniSdk && miniSdk.wallet && typeof miniSdk.wallet.getEthereumProvider === 'function') {
        const provider = await miniSdk.wallet.getEthereumProvider();
        if (provider && provider.request) {
          const accounts = await provider.request({ method: 'eth_requestAccounts' }).catch(() => []);
          const from = Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : undefined;
          // Ensure chain is Base Sepolia (0x14a34)
          try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x14a34' }] }); } catch (_) {}
          const txParams = { from, to: txReq.to, data: txReq.data, value: txReq.value || '0x0' };
          const txHash = await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
          await fetch('/api/token/zero-offchain', { method: 'POST', credentials: 'include' });
          console.log('Submitted:', txHash);
          window.location.reload();
          return;
        }
      }
      // Fallback to injected provider if present
      if (typeof window !== 'undefined' && window.ethereum) {
        const txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [txReq] });
        // Optimistically zero off-chain after submission
        await fetch('/api/token/zero-offchain', { method: 'POST', credentials: 'include' });
        alert(`Submitted: ${txHash}`);
        window.location.reload();
        return;
      }
      console.error('No Mini App transaction API or wallet provider available');
    } catch (e) {
      alert(e?.message || 'Claim failed');
    }
  }

  if (!user) return <div className="p-4">Please log in.</div>;

  return (
    <div className="max-w-5xl mx-auto p-3 space-y-3">
      <div className="rounded-xl border border-slate-200 p-3 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {user.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt={user.username} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-slate-300 text-slate-700 text-sm flex items-center justify-center border border-slate-200">
                {(user.username || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-base font-semibold leading-tight">{user.username}</div>
              <div className="text-[11px] text-slate-600 leading-tight">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={claimOffchainToWallet} className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm">Claim to wallet</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Tokens</div>
          <div className="flex items-start justify-between">
            <TokenDisplay tokens={user.tokens} history={tx?.history || []} onchain={onchain} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Performance</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-slate-500">Debates</div><div className="text-lg font-semibold">{perf?.summary?.debatesParticipated ?? 0}</div></div>
            <div><div className="text-slate-500">Wins</div><div className="text-lg font-semibold">{perf?.summary?.groupWins ?? 0}</div></div>
            <div><div className="text-slate-500">My avg</div><div className="text-lg font-semibold">{perf?.summary?.indAvg ?? 0}</div></div>
            <div><div className="text-slate-500">Group avg</div><div className="text-lg font-semibold">{perf?.summary?.groupAvg ?? 0}</div></div>
            <div><div className="text-slate-500">My best</div><div className="text-lg font-semibold">{perf?.summary?.indBest ?? 0}</div></div>
            <div><div className="text-slate-500">Group best</div><div className="text-lg font-semibold">{perf?.summary?.groupBest ?? 0}</div></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Recent debates</div>
          <button onClick={() => setShowRecent((v) => !v)} className="text-xs text-slate-600 underline">
            {showRecent ? 'Hide' : 'Show'}
          </button>
        </div>
        {showRecent && (
          <div className="mt-2 overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Prompt</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Group</th>
                  <th className="py-2 pr-3">My score</th>
                  <th className="py-2 pr-3">Members</th>
                </tr>
              </thead>
              <tbody>
                {(perf?.recent || []).slice(0, 3).map((r) => (
                  <tr key={r.triadId} className="border-t border-slate-100">
                    <td className="py-2 pr-3 max-w-[420px] truncate" title={r.promptText}>{r.promptText || '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.date ? new Date(r.date).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-3"><span className="rounded-md bg-slate-200 text-slate-800 px-2 py-0.5 text-[11px] font-mono">{r.groupScore ?? 0}</span> {r.isGroupWinner && (<span className="ml-1 rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">Winner</span>)}</td>
                    <td className="py-2 pr-3 font-mono">{r.myScore ?? 0}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.participants ?? 0}</td>
                  </tr>
                ))}
                {(!perf?.recent || perf.recent.length === 0) && (
                  <tr><td colSpan="5" className="py-4 text-center text-slate-500 text-sm">No debates yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 