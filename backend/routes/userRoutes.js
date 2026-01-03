const express = require('express');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, authorizeRoles } = require('./authRoutes');

const router = express.Router();

// Get all users (SuperAdmin only)
router.get('/', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const users = await User.find({})
      .populate('tournamentId', 'name code sport')
      .sort({ createdAt: -1 })
      .select('-password'); // Exclude password hash

    // Map users to include isActive field based on status
    const usersWithActiveStatus = users.map(user => ({
      ...user.toObject(),
      isActive: user.status === 'Active'
    }));

    res.json({
      success: true,
      users: usersWithActiveStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Toggle user status (SuperAdmin only)
router.put('/:id/toggle-status', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Cannot toggle status of Super Admin users' });
    }

    // Toggle status between Active and Disabled
    user.status = user.status === 'Active' ? 'Disabled' : 'Active';
    await user.save();

    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);
    const tournament = user.tournamentId ? await Tournament.findById(user.tournamentId) : null;
    
    // Log status change
    const auditLog = new AuditLog({
      action: user.status === 'Disabled' ? 'user_disabled' : 'user_enabled',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: { 
        previousStatus: user.status === 'Disabled' ? 'Active' : 'Disabled',
        newStatus: user.status
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    res.json({
      success: true,
      message: `User ${user.status === 'Active' ? 'activated' : 'deactivated'} successfully`,
      user: {
        ...user.toObject(),
        isActive: user.status === 'Active'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error toggling user status' });
  }
});

// Reset user password (SuperAdmin only) - matches frontend path /api/users/:id/reset-password
router.put('/:id/reset-password', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    user.plainPassword = newPassword;
    user.passwordResetAt = new Date();
    await user.save();

    const tournament = user.tournamentId ? await Tournament.findById(user.tournamentId) : null;
    
    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);

    // Log the password reset
    const auditLog = new AuditLog({
      action: 'password_reset',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: {
        performedBy: 'SuperAdmin',
        resetAt: new Date()
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
});

// Get all auction controllers (SuperAdmin or TournamentAdmin) with pagination
router.get('/controllers', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const tournamentId = req.query.tournamentId;

    let query = { role: 'AuctionController' };
    if (tournamentId) {
      query.tournamentId = tournamentId;
    } else if (req.user.role === 'TournamentAdmin') {
      // TournamentAdmin can only see controllers for their own tournament
      const Tournament = require('../models/Tournament');
      const tournament = await Tournament.findOne({ adminId: req.user.id });
      if (tournament) {
        query.tournamentId = tournament._id;
      } else {
        return res.json({ success: true, controllers: [], pagination: { currentPage: 1, totalPages: 0, totalControllers: 0, hasNext: false, hasPrev: false } });
      }
    }

    const total = await User.countDocuments(query);
    const controllers = await User.find(query)
      .populate('tournamentId', 'name code sport')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Include plainPassword in response
    const controllersWithPasswords = controllers.map(controller => ({
      ...controller.toObject(),
      plainPassword: controller.plainPassword
    }));

    res.json({
      success: true,
      controllers: controllersWithPasswords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalControllers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching controllers' });
  }
});

// Get all tournament managers (SuperAdmin or TournamentAdmin) with pagination
router.get('/managers', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const tournamentId = req.query.tournamentId;

    let query = { role: 'TournamentManager' };
    if (tournamentId) {
      query.tournamentId = tournamentId;
    } else if (req.user.role === 'TournamentAdmin') {
      // TournamentAdmin can only see managers for their own tournament
      const Tournament = require('../models/Tournament');
      const tournament = await Tournament.findOne({ adminId: req.user.id });
      if (tournament) {
        query.tournamentId = tournament._id;
      } else {
        return res.json({ success: true, managers: [], pagination: { currentPage: 1, totalPages: 0, totalManagers: 0, hasNext: false, hasPrev: false } });
      }
    }

    const total = await User.countDocuments(query);
    const managers = await User.find(query)
      .populate('tournamentId', 'name code sport')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Include plainPassword in response
    const managersWithPasswords = managers.map(manager => ({
      ...manager.toObject(),
      plainPassword: manager.plainPassword
    }));

    res.json({
      success: true,
      managers: managersWithPasswords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalManagers: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching managers' });
  }
});

// Get all tournament admins (SuperAdmin only) with pagination
router.get('/admins', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments({ role: 'TournamentAdmin' });
    const admins = await User.find({ role: 'TournamentAdmin' })
      .populate('tournamentId', 'name code sport')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Include plainPassword in response for SuperAdmin
    const adminsWithPasswords = admins.map(admin => ({
      ...admin.toObject(),
      password: admin.plainPassword // Return plain password
    }));

    res.json({
      success: true,
      admins: adminsWithPasswords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAdmins: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching admins' });
  }
});

// Reset admin password (SuperAdmin only)
router.put('/reset-password/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'TournamentAdmin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Generate a new random password
    const newPassword = Math.random().toString(36).slice(-8);
    user.password = newPassword;
    user.plainPassword = newPassword; // Store plain password
    await user.save();

    res.json({ success: true, message: 'Password reset successfully', newPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
});

// Create new tournament admin (SuperAdmin only)
router.post('/admins', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { name, email, mobile, tournamentId } = req.body;

    // Generate username based on tournament code
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const username = `admin.${tournament.code}`;

    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);

    const newAdmin = new User({
      username,
      email,
      password,
      plainPassword: password,
      role: 'TournamentAdmin',
      tournamentId,
      name,
      mobile,
      status: 'Active'
    });

    await newAdmin.save();
    res.json({ success: true, message: 'Admin created successfully', admin: { ...newAdmin.toObject(), password } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating admin' });
  }
});

// Create new tournament manager (SuperAdmin or TournamentAdmin only)
router.post('/managers', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin'), async (req, res) => {
  try {
    const { name, email, mobile, tournamentId } = req.body;

    // Generate username based on tournament code
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // For TournamentAdmin, verify they can only create managers for their own tournament
    if (req.user.role === 'TournamentAdmin') {
      const userTournament = await Tournament.findOne({ adminId: req.user.id });
      if (!userTournament || userTournament._id.toString() !== tournamentId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only create managers for your own tournament' });
      }
    }

    // Generate username with counter if needed
    let usernameBase = `manager.${tournament.code}`;
    let username = usernameBase;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${usernameBase}${counter}`;
      counter++;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);

    const newManager = new User({
      username,
      email,
      password,
      plainPassword: password,
      role: 'TournamentManager',
      tournamentId,
      name,
      mobile,
      status: 'Active'
    });

    await newManager.save();
    res.json({ success: true, message: 'Manager created successfully', manager: { ...newManager.toObject(), plainPassword: password } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating manager' });
  }
});

// Create new auction controller (SuperAdmin or TournamentAdmin only)
router.post('/controllers', authenticateToken, authorizeRoles('SuperAdmin', 'TournamentAdmin'), async (req, res) => {
  try {
    const { name, email, mobile, tournamentId } = req.body;

    // Generate username based on tournament code
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // For TournamentAdmin, verify they can only create controllers for their own tournament
    if (req.user.role === 'TournamentAdmin') {
      const userTournament = await Tournament.findOne({ adminId: req.user.id });
      if (!userTournament || userTournament._id.toString() !== tournamentId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only create controllers for your own tournament' });
      }
    }

    // Generate username with counter if needed
    let usernameBase = `controller.${tournament.code}`;
    let username = usernameBase;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${usernameBase}${counter}`;
      counter++;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);

    const newController = new User({
      username,
      email,
      password,
      plainPassword: password,
      role: 'AuctionController',
      tournamentId,
      name,
      mobile,
      status: 'Active'
    });

    await newController.save();
    res.json({ success: true, message: 'Controller created successfully', controller: { ...newController.toObject(), plainPassword: password } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error creating controller' });
  }
});

// Edit tournament admin (SuperAdmin only)
router.put('/admins/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { name, email, mobile, status, disableReason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'TournamentAdmin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    user.name = name;
    user.email = email;
    user.mobile = mobile;
    user.status = status;
    if (disableReason !== undefined) {
      user.disableReason = disableReason;
    }
    await user.save();

    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);
    const tournament = await Tournament.findOne({ adminId: user._id });
    
    // Log status change
    const auditLog = new AuditLog({
      action: status === 'Disabled' ? 'admin_disabled' : 'admin_enabled',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: { 
        previousStatus: user.status,
        newStatus: status,
        disableReason: disableReason || null
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    res.json({ success: true, message: 'Admin updated successfully', admin: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating admin' });
  }
});

// Export admins as CSV (SuperAdmin only)
router.get('/admins/export', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'TournamentAdmin' }).populate('tournamentId', 'name sport');
    let csv = 'ID,Name,Email,Username,Tournament,Sport,Status,Created On\n';

    admins.forEach(admin => {
      csv += `${admin._id},${admin.name || ''},${admin.email},${admin.username},${admin.tournamentId?.name || ''},${admin.tournamentId?.sport || ''},${admin.status},${new Date(admin.createdAt).toLocaleDateString()}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('tournament-admins.csv');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error exporting admins' });
  }
});

// Delete user (SuperAdmin only) - allows deletion of any user except SuperAdmin
router.delete('/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Admin users' });
    }

    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);
    const tournament = user.tournamentId ? await Tournament.findById(user.tournamentId) : null;

    // Log the deletion
    const auditLog = new AuditLog({
      action: 'user_deleted',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: {
        deletedUserRole: user.role,
        deletedUsername: user.username
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// Get admin credentials by tournament code (SuperAdmin only)
router.get('/admin-credentials/:tournamentCode', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { tournamentCode } = req.params;
    const tournament = await Tournament.findOne({ code: tournamentCode }).populate('adminId');
    
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: `Tournament with code "${tournamentCode}" not found` 
      });
    }
    
    if (!tournament.adminId) {
      return res.status(404).json({ 
        success: false, 
        message: `Tournament "${tournament.name}" (${tournamentCode}) does not have an admin assigned yet. Please assign an admin first.`,
        tournament: {
          name: tournament.name,
          code: tournament.code,
          logo: tournament.logo
        }
      });
    }

    const admin = tournament.adminId;
    
    // Get activity logs
    const activityLogs = await AuditLog.find({
      userId: admin._id,
      tournamentCode: tournamentCode
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('action timestamp metadata')
      .lean();

    // Get security logs (login attempts, IP addresses)
    const securityLogs = await AuditLog.find({
      userId: admin._id,
      action: { $in: ['login', 'login_failed', 'account_locked'] }
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('action timestamp ipAddress metadata type')
      .lean();

    // Default privileges (can be extended with a privileges model)
    const defaultPrivileges = [
      { name: 'Access Auction Dashboard', enabled: true },
      { name: 'Manage Teams', enabled: true },
      { name: 'Manage Players', enabled: true },
      { name: 'Add Guest Players', enabled: true },
      { name: 'View Reports', enabled: true },
      { name: 'Delete Tournament', enabled: false },
      { name: 'Change Global Settings', enabled: false }
    ];

    // Get delivery history (stored in metadata or separate collection)
    // For now, we'll create a mock delivery history from audit logs
    const deliveryLogs = await AuditLog.find({
      userId: admin._id,
      action: { $in: ['credentials_sent', 'password_reset'] }
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('action timestamp metadata')
      .lean();

    const deliveryHistory = deliveryLogs.map(log => ({
      method: log.metadata?.method || (log.action === 'password_reset' ? 'reset' : 'email'),
      recipient: log.metadata?.recipient || admin.email,
      timestamp: log.timestamp
    }));

    // Format security logs
    const formattedSecurityLogs = securityLogs.map(log => ({
      type: log.action === 'login' ? 'login' : log.action === 'account_locked' ? 'lockout' : 'failed_login',
      timestamp: log.timestamp,
      ipAddress: log.ipAddress || 'N/A'
    }));

    res.json({
      success: true,
      admin: {
        ...admin.toObject(),
        plainPassword: admin.plainPassword
      },
      tournament: {
        name: tournament.name,
        code: tournament.code,
        logo: tournament.logo
      },
      activityLogs: activityLogs.map(log => ({
        action: log.action || 'Unknown action',
        timestamp: log.timestamp
      })),
      deliveryHistory,
      securityLogs: formattedSecurityLogs,
      privileges: defaultPrivileges
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error fetching admin credentials' });
  }
});

// Send credentials (SuperAdmin only)
router.post('/send-credentials/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { method } = req.body; // email, whatsapp, pdf
    const user = await User.findById(req.params.id);
    
    if (!user || user.role !== 'TournamentAdmin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const tournament = await Tournament.findOne({ adminId: user._id });

    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);
    
    // Log the credential send action
    const auditLog = new AuditLog({
      action: 'credentials_sent',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: {
        method,
        recipient: method === 'email' ? user.email : method === 'whatsapp' ? user.mobile : 'PDF download',
        adminUsername: user.username
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    // In a real implementation, you would:
    // - Send email via nodemailer
    // - Send WhatsApp via Twilio/WhatsApp API
    // - Generate and return PDF

    res.json({
      success: true,
      message: `Credentials sent via ${method}`,
      method,
      recipient: method === 'email' ? user.email : method === 'whatsapp' ? user.mobile : 'PDF'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error sending credentials' });
  }
});

// Update admin privileges (SuperAdmin only)
router.put('/admin-privileges/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const { privileges } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user || user.role !== 'TournamentAdmin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);
    
    // Store privileges in user metadata or separate collection
    // For now, we'll just acknowledge the update
    // In a real implementation, you might have a Privileges model

    const auditLog = new AuditLog({
      action: 'privileges_updated',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: { privileges },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    res.json({ success: true, message: 'Privileges updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error updating privileges' });
  }
});

// Update reset password to log the action
router.put('/reset-password/:id', authenticateToken, authorizeRoles('SuperAdmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'TournamentAdmin') {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Generate a new random password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    user.password = newPassword;
    user.plainPassword = newPassword;
    user.passwordResetAt = new Date();
    await user.save();

    const tournament = await Tournament.findOne({ adminId: user._id });
    
    // Get SuperAdmin user for logging
    const superAdmin = await User.findById(req.user.id);

    // Log the password reset
    const auditLog = new AuditLog({
      action: 'password_reset',
      entityType: 'User',
      entityId: user._id,
      entityName: user.username,
      tournamentCode: tournament?.code,
      userId: req.user.id,
      username: superAdmin?.username || 'SuperAdmin',
      userRole: 'SuperAdmin',
      metadata: {
        performedBy: 'SuperAdmin',
        resetAt: new Date()
      },
      ipAddress: req.ip,
      timestamp: new Date()
    });
    await auditLog.save();

    res.json({ success: true, message: 'Password reset successfully', newPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
});

module.exports = router;
