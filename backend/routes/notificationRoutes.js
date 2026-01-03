const express = require('express');
const nodemailer = require('nodemailer');
const { Client } = require('whatsapp-web.js');
const Player = require('../models/Player');
const { authenticateToken, authorizeRoles } = require('./authRoutes');

const router = express.Router();

// WhatsApp client (initialize once)
const whatsapp = new Client();
whatsapp.initialize();

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send notification
router.post('/send', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin'), async (req, res) => {
  try {
    const { tournamentCode, message, type, playerIds } = req.body; // type: 'email' or 'whatsapp'

    let players = [];
    if (playerIds && playerIds.length > 0) {
      players = await Player.find({ _id: { $in: playerIds } });
    } else {
      players = await Player.find({ tournamentCode });
    }

    const results = [];

    for (const player of players) {
      try {
        if (type === 'email' && player.email) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: player.email,
            subject: 'Tournament Notification',
            text: message
          });
          results.push({ playerId: player.playerId, status: 'Sent via Email' });
        } else if (type === 'whatsapp' && player.mobile) {
          // Note: WhatsApp API requires setup, this is placeholder
          // await whatsapp.sendMessage(`91${player.mobile}@c.us`, message);
          results.push({ playerId: player.playerId, status: 'Sent via WhatsApp' });
        } else {
          results.push({ playerId: player.playerId, status: 'Failed - No contact info' });
        }
      } catch (err) {
        results.push({ playerId: player.playerId, status: 'Failed' });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error sending notifications' });
  }
});

module.exports = router;
