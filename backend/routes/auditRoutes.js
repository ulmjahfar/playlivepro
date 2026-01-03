const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');
const { getMacAddress } = require('../utils/getMacAddress');
const { logAuditEvent } = require('../utils/auditLogger');

// Middleware to ensure SuperAdmin only
const ensureSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'SuperAdmin access required' });
  }
  next();
};

// Get all audit logs (SuperAdmin only)
router.get('/', authenticateToken, ensureSuperAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tournamentCode,
      action,
      entityType,
      userId,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (tournamentCode) query.tournamentCode = tournamentCode;
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

// Get audit logs for a specific tournament
router.get('/tournament/:tournamentCode', authenticateToken, ensureSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find({ tournamentCode: req.params.tournamentCode })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments({ tournamentCode: req.params.tournamentCode })
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching tournament audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

// Get audit logs for a specific user
router.get('/user/:userId', authenticateToken, ensureSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find({ userId: req.params.userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments({ userId: req.params.userId })
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs' });
  }
});

// Helper function to get client IP address
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         'Unknown';
}

// Record audit page access with MAC address
router.post('/record-access', authenticateToken, ensureSuperAdmin, async (req, res) => {
  try {
    const macAddress = getMacAddress();
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Log the audit page access
    await logAuditEvent({
      action: 'audit:page:access',
      entityType: 'Audit',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Audit Page Access',
      tournamentCode: null,
      user: req.user,
      changes: {
        macAddress,
        ipAddress,
        userAgent
      },
      metadata: {
        page: 'audit',
        accessType: 'page_view'
      },
      ipAddress,
      userAgent
    });
    
    // Also create a specific audit log entry with MAC address
    await AuditLog.create({
      action: 'audit:page:access',
      entityType: 'Audit',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Audit Page Access',
      tournamentCode: null,
      userId: req.user?._id || req.user?.id,
      username: req.user?.username || req.user?.name || 'System',
      userRole: req.user?.role || 'SuperAdmin',
      changes: {
        macAddress,
        ipAddress,
        userAgent
      },
      metadata: {
        page: 'audit',
        accessType: 'page_view'
      },
      ipAddress,
      userAgent,
      macAddress,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Audit page access recorded',
      macAddress,
      ipAddress
    });
  } catch (error) {
    console.error('Error recording audit page access:', error);
    res.status(500).json({ success: false, message: 'Error recording audit page access' });
  }
});

// Export audit logs to CSV
router.get('/export', authenticateToken, ensureSuperAdmin, async (req, res) => {
  try {
    const { tournamentCode, startDate, endDate } = req.query;
    const query = {};

    if (tournamentCode) query.tournamentCode = tournamentCode;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).lean();

    // Convert to CSV
    const csvHeader = 'Timestamp,Action,Entity Type,Entity Name,Tournament Code,User,Role,IP Address,MAC Address\n';
    const csvRows = logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const action = log.action || '';
      const entityType = log.entityType || '';
      const entityName = (log.entityName || '').replace(/,/g, ';');
      const tournamentCode = log.tournamentCode || '';
      const user = (log.username || '').replace(/,/g, ';');
      const role = log.userRole || '';
      const ip = log.ipAddress || '';
      const mac = log.macAddress || '';
      return `${timestamp},${action},${entityType},${entityName},${tournamentCode},${user},${role},${ip},${mac}`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ success: false, message: 'Error exporting audit logs' });
  }
});

module.exports = router;





