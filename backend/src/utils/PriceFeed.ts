import { AllowedSymbol } from "@autotrader/shared";
import { logger } from "./logger";

/**
 * Mock price feed for paper trading and development
 *
 * In production, replace with:
 * - Pyth Network oracle
 * - Switchboard oracle
 * - Exchange WebSocket feeds
 */
export class PriceFeed {
  private prices: Map<AllowedSymbol, number> = new Map();
  private callbacks: Map<AllowedSymbol, ((price: number) => void)[]> = new Map();
  private intervals: Map<AllowedSymbol, NodeJS.Timeout> = new Map();

  // Starting prices (approximate as of 2024)
  private readonly INITIAL_PRICES: Record<AllowedSymbol, number> = {
    BTC: 42000,
    ETH: 2200,
    SOL: 98,
    HYPE: 12.5,
    ZEC: 35,
  };

  constructor() {
    // Initialize with starting prices
    for (const [symbol, price] of Object.entries(this.INITIAL_PRICES)) {
      this.prices.set(symbol as AllowedSymbol, price);
    }

    logger.info("Price feed initialized with mock prices");
  }

  /**
   * Get current price for a symbol
   */
  getPrice(symbol: AllowedSymbol): number {
    return this.prices.get(symbol) || this.INITIAL_PRICES[symbol];
  }

  /**
   * Subscribe to price updates
   */
  subscribe(symbol: AllowedSymbol, callback: (price: number) => void): void {
    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, []);
    }
    this.callbacks.get(symbol)!.push(callback);

    // Start price simulation if not already running
    if (!this.intervals.has(symbol)) {
      this.startPriceSimulation(symbol);
    }

    // Immediately send current price
    callback(this.getPrice(symbol));
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribe(symbol: AllowedSymbol, callback: (price: number) => void): void {
    const callbacks = this.callbacks.get(symbol);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }

      // Stop simulation if no more subscribers
      if (callbacks.length === 0) {
        this.stopPriceSimulation(symbol);
      }
    }
  }

  /**
   * Manually update price (for testing)
   */
  updatePrice(symbol: AllowedSymbol, price: number): void {
    this.prices.set(symbol, price);
    this.notifySubscribers(symbol, price);
  }

  /**
   * Start simulating price movements
   */
  private startPriceSimulation(symbol: AllowedSymbol): void {
    const interval = setInterval(() => {
      const currentPrice = this.getPrice(symbol);

      // Random walk: ±0.1% to ±0.5% per tick
      const changePercent = (Math.random() - 0.5) * 0.01; // -0.5% to +0.5%
      const newPrice = currentPrice * (1 + changePercent);

      this.prices.set(symbol, newPrice);
      this.notifySubscribers(symbol, newPrice);
    }, 1000); // Update every second

    this.intervals.set(symbol, interval);
    logger.debug(`Started price simulation for ${symbol}`);
  }

  /**
   * Stop price simulation
   */
  private stopPriceSimulation(symbol: AllowedSymbol): void {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
      logger.debug(`Stopped price simulation for ${symbol}`);
    }
  }

  /**
   * Notify all subscribers of price update
   */
  private notifySubscribers(symbol: AllowedSymbol, price: number): void {
    const callbacks = this.callbacks.get(symbol) || [];
    callbacks.forEach((callback) => callback(price));
  }

  /**
   * Stop all simulations
   */
  shutdown(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    logger.info("Price feed shut down");
  }
}

// Singleton instance
export const priceFeed = new PriceFeed();
