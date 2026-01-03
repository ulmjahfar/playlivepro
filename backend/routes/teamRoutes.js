const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const { authenticateToken } = require('./authRoutes');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const {
  parseCSV,
  parseExcel,
  autoDetectColumns,
  validateTeamData,
  processLogoPath,
  mapRowToTeam
} = require('../utils/teamImportHelper');

const sanitizeUploadPath = (input) => {
  if (!input || typeof input !== 'string') return '';
  const normalized = input.trim().replace(/\\/g, '/');
  const withoutLeadingSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  if (withoutLeadingSlash.includes('..')) {
    return '';
  }
  return withoutLeadingSlash;
};

const DEFAULT_SEAT_POLICY = {
  mode: 'single',
  votersRequired: 1,
  allowDynamicQuorum: true,
  allowLeadOverride: true,
  autoResetOnBid: true
};

const generateTeamAccessCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const generateSeatAccessCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const generateSeatPin = () => Math.floor(100000 + Math.random() * 900000).toString();

const findTeamByIdentifier = async (identifier, options = {}) => {
  if (!identifier) return null;

  const selectFields = ['+auctionAccessCode'];
  const includeSeats = options.includeSeats !== false;

  if (includeSeats) {
    selectFields.push('+seats');
    if (options.includeSeatSecrets) {
      selectFields.push('+seats.pinHash');
    }
  }

  const selectString = selectFields.join(' ');

  let team = await Team.findOne({ teamId: identifier }).select(selectString);
  if (!team && mongoose.Types.ObjectId.isValid(identifier)) {
    team = await Team.findById(identifier).select(selectString);
  }
  return team;
};

const formatSeatResponse = (seat) => ({
  id: seat._id,
  label: seat.label,
  role: seat.role,
  email: seat.email,
  phone: seat.phone,
  status: seat.status,
  isVoter: seat.isVoter,
  isLead: seat.isLead,
  accessCode: seat.accessCode,
  lastLoginAt: seat.lastLoginAt,
  lastVoteAt: seat.lastVoteAt,
  createdAt: seat.createdAt,
  notes: seat.notes
});

