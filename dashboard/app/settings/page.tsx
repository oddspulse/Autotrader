"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bot Settings</h1>

      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Bot Status</h2>
        {health ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Status:</span>{" "}
              <span className="font-medium">{health.status}</span>
            </div>
            <div>
              <span className="text-gray-400">Mode:</span>{" "}
              <span className="font-medium">{health.mode}</span>
            </div>
            <div>
              <span className="text-gray-400">Version:</span>{" "}
              <span className="font-medium">{health.version}</span>
            </div>
            <div>
              <span className="text-gray-400">Uptime:</span>{" "}
              <span className="font-medium">
                {Math.round((health.uptimeSeconds || 0) / 3600)}h{" "}
                {Math.round(((health.uptimeSeconds || 0) % 3600) / 60)}m
              </span>
            </div>
            <div>
              <span className="text-gray-400">Last Heartbeat:</span>{" "}
              <span className="font-medium">
                {health.lastHeartbeat
                  ? new Date(health.lastHeartbeat).toLocaleString()
                  : "Never"}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Stale:</span>{" "}
              <span
                className={
                  health.isStale ? "text-yellow-400" : "text-green-400"
                }
              >
                {health.isStale ? "Yes" : "No"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">Loading...</p>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Dashboard Info</h2>
        <p className="text-gray-400 text-sm">
          This dashboard is <strong>read-only</strong>. It displays data from
          the bot runner&apos;s database. To pause or stop the bot, SSH into
          the VPS and run:
        </p>
        <pre className="bg-gray-800 rounded p-3 mt-3 text-sm font-mono text-green-400">
          {`# Stop the bot
sudo systemctl stop autotrader

# Pause (sends SIGTERM for graceful shutdown)
sudo systemctl stop autotrader

# Restart
sudo systemctl restart autotrader

# View logs
journalctl -u autotrader -f`}
        </pre>
      </div>

      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Architecture</h2>
        <div className="text-sm text-gray-400 space-y-2">
          <p>
            <strong className="text-gray-200">Bot Runner</strong> (Python on
            VPS): Executes trades on Kraken, writes to Supabase Postgres.
          </p>
          <p>
            <strong className="text-gray-200">Dashboard</strong> (Next.js on
            Vercel): Reads from Supabase Postgres. Does NOT execute trades.
          </p>
          <p>
            <strong className="text-gray-200">Database</strong> (Supabase
            Postgres): Shared data layer between bot and dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
