interface Position {
  symbol: string;
  qty: number;
  side: string;
  avg_entry: number;
  current_price: number;
  unrealized_pnl: number;
  stop_loss: number;
  trailing_stop: number;
  kelly_fraction: number;
  opened_at: string;
  updated_at: string;
}

export default function PositionsTable({
  positions,
}: {
  positions: Position[];
}) {
  if (!positions || positions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-400">
        No open positions
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800 text-left">
              <th className="py-3 px-3">Symbol</th>
              <th className="py-3 px-3">Side</th>
              <th className="py-3 px-3 text-right">Qty</th>
              <th className="py-3 px-3 text-right">Entry</th>
              <th className="py-3 px-3 text-right">Current</th>
              <th className="py-3 px-3 text-right">Unrealized PnL</th>
              <th className="py-3 px-3 text-right">Stop Loss</th>
              <th className="py-3 px-3 text-right">Trail Stop</th>
              <th className="py-3 px-3 text-right">Kelly</th>
              <th className="py-3 px-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const pnlPct =
                Number(pos.avg_entry) > 0
                  ? ((Number(pos.current_price) - Number(pos.avg_entry)) /
                      Number(pos.avg_entry)) *
                    100
                  : 0;

              return (
                <tr
                  key={pos.symbol}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="py-2 px-3 font-mono font-medium">
                    {pos.symbol}
                  </td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400">
                      {pos.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {Number(pos.qty).toFixed(6)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    ${Number(pos.avg_entry).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    ${Number(pos.current_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono font-medium ${
                      Number(pos.unrealized_pnl) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    ${Number(pos.unrealized_pnl).toFixed(2)} ({pnlPct.toFixed(2)}
                    %)
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-red-400">
                    {Number(pos.stop_loss) > 0
                      ? `$${Number(pos.stop_loss).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-yellow-400">
                    {Number(pos.trailing_stop) > 0
                      ? `$${Number(pos.trailing_stop).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-blue-400">
                    {Number(pos.kelly_fraction) > 0
                      ? `${(Number(pos.kelly_fraction) * 100).toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(pos.opened_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
