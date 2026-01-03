const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const { pdf2pic } = require('pdf2pic');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const { authenticateToken } = require('./authRoutes');
const ExcelJS = require('exceljs');
const {
  parseCSV,
  parseExcel,
  autoDetectColumns,
  validatePlayerData,
  processFilePath,
  mapRowToPlayer,
  getValidRoles
} = require('../utils/playerImportHelper');
const router = express.Router();
const DUPLICATE_KEY_ERROR_CODE = 11000;
const MAX_PLAYER_ID_ATTEMPTS = 5;

const normalizeUploadedPath = (value = '') => {
  if (!value) return '';
  const trimmed = value.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  return trimmed.startsWith('uploads/') ? trimmed : '';
};

const resolveExistingUploadAbsolutePath = (storedValue = '') => {
  if (!storedValue) return null;
  if (storedValue.includes('..')) return null;
  const relative = storedValue.startsWith('uploads/')
    ? storedValue
    : path.join('uploads', storedValue);
  return path.join(__dirname, '..', relative);
};

const deleteUploadIfExists = (storedValue = '') => {
  const absolutePath = resolveExistingUploadAbsolutePath(storedValue);
  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const resolveTournamentLogoPath = (logoValue = '') => {
  if (!logoValue) return null;
  if (logoValue.includes('..')) return null; // Security: prevent path traversal
  
  // Handle different path formats:
  // 1. Full path with 'uploads/tournament_logos/' prefix
  // 2. Just filename (assume it's in tournament_logos)
  // 3. Path with leading slash
  
  let relativePath = logoValue;
  
  // Remove leading slash if present
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  
  // If it already has the full path, use it
  if (relativePath.startsWith('uploads/tournament_logos/')) {
    return path.join(__dirname, '..', relativePath);
  }
  
  // If it's just a filename or partial path, assume tournament_logos directory
  if (relativePath.startsWith('tournament_logos/')) {
    return path.join(__dirname, '..', 'uploads', relativePath);
  }
  
  // Just filename - assume it's in tournament_logos
  return path.join(__dirname, '..', 'uploads', 'tournament_logos', relativePath);
};

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const isDuplicatePlayerIdError = (error = {}) =>
  error.code === DUPLICATE_KEY_ERROR_CODE && error?.keyPattern?.playerId;

// Helper to generate Player ID
async function generatePlayerId(tournamentCode) {
  // Get all existing player IDs for this tournament
  const players = await Player.find({ tournamentCode }, { playerId: 1 });
  
  // Extract numeric suffixes and convert to numbers
  const usedNumbers = players
    .map(p => {
      const parts = p.playerId.split('-');
      const suffix = parts[parts.length - 1];
      const num = parseInt(suffix, 10);
      return isNaN(num) ? null : num;
    })
    .filter(num => num !== null)
    .sort((a, b) => a - b);
  
  // Find the first gap starting from 1
  let nextNumber = 1;
  for (const num of usedNumbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else if (num > nextNumber) {
      // Found a gap
      break;
    }
  }
  
  return `${tournamentCode}-${String(nextNumber).padStart(3, '0')}`;
}

// Helper: Generate Player Card (PDF)
async function generatePlayerCard(player, tournament) {
  const doc = new PDFDocument({ size: 'A6', margin: 0 }); // No margins for full control
  const outputPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Background gradient: Blue to Dark Navy
  const gradient = doc.linearGradient(0, 0, 0, pageHeight);
  gradient.stop(0, '#0B4ACB').stop(1, '#02133F');
  doc.rect(0, 0, pageWidth, pageHeight).fill(gradient);

  // Header: Semi-transparent blue overlay
  doc.fillColor('rgba(11, 74, 203, 0.8)');
  doc.rect(0, 0, pageWidth, 60).fill();

  // Tournament Logo: Top-left 40x40px
  let logoY = 10;
  const logoPath = resolveTournamentLogoPath(tournament.logo);
  if (logoPath && fs.existsSync(logoPath)) {
    doc.image(logoPath, 10, logoY, { width: 40, height: 40, fit: [40, 40] });
  } else {
    doc.fillColor('#FFC107').fontSize(20).text('🏆', 15, logoY + 10);
  }

  // Tournament Name: Bold uppercase white, right of logo
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14);
  doc.text(tournament.name.toUpperCase(), 60, logoY + 5, { width: pageWidth - 70 });

  // Tournament Code: Smaller under title
  doc.fillColor('#FFFFFF').fontSize(10);
  doc.text(`(${tournament.code.toUpperCase()})`, 60, logoY + 25);

  // Player Photo: Left side, 220x280px portrait, rounded rectangle gold border
  const photoX = 20;
  const photoY = 80;
  const photoWidth = 120; // Adjusted for A6
  const photoHeight = 160; // 3:4 ratio approx

  // Gold border rounded rectangle
  doc.roundedRect(photoX - 2, photoY - 2, photoWidth + 4, photoHeight + 4, 8).fill('#FFC107');
  // Inner for photo
  doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 6).clip();
  
  // Resolve player photo path - handle different path formats
  let photoPath = null;
  if (player.photo) {
    let photoValue = player.photo;
    // Remove leading slash if present
    if (photoValue.startsWith('/')) {
      photoValue = photoValue.slice(1);
    }
    // If already starts with 'uploads/', use it directly, otherwise prepend 'uploads/'
    if (photoValue.startsWith('uploads/')) {
      photoPath = path.join(__dirname, '..', photoValue);
    } else {
      photoPath = path.join(__dirname, '..', 'uploads', photoValue);
    }
    
    if (fs.existsSync(photoPath)) {
      doc.image(photoPath, photoX, photoY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
    } else {
      doc.fillColor('#FFFFFF').fontSize(12).text('No Photo', photoX + 30, photoY + 70);
    }
  } else {
    doc.fillColor('#FFFFFF').fontSize(12).text('No Photo', photoX + 30, photoY + 70);
  }
  doc.restore();

  // Player Details: Right side
  const detailsX = photoX + photoWidth + 20;
  const detailsY = photoY;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12);

  doc.text(`PLAYER ID: ${player.playerId}`, detailsX, detailsY);
  doc.text(`NAME: ${player.name.toUpperCase()}`, detailsX, detailsY + 20);
  doc.fillColor('#FFC107'); // Gold for role
  doc.text(`ROLE: ${player.role.toUpperCase()}`, detailsX, detailsY + 40);
  doc.fillColor('#FFFFFF');
  doc.text(`PLACE: ${player.city.toUpperCase()}`, detailsX, detailsY + 60);
  doc.text(`MOBILE: +91 ${player.mobile}`, detailsX, detailsY + 80);

  // Tournament Type and Registration Date
  doc.fillColor('#DADADA').fontSize(10);
  doc.text(`Tournament Type: ${tournament.sport}`, detailsX, detailsY + 110);
  doc.text(`Registration Date: ${new Date(player.registeredAt).toLocaleDateString()}`, detailsX, detailsY + 125);

  // Footer: Thin gold line, Powered by PlayLive
  doc.fillColor('#FFC107');
  doc.rect(0, pageHeight - 40, pageWidth, 2).fill();
  doc.fillColor('#FFFFFF').fontSize(10).text('Powered by PlayLive | playlive.com', 0, pageHeight - 25, { align: 'center', width: pageWidth });

  doc.end();

  // Wait for PDF stream to finish writing before converting to JPG
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Wait a bit more to ensure file is fully written and accessible
  await new Promise(resolve => setTimeout(resolve, 500));

  // Generate JPG from PDF (for digital view, approx 1080x720 landscape, but since PDF is portrait, adjust)
  try {
    const convert = pdf2pic.fromPath(outputPath, {
      density: 300,
      saveFilename: player.playerId,
      savePath: path.join(__dirname, '..', 'player_cards'),
      format: 'jpg',
      width: 1080, // Digital width
      height: 720  // Digital height
    });

    const result = await convert(1); // Convert first page
    // Wait a bit to ensure JPG file is written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify JPG was created
    const expectedJpgPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.1.jpg`);
    const altJpgPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.jpg`);
    
    if (result?.path && fs.existsSync(result.path)) {
      // If pdf2pic returned a different path, we might need to rename it
      const finalPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.jpg`);
      if (result.path !== finalPath && fs.existsSync(result.path)) {
        try {
          fs.copyFileSync(result.path, finalPath);
        } catch (copyError) {
          console.error('Error copying JPG file:', copyError);
        }
      }
    } else if (fs.existsSync(expectedJpgPath)) {
      // pdf2pic sometimes creates files with .1.jpg extension
      try {
        const finalPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.jpg`);
        fs.copyFileSync(expectedJpgPath, finalPath);
      } catch (copyError) {
        console.error('Error copying JPG file:', copyError);
      }
    }
  } catch (error) {
    console.error('JPG conversion failed for player', player.playerId, ':', error.message);
    // Don't throw - PDF is still available
  }

  return `/player_cards/${player.playerId}.pdf`;
}

const parsePositiveNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const getPlayerLimitForTournament = (tournament) => {
  if (!tournament) return null;
  const poolSize = parsePositiveNumber(tournament.playerPoolSize);
  if (poolSize) return poolSize;
  return parsePositiveNumber(tournament.maxPlayers);
};

const autoClosePlayerRegistration = async (tournament) => {
  if (!tournament) return;
  let shouldSave = false;

  if (tournament.playerRegistrationEnabled !== false) {
    tournament.playerRegistrationEnabled = false;
    shouldSave = true;
  }

  if (!['Closed', 'Closed Early'].includes(tournament.registrationStatus)) {
    tournament.registrationStatus = 'Closed Early';
    shouldSave = true;
  }

  if (shouldSave) {
    try {
      await tournament.save();
    } catch (saveError) {
      console.error('Failed to auto-close registration:', saveError.message);
    }
  }
};

// Upload Player Photo
const memoryUpload = multer({ storage: multer.memoryStorage() });
router.post('/upload-photo', memoryUpload.single('image'), async (req, res) => {
  try {
    const { uploadType } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const filename = `${uploadType}_${timestamp}_${randomId}.jpg`;

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'players');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filepath = path.join(uploadsDir, filename);

    // Process image with Sharp: auto-rotate based on EXIF, resize, optimize
    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true // Don't upscale small images
      })
      .jpeg({
        quality: 85,
        progressive: true, // Progressive JPEG for better loading
        mozjpeg: true // Use mozjpeg for better compression
      })
      .toFile(filepath);

    const imageUrl = `/uploads/players/${filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// 🧩 Register Player
router.post('/register', upload.fields([{ name: 'receipt' }]), async (req, res) => {
  try {
    const { name, mobile, city, role, tournamentCode, remarks, photo } = req.body;

    // Fetch tournament first to get base price from auction rules
    const tournament = await Tournament.findOne({ code: tournamentCode });
    if (!tournament) {
      return res.status(400).json({ success: false, message: 'Tournament not found' });
    }

    const playerLimit = getPlayerLimitForTournament(tournament);
    if (playerLimit) {
      const currentCount = await Player.countDocuments({ tournamentCode });
      if (currentCount >= playerLimit) {
        await autoClosePlayerRegistration(tournament);
        return res.status(400).json({
          success: false,
          code: 'PLAYER_LIMIT_REACHED',
          message: `Player registration closed. Limit of ${playerLimit} players reached.`,
          limit: playerLimit
        });
      }
    }

    // Check if payment receipt is mandatory
    if (tournament.paymentReceiptMandatory) {
      if (!req.files?.receipt?.[0]) {
        return res.status(400).json({
          success: false,
          code: 'RECEIPT_REQUIRED',
          message: 'Payment receipt upload is mandatory for this tournament. Please upload a payment receipt to complete registration.'
        });
      }
    }

    // Get base price from tournament auction rules or basePrice field
    // Priority: auctionRules.baseValueOfPlayer > basePrice > default 1000
    const basePrice = tournament.auctionRules?.baseValueOfPlayer > 0 
      ? tournament.auctionRules.baseValueOfPlayer 
      : (tournament.basePrice || 1000);

    let newPlayer = null;
    let lastDuplicateError = null;
    const playerBaseData = {
      name,
      mobile,
      city,
      role,
      tournamentCode,
      remarks,
      photo: photo ? photo.slice(1) : '',
      receipt: req.files?.receipt?.[0]?.filename || '',
      basePrice
    };

    for (let attempt = 0; attempt < MAX_PLAYER_ID_ATTEMPTS; attempt++) {
      const playerId = await generatePlayerId(tournamentCode);
      newPlayer = new Player({
        ...playerBaseData,
        playerId
      });

      try {
        await newPlayer.save();
        lastDuplicateError = null;
        break;
      } catch (saveError) {
        if (isDuplicatePlayerIdError(saveError)) {
          lastDuplicateError = saveError;
          newPlayer = null;
          continue;
        }
        throw saveError;
      }
    }

    if (!newPlayer) {
      throw lastDuplicateError || new Error('Unable to create player with a unique ID');
    }

    // Generate player card
    let cardPath = null;
    try {
      cardPath = await generatePlayerCard(newPlayer, tournament);
    } catch (cardError) {
      console.error('Error generating player card:', cardError);
      // Continue without card if generation fails
    }

    res.json({
      success: true,
      message: 'Player registered successfully',
      player: newPlayer,
      cardUrl: cardPath
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error registering player' });
  }
});

// 📊 Get player registration count for a tournament
router.get('/:tournamentCode/count', async (req, res) => {
  try {
    const { tournamentCode } = req.params;
    const [count, tournament] = await Promise.all([
      Player.countDocuments({ tournamentCode }),
      Tournament.findOne({ code: tournamentCode }).select('playerPoolSize maxPlayers minPlayers')
    ]);

    if (!tournament) {
      console.warn(`Player count requested for missing tournament ${tournamentCode}`);
      return res.json({
        success: true,
        count,
        limit: null,
        missingTournament: true
      });
    }

    const limit = getPlayerLimitForTournament(tournament);

    res.json({
      success: true,
      count,
      limit: limit ?? null
    });
  } catch (error) {
    console.error('Error fetching player count:', error);
    res.status(500).json({ success: false, message: 'Error fetching player count' });
  }
});

// 🧾 Get All Players (by tournament)
// Note: Sorting is handled on the frontend to properly sort by numeric part of playerId
router.get('/:tournamentCode', async (req, res) => {
  try {
    const players = await Player.find({ tournamentCode: req.params.tournamentCode });
    res.json({ success: true, players });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching players' });
  }
});

// Export player cards PDF (compact layout)
router.get('/:tournamentCode/cards/pdf', authenticateToken, async (req, res) => {
  if (!['TournamentAdmin', 'SuperAdmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const tournament = await Tournament.findOne({ code: req.params.tournamentCode });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    if (req.user.role === 'TournamentAdmin' && tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const players = await Player.find({ tournamentCode: req.params.tournamentCode }).sort({ playerId: 1 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="rp_cards_${req.params.tournamentCode}.pdf"`);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 28.3, bottom: 28.3, left: 28.3, right: 28.3 } // ≈10mm
    });

    doc.pipe(res);

    const cardsPerRow = 5;
    const rowsPerPage = 5;
    const gap = 14.17; // ≈5mm
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    const cardWidth = (usableWidth - (cardsPerRow - 1) * gap) / cardsPerRow;
    const cardHeight = (usableHeight - (rowsPerPage - 1) * gap) / rowsPerPage;

    const drawCard = (player, col, row) => {
      const x = doc.page.margins.left + col * (cardWidth + gap);
      const y = doc.page.margins.top + row * (cardHeight + gap);

      doc.roundedRect(x, y, cardWidth, cardHeight, 8).lineWidth(0.8).stroke('#1f2937');

      const padding = 10;
      const thumbSize = 42;
      const photoX = x + padding;
      const photoY = y + padding;
      const textX = photoX + thumbSize + 8;
      const textWidth = cardWidth - padding * 2 - thumbSize - 8;

      const photoPath = player.photo ? path.join(__dirname, '..', 'uploads', player.photo) : null;
      if (photoPath && fs.existsSync(photoPath)) {
        doc.save();
        doc.rect(photoX, photoY, thumbSize, thumbSize).clip();
        doc.image(photoPath, photoX, photoY, { width: thumbSize, height: thumbSize });
        doc.restore();
      } else {
        doc.rect(photoX, photoY, thumbSize, thumbSize).stroke('#9ca3af');
        doc.fontSize(10).fillColor('#9ca3af').text('No Photo', photoX, photoY + 12, { width: thumbSize, align: 'center' });
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(player.name || '—', textX, photoY, {
        width: textWidth,
        ellipsis: true
      });
      doc.font('Helvetica').fontSize(10).fillColor('#1f2937');
      doc.text(`Role: ${player.role || '—'}`, textX, photoY + 16, { width: textWidth, ellipsis: true });
      doc.text(`City: ${(player.city || '—').toUpperCase()}`, textX, photoY + 28, { width: textWidth, ellipsis: true });
      doc.text(`ID: ${player.playerId || '—'}`, textX, photoY + 40, { width: textWidth, ellipsis: true });
      doc.text(`Mobile: ${player.mobile || '—'}`, textX, photoY + 52, { width: textWidth, ellipsis: true });

      const badgeHeight = 16;
      const badgeY = y + cardHeight - padding - badgeHeight;
      doc.roundedRect(x + padding, badgeY, cardWidth - padding * 2, badgeHeight, 6)
        .fillOpacity(0.12).fillAndStroke('#2563eb', '#2563eb');
      doc.fillOpacity(1);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1f2937')
        .text(tournament.name || req.params.tournamentCode, x + padding, badgeY + 4, {
          width: cardWidth - padding * 2,
          align: 'center'
        });
    };

    players.forEach((player, index) => {
      const position = index % (cardsPerRow * rowsPerPage);
      const row = Math.floor(position / cardsPerRow);
      const col = position % cardsPerRow;

      if (index > 0 && position === 0) {
        doc.addPage();
      }

      drawCard(player, col, row);
    });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error generating RP Cards PDF' });
  }
});

