-- Autotrader Database Schema
-- Run this in your Supabase SQL editor to create all required tables

-- Trades table: records every buy and sell
CREATE TABLE IF NOT EXISTS trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exchange TEXT NOT NULL DEFAULT 'kraken',
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    qty DECIMAL NOT NULL,
    entry_price DECIMAL NOT NULL,
    exit_price DECIMAL,
    fees DECIMAL NOT NULL DEFAULT 0,
    pnl DECIMAL,
    pnl_pct DECIMAL,
    kelly_fraction DECIMAL,
    strategy_tag TEXT NOT NULL DEFAULT 'ema_crossover_trend',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equity snapshots: periodic equity recordings
CREATE TABLE IF NOT EXISTS equity_snapshots (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    equity DECIMAL NOT NULL,
    cash DECIMAL NOT NULL,
    unrealized_pnl DECIMAL NOT NULL DEFAULT 0,
    realized_pnl DECIMAL NOT NULL DEFAULT 0,
    total_fees DECIMAL NOT NULL DEFAULT 0,
    net_profit DECIMAL NOT NULL DEFAULT 0
);

-- Bot status: heartbeat and status tracking
CREATE TABLE IF NOT EXISTS bot_status (
    id SERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'stopped',
    mode TEXT NOT NULL DEFAULT 'paper',
    last_heartbeat TIMESTAMPTZ,
    last_error TEXT,
    version TEXT,
    config JSONB DEFAULT '{}',
    uptime_seconds INTEGER DEFAULT 0
);

-- Positions: current open positions
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    qty DECIMAL NOT NULL,
    side TEXT NOT NULL DEFAULT 'long' CHECK (side IN ('long', 'short')),
    avg_entry DECIMAL NOT NULL,
    current_price DECIMAL DEFAULT 0,
    unrealized_pnl DECIMAL DEFAULT 0,
    stop_loss DECIMAL DEFAULT 0,
    trailing_stop DECIMAL DEFAULT 0,
    kelly_fraction DECIMAL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kelly stats: historical Kelly criterion calculations
CREATE TABLE IF NOT EXISTS kelly_stats (
    id SERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol TEXT NOT NULL,
    win_rate DECIMAL NOT NULL,
    avg_win DECIMAL NOT NULL,
    avg_loss DECIMAL NOT NULL,
    kelly_fraction DECIMAL NOT NULL,
    sample_size INTEGER NOT NULL,
    period_days INTEGER NOT NULL DEFAULT 90
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_trades_ts ON trades(ts);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_equity_ts ON equity_snapshots(ts);
CREATE INDEX IF NOT EXISTS idx_kelly_symbol ON kelly_stats(symbol);
CREATE INDEX IF NOT EXISTS idx_kelly_ts ON kelly_stats(ts);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);

-- Enable Row Level Security (optional, for Supabase)
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE equity_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bot_status ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE kelly_stats ENABLE ROW LEVEL SECURITY;

-- Insert initial bot status row
INSERT INTO bot_status (id, status, mode, version)
VALUES (1, 'stopped', 'paper', '1.0.0')
ON CONFLICT (id) DO NOTHING;
