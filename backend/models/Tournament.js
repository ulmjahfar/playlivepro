const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  sport: { type: String, enum: ['Cricket', 'Football', 'Volleyball', 'Basketball'], required: true },
  startDate: Date,
  endDate: Date,
  location: String,
  status: { type: String, enum: ['Upcoming', 'Active', 'Completed', 'End'], default: 'Upcoming' },
  plan: {
    type: String,
    enum: ['Standard', 'AuctionPro'],
    default: 'Standard'
  },
  featureOverrides: {
    type: Map,
    of: Boolean,
    default: {}
  },
  auctionStatus: {
    type: String,
    enum: ['NotStarted', 'Running', 'Paused', 'Completed'],
    default: 'NotStarted'
  },
  auctionEndedAt: { type: Date },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // TournamentAdmin
  basePrice: { type: Number, default: 1000 },
  playerPoolSize: { type: Number, default: 128 }, // Total players available for auction pool
  auctionRules: {
    type: { type: String, enum: ['slab', 'straight'], default: 'slab' },
    fixedIncrement: { type: Number, default: 100 }, // For straight method
    ranges: [{ // For slab method
      from: { type: Number },
      to: { type: Number },
      increment: { type: Number }
    }],
    maxBidsPerPlayer: { type: Number, default: 5 },
    bidLimitMode: { type: String, enum: ['limit', 'unlimited'], default: 'limit' },
    bidLimitCount: { type: Number, default: 5 },
    baseValueOfPlayer: { type: Number, default: 0 },
    maxFundForTeam: { type: Number, default: 0 }
  },
  participatingTeams: { type: Number, min: 2, max: 100, default: 8 },
  minPlayers: { type: Number, default: 11 }, // Minimum players per team
  maxPlayers: { type: Number, default: 16 }, // Maximum players per team
  playerRegistrationEnabled: { type: Boolean, default: false },
  registrationStartDate: Date,
  registrationEndDate: Date,
  registrationLink: { type: String }, // e.g., https://playlive.ddns.me/register/KPL2026
  registrationStatus: { type: String, enum: ['Not Started', 'Active', 'Closed', 'Closed Early'], default: 'Not Started' },
  teamRegistrationLink: { type: String }, // e.g., https://playlive.ddns.me/register/team/KPL2026
  teamRegistrationEnabled: { type: Boolean, default: false },
  paymentReceiptMandatory: { type: Boolean, default: false }, // Require payment receipt upload during player registration
  adminUsername: { type: String }, // Auto-generated, e.g., admin.kpl2026
  adminPasswordHash: { type: String }, // Hashed password for tournament admin
  logo: String, // Path to tournament logo file
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  auctionState: {
    status: {
      type: String,
      enum: ['NotStarted', 'Running', 'Paused', 'Completed'],
      default: 'NotStarted'
    },
    stage: {
      type: String,
      enum: ['Idle', 'Initialize', 'SelectingPlayer', 'Bidding', 'LastCall', 'Sold', 'Pending', 'Finalizing'],
      default: 'Idle'
    },
    currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    highestBidderName: { type: String },
    timerSeconds: { type: Number, default: 0 },
    lastCallActive: { type: Boolean, default: false },
    lastCallTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    lastCallTeamName: { type: String },
    lastCallTimerSeconds: { type: Number, default: 0 },
    lastCallStartedAt: { type: Date },
    lastCallResumeSeconds: { type: Number, default: 0 },
    pendingPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    logs: [{
      message: { type: String },
      type: { type: String, enum: ['info', 'bid', 'status', 'error', 'system'], default: 'info' },
      meta: { type: mongoose.Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now }
    }],
    lastActionAt: { type: Date },
    lastStartedAt: { type: Date },
    reportPdf: { type: String },
    currentRound: { type: Number, default: 1 },
    maxRounds: { type: Number, default: 1 },
    isLocked: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedSummary: { type: mongoose.Schema.Types.Mixed }
  },
  withdrawnPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  // Auto-delete settings
  autoDeleteAt: { type: Date }, // Date when tournament should be auto-deleted
  autoDeleteEnabled: { type: Boolean, default: null }, // null = use system setting, true/false = override
  autoDeleteDays: { type: Number, min: 7 }, // Per-tournament override for days (null = use system setting)
  // Auction Master Switch
  auctionEnabled: { type: Boolean, default: true }, // Master switch to enable/disable all auction features
  auctionAdminControlEnabled: { type: Boolean, default: true }, // Allow Tournament Admin to control auction switch (SuperAdmin can override)
  // Advanced Auction Settings
  auctionAdvancedSettings: {
    assistantNotes: { type: String, default: '' },
    automationRules: {
      pendingRound2: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, default: 3 }
      },
      timerUnsold: {
        enabled: { type: Boolean, default: false },
        seconds: { type: Number, default: 5 }
      },
      publishResults: {
        enabled: { type: Boolean, default: true }
      }
    },
    autoNextEnabled: { type: Boolean, default: true },
    autoTimerEnabled: { type: Boolean, default: true },
    timerSeconds: { type: Number, default: 30 },
    lastCallTimerSeconds: { type: Number, default: 10 },
    autoTimeoutAction: { type: String, enum: ['pending', 'unsold'], default: 'pending' },
    soundEnabled: { type: Boolean, default: true },
    voiceAnnouncerEnabled: { type: Boolean, default: false },
    timerEnabled: { type: Boolean, default: true },
    auctionMode: { type: String, enum: ['normal', 'pro'], default: 'normal' },
    animationSettings: {
      nextPlayerAnimationDuration: { type: Number, default: 3000, min: 1000, max: 10000 }, // milliseconds
      groupingAnimationDuration: { type: Number, default: 3500, min: 1000, max: 10000 },
      fixturesAnimationDuration: { type: Number, default: 4000, min: 1000, max: 10000 },
      soldAnimationDuration: { type: Number, default: 5000, min: 2000, max: 10000 }
    }
  },
  // Team Grouping
  groups: [{
    name: { type: String, required: true }, // "A", "B", "C", "D"
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    locked: { type: Boolean, default: false }
  }],
  groupsLocked: { type: Boolean, default: false },
  groupingSettings: {
    numberOfGroups: { type: Number },
    teamsPerGroup: { type: Number },
    groupingType: { type: String, enum: ['random', 'seeded', 'city-based'], default: 'random' },
    avoidSameCity: { type: Boolean, default: false },
    spinDelay: { type: Number, default: 3000 } // Duration for wheel spin animation in milliseconds
  },
  // Report Posters for PDF export
  reportPosters: {
    firstPage: { type: String }, // Path to first page poster
    secondPage: { type: String }, // Path to second page poster
    lastPage: { type: String } // Path to last page poster
  },
  // Custom Links
  customLinks: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: '🔗' },
    category: { type: String, default: 'Custom' },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  // User Layout Preferences for Auction Dashboard
  userLayoutPreferences: {
    type: Map,
    of: {
      layout: {
        type: Map,
        of: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          w: { type: Number, default: 6 },
          h: { type: Number, default: 6 },
          minW: { type: Number, default: 3 },
          minH: { type: Number, default: 3 }
        }
      },
      gridCols: { type: Number, default: 12 },
      gridRows: { type: Number, default: 12 },
      updatedAt: { type: Date, default: Date.now }
    },
    default: {}
  },
  // Player Card Design Configuration
  playerCardDesign: {
    background: {
      type: { type: String, enum: ['gradient', 'image'], default: 'gradient' },
      gradient: { type: String },
      imageUrl: { type: String },
      opacity: { type: Number, default: 1, min: 0, max: 1 },
      overlay: { type: String }
    },
    logo: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      size: { type: Number, default: 100 },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 10 },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    tournamentName: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      fontSize: { type: Number, default: 24 },
      color: { type: String, default: '#ffffff' },
      fontFamily: { type: String, default: 'Arial' },
      fontWeight: { type: String, default: 'bold' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      textWrap: { type: Boolean, default: true },
      maxLettersPerLine: { type: Number, default: 0 },
      textStrokeEnabled: { type: Boolean, default: false },
      textStrokeWidth: { type: Number, default: 1 },
      textStrokeColor: { type: String, default: '#000000' },
      width: { type: Number },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 20 },
      circularBorder: { type: Boolean, default: false },
      borderShape: { type: String, enum: ['circle', 'square'], default: 'circle' },
      borderSizeMultiplier: { type: Number, default: 1.8 },
      borderColor: { type: String, default: '#ffffff' },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    playerPhoto: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      size: {
        width: { type: Number, default: 180 },
        height: { type: Number, default: 180 }
      },
      shape: { type: String, enum: ['circle', 'square', 'rounded'], default: 'circle' },
      borderWidth: { type: Number, default: 0 },
      borderColor: { type: String, default: '#ffffff' },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 30 },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    playerDetails: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      fontSize: { type: Number, default: 16 },
      color: { type: String, default: '#ffffff' },
      fontFamily: { type: String, default: 'Arial' },
      fontWeight: { type: String, default: 'normal' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      textWrap: { type: Boolean, default: true },
      maxLettersPerLine: { type: Number, default: 0 },
      textStrokeEnabled: { type: Boolean, default: false },
      textStrokeWidth: { type: Number, default: 1 },
      textStrokeColor: { type: String, default: '#000000' },
      width: { type: Number },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 40 },
      circularBorder: { type: Boolean, default: false },
      borderShape: { type: String, enum: ['circle', 'square'], default: 'circle' },
      borderSizeMultiplier: { type: Number, default: 1.8 },
      borderColor: { type: String, default: '#ffffff' },
      showLabels: { type: Boolean, default: true },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    playerName: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      fontSize: { type: Number, default: 24 },
      color: { type: String, default: '#ffffff' },
      fontFamily: { type: String, default: 'Arial' },
      fontWeight: { type: String, default: 'bold' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      textWrap: { type: Boolean, default: true },
      maxLettersPerLine: { type: Number, default: 0 },
      textStrokeEnabled: { type: Boolean, default: false },
      textStrokeWidth: { type: Number, default: 1 },
      textStrokeColor: { type: String, default: '#000000' },
      width: { type: Number },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 50 },
      circularBorder: { type: Boolean, default: false },
      borderShape: { type: String, enum: ['circle', 'square'], default: 'circle' },
      borderSizeMultiplier: { type: Number, default: 1.8 },
      borderColor: { type: String, default: '#ffffff' },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    playerId: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      fontSize: { type: Number, default: 14 },
      color: { type: String, default: '#ffffff' },
      fontFamily: { type: String, default: 'Arial' },
      fontWeight: { type: String, default: 'normal' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      textWrap: { type: Boolean, default: true },
      maxLettersPerLine: { type: Number, default: 0 },
      textStrokeEnabled: { type: Boolean, default: false },
      textStrokeWidth: { type: Number, default: 1 },
      textStrokeColor: { type: String, default: '#000000' },
      width: { type: Number },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 60 },
      circularBorder: { type: Boolean, default: true },
      borderShape: { type: String, enum: ['circle', 'square'], default: 'circle' },
      borderSizeMultiplier: { type: Number, default: 1.8 },
      borderColor: { type: String, default: '#ffffff' },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    },
    cardDimensions: {
      width: { type: Number, default: 600 },
      height: { type: Number, default: 800 },
      aspectRatio: { type: Number, default: 0.75 }
    },
    shapes: [{
      type: { type: String, enum: ['rect', 'ellipse'], default: 'rect' },
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
      },
      size: {
        width: { type: Number, default: 120 },
        height: { type: Number, default: 20 }
      },
      color: { type: String, default: 'rgba(59, 130, 246, 0.35)' },
      opacity: { type: Number, default: 1 },
      borderRadius: { type: Number, default: 12 },
      visible: { type: Boolean, default: true },
      zIndex: { type: Number, default: 5 },
      shadowEnabled: { type: Boolean, default: false },
      shadowColor: { type: String, default: 'rgba(0, 0, 0, 0.5)' },
      shadowBlur: { type: Number, default: 4 },
      shadowOffsetX: { type: Number, default: 2 },
      shadowOffsetY: { type: Number, default: 2 }
    }]
  }
});

// Add indexes for performance
tournamentSchema.index({ adminId: 1 }); // Index for populate queries
tournamentSchema.index({ createdAt: -1 }); // Index for sorting by creation date
tournamentSchema.index({ status: 1 }); // Index for status filtering
tournamentSchema.index({ code: 1, 'auctionState.status': 1 });
tournamentSchema.index({ autoDeleteAt: 1 }); // Index for auto-delete cleanup queries

module.exports = mongoose.model('Tournament', tournamentSchema);
