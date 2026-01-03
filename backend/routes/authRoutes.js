const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');
const router = express.Router();

// Helper function to safely resolve file paths and prevent path traversal attacks
const resolveSafeUploadPath = (storedValue = '', baseDir = 'uploads') => {
  if (!storedValue) return null;
  // Reject paths containing ".." to prevent directory traversal
  if (storedValue.includes('..')) {
    console.warn(`⚠️ Rejected path traversal attempt: ${storedValue}`);
    return null;
  }
  // Normalize path separators and ensure it's within the base directory
  const normalized = storedValue.replace(/\\/g, '/').replace(/^\/+/, '');
  // Only allow paths that start with the base directory or are relative to it
  const relative = normalized.startsWith(`${baseDir}/`)
    ? normalized
    : path.join(baseDir, normalized);
  return path.join(__dirname, '..', relative);
};

// Helper function to safely delete a file if it exists
const safeDeleteFile = (storedValue = '', baseDir = 'uploads') => {
  const absolutePath = resolveSafeUploadPath(storedValue, baseDir);
  if (absolutePath && fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      return true;
    } catch (err) {
      console.error(`✗ Error deleting file ${storedValue}:`, err.message);
      return false;
    }
  }
  return false;
};

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs (temporarily increased for testing)
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') || authHeader;
  
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ success: false, message: 'Access denied: No token provided' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = verified;
    console.log('Token verified:', { id: verified.id, role: verified.role });
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Token verification failed' });
  }
};

// Role-based access middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden' });
    }
    next();
  };
};

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, tournamentId } = req.body;

    // Validate role
    if (!['SuperAdmin', 'TournamentAdmin', 'TournamentManager', 'AuctionController', 'Player'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // For TournamentAdmin/TournamentManager/AuctionController, tournamentId is required
    if ((role === 'TournamentAdmin' || role === 'TournamentManager' || role === 'AuctionController') && !tournamentId) {
      return res.status(400).json({ success: false, message: `Tournament ID required for ${role}` });
    }

    const user = new User({ username, email, password, role, tournamentId });
    await user.save();

    res.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error registering user' });
  }
});

// Unified Login for Super Admin and Tournament Admin
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate required fields
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Username, password, and role are required' });
    }

    // Map frontend roles to backend roles
    const roleMapping = {
      'SUPER_ADMIN': 'SuperAdmin',
      'TOURNAMENT_ADMIN': 'TournamentAdmin',
      'TOURNAMENT_MANAGER': 'TournamentManager',
      'AUCTION_CONTROLLER': 'AuctionController'
    };

    const backendRole = roleMapping[role];
    if (!backendRole) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    let user;
    let redirectPath = '/dashboard/superadmin';
    let tournamentDetails = {};

    if (backendRole === 'TournamentAdmin' || backendRole === 'TournamentManager' || backendRole === 'AuctionController') {
      // For TournamentAdmin/TournamentManager/AuctionController, find user by username
      user = await User.findOne({
        username: new RegExp(`^${username}$`, 'i'),
        role: backendRole
      });

      if (!user) {
        const roleMessages = {
          'TournamentManager': 'Tournament manager',
          'AuctionController': 'Auction controller',
          'TournamentAdmin': 'Tournament admin'
        };
        return res.status(401).json({ success: false, message: `${roleMessages[backendRole] || 'User'} not found` });
      }

      // Verify password (use plainPassword for TournamentAdmin/TournamentManager/AuctionController)
      if (password !== user.plainPassword) {
        return res.status(401).json({ success: false, message: 'Incorrect password' });
      }

      // Find the associated tournament
      const tournament = await Tournament.findOne({ 
        $or: [
          { adminId: user._id },
          { _id: user.tournamentId }
        ]
      });
      if (!tournament) {
        return res.status(401).json({ success: false, message: 'Tournament not found for this user' });
      }

      redirectPath = `/tournament/${tournament.code}/overview`;
      tournamentDetails = {
        tournamentCode: tournament.code,
        tournamentName: tournament.name,
        tournamentId: tournament._id
      };
    } else {
      // For SuperAdmin, normal username/email lookup
      user = await User.findOne({
        $or: [
          { username: new RegExp(`^${username}$`, 'i') },
          { email: new RegExp(`^${username}$`, 'i') }
        ]
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'User does not exist.' });
      }

      // Verify password with bcrypt
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Incorrect username or password.' });
      }

      // Check role match
      if (user.role !== backendRole) {
        return res.status(403).json({ success: false, message: 'Access denied for this role.' });
      }
    }

    // Issue JWT token (24 hours expiry)
    const token = jwt.sign(
      { id: user._id, role: user.role, tournamentId: user.tournamentId },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        tournamentId: user.tournamentId
      },
      redirectPath,
      ...tournamentDetails
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Connection issue. Please retry.' });
  }
});

