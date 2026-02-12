interface Trade {
  id: string;
  ts: string;
  symbol: string;
  side: string;
  qty: number;
  entry_price: number;
  exit_price: number | null;
  fees: number;
  pnl: number | null;
  pnl_pct: number | null;
  kelly_fraction: number | null;
  status: string;
}

export default function TradesTable({ trades }: { trades: Trade[] }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-400">
        No trades yet
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="py-3 px-3">Time</th>
              <th className="py-3 px-3">Pair</th>
              <th className="py-3 px-3">Side</th>
              <th className="py-3 px-3 text-right">Qty</th>
              <th className="py-3 px-3 text-right">Entry</th>
              <th className="py-3 px-3 text-right">Exit</th>
              <th className="py-3 px-3 text-right">PnL</th>
              <th className="py-3 px-3 text-right">PnL %</th>
              <th className="py-3 px-3 text-right">Fees</th>
              <th className="py-3 px-3 text-right">Kelly</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(trade.ts).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2 px-3 font-mono font-medium">
                  {trade.symbol}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.side === "buy"
                        ? "bg-green-900/50 text-green-400"
                        : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {Number(trade.qty).toFixed(6)}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  ${Number(trade.entry_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {trade.exit_price
                    ? `$${Number(trade.exit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : "-"}
                </td>
                <td
                  className={`py-2 px-3 text-right font-mono font-medium ${
                    trade.pnl == null
                      ? "text-gray-400"
                      : trade.pnl >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {trade.pnl != null
                    ? `$${Number(trade.pnl).toFixed(2)}`
                    : "-"}
                </td>
                <td
                  className={`py-2 px-3 text-right font-mono ${
                    trade.pnl_pct == null
                      ? "text-gray-400"
                      : trade.pnl_pct >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {trade.pnl_pct != null
                    ? `${(Number(trade.pnl_pct) * 100).toFixed(2)}%`
                    : "-"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-gray-400">
                  ${Number(trade.fees).toFixed(4)}
                </td>
                <td className="py-2 px-3 text-right font-mono text-blue-400">
                  {trade.kelly_fraction != null
                    ? `${(Number(trade.kelly_fraction) * 100).toFixed(1)}%`
                    : "-"}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`text-xs ${
                      trade.status === "closed"
                        ? "text-gray-400"
                        : trade.status === "open"
                        ? "text-blue-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {trade.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
