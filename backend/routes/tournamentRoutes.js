const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Player = require('../models/Player');
const Team = require('../models/Team');
const TierConfig = require('../models/TierConfig');
const FeatureDefinition = require('../models/FeatureDefinition');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('./authRoutes');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { resolveTournamentFeatures } = require('../services/featureAccessResolver');

const ALLOWED_TIERS = ['Standard', 'AuctionPro'];

const normalizePlan = (plan) => {
  if (!plan) return 'Standard';
  const key = plan.toString().replace(/\s+/g, '').toLowerCase();
  const mapping = {
    lite: 'Standard', // Map old Lite tier to Standard
    liteplus: 'Standard', // Map old LitePlus tier to Standard
    liteplusplan: 'Standard', // Map old LitePlus tier to Standard
    standard: 'Standard',
    auctionpro: 'AuctionPro'
  };
  return mapping[key] || 'Standard';
};

const sanitizeFeatureOverrides = (rawOverrides) => {
  if (rawOverrides === undefined) {
    return undefined;
  }

  let overrides = rawOverrides;
  if (typeof rawOverrides === 'string') {
    try {
      overrides = JSON.parse(rawOverrides);
    } catch (error) {
      return null;
    }
  }

  if (overrides instanceof Map) {
    overrides = Object.fromEntries(overrides.entries());
  }

  if (overrides === null) {
    return {};
  }

  if (typeof overrides !== 'object') {
    return null;
  }

  const sanitized = {};
  Object.entries(overrides).forEach(([featureId, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'boolean') {
      sanitized[featureId] = value;
      return;
    }
    if (value === 'true' || value === 'false') {
      sanitized[featureId] = value === 'true';
      return;
    }
    if (typeof value === 'number') {
      sanitized[featureId] = value === 1;
      return;
    }
  });

  return sanitized;
};

// Configure multer for logo upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') && ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, and PNG files are allowed'));
    }
  }
});

// Configure multer for report poster uploads
const posterUpload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (file.mimetype.startsWith('image/') && allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WEBP files are allowed'));
    }
  }
});

// Upload tournament logo (pre-cropped client image)
router.post('/upload-logo', authenticateToken, upload.single('image'), async (req, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament_logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Detect if file is PNG
    const isPNG = req.file.mimetype === 'image/png';
    const fileExtension = isPNG ? 'png' : 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 8);
    const filename = `${req.body.uploadType || 'tournamentLogo'}_${timestamp}_${randomId}.${fileExtension}`;
    const filepath = path.join(uploadDir, filename);

    // Process image with format-specific settings
    const sharpInstance = sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true });

    if (isPNG) {
      await sharpInstance
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(filepath);
    } else {
      await sharpInstance
        .jpeg({ quality: 80, progressive: true, mozjpeg: true })
        .toFile(filepath);
    }

    res.json({
      success: true,
      url: `/uploads/tournament_logos/${filename}`
    });
  } catch (error) {
    console.error('Error uploading tournament logo:', error);
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
});

// Upload player card background image
router.post('/upload-player-card-background', authenticateToken, upload.single('image'), async (req, res) => {
  const user = req.user;
  const isSuperAdmin = user.role === 'SuperAdmin';
  const isTournamentAdmin = user.role === 'TournamentAdmin';

  if (!isSuperAdmin && !isTournamentAdmin) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament_player_card_backgrounds');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 8);
    const filename = `background_${timestamp}_${randomId}.jpg`;
    const filepath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(1200, 1800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toFile(filepath);

    res.json({
      success: true,
      url: `/uploads/tournament_player_card_backgrounds/${filename}`
    });
  } catch (error) {
    console.error('Error uploading player card background:', error);
    res.status(500).json({ success: false, message: 'Failed to upload background image' });
  }
});

// 🧩 Create new tournament (SuperAdmin only)
router.post('/create', authenticateToken, upload.single('logo'), async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const {
      name,
      sport,
      startDate,
      endDate,
      location,
      basePrice,
      minPlayers,
      maxPlayers,
      playerPoolSize,
      auctionRules,
      participatingTeams,
      playerRegistrationEnabled,
      teamRegistrationEnabled,
      registrationStartDate,
      registrationEndDate,
      plan,
      featureOverrides,
      auctionMode
    } = req.body;

    // Parse auctionRules if it's a string (from frontend JSON.stringify)
    let auctionRulesParsed = auctionRules;
    if (typeof auctionRules === 'string') {
      try {
        auctionRulesParsed = JSON.parse(auctionRules);
      } catch (parseError) {
        console.error('Error parsing auctionRules:', parseError);
        return res.status(400).json({ success: false, message: 'Invalid auctionRules format' });
      }
    }

    if (auctionRulesParsed && typeof auctionRulesParsed === 'object') {
      if (auctionRulesParsed.fixedIncrement !== undefined) {
        auctionRulesParsed.fixedIncrement = Number(auctionRulesParsed.fixedIncrement);
      }
      if (auctionRulesParsed.baseValueOfPlayer !== undefined) {
        auctionRulesParsed.baseValueOfPlayer = Number(auctionRulesParsed.baseValueOfPlayer);
      }
      if (auctionRulesParsed.maxFundForTeam !== undefined) {
        auctionRulesParsed.maxFundForTeam = Number(auctionRulesParsed.maxFundForTeam);
      }
      if (auctionRulesParsed.bidLimitCount !== undefined && auctionRulesParsed.bidLimitCount !== null) {
        auctionRulesParsed.bidLimitCount = Number(auctionRulesParsed.bidLimitCount);
      }
      if (auctionRulesParsed.maxBidsPerPlayer !== undefined && auctionRulesParsed.maxBidsPerPlayer !== null) {
        auctionRulesParsed.maxBidsPerPlayer = Number(auctionRulesParsed.maxBidsPerPlayer);
      }
      const allowedBidModes = ['limit', 'unlimited'];
      if (!allowedBidModes.includes(auctionRulesParsed.bidLimitMode)) {
        auctionRulesParsed.bidLimitMode = auctionRulesParsed.maxBidsPerPlayer ? 'limit' : 'unlimited';
      }
      if (auctionRulesParsed.bidLimitMode === 'unlimited') {
        auctionRulesParsed.bidLimitCount = null;
        auctionRulesParsed.maxBidsPerPlayer = null;
      } else {
        const countFallback = auctionRulesParsed.bidLimitCount ?? auctionRulesParsed.maxBidsPerPlayer ?? 0;
        auctionRulesParsed.bidLimitCount = Number(countFallback);
        auctionRulesParsed.maxBidsPerPlayer = auctionRulesParsed.bidLimitCount;
      }
      if (Array.isArray(auctionRulesParsed.ranges)) {
        auctionRulesParsed.ranges = auctionRulesParsed.ranges.map((range) => ({
          from: range.from !== undefined ? Number(range.from) : undefined,
          to: range.to !== undefined ? Number(range.to) : undefined,
          increment: range.increment !== undefined ? Number(range.increment) : undefined
        }));
      }
    }

    const normalizedPlan = normalizePlan(plan);
    if (!ALLOWED_TIERS.includes(normalizedPlan)) {
      return res.status(400).json({ success: false, message: `Invalid plan selected: ${plan}` });
    }

    const sanitizedOverrides = sanitizeFeatureOverrides(featureOverrides);
    if (sanitizedOverrides === null) {
      return res.status(400).json({ success: false, message: 'Invalid featureOverrides payload' });
    }

    let resolvedOverrides = sanitizedOverrides;
    if (sanitizedOverrides && Object.keys(sanitizedOverrides).length > 0) {
      const featureIds = Object.keys(sanitizedOverrides);
      const existingFeatures = await FeatureDefinition.find({ id: { $in: featureIds } }).select('id');
      const validFeatureIds = new Set(existingFeatures.map((feature) => feature.id));
      resolvedOverrides = Object.fromEntries(
        Object.entries(sanitizedOverrides).filter(([featureId]) => validFeatureIds.has(featureId))
      );
    }

    // Coerce primitive field types that may come in as strings
    const numericBasePrice = basePrice !== undefined ? Number(basePrice) : undefined;
    const numericParticipatingTeams = participatingTeams !== undefined ? Number(participatingTeams) : undefined;
    const numericMinPlayers = minPlayers !== undefined ? Number(minPlayers) : undefined;
    const numericMaxPlayers = maxPlayers !== undefined ? Number(maxPlayers) : undefined;
    const numericPlayerPoolSize = playerPoolSize !== undefined ? Number(playerPoolSize) : undefined;

    const teamRegistrationEnabledFlag = typeof teamRegistrationEnabled === 'string'
      ? teamRegistrationEnabled === 'true'
      : !!teamRegistrationEnabled;
    const playerRegistrationEnabledFlag = typeof playerRegistrationEnabled === 'string'
      ? playerRegistrationEnabled === 'true'
      : !!playerRegistrationEnabled;

    // Generate a tournament code like: PLTC001, PLTC002, etc.
    // Find all existing tournaments with PLTC prefix
    const existingTournaments = await Tournament.find({ code: { $regex: /^PLTC\d+$/ } })
      .select('code')
      .sort({ code: -1 }); // Sort descending to get highest code first

    let nextNumber = 1;
    if (existingTournaments.length > 0) {
      // Extract the highest number from existing codes
      const numbers = existingTournaments.map(t => {
        const match = t.code.match(/^PLTC(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const maxNumber = Math.max(...numbers);
      nextNumber = maxNumber + 1;
    }

    // Format as PLTC001, PLTC002, etc. (zero-padded to 3 digits)
    const code = `PLTC${String(nextNumber).padStart(3, '0')}`;

    // Handle logo upload
    let logoPath = null;
    if (req.file) {
      try {
        // Ensure upload directory exists
        const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament_logos');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        logoPath = `uploads/tournament_logos/${code}_logo.${req.file.mimetype.split('/')[1]}`;
        fs.writeFileSync(path.join(__dirname, '..', logoPath), req.file.buffer);
      } catch (error) {
        console.error('Image processing error:', error);
        return res.status(500).json({ success: false, message: 'Error processing logo image' });
      }
    }

    if (!logoPath && req.body.logo) {
      const normalized = req.body.logo.startsWith('/') ? req.body.logo.slice(1) : req.body.logo;
      logoPath = normalized;
    }

    // Generate admin username: lowercase name, extract abbreviation, append year, prefix "admin."
    const nameLower = name.toLowerCase().replace(/\s+/g, '');
    const abbreviation = nameLower.replace(/[^a-z]/g, '').slice(0, 3); // Extract first 3 letters, ignoring non-letters
    const year = new Date().getFullYear();
    let adminUsernameBase = `admin.${abbreviation}${year}`;
    let adminUsername = adminUsernameBase;
    let counter = 1;
    while (await User.findOne({ username: adminUsername })) {
      adminUsername = `${adminUsernameBase}${counter}`;
      counter++;
    }

    // Generate password: 8-12 chars with alphanumeric and symbols
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = Math.floor(Math.random() * 5) + 8; // 8-12
    let adminPassword = '';
    for (let i = 0; i < length; i++) {
      adminPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Hash the password for storage (let pre-save hook handle hashing)
    const adminPasswordHash = adminPassword;

    // Create TournamentAdmin user
    const adminUser = new User({
      username: adminUsername,
      email: `${adminUsername}@playlive.com`, // Dummy email
      password: adminPasswordHash,
      plainPassword: adminPassword, // Store plain password for SuperAdmin view
      role: 'TournamentAdmin',
      tournamentId: null // Will set after tournament save
    });
    await adminUser.save();

    const frontendUrl = process.env.FRONTEND_URL || 'https://playlive.ddns.me';
    const registrationLink = `${frontendUrl}/register/${code}`;
    const teamRegistrationLink = `${frontendUrl}/register/team/${code}`;

    // Validate and set auctionMode in auctionAdvancedSettings
    const validAuctionModes = ['normal', 'pro'];
    const normalizedAuctionMode = auctionMode && validAuctionModes.includes(auctionMode.toLowerCase())
      ? auctionMode.toLowerCase()
      : 'normal';

    const tournament = new Tournament({
      name,
      code,
      sport,
      startDate,
      endDate,
      location,
      basePrice: numericBasePrice,
      minPlayers: numericMinPlayers,
      maxPlayers: numericMaxPlayers,
      playerPoolSize: numericPlayerPoolSize,
      auctionRules: auctionRulesParsed,
      participatingTeams: numericParticipatingTeams,
      playerRegistrationEnabled: playerRegistrationEnabledFlag,
      registrationStartDate,
      registrationEndDate,
      registrationLink,
      teamRegistrationLink,
      teamRegistrationEnabled: teamRegistrationEnabledFlag,
      adminUsername,
      adminPasswordHash,
      logo: logoPath,
      createdBy: req.user.id,
      adminId: adminUser._id,
      plan: normalizedPlan,
      ...(resolvedOverrides ? { featureOverrides: resolvedOverrides } : {})
    });

    // Set auctionMode in auctionAdvancedSettings (other defaults will be applied by Mongoose schema)
    if (!tournament.auctionAdvancedSettings) {
      tournament.auctionAdvancedSettings = {};
    }
    tournament.auctionAdvancedSettings.auctionMode = normalizedAuctionMode;
    await tournament.save();

    // Update admin user with tournamentId
    adminUser.tournamentId = tournament._id;
    await adminUser.save();



    res.json({
      success: true,
      message: 'Tournament created successfully',
      tournament,
      adminCredentials: {
        tournamentName: name,
        tournamentCode: code,
        username: adminUsername,
        password: adminPassword,
        registrationStartDate,
        registrationEndDate,
        registrationLink: registrationLink
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating tournament' });
  }
});

// 🧾 Get all tournaments
router.get('/', async (req, res) => {
  try {
    console.time('Tournament Fetch');
    const tournaments = await Tournament.find()
      .populate('adminId', 'username email plainPassword')
      .sort({ createdAt: -1 })
      .maxTimeMS(10000) // 10 second timeout
      .lean(); // Use lean() for better performance

    console.timeEnd('Tournament Fetch');
    console.log(`Fetched ${tournaments.length} tournaments`);

    res.json({ success: true, tournaments });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ success: false, message: 'Error fetching tournaments' });
  }
});

// Resolve allowed features for a tournament
router.get('/:code/features', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    // Check if the parameter is a MongoDB ObjectId (24 hex characters) or a code
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(code);
    const query = isObjectId ? { _id: code } : { code };
    const tournament = await Tournament.findOne(query);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const allowedFeatures = await resolveTournamentFeatures(tournament);
    const featureDetails = await FeatureDefinition.find({ id: { $in: allowedFeatures } }).lean();

    const rawOverrides = tournament.featureOverrides;
    let overrides = {};
    if (rawOverrides instanceof Map) {
      overrides = Object.fromEntries(rawOverrides.entries());
    } else if (rawOverrides && typeof rawOverrides === 'object') {
      overrides = rawOverrides;
    }

    res.json({
      success: true,
      plan: tournament.plan || 'Standard',
      allowedFeatures,
      overrides,
      features: featureDetails
    });
  } catch (error) {
    console.error('Error resolving tournament features:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve tournament features' });
  }
});

// Update tournament plan (SuperAdmin only)
router.put('/:code/plan', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const normalizedPlan = normalizePlan(req.body.plan);
  if (!ALLOWED_TIERS.includes(normalizedPlan)) {
    return res.status(400).json({ success: false, message: `Invalid plan selected: ${req.body.plan}` });
  }

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    tournament.plan = normalizedPlan;
    await tournament.save();

    const allowedFeatures = await resolveTournamentFeatures(tournament);
    res.json({
      success: true,
      plan: tournament.plan,
      allowedFeatures
    });
  } catch (error) {
    console.error('Error updating tournament plan:', error);
    res.status(500).json({ success: false, message: 'Failed to update tournament plan' });
  }
});

