"""Trading strategy: EMA crossover with trend filter and volatility guard."""

import logging
import numpy as np
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("autotrader.strategy")


@dataclass
class Signal:
    """Trading signal output."""
    symbol: str
    direction: str  # "buy" or "sell" or "none"
    strength: float  # 0.0 to 1.0
    entry_price: float
    stop_loss: float
    atr: float
    reason: str


def ema(data: np.ndarray, period: int) -> np.ndarray:
    """Calculate Exponential Moving Average."""
    alpha = 2.0 / (period + 1)
    result = np.zeros_like(data, dtype=float)
    result[0] = data[0]
    for i in range(1, len(data)):
        result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
    return result


def atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int) -> np.ndarray:
    """Calculate Average True Range."""
    n = len(closes)
    tr = np.zeros(n)
    tr[0] = highs[0] - lows[0]
    for i in range(1, n):
        tr[i] = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
    return ema(tr, period)


def ema_slope(ema_values: np.ndarray, lookback: int = 5) -> float:
    """Calculate slope of EMA over lookback period."""
    if len(ema_values) < lookback + 1:
        return 0.0
    return (ema_values[-1] - ema_values[-lookback - 1]) / lookback


class EMACrossoverStrategy:
    """
    EMA Crossover with Trend Filter strategy.

    Entry conditions (long):
    - Price above 200 EMA (uptrend)
    - 200 EMA slope positive
    - 20 EMA crosses above 50 EMA
    - ATR% below max threshold (volatility filter)

    Exit conditions:
    - 20 EMA crosses below 50 EMA
    - Stop loss hit (1.5 * ATR below entry)
    - Trailing stop (2.5 * ATR below highest price since entry)

    For spot trading, we only go long (buy) and sell to exit.
    """

    def __init__(self, config: dict):
        strat = config.get("strategy", {})
        self.ema_fast_period = strat.get("ema_fast", 20)
        self.ema_slow_period = strat.get("ema_slow", 50)
        self.ema_trend_period = strat.get("ema_trend", 200)
        self.atr_period = strat.get("atr_period", 14)
        self.atr_max_pct = strat.get("atr_max_pct", 0.08)
        self.stop_atr_mult = strat.get("stop_atr_mult", 1.5)
        self.trail_atr_mult = strat.get("trail_atr_mult", 2.5)

        # Track previous state for crossover detection
        self._prev_fast_above_slow = {}

    def compute_indicators(self, candles: list) -> dict:
        """
        Compute all indicators from OHLCV candles.

        candles: list of [timestamp, open, high, low, close, volume]
        """
        if len(candles) < self.ema_trend_period + 10:
            return None

        closes = np.array([c[4] for c in candles], dtype=float)
        highs = np.array([c[2] for c in candles], dtype=float)
        lows = np.array([c[3] for c in candles], dtype=float)
        volumes = np.array([c[5] for c in candles], dtype=float)

        ema_fast = ema(closes, self.ema_fast_period)
        ema_slow = ema(closes, self.ema_slow_period)
        ema_trend = ema(closes, self.ema_trend_period)
        atr_values = atr(highs, lows, closes, self.atr_period)

        current_price = closes[-1]
        atr_pct = atr_values[-1] / current_price if current_price > 0 else 0

        return {
            "closes": closes,
            "highs": highs,
            "lows": lows,
            "volumes": volumes,
            "ema_fast": ema_fast,
            "ema_slow": ema_slow,
            "ema_trend": ema_trend,
            "atr": atr_values,
            "current_price": current_price,
            "atr_pct": atr_pct,
            "trend_slope": ema_slope(ema_trend),
        }

    def generate_signal(
        self, symbol: str, candles: list, has_position: bool
    ) -> Signal:
        """
        Generate trading signal for a symbol.

        Returns Signal with direction 'buy', 'sell', or 'none'.
        For spot-only: 'buy' means open long, 'sell' means close long.
        """
        indicators = self.compute_indicators(candles)
        if indicators is None:
            return Signal(
                symbol=symbol,
                direction="none",
                strength=0.0,
                entry_price=0.0,
                stop_loss=0.0,
                atr=0.0,
                reason="Insufficient data for indicators",
            )

        price = indicators["current_price"]
        ema_f = indicators["ema_fast"]
        ema_s = indicators["ema_slow"]
        ema_t = indicators["ema_trend"]
        atr_val = indicators["atr"][-1]
        atr_pct = indicators["atr_pct"]
        trend_slope = indicators["trend_slope"]

        fast_above_slow = ema_f[-1] > ema_s[-1]
        prev_fast_above = self._prev_fast_above_slow.get(symbol)
        self._prev_fast_above_slow[symbol] = fast_above_slow

        # If we have a position, check for exit signal
        if has_position:
            if prev_fast_above is not None and prev_fast_above and not fast_above_slow:
                return Signal(
                    symbol=symbol,
                    direction="sell",
                    strength=0.8,
                    entry_price=price,
                    stop_loss=0.0,
                    atr=atr_val,
                    reason="EMA crossover sell: fast crossed below slow",
                )
            return Signal(
                symbol=symbol,
                direction="none",
                strength=0.0,
                entry_price=price,
                stop_loss=0.0,
                atr=atr_val,
                reason="Holding position, no exit signal",
            )

        # No position - check for entry signal

        # Volatility filter
        if atr_pct > self.atr_max_pct:
            return Signal(
                symbol=symbol,
                direction="none",
                strength=0.0,
                entry_price=price,
                stop_loss=0.0,
                atr=atr_val,
                reason=f"Volatility too high: ATR%={atr_pct:.4f} > {self.atr_max_pct}",
            )

        # Trend filter: price above 200 EMA and slope positive
        price_above_trend = price > ema_t[-1]
        trend_up = trend_slope > 0

        if not price_above_trend or not trend_up:
            return Signal(
                symbol=symbol,
                direction="none",
                strength=0.0,
                entry_price=price,
                stop_loss=0.0,
                atr=atr_val,
                reason=f"No uptrend: above_ema200={price_above_trend}, slope_up={trend_up}",
            )

        # Crossover detection: fast EMA just crossed above slow EMA
        if prev_fast_above is not None and not prev_fast_above and fast_above_slow:
            stop_loss = price - (self.stop_atr_mult * atr_val)
            strength = min(1.0, trend_slope * 100)  # Normalize slope to strength

            return Signal(
                symbol=symbol,
                direction="buy",
                strength=max(0.1, strength),
                entry_price=price,
                stop_loss=stop_loss,
                atr=atr_val,
                reason=(
                    f"BUY signal: EMA{self.ema_fast_period} crossed above "
                    f"EMA{self.ema_slow_period}, trend UP, ATR%={atr_pct:.4f}"
                ),
            )

        return Signal(
            symbol=symbol,
            direction="none",
            strength=0.0,
            entry_price=price,
            stop_loss=0.0,
            atr=atr_val,
            reason="No crossover detected",
        )

    def get_trailing_stop(self, highest_since_entry: float, atr_val: float) -> float:
        """Calculate trailing stop level."""
        return highest_since_entry - (self.trail_atr_mult * atr_val)

    def reset(self):
        """Reset internal state."""
        self._prev_fast_above_slow.clear()