// Get Player by ID
router.get('/player/:playerId', async (req, res) => {
  try {
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }
    res.json({ success: true, player });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching player' });
  }
});

const nodemailer = require('nodemailer');

// ✉️ Send Player Card via Email
router.post('/share', async (req, res) => {
  try {
    const { email, playerId } = req.body;
    const playerCardPath = path.join(__dirname, '..', 'player_cards', `${playerId}.pdf`);

    if (!fs.existsSync(playerCardPath)) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: `RP Card - ${playerId}`,
      text: `Hi! Please find attached your RP Card.`,
      attachments: [{ filename: `${playerId}.pdf`, path: playerCardPath }]
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Card sent successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to send card' });
  }
});

// Download JPG endpoint
router.get('/card-jpg/:playerId', async (req, res) => {
  try {
    const playerCardsDir = path.join(__dirname, '..', 'player_cards');
    const jpgPath = path.join(playerCardsDir, `${req.params.playerId}.jpg`);
    
    // Ensure player_cards directory exists
    if (!fs.existsSync(playerCardsDir)) {
      fs.mkdirSync(playerCardsDir, { recursive: true });
    }
    
    // Check for JPG with different possible extensions
    const jpgPathAlt = path.join(playerCardsDir, `${req.params.playerId}.1.jpg`);
    
    // If JPG exists (with or without .1 extension), serve it
    if (fs.existsSync(jpgPath)) {
      return res.download(jpgPath);
    }
    if (fs.existsSync(jpgPathAlt)) {
      // Copy to standard name for future requests
      try {
        fs.copyFileSync(jpgPathAlt, jpgPath);
      } catch (copyError) {
        console.error('Error copying JPG file:', copyError);
      }
      return res.download(jpgPathAlt);
    }
    
    // If JPG doesn't exist, check if PDF exists and generate JPG from it
    const pdfPath = path.join(playerCardsDir, `${req.params.playerId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      // Wait a moment to ensure PDF is fully accessible
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Generate JPG from PDF
      try {
        const convert = pdf2pic.fromPath(pdfPath, {
          density: 300,
          saveFilename: req.params.playerId,
          savePath: playerCardsDir,
          format: 'jpg',
          width: 1080,
          height: 720
        });
        
        const result = await convert(1); // Convert first page
        
        // Wait a bit for file to be written
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check multiple possible paths where pdf2pic might save the file
        const possiblePaths = [
          result?.path,
          jpgPath,
          jpgPathAlt,
          path.join(playerCardsDir, `${req.params.playerId}.1.jpg`)
        ].filter(Boolean);
        
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            // If it's the .1.jpg version, copy to standard name
            if (possiblePath.endsWith('.1.jpg') && possiblePath !== jpgPath) {
              try {
                fs.copyFileSync(possiblePath, jpgPath);
                return res.download(jpgPath);
              } catch (copyError) {
                console.error('Error copying JPG file:', copyError);
                return res.download(possiblePath);
              }
            }
            return res.download(possiblePath);
          }
        }
      } catch (error) {
        console.error('JPG conversion failed for', req.params.playerId, ':', error.message);
        console.error('Full error:', error);
        // Continue to try regenerating
      }
    }
    
    // If neither exists, try to regenerate the card
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }
    
    const tournament = await Tournament.findOne({ code: player.tournamentCode });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    
    // Generate both PDF and JPG
    try {
      await generatePlayerCard(player, tournament);
      
      // Wait a bit for files to be fully written
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if JPG was created (check both standard and .1.jpg versions)
      if (fs.existsSync(jpgPath)) {
        return res.download(jpgPath);
      }
      if (fs.existsSync(jpgPathAlt)) {
        try {
          fs.copyFileSync(jpgPathAlt, jpgPath);
          return res.download(jpgPath);
        } catch (copyError) {
          return res.download(jpgPathAlt);
        }
      }
      
      // If JPG still doesn't exist, try converting from PDF one more time
      if (fs.existsSync(pdfPath)) {
        try {
          const convert = pdf2pic.fromPath(pdfPath, {
            density: 300,
            saveFilename: req.params.playerId,
            savePath: playerCardsDir,
            format: 'jpg',
            width: 1080,
            height: 720
          });
          
          const result = await convert(1);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check multiple possible paths
          const possiblePaths = [
            result?.path,
            jpgPath,
            jpgPathAlt
          ].filter(Boolean);
          
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              if (possiblePath.endsWith('.1.jpg') && possiblePath !== jpgPath) {
                try {
                  fs.copyFileSync(possiblePath, jpgPath);
                  return res.download(jpgPath);
                } catch (copyError) {
                  return res.download(possiblePath);
                }
              }
              return res.download(possiblePath);
            }
          }
        } catch (error) {
          console.error('Final JPG conversion attempt failed for', req.params.playerId, ':', error.message);
          console.error('Full error:', error);
        }
      }
    } catch (cardError) {
      console.error('Error generating player card for', req.params.playerId, ':', cardError.message);
      console.error('Full error:', cardError);
    }
    
    // If still not found, return 404 with helpful message
    console.error(`JPG card generation failed for player ${req.params.playerId}. PDF exists: ${fs.existsSync(pdfPath)}`);
    res.status(404).json({ 
      success: false, 
      message: 'JPG card not found and could not be generated. Please ensure GraphicsMagick or ImageMagick is installed on the server.' 
    });
  } catch (error) {
    console.error('Error serving JPG card for', req.params.playerId, ':', error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating JPG card',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update Player (TournamentAdmin or SuperAdmin only)
router.put('/:playerId', authenticateToken, upload.fields([{ name: 'photo' }, { name: 'receipt' }]), async (req, res) => {
  if (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const { name, mobile, city, role, remarks } = req.body;
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    // Check if TournamentAdmin owns the tournament
    if (req.user.role === 'TournamentAdmin') {
      const tournament = await Tournament.findOne({ code: player.tournamentCode });
      if (!tournament || tournament.adminId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Update fields
    if (name) player.name = name.toUpperCase();
    if (mobile) player.mobile = mobile;
    if (city) player.city = city.toUpperCase();
    if (role) player.role = role;
    if (remarks !== undefined) player.remarks = remarks;

    // Handle photo update via direct upload
    if (req.files?.photo?.[0]) {
      if (player.photo) {
        deleteUploadIfExists(player.photo);
      }
      player.photo = req.files.photo[0].filename;
    }

    // Handle optimized photo flow (cropped & uploaded beforehand)
    if (req.body.photoUrl) {
      const normalizedPhoto = normalizeUploadedPath(req.body.photoUrl);
      if (normalizedPhoto) {
        if (player.photo && player.photo !== normalizedPhoto) {
          deleteUploadIfExists(player.photo);
        }
        player.photo = normalizedPhoto;
      }
    }

    // Handle receipt update
    if (req.files?.receipt?.[0]) {
      // Delete old receipt if exists (using safe helper for consistency)
      if (player.receipt) {
        deleteUploadIfExists(player.receipt);
      }
      player.receipt = req.files.receipt[0].filename;
    }

    await player.save();

    // Regenerate player card if details changed
    const tournament = await Tournament.findOne({ code: player.tournamentCode });
    const cardPath = await generatePlayerCard(player, tournament);

    res.json({ success: true, message: 'Player updated successfully', player, cardUrl: cardPath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating player' });
  }
});

// Delete Player (TournamentAdmin or SuperAdmin only)
router.delete('/:playerId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const player = await Player.findOne({ playerId: req.params.playerId });
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    // Check if TournamentAdmin owns the tournament
    if (req.user.role === 'TournamentAdmin') {
      const tournament = await Tournament.findOne({ code: player.tournamentCode });
      if (!tournament || tournament.adminId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Delete associated files
    if (player.photo) {
      const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }
    if (player.receipt) {
      const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
      if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);
    }
    const cardPdfPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
    if (fs.existsSync(cardPdfPath)) fs.unlinkSync(cardPdfPath);
    const cardJpgPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.jpg`);
    if (fs.existsSync(cardJpgPath)) fs.unlinkSync(cardJpgPath);

    // Delete player
    await Player.findByIdAndDelete(player._id);

    res.json({ success: true, message: 'Player deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting player' });
  }
});

