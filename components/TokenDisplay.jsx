export default function TokenDisplay({ tokens = 0, history = [] }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">Tokens</div>
        <div className="text-2xl font-bold">{tokens}</div>
      </div>
      {history.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto text-sm">
          {history.map((h) => (
            <li key={h._id} className="flex items-center justify-between">
              <span className="text-gray-300">{h.type.replaceAll('_', ' ')}</span>
              <span className={h.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {h.amount >= 0 ? `+${h.amount}` : h.amount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 