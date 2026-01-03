const mongoose = require('mongoose');

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const seatSchema = new mongoose.Schema({
  label: { type: String, required: true },
  role: {
    type: String,
    enum: ['Lead', 'Strategist', 'Finance', 'Analyst', 'Viewer'],
    default: 'Lead'
  },
  email: { type: String },
  phone: { type: String },
  status: {
    type: String,
    enum: ['Invited', 'Active', 'Disabled'],
    default: 'Invited'
  },
  isVoter: { type: Boolean, default: true },
  isLead: { type: Boolean, default: false },
  accessCode: { type: String, required: true },
  pinHash: { type: String, required: true, select: false },
  authVersion: { type: Number, default: 0 },
  lastLoginAt: { type: Date },
  lastVoteAt: { type: Date },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const seatPolicySchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['single', 'majority', 'unanimous', 'any'],
    default: 'single'
  },
  votersRequired: { type: Number, default: 1 },
  allowDynamicQuorum: { type: Boolean, default: true },
  allowLeadOverride: { type: Boolean, default: true },
  autoResetOnBid: { type: Boolean, default: true }
}, { _id: false });

const teamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true }, // Generated, e.g., KPL2026-T001
  name: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v === v.toUpperCase() && v.length >= 3;
      },
      message: 'Team name must be uppercase and at least 3 characters.'
    }
  },
  logo: { type: String }, // Path to team logo file
  captainName: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  city: { type: String, required: true },
  numberOfPlayers: { type: Number, required: true },
  guestPlayers: [{
    name: { type: String },
    role: { type: String },
    photo: { type: String } // Path to guest player photo
  }],
  teamIcons: [{ type: String }], // Array of selected icons, e.g., ['⚽', '🏆']
  tournamentCode: { type: String, required: true },
  budget: { type: Number, default: 0 }, // Team's total budget for auction
  currentBalance: { type: Number, default: 0 }, // Cached balance updated during auction
  purchasedPlayers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  confirmationPdf: { type: String }, // Path to confirmation PDF
  auctionAccessCode: { type: String, select: false },
  seats: {
    type: [seatSchema],
    default: undefined,
    select: false
  },
  seatPolicy: {
    type: seatPolicySchema,
    default: () => ({})
  },
  group: { type: String }, // "A", "B", "C", "D", etc.
  groupIndex: { type: Number }, // 0, 1, 2, 3 for sorting
  createdAt: { type: Date, default: Date.now }
});

// Add index for performance
teamSchema.index({ tournamentCode: 1 });
teamSchema.index({ createdAt: -1 });
teamSchema.index({ tournamentCode: 1, name: 1 });

teamSchema.pre('save', function(next) {
  if (!this.auctionAccessCode) {
    this.auctionAccessCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

teamSchema.methods.generateSeatPinHash = async function(pin) {
  return bcrypt.hash(pin, 10);
};

module.exports = mongoose.model('Team', teamSchema);
