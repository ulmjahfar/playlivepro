const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const { authenticateToken, authorizeRoles } = require('./authRoutes');

const router = express.Router();

// Generate PDF player card
router.get('/generate/:playerId', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin', 'Player'), async (req, res) => {
  try {
    const player = await Player.findById(req.params.playerId).populate('tournamentCode');
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    const doc = new PDFDocument();
    const fileName = `player_card_${player.playerId}.pdf`;
    const filePath = path.join(__dirname, '../player_cards', fileName);

    // Ensure directory exists
    if (!fs.existsSync(path.join(__dirname, '../player_cards'))) {
      fs.mkdirSync(path.join(__dirname, '../player_cards'), { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).text('PlayLive Tournament', { align: 'center' });
    doc.fontSize(16).text(player.tournamentCode.name, { align: 'center' });
    doc.moveDown();

    // Player Photo (placeholder)
    doc.fontSize(12).text('Player Photo:', 100, 150);
    doc.rect(100, 170, 100, 100).stroke();
    doc.text('Photo Here', 120, 210);
    doc.moveDown(10);

    // Player Details
    doc.fontSize(14).text(`Player ID: ${player.playerId}`);
    doc.text(`Name: ${player.name}`);
    doc.text(`Role: ${player.role}`);
    doc.text(`City: ${player.city}`);
    doc.text(`Mobile: ${player.mobile}`);
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('Powered by PlayLive — Tournament Made Simple', { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      res.download(filePath, fileName, (err) => {
        if (err) console.error(err);
        // Optionally delete file after download
        // fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error generating PDF' });
  }
});

module.exports = router;
