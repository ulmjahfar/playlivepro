const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'auction:start', 'player:sold', 'tournament:create'
  entityType: { type: String, required: true }, // e.g., 'Tournament', 'Player', 'Team', 'Auction'
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  entityName: { type: String }, // Human-readable name
  tournamentCode: { type: String }, // Tournament code for filtering
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  userRole: { type: String, enum: ['SuperAdmin', 'TournamentAdmin', 'Team', 'Player'] },
  changes: { type: mongoose.Schema.Types.Mixed }, // Before/after values or change details
  metadata: { type: mongoose.Schema.Types.Mixed }, // Additional context
  ipAddress: { type: String },
  userAgent: { type: String },
  macAddress: { type: String }, // MAC address of the system accessing the audit page
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ tournamentCode: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);