const assertTeamAdminAccess = async (req, team) => {
  if (!req.user || !req.user.role) {
    const error = new Error('Access denied: Authentication required');
    error.status = 401;
    throw error;
  }

  const userRole = req.user.role;
  const isSuperAdmin = userRole === 'SuperAdmin';
  const isTournamentAdmin = userRole === 'TournamentAdmin';

  if (!isSuperAdmin && !isTournamentAdmin) {
    const error = new Error('Access denied: Insufficient permissions');
    error.status = 403;
    throw error;
  }

  if (isTournamentAdmin && !isSuperAdmin) {
    const tournament = await Tournament.findOne({ code: team.tournamentCode });
    if (!tournament || !tournament.adminId) {
      const error = new Error('Access denied: Tournament ownership mismatch');
      error.status = 403;
      throw error;
    }

    const tournamentAdminId = tournament.adminId.toString();
    const userId = req.user.id.toString();

    if (tournamentAdminId !== userId) {
      const error = new Error('Access denied: You can only manage teams from your tournament');
      error.status = 403;
      throw error;
    }
  }

  return { isSuperAdmin };
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Upload Team Logo
router.post('/upload-logo', upload.single('image'), async (req, res) => {
  try {
    const { uploadType } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Detect if file is PNG
    const isPNG = req.file.mimetype === 'image/png';
    const fileExtension = isPNG ? 'png' : 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const filename = `${uploadType}_${timestamp}_${randomId}.${fileExtension}`;

    const uploadsDir = path.join(__dirname, '../uploads/teams');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    
    // Process image with format-specific settings
    const sharpInstance = sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true });

    if (isPNG) {
      await sharpInstance
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(filepath);
    } else {
      await sharpInstance
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toFile(filepath);
    }

    const imageUrl = `/uploads/teams/${filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ message: 'Failed to upload logo' });
  }
});

// Upload Player Photo
router.post('/upload-photo', upload.single('image'), async (req, res) => {
  try {
    const { uploadType } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const filename = `${uploadType}_${timestamp}_${randomId}.jpg`;

    const uploadsDir = path.join(__dirname, '../uploads/guest_photos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);
    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true, mozjpeg: true })
      .toFile(filepath);

    const imageUrl = `/uploads/guest_photos/${filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// 🧩 Register team
router.post('/register/:code', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'guestPhotos', maxCount: 5 } // Up to 5 guest photos
]), async (req, res) => {
  try {
    const { code } = req.params;
    const {
      name,
      captainName,
      mobile,
      email,
      city,
      numberOfPlayers,
      guestPlayers,
      teamIcons,
      logoPath: logoPathBody,
      guestPhotoUrls
    } = req.body;

    // Validate tournament exists and registration is active
    const tournament = await Tournament.findOne({ code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    if (!tournament.teamRegistrationEnabled) {
      return res.status(400).json({ success: false, message: 'Team registration is not active for this tournament' });
    }

    // Check if tournament team limit is reached
    if (tournament.participatingTeams) {
      const existingTeamsCount = await Team.countDocuments({ tournamentCode: code });
      if (existingTeamsCount >= tournament.participatingTeams) {
        return res.status(400).json({ 
          success: false, 
          message: `Tournament team limit reached. Maximum ${tournament.participatingTeams} teams allowed.` 
        });
      }
    }

    // Validate player count
    const numPlayers = parseInt(numberOfPlayers);
    if (numPlayers < tournament.minPlayers || numPlayers > tournament.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: `Team size must be between ${tournament.minPlayers} and ${tournament.maxPlayers} players.`
      });
    }

    // Validate required fields
    if (!name || !captainName || !mobile || !email || !city) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    // Validate mobile (Indian format)
    const mobileRegex = /^(\+91|\+966)?[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Enter valid mobile number.' });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    // Validate team name (uppercase only, min 3 chars)
    if (name !== name.toUpperCase() || name.length < 3) {
      return res.status(400).json({ success: false, message: 'Team name must be uppercase and at least 3 characters.' });
    }

    const sanitizedTeamName = name.trim().replace(/\s+/g, '_');

    // Handle logo upload
    let logoPath = null;
    const normalizedLogoPath = sanitizeUploadPath(logoPathBody);

    if (normalizedLogoPath && normalizedLogoPath.startsWith('uploads/')) {
      logoPath = normalizedLogoPath;
    } else if (req.files.logo) {
      const logoFile = req.files.logo[0];

      const logoDir = path.join(__dirname, '..', 'uploads', 'team_logos');
      if (!fs.existsSync(logoDir)) {
        fs.mkdirSync(logoDir, { recursive: true });
      }

      const logoExt = logoFile.mimetype.split('/')[1] || 'jpg';
      logoPath = `uploads/team_logos/${code}_${sanitizedTeamName}_logo.${logoExt}`;
      fs.writeFileSync(path.join(__dirname, '..', logoPath), logoFile.buffer);
    } else {
      return res.status(400).json({ success: false, message: 'Team logo is required.' });
    }

    // Handle guest players
    let guestPlayersData = [];
    let guestPayload = [];
    if (guestPlayers) {
      if (Array.isArray(guestPlayers)) {
        guestPayload = guestPlayers.map((g) => (typeof g === 'string' ? JSON.parse(g) : g));
      } else if (typeof guestPlayers === 'string') {
        try {
          const parsed = JSON.parse(guestPlayers);
          guestPayload = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
          console.error('Invalid guestPlayers payload:', parseErr);
        }
      }
    }

    let guestPhotoPathList = [];
    if (guestPhotoUrls) {
      const normalizeGuestPhotoPath = (url) => {
        const sanitized = sanitizeUploadPath(url);
        return sanitized && sanitized.startsWith('uploads/') ? sanitized : '';
      };

      if (Array.isArray(guestPhotoUrls)) {
        guestPhotoPathList = guestPhotoUrls.map((url) => normalizeGuestPhotoPath(url));
      } else if (typeof guestPhotoUrls === 'string') {
        try {
          const parsedGuestPhotoUrls = JSON.parse(guestPhotoUrls);
          if (Array.isArray(parsedGuestPhotoUrls)) {
            guestPhotoPathList = parsedGuestPhotoUrls.map((url) => normalizeGuestPhotoPath(url));
          }
        } catch (parseErr) {
          console.error('Invalid guestPhotoUrls payload:', parseErr);
        }
      }
    }

    for (let i = 0; i < guestPayload.length; i++) {
      const guest = guestPayload[i];
      if (!guest) continue;
      let photoPath = null;
      if (req.files.guestPhotos && req.files.guestPhotos[i]) {
        const photoFile = req.files.guestPhotos[i];

        const guestDir = path.join(__dirname, '..', 'uploads', 'guest_photos');
        if (!fs.existsSync(guestDir)) {
          fs.mkdirSync(guestDir, { recursive: true });
        }

        const guestExt = photoFile.mimetype.split('/')[1] || 'jpg';
        photoPath = `uploads/guest_photos/${code}_${sanitizedTeamName}_guest_${i}.${guestExt}`;
        fs.writeFileSync(path.join(__dirname, '..', photoPath), photoFile.buffer);
      } else if (guestPhotoPathList[i]) {
        photoPath = guestPhotoPathList[i];
      }
      guestPlayersData.push({
        name: guest.name,
        role: guest.role,
        photo: photoPath
      });
    }

    let teamIconPayload = [];
    if (teamIcons) {
      if (Array.isArray(teamIcons)) {
        teamIconPayload = teamIcons;
      } else if (typeof teamIcons === 'string') {
        try {
          const parsed = JSON.parse(teamIcons);
          teamIconPayload = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
          console.error('Invalid teamIcons payload:', parseErr);
        }
      }
    }

    // Re-check team count immediately before saving to prevent race condition
    // This ensures we don't exceed the limit even with concurrent requests
    if (tournament.participatingTeams) {
      const currentTeamsCount = await Team.countDocuments({ tournamentCode: code });
      if (currentTeamsCount >= tournament.participatingTeams) {
        return res.status(400).json({ 
          success: false, 
          message: `Tournament team limit reached. Maximum ${tournament.participatingTeams} teams allowed.` 
        });
      }
    }

    // Generate team ID
    const existingTeamsCount = await Team.countDocuments({ tournamentCode: code });
    const teamId = `${code}-T${String(existingTeamsCount + 1).padStart(3, '0')}`;

    const pdfRelativePath = `uploads/confirmations/${teamId}_confirmation.pdf`;

    // Get budget from tournament
    const teamBudget = tournament.auctionRules?.maxFundForTeam || 0;

    // Create team
    const team = new Team({
      teamId,
      name,
      logo: logoPath,
      captainName,
      mobile,
      email,
      city,
      numberOfPlayers: numPlayers,
      guestPlayers: guestPlayersData,
      teamIcons: teamIconPayload,
      tournamentCode: code,
      budget: teamBudget,
      currentBalance: teamBudget,
      confirmationPdf: pdfRelativePath,
      auctionAccessCode: generateTeamAccessCode()
    });

    await team.save();

    // Check if team limit is reached and automatically close registration
    if (tournament.participatingTeams) {
      const finalTeamsCount = await Team.countDocuments({ tournamentCode: code });
      if (finalTeamsCount >= tournament.participatingTeams) {
        // Auto-disable team registration when limit is reached
        tournament.teamRegistrationEnabled = false;
        await tournament.save();
        console.log(`Team registration automatically closed for tournament ${code} - limit reached (${finalTeamsCount}/${tournament.participatingTeams})`);
      }
    }

    // Generate PDF confirmation
    const confirmationsDir = path.join(__dirname, '..', 'uploads', 'confirmations');
    if (!fs.existsSync(confirmationsDir)) {
      fs.mkdirSync(confirmationsDir, { recursive: true });
    }

    const pdfAbsolutePath = path.join(__dirname, '..', pdfRelativePath);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfAbsolutePath));

    doc.fontSize(20).text(`${tournament.name}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('TEAM REGISTRATION CONFIRMATION', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Team ID: ${teamId}`);
    doc.text(`Team Name: ${name}`);
    doc.text(`Captain: ${captainName}`);
    doc.text(`City: ${city}`);
    doc.text(`Mobile: ${mobile}`);
    doc.text(`Email: ${email}`);
    doc.moveDown();
    doc.text('Powered by PlayLive');
    doc.end();

    res.json({
      success: true,
      message: 'Team registered successfully',
      teamId,
      confirmationPdf: pdfRelativePath,
      remoteAccessCode: team.auctionAccessCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error registering team' });
  }
});

router.get('/admin/:teamId/auction-pro', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    if (!team.auctionAccessCode) {
      team.auctionAccessCode = generateTeamAccessCode();
      await team.save();
    }

    const seatPolicy = {
      ...DEFAULT_SEAT_POLICY,
      ...(team.seatPolicy?.toObject ? team.seatPolicy.toObject() : team.seatPolicy || {})
    };

    const seats = Array.isArray(team.seats)
      ? team.seats.map((seat) => formatSeatResponse(seat))
      : [];

    res.json({
      success: true,
      teamId: team._id,
      teamCode: team.teamId,
      tournamentCode: team.tournamentCode,
      auctionAccessCode: team.auctionAccessCode,
      seatPolicy,
      seats
    });
  } catch (error) {
    console.error('Error loading auction pro settings:', error);
    res.status(500).json({ success: false, message: 'Unable to load Auction Pro settings' });
  }
});

