"use client";

import { EquitySnapshot } from "@autotrader/shared";

interface EquityCardProps {
  equity?: EquitySnapshot;
}

export default function EquityCard({ equity }: EquityCardProps) {
  if (!equity) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Account Equity</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPct = (value: number) => {
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
  };

  const dailyPnlPct = equity.dailyPnl / equity.totalEquity;
  const isProfitable = equity.dailyPnl >= 0;

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Account Equity</h3>

      <div className="space-y-3">
        {/* Total Equity */}
        <div>
          <p className="text-sm text-gray-400">Total Equity</p>
          <p className="text-2xl font-bold">{formatUSD(equity.totalEquity)}</p>
        </div>

        {/* Daily PnL */}
        <div>
          <p className="text-sm text-gray-400">Daily PnL</p>
          <p
            className={`text-xl font-semibold ${
              isProfitable ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatUSD(equity.dailyPnl)} ({formatPct(dailyPnlPct)})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          {/* Free Collateral */}
          <div>
            <p className="text-xs text-gray-400">Free Collateral</p>
            <p className="text-sm font-medium text-green-400">
              {formatUSD(equity.freeCollateral)}
            </p>
          </div>

          {/* Used Margin */}
          <div>
            <p className="text-xs text-gray-400">Used Margin</p>
            <p className="text-sm font-medium text-yellow-400">
              {formatUSD(equity.usedMargin)}
            </p>
          </div>

          {/* Unrealized PnL */}
          <div>
            <p className="text-xs text-gray-400">Unrealized PnL</p>
            <p
              className={`text-sm font-medium ${
                equity.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatUSD(equity.unrealizedPnl)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
