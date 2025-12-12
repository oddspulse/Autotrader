# ⚡ Vercel Quickstart - iPad Anywhere!

Deploy to Vercel + Railway and access from **any device, anywhere**.

---

## 🎯 Why This Setup?

**Problem**: Your iPad can only access localhost if on same WiFi

**Solution**: Deploy to cloud - access from anywhere!

| Feature | Local (iPad) | Cloud (Vercel) |
|---------|--------------|----------------|
| Access | Same WiFi only | Anywhere, any device |
| Setup | IP address | Just a URL |
| Uptime | Computer must be on | 24/7 availability |
| Speed | Fast | Fast (global CDN) |
| Cost | Free | Free tier available |

---

## 🚀 Deploy in 5 Minutes

### Step 1: Deploy Backend to Railway (2 min)

Railway runs your trading bot 24/7.

**Option A: One-Click (Easiest)**

1. Go to: https://railway.app
2. Sign up with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Select: `oddspulse/Autotrader`
5. **Add variables**:
   ```
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   PAPER_TRADING=true
   ACTIVE_SYMBOL=SOL
   HOST=0.0.0.0
   PORT=3001
   ```
6. **Deploy** → Wait 2 minutes
7. **Generate Domain** → Copy URL (e.g., `https://autotrader.up.railway.app`)

**Option B: CLI (Faster if you have it)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway init
railway up

# Generate domain
railway domain
```

✅ **Copy your Railway URL** - you'll need it next!

### Step 2: Deploy Frontend to Vercel (2 min)

Vercel hosts your web dashboard.

**Option A: One-Click (Easiest)**

1. Go to: https://vercel.com
2. Sign up with GitHub
3. **Add New** → **Project**
4. Import: `oddspulse/Autotrader`
5. **Root Directory**: `frontend`
6. **Framework Preset**: Next.js (auto-detected)
7. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
   NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
   ```
8. **Deploy** → Wait 1 minute
9. **Visit** your URL (e.g., `https://autotrader.vercel.app`)

**Option B: CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Deploy
vercel

# Add environment variables when prompted:
# NEXT_PUBLIC_API_URL: [your Railway URL]
# NEXT_PUBLIC_RPC_URL: https://api.mainnet-beta.solana.com

# Production deploy
vercel --prod
```

### Step 3: Test on iPad (1 min)

1. Open Safari on your iPad
2. Go to: `https://your-app.vercel.app`
3. Connect Phantom wallet
4. Start trading!

**No WiFi setup needed - works everywhere!** ✨

---

## 📱 Access URLs

After deployment, you get:

- **Frontend (Dashboard)**: `https://your-app.vercel.app`
- **Backend (API)**: `https://your-backend.railway.app`

Access from:
- iPad Safari
- iPhone Safari
- Desktop Chrome/Firefox/Safari
- Any device with internet

---

## 💰 Cost Breakdown

### Free Tier (Perfect for Testing)

| Service | Free Tier | Enough For |
|---------|-----------|------------|
| Railway | $5 credit/mo | ~500 hours (~20 days) |
| Vercel | Unlimited | Unlimited |
| **Total** | **$0/month** | Testing & learning |

### Paid (24/7 Production)

| Service | Cost | What You Get |
|---------|------|--------------|
| Railway Hobby | $5/mo | Always-on backend |
| Vercel Pro | Free (or $20/mo) | Pro features optional |
| **Total** | **$5/month** | 24/7 trading bot |

---

## 🔄 Auto-Deploy Setup

### Enable Auto-Deploy (One-Time Setup)

**Railway**:
1. Dashboard → Settings
2. Connect GitHub repo
3. Enable "Deploy on push"
4. Branch: `main`

**Vercel**:
1. Dashboard → Settings → Git
2. Production Branch: `main`
3. Auto-enabled by default

**Result**: Every time you push code to GitHub, both auto-update! 🚀

---

## ⚙️ Environment Variables Checklist

### Backend (Railway)

Copy these into Railway dashboard:

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PAPER_TRADING=true
ACTIVE_SYMBOL=SOL
HOST=0.0.0.0
PORT=3001
ALLOCATION_PCT=0.60
MAX_LEVERAGE=10
TAKE_PROFIT_PCT=0.20
STOP_LOSS_PCT=0.05
DAILY_LOSS_CAP_PCT=0.03
MAX_CONSECUTIVE_LOSSES=3
MAX_SLIPPAGE_PCT=0.003
```

### Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## 🧪 Testing Your Deployment

### 1. Test Backend Health

```bash
curl https://your-backend.railway.app/api/health
```

Should return:
```json
{"success":true,"data":{"status":"ok"}}
```

### 2. Test Frontend

Open: `https://your-app.vercel.app`

You should see the dashboard.

### 3. Full Integration Test