// Update tournament feature overrides (SuperAdmin only)
router.put('/:code/features/overrides', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const rawOverrides = req.body?.overrides ?? req.body?.featureOverrides ?? req.body?.overridesPayload;
  const sanitizedOverrides = sanitizeFeatureOverrides(rawOverrides ?? {});
  if (sanitizedOverrides === null) {
    return res.status(400).json({ success: false, message: 'Invalid overrides payload' });
  }

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    let resolvedOverrides = sanitizedOverrides || {};
    if (sanitizedOverrides && Object.keys(sanitizedOverrides).length > 0) {
      const featureIds = Object.keys(sanitizedOverrides);
      const existingFeatures = await FeatureDefinition.find({ id: { $in: featureIds } }).select('id');
      const validFeatureIds = new Set(existingFeatures.map((feature) => feature.id));
      resolvedOverrides = Object.fromEntries(
        Object.entries(sanitizedOverrides).filter(([featureId]) => validFeatureIds.has(featureId))
      );
    }

    tournament.featureOverrides = resolvedOverrides;
    await tournament.save();

    const allowedFeatures = await resolveTournamentFeatures(tournament);
    res.json({
      success: true,
      overrides: resolvedOverrides,
      allowedFeatures
    });
  } catch (error) {
    console.error('Error updating tournament overrides:', error);
    res.status(500).json({ success: false, message: 'Failed to update feature overrides' });
  }
});

// Update auction master switch settings
router.put('/:code/auction-settings', authenticateToken, async (req, res) => {
  console.log('🔧 Auction settings route hit:', req.method, req.path, req.params.code);
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const user = req.user;
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isTournamentAdmin = user.role === 'TournamentAdmin';

    // Check permissions
    if (!isSuperAdmin && !isTournamentAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Tournament Admin can only change if allowed
    if (isTournamentAdmin && !tournament.auctionAdminControlEnabled) {
      return res.status(403).json({ 
        success: false, 
        message: 'Auction settings control is disabled by SuperAdmin' 
      });
    }

    // SuperAdmin can change both fields, Tournament Admin can only change auctionEnabled
    if (isSuperAdmin) {
      if (req.body.auctionEnabled !== undefined) {
        // Convert to boolean properly - handle both boolean and string values
        let auctionEnabledValue;
        if (typeof req.body.auctionEnabled === 'boolean') {
          auctionEnabledValue = req.body.auctionEnabled;
        } else if (typeof req.body.auctionEnabled === 'string') {
          auctionEnabledValue = req.body.auctionEnabled.toLowerCase() === 'true';
        } else {
          // For any other type, convert to boolean
          auctionEnabledValue = Boolean(req.body.auctionEnabled);
        }
        tournament.auctionEnabled = auctionEnabledValue;
        console.log(`[SuperAdmin] Setting auctionEnabled to: ${auctionEnabledValue} (received: ${req.body.auctionEnabled}, type: ${typeof req.body.auctionEnabled})`);
      }
      if (req.body.auctionAdminControlEnabled !== undefined) {
        let adminControlValue;
        if (typeof req.body.auctionAdminControlEnabled === 'boolean') {
          adminControlValue = req.body.auctionAdminControlEnabled;
        } else if (typeof req.body.auctionAdminControlEnabled === 'string') {
          adminControlValue = req.body.auctionAdminControlEnabled.toLowerCase() === 'true';
        } else {
          adminControlValue = Boolean(req.body.auctionAdminControlEnabled);
        }
        tournament.auctionAdminControlEnabled = adminControlValue;
        console.log(`[SuperAdmin] Setting auctionAdminControlEnabled to: ${adminControlValue}`);
      }
    } else {
      // Tournament Admin can only change auctionEnabled
      if (req.body.auctionEnabled !== undefined) {
        // Convert to boolean properly
        let auctionEnabledValue;
        if (typeof req.body.auctionEnabled === 'boolean') {
          auctionEnabledValue = req.body.auctionEnabled;
        } else if (typeof req.body.auctionEnabled === 'string') {
          auctionEnabledValue = req.body.auctionEnabled.toLowerCase() === 'true';
        } else {
          auctionEnabledValue = Boolean(req.body.auctionEnabled);
        }
        tournament.auctionEnabled = auctionEnabledValue;
        console.log(`[TournamentAdmin] Setting auctionEnabled to: ${auctionEnabledValue} (received: ${req.body.auctionEnabled}, type: ${typeof req.body.auctionEnabled})`);
      }
    }
    
    console.log(`Tournament ${tournament.code} auctionEnabled before save: ${tournament.auctionEnabled}, type: ${typeof tournament.auctionEnabled}`);

    await tournament.save();
    
    console.log(`Tournament ${tournament.code} saved successfully. auctionEnabled: ${tournament.auctionEnabled}`);

    // Return full tournament data for frontend state update
    const updatedTournament = await Tournament.findOne({ code: tournament.code })
      .populate('adminId', 'username email plainPassword')
      .lean();
    
    console.log(`Fetched tournament from DB - auctionEnabled: ${updatedTournament?.auctionEnabled}, type: ${typeof updatedTournament?.auctionEnabled}`);

    res.json({
      success: true,
      tournament: updatedTournament || {
        auctionEnabled: tournament.auctionEnabled,
        auctionAdminControlEnabled: tournament.auctionAdminControlEnabled
      }
    });
  } catch (error) {
    console.error('Error updating auction settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update auction settings' });
  }
});

