"use client";

import { useEffect, useState } from "react";
import StatsCards from "@/components/StatsCards";
import EquityChart from "@/components/EquityChart";
import DrawdownChart from "@/components/DrawdownChart";
import PositionsTable from "@/components/PositionsTable";

interface Metrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  currentEquity: number;
  maxDrawdown: number;
  equityCurve: { ts: string; equity: number }[];
  drawdownSeries: { ts: string; drawdown: number }[];
  kellyStats: any[];
  sustainability: { netAfterFees: number; isSustainable: boolean };
}

interface BotHealth {
  status: string;
  mode: string;
  lastHeartbeat: string;
  lastError: string | null;
  uptimeSeconds: number;
  isStale: boolean;
}

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [metricsRes, healthRes, posRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/health"),
        fetch("/api/positions"),
      ]);
      const metricsData = await metricsRes.json();
      const healthData = await healthRes.json();
      const posData = await posRes.json();

      if (metricsRes.ok) setMetrics(metricsData);
      if (healthRes.ok) setHealth(healthData);
      if (posRes.ok) setPositions(posData.positions || []);

      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
        <p className="text-red-400">Error loading data: {error}</p>
        <p className="text-gray-400 text-sm mt-1">
          Check that your Supabase connection is configured correctly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot Status Banner */}
      {health && (
        <div
          className={`flex items-center justify-between rounded-lg px-4 py-3 ${
            health.status === "running" && !health.isStale
              ? "bg-green-900/30 border border-green-700"
              : health.status === "halted"
              ? "bg-red-900/30 border border-red-700"
              : "bg-yellow-900/30 border border-yellow-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                health.status === "running" && !health.isStale
                  ? "bg-green-500 animate-pulse"
                  : health.status === "halted"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            />
            <span className="font-medium">
              Bot: {health.status.toUpperCase()} ({health.mode})
            </span>
          </div>
          <div className="text-sm text-gray-400">
            {health.isStale && (
              <span className="text-yellow-400 mr-4">
                Stale ({Math.round(health.uptimeSeconds / 60)}m ago)
              </span>
            )}
            {health.lastHeartbeat && (
              <span>
                Last heartbeat:{" "}
                {new Date(health.lastHeartbeat).toLocaleTimeString()}
              </span>
            )}
            {health.lastError && (
              <span className="text-red-400 ml-4">
                Error: {health.lastError}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {metrics && (
        <StatsCards
          equity={metrics.currentEquity}
          totalPnl={metrics.totalPnl}
          netPnl={metrics.netPnl}
          totalFees={metrics.totalFees}
          winRate={metrics.winRate}
          totalTrades={metrics.totalTrades}
          winningTrades={metrics.winningTrades}
          losingTrades={metrics.losingTrades}
          maxDrawdown={metrics.maxDrawdown}
          isSustainable={metrics.sustainability?.isSustainable ?? false}
        />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {metrics?.equityCurve && (
          <EquityChart data={metrics.equityCurve} />
        )}
        {metrics?.drawdownSeries && (
          <DrawdownChart data={metrics.drawdownSeries} />
        )}
      </div>

      {/* Open Positions */}
      {positions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Open Positions</h2>
          <PositionsTable positions={positions} />
        </div>
      )}

      {/* Kelly Stats */}
      {metrics?.kellyStats && metrics.kellyStats.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Kelly Criterion Stats</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">Symbol</th>
                  <th className="text-right py-2 px-3">Win Rate</th>
                  <th className="text-right py-2 px-3">Avg Win</th>
                  <th className="text-right py-2 px-3">Avg Loss</th>
                  <th className="text-right py-2 px-3">Kelly %</th>
                  <th className="text-right py-2 px-3">Sample</th>
                  <th className="text-right py-2 px-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {metrics.kellyStats.map((k: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 px-3 font-mono">{k.symbol}</td>
                    <td className="py-2 px-3 text-right">
                      {(Number(k.win_rate) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-green-400">
                      {(Number(k.avg_win) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right text-red-400">
                      {(Number(k.avg_loss) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-blue-400">
                      {(Number(k.kelly_fraction) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right">{k.sample_size}</td>
                    <td className="py-2 px-3 text-right text-gray-400">
                      {new Date(k.ts).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
