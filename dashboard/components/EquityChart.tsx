"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  ts: string;
  equity: number;
}

export default function EquityChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 h-64 flex items-center justify-center text-gray-400">
        No equity data yet
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
    equity: Number(d.equity),
  }));

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">
        Equity Curve
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
              fontSize: "12px",
            }}
            formatter={(value: number) => [
              `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              "Equity",
            ]}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