// Get advanced auction settings
router.get('/:code/auction-advanced-settings', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const user = req.user;
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isTournamentAdmin = user.role === 'TournamentAdmin';

    // Check permissions
    if (!isSuperAdmin && !isTournamentAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Return settings or defaults
    const settings = tournament.auctionAdvancedSettings || {};
    const defaultSettings = {
      assistantNotes: '',
      automationRules: {
        pendingRound2: { enabled: false, threshold: 3 },
        timerUnsold: { enabled: false, seconds: 5 },
        publishResults: { enabled: true }
      },
      autoNextEnabled: true,
      autoTimerEnabled: true,
      timerSeconds: 30,
      lastCallTimerSeconds: 10,
      autoTimeoutAction: 'pending',
      soundEnabled: true,
      voiceAnnouncerEnabled: false,
      timerEnabled: true,
      auctionMode: 'normal'
    };

    // Merge with defaults
    const mergedSettings = {
      assistantNotes: settings.assistantNotes !== undefined ? settings.assistantNotes : defaultSettings.assistantNotes,
      automationRules: {
        pendingRound2: {
          enabled: settings.automationRules?.pendingRound2?.enabled !== undefined 
            ? settings.automationRules.pendingRound2.enabled 
            : defaultSettings.automationRules.pendingRound2.enabled,
          threshold: settings.automationRules?.pendingRound2?.threshold !== undefined 
            ? settings.automationRules.pendingRound2.threshold 
            : defaultSettings.automationRules.pendingRound2.threshold
        },
        timerUnsold: {
          enabled: settings.automationRules?.timerUnsold?.enabled !== undefined 
            ? settings.automationRules.timerUnsold.enabled 
            : defaultSettings.automationRules.timerUnsold.enabled,
          seconds: settings.automationRules?.timerUnsold?.seconds !== undefined 
            ? settings.automationRules.timerUnsold.seconds 
            : defaultSettings.automationRules.timerUnsold.seconds
        },
        publishResults: {
          enabled: settings.automationRules?.publishResults?.enabled !== undefined 
            ? settings.automationRules.publishResults.enabled 
            : defaultSettings.automationRules.publishResults.enabled
        }
      },
      autoNextEnabled: settings.autoNextEnabled !== undefined ? settings.autoNextEnabled : defaultSettings.autoNextEnabled,
      autoTimerEnabled: settings.autoTimerEnabled !== undefined ? settings.autoTimerEnabled : defaultSettings.autoTimerEnabled,
      timerSeconds: settings.timerSeconds !== undefined ? settings.timerSeconds : defaultSettings.timerSeconds,
      lastCallTimerSeconds: settings.lastCallTimerSeconds !== undefined ? settings.lastCallTimerSeconds : defaultSettings.lastCallTimerSeconds,
      autoTimeoutAction: settings.autoTimeoutAction || defaultSettings.autoTimeoutAction,
      soundEnabled: settings.soundEnabled !== undefined ? settings.soundEnabled : defaultSettings.soundEnabled,
      voiceAnnouncerEnabled: settings.voiceAnnouncerEnabled !== undefined ? settings.voiceAnnouncerEnabled : defaultSettings.voiceAnnouncerEnabled,
      timerEnabled: settings.timerEnabled !== undefined ? settings.timerEnabled : defaultSettings.timerEnabled,
      auctionMode: settings.auctionMode || defaultSettings.auctionMode
    };

    res.json({ success: true, settings: mergedSettings });
  } catch (error) {
    console.error('Error fetching advanced auction settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch advanced auction settings' });
  }
});

// Update advanced auction settings
router.put('/:code/auction-advanced-settings', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const user = req.user;
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isTournamentAdmin = user.role === 'TournamentAdmin';

    // Check permissions
    if (!isSuperAdmin && !isTournamentAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Initialize auctionAdvancedSettings if it doesn't exist
    if (!tournament.auctionAdvancedSettings) {
      tournament.auctionAdvancedSettings = {};
    }

    // Update settings from request body
    const { settings } = req.body;

    if (settings) {
      if (settings.assistantNotes !== undefined) {
        tournament.auctionAdvancedSettings.assistantNotes = String(settings.assistantNotes);
      }
      
      if (settings.automationRules) {
        if (!tournament.auctionAdvancedSettings.automationRules) {
          tournament.auctionAdvancedSettings.automationRules = {};
        }
        
        if (settings.automationRules.pendingRound2) {
          if (!tournament.auctionAdvancedSettings.automationRules.pendingRound2) {
            tournament.auctionAdvancedSettings.automationRules.pendingRound2 = {};
          }
          if (settings.automationRules.pendingRound2.enabled !== undefined) {
            tournament.auctionAdvancedSettings.automationRules.pendingRound2.enabled = Boolean(settings.automationRules.pendingRound2.enabled);
          }
          if (settings.automationRules.pendingRound2.threshold !== undefined) {
            tournament.auctionAdvancedSettings.automationRules.pendingRound2.threshold = Number(settings.automationRules.pendingRound2.threshold) || 3;
          }
        }
        
        if (settings.automationRules.timerUnsold) {
          if (!tournament.auctionAdvancedSettings.automationRules.timerUnsold) {
            tournament.auctionAdvancedSettings.automationRules.timerUnsold = {};
          }
          if (settings.automationRules.timerUnsold.enabled !== undefined) {
            tournament.auctionAdvancedSettings.automationRules.timerUnsold.enabled = Boolean(settings.automationRules.timerUnsold.enabled);
          }
          if (settings.automationRules.timerUnsold.seconds !== undefined) {
            tournament.auctionAdvancedSettings.automationRules.timerUnsold.seconds = Number(settings.automationRules.timerUnsold.seconds) || 5;
          }
        }
        
        if (settings.automationRules.publishResults) {
          if (!tournament.auctionAdvancedSettings.automationRules.publishResults) {
            tournament.auctionAdvancedSettings.automationRules.publishResults = {};
          }
          if (settings.automationRules.publishResults.enabled !== undefined) {
            tournament.auctionAdvancedSettings.automationRules.publishResults.enabled = Boolean(settings.automationRules.publishResults.enabled);
          }
        }
      }
      
      if (settings.autoNextEnabled !== undefined) {
        tournament.auctionAdvancedSettings.autoNextEnabled = Boolean(settings.autoNextEnabled);
      }
      
      if (settings.autoTimerEnabled !== undefined) {
        tournament.auctionAdvancedSettings.autoTimerEnabled = Boolean(settings.autoTimerEnabled);
      }
      
      if (settings.timerSeconds !== undefined) {
        tournament.auctionAdvancedSettings.timerSeconds = Number(settings.timerSeconds) || 30;
      }
      
      if (settings.lastCallTimerSeconds !== undefined) {
        tournament.auctionAdvancedSettings.lastCallTimerSeconds = Number(settings.lastCallTimerSeconds) || 10;
      }
      
      if (settings.autoTimeoutAction !== undefined) {
        if (['pending', 'unsold'].includes(settings.autoTimeoutAction)) {
          tournament.auctionAdvancedSettings.autoTimeoutAction = settings.autoTimeoutAction;
        }
      }
      
      if (settings.soundEnabled !== undefined) {
        tournament.auctionAdvancedSettings.soundEnabled = Boolean(settings.soundEnabled);
      }
      
      if (settings.voiceAnnouncerEnabled !== undefined) {
        tournament.auctionAdvancedSettings.voiceAnnouncerEnabled = Boolean(settings.voiceAnnouncerEnabled);
      }
      
      if (settings.timerEnabled !== undefined) {
        tournament.auctionAdvancedSettings.timerEnabled = Boolean(settings.timerEnabled);
      }
      
      if (settings.auctionMode !== undefined) {
        if (['normal', 'pro'].includes(settings.auctionMode)) {
          tournament.auctionAdvancedSettings.auctionMode = settings.auctionMode;
        }
      }
    }

    // Mark as modified and save
    tournament.markModified('auctionAdvancedSettings');
    await tournament.save();

    // Fetch fresh data from database to return
    const updatedTournament = await Tournament.findOne({ code: req.params.code });
    const savedSettings = updatedTournament.auctionAdvancedSettings || {};

    // Return the saved settings with defaults merged
    const defaultSettings = {
      assistantNotes: '',
      automationRules: {
        pendingRound2: { enabled: false, threshold: 3 },
        timerUnsold: { enabled: false, seconds: 5 },
        publishResults: { enabled: true }
      },
      autoNextEnabled: true,
      autoTimerEnabled: true,
      timerSeconds: 30,
      lastCallTimerSeconds: 10,
      autoTimeoutAction: 'pending',
      soundEnabled: true,
      voiceAnnouncerEnabled: false,
      timerEnabled: true,
      auctionMode: 'normal'
    };

    const mergedSettings = {
      assistantNotes: savedSettings.assistantNotes !== undefined ? savedSettings.assistantNotes : defaultSettings.assistantNotes,
      automationRules: {
        pendingRound2: {
          enabled: savedSettings.automationRules?.pendingRound2?.enabled !== undefined 
            ? savedSettings.automationRules.pendingRound2.enabled 
            : defaultSettings.automationRules.pendingRound2.enabled,
          threshold: savedSettings.automationRules?.pendingRound2?.threshold !== undefined 
            ? savedSettings.automationRules.pendingRound2.threshold 
            : defaultSettings.automationRules.pendingRound2.threshold
        },
        timerUnsold: {
          enabled: savedSettings.automationRules?.timerUnsold?.enabled !== undefined 
            ? savedSettings.automationRules.timerUnsold.enabled 
            : defaultSettings.automationRules.timerUnsold.enabled,
          seconds: savedSettings.automationRules?.timerUnsold?.seconds !== undefined 
            ? savedSettings.automationRules.timerUnsold.seconds 
            : defaultSettings.automationRules.timerUnsold.seconds
        },
        publishResults: {
          enabled: savedSettings.automationRules?.publishResults?.enabled !== undefined 
            ? savedSettings.automationRules.publishResults.enabled 
            : defaultSettings.automationRules.publishResults.enabled
        }
      },
      autoNextEnabled: savedSettings.autoNextEnabled !== undefined ? savedSettings.autoNextEnabled : defaultSettings.autoNextEnabled,
      autoTimerEnabled: savedSettings.autoTimerEnabled !== undefined ? savedSettings.autoTimerEnabled : defaultSettings.autoTimerEnabled,
      timerSeconds: savedSettings.timerSeconds !== undefined ? savedSettings.timerSeconds : defaultSettings.timerSeconds,
      lastCallTimerSeconds: savedSettings.lastCallTimerSeconds !== undefined ? savedSettings.lastCallTimerSeconds : defaultSettings.lastCallTimerSeconds,
      autoTimeoutAction: savedSettings.autoTimeoutAction || defaultSettings.autoTimeoutAction,
      soundEnabled: savedSettings.soundEnabled !== undefined ? savedSettings.soundEnabled : defaultSettings.soundEnabled,
      voiceAnnouncerEnabled: savedSettings.voiceAnnouncerEnabled !== undefined ? savedSettings.voiceAnnouncerEnabled : defaultSettings.voiceAnnouncerEnabled,
      timerEnabled: savedSettings.timerEnabled !== undefined ? savedSettings.timerEnabled : defaultSettings.timerEnabled,
      auctionMode: savedSettings.auctionMode || defaultSettings.auctionMode
    };

    res.json({ success: true, settings: mergedSettings });
  } catch (error) {
    console.error('Error updating advanced auction settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update advanced auction settings' });
  }
});

