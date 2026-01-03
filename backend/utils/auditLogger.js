const AuditLog = require('../models/AuditLog');

/**
 * Log an audit event
 * @param {Object} options
 * @param {String} options.action - Action performed (e.g., 'auction:start', 'player:sold')
 * @param {String} options.entityType - Type of entity (e.g., 'Tournament', 'Player', 'Team')
 * @param {String|ObjectId} options.entityId - ID of the entity
 * @param {String} options.entityName - Human-readable name
 * @param {String} options.tournamentCode - Tournament code
 * @param {Object} options.user - User object from req.user
 * @param {Object} options.changes - Before/after values or change details
 * @param {Object} options.metadata - Additional context
 * @param {String} options.ipAddress - IP address
 * @param {String} options.userAgent - User agent string
 */
async function logAuditEvent({
  action,
  entityType,
  entityId,
  entityName,
  tournamentCode,
  user,
  changes,
  metadata,
  ipAddress,
  userAgent
}) {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId,
      entityName,
      tournamentCode,
      userId: user?._id || user?.id,
      username: user?.username || user?.name || 'System',
      userRole: user?.role || 'System',
      changes,
      metadata,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Error logging audit event:', error);
  }
}

module.exports = { logAuditEvent };





