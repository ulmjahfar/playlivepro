const mongoose = require('mongoose');

const featureDefinitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  defaultTier: {
    type: String,
    enum: ['Standard', 'AuctionPro'],
    required: true
  },
  category: {
    type: String,
    enum: [
      'TournamentManagement',
      'Registration',
      'Auction',
      'Finance',
      'Reports',
      'Analytics',
      'Notifications',
      'Broadcast',
      'Branding',
      'AdminTools'
    ],
    required: true
  },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FeatureDefinition', featureDefinitionSchema);



