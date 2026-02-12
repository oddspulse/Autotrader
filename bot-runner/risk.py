"""Risk management: kill switches, position limits, drawdown tracking."""

import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("autotrader.risk")


@dataclass
class RiskState:
    """Current risk state."""
    daily_pnl: float = 0.0
    peak_equity: float = 0.0
    current_equity: float = 0.0
    current_drawdown: float = 0.0
    open_positions: int = 0
    daily_loss_triggered: bool = False
    max_drawdown_triggered: bool = False
    consecutive_failures: int = 0
    circuit_breaker_active: bool = False
    cooldowns: dict = field(default_factory=dict)  # symbol -> datetime
    trading_halted: bool = False
    halt_reason: str = ""


class RiskManager:
    """
    Risk manager with kill switches.

    Enforces:
    - Daily loss limit
    - Max drawdown limit
    - Max concurrent positions
    - Per-pair cooldown after stop-out
    - API failure circuit breaker
    - Time drift guardrail
    - Minimum volume filter
    """

    def __init__(self, config: dict):
        risk = config.get("risk", {})
        self.daily_max_loss_pct = risk.get("daily_max_loss_pct", 0.02)
        self.max_drawdown_pct = risk.get("max_drawdown_pct", 0.08)
        self.max_positions = risk.get("max_positions", 3)
        self.cooldown_minutes = config.get("strategy", {}).get("cooldown_minutes", 30)
        self.max_consecutive_failures = config.get(
            "monitoring", {}
        ).get("max_consecutive_failures", 5)
        self.min_volume_usd = config.get("execution", {}).get("min_volume_usd", 50000)

        self.state = RiskState()
        self._day_start_equity = 0.0
        self._current_day = None

    def update_equity(self, equity: float):
        """Update current equity and check drawdown."""
        self.state.current_equity = equity

        # Track peak equity
        if equity > self.state.peak_equity:
            self.state.peak_equity = equity

        # Calculate drawdown from peak
        if self.state.peak_equity > 0:
            self.state.current_drawdown = (
                (self.state.peak_equity - equity) / self.state.peak_equity
            )

        # Reset daily tracking at day boundary
        today = datetime.now(timezone.utc).date()
        if self._current_day != today:
            self._current_day = today
            self._day_start_equity = equity
            self.state.daily_pnl = 0.0
            self.state.daily_loss_triggered = False
            logger.info(f"New trading day. Start equity: ${equity:.2f}")

        # Update daily PnL
        if self._day_start_equity > 0:
            self.state.daily_pnl = (equity - self._day_start_equity) / self._day_start_equity

    def check_daily_loss(self) -> bool:
        """Check if daily loss limit has been hit."""
        if self.state.daily_pnl <= -self.daily_max_loss_pct:
            if not self.state.daily_loss_triggered:
                self.state.daily_loss_triggered = True
                self.state.trading_halted = True
                self.state.halt_reason = (
                    f"Daily loss limit hit: {self.state.daily_pnl:.2%} "
                    f"(limit: {-self.daily_max_loss_pct:.2%})"
                )
                logger.critical(self.state.halt_reason)
            return True
        return False

    def check_max_drawdown(self) -> bool:
        """Check if max drawdown limit has been hit."""
        if self.state.current_drawdown >= self.max_drawdown_pct:
            if not self.state.max_drawdown_triggered:
                self.state.max_drawdown_triggered = True
                self.state.trading_halted = True
                self.state.halt_reason = (
                    f"Max drawdown hit: {self.state.current_drawdown:.2%} "
                    f"(limit: {self.max_drawdown_pct:.2%})"
                )
                logger.critical(self.state.halt_reason)
            return True
        return False

    def can_open_position(self) -> tuple[bool, str]:
        """Check if we can open a new position."""
        if self.state.trading_halted:
            return False, f"Trading halted: {self.state.halt_reason}"

        if self.state.circuit_breaker_active:
            return False, "Circuit breaker active due to API failures"

        if self.state.open_positions >= self.max_positions:
            return False, (
                f"Max positions reached: {self.state.open_positions}/{self.max_positions}"
            )

        if self.check_daily_loss():
            return False, "Daily loss limit reached"

        if self.check_max_drawdown():
            return False, "Max drawdown limit reached"

        return True, "OK"

    def check_pair_cooldown(self, symbol: str) -> tuple[bool, str]:
        """Check if a pair is in cooldown after stop-out."""
        cooldown_until = self.state.cooldowns.get(symbol)
        if cooldown_until is None:
            return True, "No cooldown"

        now = datetime.now(timezone.utc)
        if now < cooldown_until:
            remaining = (cooldown_until - now).total_seconds() / 60
            return False, f"{symbol} in cooldown for {remaining:.0f} more minutes"

        # Cooldown expired
        del self.state.cooldowns[symbol]
        return True, "Cooldown expired"

    def set_cooldown(self, symbol: str):
        """Set cooldown for a pair after stop-out."""
        until = datetime.now(timezone.utc) + timedelta(minutes=self.cooldown_minutes)
        self.state.cooldowns[symbol] = until
        logger.info(f"Cooldown set for {symbol} until {until.isoformat()}")

    def check_volume(self, volume_usd: float) -> tuple[bool, str]:
        """Check if pair has sufficient volume."""
        if volume_usd < self.min_volume_usd:
            return False, (
                f"Insufficient volume: ${volume_usd:,.0f} "
                f"(min: ${self.min_volume_usd:,.0f})"
            )
        return True, "OK"

    def record_api_failure(self):
        """Record an API failure for circuit breaker."""
        self.state.consecutive_failures += 1
        if self.state.consecutive_failures >= self.max_consecutive_failures:
            self.state.circuit_breaker_active = True
            self.state.trading_halted = True
            self.state.halt_reason = (
                f"Circuit breaker: {self.state.consecutive_failures} "
                f"consecutive API failures"
            )
            logger.critical(self.state.halt_reason)

    def record_api_success(self):
        """Record a successful API call, resetting failure counter."""
        self.state.consecutive_failures = 0
        if self.state.circuit_breaker_active:
            self.state.circuit_breaker_active = False
            logger.info("Circuit breaker reset after successful API call")

    def update_position_count(self, count: int):
        """Update the current number of open positions."""
        self.state.open_positions = count

    def pre_trade_check(self, symbol: str, volume_usd: float = None) -> tuple[bool, str]:
        """
        Full pre-trade risk check.
        Returns (can_trade, reason).
        """
        # Position limit
        can_open, reason = self.can_open_position()
        if not can_open:
            return False, reason

        # Cooldown
        ok, reason = self.check_pair_cooldown(symbol)
        if not ok:
            return False, reason

        # Volume
        if volume_usd is not None:
            ok, reason = self.check_volume(volume_usd)
            if not ok:
                return False, reason

        return True, "All risk checks passed"

    def get_state_dict(self) -> dict:
        """Get risk state as serializable dict."""
        return {
            "daily_pnl": self.state.daily_pnl,
            "peak_equity": self.state.peak_equity,
            "current_equity": self.state.current_equity,
            "current_drawdown": self.state.current_drawdown,
            "open_positions": self.state.open_positions,
            "daily_loss_triggered": self.state.daily_loss_triggered,
            "max_drawdown_triggered": self.state.max_drawdown_triggered,
            "consecutive_failures": self.state.consecutive_failures,
            "circuit_breaker_active": self.state.circuit_breaker_active,
            "trading_halted": self.state.trading_halted,
            "halt_reason": self.state.halt_reason,
            "cooldowns": {
                k: v.isoformat() for k, v in self.state.cooldowns.items()
            },
        }
