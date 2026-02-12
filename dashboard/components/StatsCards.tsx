interface StatsCardsProps {
  equity: number;
  totalPnl: number;
  netPnl: number;
  totalFees: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  isSustainable: boolean;
}

function Card({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color || "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function StatsCards({
  equity,
  totalPnl,
  netPnl,
  totalFees,
  winRate,
  totalTrades,
  winningTrades,
  losingTrades,
  maxDrawdown,
  isSustainable,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card
        label="Equity"
        value={`$${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      />
      <Card
        label="Net PnL"
        value={`$${netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        color={netPnl >= 0 ? "text-green-400" : "text-red-400"}
        sub={`Fees: $${totalFees.toFixed(2)}`}
      />
      <Card
        label="Win Rate"
        value={`${(winRate * 100).toFixed(1)}%`}
        color={winRate >= 0.5 ? "text-green-400" : "text-yellow-400"}
        sub={`${winningTrades}W / ${losingTrades}L (${totalTrades} total)`}
      />
      <Card
        label="Max Drawdown"
        value={`${(maxDrawdown * 100).toFixed(2)}%`}
        color={maxDrawdown > 0.05 ? "text-red-400" : "text-yellow-400"}
      />
      <Card
        label="Sustainability"
        value={isSustainable ? "Profitable" : "Building"}
        color={isSustainable ? "text-green-400" : "text-yellow-400"}
        sub={`Gross: $${totalPnl.toFixed(2)}`}
      />
    </div>
  );
}
