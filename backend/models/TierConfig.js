const mongoose = require('mongoose');

const tierConfigSchema = new mongoose.Schema({
  tier: {
    type: String,
    enum: ['Standard', 'AuctionPro'],
    required: true,
    unique: true
  },
  features: [{ type: String, required: true }],
  metadata: {
    displayName: { type: String },
    description: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('TierConfig', tierConfigSchema);



