"""Utility functions for the trading bot."""

import logging
import sys
import time
import yaml
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure structured logging."""
    logger = logging.getLogger("autotrader")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

        file_handler = logging.FileHandler("autotrader.log")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


def load_config(path: str = None) -> dict:
    """Load configuration from YAML file."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(path, "r") as f:
        return yaml.safe_load(f)


def now_utc() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def ts_to_iso(dt: datetime) -> str:
    """Convert datetime to ISO string."""
    return dt.isoformat()


def iso_to_ts(s: str) -> datetime:
    """Convert ISO string to datetime."""
    return datetime.fromisoformat(s)


def round_price(price: float, precision: int = 8) -> float:
    """Round price to given precision."""
    return round(price, precision)


def round_qty(qty: float, precision: int = 8) -> float:
    """Round quantity to given precision."""
    return round(qty, precision)


def pct_change(old: float, new: float) -> float:
    """Calculate percentage change."""
    if old == 0:
        return 0.0
    return (new - old) / old


def sleep_until_next_candle(timeframe: str) -> float:
    """Calculate seconds to sleep until next candle close."""
    tf_minutes = {
        "1m": 1, "5m": 5, "15m": 15, "30m": 30,
        "1h": 60, "4h": 240, "1d": 1440,
    }
    minutes = tf_minutes.get(timeframe, 15)
    now = datetime.now(timezone.utc)
    current_minutes = now.hour * 60 + now.minute
    next_boundary = ((current_minutes // minutes) + 1) * minutes
    next_time = now.replace(
        hour=(next_boundary // 60) % 24,
        minute=next_boundary % 60,
        second=5,
        microsecond=0,
    )
    if next_time <= now:
        next_time = next_time.replace(hour=(next_time.hour + (minutes // 60)) % 24)

    wait = (next_time - now).total_seconds()
    if wait < 0:
        wait += minutes * 60
    return wait


def retry_with_backoff(func, max_retries: int = 3, base_delay: float = 2.0):
    """Execute function with exponential backoff retry."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logging.getLogger("autotrader").warning(
                    f"Retry {attempt + 1}/{max_retries} after error: {e}. "
                    f"Waiting {delay}s"
                )
                time.sleep(delay)
    raise last_error


def validate_config(config: dict) -> list[str]:
    """Validate configuration and return list of errors."""
    errors = []

    if not config.get("pairs"):
        errors.append("No trading pairs configured")

    risk = config.get("risk", {})
    if risk.get("kelly_fraction", 0) <= 0:
        errors.append("Kelly fraction must be positive")
    if risk.get("max_positions", 0) <= 0:
        errors.append("Max positions must be positive")
    if risk.get("daily_max_loss_pct", 0) <= 0:
        errors.append("Daily max loss must be positive")
    if risk.get("max_drawdown_pct", 0) <= 0:
        errors.append("Max drawdown must be positive")

    strategy = config.get("strategy", {})
    if strategy.get("ema_fast", 0) >= strategy.get("ema_slow", 999):
        errors.append("EMA fast period must be less than slow period")

    return errors
