"use client";

import { Position } from "@autotrader/shared";
import { formatDistanceToNow } from "date-fns";

interface PositionCardProps {
  position?: Position;
}

export default function PositionCard({ position }: PositionCardProps) {
  const formatUSD = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPct = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  if (!position) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Current Position</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">No open position</p>
          <p className="text-sm text-gray-600 mt-2">
            Waiting for signal to enter trade
          </p>
        </div>
      </div>
    );
  }

  const pnlPct =
    position.markPrice && position.side === "LONG"
      ? ((position.markPrice - position.entryPrice) / position.entryPrice) * 100
      : position.markPrice
      ? ((position.entryPrice - position.markPrice) / position.entryPrice) * 100
      : 0;

  const isProfitable = position.unrealizedPnl >= 0;

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Current Position</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            position.side === "LONG"
              ? "bg-green-900/50 text-green-400 border border-green-700"
              : "bg-red-900/50 text-red-400 border border-red-700"
          }`}
        >
          {position.side}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Symbol */}
        <div>
          <p className="text-xs text-gray-400">Symbol</p>
          <p className="text-lg font-bold">{position.symbol}-PERP</p>
        </div>

        {/* Size */}
        <div>
          <p className="text-xs text-gray-400">Size</p>
          <p className="text-lg font-semibold">{position.size.toFixed(4)}</p>
        </div>

        {/* Entry Price */}
        <div>
          <p className="text-xs text-gray-400">Entry Price</p>
          <p className="text-lg font-semibold">{formatUSD(position.entryPrice)}</p>
        </div>

        {/* Mark Price */}
        <div>
          <p className="text-xs text-gray-400">Mark Price</p>
          <p className="text-lg font-semibold">
            {position.markPrice ? formatUSD(position.markPrice) : "—"}
          </p>
        </div>

        {/* Leverage */}
        <div>
          <p className="text-xs text-gray-400">Leverage</p>
          <p className="text-lg font-semibold">{position.leverage}x</p>
        </div>

        {/* Margin */}
        <div>
          <p className="text-xs text-gray-400">Margin</p>
          <p className="text-lg font-semibold">{formatUSD(position.margin)}</p>
        </div>

        {/* Unrealized PnL */}
        <div>
          <p className="text-xs text-gray-400">Unrealized PnL</p>
          <p
            className={`text-lg font-bold ${
              isProfitable ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatUSD(position.unrealizedPnl)}
          </p>
        </div>

        {/* PnL % */}
        <div>
          <p className="text-xs text-gray-400">PnL %</p>
          <p
            className={`text-lg font-bold ${
              isProfitable ? "text-green-400" : "text-red-400"
            }`}
          >
            {formatPct(pnlPct)}
          </p>
        </div>
      </div>

      {/* Position Info */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
        <p>
          Opened {formatDistanceToNow(position.openedAt, { addSuffix: true })}
        </p>
        {position.stopLossOrderId && position.takeProfitOrderId && (
          <p className="mt-1">
            ✓ TP/SL orders active
          </p>
        )}
      </div>
    </div>
  );
}
