"""
Kelly Criterion position sizing.

Full Kelly: f* = W - (1-W)/R
Where:
  W = historical win rate
  R = average win / average loss ratio
  f* = fraction of capital to allocate

This implements the "profit or not survive" model:
- Full Kelly maximizes geometric growth rate
- But carries significant drawdown risk
- The system must generate profit to cover its own fees and costs, or it dies
"""

import logging
import math
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("autotrader.kelly")


@dataclass
class KellyResult:
    """Kelly criterion calculation result."""
    fraction: float          # Recommended position size as fraction of equity
    win_rate: float          # Historical win rate
    avg_win: float           # Average winning trade return
    avg_loss: float          # Average losing trade return (positive number)
    win_loss_ratio: float    # avg_win / avg_loss
    sample_size: int         # Number of trades used
    edge: float              # Expected return per trade
    is_valid: bool           # Whether we have enough data
    reason: str              # Explanation


class KellyCriterion:
    """
    Full Kelly position sizing calculator.

    The Kelly fraction tells you the optimal fraction of your bankroll
    to bet on each trade to maximize long-term geometric growth.

    f* = p - q/b = p - (1-p)/b

    where:
      p = probability of win
      q = probability of loss = 1-p
      b = odds ratio = avg_win / avg_loss

    For "profit or not survive":
    - We use FULL Kelly (not half or quarter)
    - But cap at max_fraction to prevent single-trade blowup from estimation error
    - Minimum trades required before Kelly activates
    """

    def __init__(self, config: dict):
        risk = config.get("risk", {})
        self.kelly_multiplier = risk.get("kelly_fraction", 1.0)  # 1.0 = full Kelly
        self.min_fraction = risk.get("min_kelly_fraction", 0.01)
        self.max_fraction = risk.get("max_kelly_fraction", 0.25)
        self.min_trades = risk.get("min_trades_for_kelly", 20)
        self.default_fraction = risk.get("default_position_pct", 0.02)

    def calculate(self, trades: list[dict]) -> KellyResult:
        """
        Calculate Kelly fraction from trade history.

        trades: list of dicts with at least {'pnl_pct': float}
        where pnl_pct is the percentage return (e.g., 0.05 for 5% gain)
        """
        if len(trades) < self.min_trades:
            return KellyResult(
                fraction=self.default_fraction,
                win_rate=0.0,
                avg_win=0.0,
                avg_loss=0.0,
                win_loss_ratio=0.0,
                sample_size=len(trades),
                edge=0.0,
                is_valid=False,
                reason=f"Insufficient trades: {len(trades)}/{self.min_trades}. "
                       f"Using default {self.default_fraction:.1%}",
            )

        wins = [t["pnl_pct"] for t in trades if t["pnl_pct"] > 0]
        losses = [abs(t["pnl_pct"]) for t in trades if t["pnl_pct"] < 0]

        if not wins:
            return KellyResult(
                fraction=0.0,
                win_rate=0.0,
                avg_win=0.0,
                avg_loss=0.0,
                win_loss_ratio=0.0,
                sample_size=len(trades),
                edge=0.0,
                is_valid=True,
                reason="No winning trades - Kelly says don't trade",
            )

        if not losses:
            # All wins - use max fraction
            return KellyResult(
                fraction=self.max_fraction,
                win_rate=1.0,
                avg_win=sum(wins) / len(wins),
                avg_loss=0.0,
                win_loss_ratio=float("inf"),
                sample_size=len(trades),
                edge=sum(wins) / len(wins),
                is_valid=True,
                reason="All trades winning - using max fraction",
            )

        win_rate = len(wins) / len(trades)
        avg_win = sum(wins) / len(wins)
        avg_loss = sum(losses) / len(losses)
        win_loss_ratio = avg_win / avg_loss if avg_loss > 0 else float("inf")

        # Kelly formula: f* = W - (1-W)/R
        kelly_raw = win_rate - ((1 - win_rate) / win_loss_ratio)

        # Apply Kelly multiplier (1.0 for full Kelly)
        kelly_adjusted = kelly_raw * self.kelly_multiplier

        # Expected edge per trade
        edge = (win_rate * avg_win) - ((1 - win_rate) * avg_loss)

        if kelly_adjusted <= 0:
            return KellyResult(
                fraction=0.0,
                win_rate=win_rate,
                avg_win=avg_win,
                avg_loss=avg_loss,
                win_loss_ratio=win_loss_ratio,
                sample_size=len(trades),
                edge=edge,
                is_valid=True,
                reason=f"Negative edge: Kelly={kelly_raw:.4f}. Do not trade.",
            )

        # Clamp to min/max bounds
        fraction = max(self.min_fraction, min(self.max_fraction, kelly_adjusted))

        return KellyResult(
            fraction=fraction,
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            win_loss_ratio=win_loss_ratio,
            sample_size=len(trades),
            edge=edge,
            is_valid=True,
            reason=(
                f"Kelly={kelly_raw:.4f}, adjusted={kelly_adjusted:.4f}, "
                f"clamped={fraction:.4f}. "
                f"W={win_rate:.2%}, R={win_loss_ratio:.2f}, edge={edge:.4f}"
            ),
        )

    def calculate_for_symbol(
        self, all_trades: list[dict], symbol: str
    ) -> KellyResult:
        """Calculate Kelly for a specific symbol."""
        symbol_trades = [t for t in all_trades if t.get("symbol") == symbol]
        if len(symbol_trades) < self.min_trades:
            # Fall back to overall Kelly if not enough symbol-specific data
            return self.calculate(all_trades)
        return self.calculate(symbol_trades)

    def sustainability_check(
        self,
        trades: list[dict],
        total_fees: float,
        monthly_costs: float,
        days_running: int,
    ) -> dict:
        """
        Check if the system is self-sustaining.

        The "profit or not survive" model: the bot must generate
        enough profit to cover all its costs, or it should stop.
        """
        total_pnl = sum(t.get("pnl", 0) for t in trades)
        net_after_fees = total_pnl - total_fees

        daily_cost = monthly_costs / 30.0
        total_operational_cost = daily_cost * max(days_running, 1)
        net_after_all_costs = net_after_fees - total_operational_cost

        daily_profit = net_after_fees / max(days_running, 1)
        is_sustainable = net_after_all_costs > 0
        months_to_breakeven = None

        if daily_profit > daily_cost and daily_profit > 0:
            if net_after_all_costs < 0:
                days_to_breakeven = abs(net_after_all_costs) / (daily_profit - daily_cost)
                months_to_breakeven = days_to_breakeven / 30.0

        return {
            "total_pnl": total_pnl,
            "total_fees": total_fees,
            "net_after_fees": net_after_fees,
            "monthly_costs": monthly_costs,
            "total_operational_cost": total_operational_cost,
            "net_after_all_costs": net_after_all_costs,
            "daily_profit_avg": daily_profit,
            "daily_cost": daily_cost,
            "is_sustainable": is_sustainable,
            "months_to_breakeven": months_to_breakeven,
            "days_running": days_running,
        }
