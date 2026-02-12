# Complete Setup Guide

## 1. Kraken API Keys

1. Go to https://www.kraken.com/u/security/api
2. Create a new API key with these permissions:
   - **Query Funds** (read balance)
   - **Query Open Orders & Trades** (read orders)
   - **Query Closed Orders & Trades** (read history)
   - **Create & Modify Orders** (place trades)
   - **Cancel/Close Orders** (cancel orders)
3. **DO NOT** enable: Withdraw Funds, Deposit Funds, or any margin/futures permissions
4. Set IP whitelist to your VPS IP address (highly recommended)
5. Save the API Key and Private Key securely

## 2. Supabase Database

1. Create a free account at https://supabase.com
2. Create a new project (choose a region close to your VPS)
3. Go to **SQL Editor** and paste the contents of `schema.sql`, then run it
4. Go to **Settings > API** and note:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public key** (for the dashboard)
   - **service_role key** (for the dashboard server-side)
5. Go to **Settings > Database** and note:
   - **Connection string** (for the bot runner)
   - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

## 3. Telegram Bot

1. Open Telegram, search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Save the **bot token** (looks like `123456:ABC-DEF...`)
4. Send a message to your new bot
5. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
6. Find your **chat_id** in the response
7. Test: `curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Hello"`

## 4. Bot Runner (VPS Setup)

### Choose a VPS

Recommended: DigitalOcean $6/mo droplet or Hetzner CX22 (~$4/mo)
- Ubuntu 22.04 or 24.04
- 1 CPU, 1GB RAM is sufficient
- Choose a region close to EU (Kraken's servers)

### Install on VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Python 3.11+
apt install -y python3 python3-pip python3-venv git

# Clone the repo
git clone https://github.com/YOUR_USERNAME/Autotrader.git /opt/autotrader
cd /opt/autotrader/bot-runner

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
nano .env
# Fill in: KRAKEN_API_KEY, KRAKEN_API_SECRET, DATABASE_URL,
#          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

### Test Paper Trading

```bash
cd /opt/autotrader/bot-runner
source venv/bin/activate
python main.py
# Should start paper trading, check Telegram for startup message
# Ctrl+C to stop
```

### Run Backtest First

```bash
python main.py --backtest
# Review results in backtest_results.json
```

### Create systemd Service

```bash
sudo cat > /etc/systemd/system/autotrader.service << 'EOF'
[Unit]
Description=Autotrader Crypto Trading Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/autotrader/bot-runner
Environment=PATH=/opt/autotrader/bot-runner/venv/bin:/usr/bin
ExecStart=/opt/autotrader/bot-runner/venv/bin/python main.py
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable autotrader
sudo systemctl start autotrader

# Check status
sudo systemctl status autotrader

# View logs
journalctl -u autotrader -f
```

### Switch to Live Trading

1. Edit the service to add `--live` flag:
```bash
sudo systemctl edit autotrader
# Add:
# [Service]
# ExecStart=
# ExecStart=/opt/autotrader/bot-runner/venv/bin/python main.py --live
```
2. Restart: `sudo systemctl restart autotrader`

## 5. Dashboard (Vercel)

### Deploy to Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com and import the repo
3. Set **Root Directory** to `dashboard`
4. Set **Framework Preset** to `Next.js`
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key
   - `DASHBOARD_PASSWORD` = a strong password for the dashboard
6. Deploy

### Access

Visit your Vercel URL, enter the dashboard password, and you'll see:
- Bot status (running/halted/stopped)
- Equity curve chart
- Drawdown chart
- Win/loss stats
- Trade history
- Open positions
- Kelly criterion stats
- Sustainability metrics

## 6. Go-Live Checklist

- [ ] Kraken API key created with correct permissions + IP whitelist
- [ ] Supabase database created and schema applied
- [ ] Telegram bot set up and tested
- [ ] Bot runner deployed on VPS
- [ ] Paper trading tested for at least 1 week
- [ ] Backtest results reviewed
- [ ] Dashboard deployed on Vercel and verified
- [ ] VPS firewall configured (allow SSH only)
- [ ] .env file secured (chmod 600)
- [ ] systemd service enabled with auto-restart

## 7. Panic Checklist

If something goes wrong:

1. **Stop the bot immediately**:
   ```bash
   ssh root@your-vps-ip
   sudo systemctl stop autotrader
   ```

2. **Check Kraken directly**: Log into Kraken web interface, check open orders, cancel if needed

3. **Check logs**:
   ```bash
   journalctl -u autotrader --since "1 hour ago"
   ```

4. **Check dashboard**: View recent trades and positions

5. **If API key compromised**:
   - Immediately delete the API key on Kraken
   - Change Supabase passwords
   - Rotate all credentials

6. **Contact Kraken support** if unauthorized trades occurred