// Delete All Players for a Tournament (TournamentAdmin or SuperAdmin only)
router.delete('/tournament/:tournamentCode/all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const { tournamentCode } = req.params;

    // Check if TournamentAdmin owns the tournament
    if (req.user.role === 'TournamentAdmin') {
      const tournament = await Tournament.findOne({ code: tournamentCode });
      if (!tournament || tournament.adminId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Find all players for this tournament
    const players = await Player.find({ tournamentCode });
    
    if (players.length === 0) {
      return res.json({ success: true, message: 'No players found to delete', deletedCount: 0 });
    }

    // Delete associated files and player records
    let deletedCount = 0;
    for (const player of players) {
      try {
        // Delete photo file
        if (player.photo) {
          const photoPath = path.join(__dirname, '..', 'uploads', player.photo);
          if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        }
        
        // Delete receipt file
        if (player.receipt) {
          const receiptPath = path.join(__dirname, '..', 'uploads', player.receipt);
          if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);
        }
        
        // Delete player card files
        const cardPdfPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.pdf`);
        if (fs.existsSync(cardPdfPath)) fs.unlinkSync(cardPdfPath);
        
        const cardJpgPath = path.join(__dirname, '..', 'player_cards', `${player.playerId}.jpg`);
        if (fs.existsSync(cardJpgPath)) fs.unlinkSync(cardJpgPath);

        // Delete player record
        await Player.findByIdAndDelete(player._id);
        deletedCount++;
      } catch (playerError) {
        console.error(`Error deleting player ${player.playerId}:`, playerError);
        // Continue with other players even if one fails
      }
    }

    res.json({ 
      success: true, 
      message: `Successfully deleted ${deletedCount} player(s)`, 
      deletedCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting players' });
  }
});

// Configure multer for import file uploads (memory storage)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed!'), false);
    }
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
    if (req.user.role === 'TournamentAdmin' && tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Import Template
    const templateSheet = workbook.addWorksheet('Import Template');
    
    // Get valid roles for this tournament
    const validRoles = getValidRoles(tournament.sport);
    
    // Headers
    const headers = [
      'name',
      'mobile',
      'city',
      'role',
      'remarks',
      'photo',
      'receipt',
      'basePrice'
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
      { width: 25 }, // name
      { width: 15 }, // mobile
      { width: 15 }, // city
      { width: 20 }, // role
      { width: 30 }, // remarks
      { width: 40 }, // photo
      { width: 40 }, // receipt
      { width: 12 }  // basePrice
    ];

    // Add example rows
    const examples = [
      {
        name: 'JOHN DOE',
        mobile: '9876543210',
        city: 'Mumbai',
        role: validRoles[0] || 'Batsman',
        remarks: 'Experienced player',
        photo: 'uploads/players/john.jpg',
        receipt: '',
        basePrice: 1000
      },
      {
        name: 'JANE SMITH',
        mobile: '9876543211',
        city: 'Delhi',
        role: validRoles[1] || 'Bowler',
        remarks: 'New player',
        photo: '',
        receipt: 'uploads/receipts/jane.pdf',
        basePrice: 1500
      }
    ];

    examples.forEach(example => {
      const row = templateSheet.addRow([
        example.name,
        example.mobile,
        example.city,
        example.role,
        example.remarks,
        example.photo,
        example.receipt,
        example.basePrice
      ]);
      
      // Style example rows (light gray)
      row.font = { color: { argb: 'FF808080' } };
    });

    // Add comments/notes to header cells
    templateSheet.getCell('A1').note = 'Required: Player full name';
    templateSheet.getCell('B1').note = 'Required: 10-digit mobile number';
    templateSheet.getCell('C1').note = 'Required: City/Place name';
    templateSheet.getCell('D1').note = `Required: Valid role for ${tournament.sport} (${validRoles.join(', ')})`;
    templateSheet.getCell('E1').note = 'Optional: Special notes';
    templateSheet.getCell('F1').note = 'Optional: Photo path (uploads/players/...) or URL';
    templateSheet.getCell('G1').note = 'Optional: Receipt path (uploads/...) or URL';
    templateSheet.getCell('H1').note = 'Optional: Base price for auction (default: 1000)';

    // Freeze first row
    templateSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Sheet 2: Instructions
    const instructionsSheet = workbook.addWorksheet('Instructions');
    
    const instructions = [
      ['Player Import Instructions'],
      [''],
      ['Step 1: Prepare Your File'],
      ['1. Fill in all required fields (highlighted in yellow)'],
      ['2. Add optional fields as needed'],
      ['3. Ensure mobile numbers are 10-digit format'],
      ['4. Role must match valid roles for tournament sport'],
      [''],
      ['Step 2: Required Fields'],
      ['- name: Player full name'],
      ['- mobile: 10-digit Indian format (e.g., 9876543210)'],
      ['- city: City/Place name'],
      [`- role: Valid role for ${tournament.sport} (${validRoles.join(', ')})`],
      [''],
      ['Step 3: Optional Fields'],
      ['- remarks: Special notes'],
      ['- photo: Relative path (uploads/players/...) or full URL'],
      ['- receipt: Relative path (uploads/...) or full URL'],
      ['- basePrice: Base price for auction (default: 1000)'],
      [''],
      ['Step 4: Photo Instructions'],
      ['Option 1: Relative Path'],
      ['  Format: uploads/players/filename.jpg'],
      ['  File must exist on server'],
      [''],
      ['Option 2: Full URL'],
      ['  Format: https://example.com/photo.jpg'],
      ['  Will be downloaded automatically'],
      [''],
      ['Option 3: Leave Empty'],
      ['  Player will be created without photo'],
      [''],
      ['Step 5: Receipt Instructions'],
      ['Option 1: Relative Path'],
      ['  Format: uploads/receipts/filename.pdf'],
      ['  File must exist on server'],
      [''],
      ['Option 2: Full URL'],
      ['  Format: https://example.com/receipt.pdf'],
      ['  Will be downloaded automatically'],
      [''],
      ['Option 3: Leave Empty'],
      ['  Player will be created without receipt'],
      [''],
      ['Step 6: File Requirements'],
      ['- Format: CSV or Excel (.xlsx)'],
      ['- Encoding: UTF-8'],
      ['- Max size: 10MB'],
      ['- First row: Column headers'],
      [''],
      ['Common Issues'],
      ['- Invalid mobile: Use 10-digit format'],
      ['- Invalid role: Must match tournament sport roles'],
      ['- Photo not found: Verify path or URL'],
      ['- Receipt not found: Verify path or URL'],
      ['- Duplicate player: Player with same mobile exists']
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
    res.setHeader('Content-Disposition', `attachment; filename=player_import_template_${code}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ success: false, message: 'Error generating template' });
  }
});

