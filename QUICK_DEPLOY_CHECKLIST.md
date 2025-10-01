# 🚀 Quick Deployment Checklist

## Pre-Deployment
- [ ] Create Vercel account at https://vercel.com
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Create Supabase project at https://supabase.com
- [ ] Get Supabase credentials (URL, anon key, service key)

## Deploy Backend
- [ ] Open terminal in project folder
- [ ] Run: `cd backend`
- [ ] Run: `vercel`
- [ ] Answer prompts (project name: `digis-backend`)
- [ ] Copy the deployment URL (save it!)

## Deploy Frontend  
- [ ] Run: `cd ../frontend`
- [ ] Run: `vercel`
- [ ] Answer prompts (project name: `digis-frontend`)
- [ ] Copy the deployment URL (save it!)

## Configure Backend Environment Variables
Go to: https://vercel.com/dashboard → Click `digis-backend` → Settings → Environment Variables

Add these (one by one):
- [ ] `NODE_ENV` = `production`
- [ ] `DATABASE_URL` = (from Supabase)
- [ ] `SUPABASE_URL` = (from Supabase)
- [ ] `SUPABASE_ANON_KEY` = (from Supabase)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = (from Supabase)
- [ ] `FRONTEND_URL` = (your frontend deployment URL)

## Configure Frontend Environment Variables
Go to: https://vercel.com/dashboard → Click `digis-frontend` → Settings → Environment Variables

Add these (one by one):
- [ ] `VITE_BACKEND_URL` = (your backend deployment URL)
- [ ] `VITE_SUPABASE_URL` = (from Supabase)
- [ ] `VITE_SUPABASE_ANON_KEY` = (from Supabase)
- [ ] `VITE_APP_NAME` = `Digis`
- [ ] `VITE_APP_VERSION` = `2.0.0`

## Final Steps
- [ ] Redeploy backend: `cd backend && vercel --prod`
- [ ] Redeploy frontend: `cd frontend && vercel --prod`
- [ ] Test your live site!

## Your URLs Will Look Like:
- Backend: `https://digis-backend-xxxxx.vercel.app`
- Frontend: `https://digis-frontend-xxxxx.vercel.app`

## Test Your Deployment
- [ ] Open frontend URL in browser
- [ ] Check if homepage loads
- [ ] Try to sign up/login
- [ ] Check browser console for errors (F12)

## If Something Goes Wrong:
1. Check all environment variables are correct
2. Make sure URLs don't have typos
3. Redeploy after fixing variables
4. Check Vercel dashboard for error logs

## Success! 🎉
Your app is now live on the internet!