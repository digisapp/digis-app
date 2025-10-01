# 🧪 Vercel Test Deployment Guide

This guide helps you deploy Digis to Vercel for **testing** (using existing test credentials).

## ✅ You Already Have Everything You Need!

Your current `.env` files have:
- ✅ Supabase (production database)
- ✅ Agora.io (video/voice)
- ✅ Stripe **TEST** keys (perfect for testing payments without real money)
- ✅ Upstash Redis
- ✅ Postmark Email
- ✅ Sentry

## 🚀 Two Ways to Deploy

### Option A: Automated Script (Easiest)

```bash
cd /Users/examodels/Desktop/digis-app
./deploy-test.sh
```

Then follow the prompts!

---

### Option B: Manual Steps (More Control)

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Deploy Backend

```bash
cd /Users/examodels/Desktop/digis-app/backend
vercel
```

**What happens:**
1. Vercel will ask: "Set up and deploy?" → Yes
2. "Which scope?" → Choose your account
3. "Link to existing project?" → No
4. "What's your project's name?" → `digis-backend` (or whatever you prefer)
5. "In which directory is your code located?" → `./` (current directory)
6. Vercel will detect Node.js and deploy!

**Save the deployment URL!** It will look like:
```
https://digis-backend-xxx.vercel.app
```

#### Step 3: Add Backend Environment Variables

1. Go to https://vercel.com/dashboard
2. Click on your `digis-backend` project
3. Go to **Settings** → **Environment Variables**
4. Add these one by one (use values from your current `backend/.env`):

**Required:**
```
NODE_ENV = production
DATABASE_URL = postgresql://postgres:JWiYM6v3bq4Imaot@db.lpphsjowsivjtcmafxnj.supabase.co:5432/postgres
SUPABASE_URL = https://lpphsjowsivjtcmafxnj.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU0ODk4NCwiZXhwIjoyMDY4MTI0OTg0fQ.8zZmXH-nLvBzrqFXGNmqrVxjwTqvGZ_4P8YKj-XYZYA
STRIPE_SECRET_KEY = sk_test_51H2HgsGxPvXyJ8zjK9R5Nk7xJf9K3jH2Xk8zJf9K3jH2Xk8z
STRIPE_WEBHOOK_SECRET = whsec_test_secret_for_local_development
AGORA_APP_ID = 565d5cfda0db4588ad0f6d90df55424e
AGORA_APP_CERTIFICATE = dbad2a385798493390ac0c5b37344417
JWT_SECRET = aXh8Kj9mN3Qw2Ld5Fg7Hp9Zx3Cv6Bn8MqWe4Rt6Yu8IkOp2As4Df6Gh8JlZx3Cv5Bn7
JWT_ACCESS_SECRET = aXh8Kj9mN3Qw2Ld5Fg7Hp9Zx3Cv6Bn8MqWe4Rt6Yu8IkOp2As4Df6Gh8JlZx3Cv5Bn7
JWT_REFRESH_SECRET = bYj9Lk0oP4Sx2We5Rf7Th9Ui8Ok3Lp6Mn8Bv2Cx5Vz7As4Df6Gh8Jk9Lz1Xc3Vb5Nm7
FRONTEND_URL = https://your-frontend-url.vercel.app
```

**Optional but Recommended:**
```
UPSTASH_REDIS_REST_URL = https://uncommon-chamois-5568.upstash.io
UPSTASH_REDIS_REST_TOKEN = ARXAAAImcDI5YzNjZGZlNDVlOTk0NTA4ODZlNWJlNzNiYjFiNDI5NXAyNTU2OA
POSTMARK_API_KEY = 61043964-bcce-4c53-8479-f97a8a3f0843
POSTMARK_FROM_EMAIL = team@digis.cc
AGORA_CHAT_APP_KEY = 411305034#1504278
AGORA_CHAT_APP_TOKEN = 007eJxTYHD4vUPaxWz9x8/JvvsN1kxQ8n1gVRIa3/hSNvPaOY1EC08FBlMz0xTT5LSURIOUJBNTC4vEFIM0sxRLg5Q0U1MTI5PUeUorMxoCGRnSpixjZWRgZWBkYGIA8RkYAL03Hkg=
```

