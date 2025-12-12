"use client";

import { LogEntry } from "@autotrader/shared";
import { format } from "date-fns";
import { useEffect, useRef } from "react";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onDownload: () => void;
}

export default function LogPanel({ logs, onClear, onDownload }: LogPanelProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "•";
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Live Logs</h3>
        <div className="flex gap-2">
          <button
            onClick={onDownload}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
            title="Download trade history"
          >
            📥 Export
          </button>
          <button
            onClick={onClear}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
            title="Clear logs"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-black/30 rounded-lg p-4 font-mono text-xs space-y-1 max-h-[600px]"
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            No logs yet. Start the bot to see activity.
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="flex gap-2 hover:bg-gray-800/50 px-2 py-1 rounded"
            >
              <span className="text-gray-600 shrink-0">
                {format(log.timestamp, "HH:mm:ss")}
              </span>
              <span className="shrink-0">{getLevelIcon(log.level)}</span>
              <span className={`${getLevelColor(log.level)} break-all`}>
                {log.message}
                {log.data && (
                  <span className="text-gray-600 ml-2">
                    {JSON.stringify(log.data)}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
        <p>Total logs: {logs.length} (max 100)</p>
      </div>
    </div>
  );
}
