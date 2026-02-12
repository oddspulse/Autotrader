"use client";

import { useEffect, useState } from "react";
import PositionsTable from "@/components/PositionsTable";

export default function PositionsPage() {
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/positions");
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading positions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Open Positions</h1>

      {positions.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-400">
          No open positions
        </div>
      ) : (
        <>
          <p className="text-gray-400 text-sm">
            {positions.length} position{positions.length > 1 ? "s" : ""} open.
            Auto-refreshes every 15 seconds.
          </p>
          <PositionsTable positions={positions} />
        </>
      )}
    </div>
  );
}
