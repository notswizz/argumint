export default function TokenDisplay({ tokens = 0, history = [], onchain = null }) {
  const decimals = onchain?.decimals || 18;
  const symbol = onchain?.symbol || 'TOKEN';
  const balanceNum = onchain?.balance ? Number(onchain.balance) / 10 ** decimals : 0;
  const hasOnchain = Boolean(onchain && (onchain.address || balanceNum > 0));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">Off‑chain</div>
        <div className="mt-1 text-3xl font-extrabold text-slate-900">{tokens.toLocaleString()}</div>
        <div className="mt-1 text-[11px] text-slate-500">Available to claim</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">On‑chain</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {hasOnchain ? balanceNum.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
              <span className="ml-2 text-sm text-slate-600">{symbol}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {onchain?.address ? `${onchain.address.slice(0, 6)}…${onchain.address.slice(-4)}` : 'No wallet connected'}
            </div>
          </div>
          <div className="hidden sm:block w-10 h-10 rounded-full bg-sky-200/60 border border-sky-300" />
        </div>
      </div>
      {history.length > 0 && (
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Recent activity</div>
          <ul className="space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
            {history.map((h) => (
              <li key={h._id} className="flex items-center justify-between">
                <span className="text-slate-700 truncate mr-2">{h.type.replaceAll('_', ' ')}</span>
                <span className={h.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {h.amount >= 0 ? `+${h.amount}` : h.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}