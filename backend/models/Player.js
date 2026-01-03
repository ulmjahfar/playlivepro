const mongoose = require('mongoose');

const bidEntrySchema = new mongoose.Schema({
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamName: { type: String },
  bidAmount: { type: Number, required: true },
  bidTime: { type: Date, default: Date.now }
}, { _id: false });

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  city: String,
  role: String,
  tournamentCode: { type: String, required: true },
  photo: String,
  receipt: String,
  remarks: String,
  basePrice: { type: Number, default: 1000 },
  currentBid: { type: Number, default: 0 },
  currentBidTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  currentBidTeamName: { type: String },
  soldPrice: { type: Number },
  soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  soldToName: { type: String },
  soldAt: { type: Date },
  auctionStatus: {
    type: String,
    enum: ['Available', 'InAuction', 'Pending', 'Sold', 'Unsold', 'Withdrawn'],
    default: 'Available',
    index: true
  },
  bidHistory: [bidEntrySchema],
  registeredAt: { type: Date, default: Date.now },
  auctionedAt: { type: Date },
  pendingAt: { type: Date },
  unsoldAt: { type: Date },
  withdrawnAt: { type: Date },
  withdrawalReason: { type: String },
  lastAuctionEventAt: { type: Date },
  transactionType: {
    type: String,
    enum: ['Auction', 'DirectAssign', 'ForceAuction'],
    default: 'Auction'
  }
});

playerSchema.index({ tournamentCode: 1 });
playerSchema.index({ tournamentCode: 1, auctionStatus: 1 });
playerSchema.index({ tournamentCode: 1, soldTo: 1 });

module.exports = mongoose.model('Player', playerSchema);