router.patch('/admin/:teamId/seat-policy', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    const nextPolicy = {
      ...DEFAULT_SEAT_POLICY,
      ...(req.body || {})
    };

    nextPolicy.votersRequired = Math.max(1, parseInt(nextPolicy.votersRequired, 10) || 1);

    team.seatPolicy = nextPolicy;
    await team.save();

    res.json({
      success: true,
      seatPolicy: team.seatPolicy
    });
  } catch (error) {
    console.error('Error updating seat policy:', error);
    res.status(500).json({ success: false, message: 'Unable to update seat policy' });
  }
});

router.post('/admin/:teamId/seats', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    if (!team.auctionAccessCode) {
      team.auctionAccessCode = generateTeamAccessCode();
    }

    const { label, role = 'Lead', email, phone, isVoter = true, isLead = false, notes } = req.body || {};
    if (!label) {
      return res.status(400).json({ success: false, message: 'Seat label is required' });
    }

    const pin = generateSeatPin();
    const pinHash = await bcrypt.hash(pin, 10);

    const seatPayload = {
      label: label.trim(),
      role,
      email,
      phone,
      status: 'Invited',
      isVoter,
      isLead,
      accessCode: generateSeatAccessCode(),
      pinHash,
      notes
    };

    team.seats = team.seats || [];
    team.seats.push(seatPayload);
    await team.save();

    const createdSeat = team.seats[team.seats.length - 1];

    res.json({
      success: true,
      seat: formatSeatResponse(createdSeat),
      credentials: {
        seatCode: createdSeat.accessCode,
        pin
      }
    });
  } catch (error) {
    console.error('Error creating seat:', error);
    res.status(500).json({ success: false, message: 'Unable to create seat' });
  }
});

router.patch('/admin/:teamId/seats/:seatId', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    const seat = team.seats?.id(req.params.seatId);
    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found' });
    }

    const updatableFields = ['label', 'role', 'email', 'phone', 'status', 'isVoter', 'isLead', 'notes'];
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        seat[field] = req.body[field];
      }
    });

    await team.save();

    res.json({
      success: true,
      seat: formatSeatResponse(seat)
    });
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ success: false, message: 'Unable to update seat' });
  }
});

router.post('/admin/:teamId/seats/:seatId/reset-pin', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    const seat = team.seats?.id(req.params.seatId);
    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found' });
    }

    const newPin = generateSeatPin();
    seat.pinHash = await bcrypt.hash(newPin, 10);
    seat.authVersion = (seat.authVersion || 0) + 1;
    seat.status = 'Invited';
    await team.save();

    res.json({
      success: true,
      seat: formatSeatResponse(seat),
      credentials: {
        seatCode: seat.accessCode,
        pin: newPin
      }
    });
  } catch (error) {
    console.error('Error resetting seat pin:', error);
    res.status(500).json({ success: false, message: 'Unable to reset seat pin' });
  }
});

