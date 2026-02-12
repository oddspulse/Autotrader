"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  ts: string;
  drawdown: number;
}

export default function DrawdownChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 h-64 flex items-center justify-center text-gray-400">
        No drawdown data yet
      </div>
    );
  }

  const formatted = data.map((d) => ({
    time: new Date(d.ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    drawdown: Number(d.drawdown.toFixed(2)),
  }));

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">
        Drawdown
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            domain={["auto", 0]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, "Drawdown"]}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#EF4444"
            fill="#EF4444"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
