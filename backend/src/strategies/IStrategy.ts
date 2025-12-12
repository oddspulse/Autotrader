import { AllowedSymbol, TradingSignal, Candle } from "@autotrader/shared";

/**
 * Strategy interface
 *
 * All trading strategies must implement this interface.
 * Strategies analyze market data and produce trading signals.
 */
export interface IStrategy {
  /**
   * Strategy name
   */
  readonly name: string;

  /**
   * Initialize strategy (load parameters, etc.)
   */
  initialize(): void;

  /**
   * Generate trading signal from candle data
   *
   * @param symbol - Trading symbol
   * @param candles - Historical candles (most recent last)
   * @param currentPrice - Current market price
   * @returns Trading signal (LONG, SHORT, CLOSE, or NONE)
   */
  generateSignal(
    symbol: AllowedSymbol,
    candles: Candle[],
    currentPrice: number
  ): TradingSignal;

  /**
   * Minimum number of candles required for signal generation
   */
  getRequiredCandles(): number;
}