router.delete('/admin/:teamId/seats/:seatId', authenticateToken, async (req, res) => {
  try {
    const team = await findTeamByIdentifier(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    const seat = team.seats?.id(req.params.seatId);
    if (!seat) {
      return res.status(404).json({ success: false, message: 'Seat not found' });
    }

    seat.deleteOne();
    await team.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting seat:', error);
    res.status(500).json({ success: false, message: 'Unable to delete seat' });
  }
});

router.post('/seat/login', async (req, res) => {
  try {
    const { teamCode, seatCode, pin, tournamentCode } = req.body || {};
    if (!teamCode || !seatCode || !pin) {
      return res.status(400).json({ success: false, message: 'Team, seat, and PIN are required' });
    }

    const team = await findTeamByIdentifier(teamCode, { includeSeatSecrets: true });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (tournamentCode && team.tournamentCode !== tournamentCode) {
      return res.status(400).json({ success: false, message: 'Team not part of this tournament' });
    }

    const tournament = await Tournament.findOne({ code: team.tournamentCode });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found for this team' });
    }

    if (tournament.plan !== 'AuctionPro') {
      return res.status(403).json({ success: false, message: 'Remote auction seats are not enabled for this tournament' });
    }

    const seat = team.seats?.find((item) => item.accessCode === seatCode);
    if (!seat) {
      return res.status(404).json({ success: false, message: 'Invalid seat code' });
    }

    if (seat.status === 'Disabled') {
      return res.status(403).json({ success: false, message: 'Seat is disabled. Please contact admin.' });
    }

    const pinMatch = await bcrypt.compare(pin, seat.pinHash);
    if (!pinMatch) {
      return res.status(401).json({ success: false, message: 'Invalid pin supplied' });
    }

    seat.status = 'Active';
    seat.lastLoginAt = new Date();
    await team.save();

    const tokenPayload = {
      type: 'TeamSeat',
      seatMongoId: seat._id.toString(),
      seatLabel: seat.label,
      teamMongoId: team._id.toString(),
      teamId: team.teamId,
      tournamentCode: team.tournamentCode,
      role: seat.role,
      isVoter: seat.isVoter,
      isLead: seat.isLead,
      authVersion: seat.authVersion || 0
    };

    const seatToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secretkey', {
      expiresIn: '12h'
    });

    res.json({
      success: true,
      seatToken,
      seat: formatSeatResponse(seat),
      team: {
        id: team._id,
        teamId: team.teamId,
        name: team.name,
        tournamentCode: team.tournamentCode
      }
    });
  } catch (error) {
    console.error('Seat login error:', error);
    res.status(500).json({ success: false, message: 'Unable to login with seat credentials' });
  }
});

const buildTeamDetailsResponse = async (team) => {
  let purchasedPlayers = [];
  if (team.purchasedPlayers && team.purchasedPlayers.length > 0) {
    purchasedPlayers = await Player.find({ _id: { $in: team.purchasedPlayers } })
      .select('name playerId role photo soldPrice auctionStatus')
      .lean();
  }

  const tournament = await Tournament.findOne({ code: team.tournamentCode });

  return {
    success: true,
    team: {
      ...team.toObject(),
      purchasedPlayers
    },
    tournament
  };
};

// 🧾 Get team details by teamId (supports legacy teamId or MongoDB _id)
router.get('/details/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    let team = await Team.findOne({ teamId });

    if (!team && mongoose.Types.ObjectId.isValid(teamId)) {
      team = await Team.findById(teamId);
    }

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const response = await buildTeamDetailsResponse(team);
    res.json(response);
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ success: false, message: 'Error fetching team details' });
  }
});

// 🧾 Get team details by MongoDB _id
router.get('/by-id/:_id', async (req, res) => {
  try {
    let team;
    
    // Check if _id is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(req.params._id)) {
      team = await Team.findById(req.params._id);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid team ID format' });
    }
    
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const response = await buildTeamDetailsResponse(team);
    res.json(response);
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ success: false, message: 'Error fetching team details' });
  }
});

// 🧾 Get teams for a tournament
router.get('/:code', async (req, res) => {
  try {
    const teams = await Team.find({ tournamentCode: req.params.code }).sort({ createdAt: -1 });
    res.json({ success: true, teams });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching teams' });
  }
});

