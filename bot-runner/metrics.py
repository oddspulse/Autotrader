"""Metrics calculation: equity curve, win rate, drawdown, sustainability."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger("autotrader.metrics")


class MetricsCalculator:
    """
    Calculates trading performance metrics.

    Metrics:
    - Win rate and win/loss count
    - Average win/loss
    - Max drawdown
    - Sharpe-like ratio
    - Total PnL and fees
    - Sustainability (profit vs costs)
    """

    def __init__(self, config: dict):
        costs = config.get("costs", {})
        self.monthly_vps_cost = costs.get("estimated_monthly_vps_usd", 10.0)
        self.monthly_other_cost = costs.get("estimated_monthly_other_usd", 0.0)
        self.total_monthly_cost = self.monthly_vps_cost + self.monthly_other_cost

    def compute_trade_stats(self, trades: list[dict]) -> dict:
        """Compute statistics from trade history."""
        if not trades:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "win_rate": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "avg_win_pct": 0.0,
                "avg_loss_pct": 0.0,
                "total_pnl": 0.0,
                "total_fees": 0.0,
                "net_pnl": 0.0,
                "best_trade": 0.0,
                "worst_trade": 0.0,
                "avg_hold_time_hours": 0.0,
                "profit_factor": 0.0,
            }

        wins = [t for t in trades if t.get("pnl", 0) > 0]
        losses = [t for t in trades if t.get("pnl", 0) < 0]
        breakeven = [t for t in trades if t.get("pnl", 0) == 0]

        total_pnl = sum(t.get("pnl", 0) for t in trades)
        total_fees = sum(t.get("fees", 0) for t in trades)
        gross_wins = sum(t.get("pnl", 0) for t in wins)
        gross_losses = abs(sum(t.get("pnl", 0) for t in losses))

        avg_hold = 0.0
        hold_times = [t.get("held_seconds", 0) for t in trades if t.get("held_seconds")]
        if hold_times:
            avg_hold = sum(hold_times) / len(hold_times) / 3600.0

        return {
            "total_trades": len(trades),
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "breakeven_trades": len(breakeven),
            "win_rate": len(wins) / len(trades) if trades else 0,
            "avg_win": gross_wins / len(wins) if wins else 0,
            "avg_loss": gross_losses / len(losses) if losses else 0,
            "avg_win_pct": (
                sum(t.get("pnl_pct", 0) for t in wins) / len(wins) if wins else 0
            ),
            "avg_loss_pct": (
                sum(abs(t.get("pnl_pct", 0)) for t in losses) / len(losses)
                if losses else 0
            ),
            "total_pnl": total_pnl,
            "total_fees": total_fees,
            "net_pnl": total_pnl - total_fees,
            "best_trade": max((t.get("pnl", 0) for t in trades), default=0),
            "worst_trade": min((t.get("pnl", 0) for t in trades), default=0),
            "avg_hold_time_hours": avg_hold,
            "profit_factor": gross_wins / gross_losses if gross_losses > 0 else float("inf"),
        }

    def compute_equity_metrics(self, snapshots: list[dict]) -> dict:
        """Compute equity curve metrics."""
        if not snapshots:
            return {
                "current_equity": 0.0,
                "peak_equity": 0.0,
                "max_drawdown": 0.0,
                "max_drawdown_pct": 0.0,
                "current_drawdown_pct": 0.0,
            }

        equities = [s.get("equity", 0) for s in snapshots]
        equities.reverse()  # Oldest first

        peak = equities[0]
        max_dd = 0.0
        max_dd_pct = 0.0

        for eq in equities:
            if eq > peak:
                peak = eq
            dd = peak - eq
            dd_pct = dd / peak if peak > 0 else 0
            if dd_pct > max_dd_pct:
                max_dd = dd
                max_dd_pct = dd_pct

        current = equities[-1] if equities else 0
        current_peak = max(equities) if equities else 0
        current_dd_pct = (current_peak - current) / current_peak if current_peak > 0 else 0

        return {
            "current_equity": current,
            "peak_equity": current_peak,
            "max_drawdown": max_dd,
            "max_drawdown_pct": max_dd_pct,
            "current_drawdown_pct": current_dd_pct,
        }

    def compute_daily_summary(self, trades: list[dict], equity_now: float) -> dict:
        """Compute today's trading summary."""
        today = datetime.now(timezone.utc).date()
        today_trades = []
        for t in trades:
            ts = t.get("ts")
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts)
            if isinstance(ts, datetime) and ts.date() == today:
                today_trades.append(t)

        stats = self.compute_trade_stats(today_trades)
        stats["date"] = today.isoformat()
        stats["equity"] = equity_now
        return stats

    def compute_sustainability(
        self, trades: list[dict], start_date: datetime
    ) -> dict:
        """
        Compute sustainability metrics.

        The bot must pay for its own costs from profits.
        """
        days_running = max(1, (datetime.now(timezone.utc) - start_date).days)
        total_pnl = sum(t.get("pnl", 0) for t in trades)
        total_fees = sum(t.get("fees", 0) for t in trades)
        net_after_fees = total_pnl - total_fees

        total_operational_cost = (self.total_monthly_cost / 30.0) * days_running
        net_after_all = net_after_fees - total_operational_cost

        daily_net = net_after_fees / days_running
        daily_cost = self.total_monthly_cost / 30.0

        return {
            "days_running": days_running,
            "total_pnl": round(total_pnl, 2),
            "total_fees": round(total_fees, 2),
            "net_after_fees": round(net_after_fees, 2),
            "total_operational_cost": round(total_operational_cost, 2),
            "net_after_all_costs": round(net_after_all, 2),
            "is_sustainable": net_after_all > 0,
            "daily_net_profit": round(daily_net, 2),
            "daily_operational_cost": round(daily_cost, 2),
            "monthly_vps_cost": self.monthly_vps_cost,
            "monthly_other_cost": self.monthly_other_cost,
            "projected_monthly_profit": round(daily_net * 30, 2),
            "projected_monthly_net": round((daily_net - daily_cost) * 30, 2),
        }

    def get_full_report(
        self,
        trades: list[dict],
        snapshots: list[dict],
        start_date: datetime,
        equity_now: float,
    ) -> dict:
        """Generate full metrics report."""
        return {
            "trade_stats": self.compute_trade_stats(trades),
            "equity_metrics": self.compute_equity_metrics(snapshots),
            "daily_summary": self.compute_daily_summary(trades, equity_now),
            "sustainability": self.compute_sustainability(trades, start_date),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
