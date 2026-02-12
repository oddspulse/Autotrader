"""Backtesting engine: run strategy on historical data."""

import logging
import json
from datetime import datetime, timezone
from typing import Optional
from strategy import EMACrossoverStrategy, Signal
from kelly import KellyCriterion
from metrics import MetricsCalculator

logger = logging.getLogger("autotrader.backtest")


class BacktestEngine:
    """
    Backtesting engine for the EMA crossover strategy.

    Simulates trading on historical OHLCV data with:
    - Kelly criterion position sizing
    - Stop loss and trailing stop execution
    - Fee simulation
    - Full metrics output
    """

    def __init__(self, config: dict, initial_capital: float = 10000.0):
        self.config = config
        self.initial_capital = initial_capital
        self.strategy = EMACrossoverStrategy(config)
        self.kelly = KellyCriterion(config)
        self.metrics = MetricsCalculator(config)

        risk = config.get("risk", {})
        self.max_positions = risk.get("max_positions", 3)
        self.daily_max_loss_pct = risk.get("daily_max_loss_pct", 0.02)
        self.max_drawdown_pct = risk.get("max_drawdown_pct", 0.08)
        self.taker_fee = 0.0026  # Kraken taker fee

        strat = config.get("strategy", {})
        self.stop_atr_mult = strat.get("stop_atr_mult", 1.5)
        self.trail_atr_mult = strat.get("trail_atr_mult", 2.5)
        self.cooldown_bars = strat.get("cooldown_minutes", 30) // 15  # Convert to bars

    def run(self, symbol: str, candles: list) -> dict:
        """
        Run backtest on historical candles.

        candles: list of [timestamp, open, high, low, close, volume]
        Returns: dict with trades, equity_curve, and metrics
        """
        logger.info(f"Starting backtest for {symbol} with {len(candles)} candles")

        cash = self.initial_capital
        position_qty = 0.0
        position_entry = 0.0
        position_stop = 0.0
        position_trail = 0.0
        position_high = 0.0
        position_kelly = 0.0

        trades = []
        equity_curve = []
        cooldown_until = 0
        peak_equity = self.initial_capital

        # Need enough candles for 200 EMA
        min_bars = self.strategy.ema_trend_period + 10
        if len(candles) < min_bars:
            logger.warning(f"Not enough candles: {len(candles)} < {min_bars}")
            return {"trades": [], "equity_curve": [], "metrics": {}}

        for i in range(min_bars, len(candles)):
            window = candles[:i + 1]
            bar = candles[i]
            ts, o, h, l, c, v = bar
            current_price = c

            # Calculate equity
            equity = cash
            if position_qty > 0:
                equity += position_qty * current_price

            equity_curve.append({
                "ts": ts,
                "equity": equity,
                "cash": cash,
                "unrealized_pnl": (current_price - position_entry) * position_qty if position_qty > 0 else 0,
            })

            # Track peak and drawdown
            if equity > peak_equity:
                peak_equity = equity
            drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0

            # Max drawdown kill switch
            if drawdown >= self.max_drawdown_pct:
                if position_qty > 0:
                    fee = position_qty * current_price * self.taker_fee
                    pnl = (current_price - position_entry) * position_qty - fee
                    cash += position_qty * current_price - fee
                    trades.append({
                        "symbol": symbol,
                        "side": "sell",
                        "qty": position_qty,
                        "entry_price": position_entry,
                        "exit_price": current_price,
                        "pnl": pnl,
                        "pnl_pct": (current_price - position_entry) / position_entry,
                        "fees": fee,
                        "kelly_fraction": position_kelly,
                        "reason": "max_drawdown_stop",
                        "ts": ts,
                    })
                    position_qty = 0
                break

            # Check stops if in position
            if position_qty > 0:
                # Update highest price
                if h > position_high:
                    position_high = h
                    # Update trailing stop
                    new_trail = self.strategy.get_trailing_stop(position_high, position_stop)
                    if new_trail > position_trail:
                        position_trail = new_trail

                # Check stop loss (use low of bar)
                effective_stop = max(position_stop, position_trail) if position_trail > 0 else position_stop
                if l <= effective_stop:
                    exit_price = effective_stop  # Assume fill at stop
                    fee = position_qty * exit_price * self.taker_fee
                    pnl = (exit_price - position_entry) * position_qty - fee
                    cash += position_qty * exit_price - fee
                    trades.append({
                        "symbol": symbol,
                        "side": "sell",
                        "qty": position_qty,
                        "entry_price": position_entry,
                        "exit_price": exit_price,
                        "pnl": pnl,
                        "pnl_pct": (exit_price - position_entry) / position_entry,
                        "fees": fee,
                        "kelly_fraction": position_kelly,
                        "reason": "stop_loss",
                        "ts": ts,
                    })
                    position_qty = 0
                    cooldown_until = i + self.cooldown_bars
                    continue

            # Generate signal
            has_pos = position_qty > 0
            signal = self.strategy.generate_signal(symbol, window, has_pos)

            # Entry
            if signal.direction == "buy" and position_qty == 0 and i >= cooldown_until:
                # Kelly sizing
                kelly_result = self.kelly.calculate(trades)
                fraction = kelly_result.fraction
                position_kelly = fraction

                # Calculate position size
                position_value = cash * fraction
                position_qty = position_value / current_price
                position_entry = current_price
                position_stop = signal.stop_loss
                position_trail = 0.0
                position_high = current_price

                fee = position_value * self.taker_fee
                cash -= position_value + fee

                trades.append({
                    "symbol": symbol,
                    "side": "buy",
                    "qty": position_qty,
                    "entry_price": position_entry,
                    "exit_price": None,
                    "pnl": None,
                    "pnl_pct": None,
                    "fees": fee,
                    "kelly_fraction": position_kelly,
                    "reason": signal.reason,
                    "ts": ts,
                    "status": "open",
                })

            # Exit signal
            elif signal.direction == "sell" and position_qty > 0:
                fee = position_qty * current_price * self.taker_fee
                pnl = (current_price - position_entry) * position_qty - fee
                cash += position_qty * current_price - fee
                trades.append({
                    "symbol": symbol,
                    "side": "sell",
                    "qty": position_qty,
                    "entry_price": position_entry,
                    "exit_price": current_price,
                    "pnl": pnl,
                    "pnl_pct": (current_price - position_entry) / position_entry,
                    "fees": fee,
                    "kelly_fraction": position_kelly,
                    "reason": signal.reason,
                    "ts": ts,
                })
                position_qty = 0

        # Close any remaining position at last price
        if position_qty > 0:
            last_price = candles[-1][4]
            fee = position_qty * last_price * self.taker_fee
            pnl = (last_price - position_entry) * position_qty - fee
            cash += position_qty * last_price - fee
            trades.append({
                "symbol": symbol,
                "side": "sell",
                "qty": position_qty,
                "entry_price": position_entry,
                "exit_price": last_price,
                "pnl": pnl,
                "pnl_pct": (last_price - position_entry) / position_entry,
                "fees": fee,
                "kelly_fraction": position_kelly,
                "reason": "backtest_end",
                "ts": candles[-1][0],
            })

        # Filter to completed round trips for metrics
        closed_trades = [t for t in trades if t.get("side") == "sell" and t.get("pnl") is not None]

        final_equity = equity_curve[-1]["equity"] if equity_curve else self.initial_capital
        trade_stats = self.metrics.compute_trade_stats(closed_trades)

        result = {
            "symbol": symbol,
            "initial_capital": self.initial_capital,
            "final_equity": final_equity,
            "total_return": (final_equity - self.initial_capital) / self.initial_capital,
            "trades": trades,
            "closed_trades": len(closed_trades),
            "equity_curve": equity_curve,
            "trade_stats": trade_stats,
            "candles_processed": len(candles) - min_bars,
        }

        logger.info(
            f"Backtest complete for {symbol}: "
            f"return={result['total_return']:.2%}, "
            f"trades={len(closed_trades)}, "
            f"win_rate={trade_stats.get('win_rate', 0):.1%}"
        )

        return result

    def run_multi(self, candles_by_symbol: dict[str, list]) -> dict:
        """Run backtest across multiple symbols."""
        results = {}
        for symbol, candles in candles_by_symbol.items():
            results[symbol] = self.run(symbol, candles)

        # Aggregate stats
        all_closed = []
        for r in results.values():
            all_closed.extend(
                t for t in r["trades"]
                if t.get("side") == "sell" and t.get("pnl") is not None
            )

        total_stats = self.metrics.compute_trade_stats(all_closed)

        return {
            "per_symbol": results,
            "aggregate": total_stats,
            "symbols_tested": list(candles_by_symbol.keys()),
        }

    def save_results(self, results: dict, filepath: str = "backtest_results.json"):
        """Save backtest results to JSON."""
        with open(filepath, "w") as f:
            json.dump(results, f, indent=2, default=str)
        logger.info(f"Backtest results saved to {filepath}")
