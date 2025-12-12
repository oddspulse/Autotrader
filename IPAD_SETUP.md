# iPad Setup Guide

Complete guide to run the Solana Perps Auto-Trader on your iPad.

---

## Prerequisites

- **Computer** (Mac, Windows, or Linux) on same WiFi as iPad
- **iPad** with Safari browser
- **Phantom Wallet** installed on iPad
- **Same WiFi network** for both devices

---

## Step 1: Install Dependencies (Computer)

Open Terminal on your computer and navigate to the project:

```bash
cd Autotrader
npm run install:all
```

This installs all dependencies for backend, frontend, and shared packages.

---

## Step 2: Build Shared Package (Computer)

```bash
npm run build --workspace=shared
```

---

## Step 3: Configure Environment (Computer)

```bash
cp .env.example .env
```

The `.env` file is already configured for iPad access with:
- `HOST=0.0.0.0` (listens on all network interfaces)
- `PAPER_TRADING=true` (safe mode)

---

## Step 4: Find Your Computer's IP Address (Computer)

Run the helper script:

```bash
node get-ip.js
```

You'll see output like:

```
🌐 Local IP Address(es) for iPad Access:

══════════════════════════════════════════════════

1. en0
   IP: 192.168.1.100
   Backend URL: http://192.168.1.100:3001
   Frontend URL: http://192.168.1.100:3000

══════════════════════════════════════════════════

📱 On your iPad:
   1. Make sure iPad is on the SAME WiFi network
   2. Open Safari and go to: http://192.168.1.100:3000
   3. Connect your Phantom wallet
```

**Write down the IP address** (e.g., `192.168.1.100`)

---

## Step 5: Update Frontend Configuration (Computer)

Create frontend environment file:

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `frontend/.env.local` and replace `localhost` with your IP:

```env
# Replace YOUR_IP with the IP from Step 4
NEXT_PUBLIC_API_URL=http://YOUR_IP:3001
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

**Example:**
```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## Step 6: Start Backend (Computer)

From the root `Autotrader` directory:

```bash
npm run dev:backend
```

You should see:

```
API server listening on 0.0.0.0:3001
Auto-trader backend ready
```

**Leave this terminal open!**

---

## Step 7: Start Frontend (Computer)

Open a **new terminal** tab and run:

```bash
npm run dev:frontend
```

You should see:

```
- ready started server on 0.0.0.0:3000
```

**Leave this terminal open too!**

---

## Step 8: Access from iPad

On your iPad:

1. **Connect to same WiFi** as your computer
2. Open **Safari** browser
3. Navigate to: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
4. You should see the Auto-Trader dashboard!

---

## Step 9: Connect Phantom Wallet (iPad)

1. Tap **"Connect Wallet"** button
2. Select **Phantom**
3. The Phantom app will open
4. Approve the connection
5. Return to Safari - your wallet is now connected!

---

## Step 10: Start Trading (iPad)

1. Keep **Trading Mode** on **"Paper Trading"** (recommended)
2. Select a symbol: **SOL** (recommended) or BTC, ETH
3. Tap **"🚀 Start Trading"**
4. Watch the dashboard for real-time updates!

---

## Troubleshooting

### iPad Can't Connect

**Problem:** Safari shows "Can't connect to server"

**Solutions:**
1. Verify both devices on **same WiFi network**
2. Check firewall on computer - allow ports 3000 and 3001
3. Try different IP if multiple shown in Step 4
4. Restart WiFi on both devices

### Wallet Connection Issues

**Problem:** Phantom won't connect

**Solutions:**
1. Install Phantom app on iPad from App Store
2. Create/import wallet in Phantom app
3. Make sure Phantom is set to **Mainnet** (not Devnet)
4. Clear Safari cache and try again

### Backend Not Starting

**Problem:** Error when running `npm run dev:backend`

**Solutions:**
1. Make sure all dependencies installed: `npm run install:all`
2. Build shared package: `npm run build --workspace=shared`
3. Check `.env` file exists (copy from `.env.example`)
4. Check no other app using port 3001: `lsof -i :3001`

### Frontend Not Starting

**Problem:** Error when running `npm run dev:frontend`

**Solutions:**
1. Check `.env.local` file in frontend folder
2. Verify IP address is correct
3. Try port 3001 instead: `PORT=3001 npm run dev:frontend`

---

## Network Configuration

### Firewall Settings (Mac)

