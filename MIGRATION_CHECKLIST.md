# Quick Migration Checklist

## ✅ Pre-Migration

- [ ] Backup database from old system
- [ ] Note down current environment variables
- [ ] List all uploaded files you want to keep
- [ ] Document current MongoDB connection details

## 📦 Transfer Files

- [ ] Copy project folder (excluding `node_modules`)
- [ ] Transfer database backup (if keeping data)
- [ ] Transfer `backend/uploads/` folder (if keeping files)

## 🔧 Setup on New System

- [ ] Install Node.js (v14+)
- [ ] Install MongoDB
- [ ] Create `backend/.env` file with correct values
- [ ] Create `frontend/.env` file with correct values
- [ ] Run `npm install` in `backend/` folder
- [ ] Run `npm install` in `frontend/` folder

## 🗄️ Database

- [ ] Start MongoDB service
- [ ] Import database backup (if using)
- [ ] Verify database connection

## 🚀 Start Application

- [ ] Start backend: `cd backend && npm start`
- [ ] Start frontend: `cd frontend && npm start`
- [ ] Test login functionality
- [ ] Verify data is accessible

## 🔐 Security

- [ ] Change JWT_SECRET
- [ ] Update database passwords
- [ ] Review CORS settings
- [ ] Check file permissions

---

**See `MIGRATION_GUIDE.md` for detailed instructions.**




