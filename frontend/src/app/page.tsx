"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useApi } from "@/hooks/useApi";
import { useEffect, useState } from "react";
import { BotStatus, TradingMode, ALLOWED_SYMBOLS, AllowedSymbol, MarketInfo } from "@autotrader/shared";
import TradingControls from "@/components/TradingControls";
import PositionCard from "@/components/PositionCard";
import EquityCard from "@/components/EquityCard";
import RiskCard from "@/components/RiskCard";
import LogPanel from "@/components/LogPanel";
import OrdersTable from "@/components/OrdersTable";

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { botState, logs, clearLogs } = useWebSocket();
  const { startBot, stopBot, updateConfig, downloadTrades, loading, error } = useApi();
  const [markets, setMarkets] = useState<MarketInfo[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState<AllowedSymbol>("SOL");
  const [tradingMode, setTradingMode] = useState<TradingMode>(TradingMode.PAPER);

  // Fetch markets on mount
  useEffect(() => {
    async function fetchMarkets() {
      const api = useApi();
      const marketData = await api.getMarkets();
      setMarkets(marketData);
    }
    fetchMarkets();
  }, []);

  const handleStart = async () => {
    if (!publicKey) {
      alert("Please connect your wallet first");
      return;
    }

    // Update config before starting
    await updateConfig({
      activeSymbol: selectedSymbol,
      paperTrading: tradingMode === TradingMode.PAPER,
    });

    const success = await startBot(publicKey.toBase58());
    if (!success && error) {
      alert(`Failed to start bot: ${error}`);
    }
  };

  const handleStop = async () => {
    const success = await stopBot();
    if (!success && error) {
      alert(`Failed to stop bot: ${error}`);
    }
  };

  const isRunning = botState?.status === BotStatus.RUNNING;
  const isPaused = botState?.status === BotStatus.PAUSED || botState?.status === BotStatus.COOLDOWN;

  // Get market info for selected symbol
  const selectedMarket = markets.find((m) => m.symbol === selectedSymbol);
  const isMarketAvailable = selectedMarket?.available ?? true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-purple to-brand-green bg-clip-text text-transparent">
                Solana Perps Auto-Trader
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Automated perpetuals trading with 10x leverage
              </p>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Warning Banner */}
      <div className="bg-red-900/20 border-b border-red-800">
        <div className="container mx-auto px-4 py-3">
          <p className="text-red-400 text-sm font-semibold text-center">
            ⚠️ LEVERAGED TRADING IS EXTREMELY RISKY - Only trade with funds you can afford to lose
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!connected ? (
          <div className="text-center py-20">
            <div className="inline-block p-8 bg-gray-800/50 rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-6">
                Connect your Phantom wallet to start trading
              </p>
              <WalletMultiButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Controls & Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trading Controls */}
              <TradingControls
                isRunning={isRunning}
                isPaused={isPaused}
                tradingMode={tradingMode}
                selectedSymbol={selectedSymbol}
                isMarketAvailable={isMarketAvailable}
                marketUnavailableReason={selectedMarket?.reason}
                onStart={handleStart}
                onStop={handleStop}
                onSymbolChange={(symbol) => setSelectedSymbol(symbol as AllowedSymbol)}
                onModeChange={setTradingMode}
                loading={loading}
                markets={markets}
              />

              {/* Equity & Risk */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EquityCard equity={botState?.equity} />
                <RiskCard riskState={botState?.riskState} />
              </div>

              {/* Position */}
              <PositionCard position={botState?.position} />

              {/* Orders */}
              <OrdersTable orders={botState?.openOrders || []} />
            </div>

            {/* Right Column - Logs */}
            <div className="lg:col-span-1">
              <LogPanel
                logs={logs}
                onClear={clearLogs}
                onDownload={downloadTrades}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>Built with Drift Protocol • Solana • Phantom Wallet</p>
          <p className="mt-2">
            Strategy: EMA Crossover (9/21) • Risk: 20% TP / 5% SL • Max Leverage: 10x
          </p>
        </div>
      </footer>
    </div>
  );
}
