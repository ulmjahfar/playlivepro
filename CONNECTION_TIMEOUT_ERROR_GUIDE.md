# Connection Timeout Error Guide

## Error Explanation

**Error:** `playlive.ddns.me:5000/api/auth/login:1 Failed to load resource: net::ERR_CONNECTION_TIMED_OUT`

This error indicates that your frontend application is trying to connect to the backend API server at `playlive.ddns.me:5000`, but the connection attempt is timing out.

## What This Error Means

`ERR_CONNECTION_TIMED_OUT` occurs when:
1. The browser cannot establish a connection to the server
2. The server is not responding within the timeout period
3. Network requests are being blocked or cannot reach the destination

## Common Causes

### 1. **Backend Server Not Running**
   - The most common cause is that the backend server is not started
   - Check if the Node.js backend process is running on port 5000

### 2. **Incorrect API URL Configuration**
   - The `REACT_APP_API_URL` environment variable might be set incorrectly
   - It should point to where your backend is actually running

### 3. **Network/Firewall Issues**
   - Firewall blocking port 5000
   - Network connectivity issues
   - The domain `playlive.ddns.me` might not be resolving correctly

### 4. **Backend Server Not Accessible**
   - Server might be running on `localhost` but not accessible from external networks
   - Server might be bound to `127.0.0.1` instead of `0.0.0.0`

### 5. **Port Not Open/Forwarded**
   - If accessing remotely, port 5000 might not be forwarded in your router
   - Port might be blocked by your ISP or network administrator

## How to Diagnose

### Step 1: Check if Backend Server is Running

```bash
# Navigate to backend directory
cd backend

# Check if server is running (Windows PowerShell)
Get-Process -Name node -ErrorAction SilentlyContinue

# Or check if port 5000 is in use
netstat -ano | findstr :5000
```

### Step 2: Verify Backend Server Configuration

Check `backend/server.js` - it should be configured to listen on all interfaces:
```javascript
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 PlayLive running on port ${PORT}`));
```

### Step 3: Check Environment Variables

**Frontend Environment:**
- Check if `frontend/.env` or `frontend/.env.local` exists
- Verify `REACT_APP_API_URL` is set correctly

**Backend Environment:**
- Check if `backend/.env` exists
- Verify `PORT` is set (defaults to 5000)
- Verify `MONGO_URI` is correct

### Step 4: Test Backend Directly

Try accessing the backend directly in your browser:
- `https://localhost:5000` (if running locally)
- `https://playlive.ddns.me:5000` (if accessing remotely)

If you get a response, the backend is running. If not, the backend is not accessible.

### Step 5: Check Domain Resolution

Test if the domain resolves correctly:
```bash
# Windows PowerShell
nslookup playlive.ddns.me

# Or ping
ping playlive.ddns.me
```

## Solutions

### Solution 1: Start the Backend Server

If the backend is not running:

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if needed)
npm install

# Start the server
npm start

# Or with nodemon for development
npx nodemon server.js
```

You should see:
```
✅ MongoDB connected
🚀 PlayLive running on port 5000 (accessible from all interfaces)
```

### Solution 2: Fix Environment Variables

**For Local Development:**

Create `frontend/.env` or `frontend/.env.local`:
```env
REACT_APP_API_URL=https://localhost:5000
```

**For Production/Remote Access:**

If your backend is on a remote server:
```env
REACT_APP_API_URL=https://playlive.ddns.me:5000
```

**Important:** After changing `.env` files, restart your React development server:
```bash
cd frontend
npm start
```

### Solution 3: Check Backend Server Binding

Ensure `backend/server.js` is configured to listen on all interfaces:

```javascript
// Line 220 in server.js
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 PlayLive running on port ${PORT} (accessible from all interfaces)`));
```

The `'0.0.0.0'` ensures the server accepts connections from any network interface, not just localhost.

### Solution 4: Check Firewall Settings

**Windows Firewall:**
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Check "Inbound Rules" for port 5000
4. If not present, create a new rule to allow port 5000

**Router Port Forwarding:**
- If accessing from outside your network, ensure port 5000 is forwarded to your server's local IP

### Solution 5: Verify MongoDB Connection

The backend needs MongoDB to be running. Check if MongoDB is accessible:

```bash
# Check MongoDB connection string in backend/.env
MONGO_URI=mongodb://localhost:27017/playlive
```

### Solution 6: Use Localhost for Development

If you're developing locally, use `localhost` instead of the domain:

**frontend/.env:**
```env
REACT_APP_API_URL=https://localhost:5000
```

This avoids DNS resolution issues during development.

## Quick Checklist

- [ ] Backend server is running (`npm start` in `backend/` directory)
- [ ] Backend shows "🚀 PlayLive running on port 5000" message
- [ ] MongoDB is running and connected
- [ ] `REACT_APP_API_URL` is set correctly in `frontend/.env`
- [ ] Frontend development server was restarted after changing `.env`
- [ ] Port 5000 is not blocked by firewall
- [ ] Server is listening on `0.0.0.0` (all interfaces), not just `127.0.0.1`
- [ ] Domain `playlive.ddns.me` resolves correctly (if using remote access)

## Testing the Fix

1. **Start Backend:**
   ```bash
   cd backend
   npm start
   ```

2. **Verify Backend is Accessible:**
   - Open browser: `https://localhost:5000` (should show React app or API response)

3. **Start Frontend:**
   ```bash
   cd frontend
   npm start
   ```

4. **Test Login:**
   - Try logging in through the frontend
   - Check browser console for errors
   - Check network tab to see if API calls succeed

## Additional Debugging

### Check Browser Console
Open browser DevTools (F12) and check:
- **Console tab:** For JavaScript errors
- **Network tab:** For failed API requests (red entries)
- **Network tab > Headers:** To see the exact URL being called

### Check Backend Logs
Look at the terminal where the backend is running for:
- Connection attempts
- Error messages
- Request logs

### Test API Directly
Use a tool like Postman or curl to test the API endpoint directly:

```bash
# Test login endpoint
curl -X POST https://playlive.ddns.me:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test","role":"SUPER_ADMIN"}'
```

If this works but the frontend doesn't, the issue is with the frontend configuration.

## Still Having Issues?

If none of the above solutions work:

1. **Check if you're using the correct URL:**
   - Local development: Use `https://localhost:5000`
   - Remote access: Ensure the domain and port are correct

2. **Verify CORS settings:**
   - Backend should have CORS enabled (already configured in `server.js`)

3. **Check for proxy issues:**
   - If behind a corporate proxy, configure it in your environment

4. **Try a different port:**
   - Change `PORT` in `backend/.env` to a different port (e.g., 3001)
   - Update `REACT_APP_API_URL` accordingly

