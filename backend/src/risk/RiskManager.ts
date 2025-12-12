import { BotConfig, RiskState, EquitySnapshot, Trade } from "@autotrader/shared";
import { logger } from "../utils/logger";
import Decimal from "decimal.js";

/**
 * Risk management system
 *
 * Enforces:
 * 1. Daily loss cap (default 3% of equity)
 * 2. Consecutive loss limit (default 3 losses -> 6 hour cooldown)
 * 3. Slippage limit (default 0.3%)
 *
 * All checks are enforced BEFORE allowing trades.
 */
export class RiskManager {
  private config: BotConfig;
  private dailyStartEquity: number;
  private dailyPnl: number;
  private consecutiveLosses: number;
  private lastLossTime?: number;
  private cooldownUntil?: number;
  private lastDayReset: number;

  constructor(config: BotConfig, initialEquity: number) {
    this.config = config;
    this.dailyStartEquity = initialEquity;
    this.dailyPnl = 0;
    this.consecutiveLosses = 0;
    this.lastDayReset = this.getUtcDayStart();

    logger.info("Risk manager initialized", {
      dailyLossCapPct: config.dailyLossCapPct,
      maxConsecutiveLosses: config.maxConsecutiveLosses,
      maxSlippagePct: config.maxSlippagePct,
    });
  }

  /**
   * Check if trading is allowed based on risk rules
   */
  canTrade(): { allowed: boolean; reason?: string } {
    // Check cooldown
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      const remainingMinutes = Math.ceil((this.cooldownUntil - Date.now()) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active: ${remainingMinutes} minutes remaining`,
      };
    }

    // Check daily loss cap
    const dailyLossPct = Math.abs(this.dailyPnl / this.dailyStartEquity);
    if (this.dailyPnl < 0 && dailyLossPct >= this.config.dailyLossCapPct) {
      return {
        allowed: false,
        reason: `Daily loss cap hit: -${(dailyLossPct * 100).toFixed(2)}%`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate slippage before executing trade
   */
  validateSlippage(estimatedSlippage: number): { valid: boolean; reason?: string } {
    if (estimatedSlippage > this.config.maxSlippagePct) {
      return {
        valid: false,
        reason: `Slippage too high: ${(estimatedSlippage * 100).toFixed(3)}% > ${(this.config.maxSlippagePct * 100).toFixed(3)}%`,
      };
    }
    return { valid: true };
  }

  /**
   * Record a trade result for consecutive loss tracking
   */
  recordTrade(pnl: number, fee: number): void {
    const netPnl = pnl - fee;

    // Update daily PnL
    this.dailyPnl += netPnl;

    // Track consecutive losses
    if (netPnl < 0) {
      this.consecutiveLosses++;
      this.lastLossTime = Date.now();

      logger.warn(`Trade loss recorded: ${netPnl.toFixed(2)} (consecutive: ${this.consecutiveLosses})`);

      // Check if cooldown should be triggered
      if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        const cooldownMs = this.config.consecutiveLossCooldownHours * 60 * 60 * 1000;
        this.cooldownUntil = Date.now() + cooldownMs;

        logger.warn(
          `Consecutive loss limit hit (${this.consecutiveLosses}). ` +
          `Cooldown for ${this.config.consecutiveLossCooldownHours} hours.`
        );
      }
    } else {
      // Reset consecutive losses on win
      if (this.consecutiveLosses > 0) {
        logger.info(`Win streak! Resetting consecutive losses from ${this.consecutiveLosses}`);
      }
      this.consecutiveLosses = 0;
      this.lastLossTime = undefined;
    }
  }

  /**
   * Update equity snapshot (called periodically)
   */
  updateEquity(equity: EquitySnapshot): void {
    // Check if we need to reset for new day
    const currentDayStart = this.getUtcDayStart();
    if (currentDayStart > this.lastDayReset) {
      this.resetDailyStats(equity.totalEquity);
    }

    // Update daily PnL from equity change
    this.dailyPnl = equity.totalEquity - this.dailyStartEquity;
  }

  /**
   * Get current risk state
   */
  getState(): RiskState {
    const dailyPnlPct = this.dailyPnl / this.dailyStartEquity;
    const isDailyLossCapHit = this.dailyPnl < 0 && Math.abs(dailyPnlPct) >= this.config.dailyLossCapPct;
    const isConsecutiveLossLimitHit = this.consecutiveLosses >= this.config.maxConsecutiveLosses;
    const isInCooldown = this.cooldownUntil ? Date.now() < this.cooldownUntil : false;

    const { allowed, reason } = this.canTrade();

    return {
      dailyPnl: this.dailyPnl,
      dailyPnlPct,
      consecutiveLosses: this.consecutiveLosses,
      lastLossTime: this.lastLossTime,
      cooldownUntil: this.cooldownUntil,
      isDailyLossCapHit,
      isConsecutiveLossLimitHit,
      canTrade: allowed,
      reason,
    };
  }

  /**
   * Force reset (for testing or manual intervention)
   */
  forceReset(currentEquity: number): void {
    this.dailyStartEquity = currentEquity;
    this.dailyPnl = 0;
    this.consecutiveLosses = 0;
    this.lastLossTime = undefined;
    this.cooldownUntil = undefined;
    this.lastDayReset = this.getUtcDayStart();

    logger.info("Risk manager force reset", { currentEquity });
  }

  /**
   * Clear cooldown (manual override)
   */
  clearCooldown(): void {
    this.cooldownUntil = undefined;
    logger.info("Cooldown cleared manually");
  }

  private resetDailyStats(currentEquity: number): void {
    const previousDayPnl = this.dailyPnl;
    const previousDayPnlPct = (previousDayPnl / this.dailyStartEquity) * 100;

    this.dailyStartEquity = currentEquity;
    this.dailyPnl = 0;
    this.lastDayReset = this.getUtcDayStart();

    logger.info(
      `Daily stats reset. Previous day PnL: ${previousDayPnl.toFixed(2)} (${previousDayPnlPct.toFixed(2)}%)`
    );
  }

  private getUtcDayStart(): number {
    const now = new Date();
    const utcDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return utcDate;
  }
}