```bash
# Allow incoming connections on ports 3000 and 3001
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

### Firewall Settings (Windows)

1. Open **Windows Defender Firewall**
2. Click **Advanced Settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → Next
5. Enter **3000, 3001** → Next
6. Select **Allow the connection** → Next
7. Check all profiles → Next
8. Name: "Solana Auto-Trader" → Finish

### Firewall Settings (Linux)

```bash
# UFW
sudo ufw allow 3000
sudo ufw allow 3001

# iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
```

---

## Quick Commands Reference

### On Computer

```bash
# Get IP address
node get-ip.js

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend

# Start both (in two terminals)
npm run dev

# Stop servers
Ctrl+C in each terminal
```

### URLs to Use on iPad

Replace `YOUR_IP` with your computer's IP from `node get-ip.js`

- **Dashboard**: `http://YOUR_IP:3000`
- **API**: `http://YOUR_IP:3001/api/status`

---

## Performance Tips

### For Best Experience on iPad:

1. **Use Safari** (best WebSocket support)
2. **Keep iPad plugged in** (background processes drain battery)
3. **Disable Auto-Lock** (Settings → Display → Auto-Lock → Never)
4. **Close other apps** (free up memory)
5. **Enable full-screen mode** (tap share button → Add to Home Screen)

---

## Security Notes

### Network Security

- Backend listens on `0.0.0.0` (all interfaces)
- Only accessible on **local network**
- Not exposed to internet (unless you port-forward)
- CORS enabled for paper trading mode

### Wallet Security

- Private keys **never** leave Phantom app
- Transactions signed in Phantom, not browser
- Always verify transaction details in Phantom
- Use paper mode for testing

---

## Testing Checklist

Before going live:

- [ ] Backend running on computer
- [ ] Frontend accessible on iPad
- [ ] Wallet connected successfully
- [ ] Paper mode active
- [ ] Symbol selected (SOL)
- [ ] Bot starts without errors
- [ ] Live logs showing activity
- [ ] Position card updating
- [ ] Can stop bot cleanly

---

## Production Mode (⚠️ REAL MONEY)

**Only after extensive paper trading!**

### Prerequisites:

1. Deposit USDC to Drift Protocol via Phantom
2. Test paper mode for at least 24 hours
3. Understand all risk settings
4. Can afford to lose entire deposit

### Enable Live Trading:

1. Stop bot if running
2. Edit `.env` on computer:
   ```env
   PAPER_TRADING=false
   ```
3. Restart backend: `npm run dev:backend`
4. Restart frontend: `npm run dev:frontend`
5. Reconnect on iPad
6. Start with small position sizes

---

## Support

### Common Questions

**Q: Can I use Chrome on iPad?**
A: Safari works best. Chrome on iPad has limited WebSocket support.

**Q: Do I need to keep iPad screen on?**
A: No, but bot runs on computer, not iPad. iPad is just the UI.

**Q: Can I close Safari and bot keeps running?**
A: Yes! Bot runs on computer. Safari is just for viewing/controlling.

**Q: Can multiple people connect?**
A: Yes, anyone on same WiFi can connect to `http://YOUR_IP:3000`

**Q: Will this work over internet?**
A: Not by default. Would need VPN or port forwarding (not recommended).

---

## Advanced: Keep Running 24/7

### On Mac (using screen)

```bash
# Install screen
brew install screen

# Start backend in screen session
screen -S autotrader-backend
npm run dev:backend
# Press Ctrl+A, then D to detach

# Start frontend in screen session
screen -S autotrader-frontend
npm run dev:frontend
# Press Ctrl+A, then D to detach

# Reattach later
screen -r autotrader-backend
```

### On Linux (using tmux)

```bash
# Install tmux
sudo apt-get install tmux

# Start session
tmux new -s autotrader

# Split panes
Ctrl+B then "  (horizontal split)

# In first pane
npm run dev:backend

# Switch to second pane (Ctrl+B then arrow key)
npm run dev:frontend

# Detach: Ctrl+B then D
# Reattach: tmux attach -t autotrader
```

---

## FAQ

**How do I update my IP if it changes?**
1. Run `node get-ip.js` again
2. Update `frontend/.env.local` with new IP
3. Restart frontend

**Can I use this on two iPads?**
Yes! Both connect to same backend. Changes on one show on other.

**Does iPad need to stay connected?**
No. Bot runs on computer. iPad is just for monitoring/control.

**What if my computer sleeps?**
Bot will pause. Disable sleep mode or use wake-on-LAN.

---

**Happy trading from your iPad! 📱✨**