1. Open app in Safari
2. Click "Connect Wallet"
3. Approve in Phantom
4. Select Paper Trading
5. Choose symbol (SOL)
6. Click "Start Trading"
7. Watch logs update in real-time

✅ If logs appear, it's working!

---

## 🎨 Custom Domain (Optional)

### Vercel Custom Domain

1. Dashboard → Settings → Domains
2. Add: `autotrader.yourdomain.com`
3. Update DNS at your registrar:
   ```
   CNAME autotrader vercel-dns.com
   ```
4. SSL auto-configured!

Now access at: `https://autotrader.yourdomain.com`

---

## 📊 Monitoring

### Railway Dashboard

**Metrics**:
- CPU usage
- Memory usage
- Network traffic
- Request count

**Logs**:
- Real-time bot logs
- Error tracking
- Deployment history

Access: https://railway.app/dashboard

### Vercel Dashboard

**Analytics**:
- Page views
- Performance scores
- Function execution time

**Logs**:
- Frontend errors
- Build logs
- Deployment status

Access: https://vercel.com/dashboard

---

## 🐛 Troubleshooting

### "Backend URL not accessible"

**Check**:
```bash
# Test backend directly
curl https://your-backend.railway.app/api/health

# If fails, check Railway logs
railway logs --service backend
```

**Fix**: Verify `HOST=0.0.0.0` in Railway env vars

### "WebSocket connection failed"

**Check**: Is `NEXT_PUBLIC_API_URL` correct in Vercel?

**Fix**:
1. Vercel Dashboard → Settings → Environment Variables
2. Verify `NEXT_PUBLIC_API_URL` matches Railway URL
3. Redeploy: Vercel Dashboard → Deployments → Redeploy

### "Phantom won't connect"

**Check**: Using Safari on iPad (best support)

**Fix**:
1. Update Phantom app
2. Clear Safari cache
3. Try airplane mode on/off

### Backend goes to sleep (Render free tier)

**Why**: Render free tier sleeps after 15min inactivity

**Fix**: Upgrade to Render Starter ($7/mo) or use Railway

---

## 🔐 Security Checklist

- [ ] Never commit `.env` files
- [ ] Use Vercel/Railway environment variables
- [ ] Enable 2FA on GitHub, Vercel, Railway
- [ ] Keep `PAPER_TRADING=true` until fully tested
- [ ] Review CORS settings in production
- [ ] Monitor logs for suspicious activity
- [ ] Set up alerts for errors

---

## 🚨 Production Checklist

Before switching to real money:

- [ ] Backend deployed and stable for 24+ hours
- [ ] Frontend accessible from all devices
- [ ] Paper trading tested extensively
- [ ] All environment variables verified
- [ ] Monitoring/alerts configured
- [ ] Understand all risk settings
- [ ] Can afford to lose entire deposit
- [ ] Have emergency stop plan

---

## 💡 Pro Tips

### Faster Deployments

**Railway**:
```bash
# Deploy only changed files
railway up

# View logs live
railway logs --follow
```

**Vercel**:
```bash
# Preview deployment (test before production)
vercel

# Production deployment
vercel --prod

# Check deployment status
vercel ls
```

### Development Workflow

1. **Local**: Test changes locally first
2. **Preview**: Deploy to preview URL (Vercel auto-creates)
3. **Production**: Promote to production when ready

### Cost Optimization

**Railway**:
- Use free $5 credit first
- Monitor usage in dashboard
- Upgrade only when credit runs out
- Set usage alerts

**Vercel**:
- Free tier is generous
- Only upgrade if you need:
  - More bandwidth
  - Password protection
  - Advanced analytics

---

## 🎉 You're Live!

Your auto-trader is now:

✅ Accessible from anywhere
✅ Works on iPad, phone, desktop
✅ No WiFi setup needed
✅ Auto-deploys on code changes
✅ Monitored 24/7
✅ Free (or $5/month)

**URLs to bookmark**:

- Dashboard: `https://your-app.vercel.app`
- Railway Admin: `https://railway.app/dashboard`
- Vercel Admin: `https://vercel.com/dashboard`

---

## 📚 Next Steps

1. **Read**: `DEPLOY.md` for detailed deployment guide
2. **Learn**: `VERCEL_DEPLOYMENT.md` for architecture details
3. **Customize**: Adjust risk settings in Railway env vars
4. **Monitor**: Check logs daily in Railway dashboard
5. **Optimize**: Review performance metrics

---

## 🆘 Need Help?

**Documentation**:
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Project README: See `README.md`

**Support**:
- Railway Discord: https://discord.gg/railway
- Vercel GitHub: https://github.com/vercel/vercel/discussions

**Emergency**:
- Stop bot: Railway dashboard → Pause service
- Rollback: Vercel dashboard → Previous deployment → Promote

---

**Happy cloud trading! ☁️📱✨**

Your bot is now running 24/7 in the cloud, accessible from anywhere in the world.