// Save player card design
router.put('/:code/player-card-design', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const user = req.user;
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isTournamentAdmin = user.role === 'TournamentAdmin';

    // Check permissions
    if (!isSuperAdmin && !isTournamentAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { playerCardDesign } = req.body;

    if (!playerCardDesign || typeof playerCardDesign !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid playerCardDesign data' });
    }

    // Validate and set playerCardDesign
    tournament.playerCardDesign = playerCardDesign;
    tournament.markModified('playerCardDesign');
    await tournament.save();

    res.json({
      success: true,
      message: 'RP Card design saved successfully',
      playerCardDesign: tournament.playerCardDesign
    });
  } catch (error) {
    console.error('Error saving player card design:', error);
    res.status(500).json({ success: false, message: 'Failed to save RP Card design' });
  }
});

// Delete player card design
router.delete('/:code/player-card-design', authenticateToken, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const user = req.user;
    const isSuperAdmin = user.role === 'SuperAdmin';
    const isTournamentAdmin = user.role === 'TournamentAdmin';

    // Check permissions
    if (!isSuperAdmin && !isTournamentAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if TournamentAdmin owns the tournament
    if (isTournamentAdmin && !isSuperAdmin) {
      if (tournament.adminId && tournament.adminId.toString() !== user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Remove player card design
    tournament.playerCardDesign = undefined;
    tournament.markModified('playerCardDesign');
    await tournament.save();

    res.json({
      success: true,
      message: 'RP Card design deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting player card design:', error);
    res.status(500).json({ success: false, message: 'Failed to delete RP Card design' });
  }
});

// Get tournament by code or id
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    // Check if the parameter is a MongoDB ObjectId (24 hex characters) or a code
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(code);
    const query = isObjectId ? { _id: code } : { code };
    const tournament = await Tournament.findOne(query).populate('adminId', 'username email plainPassword');
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    res.json({ success: true, tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching tournament' });
  }
});

// Update tournament (SuperAdmin only, or TournamentAdmin for auction-related fields)
router.put("/:code", authenticateToken, upload.single("logo"), async (req, res) => {
  console.log("🔄 Tournament Update Request Received");
  console.log("Code:", req.params.code);
  console.log("User:", req.user ? req.user.username : "No user");
  console.log("Body keys:", Object.keys(req.body));
  console.log("Has file:", !!req.file);

  const user = req.user;
  const isSuperAdmin = user.role === 'SuperAdmin';
  const isTournamentAdmin = user.role === 'TournamentAdmin';

  // Check permissions
  if (!isSuperAdmin && !isTournamentAdmin) {
    console.log("❌ Access denied - not SuperAdmin or TournamentAdmin");
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const { code } = req.params;
    const updateData = { ...req.body };

    // Check if the parameter is a MongoDB ObjectId (24 hex characters) or a code
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(code);
    const query = isObjectId ? { _id: code } : { code };

    // If TournamentAdmin, check permissions and filter allowed fields
    if (isTournamentAdmin && !isSuperAdmin) {
      const tournament = await Tournament.findOne(query);
      if (!tournament) {
        return res.status(404).json({ success: false, message: 'Tournament not found' });
      }

      // Tournament Admin can only change auction-related fields if allowed
      if (!tournament.auctionAdminControlEnabled) {
        return res.status(403).json({ 
          success: false, 
          message: 'Auction settings control is disabled by SuperAdmin' 
        });
      }

      // Define allowed fields for TournamentAdmin (auction-related only)
      const allowedFields = [
        'auctionRules',
        'basePrice',
        'playerPoolSize',
        'participatingTeams',
        'minPlayers',
        'maxPlayers',
        'maxFundForTeam'
      ];

      // Check if any non-allowed fields are being updated (excluding logo which is handled separately)
      const requestedFields = Object.keys(updateData);
      const disallowedFields = requestedFields.filter(field => !allowedFields.includes(field) && field !== 'logo');
      
      if (disallowedFields.length > 0) {
        console.log("❌ TournamentAdmin attempting to update restricted fields:", disallowedFields);
        return res.status(403).json({ 
          success: false, 
          message: 'TournamentAdmin can only update auction-related fields' 
        });
      }

      // Filter updateData to only include allowed fields
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key) && key !== 'logo') {
          delete updateData[key];
        }
      });
    }

    // Plan and featureOverrides are SuperAdmin only
    if (updateData.plan !== undefined) {
      if (!isSuperAdmin) {
        return res.status(403).json({ success: false, message: 'Only SuperAdmin can update tournament plan' });
      }
      const normalizedPlan = normalizePlan(updateData.plan);
      if (!ALLOWED_TIERS.includes(normalizedPlan)) {
        return res.status(400).json({ success: false, message: `Invalid plan selected: ${updateData.plan}` });
      }
      updateData.plan = normalizedPlan;
    }

    if (updateData.featureOverrides !== undefined) {
      if (!isSuperAdmin) {
        return res.status(403).json({ success: false, message: 'Only SuperAdmin can update feature overrides' });
      }
      const sanitizedOverrides = sanitizeFeatureOverrides(updateData.featureOverrides);
      if (sanitizedOverrides === null) {
        return res.status(400).json({ success: false, message: 'Invalid featureOverrides payload' });
      }

      let resolvedOverrides = sanitizedOverrides;
      if (sanitizedOverrides && Object.keys(sanitizedOverrides).length > 0) {
        const featureIds = Object.keys(sanitizedOverrides);
        const existingFeatures = await FeatureDefinition.find({ id: { $in: featureIds } }).select('id');
        const validFeatureIds = new Set(existingFeatures.map((feature) => feature.id));
        resolvedOverrides = Object.fromEntries(
          Object.entries(sanitizedOverrides).filter(([featureId]) => validFeatureIds.has(featureId))
        );
      }

      updateData.featureOverrides = resolvedOverrides;
    }

    console.log("📝 Processing update data...");

    // Handle auctionRules - check what we receive
    if (updateData.auctionRules) {
      console.log("auctionRules type:", typeof updateData.auctionRules);
      console.log("auctionRules value:", updateData.auctionRules);

      if (typeof updateData.auctionRules === "string") {
        try {
          updateData.auctionRules = JSON.parse(updateData.auctionRules);
          console.log("✅ Parsed auctionRules from string");
        } catch (parseError) {
          console.error("❌ Failed to parse auctionRules:", parseError.message);
          return res.status(400).json({ success: false, message: 'Invalid auctionRules format' });
        }
      }
    }

    // Handle logo upload
    if (req.file) {
      console.log("📸 Processing logo upload...");
      try {
        // Get tournament code for logo filename (in case we're using _id)
        let tournamentCode = code;
        if (isObjectId) {
          const existingTournament = await Tournament.findOne(query).select('code');
          if (existingTournament) {
            tournamentCode = existingTournament.code;
          }
        }

        const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament_logos');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const logoPath = `uploads/tournament_logos/${tournamentCode}_logo.${req.file.mimetype.split('/')[1]}`;
        fs.writeFileSync(path.join(__dirname, '..', logoPath), req.file.buffer);

        updateData.logo = logoPath;
        console.log("✅ Logo processed:", logoPath);
      } catch (error) {
        console.error('❌ Image processing error:', error);
        return res.status(500).json({ success: false, message: 'Error processing logo image' });
      }
    }

    if (!req.file && typeof updateData.logo === 'string') {
      updateData.logo = updateData.logo.startsWith('/') ? updateData.logo.slice(1) : updateData.logo;
    }

    // Normalize numeric fields
    const numericFields = ['participatingTeams', 'minPlayers', 'maxPlayers', 'playerPoolSize', 'basePrice', 'maxFundForTeam'];
    numericFields.forEach(field => {
      if (updateData[field]) {
        updateData[field] = Number(updateData[field]);
      }
    });

    ['playerRegistrationEnabled', 'teamRegistrationEnabled', 'paymentReceiptMandatory'].forEach(field => {
      if (updateData[field] !== undefined) {
        updateData[field] = typeof updateData[field] === 'string'
          ? updateData[field] === 'true'
          : !!updateData[field];
      }
    });

    if (updateData.auctionRules) {
      if (updateData.auctionRules.fixedIncrement) {
        updateData.auctionRules.fixedIncrement = Number(updateData.auctionRules.fixedIncrement);
      }
      if (updateData.auctionRules.baseValueOfPlayer) {
        updateData.auctionRules.baseValueOfPlayer = Number(updateData.auctionRules.baseValueOfPlayer);
      }
      if (updateData.auctionRules.maxFundForTeam) {
        updateData.auctionRules.maxFundForTeam = Number(updateData.auctionRules.maxFundForTeam);
      }
      if (updateData.auctionRules.bidLimitCount !== undefined && updateData.auctionRules.bidLimitCount !== null) {
        updateData.auctionRules.bidLimitCount = Number(updateData.auctionRules.bidLimitCount);
      }
      if (updateData.auctionRules.maxBidsPerPlayer !== undefined && updateData.auctionRules.maxBidsPerPlayer !== null) {
        updateData.auctionRules.maxBidsPerPlayer = Number(updateData.auctionRules.maxBidsPerPlayer);
      }
      const allowedBidModes = ['limit', 'unlimited'];
      if (!allowedBidModes.includes(updateData.auctionRules.bidLimitMode)) {
        updateData.auctionRules.bidLimitMode = updateData.auctionRules.maxBidsPerPlayer ? 'limit' : 'unlimited';
      }
      if (updateData.auctionRules.bidLimitMode === 'unlimited') {
        updateData.auctionRules.bidLimitCount = null;
        updateData.auctionRules.maxBidsPerPlayer = null;
      } else {
        const fallbackCount =
          updateData.auctionRules.bidLimitCount ?? updateData.auctionRules.maxBidsPerPlayer ?? 0;
        updateData.auctionRules.bidLimitCount = Number(fallbackCount);
        updateData.auctionRules.maxBidsPerPlayer = updateData.auctionRules.bidLimitCount;
      }
      if (Array.isArray(updateData.auctionRules.ranges)) {
        updateData.auctionRules.ranges = updateData.auctionRules.ranges.map(range => ({
          from: Number(range.from),
          to: Number(range.to),
          increment: Number(range.increment)
        }));
      }
    }

    console.log("💾 Final update data:", JSON.stringify(updateData, null, 2));

    // Update tournament - use query that handles both _id and code
    const updatedTournament = await Tournament.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    ).populate('adminId');

    if (!updatedTournament) {
      console.log("❌ Tournament not found");
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    console.log("✅ Tournament updated successfully");
    res.json({
      success: true,
      message: 'Tournament updated successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('❌ Error updating tournament:', error);
    res.status(500).json({ success: false, message: 'Error updating tournament' });
  }
});

