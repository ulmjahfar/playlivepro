const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SystemSettings = require('../models/SystemSettings');
const Tournament = require('../models/Tournament');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for app logo uploads
const appLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'app_logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `appLogo_${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const uploadAppLogo = multer({
  storage: appLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
    }
  }
});

// Get auto-delete settings (SuperAdmin only)
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const settings = await SystemSettings.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching auto-delete settings:', error);
    res.status(500).json({ success: false, message: 'Error fetching settings' });
  }
});

// Update auto-delete settings (SuperAdmin only)
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { autoDeleteEnabled, autoDeleteDays } = req.body;

    // Validate days (minimum 7)
    if (autoDeleteDays !== undefined && (autoDeleteDays < 7 || !Number.isInteger(autoDeleteDays))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Auto-delete days must be an integer of at least 7' 
      });
    }

    const settings = await SystemSettings.getSettings();
    
    if (autoDeleteEnabled !== undefined) {
      settings.autoDeleteEnabled = autoDeleteEnabled;
    }
    if (autoDeleteDays !== undefined) {
      settings.autoDeleteDays = autoDeleteDays;
    }
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    await settings.save();

    res.json({ success: true, settings, message: 'Auto-delete settings updated successfully' });
  } catch (error) {
    console.error('Error updating auto-delete settings:', error);
    res.status(500).json({ success: false, message: 'Error updating settings' });
  }
});

// Update per-tournament auto-delete override (SuperAdmin only)
router.put('/tournament/:code/override', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { code } = req.params;
    const { autoDeleteEnabled, autoDeleteDays } = req.body;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // If autoDeleteEnabled is explicitly set to false, disable auto-delete for this tournament
    if (autoDeleteEnabled === false) {
      tournament.autoDeleteEnabled = false;
      tournament.autoDeleteAt = null;
      tournament.autoDeleteDays = null;
    } else if (autoDeleteEnabled === true) {
      // If enabled, use custom days if provided, otherwise use system setting
      const systemSettings = await SystemSettings.getSettings();
      const daysToUse = autoDeleteDays || systemSettings.autoDeleteDays;
      
      if (daysToUse < 7) {
        return res.status(400).json({ 
          success: false, 
          message: 'Auto-delete days must be at least 7' 
        });
      }

      tournament.autoDeleteEnabled = true;
      tournament.autoDeleteDays = autoDeleteDays || null; // null means use system setting
      
      // Recalculate autoDeleteAt if auction is already completed
      if (tournament.auctionEndedAt || tournament.auctionState?.completedAt) {
        const completionDate = tournament.auctionState?.completedAt || tournament.auctionEndedAt;
        const deleteDate = new Date(completionDate);
        deleteDate.setDate(deleteDate.getDate() + daysToUse);
        tournament.autoDeleteAt = deleteDate;
      }
    } else if (autoDeleteEnabled === null) {
      // Reset to use system setting
      tournament.autoDeleteEnabled = null;
      tournament.autoDeleteDays = null;
      
      // Recalculate autoDeleteAt based on system settings
      const systemSettings = await SystemSettings.getSettings();
      if (systemSettings.autoDeleteEnabled && (tournament.auctionEndedAt || tournament.auctionState?.completedAt)) {
        const completionDate = tournament.auctionState?.completedAt || tournament.auctionEndedAt;
        const deleteDate = new Date(completionDate);
        deleteDate.setDate(deleteDate.getDate() + systemSettings.autoDeleteDays);
        tournament.autoDeleteAt = deleteDate;
      } else {
        tournament.autoDeleteAt = null;
      }
    }

    await tournament.save();
    res.json({ success: true, tournament, message: 'Tournament auto-delete override updated' });
  } catch (error) {
    console.error('Error updating tournament auto-delete override:', error);
    res.status(500).json({ success: false, message: 'Error updating override' });
  }
});

// Get app logo (public endpoint)
router.get('/app-logo', async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    if (settings.appLogo) {
      res.json({ 
        success: true, 
        logoPath: settings.appLogo,
        logoUrl: `${req.protocol}://${req.get('host')}/${settings.appLogo}`
      });
    } else {
      res.json({ success: true, logoPath: null, logoUrl: null });
    }
  } catch (error) {
    console.error('Error fetching app logo:', error);
    res.status(500).json({ success: false, message: 'Error fetching app logo' });
  }
});

// Update app logo (SuperAdmin only)
router.put('/app-logo', authenticateToken, uploadAppLogo.single('logo'), async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const settings = await SystemSettings.getSettings();
    
    // Delete old logo if exists
    if (settings.appLogo) {
      const oldLogoPath = path.join(__dirname, '..', settings.appLogo);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch (err) {
          console.error('Error deleting old logo:', err);
        }
      }
    }

    if (req.file) {
      // Save relative path
      settings.appLogo = `uploads/app_logos/${req.file.filename}`;
      settings.updatedBy = req.user.id;
      settings.updatedAt = new Date();
      await settings.save();

      res.json({ 
        success: true, 
        message: 'App logo updated successfully',
        logoPath: settings.appLogo,
        logoUrl: `${req.protocol}://${req.get('host')}/${settings.appLogo}`
      });
    } else {
      res.status(400).json({ success: false, message: 'No file uploaded' });
    }
  } catch (error) {
    console.error('Error updating app logo:', error);
    res.status(500).json({ success: false, message: 'Error updating app logo' });
  }
});

// Delete app logo (SuperAdmin only)
router.delete('/app-logo', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const settings = await SystemSettings.getSettings();
    
    if (settings.appLogo) {
      const oldLogoPath = path.join(__dirname, '..', settings.appLogo);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
        } catch (err) {
          console.error('Error deleting logo:', err);
        }
      }
      
      settings.appLogo = null;
      settings.updatedBy = req.user.id;
      settings.updatedAt = new Date();
      await settings.save();

      res.json({ success: true, message: 'App logo deleted successfully' });
    } else {
      res.json({ success: true, message: 'No logo to delete' });
    }
  } catch (error) {
    console.error('Error deleting app logo:', error);
    res.status(500).json({ success: false, message: 'Error deleting app logo' });
  }
});

module.exports = router;



