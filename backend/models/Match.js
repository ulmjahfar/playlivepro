const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tournamentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tournament', 
    required: true 
  },
  tournamentCode: { 
    type: String, 
    required: true,
    index: true
  },
  teamA: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team', 
    required: false // Can be null if BYE
  },
  teamB: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team', 
    required: false // Can be null if BYE
  },
  groupA: { 
    type: String 
  },
  groupB: { 
    type: String 
  },
  round: { 
    type: Number, 
    required: true,
    index: true
  },
  matchNo: { 
    type: Number, 
    required: true,
    index: true
  },
  fixtureType: { 
    type: String, 
    enum: ['straight', 'mixed', 'mixed-group', 'within-group'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'live', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  scheduledDate: { 
    type: Date 
  },
  result: {
    teamAScore: { type: Number },
    teamBScore: { type: Number },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    isDraw: { type: Boolean, default: false }
  },
  teamABye: { 
    type: Boolean, 
    default: false 
  },
  teamBBye: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound indexes for efficient queries
matchSchema.index({ tournamentCode: 1, round: 1 });
matchSchema.index({ tournamentCode: 1, matchNo: 1 });
matchSchema.index({ tournamentId: 1, round: 1 });

// Update the updatedAt field before saving
matchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Match', matchSchema);