5. Click **Save** for each variable
6. After adding all variables, go to **Deployments** tab
7. Click the **"..."** menu on latest deployment → **Redeploy**

#### Step 4: Deploy Frontend

```bash
cd /Users/examodels/Desktop/digis-app/frontend
vercel
```

Follow the same prompts as backend.

**Save the frontend URL!** It will look like:
```
https://digis-frontend-xxx.vercel.app
```

#### Step 5: Add Frontend Environment Variables

1. Go to https://vercel.com/dashboard
2. Click on your `digis-frontend` project
3. Go to **Settings** → **Environment Variables**
4. Add these (replace `BACKEND_URL` with your actual backend URL):

```
VITE_BACKEND_URL = https://digis-backend-xxx.vercel.app
VITE_SUPABASE_URL = https://lpphsjowsivjtcmafxnj.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGhzam93c2l2anRjbWFmeG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDg5ODQsImV4cCI6MjA2ODEyNDk4NH0.QnkIphnDGyB5jsO1IEq3p2ZQYSrRbPhXI8Me9lnC-SM
VITE_STRIPE_PUBLISHABLE_KEY = pk_test_your-publishable-key
VITE_AGORA_APP_ID = 565d5cfda0db4588ad0f6d90df55424e
VITE_SENTRY_DSN = https://39643d408b9ed97b88abb63fb81cfeb6@o4510043742994432.ingest.us.sentry.io/4510043876229120
VITE_SENTRY_ENABLED = true
VITE_APP_NAME = Digis
VITE_APP_VERSION = 2.0.0
VITE_USE_SUPABASE_STORAGE = true
```

5. **Redeploy** the frontend after adding env vars

#### Step 6: Update Backend FRONTEND_URL

1. Go back to your **backend** project settings
2. Update the `FRONTEND_URL` variable with your actual frontend URL
3. **Redeploy** the backend

---

## 🧪 Testing Your Deployment

Visit your frontend URL: `https://digis-frontend-xxx.vercel.app`

**Test these features:**
1. ✅ Sign up / Sign in (uses real Supabase)
2. ✅ Browse creators
3. ✅ Purchase tokens with Stripe **test card**: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
4. ✅ Try video call features
5. ✅ Send messages

**Everything will work like production, except:**
- 💳 Payments use test cards (no real money)
- 📧 Emails might go to spam (Postmark test mode)

---

## 🐛 Troubleshooting

**Backend won't start:**
- Check Vercel function logs in dashboard
- Verify all environment variables are set
- Make sure DATABASE_URL is correct

**Frontend can't connect to backend:**
- Verify `VITE_BACKEND_URL` matches your backend URL
- Check browser console for CORS errors
- Verify backend is deployed and running (visit `/health` endpoint)

**Payments failing:**
- Make sure using test card: `4242 4242 4242 4242`
- Check Stripe dashboard for webhook delivery
- Verify Stripe keys are set in backend

---

## 🎯 What's Different from Production?

| Feature | Test Deployment | Production |
|---------|----------------|-----------|
| Database | ✅ Same (real Supabase) | ✅ Same |
| Payments | 💳 Test cards only | 💰 Real money |
| Video calls | ✅ Real Agora | ✅ Same |
| Users | 👤 Real users | 👥 Real users |
| Domain | vercel.app subdomain | Custom domain |
| SSL | ✅ Automatic | ✅ Automatic |

**Bottom line:** Test deployment is perfect for testing everything before accepting real payments!

---

## 📝 Notes

- You can deploy as many times as you want (it's free!)
- Each deployment gets a unique URL
- You can set one as "production" in Vercel dashboard
- Vercel automatically handles SSL certificates
- Auto-deploys on git push if you connect GitHub

---

## ✅ Checklist

- [ ] Vercel CLI installed
- [ ] Backend deployed
- [ ] Backend environment variables added
- [ ] Frontend deployed
- [ ] Frontend environment variables added
- [ ] Both redeployed with env vars
- [ ] Tested sign up/login
- [ ] Tested token purchase with test card
- [ ] Tested video call features

---

**Need help?** Check:
- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Logs: Click project → Deployments → Click deployment → Logs
- Backend Health: `https://your-backend-url.vercel.app/health`
