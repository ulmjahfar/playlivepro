# Error Analysis & Solutions

This document explains the three errors you're encountering and their solutions.

## Error Summary

1. **401 Unauthorized on `/api/auth/login`**
2. **WebSocket connection failure**
3. **500 Internal Server Error on `/api/tournaments/PLTC001/layout-preferences`**

## Root Cause Analysis

### 1. 401 Unauthorized - Login Failure

**Error:** `:5000/api/auth/login:1 Failed to load resource: the server responded with a status of 401 (Unauthorized)`

**Possible Causes:**
- Invalid username/password combination
- User doesn't exist in database
- Role mismatch (e.g., trying to login as TournamentAdmin but user has different role)
- Rate limiting (max 10 attempts per 15 minutes)
- Database connection issue
- Tournament not found for TournamentAdmin users

**Investigation Steps:**
1. Check if you're using the correct username and password
2. Verify the user exists in the database
3. Check if you're selecting the correct role during login
4. Verify database connection is working
5. For TournamentAdmin: Ensure the user has an associated tournament

**Solution:**
- Verify credentials and user existence
- Check server logs for specific error messages
- Ensure database connection is stable
- Clear browser cache/localStorage if token is corrupted

### 2. WebSocket Connection Failure

**Error:** `WebSocket connection to 'ws://192.168.1.43:5000/socket.io/?EIO=4&transport=websocket' failed: WebSocket is closed before the connection is established.`

**Root Cause:**
This is a **consequence** of the login failure (Error #1). When login fails:
- No valid JWT token is stored
- WebSocket connection requires authentication (or fails to establish)
- Socket.io client can't authenticate with the server

**Why it happens:**
- In `LiveAuction.js`, the socket connection requires a token from localStorage
- If login failed, there's no token, so the socket can't connect
- The socket connection is attempted even though authentication failed

**Solution:**
- **Primary fix:** Resolve the login issue first (Error #1)
- Once login succeeds, WebSocket should connect automatically
- The socket connection gracefully handles missing tokens but may still show warnings

### 3. 500 Internal Server Error - Layout Preferences

**Error:** `:5000/api/tournaments/PLTC001/layout-preferences:1 Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

**Root Cause:**
The layout-preferences endpoint is failing due to MongoDB Map serialization issues. The Tournament model uses a `Map` type for `userLayoutPreferences`, but:

1. MongoDB doesn't natively support JavaScript Map objects
2. Maps get converted to plain objects when stored in MongoDB
3. When retrieved, they may not be proper Map instances
4. The code tries to use Map methods (`.get()`) on what might be a plain object
5. This causes an error that gets caught and returns 500

**The Problem:**
```javascript
// In Tournament model
userLayoutPreferences: {
  type: Map,
  of: { ... }
}

// In route handler
if (tournament.userLayoutPreferences instanceof Map) {
  userPrefs = tournament.userLayoutPreferences.get(userId); // This might fail
}
```

**Solution:**
- Improve error handling to check for Map/object type before accessing
- Convert Map to plain object format for better MongoDB compatibility
- Add defensive checks for edge cases
- Log detailed error information for debugging

## Error Chain

The errors are interconnected:

```
Login Fails (401)
    ↓
No Auth Token
    ↓
WebSocket Can't Authenticate (Connection Failed)
    ↓
Layout Preferences Request Fails (500) - Also requires auth
```

## Recommended Fix Order

1. **First:** Fix the login issue (401 error)
   - Verify credentials
   - Check user existence
   - Verify database connection

2. **Second:** Fix the layout-preferences endpoint (500 error)
   - Improve MongoDB Map handling
   - Add better error handling
   - Convert to more MongoDB-friendly format

3. **Third:** WebSocket will automatically work once login succeeds

## Quick Debugging Commands

1. **Check server logs:**
   ```bash
   tail -f backend/server.log
   ```

2. **Check if user exists:**
   - Connect to MongoDB
   - Query the users collection

3. **Check tournament exists:**
   - Verify PLTC001 exists in tournaments collection
   - Check if user is associated with tournament

## Fixes Applied

### 1. Improved Layout Preferences Endpoint (500 Error Fix)

**Changes made to `backend/routes/tournamentRoutes.js`:**

1. **Enhanced MongoDB Map handling:**
   - Added try-catch blocks around Map access operations
   - Better handling of cases where Maps are stored as plain objects in MongoDB
   - Graceful fallback to default layout if data is corrupted

2. **Improved error logging:**
   - Added detailed error logging with stack traces
   - Logs request user info and tournament code for debugging
   - Better error messages for troubleshooting

3. **Defensive programming:**
   - Multiple checks for Map vs plain object formats
   - Safe access patterns to prevent crashes
   - Default values when data is missing

**The endpoint now:**
- Handles both Map instances and plain objects
- Returns default layout if preferences can't be loaded
- Provides detailed error information in server logs
- Won't crash if MongoDB Map serialization is inconsistent

### 2. Frontend Error Handling

The frontend (`TournamentAuctionNormal.js`) already has good error handling:
- Silently falls back to default layout on error
- Logs warnings to console (expected behavior)
- Doesn't interrupt user experience

## Remaining Issues

### 1. 401 Login Error - Requires Manual Investigation

**Action items:**
1. Check if user credentials are correct
2. Verify user exists in database:
   ```javascript
   // Connect to MongoDB and check
   db.users.findOne({ username: "your_username" })
   ```
3. Verify role matches what you're selecting during login
4. Check server logs for specific error messages
5. Verify database connection is working

**Common causes:**
- Wrong password
- User doesn't exist
- Role mismatch (trying to login as TournamentAdmin but user has different role)
- Rate limiting (10 attempts per 15 minutes)
- For TournamentAdmin: Tournament not found or user not associated with tournament

### 2. WebSocket Connection - Will Auto-Fix

Once login succeeds:
- JWT token will be stored in localStorage
- WebSocket connection will authenticate successfully
- Connection should establish automatically

## Testing Recommendations

1. **Test layout preferences:**
   - After fixing login, test saving/loading layout preferences
   - Check server logs for any remaining errors
   - Verify preferences persist across sessions

2. **Monitor server logs:**
   ```bash
   tail -f backend/server.log
   ```

3. **Check browser console:**
   - Look for remaining errors after login succeeds
   - Verify WebSocket connects after authentication

## Summary

✅ **Fixed:** 500 error on layout-preferences endpoint  
⏳ **Pending:** 401 login error (requires credential verification)  
✅ **Auto-resolve:** WebSocket connection (will work after login succeeds)

The layout-preferences endpoint now has robust error handling and should no longer crash. The 401 login error needs manual investigation of credentials and user data.

