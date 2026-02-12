# Runbook

## Daily Operations

### Check Bot Status
```bash
sudo systemctl status autotrader
journalctl -u autotrader --since "1 hour ago" --no-pager | tail -50
```

### View Recent Logs
```bash
journalctl -u autotrader -f  # Live follow
journalctl -u autotrader --since today  # Today's logs
```

### Restart Bot
```bash
sudo systemctl restart autotrader
```

### Stop Bot (graceful)
```bash
sudo systemctl stop autotrader
# Bot will finish current cycle, close cleanly, send Telegram notification
```

## Mode Changes

### Switch to Live Trading
```bash
sudo systemctl edit autotrader
# Add:
# [Service]
# ExecStart=
# ExecStart=/opt/autotrader/bot-runner/venv/bin/python main.py --live

sudo systemctl daemon-reload
sudo systemctl restart autotrader
```

### Switch Back to Paper
```bash
sudo systemctl edit autotrader
# Remove the override, or set:
# [Service]
# ExecStart=
# ExecStart=/opt/autotrader/bot-runner/venv/bin/python main.py

sudo systemctl daemon-reload
sudo systemctl restart autotrader
```

## Troubleshooting

### Bot Not Starting
1. Check logs: `journalctl -u autotrader -n 100 --no-pager`
2. Test manually: `cd /opt/autotrader/bot-runner && source venv/bin/activate && python main.py`
3. Check .env file exists and has correct values
4. Check database connection: `python -c "from storage import Storage; s = Storage(); print('OK' if s.conn else 'FAIL')"`

### No Trades Happening
1. Check if trading is halted (kill switch): look for "Trading halted" in logs
2. Check if all pairs are in cooldown
3. Verify market conditions match strategy (need uptrend + crossover)
4. Check if pair has sufficient volume
5. Verify API key permissions on Kraken

### Database Connection Issues
1. Check Supabase project is active (free tier pauses after inactivity)
2. Verify DATABASE_URL in .env
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`
4. Bot falls back to local JSON if DB is unavailable

### Kill Switch Triggered
1. Check which kill switch: daily loss or max drawdown
2. Daily loss resets at UTC midnight automatically
3. Max drawdown requires manual restart (or equity recovery)
4. To force restart: stop bot, wait, start bot (drawdown tracking resets)

## Configuration Changes

### Edit Trading Pairs
1. Edit `config.yaml` -> `pairs` section
2. Restart bot: `sudo systemctl restart autotrader`

### Adjust Risk Parameters
1. Edit `config.yaml` -> `risk` section
2. Restart bot

### Change Timeframe
1. Edit `config.yaml` -> `timeframe`
2. Restart bot

## Updates

### Deploy New Code
```bash
cd /opt/autotrader
git pull origin main
cd bot-runner
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart autotrader
```

## Monitoring

### Verify Heartbeat
- Dashboard shows green status indicator
- Health API returns `isStale: false`
- Telegram should not report errors

### Check Sustainability
- Dashboard overview shows "Sustainable" or "Building" status
- Telegram sends daily sustainability report at midnight UTC
