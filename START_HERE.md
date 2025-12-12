# 🚀 Quick Start for iPad Access

Everything is now installed and configured! Follow these steps to run on your iPad.

---

## ✅ What's Been Done

- ✅ All dependencies installed
- ✅ Shared package built
- ✅ Backend configured to listen on all network interfaces
- ✅ Frontend auto-configured with your IP: **21.0.0.20**
- ✅ Environment files created

---

## 🎯 How to Run (2 Steps)

### Step 1: Start Backend (Terminal 1)

```bash
npm run dev:backend
```

You should see:
```
API server listening on 0.0.0.0:3001
Auto-trader backend ready
```

### Step 2: Start Frontend (Terminal 2)

Open a **new terminal tab** and run:

```bash
npm run dev:frontend
```

You should see:
```
ready - started server on 0.0.0.0:3000
```

---

## 📱 Access from iPad

1. Make sure your iPad is on the **same WiFi network** as this computer

2. Open **Safari** on your iPad

3. Go to: **http://21.0.0.20:3000**

4. Click **"Connect Wallet"** and approve in Phantom

5. Select **Paper Trading** mode (recommended for testing)

6. Choose a symbol: **SOL** (or BTC, ETH)

7. Tap **"🚀 Start Trading"**

---

## 🔧 Troubleshooting

### Can't connect from iPad?

**Check WiFi:**
```bash
# Make sure both devices on same network
# iPad: Settings → WiFi → check network name
# Computer: Check WiFi settings
```

**Verify IP Address:**
```bash
node get-ip.js
```

If IP changed, update frontend:
```bash
./setup-ipad.sh
```

**Check Firewall:**
```bash
# Mac: System Preferences → Security → Firewall → Turn off
# Or allow ports 3000 and 3001
```

### Backend won't start?

```bash
# Make sure .env file exists
ls -la .env

# If not, create it
cp .env.example .env
```

### Frontend won't start?

```bash
# Check frontend config exists
ls -la frontend/.env.local

# If not, run setup again
./setup-ipad.sh
```

---

## 📚 Full Documentation

- **IPAD_SETUP.md** - Comprehensive iPad setup guide
- **README.md** - Complete project documentation
- **QUICKSTART.md** - Local setup guide
- **PROJECT_SUMMARY.md** - Technical implementation details

---

## 🆘 Need Help?

**Get your IP address:**
```bash
node get-ip.js
```

**Reconfigure for iPad:**
```bash
./setup-ipad.sh
```

**Check what's running:**
```bash
# Check if backend is running
lsof -i :3001

# Check if frontend is running
lsof -i :3000
```

**Stop everything:**
```
Press Ctrl+C in each terminal
```

---

## 📍 Current Configuration

- **Backend**: http://0.0.0.0:3001
- **Frontend**: http://0.0.0.0:3000
- **iPad URL**: http://21.0.0.20:3000
- **Trading Mode**: Paper Trading (safe)
- **Active Symbol**: SOL

---

## ⚠️ Important Notes

1. **Keep terminals open** - Both backend and frontend need to stay running
2. **Same WiFi required** - iPad must be on same network as computer
3. **Paper mode first** - Test with paper trading before going live
4. **Phantom required** - Install Phantom wallet app on iPad
5. **Computer awake** - Don't let computer sleep while trading

---

## 🎉 You're Ready!

Just run the two commands above and access from your iPad!

**Quick Commands:**

Terminal 1:
```bash
npm run dev:backend
```

Terminal 2:
```bash
npm run dev:frontend
```

iPad Safari:
```
http://21.0.0.20:3000
```

---

**Happy trading! 📱✨**
