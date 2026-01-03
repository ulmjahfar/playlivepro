// server.js
// NOTE: Express 4.18.2 is used instead of Express 5.x due to path-to-regexp compatibility issues.
// Express 5.x uses stricter path parsing (via newer path-to-regexp) that caused startup errors
// with wildcard routes. Express 4.18.2 is stable, widely used, and compatible with all current
// route patterns in this codebase. See server.log for the original Express 5 error.
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');





// Import socket.io-client for frontend, but since this is backend, we don't need it here
// const ioClient = require('socket.io-client'); // Not needed in backend

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});


const tournamentRoutes = require('./routes/tournamentRoutes');
const playerRoutes = require('./routes/playerRoutes');
const teamRoutes = require('./routes/teamRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const { router: auctionRoutes, setIo: setAuctionIo } = require('./routes/auctionRoutes');
const playerCardRoutes = require('./routes/playerCardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const financeRoutes = require('./routes/financeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const featureRoutes = require('./routes/featureRoutes');
const autoDeleteRoutes = require('./routes/autoDeleteRoutes');
const { router: groupingRoutes, setIo: setGroupingIo } = require('./routes/groupingRoutes');
const { router: fixtureRoutes, setIo: setFixtureIo } = require('./routes/fixtureRoutes');
const seedTierSystem = require('./utils/seedTierSystem');
const { runAutoDeleteCleanup } = require('./jobs/autoDeleteCleanup');
const cron = require('node-cron');


app.use(express.json());

// Enhanced CORS configuration to prevent CORB errors
app.use(cors({
  origin: '*', // Allow all origins (can be restricted in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Length'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Middleware to ensure API responses have correct Content-Type to prevent CORB
app.use('/api', (req, res, next) => {
  // Set default Content-Type for JSON responses if not already set
  if (!res.get('Content-Type')) {
    res.set('Content-Type', 'application/json');
  }
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/player_cards', express.static(path.join(__dirname, 'player_cards')));
app.use('/confirmations', express.static(path.join(__dirname, 'uploads/confirmations')));
app.use('/uploads/players', express.static(path.join(__dirname, 'uploads/players')));
app.use('/uploads/teams', express.static(path.join(__dirname, 'uploads/teams')));
app.use('/uploads/team_logos', express.static(path.join(__dirname, 'uploads/team_logos')));
app.use('/uploads/guest_photos', express.static(path.join(__dirname, 'uploads/guest_photos')));
app.use('/uploads/tournament_logos', express.static(path.join(__dirname, 'uploads/tournament_logos')));
app.use('/uploads/app_logos', express.static(path.join(__dirname, 'uploads/app_logos')));
app.use('/uploads/tournament_player_card_backgrounds', express.static(path.join(__dirname, 'uploads/tournament_player_card_backgrounds')));

app.use('/api/auth', authRoutes.router);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/player-cards', playerCardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/auto-delete', autoDeleteRoutes);
app.use('/api/grouping', groupingRoutes);
app.use('/api/fixtures', fixtureRoutes);



// Serve React frontend build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Catch all handler: send back React's index.html file for client-side routing
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Middleware for Socket.io auth (allow public display connections)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  // Allow connections without token for public display mode
  if (!token) {
    socket.user = { role: 'Public', username: 'Anonymous' };
    return next();
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    if (verified.type === 'TeamSeat') {
      socket.user = {
        role: 'TeamSeat',
        seatId: verified.seatMongoId,
        teamId: verified.teamMongoId,
        tournamentCode: verified.tournamentCode
      };
    } else {
      socket.user = verified;
    }
    next();
  } catch (err) {
    // Allow connection but mark as unauthenticated
    socket.user = { role: 'Public', username: 'Anonymous' };
    next();
  }
});

io.on('connection', (socket) => {
  console.log('🟢 A user connected:', socket.id, socket.user?.username || 'Anonymous');

  // Track team connections for online indicator
  const trackTeamConnection = async (tournamentCode, teamId, isConnected) => {
    try {
      const Tournament = require('./models/Tournament');
      const tournament = await Tournament.findOne({ code: tournamentCode });
      if (!tournament) return;

      // Emit to tournament room
      io.to(`tournament:${tournamentCode}`).emit(isConnected ? 'team:connected' : 'team:disconnected', {
        tournamentCode,
        teamId,
        timestamp: new Date()
      });

      // If admin requests online teams list
      if (socket.user?.role === 'TournamentAdmin' || socket.user?.role === 'SuperAdmin') {
        // Get all connected teams in this tournament room
        const tournamentRoom = io.sockets.adapter.rooms.get(`tournament:${tournamentCode}`);
        const connectedTeamIds = [];
        if (tournamentRoom) {
          for (const socketId of tournamentRoom) {
            const socket = io.sockets.sockets.get(socketId);
            const teamId = socket?.teamId || socket?.user?.teamId || socket?.user?.teamMongoId;
            if ((socket?.user?.role === 'Team' || socket?.user?.role === 'TeamSeat') && teamId) {
              // Avoid duplicates
              if (!connectedTeamIds.includes(String(teamId))) {
                connectedTeamIds.push(String(teamId));
              }
            }
          }
        }
        socket.emit('online-teams', {
          tournamentCode,
          teamIds: connectedTeamIds
        });
      }
    } catch (error) {
      console.error('Error tracking team connection:', error);
    }
  };

  // Handle auction access lock - check if auction is locked and user is authorized
  socket.on('join-auction', async (data) => {
    try {
      const Tournament = require('./models/Tournament');
      const tournament = await Tournament.findOne({ code: data.tournamentCode });
      
      if (tournament && tournament.auctionState?.isLocked) {
        // Auction is locked - only allow TournamentAdmin, SuperAdmin, or registered teams
        const userRole = socket.user?.role;
        if (userRole !== 'TournamentAdmin' && userRole !== 'SuperAdmin' && userRole !== 'Team') {
          socket.emit('auction:locked', {
            tournamentCode: data.tournamentCode,
            message: 'Auction In Progress (Locked) - Only authorized teams can access'
          });
          return;
        }
      }
      
      // Join tournament room
      socket.join(`tournament:${data.tournamentCode}`);
      socket.emit('auction:joined', { tournamentCode: data.tournamentCode });

      // Track team connection if user is a team or team seat
      const teamId = socket.user?.teamId || socket.user?.teamMongoId;
      if ((socket.user?.role === 'Team' || socket.user?.role === 'TeamSeat') && teamId) {
        socket.teamId = teamId;
        await trackTeamConnection(data.tournamentCode, teamId, true);
      }
    } catch (error) {
      console.error('Error checking auction access:', error);
    }
  });

  // Handle get-online-teams request
  socket.on('get-online-teams', async (data) => {
    try {
      const tournamentRoom = io.sockets.adapter.rooms.get(`tournament:${data.tournamentCode}`);
      const connectedTeamIds = [];
      if (tournamentRoom) {
        for (const socketId of tournamentRoom) {
          const socket = io.sockets.sockets.get(socketId);
          const teamId = socket?.teamId || socket?.user?.teamId || socket?.user?.teamMongoId;
          if ((socket?.user?.role === 'Team' || socket?.user?.role === 'TeamSeat') && teamId) {
            // Avoid duplicates
            if (!connectedTeamIds.includes(String(teamId))) {
              connectedTeamIds.push(String(teamId));
            }
          }
        }
      }
      socket.emit('online-teams', {
        tournamentCode: data.tournamentCode,
        teamIds: connectedTeamIds
      });
    } catch (error) {
      console.error('Error getting online teams:', error);
    }
  });

  socket.on('start-auction', (data) => {
    if (socket.user?.role === 'TournamentAdmin' || socket.user?.role === 'SuperAdmin') {
      io.emit('auction-started', data);
    }
  });

  socket.on('new-bid', (bidData) => {
    if (socket.user?.role === 'Player' || socket.user?.role === 'Team') {
      io.emit('bid-update', bidData);
    }
  });

  socket.on('end-auction', (playerData) => {
    if (socket.user?.role === 'TournamentAdmin' || socket.user?.role === 'SuperAdmin') {
      io.emit('auction-ended', playerData);
    }
  });

  // Multi-screen display mode support
  socket.on('join-display', async (data) => {
    try {
      const Tournament = require('./models/Tournament');
      const tournament = await Tournament.findOne({ code: data.tournamentCode });
      
      if (tournament) {
        // Join tournament room for display sync
        socket.join(`tournament:${data.tournamentCode}`);
        socket.join(`display:${data.tournamentCode}`);
        
        // Track display device
        socket.displayMode = data.mode || 'spectator';
        socket.tournamentCode = data.tournamentCode;
        
        console.log(`📺 Display connected: ${socket.id} (${data.mode || 'spectator'}) for ${data.tournamentCode}`);
        
        socket.emit('display:joined', { tournamentCode: data.tournamentCode, mode: data.mode });
      }
    } catch (error) {
      console.error('Error joining display:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('🔴 User disconnected:', socket.id);
    if (socket.displayMode) {
      console.log(`📺 Display disconnected: ${socket.id} (${socket.displayMode})`);
    }

    // Track team disconnection
    const teamId = socket.teamId || socket.user?.teamId || socket.user?.teamMongoId;
    if ((socket.user?.role === 'Team' || socket.user?.role === 'TeamSeat') && teamId) {
      try {
        const Tournament = require('./models/Tournament');
        // Find tournament by checking all rooms this socket was in
        const rooms = Array.from(socket.rooms || []);
        for (const room of rooms) {
          if (room.startsWith('tournament:')) {
            const tournamentCode = room.replace('tournament:', '');
            const tournament = await Tournament.findOne({ code: tournamentCode });
            if (tournament) {
              io.to(room).emit('team:disconnected', {
                tournamentCode,
                teamId: teamId,
                timestamp: new Date()
              });
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error tracking team disconnection:', error);
      }
    }
  });
});



const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playlive')
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await seedTierSystem();
      console.log('🎯 Tier system seeded');
    } catch (error) {
      console.error('⚠️ Failed to seed tier system', error);
    }
    // Set io instance for auction routes
    setAuctionIo(io);
    // Set io instance for grouping routes
    setGroupingIo(io);
    // Set io instance for fixture routes
    setFixtureIo(io);

    // Schedule daily auto-delete cleanup job (runs at 2 AM every day)
    cron.schedule('0 2 * * *', async () => {
      console.log('🕐 Running scheduled auto-delete cleanup...');
      try {
        await runAutoDeleteCleanup();
      } catch (error) {
        console.error('❌ Error in scheduled auto-delete cleanup:', error);
      }
    });
    console.log('⏰ Auto-delete cleanup job scheduled (daily at 2 AM)');

    server.listen(PORT, '0.0.0.0', () => console.log(`🚀 PlayLive running on port ${PORT} (accessible from all interfaces)`));
  })
  .catch(err => console.error(err));
