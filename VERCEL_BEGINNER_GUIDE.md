# Complete Beginner's Guide to Deploy Digis on Vercel

## Part 1: Create Vercel Account

### Step 1: Sign Up for Vercel
1. Open your web browser and go to: https://vercel.com
2. Click the **"Sign Up"** button (top right)
3. Choose one of these options:
   - **Continue with GitHub** (Recommended)
   - Continue with GitLab
   - Continue with Bitbucket
   - Continue with Email
4. Follow the sign-up process
5. Verify your email if required

### Step 2: Choose Your Plan
1. Select **"Hobby"** (Free plan) - perfect for getting started
2. You can upgrade later if needed

---

## Part 2: Prepare Your Project

### Step 1: Install Required Tools
Open your terminal/command prompt and run:

```bash
# Install Vercel CLI globally
npm install -g vercel

# Verify installation
vercel --version
```

### Step 2: Prepare Environment Variables
1. In your project folder, find the file `.env.example`
2. Create a new file called `.env.local` 
3. Copy everything from `.env.example` to `.env.local`
4. You'll need to get real values for these (we'll help you below)

---

## Part 3: Deploy Using Vercel CLI (Easiest Method)

### Step 1: Open Terminal in Project Folder
```bash
# Make sure you're in the digis-app folder
cd /Users/examodels/Desktop/digis-app
```

### Step 2: Login to Vercel
```bash
vercel login
```
- Enter the email you used to sign up
- Check your email for verification
- Click the verification link

### Step 3: Deploy the Backend
```bash
# Navigate to backend folder
cd backend

# Start deployment
vercel

# Answer the prompts:
# ? Set up and deploy "./backend"? [Y/n]: Y
# ? Which scope do you want to deploy to? Select your username
# ? Link to existing project? [y/N]: n
# ? What's your project's name? digis-backend
# ? In which directory is your code located? ./ (just press Enter)
# ? Want to modify these settings? [y/N]: n
```

**IMPORTANT**: After deployment completes, you'll see:
```
🎉 Production: https://digis-backend-xxxxx.vercel.app [copied to clipboard]
```
**SAVE THIS URL!** You'll need it for the frontend.

### Step 4: Deploy the Frontend
```bash
# Go back to main folder
cd ..

# Navigate to frontend folder
cd frontend

# Start deployment
vercel

# Answer the prompts:
# ? Set up and deploy "./frontend"? [Y/n]: Y
# ? Which scope do you want to deploy to? Select your username
# ? Link to existing project? [y/N]: n
# ? What's your project's name? digis-frontend
# ? In which directory is your code located? ./ (just press Enter)
# ? Want to modify these settings? [y/N]: n
```

---

## Part 4: Configure Environment Variables (CRITICAL!)

### Step 1: Open Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. You should see two projects: `digis-backend` and `digis-frontend`

### Step 2: Configure Backend Environment Variables
1. Click on **`digis-backend`** project
2. Click on **"Settings"** tab (top menu)
3. Click on **"Environment Variables"** (left sidebar)
4. Add these variables ONE BY ONE:

#### Required Backend Variables:
Click "Add" for each one and enter:

| Key | Value | How to Get It |
|-----|-------|---------------|
| `NODE_ENV` | `production` | Just type this exactly |
| `DATABASE_URL` | Your Supabase URL | See "Getting Supabase" below |
| `SUPABASE_URL` | Your Supabase URL | See "Getting Supabase" below |
| `SUPABASE_ANON_KEY` | Your anon key | See "Getting Supabase" below |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service key | See "Getting Supabase" below |
| `FRONTEND_URL` | Your frontend URL | Use the URL from frontend deployment |
| `STRIPE_SECRET_KEY` | `sk_test_...` | See "Getting Stripe" below (optional for now) |
| `AGORA_APP_ID` | Your Agora ID | See "Getting Agora" below (optional for now) |

5. After adding each variable, click **"Save"**

### Step 3: Configure Frontend Environment Variables
1. Go back to dashboard: https://vercel.com/dashboard
2. Click on **`digis-frontend`** project
3. Click on **"Settings"** tab
4. Click on **"Environment Variables"**
5. Add these variables:

