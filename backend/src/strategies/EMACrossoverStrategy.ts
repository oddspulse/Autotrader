import { AllowedSymbol, TradingSignal, Candle, SignalType } from "@autotrader/shared";
import { IStrategy } from "./IStrategy";
import { EMA } from "technicalindicators";
import { logger } from "../utils/logger";

/**
 * EMA Crossover Strategy
 *
 * Generates signals based on exponential moving average crossovers.
 *
 * Rules:
 * - LONG: Fast EMA crosses above Slow EMA (bullish crossover)
 * - SHORT: Fast EMA crosses below Slow EMA (bearish crossover)
 * - CLOSE: Opposite crossover when in position
 * - NONE: No crossover detected
 *
 * Default parameters:
 * - Fast EMA: 9 periods
 * - Slow EMA: 21 periods
 *
 * The strategy tracks previous EMA values to detect crossovers
 * (not just current values above/below).
 */
export class EMACrossoverStrategy implements IStrategy {
  readonly name = "EMA Crossover";

  private fastPeriod: number;
  private slowPeriod: number;
  private previousFastEMA?: number;
  private previousSlowEMA?: number;

  constructor(fastPeriod: number = 9, slowPeriod: number = 21) {
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
  }

  initialize(): void {
    logger.info(`${this.name} strategy initialized`, {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
    });
  }

  generateSignal(
    symbol: AllowedSymbol,
    candles: Candle[],
    currentPrice: number
  ): TradingSignal {
    if (candles.length < this.getRequiredCandles()) {
      return {
        symbol,
        type: SignalType.NONE,
        timestamp: Date.now(),
        price: currentPrice,
        metadata: { reason: "Insufficient candles" },
      };
    }

    // Extract close prices
    const closePrices = candles.map((c) => c.close);

    // Calculate EMAs
    const fastEMA = EMA.calculate({
      period: this.fastPeriod,
      values: closePrices,
    });

    const slowEMA = EMA.calculate({
      period: this.slowPeriod,
      values: closePrices,
    });

    // Get current and previous EMA values
    const currentFastEMA = fastEMA[fastEMA.length - 1];
    const currentSlowEMA = slowEMA[slowEMA.length - 1];

    const prevFastEMA = fastEMA[fastEMA.length - 2];
    const prevSlowEMA = slowEMA[slowEMA.length - 2];

    // Detect crossovers
    let signalType = SignalType.NONE;
    let metadata: Record<string, any> = {
      fastEMA: currentFastEMA,
      slowEMA: currentSlowEMA,
    };

    // Bullish crossover: fast was below, now above
    if (prevFastEMA <= prevSlowEMA && currentFastEMA > currentSlowEMA) {
      signalType = SignalType.LONG;
      metadata.crossover = "bullish";
      logger.info(`${symbol}: Bullish EMA crossover detected`, metadata);
    }
    // Bearish crossover: fast was above, now below
    else if (prevFastEMA >= prevSlowEMA && currentFastEMA < currentSlowEMA) {
      signalType = SignalType.SHORT;
      metadata.crossover = "bearish";
      logger.info(`${symbol}: Bearish EMA crossover detected`, metadata);
    }

    // Store for next iteration
    this.previousFastEMA = currentFastEMA;
    this.previousSlowEMA = currentSlowEMA;

    return {
      symbol,
      type: signalType,
      timestamp: Date.now(),
      price: currentPrice,
      confidence: this.calculateConfidence(currentFastEMA, currentSlowEMA),
      metadata,
    };
  }

  getRequiredCandles(): number {
    // Need at least slow period + 1 for crossover detection
    return this.slowPeriod + 1;
  }

  /**
   * Calculate signal confidence based on EMA separation
   */
  private calculateConfidence(fastEMA: number, slowEMA: number): number {
    const separation = Math.abs(fastEMA - slowEMA);
    const percentSeparation = separation / slowEMA;

    // Higher separation = higher confidence
    // Cap at 1.0 (100%)
    return Math.min(percentSeparation * 100, 1.0);
  }
}
