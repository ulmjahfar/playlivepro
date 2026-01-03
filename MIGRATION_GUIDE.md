# Migration Guide: Moving PlayLive to Another System

This guide will help you transfer the PlayLive application to a new system.

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB installed and running
- Git (optional, for version control)

## 📦 Step 1: Copy the Project

### Option A: Using Git (Recommended)
```bash
# On the new system, clone the repository
git clone <your-repository-url> playlive
cd playlive
```

### Option B: Manual Copy
1. Copy the entire `playlive` folder to the new system
2. Exclude `node_modules` folders (they'll be reinstalled)
3. You can use this command to create a clean copy:
   ```bash
   # On old system
   tar --exclude='node_modules' --exclude='.git' -czf playlive-backup.tar.gz playlive/
   # Transfer the tar.gz file to new system and extract
   ```

## 🔧 Step 2: Environment Setup

### Backend Environment Variables

Create a `.env` file in the `backend` folder with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/playlive
# Or for remote MongoDB:
# MONGODB_URI=mongodb://username:password@host:port/database

# JWT Secret (use a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Port
PORT=5000

# CORS Origins (comma-separated)
CORS_ORIGIN=https://localhost:3000

# Email Configuration (if using email features)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# WhatsApp Configuration (if using WhatsApp features)
WHATSAPP_ENABLED=false
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` folder:

```env
# Backend API URL
REACT_APP_API_URL=https://localhost:5000

# If deploying to production, use your production backend URL:
# REACT_APP_API_URL=https://api.yourdomain.com
```

## 📥 Step 3: Install Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## 🗄️ Step 4: Database Setup

### Option A: Export/Import MongoDB Data

**On the old system:**
```bash
# Export the database
mongodump --uri="mongodb://localhost:27017/playlive" --out=./playlive-backup

# Create a compressed archive
tar -czf playlive-db-backup.tar.gz playlive-backup/
```

**On the new system:**
```bash
# Extract the backup
tar -xzf playlive-db-backup.tar.gz

# Import the database
mongorestore --uri="mongodb://localhost:27017/playlive" ./playlive-backup/playlive
```

### Option B: Start Fresh Database
If you want to start with a clean database:
1. Make sure MongoDB is running
2. The backend will automatically seed the tier system on first run

## 📁 Step 5: Transfer Uploaded Files (Optional)

If you want to keep existing uploaded files (logos, photos, etc.):

**On the old system:**
```bash
cd backend
tar -czf uploads-backup.tar.gz uploads/
```

**On the new system:**
```bash
cd backend
tar -xzf uploads-backup.tar.gz
```

## 🚀 Step 6: Start the Application

### Start Backend
```bash
cd backend
npm start
```

The backend should start on `https://localhost:5000`

### Start Frontend
```bash
cd frontend
npm start
```

The frontend should start on `https://localhost:3000`

## ✅ Step 7: Verify Installation

1. **Check Backend**: Open `https://localhost:5000` - should see server running
2. **Check Frontend**: Open `https://localhost:3000` - should see the login page
3. **Test Login**: Try logging in with your SuperAdmin credentials
4. **Test Database**: Verify tournaments and data are accessible

## 🔍 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod` or `brew services start mongodb-community` (Mac)
- Check connection string in `.env` file
- Verify MongoDB port (default: 27017)

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Frontend: Set `PORT=3001` in `frontend/.env` or use `npm start -- --port 3001`

### Module Not Found Errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

### CORS Errors
- Update `CORS_ORIGIN` in `backend/.env` to match your frontend URL
- Or set to `*` for development (not recommended for production)

### Database Schema Issues
If you see errors about data types (like the `auctionState` string issue):
- You may need to run database migration scripts
- Check backend logs for specific schema errors

## 📝 Important Files to Transfer

- ✅ All source code files (`backend/`, `frontend/src/`)
- ✅ Configuration files (`package.json`, `package-lock.json`)
- ✅ Environment files (`.env` - create new ones with correct values)
- ✅ Uploaded files (`backend/uploads/` - if you want to keep them)
- ✅ Database backup (if you want to keep existing data)

## 🚫 Files to Exclude (Don't Transfer)

- ❌ `node_modules/` (reinstall on new system)
- ❌ `.env` files (create new ones with correct values for new system)
- ❌ `build/` folder (will be regenerated)
- ❌ Log files (`*.log`)

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` in backend `.env`
- [ ] Update database credentials if using remote MongoDB
- [ ] Review and update CORS settings
- [ ] Change default passwords
- [ ] Review file permissions on uploads folder

## 📞 Need Help?

If you encounter issues:
1. Check the console logs for both backend and frontend
2. Verify all environment variables are set correctly
3. Ensure MongoDB is running and accessible
4. Check that all required ports are available

---

**Note**: This guide assumes you're moving to a similar development environment. For production deployment, additional steps like setting up reverse proxies, SSL certificates, and process managers (PM2) may be required.

