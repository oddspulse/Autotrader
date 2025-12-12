"use client";

import { RiskState } from "@autotrader/shared";
import { formatDistanceToNow } from "date-fns";

interface RiskCardProps {
  riskState?: RiskState;
}

export default function RiskCard({ riskState }: RiskCardProps) {
  if (!riskState) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Risk Management</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const formatPct = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-semibold mb-4">Risk Management</h3>

      <div className="space-y-3">
        {/* Trading Status */}
        <div>
          <p className="text-sm text-gray-400">Trading Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-3 h-3 rounded-full ${
                riskState.canTrade ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <p className="text-lg font-semibold">
              {riskState.canTrade ? "Allowed" : "Blocked"}
            </p>
          </div>
          {!riskState.canTrade && riskState.reason && (
            <p className="text-sm text-red-400 mt-1">{riskState.reason}</p>
          )}
        </div>

        {/* Consecutive Losses */}
        <div>
          <p className="text-sm text-gray-400">Consecutive Losses</p>
          <p
            className={`text-xl font-bold ${
              riskState.consecutiveLosses >= 2 ? "text-red-400" : "text-gray-300"
            }`}
          >
            {riskState.consecutiveLosses} / 3
          </p>
        </div>

        {/* Daily Loss */}
        <div>
          <p className="text-sm text-gray-400">Daily Loss (Cap: 3%)</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  riskState.isDailyLossCapHit
                    ? "bg-red-500"
                    : Math.abs(riskState.dailyPnlPct) > 0.02
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(
                    Math.abs(riskState.dailyPnlPct) * 100 / 3,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-sm font-medium w-16 text-right">
              {formatPct(Math.abs(riskState.dailyPnlPct))}
            </p>
          </div>
        </div>

        {/* Cooldown */}
        {riskState.cooldownUntil && riskState.cooldownUntil > Date.now() && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-300 font-medium">
              ⏱️ Cooldown Active
            </p>
            <p className="text-xs text-yellow-400 mt-1">
              Expires {formatDistanceToNow(riskState.cooldownUntil, { addSuffix: true })}
            </p>
          </div>
        )}

        {/* Last Loss */}
        {riskState.lastLossTime && (
          <div className="text-xs text-gray-500">
            Last loss: {formatDistanceToNow(riskState.lastLossTime, { addSuffix: true })}
          </div>
        )}
      </div>
    </div>
  );
}
