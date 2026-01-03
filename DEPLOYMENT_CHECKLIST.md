# PlayLive Deployment Checklist

## ⚠️ Important: Socket.io Limitation

Your app uses **Socket.io for real-time auctions**. Vercel's serverless functions **do not support persistent WebSocket connections** well. 

**Recommendation:** Deploy backend separately (Railway, Render, DigitalOcean, etc.) and frontend to Vercel.

---

## Quick Fix for DEPLOYMENT_NOT_FOUND Error

### Step 1: Verify Current Situation
```bash
# Check if you're logged in to Vercel
vercel whoami

# List your deployments
vercel ls

# Check if project is linked
cat .vercel/project.json  # Should exist if linked
```

### Step 2: Check Environment Variables
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Verify `REACT_APP_API_URL` is set correctly

### Step 3: Verify Deployment Exists
1. Go to **Deployments** tab in Vercel dashboard
2. Check if your deployment exists
3. If not, create one:
   ```bash
   vercel --prod
   ```

---

## Recommended Deployment Strategy

### Option A: Frontend on Vercel + Backend on Railway (Recommended)

#### Frontend Deployment (Vercel)
```bash
cd frontend
vercel --prod
```

**Environment Variables in Vercel:**
- `REACT_APP_API_URL` = `https://your-backend.railway.app`

#### Backend Deployment (Railway)
1. Go to [Railway.app](https://railway.app)
2. Create new project
3. Connect GitHub repo
4. Set root directory to `backend/`
5. Add environment variables:
   - `MONGO_URI` = Your MongoDB connection string
   - `JWT_SECRET` = Your JWT secret
   - `PORT` = `5000` (or Railway will auto-assign)
   - `CORS_ORIGIN` = Your Vercel frontend URL

#### Update Backend CORS
In `backend/server.js`, update CORS:
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://localhost:3000',
  credentials: true
}));
```

---

### Option B: Frontend on Vercel + Backend on Render

#### Backend Deployment (Render)
1. Go to [Render.com](https://render.com)
2. Create new **Web Service**
3. Connect GitHub repo
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables (same as Railway)

---

## Environment Variables Checklist

### Frontend (Vercel)
- [ ] `REACT_APP_API_URL` = Your backend URL

### Backend (Railway/Render/etc.)
- [ ] `MONGO_URI` = MongoDB connection string
- [ ] `JWT_SECRET` = Strong random string
- [ ] `PORT` = Port number (or auto-assigned)
- [ ] `CORS_ORIGIN` = Your Vercel frontend URL
- [ ] `EMAIL_HOST` = (if using email)
- [ ] `EMAIL_PORT` = (if using email)
- [ ] `EMAIL_USER` = (if using email)
- [ ] `EMAIL_PASS` = (if using email)

---

## Common Issues & Solutions

### Issue: DEPLOYMENT_NOT_FOUND
**Solution:** 
- Verify deployment exists in Vercel dashboard
- Check if deployment was deleted
- Create new deployment: `vercel --prod`

### Issue: Socket.io not working
**Solution:**
- Deploy backend to platform that supports WebSockets (Railway, Render, DigitalOcean)
- Don't use Vercel serverless functions for Socket.io

### Issue: File uploads not working
**Solution:**
- Use external storage (AWS S3, Cloudinary) for uploads
- Or deploy backend to platform with persistent storage

### Issue: CORS errors
**Solution:**
- Update `CORS_ORIGIN` in backend to match frontend URL
- Check backend CORS configuration in `server.js`

### Issue: Environment variables not working
**Solution:**
- `.env` files don't work in production
- Set variables in Vercel dashboard (frontend)
- Set variables in Railway/Render dashboard (backend)

---

## Testing Deployment

### 1. Test Frontend
```bash
# After deploying to Vercel, visit your deployment URL
# Check browser console for errors
# Verify API calls are going to correct backend URL
```

### 2. Test Backend
```bash
# Test API endpoint
curl https://your-backend.railway.app/api/tournaments

# Test Socket.io connection
# Open browser console on frontend
# Check if Socket.io connects successfully
```

### 3. Test Full Flow
- [ ] Login works
- [ ] Tournament creation works
- [ ] Player registration works
- [ ] File uploads work
- [ ] Socket.io real-time features work
- [ ] Auction system works

---

## Quick Commands Reference

```bash
# Vercel CLI
vercel login              # Login to Vercel
vercel link               # Link project to Vercel
vercel                    # Deploy to preview
vercel --prod             # Deploy to production
vercel ls                 # List deployments
vercel inspect [url]      # Inspect deployment
vercel logs [url]         # View logs
vercel env ls             # List environment variables
vercel env add [name]     # Add environment variable

# Railway CLI (if using)
railway login
railway init
railway up
railway logs
```

---

## Next Steps

1. **Choose deployment strategy** (recommended: Frontend Vercel + Backend Railway)
2. **Set up backend deployment** first (get the URL)
3. **Set up frontend deployment** with backend URL in env vars
4. **Test thoroughly** - especially Socket.io features
5. **Monitor logs** for any errors
6. **Set up custom domain** (optional)

---

*For detailed explanation of DEPLOYMENT_NOT_FOUND error, see `VERCEL_DEPLOYMENT_NOT_FOUND_GUIDE.md`*




