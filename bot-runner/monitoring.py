"""Monitoring: Telegram alerts, heartbeat, daily summaries."""

import os
import logging
import threading
import time
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("autotrader.monitoring")

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class TelegramAlert:
    """Send alerts via Telegram bot."""

    def __init__(self, bot_token: str = None, chat_id: str = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID", "")
        self.enabled = bool(self.bot_token and self.chat_id and HAS_REQUESTS)

        if not self.enabled:
            if not HAS_REQUESTS:
                logger.warning("requests not installed, Telegram alerts disabled")
            elif not self.bot_token or not self.chat_id:
                logger.warning("Telegram credentials not set, alerts disabled")
        else:
            logger.info("Telegram alerts enabled")

    def send(self, message: str, parse_mode: str = "HTML"):
        """Send a message via Telegram."""
        if not self.enabled:
            logger.debug(f"Telegram disabled, would send: {message[:100]}")
            return

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        try:
            resp = requests.post(
                url,
                json={
                    "chat_id": self.chat_id,
                    "text": message,
                    "parse_mode": parse_mode,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.error(f"Telegram send failed: {resp.text}")
        except Exception as e:
            logger.error(f"Telegram send error: {e}")

    def send_trade_alert(self, trade: dict):
        """Send alert for a completed trade."""
        pnl = trade.get("pnl", 0)
        symbol = trade.get("symbol", "?")
        side = trade.get("side", "?")
        icon = "🟢" if pnl > 0 else "🔴" if pnl < 0 else "⚪"

        msg = (
            f"{icon} <b>Trade {side.upper()}</b>\n"
            f"Symbol: {symbol}\n"
            f"Qty: {trade.get('qty', 0):.6f}\n"
            f"Entry: ${trade.get('entry_price', 0):,.2f}\n"
            f"Exit: ${trade.get('exit_price', 0):,.2f}\n"
            f"PnL: ${pnl:,.2f} ({trade.get('pnl_pct', 0):.2%})\n"
            f"Fees: ${trade.get('fees', 0):,.4f}\n"
            f"Kelly: {trade.get('kelly_fraction', 0):.2%}"
        )
        self.send(msg)

    def send_kill_switch_alert(self, reason: str):
        """Send critical alert when kill switch triggers."""
        msg = (
            f"🚨 <b>KILL SWITCH ACTIVATED</b> 🚨\n\n"
            f"Reason: {reason}\n"
            f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
            f"Trading has been HALTED. Manual intervention required."
        )
        self.send(msg)

    def send_daily_summary(self, summary: dict):
        """Send daily performance summary."""
        msg = (
            f"📊 <b>Daily Summary</b> ({summary.get('date', 'today')})\n\n"
            f"Equity: ${summary.get('equity', 0):,.2f}\n"
            f"Trades: {summary.get('total_trades', 0)}\n"
            f"Wins: {summary.get('winning_trades', 0)} | "
            f"Losses: {summary.get('losing_trades', 0)}\n"
            f"Win Rate: {summary.get('win_rate', 0):.1%}\n"
            f"Day PnL: ${summary.get('net_pnl', 0):,.2f}\n"
            f"Total Fees: ${summary.get('total_fees', 0):,.4f}"
        )
        self.send(msg)

    def send_sustainability_report(self, report: dict):
        """Send sustainability report."""
        status = "✅ SUSTAINABLE" if report.get("is_sustainable") else "❌ NOT YET SUSTAINABLE"
        msg = (
            f"💰 <b>Sustainability Report</b>\n\n"
            f"Status: {status}\n"
            f"Days Running: {report.get('days_running', 0)}\n"
            f"Total PnL: ${report.get('total_pnl', 0):,.2f}\n"
            f"Total Fees: ${report.get('total_fees', 0):,.2f}\n"
            f"Net After Fees: ${report.get('net_after_fees', 0):,.2f}\n"
            f"Operational Cost: ${report.get('total_operational_cost', 0):,.2f}\n"
            f"Net After All: ${report.get('net_after_all_costs', 0):,.2f}\n"
            f"Projected Monthly: ${report.get('projected_monthly_net', 0):,.2f}"
        )
        self.send(msg)

    def send_error_alert(self, error: str):
        """Send error alert."""
        msg = (
            f"⚠️ <b>Bot Error</b>\n\n"
            f"{error[:500]}\n"
            f"Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
        )
        self.send(msg)

    def send_startup_alert(self, mode: str, pairs: list):
        """Send bot startup notification."""
        msg = (
            f"🤖 <b>Bot Started</b>\n\n"
            f"Mode: {mode}\n"
            f"Pairs: {', '.join(pairs[:6])}\n"
            f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        self.send(msg)


class Heartbeat:
    """Heartbeat monitor to detect bot liveness."""

    def __init__(self, storage, interval: int = 60):
        self.storage = storage
        self.interval = interval
        self._running = False
        self._thread = None
        self._start_time = datetime.now(timezone.utc)

    def start(self, mode: str = "paper"):
        """Start heartbeat in background thread."""
        self._running = True
        self._mode = mode
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info(f"Heartbeat started (interval={self.interval}s)")

    def stop(self):
        """Stop heartbeat."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Heartbeat stopped")

    def _run(self):
        """Heartbeat loop."""
        while self._running:
            try:
                uptime = int((datetime.now(timezone.utc) - self._start_time).total_seconds())
                self.storage.update_bot_status(
                    status="running",
                    mode=self._mode,
                    version="1.0.0",
                    uptime_seconds=uptime,
                )
            except Exception as e:
                logger.error(f"Heartbeat update failed: {e}")
            time.sleep(self.interval)

    def beat(self, status: str = "running", error: str = None):
        """Manual heartbeat update."""
        uptime = int((datetime.now(timezone.utc) - self._start_time).total_seconds())
        self.storage.update_bot_status(
            status=status,
            mode=getattr(self, "_mode", "paper"),
            last_error=error,
            version="1.0.0",
            uptime_seconds=uptime,
        )