// Update team
router.put('/:teamId', authenticateToken, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'guestPhotos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    // Debug: Log incoming request data
    console.log('Update team request body:', req.body);
    console.log('Update team request files:', req.files);

    const {
      name,
      captainName,
      mobile,
      email,
      city,
      numberOfPlayers,
      guestPlayers,
      teamIcons,
      logoPath: logoPathBody,
      guestPhotoUrls,
      group,
      groupIndex
    } = req.body;

    // Validate that we have at least some data to update
    if (!name && !captainName && !mobile && !email && !city && !numberOfPlayers && !logoPathBody && guestPlayers === undefined && group === undefined && groupIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'No data provided to update. Please provide at least one field to update.' 
      });
    }

    const tournament = await Tournament.findOne({ code: team.tournamentCode });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Validate player count
    if (numberOfPlayers) {
      const numPlayers = parseInt(numberOfPlayers);
      if (numPlayers < tournament.minPlayers || numPlayers > tournament.maxPlayers) {
        return res.status(400).json({
          success: false,
          message: `Team size must be between ${tournament.minPlayers} and ${tournament.maxPlayers} players.`
        });
      }
    }

    // Validate required fields if provided
    if (name && (name !== name.toUpperCase() || name.length < 3)) {
      return res.status(400).json({ success: false, message: 'Team name must be uppercase and at least 3 characters.' });
    }

    if (mobile) {
      const mobileRegex = /^(\+91|\+966)?[6-9]\d{9}$/;
      if (!mobileRegex.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Enter valid mobile number.' });
      }
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      }
    }

    const sanitizedTeamName = name ? name.trim().replace(/\s+/g, '_') : team.name.trim().replace(/\s+/g, '_');

    // Handle logo update
    let logoPath = team.logo;
    const normalizedLogoPath = sanitizeUploadPath(logoPathBody);

    if (normalizedLogoPath && normalizedLogoPath.startsWith('uploads/')) {
      logoPath = normalizedLogoPath;
    } else if (req.files && req.files.logo) {
      const logoFile = req.files.logo[0];

      // Delete old logo if exists
      if (team.logo) {
        const oldLogoPath = path.join(__dirname, '..', team.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      const logoDir = path.join(__dirname, '..', 'uploads', 'team_logos');
      if (!fs.existsSync(logoDir)) {
        fs.mkdirSync(logoDir, { recursive: true });
      }

      const logoExt = logoFile.mimetype.split('/')[1] || 'jpg';
      logoPath = `uploads/team_logos/${team.tournamentCode}_${sanitizedTeamName}_logo.${logoExt}`;
      fs.writeFileSync(path.join(__dirname, '..', logoPath), logoFile.buffer);
    }

    // Handle guest players update
    let guestPlayersData = team.guestPlayers || [];
    if (guestPlayers !== undefined) {
      let guestPayload = [];
      if (guestPlayers) {
        if (Array.isArray(guestPlayers)) {
          guestPayload = guestPlayers.map((g) => (typeof g === 'string' ? JSON.parse(g) : g));
        } else if (typeof guestPlayers === 'string') {
          try {
            const parsed = JSON.parse(guestPlayers);
            guestPayload = Array.isArray(parsed) ? parsed : [];
          } catch (parseErr) {
            console.error('Invalid guestPlayers payload:', parseErr);
          }
        }
      }

      let guestPhotoPathList = [];
      if (guestPhotoUrls) {
        const normalizeGuestPhotoPath = (url) => {
          const sanitized = sanitizeUploadPath(url);
          return sanitized && sanitized.startsWith('uploads/') ? sanitized : '';
        };

        if (Array.isArray(guestPhotoUrls)) {
          guestPhotoPathList = guestPhotoUrls.map((url) => normalizeGuestPhotoPath(url));
        } else if (typeof guestPhotoUrls === 'string') {
          try {
            const parsedGuestPhotoUrls = JSON.parse(guestPhotoUrls);
            if (Array.isArray(parsedGuestPhotoUrls)) {
              guestPhotoPathList = parsedGuestPhotoUrls.map((url) => normalizeGuestPhotoPath(url));
            }
          } catch (parseErr) {
            console.error('Invalid guestPhotoUrls payload:', parseErr);
          }
        }
      }

      guestPlayersData = [];
      for (let i = 0; i < guestPayload.length; i++) {
        const guest = guestPayload[i];
        if (!guest) continue;
        let photoPath = null;
        if (req.files && req.files.guestPhotos && req.files.guestPhotos[i]) {
          const photoFile = req.files.guestPhotos[i];

          const guestDir = path.join(__dirname, '..', 'uploads', 'guest_photos');
          if (!fs.existsSync(guestDir)) {
            fs.mkdirSync(guestDir, { recursive: true });
          }

          const guestExt = photoFile.mimetype.split('/')[1] || 'jpg';
          photoPath = `uploads/guest_photos/${team.tournamentCode}_${sanitizedTeamName}_guest_${i}.${guestExt}`;
          fs.writeFileSync(path.join(__dirname, '..', photoPath), photoFile.buffer);
        } else if (guestPhotoPathList[i]) {
          photoPath = guestPhotoPathList[i];
        } else if (team.guestPlayers && team.guestPlayers[i] && team.guestPlayers[i].photo) {
          photoPath = team.guestPlayers[i].photo;
        }
        guestPlayersData.push({
          name: guest.name,
          role: guest.role,
          photo: photoPath
        });
      }
    }

    let teamIconPayload = team.teamIcons || [];
    if (teamIcons !== undefined) {
      if (Array.isArray(teamIcons)) {
        teamIconPayload = teamIcons;
      } else if (typeof teamIcons === 'string') {
        try {
          const parsed = JSON.parse(teamIcons);
          teamIconPayload = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
          console.error('Invalid teamIcons payload:', parseErr);
        }
      }
    }

    // Update team - always update provided fields
    const updateData = {};
    
    // Update fields if they are provided (not undefined)
    // Note: empty strings are valid values, so we check for undefined specifically
    if (name !== undefined && name !== null) updateData.name = name.trim();
    if (captainName !== undefined && captainName !== null) updateData.captainName = captainName.trim();
    if (mobile !== undefined && mobile !== null) updateData.mobile = mobile.trim();
    if (email !== undefined && email !== null) updateData.email = email.trim();
    if (city !== undefined && city !== null) updateData.city = city.trim();
    
    if (numberOfPlayers !== undefined && numberOfPlayers !== null && numberOfPlayers !== '') {
      const numPlayers = parseInt(numberOfPlayers);
      if (!isNaN(numPlayers)) {
        updateData.numberOfPlayers = numPlayers;
      }
    }
    
    if (logoPath) updateData.logo = logoPath;
    if (guestPlayers !== undefined) updateData.guestPlayers = guestPlayersData;
    if (teamIcons !== undefined) updateData.teamIcons = teamIconPayload;
    
    // Handle group updates
    if (group !== undefined) {
      // If group is empty string, remove from group
      if (group === '' || group === null) {
        updateData.group = undefined;
        updateData.groupIndex = undefined;
      } else {
        updateData.group = group.trim().toUpperCase();
        // Set groupIndex if provided, otherwise keep existing or set to 0
        if (groupIndex !== undefined && groupIndex !== null && groupIndex !== '') {
          const index = parseInt(groupIndex);
          if (!isNaN(index)) {
            updateData.groupIndex = index;
          }
        } else if (updateData.group && !team.groupIndex) {
          // If setting a group but no index provided and team doesn't have one, default to 0
          updateData.groupIndex = 0;
        }
      }
    } else if (groupIndex !== undefined && groupIndex !== null && groupIndex !== '') {
      // Only update groupIndex if group is not being changed
      const index = parseInt(groupIndex);
      if (!isNaN(index)) {
        updateData.groupIndex = index;
      }
    }

    console.log('Updating team with data:', updateData);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid data provided to update.' 
      });
    }

    const updatedTeam = await Team.findByIdAndUpdate(teamId, updateData, { new: true, runValidators: true });
    
    if (!updatedTeam) {
      return res.status(404).json({ success: false, message: 'Team not found after update' });
    }

    const finalTeam = await Team.findById(teamId);
    console.log('Team updated successfully:', finalTeam?._id);

    res.json({
      success: true,
      message: 'Team updated successfully',
      team: finalTeam
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ success: false, message: 'Error updating team', error: error.message });
  }
});