// Get current user (protected)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('tournamentId');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

// Update user profile (protected)
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const { email, mobile } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
      user.email = email;
    }

    // Update mobile if provided
    if (mobile !== undefined) {
      user.mobile = mobile;
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'No account found with this email.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Send email
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'https://playlive.ddns.me'}/reset-password/${resetToken}`;
    const mailOptions = {
      from: 'noreply@playlive.ddns.me',
      to: email,
      subject: '🛡️ PlayLive Password Reset Request',
      html: `
        <p>Hello ${user.username},</p>
        <p>We received a request to reset your PlayLive account password.</p>
        <p>To reset your password, click the link below:</p>
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn’t request a password reset, you can safely ignore this email.</p>
        <p>— The PlayLive Support Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Password reset instructions have been sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error sending reset email' });
  }
});

// Verify Reset Token
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }
    res.json({ success: true, message: 'Token is valid.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error verifying token' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
});

// Full System Reset (SuperAdmin only)
router.post('/full-reset', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    console.log('🔥 Starting full system reset...');
    
    // Step 1: Delete all tournaments and their associated data
    console.log('📋 Step 1: Deleting tournaments...');
    const tournaments = await Tournament.find({});
    const adminIds = tournaments.map(t => t.adminId).filter(id => id);
    
    for (const tournament of tournaments) {
      // Delete tournament logo (safe path validation)
      if (tournament.logo) {
        const logoPath = tournament.logo.startsWith('uploads/')
          ? resolveSafeUploadPath(tournament.logo, 'uploads')
          : resolveSafeUploadPath(tournament.logo, 'uploads/tournament_logos');
        if (logoPath && fs.existsSync(logoPath)) {
          try {
            fs.unlinkSync(logoPath);
            console.log(`  ✓ Deleted tournament logo: ${tournament.logo}`);
          } catch (err) {
            console.error(`  ✗ Error deleting logo ${tournament.logo}:`, err.message);
          }
        }
      }
      
      // Delete tournament confirmation files
      const confirmationPath = path.join(__dirname, '../uploads/confirmations');
      if (fs.existsSync(confirmationPath)) {
        const confirmationFiles = fs.readdirSync(confirmationPath).filter(file => 
          file.startsWith(`${tournament.code}-`)
        );
        for (const file of confirmationFiles) {
          try {
            fs.unlinkSync(path.join(confirmationPath, file));
            console.log(`  ✓ Deleted confirmation: ${file}`);
          } catch (err) {
            console.error(`  ✗ Error deleting confirmation ${file}:`, err.message);
          }
        }
      }
    }
    
    // Delete all tournament documents first
    const tournamentDeleteResult = await Tournament.deleteMany({});
    console.log(`  ✓ Deleted ${tournamentDeleteResult.deletedCount} tournaments`);
    
    // Delete tournament admin users after tournaments are deleted
    for (const adminId of adminIds) {
      try {
        await User.findByIdAndDelete(adminId);
        console.log(`  ✓ Deleted tournament admin: ${adminId}`);
      } catch (err) {
        console.error(`  ✗ Error deleting admin ${adminId}:`, err.message);
      }
    }
    
    // Step 2: Delete all players and their files
    console.log('👥 Step 2: Deleting players...');
    const players = await Player.find({});
    
    for (const player of players) {
      // Delete player photo (safe path validation)
      if (player.photo) {
        // Handle both relative paths and full paths
        const photoPath = player.photo.startsWith('uploads/')
          ? resolveSafeUploadPath(player.photo, 'uploads')
          : resolveSafeUploadPath(player.photo, 'uploads/players');
        if (photoPath && fs.existsSync(photoPath)) {
          try {
            fs.unlinkSync(photoPath);
            console.log(`  ✓ Deleted player photo: ${player.photo}`);
          } catch (err) {
            console.error(`  ✗ Error deleting photo ${player.photo}:`, err.message);
          }
        }
      }
      
      // Delete player card PDF (safe path validation)
      if (player.cardPath) {
        const cardPath = resolveSafeUploadPath(player.cardPath, 'player_cards');
        if (cardPath && fs.existsSync(cardPath)) {
          try {
            fs.unlinkSync(cardPath);
            console.log(`  ✓ Deleted player card: ${player.cardPath}`);
          } catch (err) {
            console.error(`  ✗ Error deleting card ${player.cardPath}:`, err.message);
          }
        }
      }
    }
    
    const playerDeleteResult = await Player.deleteMany({});
    console.log(`  ✓ Deleted ${playerDeleteResult.deletedCount} players`);
    
    // Step 3: Delete all teams and their files
    console.log('🏆 Step 3: Deleting teams...');
    const teams = await Team.find({});
    
    for (const team of teams) {
      // Delete team logo (safe path validation)
      if (team.logo) {
        // Try both possible locations with safe path resolution
        const logoPath1 = team.logo.startsWith('uploads/')
          ? resolveSafeUploadPath(team.logo, 'uploads')
          : resolveSafeUploadPath(team.logo, 'uploads/teams');
        if (logoPath1 && fs.existsSync(logoPath1)) {
          try {
            fs.unlinkSync(logoPath1);
            console.log(`  ✓ Deleted team logo: ${team.logo}`);
          } catch (err) {
            console.error(`  ✗ Error deleting logo ${team.logo}:`, err.message);
          }
        }
        
        // Also check team_logos directory
        const logoPath2 = resolveSafeUploadPath(team.logo, 'uploads/team_logos');
        if (logoPath2 && fs.existsSync(logoPath2)) {
          try {
            fs.unlinkSync(logoPath2);
            console.log(`  ✓ Deleted team logo (alt): ${team.logo}`);
          } catch (err) {
            // Ignore if file doesn't exist
          }
        }
      }
      
      // Delete guest player photos (safe path validation)
      if (team.guestPlayers && Array.isArray(team.guestPlayers)) {
        for (const guest of team.guestPlayers) {
          if (guest.photo) {
            const guestPhotoPath = guest.photo.startsWith('uploads/')
              ? resolveSafeUploadPath(guest.photo, 'uploads')
              : resolveSafeUploadPath(guest.photo, 'uploads/guest_photos');
            if (guestPhotoPath && fs.existsSync(guestPhotoPath)) {
              try {
                fs.unlinkSync(guestPhotoPath);
                console.log(`  ✓ Deleted guest photo: ${guest.photo}`);
              } catch (err) {
                console.error(`  ✗ Error deleting guest photo ${guest.photo}:`, err.message);
              }
            }
          }
        }
      }
    }
    
    const teamDeleteResult = await Team.deleteMany({});
    console.log(`  ✓ Deleted ${teamDeleteResult.deletedCount} teams`);
    
    // Step 4: Delete all TournamentAdmin users (keep SuperAdmin)
    console.log('👤 Step 4: Deleting tournament admin users...');
    const adminDeleteResult = await User.deleteMany({ role: { $ne: 'SuperAdmin' } });
    console.log(`  ✓ Deleted ${adminDeleteResult.deletedCount} non-SuperAdmin users`);
    
    // Step 5: Delete all audit logs
    console.log('📝 Step 5: Deleting audit logs...');
    const auditDeleteResult = await AuditLog.deleteMany({});
    console.log(`  ✓ Deleted ${auditDeleteResult.deletedCount} audit logs`);
    
    // Step 6: Clean up any remaining uploaded files
    console.log('🗑️ Step 6: Cleaning up remaining files...');
    const uploadDirs = [
      path.join(__dirname, '../uploads/players'),
      path.join(__dirname, '../uploads/teams'),
      path.join(__dirname, '../uploads/team_logos'),
      path.join(__dirname, '../uploads/tournament_logos'),
      path.join(__dirname, '../uploads/guest_photos'),
      path.join(__dirname, '../uploads/confirmations'),
      path.join(__dirname, '../player_cards'),
      path.join(__dirname, '../reports')
    ];
    
    for (const dir of uploadDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              if (fs.statSync(filePath).isFile()) {
                fs.unlinkSync(filePath);
                console.log(`  ✓ Deleted file: ${file}`);
              }
            } catch (err) {
              console.error(`  ✗ Error deleting file ${file}:`, err.message);
            }
          }
        } catch (err) {
          console.error(`  ✗ Error reading directory ${dir}:`, err.message);
        }
      }
    }
    
    console.log('✅ Full system reset completed successfully!');
    
    res.json({ 
      success: true, 
      message: 'Full system reset completed successfully',
      deleted: {
        tournaments: tournamentDeleteResult.deletedCount,
        players: playerDeleteResult.deletedCount,
        teams: teamDeleteResult.deletedCount,
        users: adminDeleteResult.deletedCount,
        auditLogs: auditDeleteResult.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ Error during full system reset:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error during system reset: ' + error.message 
    });
  }
});

module.exports = { router, authenticateToken, authorizeRoles };