// Import players from file
router.post('/import/:code', authenticateToken, importUpload.single('file'), async (req, res) => {
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

    // Check admin access
    if (req.user.role === 'TournamentAdmin' && tournament.adminId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

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
    const requiredFields = ['name', 'mobile', 'city', 'role'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingFields.join(', ')}`,
        detectedMapping: columnMapping,
        availableHeaders: headers
      });
    }

    // Get existing players for duplicate checking
    const existingPlayers = await Player.find({ tournamentCode: code });
    const playerLimit = getPlayerLimitForTournament(tournament);
    let currentTournamentCount = existingPlayers.length;
    let autoClosedDueToLimit = false;

    // Process rows
    const previewRows = isPreview ? rows.slice(0, 10) : rows;
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < previewRows.length; i++) {
      const row = previewRows[i];
      const playerData = mapRowToPlayer(row, columnMapping);
      
      // Validate data
      const validation = validatePlayerData(playerData, tournament, existingPlayers);
      
      const result = {
        rowNumber: i + 2, // +2 because row 1 is header, and arrays are 0-indexed
        data: playerData,
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
            const mobile = playerData.mobile.trim().replace(/\s+/g, '');
            
            // Check for duplicate
            const duplicate = existingPlayers.find(p => 
              p.mobile.replace(/\s+/g, '') === mobile
            );

            if (duplicate) {
              if (shouldUpdate) {
                // Update existing player
                const updateData = {
                  name: playerData.name.trim(),
                  city: playerData.city.trim(),
                  role: playerData.role.trim()
                };

                if (playerData.remarks) {
                  updateData.remarks = playerData.remarks.trim();
                }
                if (playerData.basePrice) {
                  const basePrice = parseFloat(playerData.basePrice);
                  if (!isNaN(basePrice) && basePrice >= 0) {
                    updateData.basePrice = basePrice;
                  }
                }

                // Process photo if provided
                if (playerData.photo) {
                  const photoPath = await processFilePath(playerData.photo, code, playerData.name, 'photo');
                  if (photoPath) {
                    updateData.photo = photoPath;
                  }
                }

                // Process receipt if provided
                if (playerData.receipt) {
                  const receiptPath = await processFilePath(playerData.receipt, code, playerData.name, 'receipt');
                  if (receiptPath) {
                    updateData.receipt = receiptPath;
                  }
                }

                await Player.findByIdAndUpdate(duplicate._id, updateData);
                result.status = 'updated';
                result.message = `Player updated: ${duplicate.playerId}`;
                result.playerId = duplicate.playerId;
                updatedCount++;
              } else {
                result.status = 'skipped';
                result.message = `Duplicate player found: ${duplicate.playerId}`;
                skippedCount++;
              }
            } else {
              // Create new player
              // Check player limit
              if (playerLimit && currentTournamentCount >= playerLimit) {
                if (!autoClosedDueToLimit) {
                  await autoClosePlayerRegistration(tournament);
                  autoClosedDueToLimit = true;
                }
                result.status = 'error';
                result.code = 'PLAYER_LIMIT_REACHED';
                result.message = `Tournament player limit reached (${playerLimit})`;
                errorCount++;
                results.push(result);
                continue;
              }

              // Process photo
              let photoPath = null;
              if (playerData.photo) {
                photoPath = await processFilePath(playerData.photo, code, playerData.name, 'photo');
              }

              // Process receipt
              let receiptPath = null;
              if (playerData.receipt) {
                receiptPath = await processFilePath(playerData.receipt, code, playerData.name, 'receipt');
              }

              // Get base price
              const basePrice = playerData.basePrice ? parseFloat(playerData.basePrice) : 1000;
              const finalBasePrice = isNaN(basePrice) || basePrice < 0 ? 1000 : basePrice;

              let newPlayer = null;
              let lastDuplicateError = null;

              for (let attempt = 0; attempt < MAX_PLAYER_ID_ATTEMPTS; attempt++) {
                const playerId = await generatePlayerId(code);
                const candidate = new Player({
                  playerId,
                  name: playerData.name.trim(),
                  mobile: mobile,
                  city: playerData.city.trim(),
                  role: playerData.role.trim(),
                  tournamentCode: code,
                  photo: photoPath,
                  receipt: receiptPath,
                  basePrice: finalBasePrice,
                  auctionStatus: 'Available'
                });

                if (playerData.remarks) {
                  candidate.remarks = playerData.remarks.trim();
                }

                try {
                  await candidate.save();
                  newPlayer = candidate;
                  lastDuplicateError = null;
                  break;
                } catch (createError) {
                  if (isDuplicatePlayerIdError(createError)) {
                    lastDuplicateError = createError;
                    continue;
                  }
                  throw createError;
                }
              }

              if (!newPlayer) {
                throw lastDuplicateError || new Error('Unable to create player with a unique ID');
              }

              // Generate player card
              try {
                await generatePlayerCard(newPlayer, tournament);
              } catch (cardError) {
                console.error('Error generating player card:', cardError);
                // Don't fail the import if card generation fails
              }

              result.status = 'success';
              result.message = `Player created: ${newPlayer.playerId}`;
              result.playerId = newPlayer.playerId;
              successCount++;
              currentTournamentCount++;

              // Add to existing players for subsequent duplicate checks
              existingPlayers.push(newPlayer);
            }
          } catch (createError) {
            result.status = 'error';
            result.message = `Error creating player: ${createError.message}`;
            errorCount++;
          }
        }
        results.push(result);
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
    console.error('Error importing players:', error);
    res.status(500).json({ success: false, message: 'Error importing players', error: error.message });
  }
});

module.exports = router;