// Delete team
router.delete('/:teamId', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);
    
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    await assertTeamAdminAccess(req, team);

    // Delete team logo file
    if (team.logo) {
      const teamLogoPath = path.join(__dirname, '..', team.logo);
      if (fs.existsSync(teamLogoPath)) {
        fs.unlinkSync(teamLogoPath);
        console.log('Deleted team logo file:', teamLogoPath);
      }
    }

    // Delete guest player photos
    if (team.guestPlayers && team.guestPlayers.length > 0) {
      for (const guest of team.guestPlayers) {
        if (guest.photo) {
          const guestPhotoPath = path.join(__dirname, '..', guest.photo);
          if (fs.existsSync(guestPhotoPath)) {
            fs.unlinkSync(guestPhotoPath);
            console.log('Deleted guest photo file:', guestPhotoPath);
          }
        }
      }
    }

    // Delete confirmation PDF
    if (team.confirmationPdf) {
      const pdfPath = path.join(__dirname, '..', team.confirmationPdf);
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log('Deleted confirmation PDF:', pdfPath);
      }
    }

    // Delete team document
    await Team.findByIdAndDelete(teamId);
    
    res.json({ 
      success: true, 
      message: 'Team deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ success: false, message: 'Error deleting team' });
  }
});

// Download import template
router.get('/import/template/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const tournament = await Tournament.findOne({ code });
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    try {
      // Create a dummy team object for access check
      const dummyTeam = { tournamentCode: code };
      await assertTeamAdminAccess(req, dummyTeam);
    } catch (accessError) {
      return res.status(accessError.status || 403).json({ 
        success: false, 
        message: accessError.message || 'Access denied' 
      });
    }

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Import Template
    const templateSheet = workbook.addWorksheet('Import Template');
    
    // Headers
    const headers = [
      'teamName',
      'captainName',
      'mobile',
      'email',
      'city',
      'numberOfPlayers',
      'group',
      'teamIcon',
      'notes',
      'logo'
    ];

    templateSheet.addRow(headers);

    // Style header row
    const headerRow = templateSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' } // Yellow
    };
    headerRow.alignment = { horizontal: 'center' };

    // Set column widths
    templateSheet.columns = [
      { width: 20 }, // teamName
      { width: 20 }, // captainName
      { width: 15 }, // mobile
      { width: 25 }, // email
      { width: 15 }, // city
      { width: 15 }, // numberOfPlayers
      { width: 10 }, // group
      { width: 15 }, // teamIcon
      { width: 30 }, // notes
      { width: 40 }  // logo
    ];

    // Add example rows
    const examples = [
      {
        teamName: 'TEAM ALPHA',
        captainName: 'John Doe',
        mobile: '9876543210',
        email: 'john@example.com',
        city: 'Mumbai',
        numberOfPlayers: tournament.minPlayers || 10,
        group: 'A',
        teamIcon: '⚽🏆',
        notes: 'Championship team',
        logo: 'uploads/team_logos/alpha.jpg'
      },
      {
        teamName: 'TEAM BETA',
        captainName: 'Jane Smith',
        mobile: '9876543211',
        email: 'jane@example.com',
        city: 'Delhi',
        numberOfPlayers: tournament.minPlayers || 12,
        group: 'B',
        teamIcon: '🏀',
        notes: 'New team',
        logo: ''
      }
    ];

    examples.forEach(example => {
      const row = templateSheet.addRow([
        example.teamName,
        example.captainName,
        example.mobile,
        example.email,
        example.city,
        example.numberOfPlayers,
        example.group,
        example.teamIcon,
        example.notes,
        example.logo
      ]);
      
      // Style example rows (light gray)
      row.font = { color: { argb: 'FF808080' } };
    });

    // Add comments/notes to header cells
    templateSheet.getCell('A1').note = 'Required: Team name (uppercase, min 3 chars)';
    templateSheet.getCell('B1').note = 'Required: Captain full name';
    templateSheet.getCell('C1').note = 'Required: 10-digit mobile number';
    templateSheet.getCell('D1').note = 'Required: Valid email address';
    templateSheet.getCell('E1').note = 'Required: City/Place name';
    templateSheet.getCell('F1').note = `Required: Number of players (${tournament.minPlayers || 10}-${tournament.maxPlayers || 20})`;
    templateSheet.getCell('G1').note = 'Optional: Group assignment (A, B, C, etc.)';
    templateSheet.getCell('H1').note = 'Optional: Team icons (emojis, comma-separated)';
    templateSheet.getCell('I1').note = 'Optional: Special notes';
    templateSheet.getCell('J1').note = 'Optional: Logo path (uploads/team_logos/...) or URL';

    // Freeze first row
    templateSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Sheet 2: Instructions
    const instructionsSheet = workbook.addWorksheet('Instructions');
    
    const instructions = [
      ['Team Import Instructions'],
      [''],
      ['Step 1: Prepare Your File'],
      ['1. Fill in all required fields (highlighted in yellow)'],
      ['2. Add optional fields as needed'],
      ['3. Ensure team names are in UPPERCASE'],
      ['4. Mobile numbers must be 10-digit format'],
      [''],
      ['Step 2: Required Fields'],
      ['- teamName: Uppercase, minimum 3 characters'],
      ['- captainName: Captain full name'],
      ['- mobile: 10-digit Indian format (e.g., 9876543210)'],
      ['- email: Valid email address'],
      ['- city: City/Place name'],
      [`- numberOfPlayers: Between ${tournament.minPlayers || 10} and ${tournament.maxPlayers || 20}`],
      [''],
      ['Step 3: Optional Fields'],
      ['- group: Group assignment (A, B, C, etc.)'],
      ['- teamIcon: Emojis (comma-separated)'],
      ['- notes: Special notes'],
      ['- logo: Relative path (uploads/team_logos/...) or full URL'],
      [''],
      ['Step 4: Logo Instructions'],
      ['Option 1: Relative Path'],
      ['  Format: uploads/team_logos/filename.jpg'],
      ['  File must exist on server'],
      [''],
      ['Option 2: Full URL'],
      ['  Format: https://example.com/logo.jpg'],
      ['  Will be downloaded automatically'],
      [''],
      ['Option 3: Leave Empty'],
      ['  Team will be created without logo'],
      [''],
      ['Step 5: File Requirements'],
      ['- Format: CSV or Excel (.xlsx)'],
      ['- Encoding: UTF-8'],
      ['- Max size: 10MB'],
      ['- First row: Column headers'],
      [''],
      ['Common Issues'],
      ['- Invalid team name: Ensure uppercase and min 3 chars'],
      ['- Invalid mobile: Use 10-digit format'],
      ['- Invalid email: Check format (must contain @)'],
      ['- Player count out of range: Check tournament limits'],
      ['- Logo not found: Verify path or URL'],
      ['- Duplicate team: Team with same name + mobile exists']
    ];

    instructions.forEach((instruction, index) => {
      const row = instructionsSheet.addRow(instruction);
      if (index === 0) {
        row.font = { bold: true, size: 14 };
      }
    });

    instructionsSheet.columns = [{ width: 80 }];

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=team_import_template_${code}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ success: false, message: 'Error generating template' });
  }
});

