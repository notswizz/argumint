export default function TokenDisplay({ tokens = 0, history = [], onchain = null }) {
  const onchainText = onchain
    ? `${onchain.symbol || 'TOKEN'} ${Number(onchain.balance || 0n) / 10 ** (onchain.decimals || 18)}`
    : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Off‑chain balance</div>
        <div className="text-2xl font-bold">{tokens}</div>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        On‑chain in wallet: {onchainText ?? '—'}
      </div>
      {history.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto text-sm pr-2">
          {history.map((h) => (
            <li key={h._id} className="flex items-center justify-between">
              <span className="text-slate-700 truncate mr-2">{h.type.replaceAll('_', ' ')}</span>
              <span className={h.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                {h.amount >= 0 ? `+${h.amount}` : h.amount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}