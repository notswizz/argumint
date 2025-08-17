export default function TokenDisplay({ tokens = 0, history = [] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Tokens</div>
        <div className="text-2xl font-bold">{tokens}</div>
      </div>
      {history.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto text-sm">
          {history.map((h) => (
            <li key={h._id} className="flex items-center justify-between">
              <span className="text-slate-700">{h.type.replaceAll('_', ' ')}</span>
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