#### Required Frontend Variables:
| Key | Value | How to Get It |
|-----|-------|---------------|
| `VITE_BACKEND_URL` | Your backend URL | The URL from backend deployment |
| `VITE_SUPABASE_URL` | Your Supabase URL | Same as backend |
| `VITE_SUPABASE_ANON_KEY` | Your anon key | Same as backend |
| `VITE_APP_NAME` | `Digis` | Just type this |
| `VITE_APP_VERSION` | `2.0.0` | Just type this |

### Step 4: Redeploy After Adding Variables
After adding all environment variables:

```bash
# Redeploy backend
cd backend
vercel --prod

# Redeploy frontend  
cd ../frontend
vercel --prod
```

---

## Part 5: Getting Required Services (Free Tiers Available)

### Getting Supabase (Database) - REQUIRED
1. Go to: https://supabase.com
2. Click **"Start your project"**
3. Sign up with GitHub or Email
4. Click **"New Project"**
5. Fill in:
   - Name: `digis-db`
   - Database Password: Create a strong password (SAVE IT!)
   - Region: Choose closest to you
6. Click **"Create new project"** (takes 2 minutes)
7. Once ready, go to **"Settings"** → **"API"**
8. Copy these values:
   - **Project URL**: This is your `SUPABASE_URL`
   - **anon public**: This is your `SUPABASE_ANON_KEY`
   - **service_role secret**: This is your `SUPABASE_SERVICE_ROLE_KEY`
9. For `DATABASE_URL`, go to **"Settings"** → **"Database"**
   - Copy the **"Connection string"** → **"URI"**

### Getting Stripe (Payments) - OPTIONAL
1. Go to: https://stripe.com
2. Sign up for free account
3. Go to: https://dashboard.stripe.com/test/apikeys
4. Copy:
   - **Publishable key**: starts with `pk_test_`
   - **Secret key**: starts with `sk_test_`

### Getting Agora (Video Calls) - OPTIONAL
1. Go to: https://www.agora.io
2. Sign up for free account
3. Create a new project
4. Copy the **App ID**

---

## Part 6: Verify Your Deployment

### Step 1: Check Your Sites
1. Open your frontend URL in a browser
2. You should see the Digis homepage
3. Try to sign up/login

### Step 2: If Something's Wrong
Check these common issues:

**White/blank page?**
- Check browser console (F12) for errors
- Make sure all environment variables are set
- Redeploy after fixing variables

**Can't connect to backend?**
- Verify `VITE_BACKEND_URL` in frontend matches your backend URL
- Check `FRONTEND_URL` in backend matches your frontend URL
- Both URLs should start with `https://`

**Database errors?**
- Double-check all Supabase variables
- Make sure you copied them correctly (no extra spaces)

---

## Part 7: Make Updates

### When You Change Code:
```bash
# After making changes, redeploy:

# For backend changes
cd backend
vercel --prod

# For frontend changes
cd frontend  
vercel --prod
```

### View Your Projects:
- Dashboard: https://vercel.com/dashboard
- Click on any project to see:
  - Deployment history
  - Analytics
  - Logs
  - Settings

---

## Quick Commands Reference

```bash
# Deploy to production
vercel --prod

# Deploy to preview (testing)
vercel

# See all deployments
vercel ls

# View logs
vercel logs

# Remove a deployment
vercel rm [deployment-url]

# Pull environment variables locally
vercel env pull
```

---

## Need Help?

### If deployment fails:
1. Read the error message carefully
2. Check you're in the right folder
3. Make sure Node.js is installed: `node --version`
4. Try: `npm install` before deploying

### Common Error Solutions:

**"Error: No such file or directory"**
- Make sure you're in the right folder
- Use `cd backend` or `cd frontend`

**"Build failed"**
- Run `npm install` first
- Check error logs in Vercel dashboard

**"Environment variable not found"**
- Add all required variables in Vercel dashboard
- Redeploy after adding variables

### Support Resources:
- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Community Forum: https://github.com/vercel/vercel/discussions

---

## 🎉 Congratulations!
You've deployed your first full-stack application to Vercel!

Your app is now live on the internet with:
- Automatic HTTPS/SSL
- Global CDN
- Automatic deployments
- Serverless backend
- Free hosting (with limits)

---

## Next Steps:
1. Share your app URL with friends
2. Customize the app with your branding
3. Add a custom domain (optional)
4. Set up automatic deployments from GitHub
5. Monitor usage in Vercel dashboard