// Import teams from file
router.post('/import/:code', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { code } = req.params;
    const { mode = 'preview', updateDuplicates = 'false' } = req.body;
    const isPreview = mode === 'preview';
    const shouldUpdate = updateDuplicates === 'true';

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    await assertTeamAdminAccess(req, { tournamentCode: code });

    // Validate file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!['.csv', '.xlsx'].includes(fileExtension)) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only CSV and Excel files are supported.' });
    }

    // Parse file
    let headers, rows;
    try {
      if (fileExtension === '.csv') {
        const result = parseCSV(req.file.buffer);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = await parseExcel(req.file.buffer);
        headers = result.headers;
        rows = result.rows;
      }
    } catch (parseError) {
      return res.status(400).json({ success: false, message: `Error parsing file: ${parseError.message}` });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File contains no data rows' });
    }

    // Auto-detect column mapping
    const columnMapping = autoDetectColumns(headers);
    
    // Check if all required fields are mapped
    const requiredFields = ['teamName', 'captainName', 'mobile', 'email', 'city', 'numberOfPlayers'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingFields.join(', ')}`,
        detectedMapping: columnMapping,
        availableHeaders: headers
      });
    }

    // Get existing teams for duplicate checking
    const existingTeams = await Team.find({ tournamentCode: code });

    // Process rows
    const previewRows = isPreview ? rows.slice(0, 10) : rows;
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      const teamData = mapRowToTeam(row, columnMapping);
      
      // Validate data
      const validation = validateTeamData(teamData, tournament, existingTeams);
      
      const result = {
        rowNumber: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
        data: teamData,
        errors: validation.errors,
        warnings: validation.warnings,
        isValid: validation.isValid
      };

      if (isPreview) {
        results.push(result);
      } else {
        // Actual import
        if (!validation.isValid) {
          result.status = 'error';
          result.message = validation.errors.join('; ');
          errorCount++;
        } else {
          try {
            const teamName = teamData.teamName.trim().toUpperCase();
            const mobile = teamData.mobile.trim().replace(/\s+/g, '');
            
            // Check for duplicate
            const duplicate = existingTeams.find(t => 
              t.name.toUpperCase() === teamName && 
              t.mobile.replace(/\s+/g, '') === mobile
            );

            if (duplicate) {
              if (shouldUpdate) {
                // Update existing team
                const updateData = {
                  captainName: teamData.captainName.trim(),
                  email: teamData.email.trim(),
                  city: teamData.city.trim(),
                  numberOfPlayers: parseInt(teamData.numberOfPlayers)
                };

                if (teamData.group) {
                  updateData.group = teamData.group.trim().toUpperCase();
                }
                if (teamData.groupIndex !== undefined) {
                  updateData.groupIndex = parseInt(teamData.groupIndex) || 0;
                }
                if (teamData.teamIcon) {
                  updateData.teamIcons = teamData.teamIcon.split(',').map(icon => icon.trim()).filter(Boolean);
                }
                if (teamData.notes) {
                  updateData.notes = teamData.notes.trim();
                }

                // Process logo if provided
                if (teamData.logo) {
                  const logoPath = await processLogoPath(teamData.logo, code, teamName);
                  if (logoPath) {
                    updateData.logo = logoPath;
                  }
                }

                await Team.findByIdAndUpdate(duplicate._id, updateData);
                result.status = 'updated';
                result.message = `Team updated: ${duplicate.teamId}`;
                result.teamId = duplicate.teamId;
                updatedCount++;
              } else {
                result.status = 'skipped';
                result.message = `Duplicate team found: ${duplicate.teamId}`;
                skippedCount++;
              }
            } else {
              // Create new team
              // Check team limit
              if (tournament.participatingTeams) {
                const currentCount = await Team.countDocuments({ tournamentCode: code });
                if (currentCount >= tournament.participatingTeams) {
                  result.status = 'error';
                  result.message = `Tournament team limit reached (${tournament.participatingTeams})`;
                  errorCount++;
                  results.push(result);
                  continue;
                }
              }

              // Generate team ID
              const existingTeamsCount = await Team.countDocuments({ tournamentCode: code });
              const teamId = `${code}-T${String(existingTeamsCount + 1).padStart(3, '0')}`;

              // Process logo
              let logoPath = null;
              if (teamData.logo) {
                logoPath = await processLogoPath(teamData.logo, code, teamName);
              }

              // Get budget from tournament
              const teamBudget = tournament.auctionRules?.maxFundForTeam || 0;

              // Create team
              const newTeam = new Team({
                teamId,
                name: teamName,
                logo: logoPath,
                captainName: teamData.captainName.trim(),
                mobile: mobile,
                email: teamData.email.trim(),
                city: teamData.city.trim(),
                numberOfPlayers: parseInt(teamData.numberOfPlayers),
                tournamentCode: code,
                budget: teamBudget,
                currentBalance: teamBudget,
                auctionAccessCode: generateTeamAccessCode()
              });

              if (teamData.group) {
                newTeam.group = teamData.group.trim().toUpperCase();
              }
              if (teamData.groupIndex !== undefined) {
                newTeam.groupIndex = parseInt(teamData.groupIndex) || 0;
              }
              if (teamData.teamIcon) {
                newTeam.teamIcons = teamData.teamIcon.split(',').map(icon => icon.trim()).filter(Boolean);
              }

              await newTeam.save();

              // Generate confirmation PDF
              const pdfRelativePath = `uploads/confirmations/${teamId}_confirmation.pdf`;
              const confirmationsDir = path.join(__dirname, '..', 'uploads', 'confirmations');
              if (!fs.existsSync(confirmationsDir)) {
                fs.mkdirSync(confirmationsDir, { recursive: true });
              }

              const pdfAbsolutePath = path.join(__dirname, '..', pdfRelativePath);
              const doc = new PDFDocument();
              doc.pipe(fs.createWriteStream(pdfAbsolutePath));

              doc.fontSize(20).text(`${tournament.name}`, { align: 'center' });
              doc.moveDown();
              doc.fontSize(16).text('TEAM REGISTRATION CONFIRMATION', { align: 'center' });
              doc.moveDown();
              doc.fontSize(12).text(`Team ID: ${teamId}`);
              doc.text(`Team Name: ${teamName}`);
              doc.text(`Captain: ${teamData.captainName.trim()}`);
              doc.text(`City: ${teamData.city.trim()}`);
              doc.text(`Mobile: ${mobile}`);
              doc.text(`Email: ${teamData.email.trim()}`);
              doc.moveDown();
              doc.text('Powered by PlayLive');
              doc.end();

              newTeam.confirmationPdf = pdfRelativePath;
              await newTeam.save();

              result.status = 'success';
              result.message = `Team created: ${teamId}`;
              result.teamId = teamId;
              successCount++;

              // Add to existing teams for subsequent duplicate checks
              existingTeams.push(newTeam);
            }
          } catch (createError) {
            result.status = 'error';
            result.message = `Error creating team: ${createError.message}`;
            errorCount++;
          }
        }
        results.push(result);
      }
    }

    // After import, check if team limit is reached and automatically close registration
    if (!isPreview && tournament.participatingTeams) {
      const finalTeamsCount = await Team.countDocuments({ tournamentCode: code });
      if (finalTeamsCount >= tournament.participatingTeams && tournament.teamRegistrationEnabled) {
        tournament.teamRegistrationEnabled = false;
        await tournament.save();
        console.log(`Team registration automatically closed for tournament ${code} after import - limit reached (${finalTeamsCount}/${tournament.participatingTeams})`);
      }
    }

    // Prepare response
    const response = {
      success: true,
      mode: isPreview ? 'preview' : 'import',
      totalRows: rows.length,
      processedRows: previewRows.length,
      columnMapping,
      results
    };

    if (!isPreview) {
      response.summary = {
        success: successCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: rows.length
      };
    } else {
      response.summary = {
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        withWarnings: results.filter(r => r.warnings && r.warnings.length > 0).length
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Error importing teams:', error);
    res.status(500).json({ success: false, message: 'Error importing teams', error: error.message });
  }
});

// Export teams as Excel
router.get('/excel/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const tournament = await Tournament.findOne({ code });
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check admin access
    try {
      const dummyTeam = { tournamentCode: code };
      await assertTeamAdminAccess(req, dummyTeam);
    } catch (accessError) {
      return res.status(accessError.status || 403).json({ 
        success: false, 
        message: accessError.message || 'Access denied' 
      });
    }

    const teams = await Team.find({ tournamentCode: code }).sort({ createdAt: -1 });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Teams');

    worksheet.columns = [
      { header: 'Team ID', key: 'teamId', width: 15 },
      { header: 'Team Name', key: 'name', width: 25 },
      { header: 'Captain Name', key: 'captainName', width: 20 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Number of Players', key: 'numberOfPlayers', width: 18 },
      { header: 'Group', key: 'group', width: 10 },
      { header: 'Budget', key: 'budget', width: 15 },
      { header: 'Current Balance', key: 'currentBalance', width: 18 },
      { header: 'Created At', key: 'createdAt', width: 20 }
    ];

    teams.forEach(team => {
      worksheet.addRow({
        teamId: team.teamId || 'N/A',
        name: team.name || 'N/A',
        captainName: team.captainName || 'N/A',
        mobile: team.mobile || 'N/A',
        email: team.email || 'N/A',
        city: team.city || 'N/A',
        numberOfPlayers: team.numberOfPlayers || 0,
        group: team.group || 'N/A',
        budget: team.budget || 0,
        currentBalance: team.currentBalance || 0,
        createdAt: team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'
      });
    });

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { horizontal: 'center' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=teams_${code}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting teams to Excel:', error);
    res.status(500).json({ success: false, message: 'Error generating Excel', error: error.message });
  }
});

module.exports = router;
