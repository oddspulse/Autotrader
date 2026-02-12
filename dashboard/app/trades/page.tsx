"use client";

import { useEffect, useState } from "react";
import TradesTable from "@/components/TradesTable";

export default function TradesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trades?limit=200")
      .then((r) => r.json())
      .then((d) => setTrades(d.trades || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading trades...</div>
      </div>
    );
  }

  const closed = trades.filter((t) => t.status === "closed");
  const open = trades.filter((t) => t.status === "open");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trade History</h1>

      <div className="flex gap-4 text-sm">
        <span className="text-gray-400">
          Total: {trades.length} | Closed: {closed.length} | Open: {open.length}
        </span>
      </div>

      <TradesTable trades={trades} />
    </div>
  );
}