// Assign TournamentAdmin to tournament (SuperAdmin only)
router.put('/:code/assign-admin', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const { adminId } = req.body;
    const tournament = await Tournament.findOneAndUpdate({ code: req.params.code }, { adminId }, { new: true });
    res.json({ success: true, tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error assigning admin' });
  }
});

// Update tournament status (TournamentAdmin or SuperAdmin)
router.put('/:code/status', authenticateToken, async (req, res) => {
  console.log('Status update request:', {
    code: req.params.code,
    userRole: req.user?.role,
    userId: req.user?.id,
    body: req.body
  });

  if (!req.user || !req.user.role) {
    console.log('No user or role in request', { user: req.user });
    return res.status(403).json({ success: false, message: 'Access denied: Invalid authentication - no user or role found' });
  }

  // Normalize role for comparison (handle case variations)
  const userRole = req.user.role;
  const normalizedRole = userRole === 'SUPER_ADMIN' ? 'SuperAdmin' : 
                        userRole === 'TOURNAMENT_ADMIN' ? 'TournamentAdmin' : 
                        userRole;

  if (!['TournamentAdmin', 'SuperAdmin'].includes(normalizedRole)) {
    console.log('Access denied: Role not authorized', { 
      receivedRole: userRole, 
      normalizedRole: normalizedRole,
      userId: req.user.id 
    });
    return res.status(403).json({ 
      success: false, 
      message: `Access denied: Required role SuperAdmin or TournamentAdmin, got ${userRole}` 
    });
  }

  // Update req.user.role to normalized version for consistency
  req.user.role = normalizedRole;

  try {
    const { status } = req.body;
    
    // Validate status value
    const validStatuses = ['Upcoming', 'Active', 'Completed', 'End'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    console.log('Tournament found:', {
      code: tournament.code,
      adminId: tournament.adminId,
      adminIdType: typeof tournament.adminId,
      adminIdString: tournament.adminId?.toString(),
      userId: req.user.id,
      userIdType: typeof req.user.id,
      userRole: req.user.role
    });

    // TournamentAdmin can only update their own tournament
    if (req.user.role === 'TournamentAdmin') {
      if (!tournament.adminId) {
        console.log('Tournament has no adminId assigned');
        return res.status(403).json({ success: false, message: 'Access denied: Tournament has no admin assigned' });
      }
      
      const adminIdString = tournament.adminId.toString();
      const userIdString = req.user.id.toString();
      
      console.log('Comparing admin IDs:', {
        tournamentAdminId: adminIdString,
        userAdminId: userIdString,
        match: adminIdString === userIdString
      });
      
      if (adminIdString !== userIdString) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only update your own tournament' });
      }
    }

    // SuperAdmin can update any tournament
    tournament.status = status;
    await tournament.save();

    console.log('Status updated successfully:', { code: req.params.code, newStatus: status });
    res.json({ success: true, tournament });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// Mark registration complete (TournamentAdmin only)
router.put('/:code/mark-registration-complete', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    // Check if admin owns this tournament
    if (tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update status to 'Auction Preparation Mode' or similar
    tournament.status = 'Active'; // Assuming 'Active' means registration closed, auction ready
    await tournament.save();

    res.json({ success: true, message: 'Registration marked as complete', tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error marking registration complete' });
  }
});

// Get tournaments by admin (for TournamentAdmin)
router.get('/my-tournaments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const tournaments = await Tournament.find({ adminId: req.user.id });
    res.json({ success: true, tournaments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching tournaments' });
  }
});

// Get tournament for current user (for TournamentAdmin)
router.get('/user/tournament', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const tournament = await Tournament.findOne({ adminId: req.user.id });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    res.json({ success: true, tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching tournament' });
  }
});

// Get all users for a specific tournament (SuperAdmin only)
router.get('/:code/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    // Get tournament admin
    const admin = await User.findById(tournament.adminId).select('username email role plainPassword');

    // Get all players for this tournament
    const players = await Player.find({ tournamentCode: req.params.code }).select('playerId name email role city auctionStatus');

    // Get all teams for this tournament
    const teams = await Team.find({ tournamentCode: req.params.code }).select('name captainName captainEmail players guestPlayers');

    res.json({
      success: true,
      tournament: {
        name: tournament.name,
        code: tournament.code,
        sport: tournament.sport
      },
      users: {
        admin: admin ? [admin] : [],
        players: players,
        teams: teams
      },
      summary: {
        totalAdmins: admin ? 1 : 0,
        totalPlayers: players.length,
        totalTeams: teams.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching tournament users' });
  }
});

// Close registration (TournamentAdmin or SuperAdmin)
router.put('/:code/close-registration', authenticateToken, async (req, res) => {
  if (!['TournamentAdmin', 'SuperAdmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    if (req.user.role === 'TournamentAdmin' && tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const scope = (req.body.scope || 'both').toLowerCase();
    const closePlayer = scope === 'player' || scope === 'both';
    const closeTeam = scope === 'team' || scope === 'both';

    if (closePlayer) {
      tournament.playerRegistrationEnabled = false;
    }
    if (closeTeam) {
      tournament.teamRegistrationEnabled = false;
    }

    if (!tournament.playerRegistrationEnabled && !tournament.teamRegistrationEnabled) {
      tournament.registrationStatus = 'Closed Early';
    } else if (closePlayer || closeTeam) {
      tournament.registrationStatus = 'Active';
    }

    await tournament.save();

    const targetLabel = closePlayer && closeTeam
      ? 'player and team registration'
      : closePlayer
        ? 'player registration'
        : 'team registration';

    res.json({
      success: true,
      message: `Successfully closed ${targetLabel}`,
      tournament
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error closing registration' });
  }
});

// Reopen registration (TournamentAdmin or SuperAdmin)
router.put('/:code/reopen-registration', authenticateToken, async (req, res) => {
  if (!['TournamentAdmin', 'SuperAdmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    if (req.user.role === 'TournamentAdmin' && tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const scope = (req.body.scope || 'both').toLowerCase();
    const openPlayer = scope === 'player' || scope === 'both';
    const openTeam = scope === 'team' || scope === 'both';

    if (openPlayer) {
      tournament.playerRegistrationEnabled = true;
    }
    if (openTeam) {
      tournament.teamRegistrationEnabled = true;
    }

    if (tournament.playerRegistrationEnabled || tournament.teamRegistrationEnabled) {
      tournament.registrationStatus = 'Active';
    }

    await tournament.save();

    const targetLabel = openPlayer && openTeam
      ? 'player and team registration'
      : openPlayer
        ? 'player registration'
        : 'team registration';

    res.json({
      success: true,
      message: `Successfully reopened ${targetLabel}`,
      tournament
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error reopening registration' });
  }
});

// Start auction (TournamentAdmin only)
router.put('/:code/start-auction', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    // Check if admin owns this tournament
    if (tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    tournament.status = 'Active'; // Assuming 'Active' means auction live
    await tournament.save();



    res.json({ success: true, message: 'Auction started successfully', tournament });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error starting auction' });
  }
});

// 🗑️ Delete all tournaments (SuperAdmin only)
router.delete('/all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    console.log('Attempting to delete all tournaments');
    const tournaments = await Tournament.find();

    if (tournaments.length === 0) {
      return res.json({ success: true, message: 'No tournaments to delete' });
    }

    let deletedCount = 0;

    for (const tournament of tournaments) {
      // Find all players associated with this tournament
      const players = await Player.find({ tournamentCode: tournament.code });

      // Delete player files and records
      for (const player of players) {
        // Delete photo file
        if (player.photo) {
          const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
          }
        }

        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
          }
        }

        // Delete player card PDF
        const cardPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
        if (fs.existsSync(cardPath)) {
          fs.unlinkSync(cardPath);
        }

        // Delete player document
        await Player.findByIdAndDelete(player._id);
      }

      // Find all teams associated with this tournament
      const teams = await Team.find({ tournamentCode: tournament.code });

      // Delete team files and records
      for (const team of teams) {
        // Delete team logo file
        if (team.logo) {
          const teamLogoPath = path.join(__dirname, '..', 'uploads', team.logo);
          if (fs.existsSync(teamLogoPath)) {
            fs.unlinkSync(teamLogoPath);
          }
        }

        // Delete guest player photos
        for (const guest of team.guestPlayers || []) {
          if (guest.photo) {
            const guestPhotoPath = path.join(__dirname, '..', 'uploads', guest.photo);
            if (fs.existsSync(guestPhotoPath)) {
              fs.unlinkSync(guestPhotoPath);
            }
          }
        }

        // Delete team document
        await Team.findByIdAndDelete(team._id);
      }

      // Delete associated TournamentAdmin user
      if (tournament.adminId) {
        await User.findByIdAndDelete(tournament.adminId);
      }

      // Delete tournament logo file if exists
      if (tournament.logo) {
        const logoPath = path.join(__dirname, '..', tournament.logo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }

      // Delete audit logs associated with this tournament
      try {
        await AuditLog.deleteMany({ tournamentCode: tournament.code });
      } catch (auditError) {
        console.error(`Error deleting audit logs for tournament ${tournament.code}:`, auditError);
        // Continue with tournament deletion even if audit log deletion fails
      }

      // Delete the tournament
      const deleteResult = await Tournament.findByIdAndDelete(tournament._id);
      if (!deleteResult) {
        console.error(`Failed to delete tournament ${tournament.code} - document not found`);
        // Continue with other tournaments
        continue;
      }

      // Verify tournament is actually deleted
      const verifyDelete = await Tournament.findOne({ code: tournament.code });
      if (verifyDelete) {
        console.error(`WARNING: Tournament ${tournament.code} still exists after deletion attempt!`);
        // Continue with other tournaments but log the error
        continue;
      }

      deletedCount++;
    }



    res.json({ success: true, message: `${deletedCount} tournaments and all associated data deleted successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting tournaments' });
  }
});

// 🗑️ Delete tournament (SuperAdmin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    console.log('Attempting to delete tournament with id:', req.params.id);
    const tournament = await Tournament.findOne({ _id: req.params.id });
    if (!tournament) {
      console.log('Tournament not found for id:', req.params.id);
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    console.log('Found tournament:', tournament.name, 'Code:', tournament.code);

    // Find all players associated with this tournament
    console.log('Finding players for tournament code:', tournament.code);
    const players = await Player.find({ tournamentCode: tournament.code });
    console.log(`Found ${players.length} players to delete`);

    // Delete player files and records
    for (const player of players) {
      try {
        console.log('Deleting player:', player.playerId);
        // Delete photo file
        if (player.photo) {
          const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
            console.log('Deleted photo file:', photoPath);
          } else {
            console.log('Photo file not found:', photoPath);
          }
        }

        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
            console.log('Deleted receipt file:', receiptPath);
          } else {
            console.log('Receipt file not found:', receiptPath);
          }
        }

        // Delete player card PDF
        const cardPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
        if (fs.existsSync(cardPath)) {
          fs.unlinkSync(cardPath);
          console.log('Deleted player card PDF:', cardPath);
        } else {
          console.log('Player card PDF not found:', cardPath);
        }

        // Delete player document
        await Player.findByIdAndDelete(player._id);
        console.log('Deleted player document:', player._id);
      } catch (playerError) {
        console.error('Error deleting player:', player.playerId, playerError);
        // Continue with other players
      }
    }

    // Find all teams associated with this tournament
    console.log('Finding teams for tournament code:', tournament.code);
    const teams = await Team.find({ tournamentCode: tournament.code });
    console.log(`Found ${teams.length} teams to delete`);

    // Delete team files and records
    for (const team of teams) {
      try {
        console.log('Deleting team:', team.name);
        // Delete team logo file
        if (team.logo) {
          const teamLogoPath = path.join(__dirname, '..', 'uploads', team.logo);
          if (fs.existsSync(teamLogoPath)) {
            fs.unlinkSync(teamLogoPath);
            console.log('Deleted team logo file:', teamLogoPath);
          } else {
            console.log('Team logo file not found:', teamLogoPath);
          }
        }

        // Delete guest player photos
        for (const guest of team.guestPlayers || []) {
          if (guest.photo) {
            const guestPhotoPath = path.join(__dirname, '..', 'uploads', guest.photo);
            if (fs.existsSync(guestPhotoPath)) {
              fs.unlinkSync(guestPhotoPath);
              console.log('Deleted guest photo file:', guestPhotoPath);
            } else {
              console.log('Guest photo file not found:', guestPhotoPath);
            }
          }
        }

        // Delete team document
        await Team.findByIdAndDelete(team._id);
        console.log('Deleted team document:', team._id);
      } catch (teamError) {
        console.error('Error deleting team:', team.name, teamError);
        // Continue with other teams
      }
    }

    // Delete associated TournamentAdmin user
    if (tournament.adminId) {
      try {
        console.log('Deleting admin user:', tournament.adminId);
        await User.findByIdAndDelete(tournament.adminId);
        console.log('Deleted admin user:', tournament.adminId);
      } catch (adminError) {
        console.error('Error deleting admin user:', tournament.adminId, adminError);
        // Continue
      }
    } else {
      console.log('No adminId found for tournament');
    }

    // Delete tournament logo file if exists
    if (tournament.logo) {
      try {
        const logoPath = path.join(__dirname, '..', tournament.logo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
          console.log('Deleted tournament logo file:', logoPath);
        } else {
          console.log('Tournament logo file not found:', logoPath);
        }
      } catch (logoError) {
        console.error('Error deleting tournament logo:', tournament.logo, logoError);
        // Continue
      }
    }

    // Delete audit logs associated with this tournament
    try {
      const auditLogsResult = await AuditLog.deleteMany({ tournamentCode: tournament.code });
      console.log(`Deleted ${auditLogsResult.deletedCount} audit log(s) for tournament ${tournament.code}`);
    } catch (auditError) {
      console.error('Error deleting audit logs:', auditError);
      // Continue with tournament deletion even if audit log deletion fails
    }

    // Delete the tournament
    console.log('Deleting tournament document:', tournament._id);
    const deleteResult = await Tournament.findByIdAndDelete(tournament._id);
    if (!deleteResult) {
      console.error('Failed to delete tournament - document not found');
      return res.status(500).json({ success: false, message: 'Failed to delete tournament document' });
    }
    console.log('Deleted tournament document successfully');

    // Verify tournament is actually deleted
    const verifyDelete = await Tournament.findOne({ code: tournament.code });
    if (verifyDelete) {
      console.error('WARNING: Tournament still exists after deletion attempt!');
      return res.status(500).json({ success: false, message: 'Tournament deletion may have failed. Please verify in database.' });
    }

    res.json({ success: true, message: 'Tournament and all associated data deleted successfully' });
  } catch (error) {
    console.error('Unexpected error during tournament deletion:', error);
    res.status(500).json({ success: false, message: 'Error deleting tournament: ' + error.message });
  }
});

// 🗑️ Delete tournament by code (SuperAdmin only)
router.delete('/code/:code', authenticateToken, async (req, res) => {
  if (req.user.role !== 'SuperAdmin') return res.status(403).json({ success: false, message: 'Access denied' });

  try {
    console.log('Attempting to delete tournament with code:', req.params.code);
    const tournament = await Tournament.findOne({ code: req.params.code });
    if (!tournament) {
      console.log('Tournament not found for code:', req.params.code);
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    console.log('Found tournament:', tournament.name, 'Code:', tournament.code);

    // Find all players associated with this tournament
    console.log('Finding players for tournament code:', tournament.code);
    const players = await Player.find({ tournamentCode: tournament.code });
    console.log(`Found ${players.length} players to delete`);

    // Delete player files and records
    for (const player of players) {
      try {
        console.log('Deleting player:', player.playerId);
        // Delete photo file
        if (player.photo) {
          const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
          if (fs.existsSync(photoPath)) {
            fs.unlinkSync(photoPath);
            console.log('Deleted photo file:', photoPath);
          } else {
            console.log('Photo file not found:', photoPath);
          }
        }

        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) {
            fs.unlinkSync(receiptPath);
            console.log('Deleted receipt file:', receiptPath);
          } else {
            console.log('Receipt file not found:', receiptPath);
          }
        }

        // Delete player card PDF
        const cardPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
        if (fs.existsSync(cardPath)) {
          fs.unlinkSync(cardPath);
          console.log('Deleted player card PDF:', cardPath);
        } else {
          console.log('Player card PDF not found:', cardPath);
        }

        // Delete player document
        await Player.findByIdAndDelete(player._id);
        console.log('Deleted player document:', player._id);
      } catch (playerError) {
        console.error('Error deleting player:', player.playerId, playerError);
        // Continue with other players
      }
    }

    // Find all teams associated with this tournament
    console.log('Finding teams for tournament code:', tournament.code);
    const teams = await Team.find({ tournamentCode: tournament.code });
    console.log(`Found ${teams.length} teams to delete`);

    // Delete team files and records
    for (const team of teams) {
      try {
        console.log('Deleting team:', team.name);
        // Delete team logo file
        if (team.logo) {
          const teamLogoPath = path.join(__dirname, '..', 'uploads', team.logo);
          if (fs.existsSync(teamLogoPath)) {
            fs.unlinkSync(teamLogoPath);
            console.log('Deleted team logo file:', teamLogoPath);
          } else {
            console.log('Team logo file not found:', teamLogoPath);
          }
        }

        // Delete guest player photos
        for (const guest of team.guestPlayers || []) {
          if (guest.photo) {
            const guestPhotoPath = path.join(__dirname, '..', 'uploads', guest.photo);
            if (fs.existsSync(guestPhotoPath)) {
              fs.unlinkSync(guestPhotoPath);
              console.log('Deleted guest photo file:', guestPhotoPath);
            } else {
              console.log('Guest photo file not found:', guestPhotoPath);
            }
          }
        }

        // Delete team document
        await Team.findByIdAndDelete(team._id);
        console.log('Deleted team document:', team._id);
      } catch (teamError) {
        console.error('Error deleting team:', team.name, teamError);
        // Continue with other teams
      }
    }

    // Delete associated TournamentAdmin user
    if (tournament.adminId) {
      try {
        console.log('Deleting admin user:', tournament.adminId);
        await User.findByIdAndDelete(tournament.adminId);
        console.log('Deleted admin user:', tournament.adminId);
      } catch (adminError) {
        console.error('Error deleting admin user:', tournament.adminId, adminError);
        // Continue
      }
    } else {
      console.log('No adminId found for tournament');
    }

    // Delete tournament logo file if exists
    if (tournament.logo) {
      try {
        const logoPath = path.join(__dirname, '..', tournament.logo);
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
          console.log('Deleted tournament logo file:', logoPath);
        } else {
          console.log('Tournament logo file not found:', logoPath);
        }
      } catch (logoError) {
        console.error('Error deleting tournament logo:', tournament.logo, logoError);
        // Continue
      }
    }

    // Delete audit logs associated with this tournament
    try {
      const auditLogsResult = await AuditLog.deleteMany({ tournamentCode: tournament.code });
      console.log(`Deleted ${auditLogsResult.deletedCount} audit log(s) for tournament ${tournament.code}`);
    } catch (auditError) {
      console.error('Error deleting audit logs:', auditError);
      // Continue with tournament deletion even if audit log deletion fails
    }

    // Delete the tournament
    console.log('Deleting tournament document:', tournament._id);
    const deleteResult = await Tournament.findByIdAndDelete(tournament._id);
    if (!deleteResult) {
      console.error('Failed to delete tournament - document not found');
      return res.status(500).json({ success: false, message: 'Failed to delete tournament document' });
    }
    console.log('Deleted tournament document successfully');

    // Verify tournament is actually deleted
    const verifyDelete = await Tournament.findOne({ code: tournament.code });
    if (verifyDelete) {
      console.error('WARNING: Tournament still exists after deletion attempt!');
      return res.status(500).json({ success: false, message: 'Tournament deletion may have failed. Please verify in database.' });
    }

    res.json({ success: true, message: 'Tournament and all associated data deleted successfully' });
  } catch (error) {
    console.error('Unexpected error during tournament deletion:', error);
    res.status(500).json({ success: false, message: 'Error deleting tournament: ' + error.message });
  }
});

// Upload tournament report poster
router.post('/:code/report-posters/upload', authenticateToken, posterUpload.single('image'), async (req, res) => {
  try {
    // Check authorization - SuperAdmin or TournamentAdmin of this tournament
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { code } = req.params;
    const { position } = req.body;

    // Validate position
    const validPositions = ['firstPage', 'secondPage', 'lastPage'];
    if (!position || !validPositions.includes(position)) {
      return res.status(400).json({ success: false, message: 'Invalid position. Must be firstPage, secondPage, or lastPage' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if TournamentAdmin owns this tournament
    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only manage posters for your own tournament' });
      }
    }

    // Create upload directory
    const uploadDir = path.join(__dirname, '..', 'uploads', 'tournament_report_posters');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Delete old poster if exists
    const oldPosterPath = tournament.reportPosters?.[position];
    if (oldPosterPath) {
      const oldFilePath = path.join(__dirname, '..', oldPosterPath);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (err) {
          console.error('Error deleting old poster:', err);
        }
      }
    }

    // Generate filename
    const timestamp = Date.now();
    const extension = req.file.mimetype.includes('webp') ? 'webp' : 
                     req.file.mimetype.includes('png') ? 'png' : 'jpg';
    const filename = `${code}_${position}_${timestamp}.${extension}`;
    const filepath = path.join(uploadDir, filename);

    // Process and save image
    let sharpInstance = sharp(req.file.buffer).rotate(); // Auto-rotate based on EXIF
    
    if (extension === 'jpg' || extension === 'jpeg') {
      await sharpInstance
        .jpeg({ quality: 90, progressive: true })
        .toFile(filepath);
    } else if (extension === 'png') {
      await sharpInstance
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(filepath);
    } else if (extension === 'webp') {
      await sharpInstance
        .webp({ quality: 90 })
        .toFile(filepath);
    }

    const posterPath = `uploads/tournament_report_posters/${filename}`;

    // Update tournament document
    if (!tournament.reportPosters) {
      tournament.reportPosters = {};
    }
    tournament.reportPosters[position] = posterPath;
    await tournament.save();

    res.json({
      success: true,
      message: 'Poster uploaded successfully',
      poster: {
        position,
        url: `/${posterPath}`
      }
    });
  } catch (error) {
    console.error('Error uploading report poster:', error);
    res.status(500).json({ success: false, message: 'Failed to upload poster: ' + error.message });
  }
});

// Helper palette for lightweight hero color fallbacks
const TOURNAMENT_COLOR_PALETTE = [
  '#F97316', '#0EA5E9', '#22C55E', '#A855F7', '#EC4899', '#EAB308', '#14B8A6', '#6366F1'
];

const deriveHeroColor = (code = '') => {
  const normalized = code || 'PLAYLIVE';
  const sum = normalized
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TOURNAMENT_COLOR_PALETTE[sum % TOURNAMENT_COLOR_PALETTE.length];
};

// Public-only current tournaments feed
router.get('/public/current', async (req, res) => {
  try {
    const tournaments = await Tournament.find({
      status: { $in: ['Active', 'Upcoming'] }
    })
      .select('name code sport location startDate endDate status logo reportPosters createdAt')
      .sort({ status: -1, startDate: 1, createdAt: -1 })
      .lean();

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const buildAssetUrl = (path) => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const normalized = path.startsWith('/') ? path : `/${path}`;
      return `${baseUrl}${normalized}`;
    };

    const buildPosterImage = (reportPosters = {}, logoPath) => {
      return reportPosters.firstPage || reportPosters.secondPage || reportPosters.lastPage || logoPath || null;
    };

    const publicPayload = tournaments.map((tournament) => {
      const posterPath = buildPosterImage(tournament.reportPosters, tournament.logo);
      return {
        code: tournament.code,
        name: tournament.name,
        sport: tournament.sport,
        location: tournament.location,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        status: tournament.status,
        posterImage: buildAssetUrl(posterPath),
        hasPoster: Boolean(posterPath && posterPath !== tournament.logo),
        logoUrl: buildAssetUrl(tournament.logo),
        heroColor: deriveHeroColor(tournament.code)
      };
    });

    res.json({
      success: true,
      tournaments: publicPayload
    });
  } catch (error) {
    console.error('Error fetching public tournaments:', error);
    res.status(500).json({ success: false, message: 'Failed to load tournaments' });
  }
});

// Delete tournament report poster
router.delete('/:code/report-posters/:position', authenticateToken, async (req, res) => {
  try {
    // Check authorization - SuperAdmin or TournamentAdmin of this tournament
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { code, position } = req.params;

    // Validate position
    const validPositions = ['firstPage', 'secondPage', 'lastPage'];
    if (!validPositions.includes(position)) {
      return res.status(400).json({ success: false, message: 'Invalid position. Must be firstPage, secondPage, or lastPage' });
    }

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if TournamentAdmin owns this tournament
    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only manage posters for your own tournament' });
      }
    }

    // Get poster path
    const posterPath = tournament.reportPosters?.[position];
    if (!posterPath) {
      return res.status(404).json({ success: false, message: 'Poster not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', posterPath);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Error deleting poster file:', err);
      }
    }

    // Update tournament document
    if (tournament.reportPosters) {
      tournament.reportPosters[position] = undefined;
      await tournament.save();
    }

    res.json({
      success: true,
      message: 'Poster deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report poster:', error);
    res.status(500).json({ success: false, message: 'Failed to delete poster: ' + error.message });
  }
});

// Get all custom links for a tournament
router.get('/:code/custom-links', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const tournament = await Tournament.findOne({ code });
    
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check authorization - SuperAdmin or TournamentAdmin of this tournament
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only view links for your own tournament' });
      }
    }

    const customLinks = tournament.customLinks || [];
    // Sort by order, then by creation date
    customLinks.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json({ success: true, customLinks });
  } catch (error) {
    console.error('Error fetching custom links:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch custom links: ' + error.message });
  }
});

// Add a new custom link
router.post('/:code/custom-links', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const { title, url, description, icon, category, order } = req.body;

    // Validation
    if (!title || !url) {
      return res.status(400).json({ success: false, message: 'Title and URL are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format' });
    }

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check authorization
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only add links to your own tournament' });
      }
    }

    // Initialize customLinks array if it doesn't exist
    if (!tournament.customLinks) {
      tournament.customLinks = [];
    }

    // Create new link
    const newLink = {
      title: title.trim(),
      url: url.trim(),
      description: description ? description.trim() : '',
      icon: icon || '🔗',
      category: category || 'Custom',
      order: order !== undefined ? Number(order) : tournament.customLinks.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    tournament.customLinks.push(newLink);
    await tournament.save();

    res.json({
      success: true,
      message: 'Custom link added successfully',
      customLink: newLink
    });
  } catch (error) {
    console.error('Error adding custom link:', error);
    res.status(500).json({ success: false, message: 'Failed to add custom link: ' + error.message });
  }
});

// Update a custom link
router.put('/:code/custom-links/:linkId', authenticateToken, async (req, res) => {
  try {
    const { code, linkId } = req.params;
    const { title, url, description, icon, category, order } = req.body;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check authorization
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only update links for your own tournament' });
      }
    }

    if (!tournament.customLinks || tournament.customLinks.length === 0) {
      return res.status(404).json({ success: false, message: 'Custom links not found' });
    }

    // Find the link
    const linkIndex = tournament.customLinks.findIndex(
      link => link._id && link._id.toString() === linkId
    );

    if (linkIndex === -1) {
      return res.status(404).json({ success: false, message: 'Custom link not found' });
    }

    // Update link
    const link = tournament.customLinks[linkIndex];
    if (title !== undefined) link.title = title.trim();
    if (url !== undefined) {
      // Validate URL format
      try {
        new URL(url);
        link.url = url.trim();
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid URL format' });
      }
    }
    if (description !== undefined) link.description = description ? description.trim() : '';
    if (icon !== undefined) link.icon = icon || '🔗';
    if (category !== undefined) link.category = category || 'Custom';
    if (order !== undefined) link.order = Number(order);
    link.updatedAt = new Date();

    await tournament.save();

    res.json({
      success: true,
      message: 'Custom link updated successfully',
      customLink: link
    });
  } catch (error) {
    console.error('Error updating custom link:', error);
    res.status(500).json({ success: false, message: 'Failed to update custom link: ' + error.message });
  }
});

// Delete a custom link
router.delete('/:code/custom-links/:linkId', authenticateToken, async (req, res) => {
  try {
    const { code, linkId } = req.params;

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check authorization
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only delete links from your own tournament' });
      }
    }

    if (!tournament.customLinks || tournament.customLinks.length === 0) {
      return res.status(404).json({ success: false, message: 'Custom links not found' });
    }

    // Find and remove the link
    const linkIndex = tournament.customLinks.findIndex(
      link => link._id && link._id.toString() === linkId
    );

    if (linkIndex === -1) {
      return res.status(404).json({ success: false, message: 'Custom link not found' });
    }

    tournament.customLinks.splice(linkIndex, 1);
    await tournament.save();

    res.json({
      success: true,
      message: 'Custom link deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom link:', error);
    res.status(500).json({ success: false, message: 'Failed to delete custom link: ' + error.message });
  }
});

// Get tournament activity feed
router.get('/:code/activity', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const limit = parseInt(req.query.limit, 10) || 10;
    const maxLimit = 50;

    // Find tournament
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check authorization
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    if (!isSuperAdmin && req.user.role !== 'TournamentAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!isSuperAdmin) {
      if (!tournament.adminId || tournament.adminId.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Get recent activities
    const [recentPlayers, recentTeams, soldPlayers, recentBids] = await Promise.all([
      // Recent player registrations
      Player.find({ tournamentCode: code })
        .sort({ registeredAt: -1 })
        .limit(limit)
        .select('name registeredAt basePrice auctionStatus _id')
        .lean(),
      
      // Recent team creations
      Team.find({ tournamentCode: code })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name createdAt city captainName _id')
        .lean(),
      
      // Recent player sales
      Player.find({ 
        tournamentCode: code,
        soldAt: { $exists: true, $ne: null }
      })
        .sort({ soldAt: -1 })
        .limit(limit)
        .select('name soldAt soldPrice soldToName _id')
        .lean(),
      
      // Recent bids (from players with bid history)
      Player.find({ 
        tournamentCode: code,
        'bidHistory.0': { $exists: true }
      })
        .sort({ lastAuctionEventAt: -1 })
        .limit(limit * 3) // Get more to extract individual bids
        .select('name bidHistory currentBid currentBidTeamName _id')
        .lean()
    ]);

    // Format currency
    const formatCurrency = (value) => {
      if (typeof value !== 'number') return null;
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
    };

    // Build activities array
    const activities = [];

    // Add player registrations
    recentPlayers.forEach(player => {
      if (player.registeredAt) {
        activities.push({
          id: `player-reg-${player._id}`,
          type: 'player.registered',
          icon: '👤',
          name: `Player ${player.name} registered`,
          time: player.registeredAt,
          context: `Base price: ₹${formatCurrency(player.basePrice) || '—'}`
        });
      }
    });

    // Add team creations
    recentTeams.forEach(team => {
      if (team.createdAt) {
        activities.push({
          id: `team-${team._id}`,
          type: 'team.created',
          icon: '⚽',
          name: `Team ${team.name} created`,
          time: team.createdAt,
          context: `${team.city || ''} • ${team.captainName || ''}`.trim()
        });
      }
    });

    // Add player sales
    soldPlayers.forEach(player => {
      if (player.soldAt) {
        activities.push({
          id: `player-sold-${player._id}`,
          type: 'player.sold',
          icon: '💰',
          name: `${player.name} sold to ${player.soldToName || 'Team'}`,
          time: player.soldAt,
          context: `Sold for ₹${formatCurrency(player.soldPrice) || '—'}`
        });
      }
    });

    // Add recent bids (extract from bid history)
    recentBids.forEach(player => {
      if (player.bidHistory && Array.isArray(player.bidHistory) && player.bidHistory.length > 0) {
        // Get the most recent bid from this player's history
        const sortedBids = [...player.bidHistory].sort((a, b) => {
          const timeA = a.bidTime ? new Date(a.bidTime).getTime() : 0;
          const timeB = b.bidTime ? new Date(b.bidTime).getTime() : 0;
          return timeB - timeA;
        });
        const latestBid = sortedBids[0];
        
        if (latestBid && latestBid.bidTime) {
          const bidTime = latestBid.bidTime instanceof Date 
            ? latestBid.bidTime 
            : new Date(latestBid.bidTime);
          
          activities.push({
            id: `bid-${player._id}-${bidTime.getTime()}`,
            type: 'auction.bid',
            icon: '🎯',
            name: `Bid placed on ${player.name}`,
            time: bidTime,
            context: `₹${formatCurrency(latestBid.bidAmount) || '—'} by ${latestBid.teamName || 'Team'}`
          });
        }
      }
    });

    // Sort all activities by time (most recent first)
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Limit and format
    const limitedActivities = activities.slice(0, Math.min(limit, maxLimit)).map(activity => ({
      ...activity,
      timestamp: new Date(activity.time).toISOString()
    }));

    res.json({
      success: true,
      activities: limitedActivities,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tournament activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tournament activity'
    });
  }
});

// Get layout preferences for authenticated user
router.get('/:code/layout-preferences', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'User ID not found in token' });
    }
    const userId = req.user.id.toString();
    
    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Get user's saved layout or return null
    // MongoDB Maps are stored as plain objects, so handle both formats safely
    let userPrefs = null;
    
    try {
      if (tournament.userLayoutPreferences) {
        // Handle Map instance (if Mongoose converted it back)
        if (tournament.userLayoutPreferences instanceof Map) {
          userPrefs = tournament.userLayoutPreferences.get(userId);
        } 
        // Handle plain object (most common case from MongoDB)
        else if (typeof tournament.userLayoutPreferences === 'object' && tournament.userLayoutPreferences !== null) {
          // Check if it's a Map-like object or plain object
          const prefs = tournament.userLayoutPreferences;
          
          // Try to access as plain object first (most common)
          if (prefs[userId]) {
            userPrefs = prefs[userId];
          }
          // If it has Map methods, try using them
          else if (typeof prefs.get === 'function') {
            userPrefs = prefs.get(userId);
          }
        }
      }
    } catch (prefError) {
      console.error('Error accessing user layout preferences:', prefError);
      // Continue with null prefs - will return default layout
      userPrefs = null;
    }
    
    if (userPrefs) {
      // Convert layout data to object for JSON response
      let layoutObj = {};
      let layoutData = userPrefs.layout;
      
      try {
        // Handle both Map and plain object formats
        if (layoutData instanceof Map) {
          layoutData.forEach((value, key) => {
            layoutObj[key] = {
              x: value?.x || 0,
              y: value?.y || 0,
              w: value?.w || 6,
              h: value?.h || 6,
              minW: value?.minW || 3,
              minH: value?.minH || 3
            };
          });
        } else if (layoutData && typeof layoutData === 'object') {
          // Handle plain object format (preferred format)
          Object.keys(layoutData).forEach(key => {
            const value = layoutData[key];
            if (value && typeof value === 'object') {
              layoutObj[key] = {
                x: value.x || 0,
                y: value.y || 0,
                w: value.w || 6,
                h: value.h || 6,
                minW: value.minW || 3,
                minH: value.minH || 3
              };
            }
          });
        }
      } catch (layoutError) {
        console.error('Error processing layout data:', layoutError);
        // Reset to empty layout if processing fails
        layoutObj = {};
      }
      
      res.json({
        success: true,
        layout: layoutObj,
        gridCols: userPrefs.gridCols || 12,
        gridRows: userPrefs.gridRows || 12,
        contentEdits: userPrefs.contentEdits || null,
        elementSizes: userPrefs.elementSizes || null,
        updatedAt: userPrefs.updatedAt
      });
    } else {
      res.json({
        success: true,
        layout: null,
        gridCols: 12,
        gridRows: 12
      });
    }
  } catch (error) {
    console.error('Error fetching layout preferences:', error);
    console.error('Error stack:', error.stack);
    console.error('Request user:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    console.error('Tournament code:', req.params.code);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch layout preferences',
      error: error.message
    });
  }
});

// Save layout preferences for authenticated user
router.put('/:code/layout-preferences', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'User ID not found in token' });
    }
    const userId = req.user.id.toString();
    const { layout, gridCols, gridRows, contentEdits, elementSizes } = req.body;

    // Validate layout structure
    if (!layout || typeof layout !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout data'
      });
    }

    const tournament = await Tournament.findOne({ code });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Initialize userLayoutPreferences if it doesn't exist
    if (!tournament.userLayoutPreferences) {
      tournament.userLayoutPreferences = new Map();
    } else if (!(tournament.userLayoutPreferences instanceof Map)) {
      // Convert plain object to Map if needed
      const existingPrefs = tournament.userLayoutPreferences;
      tournament.userLayoutPreferences = new Map();
      if (typeof existingPrefs === 'object' && existingPrefs !== null) {
        Object.keys(existingPrefs).forEach(key => {
          tournament.userLayoutPreferences.set(key, existingPrefs[key]);
        });
      }
    }

    // Create layout object (using plain object instead of nested Map for better MongoDB compatibility)
    const layoutObj = {};
    Object.keys(layout).forEach(key => {
      const item = layout[key];
      if (item && typeof item === 'object') {
        layoutObj[key] = {
          x: Number(item.x) || 0,
          y: Number(item.y) || 0,
          w: Number(item.w) || 6,
          h: Number(item.h) || 6,
          minW: Number(item.minW) || 3,
          minH: Number(item.minH) || 3
        };
      }
    });

    // Save user preferences
    // Use plain object for layout instead of Map to avoid serialization issues
    const preferencesData = {
      layout: layoutObj,
      gridCols: Number(gridCols) || 12,
      gridRows: Number(gridRows) || 12,
      updatedAt: new Date()
    };
    
    // Add content edits if provided
    if (contentEdits && typeof contentEdits === 'object') {
      preferencesData.contentEdits = contentEdits;
    }
    
    // Add element sizes if provided
    if (elementSizes && typeof elementSizes === 'object') {
      preferencesData.elementSizes = elementSizes;
    }
    
    tournament.userLayoutPreferences.set(userId, preferencesData);

    await tournament.save();

    res.json({
      success: true,
      message: 'Layout preferences saved successfully'
    });
  } catch (error) {
    console.error('Error saving layout preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save layout preferences',
      error: error.message
    });
  }
});

module.exports = router;
