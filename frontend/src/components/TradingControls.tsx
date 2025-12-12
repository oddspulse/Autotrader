"use client";

import { TradingMode, ALLOWED_SYMBOLS, AllowedSymbol, MarketInfo } from "@autotrader/shared";

interface TradingControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  tradingMode: TradingMode;
  selectedSymbol: AllowedSymbol;
  isMarketAvailable: boolean;
  marketUnavailableReason?: string;
  onStart: () => void;
  onStop: () => void;
  onSymbolChange: (symbol: string) => void;
  onModeChange: (mode: TradingMode) => void;
  loading: boolean;
  markets: MarketInfo[];
}

export default function TradingControls({
  isRunning,
  isPaused,
  tradingMode,
  selectedSymbol,
  isMarketAvailable,
  marketUnavailableReason,
  onStart,
  onStop,
  onSymbolChange,
  onModeChange,
  loading,
  markets,
}: TradingControlsProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4">Trading Controls</h2>

      <div className="space-y-4">
        {/* Trading Mode Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trading Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onModeChange(TradingMode.PAPER)}
              disabled={isRunning}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                tradingMode === TradingMode.PAPER
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              📄 Paper Trading
            </button>
            <button
              onClick={() => onModeChange(TradingMode.LIVE)}
              disabled={isRunning}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                tradingMode === TradingMode.LIVE
                  ? "bg-red-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              } ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              🔴 Live Trading
            </button>
          </div>
        </div>

        {/* Symbol Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Active Symbol
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            disabled={isRunning}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ALLOWED_SYMBOLS.map((symbol) => {
              const market = markets.find((m) => m.symbol === symbol);
              const available = market?.available ?? true;
              return (
                <option key={symbol} value={symbol} disabled={!available}>
                  {symbol}-PERP {!available && "(Unavailable)"}
                </option>
              );
            })}
          </select>
          {!isMarketAvailable && (
            <p className="text-sm text-red-400 mt-2">
              ⚠️ {marketUnavailableReason || "This market is not available on the selected exchange"}
            </p>
          )}
        </div>

        {/* Start/Stop Button */}
        <div>
          {!isRunning ? (
            <button
              onClick={onStart}
              disabled={loading || !isMarketAvailable}
              className="w-full bg-brand-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? "Starting..." : "🚀 Start Trading"}
            </button>
          ) : (
            <button
              onClick={onStop}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? "Stopping..." : "⏹️ Stop Trading"}
            </button>
          )}
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-between bg-gray-900 rounded-lg p-4">
          <span className="text-sm text-gray-400">Bot Status:</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning && !isPaused
                  ? "bg-green-500 animate-pulse"
                  : isPaused
                  ? "bg-yellow-500"
                  : "bg-gray-500"
              }`}
            />
            <span className="font-medium">
              {isRunning && !isPaused
                ? "Running"
                : isPaused
                ? "Paused/Cooldown"
                : "Stopped"}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-300">
            <strong>Strategy:</strong> EMA Crossover (9/21)
          </p>
          <p className="text-sm text-blue-300 mt-1">
            <strong>Risk/Reward:</strong> 20% TP / 5% SL (4:1 RR)
          </p>
          <p className="text-sm text-blue-300 mt-1">
            <strong>Position Size:</strong> 60% of equity @ 10x leverage
          </p>
        </div>
      </div>
    </div>
  );
}
