const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const { authenticateToken } = require('./authRoutes');
const { generateAuctionReport } = require('../services/auctionReport');
const { logAuditEvent } = require('../utils/auditLogger');
const { authenticateSeat } = require('../middleware/teamSeatAuth');

const router = express.Router();

let io;

const setIo = (socketIo) => {
  io = socketIo;
};

const AUCTION_PRO_REMOTE_FEATURE = 'auction_pro_remote_bidding';
const AUCTION_PRO_MULTI_SEAT_FEATURE = 'auction_pro_multi_seat';

const broadcastEvent = (event, tournamentCode, payload = {}) => {
  if (!io) return;
  io.emit(event, { tournamentCode, ...payload });
};

const ensureTournamentAdmin = (req) => {
  if (!req.user || (req.user.role !== 'TournamentAdmin' && req.user.role !== 'SuperAdmin')) {
    const error = new Error('Access denied');
    error.status = 403;
    throw error;
  }
};

const findTournamentByCode = async (tournamentCode) => {
  const tournament = await Tournament.findOne({ code: tournamentCode });
  if (!tournament) {
    const error = new Error('Tournament not found');
    error.status = 404;
    throw error;
  }
  if (!tournament.auctionState) {
    tournament.auctionState = {};
  }
  return tournament;
};

const checkAuctionEnabled = (tournament) => {
  if (tournament.auctionEnabled === false) {
    const error = new Error('Auction features are currently disabled by the tournament admin. Enable auction from Settings to continue.');
    error.status = 403;
    error.code = 'AUCTION_DISABLED';
    throw error;
  }
};

const handleRouteError = (res, error, fallbackMessage = 'Internal server error') => {
  const status = error.status || 500;
  const payload = {
    success: false,
    message: error.message || fallbackMessage
  };
  if (error.code) {
    payload.code = error.code;
  }
  if (error.details) {
    payload.details = error.details;
  }
  
  // Log errors for debugging (especially 409 conflicts)
  if (status === 409) {
    console.log(`[409 Conflict] ${fallbackMessage}:`, {
      message: error.message,
      code: error.code,
      details: error.details
    });
  } else if (status >= 500) {
    console.error(`[${status} Error] ${fallbackMessage}:`, error);
  }
  
  res.status(status).json(payload);
};

const appendAuctionLog = (tournament, { message, type = 'info', meta }) => {
  if (!tournament.auctionState) {
    tournament.auctionState = {};
  }
  if (!Array.isArray(tournament.auctionState.logs)) {
    tournament.auctionState.logs = [];
  }
  tournament.auctionState.logs.push({
    message,
    type,
    meta,
    createdAt: new Date()
  });
  if (tournament.auctionState.logs.length > 200) {
    tournament.auctionState.logs = tournament.auctionState.logs.slice(-200);
  }
  tournament.auctionState.lastActionAt = new Date();
  tournament.markModified('auctionState');
};

const syncPendingPlayersList = async (tournament) => {
  const pendingPlayers = await Player.find({
    tournamentCode: tournament.code,
    auctionStatus: 'Pending'
  }).select('_id');

  tournament.auctionState.pendingPlayers = pendingPlayers.map((doc) => doc._id);
  tournament.markModified('auctionState.pendingPlayers');
};

const clearLastCallState = (tournament) => {
  if (!tournament || !tournament.auctionState) return;
  tournament.auctionState.lastCallActive = false;
  tournament.auctionState.lastCallTeam = null;
  tournament.auctionState.lastCallTeamName = null;
  tournament.auctionState.lastCallTimerSeconds = 0;
  tournament.auctionState.lastCallStartedAt = null;
  tournament.auctionState.lastCallResumeSeconds = 0;
};

const computeRequiredQuorumSeats = (policy = {}, activeVoterSeats = 0) => {
  const declared = parseInt(policy.votersRequired, 10);
  if (!Number.isNaN(declared) && declared > 0) {
    return declared;
  }
  if (policy.mode === 'unanimous') {
    return Math.max(1, activeVoterSeats);
  }
  if (policy.mode === 'majority') {
    const baseline = activeVoterSeats > 0 ? activeVoterSeats : 2;
    return Math.max(2, Math.ceil(baseline / 2));
  }
  return 1;
};

const evaluateTeamSeatQuorum = (team) => {
  const seats = Array.isArray(team.seats) ? team.seats : [];
  const activeVoters = seats.filter((seat) => seat.isVoter && seat.status === 'Active');
  const policy = getSeatPolicy(team);
  const required = computeRequiredQuorumSeats(policy, activeVoters.length);

  if (activeVoters.length === 0) {
    return {
      teamId: team._id,
      teamName: team.name,
      requiredVoters: required,
      activeVoters: 0,
      message: 'No active voter seats configured'
    };
  }

  if (activeVoters.length < required) {
    return {
      teamId: team._id,
      teamName: team.name,
      requiredVoters: required,
      activeVoters: activeVoters.length,
      message: `Needs at least ${required} active voter seat(s) but only ${activeVoters.length} ready`
    };
  }

  return null;
};

const ensureAuctionStartReadiness = async (tournament) => {
  const errors = [];
  const tournamentCode = tournament.code;

  if (tournament.playerRegistrationEnabled || tournament.teamRegistrationEnabled) {
    errors.push('Player/team registration is still open. Close both before starting the auction.');
  }

  const [playerCount, teams] = await Promise.all([
    Player.countDocuments({ tournamentCode }),
    Team.find({ tournamentCode }).select('_id name seatPolicy +seats')
  ]);
  const teamCount = teams.length;
  const readinessSnapshot = {
    playerCount,
    requiredPlayers: tournament.playerPoolSize || null,
    teamCount,
    requiredTeams: tournament.participatingTeams || null
  };

  if (tournament.playerPoolSize && playerCount < tournament.playerPoolSize) {
    errors.push(`Only ${playerCount} players registered out of ${tournament.playerPoolSize} required.`);
  }

  if (tournament.participatingTeams && teamCount < tournament.participatingTeams) {
    errors.push(`Only ${teamCount} teams registered out of ${tournament.participatingTeams} required.`);
  }

  let quorumIssues = [];
  if (tournament.plan === 'AuctionPro') {
    quorumIssues = teams.map(evaluateTeamSeatQuorum).filter(Boolean);
    if (quorumIssues.length > 0) {
      errors.push('Seat quorum incomplete for one or more teams.');
    }
  }

  if (errors.length > 0) {
    const error = new Error('Auction cannot start until readiness checks pass.');
    error.status = 409;
    error.code = 'AUCTION_NOT_READY';
    error.details = {
      errors,
      readiness: readinessSnapshot,
      quorumIssues
    };
    throw error;
  }

  return { readiness: readinessSnapshot };
};

const aggregateTeamSpend = async (tournamentCode) => {
  const results = await Player.aggregate([
    {
      $match: {
        tournamentCode,
        auctionStatus: 'Sold',
        soldTo: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$soldTo',
        totalSpent: { $sum: '$soldPrice' },
        playersBought: { $sum: 1 }
      }
    }
  ]);

  const spendMap = new Map();
  results.forEach((item) => {
    if (!item._id) return;
    spendMap.set(String(item._id), {
      totalSpent: item.totalSpent,
      playersBought: item.playersBought
    });
  });

  return spendMap;
};

const computeTeamSnapshots = async (tournament) => {
  const tournamentCode = tournament.code;
  // Select only necessary fields for performance
  const teamFields = '_id name logo tournamentCode budget currentBalance';
  const teams = await Team.find({ tournamentCode })
    .select(teamFields)
    .sort({ name: 1 })
    .lean();
  const spendMap = await aggregateTeamSpend(tournamentCode);

  const basePrice =
    tournament.basePrice ||
    tournament.auctionRules?.baseValueOfPlayer ||
    0;
  const maxPlayers = tournament.maxPlayers || 16;

  return teams.map((team) => {
    const key = String(team._id);
    const spendData = spendMap.get(key) || { totalSpent: 0, playersBought: 0 };
    const totalSpent = spendData.totalSpent || 0;
    const playersBought = spendData.playersBought || 0;

    const budget =
      typeof team.budget === 'number' && team.budget > 0
        ? team.budget
        : tournament.auctionRules?.maxFundForTeam || 0;
    const currentBalance = Math.max(0, budget - totalSpent);

    const remainingPlayers = Math.max(0, maxPlayers - playersBought);
    const maxBid =
      remainingPlayers > 0
        ? Math.max(0, currentBalance - ((remainingPlayers - 1) * basePrice))
        : 0;
    const isQuotaFull = remainingPlayers === 0;

    return {
      ...team,
      budget,
      totalSpent,
      budgetUsed: totalSpent,
      budgetBalance: currentBalance,
      playersBought,
      remainingPlayers,
      currentBalance,
      maxBid,
      maxPossibleBid: maxBid,
      isQuotaFull,
      maxPlayers
    };
  });
};

const persistTeamBalances = async (teamSnapshots = []) => {
  if (!Array.isArray(teamSnapshots) || teamSnapshots.length === 0) {
    return;
  }
  await Promise.all(
    teamSnapshots.map((team) =>
      Team.updateOne(
        { _id: team._id },
        {
          $set: {
            currentBalance: team.currentBalance
          }
        }
      )
    )
  );
};

const buildCompletionSummary = async (tournament, extra = {}) => {
  const tournamentCode = tournament.code;
  const [totalPlayers, soldCount, unsoldCount, withdrawnCount, totalTeams] = await Promise.all([
    Player.countDocuments({ tournamentCode }),
    Player.countDocuments({ tournamentCode, auctionStatus: 'Sold' }),
    Player.countDocuments({ tournamentCode, auctionStatus: 'Unsold' }),
    Player.countDocuments({ tournamentCode, auctionStatus: 'Withdrawn' }),
    Team.countDocuments({ tournamentCode })
  ]);

  return {
    tournamentName: tournament.name,
    tournamentCode,
    totalTeams,
    totalPlayers,
    playersSold: soldCount,
    unsoldPlayers: unsoldCount,
    withdrawnPlayers: withdrawnCount,
    pendingConvertedToUnsold: extra.pendingConvertedToUnsold || 0
  };
};

const recalculateTeamBalance = async (teamId, tournament) => {
  const tournamentCode = tournament.code;
  const objectId = typeof teamId === 'string' ? new mongoose.Types.ObjectId(teamId) : teamId;

  const [summary] = await Player.aggregate([
    {
      $match: {
        tournamentCode,
        auctionStatus: 'Sold',
        soldTo: objectId
      }
    },
    {
      $group: {
        _id: '$soldTo',
        totalSpent: { $sum: '$soldPrice' },
        playersBought: { $sum: 1 }
      }
    }
  ]);

  const team = await Team.findById(objectId);
  if (!team) {
    const error = new Error('Team not found');
    error.status = 404;
    throw error;
  }

  const totalSpent = summary?.totalSpent || 0;
  const maxFundForTeam = tournament.auctionRules?.maxFundForTeam || 0;
  const budget =
    typeof team.budget === 'number' && team.budget > 0
      ? team.budget
      : maxFundForTeam;

  // Update budget if it's 0 or missing
  if (team.budget === 0 || !team.budget) {
    team.budget = maxFundForTeam;
  }

  team.currentBalance = Math.max(0, budget - totalSpent);
  await team.save();

  return {
    currentBalance: team.currentBalance,
    totalSpent,
    playersBought: summary?.playersBought || 0
  };
};

const determineBidIncrement = (tournament, amount) => {
  const auctionRules = tournament.auctionRules || {};

  if (auctionRules.type === 'slab') {
    const ranges = Array.isArray(auctionRules.ranges) ? auctionRules.ranges : [];
    const normalized = ranges
      .filter((range) => typeof range === 'object' && range !== null)
      .map((range) => ({
        from: typeof range.from === 'number' ? range.from : 0,
        to: typeof range.to === 'number' ? range.to : Number.MAX_SAFE_INTEGER,
        increment: typeof range.increment === 'number' && range.increment > 0 ? range.increment : 0
      }))
      .sort((a, b) => a.from - b.from);

    const matchedRange = normalized.find(
      (range) => amount >= range.from && amount <= range.to
    );

    if (matchedRange && matchedRange.increment > 0) {
      return matchedRange.increment;
    }
  }

  return auctionRules.fixedIncrement && auctionRules.fixedIncrement > 0
    ? auctionRules.fixedIncrement
    : 100;
};
const executeTeamBid = async ({ tournament, teamId, actorContext = {}, bypassQuota = false }) => {
  if (!teamId) {
    const error = new Error('Team ID is required');
    error.status = 400;
    throw error;
  }

  const currentPlayerId = tournament.auctionState?.currentPlayer;
  if (!currentPlayerId) {
    const error = new Error('No player currently in auction');
    error.status = 400;
    throw error;
  }

  const player = await Player.findById(currentPlayerId);
  if (!player || player.auctionStatus !== 'InAuction') {
    const error = new Error('Player not available for bidding');
    error.status = 400;
    throw error;
  }

  const team = await Team.findById(teamId).select('+seats +auctionAccessCode');
  if (!team || team.tournamentCode !== tournament.code) {
    const error = new Error('Invalid team for this tournament');
    error.status = 400;
    throw error;
  }

  if (player.bidHistory && player.bidHistory.length > 0) {
    const lastBid = player.bidHistory[player.bidHistory.length - 1];
    if (lastBid && lastBid.bidder && String(lastBid.bidder) === String(teamId)) {
      const error = new Error('⚠️ You cannot bid twice in a row on the same player. Wait for another team to bid first.');
      error.status = 400;
      error.code = 'CONSECUTIVE_BID_BLOCKED';
      throw error;
    }
  }

  const teamSnapshots = await computeTeamSnapshots(tournament);
  const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(teamId));
  if (!teamSnapshot) {
    const error = new Error('Team financial snapshot not found');
    error.status = 400;
    throw error;
  }

  const basePrice = player.basePrice || tournament.basePrice || 0;
  const currentBid = player.currentBid || 0;

  let nextBid;
  if (currentBid === 0) {
    nextBid = basePrice;
  } else {
    const increment = determineBidIncrement(tournament, currentBid);
    nextBid = currentBid + increment;
  }

  // When bypassing quota, allow bidding up to full current balance
  // Otherwise, use the calculated maxBid which considers remaining players
  const maxAllowedBid = bypassQuota ? teamSnapshot.currentBalance : teamSnapshot.maxBid;
  
  if (nextBid > maxAllowedBid) {
    if (bypassQuota) {
      const error = new Error(`Cannot bid above maximum allowed ₹${maxAllowedBid.toLocaleString()} — insufficient balance.`);
      error.status = 400;
      throw error;
    } else {
      const error = new Error(`Cannot bid above maximum allowed ₹${teamSnapshot.maxBid.toLocaleString()} — insufficient balance for remaining players.`);
      error.status = 400;
      throw error;
    }
  }

  player.currentBid = nextBid;
  player.currentBidTeam = team._id;
  player.currentBidTeamName = team.name;
  player.lastAuctionEventAt = new Date();
  player.bidHistory.push({
    bidder: team._id,
    teamName: team.name,
    bidAmount: nextBid,
    bidTime: new Date(),
    actor: actorContext.actor || 'admin',
    actorSeatId: actorContext.seatId
  });
  await player.save();

  tournament.auctionState.currentBid = nextBid;
  tournament.auctionState.highestBidder = team._id;
  tournament.auctionState.highestBidderName = team.name;
  tournament.auctionState.lastBidTeamId = team._id;
  tournament.auctionState.stage = 'Bidding';
  const resumeSeconds = tournament.auctionState.lastCallResumeSeconds || 0;
  clearLastCallState(tournament);
  if (resumeSeconds > 0) {
    tournament.auctionState.timerSeconds = resumeSeconds;
  }
  tournament.auctionState.lastActionAt = new Date();
  appendAuctionLog(tournament, {
    message: `${team.name} bid ₹${nextBid.toLocaleString()} for ${player.name}${bypassQuota ? ' (quota bypassed)' : ''}`,
    type: 'bid',
    meta: {
      teamId: team._id,
      playerId: player._id,
      amount: nextBid,
      actor: actorContext.actor,
      seatId: actorContext.seatId,
      bypassQuota: bypassQuota || false
    }
  });

  clearSeatConsensusForTeam(tournament, team._id);

  await tournament.save();

  const payload = {
    playerId: player._id,
    bidAmount: nextBid,
    teamId: team._id,
    teamName: team.name,
    bidHistory: player.bidHistory.slice(-20),
    currentBid: nextBid,
    lastBidTeamId: team._id,
    timerSeconds: tournament.auctionState.timerSeconds || 30
  };
  broadcastEvent('bid:update', tournament.code, payload);

  if (io) {
    io.to(`display:${tournament.code}`).emit('sync:display', {
      type: 'update',
      tournamentCode: tournament.code,
      currentPlayer: player.toObject(),
      currentBid: nextBid,
      leadingTeam: team.name,
      timer: tournament.auctionState.timerSeconds || 30
    });

    io.to(`display:${tournament.code}`).emit('sound:play', {
      tournamentCode: tournament.code,
      sound: 'bid'
    });
  }

  return {
    team,
    player,
    bidAmount: nextBid,
    payload
  };
};

const getSeatPolicy = (team) => {
  const base = {
    mode: 'single',
    votersRequired: 1,
    allowDynamicQuorum: true,
    allowLeadOverride: true,
    autoResetOnBid: true
  };

  if (!team?.seatPolicy) {
    return base;
  }

  if (typeof team.seatPolicy.toObject === 'function') {
    return { ...base, ...team.seatPolicy.toObject() };
  }

  return { ...base, ...team.seatPolicy };
};

const buildSeatConsensusKey = (teamId, playerId) => `${teamId}:${playerId}`;

const getSeatConsensusStore = (tournament) => {
  if (!tournament.auctionState) {
    tournament.auctionState = {};
  }
  if (!tournament.auctionState.seatConsensus) {
    tournament.auctionState.seatConsensus = {};
  }
  return tournament.auctionState.seatConsensus;
};

const clearSeatConsensusForTeam = (tournament, teamId) => {
  const store = getSeatConsensusStore(tournament);
  Object.keys(store).forEach((key) => {
    if (key.startsWith(`${teamId}:`)) {
      delete store[key];
    }
  });
  tournament.markModified('auctionState.seatConsensus');
};

const evaluateSeatConsensus = ({ policy, votes, eligibleCount }) => {
  const callVotes = votes.filter((vote) => vote.action === 'call' || vote.action === 'override_call').length;
  const passVotes = votes.filter((vote) => vote.action === 'pass').length;

  const computeRequired = () => {
    const declared = parseInt(policy.votersRequired, 10);
    if (policy.mode === 'unanimous') {
      return eligibleCount;
    }
    if (!Number.isNaN(declared) && declared > 0) {
      return Math.min(eligibleCount, declared);
    }
    if (policy.mode === 'majority') {
      return Math.max(1, Math.ceil(eligibleCount / 2));
    }
    return 1;
  };

  switch (policy.mode) {
    case 'single':
      return { resolved: false, callVotes, passVotes, required: 1 };
    case 'any':
      return {
        resolved: callVotes >= 1,
        callVotes,
        passVotes,
        required: 1
      };
    case 'majority': {
      const required = computeRequired();
      return {
        resolved: callVotes >= required,
        callVotes,
        passVotes,
        required
      };
    }
    case 'unanimous': {
      const required = computeRequired();
      return {
        resolved: callVotes >= required,
        callVotes,
        passVotes,
        required
      };
    }
    default:
      return { resolved: callVotes >= 1, callVotes, passVotes, required: 1 };
  }
};

const buildAuctionStatusPayload = async (tournament) => {
  const tournamentCode = tournament.code;

  // Define fields to select for performance - exclude large fields if not needed immediately
  const playerFields = '_id playerId name role basePrice currentBid currentBidTeam currentBidTeamName soldPrice soldTo soldToName soldAt pendingAt withdrawnAt unsoldAt withdrawalReason auctionStatus bidHistory photo';

  const [currentPlayer, pendingPlayers, soldPlayers, withdrawnPlayers, unsoldPlayers, teams] = await Promise.all([
    tournament.auctionState?.currentPlayer
      ? Player.findById(tournament.auctionState.currentPlayer)
          .select(playerFields)
          .lean()
      : null,
    Player.find({ tournamentCode, auctionStatus: 'Pending' })
      .select(playerFields)
      .sort({ pendingAt: 1, name: 1 })
      .limit(100) // Limit to 100 most recent pending players
      .lean(),
    Player.find({ tournamentCode, auctionStatus: 'Sold' })
      .select(playerFields)
      .sort({ soldAt: -1 })
      .limit(50) // Increased from 20 to 50 for better visibility
      .lean(),
    Player.find({ tournamentCode, auctionStatus: 'Withdrawn' })
      .select(playerFields)
      .sort({ withdrawnAt: -1 })
      .limit(100) // Limit to 100 most recent withdrawn players
      .lean(),
    Player.find({ tournamentCode, auctionStatus: 'Unsold' })
      .select(playerFields)
      .sort({ unsoldAt: -1 })
      .limit(100) // Limit to 100 most recent unsold players
      .lean(),
    computeTeamSnapshots(tournament)
  ]);

  // Limit bidHistory for current player to reduce payload size
  if (currentPlayer && currentPlayer.bidHistory) {
    currentPlayer.bidHistory = currentPlayer.bidHistory.slice(-50).reverse();
  }

  const logs = Array.isArray(tournament.auctionState?.logs)
    ? [...tournament.auctionState.logs].slice(-100).reverse()
    : [];

  return {
    success: true,
    tournament: {
      code: tournament.code,
      name: tournament.name,
      status: tournament.status,
      auctionStatus: tournament.auctionStatus || tournament.auctionState?.status || 'NotStarted',
      auctionEndedAt: tournament.auctionEndedAt || null,
      reportPdf: tournament.auctionState?.reportPdf || null
    },
    status: tournament.auctionState?.status || 'NotStarted',
    completedAt: tournament.auctionState?.completedAt || tournament.auctionEndedAt || null,
    completedSummary: tournament.auctionState?.completedSummary || null,
    stage: tournament.auctionState?.stage || 'Idle',
    timer: tournament.auctionState?.timerSeconds || 0,
    lastCallActive: Boolean(tournament.auctionState?.lastCallActive),
    lastCallTeamId: tournament.auctionState?.lastCallTeam || null,
    lastCallTeamName: tournament.auctionState?.lastCallTeamName || null,
    lastCallTimerSeconds: tournament.auctionState?.lastCallTimerSeconds || 0,
    currentBid: tournament.auctionState?.currentBid || 0,
    highestBidder: tournament.auctionState?.highestBidder || null,
    highestBidderName: tournament.auctionState?.highestBidderName || null,
    lastBidTeamId: tournament.auctionState?.lastBidTeamId || null,
    currentRound: tournament.auctionState?.currentRound || 1,
    currentPlayer,
    bidHistory: currentPlayer?.bidHistory || [],
    pendingPlayers,
    soldPlayers,
    withdrawnPlayers,
    unsoldPlayers,
    teams,
    logs
  };
};

// Compatibility routes (retain existing consumers)
router.get('/available/:tournamentCode', authenticateToken, async (req, res) => {
  try {
    const players = await Player.find({
      tournamentCode: req.params.tournamentCode,
      auctionStatus: 'Available'
    }).lean();
    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching players');
  }
});

router.get('/teams/:tournamentCode', authenticateToken, async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const teams = await computeTeamSnapshots(tournament);
    res.json({ success: true, teams });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching teams');
  }
});

// Controller-focused routes
router.get('/:tournamentCode/status', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const payload = await buildAuctionStatusPayload(tournament);
    res.json(payload);
  } catch (error) {
    handleRouteError(res, error, 'Error fetching auction status');
  }
});

router.get('/:tournamentCode/seat-view', authenticateSeat, async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    if (req.seatAuth.payload.tournamentCode !== tournament.code) {
      return res.status(403).json({ success: false, message: 'Seat not linked to this tournament' });
    }

    const teamSnapshots = await computeTeamSnapshots(tournament);
    const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(req.seatAuth.team._id));

    const currentPlayer = tournament.auctionState?.currentPlayer
      ? await Player.findById(tournament.auctionState.currentPlayer)
          .select('_id name role basePrice currentBid currentBidTeamName bidHistory photo')
          .lean()
      : null;

    const consensusStore = getSeatConsensusStore(tournament);
    const key = currentPlayer ? buildSeatConsensusKey(req.seatAuth.team._id, currentPlayer._id) : null;
    const consensusEntry = key ? consensusStore[key] : null;

    // Determine the actual auction status - check multiple sources
    const auctionStatus = tournament.auctionState?.status || 
                         tournament.auctionStatus || 
                         (tournament.auctionState?.currentPlayer ? 'Running' : 'NotStarted');
    
    res.json({
      success: true,
      tournament: {
        code: tournament.code,
        name: tournament.name,
        status: auctionStatus,
        stage: tournament.auctionState?.stage || 'Idle',
        timer: tournament.auctionState?.timerSeconds || 0,
        currentBid: tournament.auctionState?.currentBid || 0,
        highestBidderName: tournament.auctionState?.highestBidderName || null
      },
      currentPlayer,
      team: teamSnapshot,
      seat: {
        id: req.seatAuth.seat._id,
        label: req.seatAuth.seat.label,
        role: req.seatAuth.seat.role,
        isLead: req.seatAuth.seat.isLead,
        isVoter: req.seatAuth.seat.isVoter
      },
      consensus: consensusEntry || null
    });
  } catch (error) {
    console.error('Seat view error:', error);
    handleRouteError(res, error, 'Unable to fetch seat view');
  }
});

router.post('/:tournamentCode/start', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const bypassReadiness = req.body.bypassReadiness === true;
    let readiness = null;
    let readinessWarnings = null;
    
    try {
      const result = await ensureAuctionStartReadiness(tournament);
      readiness = result.readiness;
    } catch (readinessError) {
      if (!bypassReadiness) {
        throw readinessError;
      }
      // If bypassing, capture the warnings but don't throw
      readinessWarnings = readinessError.details || {
        errors: [readinessError.message],
        readiness: {},
        quorumIssues: []
      };
    }

    // Set auction as locked (only authorized teams can connect)
    tournament.auctionState.isLocked = true;
    tournament.auctionState.status = 'Running';
    tournament.auctionStatus = 'Running'; // Also set the top-level status field
    tournament.auctionState.stage = 'Initialize';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset when auction starts
    tournament.auctionState.lastStartedAt = new Date();
    tournament.auctionState.lastActionAt = new Date();
    
    if (readinessWarnings) {
      appendAuctionLog(tournament, {
        message: '⚠️ Auction started with incomplete registrations/quorum',
        type: 'warning',
        meta: readinessWarnings
      });
      // Log each warning as a separate entry for visibility
      if (readinessWarnings.errors && Array.isArray(readinessWarnings.errors)) {
        readinessWarnings.errors.forEach((errorMsg) => {
          appendAuctionLog(tournament, {
            message: `⚠️ ${errorMsg}`,
            type: 'warning'
          });
        });
      }
    } else {
      appendAuctionLog(tournament, {
        message: 'Auction readiness checks passed',
        type: 'status',
        meta: readiness
      });
    }
    
    appendAuctionLog(tournament, {
      message: 'Auction started - Access locked to authorized teams only',
      type: 'status'
    });

    await syncPendingPlayersList(tournament);
    
    // Initialize all team budgets from tournament maxFundForTeam
    const maxFundForTeam = tournament.auctionRules?.maxFundForTeam || 0;
    if (maxFundForTeam > 0) {
      await Team.updateMany(
        { tournamentCode: tournament.code },
        { 
          $set: { 
            budget: maxFundForTeam,
            currentBalance: maxFundForTeam
          } 
        }
      );
    }
    
    await tournament.save();

    // Log audit event
    await logAuditEvent({
      action: 'auction:start',
      entityType: 'Auction',
      entityId: tournament._id,
      entityName: tournament.name,
      tournamentCode: tournament.code,
      user: req.user,
      changes: { status: 'Running', isLocked: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    broadcastEvent('auction:start', tournament.code, {
      status: 'Running'
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error starting auction');
  }
});

router.post('/:tournamentCode/pause', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);

    tournament.auctionState.status = 'Paused';
    tournament.auctionState.stage = 'Idle';
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: 'Auction paused',
      type: 'status'
    });
    await tournament.save();

    broadcastEvent('auction:pause', tournament.code, {});
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error pausing auction');
  }
});

router.post('/:tournamentCode/resume', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    tournament.auctionState.status = 'Running';
    tournament.auctionState.stage = 'Bidding';
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: 'Auction resumed',
      type: 'status'
    });
    await tournament.save();

    broadcastEvent('auction:resume', tournament.code, {});
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error resuming auction');
  }
});

router.post('/:tournamentCode/next', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    // Check if there's a current player that needs to be finalized first
    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (currentPlayerId) {
      const currentPlayer = await Player.findById(currentPlayerId);
      if (currentPlayer && currentPlayer.auctionStatus === 'InAuction') {
        const error = new Error('Please finalize the current player (mark as Sold or Unsold) before loading the next player');
        error.status = 400;
        error.code = 'CURRENT_PLAYER_ACTIVE';
        throw error;
      }
    }

    // Check for orphaned players stuck in 'InAuction' status (not the current player)
    // These might be from a previous session that wasn't properly cleaned up
    const orphanedInAuction = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'InAuction',
      _id: { $ne: currentPlayerId }
    }).countDocuments();

    if (orphanedInAuction > 0) {
      // Auto-fix: Reset orphaned InAuction players back to Available
      await Player.updateMany(
        {
          tournamentCode: tournament.code,
          auctionStatus: 'InAuction',
          _id: { $ne: currentPlayerId }
        },
        { 
          $set: { 
            auctionStatus: 'Available',
            currentBid: 0,
            currentBidTeam: null,
            currentBidTeamName: null,
            bidHistory: []
          } 
        }
      );
    }

    // First, try to find players with 'Available' status
    let availablePlayers = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Available'
    }).lean();

    // If no Available players found, check for players with null/undefined status
    // These should be treated as Available (default status)
    if (availablePlayers.length === 0) {
      const playersWithNullStatus = await Player.find({
        tournamentCode: tournament.code,
        $or: [
          { auctionStatus: { $exists: false } },
          { auctionStatus: null },
          { auctionStatus: '' }
        ]
      }).lean();

      if (playersWithNullStatus.length > 0) {
        // Auto-fix: Set null/undefined statuses to 'Available'
        await Player.updateMany(
          {
            tournamentCode: tournament.code,
            $or: [
              { auctionStatus: { $exists: false } },
              { auctionStatus: null },
              { auctionStatus: '' }
            ]
          },
          { $set: { auctionStatus: 'Available' } }
        );
        // Re-fetch after fixing
        availablePlayers = await Player.find({
          tournamentCode: tournament.code,
          auctionStatus: 'Available'
        }).lean();
      }
    }

    if (availablePlayers.length === 0) {
      // Get counts of players in different states for better error message
      const playerCounts = await Player.aggregate([
        { $match: { tournamentCode: tournament.code } },
        { $group: { _id: { $ifNull: ['$auctionStatus', 'NULL'] }, count: { $sum: 1 } } }
      ]);
      
      const countsByStatus = {};
      let totalCount = 0;
      playerCounts.forEach(item => {
        const status = item._id || 'NULL';
        countsByStatus[status] = item.count;
        totalCount += item.count;
      });

      // Also get total count to verify
      const actualTotal = await Player.countDocuments({ tournamentCode: tournament.code });

      const error = new Error(
        `No available players found. ` +
        `Status breakdown: Available: ${countsByStatus.Available || 0}, ` +
        `Sold: ${countsByStatus.Sold || 0}, ` +
        `Unsold: ${countsByStatus.Unsold || 0}, ` +
        `Pending: ${countsByStatus.Pending || 0}, ` +
        `InAuction: ${countsByStatus.InAuction || 0}, ` +
        `Withdrawn: ${countsByStatus.Withdrawn || 0}, ` +
        `NULL/Undefined: ${countsByStatus.NULL || 0}. ` +
        `Total players: ${actualTotal}. ` +
        `Please mark unsold or pending players as available to continue.`
      );
      error.status = 400;
      error.code = 'NO_AVAILABLE_PLAYERS';
      error.details = { ...countsByStatus, total: actualTotal };
      throw error;
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selected = await Player.findById(availablePlayers[randomIndex]._id);

    selected.auctionStatus = 'InAuction';
    selected.currentBid = 0;
    selected.currentBidTeam = null;
    selected.currentBidTeamName = null;
    selected.bidHistory = [];
    selected.auctionedAt = new Date();
    selected.lastAuctionEventAt = new Date();
    await selected.save();

    tournament.auctionState.status = 'Running';
    tournament.auctionState.stage = 'Bidding';
    tournament.auctionState.currentPlayer = selected._id;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset for new player
    tournament.auctionState.timerSeconds = tournament.auctionState.timerSeconds || 0;
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `Player ${selected.name} entered the auction floor`,
      type: 'status',
      meta: { playerId: selected._id }
    });

    await tournament.save();

    const playerPayload = selected.toObject();
    broadcastEvent('player:next', tournament.code, { 
      player: playerPayload,
      timerSeconds: tournament.auctionState.timerSeconds || 30
    });
    
    // Multi-screen sync
    if (io) {
      io.to(`display:${tournament.code}`).emit('sync:display', {
        type: 'update',
        tournamentCode: tournament.code,
        currentPlayer: playerPayload,
        currentBid: 0,
        leadingTeam: null,
        timer: tournament.auctionState.timerSeconds || 30
      });
    }
    
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error picking next player');
  }
});

router.post('/:tournamentCode/call-player', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    const { playerId } = req.body;
    if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
      const error = new Error('Player ID is required');
      error.status = 400;
      throw error;
    }

    // Check if there's a current player that needs to be finalized first
    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (currentPlayerId) {
      const currentPlayer = await Player.findById(currentPlayerId);
      if (currentPlayer && currentPlayer.auctionStatus === 'InAuction') {
        const error = new Error('Please finalize the current player (mark as Sold or Unsold) before calling another player');
        error.status = 400;
        error.code = 'CURRENT_PLAYER_ACTIVE';
        throw error;
      }
    }

    // Try to find player by custom playerId first, then by MongoDB _id
    const searchId = playerId.trim();
    let player = await Player.findOne({
      tournamentCode: tournament.code,
      playerId: searchId
    });

    // If not found, try with tournament code prefix (e.g., PLTC003-001)
    if (!player) {
      const fullPlayerId = `${tournament.code}-${searchId}`;
      player = await Player.findOne({
        tournamentCode: tournament.code,
        playerId: fullPlayerId
      });
    }

    // If still not found, try MongoDB ObjectId
    if (!player && mongoose.Types.ObjectId.isValid(searchId)) {
      player = await Player.findOne({
        tournamentCode: tournament.code,
        _id: searchId
      });
    }

    if (!player) {
      const error = new Error(`Player not found with the provided ID: ${playerId}`);
      error.status = 404;
      error.code = 'PLAYER_NOT_FOUND';
      throw error;
    }

    // Validate player status - allow calling from Available, Unsold, or Pending
    const allowedStatuses = ['Available', 'Unsold', 'Pending'];
    if (!allowedStatuses.includes(player.auctionStatus)) {
      const error = new Error(`Player is not available for auction. Current status: ${player.auctionStatus}`);
      error.status = 400;
      error.code = 'PLAYER_NOT_AVAILABLE';
      error.details = { status: player.auctionStatus };
      throw error;
    }

    // Set player to InAuction
    player.auctionStatus = 'InAuction';
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.auctionedAt = new Date();
    player.lastAuctionEventAt = new Date();
    await player.save();

    tournament.auctionState.status = 'Running';
    tournament.auctionState.stage = 'Bidding';
    tournament.auctionState.currentPlayer = player._id;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset for new player
    tournament.auctionState.timerSeconds = tournament.auctionState.timerSeconds || 0;
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `Player ${player.name} (${player.playerId}) manually called to the auction floor`,
      type: 'status',
      meta: { playerId: player._id, customPlayerId: player.playerId }
    });

    await tournament.save();

    const playerPayload = player.toObject();
    broadcastEvent('player:next', tournament.code, { 
      player: playerPayload,
      timerSeconds: tournament.auctionState.timerSeconds || 30
    });
    
    // Multi-screen sync
    if (io) {
      io.to(`display:${tournament.code}`).emit('sync:display', {
        type: 'update',
        tournamentCode: tournament.code,
        currentPlayer: playerPayload,
        currentBid: 0,
        leadingTeam: null,
        timer: tournament.auctionState.timerSeconds || 30
      });
    }
    
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error calling player');
  }
});

router.post('/:tournamentCode/shuffle-players', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    // Get all available players
    const availablePlayers = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Available'
    });

    if (availablePlayers.length === 0) {
      return res.status(400).json({ success: false, message: 'No available players to shuffle' });
    }

    // Shuffle the array using Fisher-Yates algorithm
    for (let i = availablePlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePlayers[i], availablePlayers[j]] = [availablePlayers[j], availablePlayers[i]];
    }

    // Note: This is a logical shuffle - the actual order in database doesn't matter
    // since we always pick randomly. This is mainly for UI/display purposes.
    // If you want to persist order, you'd need an 'order' field on Player model.

    appendAuctionLog(tournament, {
      message: `Player order shuffled (${availablePlayers.length} available players)`,
      type: 'system',
      meta: { playerCount: availablePlayers.length }
    });

    await tournament.save();

    res.json({ 
      success: true, 
      message: `Shuffled ${availablePlayers.length} available players`,
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error shuffling players');
  }
});

router.post('/:tournamentCode/random-skip', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (!currentPlayerId) {
      const error = new Error('No player currently in auction');
      error.status = 400;
      throw error;
    }

    const currentPlayer = await Player.findById(currentPlayerId);
    if (!currentPlayer) {
      const error = new Error('Current player not found');
      error.status = 404;
      throw error;
    }

    // Move current player back to Available
    currentPlayer.auctionStatus = 'Available';
    currentPlayer.currentBid = 0;
    currentPlayer.currentBidTeam = null;
    currentPlayer.currentBidTeamName = null;
    currentPlayer.bidHistory = [];
    await currentPlayer.save();

    // Pick next random player
    const availablePlayers = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Available'
    }).lean();

    if (availablePlayers.length === 0) {
      tournament.auctionState.currentPlayer = null;
      tournament.auctionState.currentBid = 0;
      tournament.auctionState.highestBidder = null;
      tournament.auctionState.highestBidderName = null;
      tournament.auctionState.lastBidTeamId = null;
      await tournament.save();
      return res.json({ 
        success: true, 
        message: 'Player skipped, but no more available players',
        ...(await buildAuctionStatusPayload(tournament))
      });
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selected = await Player.findById(availablePlayers[randomIndex]._id);

    selected.auctionStatus = 'InAuction';
    selected.currentBid = 0;
    selected.currentBidTeam = null;
    selected.currentBidTeamName = null;
    selected.bidHistory = [];
    selected.auctionedAt = new Date();
    selected.lastAuctionEventAt = new Date();
    await selected.save();

    tournament.auctionState.status = 'Running';
    tournament.auctionState.stage = 'Bidding';
    tournament.auctionState.currentPlayer = selected._id;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null;
    tournament.auctionState.timerSeconds = tournament.auctionState.timerSeconds || 0;
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `${currentPlayer.name} skipped, ${selected.name} entered the auction floor`,
      type: 'status',
      meta: { skippedPlayerId: currentPlayer._id, newPlayerId: selected._id }
    });

    await tournament.save();

    const playerPayload = selected.toObject();
    broadcastEvent('player:next', tournament.code, { 
      player: playerPayload,
      timerSeconds: tournament.auctionState.timerSeconds || 30
    });
    
    if (io)
      io.to(`display:${tournament.code}`).emit('sync:display', {
        type: 'update',
        tournamentCode: tournament.code,
        currentPlayer: playerPayload,
        currentBid: 0,
        leadingTeam: null,
        timer: tournament.auctionState.timerSeconds || 30
      });
    
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error skipping player');
  }
});

router.post('/:tournamentCode/stop', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const currentPlayerId = tournament.auctionState?.currentPlayer;

    if (currentPlayerId) {
      const player = await Player.findById(currentPlayerId);
      if (player) {
        player.auctionStatus = 'Available';
        player.currentBid = 0;
        player.currentBidTeam = null;
        player.currentBidTeamName = null;
        player.bidHistory = [];
        player.lastAuctionEventAt = new Date();
        await player.save();
      }
    }

    tournament.auctionState.stage = 'Idle';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset when stopping
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: 'Current player auction stopped by controller',
      type: 'status'
    });

    await tournament.save();
    broadcastEvent('auction:stop', tournament.code, {});
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error stopping current auction');
  }
});

router.post('/:tournamentCode/last-call/start', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (!currentPlayerId) {
      const error = new Error('No active player to move into last call');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player || player.auctionStatus !== 'InAuction') {
      const error = new Error('Player not currently in auction');
      error.status = 400;
      throw error;
    }

    const highestBidder = tournament.auctionState?.highestBidder;
    if (!highestBidder || (tournament.auctionState?.currentBid || 0) <= 0) {
      const error = new Error('At least one bid is required before starting last call');
      error.status = 400;
      throw error;
    }

    const durationSeconds = Math.max(
      5,
      Math.min(180, Number(req.body?.durationSeconds) || 10)
    );
    const resumeSeconds = Math.max(
      5,
      Math.min(180, Number(req.body?.resumeSeconds) || 30)
    );

    tournament.auctionState.stage = 'LastCall';
    tournament.auctionState.lastCallActive = true;
    tournament.auctionState.lastCallTeam = highestBidder;
    tournament.auctionState.lastCallTeamName =
      tournament.auctionState?.highestBidderName || player.currentBidTeamName || 'Team';
    tournament.auctionState.lastCallTimerSeconds = durationSeconds;
    tournament.auctionState.lastCallResumeSeconds = resumeSeconds;
    tournament.auctionState.timerSeconds = durationSeconds;
    tournament.auctionState.lastCallStartedAt = new Date();
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `🚨 Last call started for ${player.name}`,
      type: 'status',
      meta: {
        playerId: player._id,
        teamId: highestBidder,
        timerSeconds: durationSeconds,
        resumeSeconds
      }
    });
    await tournament.save();

    const payload = await buildAuctionStatusPayload(tournament);

    broadcastEvent('auction:last-call-started', tournament.code, {
      playerId: player._id,
      teamId: highestBidder,
      teamName: tournament.auctionState.lastCallTeamName,
      timerSeconds: durationSeconds
    });

    if (io) {
      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: `🚨 Last call on ${player.name}! Current bid ₹${(tournament.auctionState.currentBid || player.currentBid || 0).toLocaleString('en-IN')}.`
      });
    }

    res.json(payload);
  } catch (error) {
    handleRouteError(res, error, 'Error triggering last call');
  }
});

router.post('/:tournamentCode/last-call/withdraw', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (!currentPlayerId) {
      const error = new Error('No active player to adjust');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player || player.auctionStatus !== 'InAuction') {
      const error = new Error('Player not currently in auction');
      error.status = 400;
      throw error;
    }

    const storedResumeSeconds = tournament.auctionState?.lastCallResumeSeconds || 0;
    const restoreSeconds = Math.max(
      5,
      Math.min(180, Number(req.body?.timerSeconds) || storedResumeSeconds || 30)
    );

    tournament.auctionState.stage = 'Bidding';
    clearLastCallState(tournament);
    tournament.auctionState.timerSeconds = restoreSeconds;
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `↩️ Last call withdrawn for ${player.name} — timer restored to ${restoreSeconds}s`,
      type: 'status',
      meta: {
        playerId: player._id,
        timerSeconds: restoreSeconds
      }
    });
    await tournament.save();

    const payload = await buildAuctionStatusPayload(tournament);

    broadcastEvent('auction:last-call-withdrawn', tournament.code, {
      playerId: player._id,
      timerSeconds: restoreSeconds
    });

    if (io) {
      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: `↩️ Last call withdrawn for ${player.name}. Bidding resumes!`
      });
    }

    res.json(payload);
  } catch (error) {
    handleRouteError(res, error, 'Error withdrawing last call');
  }
});

router.post('/:tournamentCode/bid', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { teamId } = req.body;
    
    // Check if current player is in force auction mode (quota bypass)
    const currentPlayerId = tournament.auctionState?.currentPlayer;
    const forceAuctionPlayers = tournament.auctionState?.forceAuctionPlayers || [];
    const bypassQuota = currentPlayerId && forceAuctionPlayers.some(id => String(id) === String(currentPlayerId));
    
    await executeTeamBid({
      tournament,
      teamId,
      actorContext: { actor: req.user?.role || 'admin' },
      bypassQuota: bypassQuota || false
    });
    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    // Handle consecutive bid rejection with socket notification
    if (error.code === 'CONSECUTIVE_BID_BLOCKED' && io && req.body.teamId) {
      try {
        const tournamentCode = req.params.tournamentCode;
        const team = await Team.findById(req.body.teamId).catch(() => null);
        if (team && tournamentCode) {
          // Emit invalid bid event to notify the team
          io.emit('bid:invalid', {
            tournamentCode: tournamentCode,
            teamId: team._id,
            teamName: team.name,
            message: error.message
          });
        }
      } catch (socketErr) {
        // Ignore socket notification errors
        console.error('Error sending bid:invalid socket event:', socketErr);
      }
    }
    handleRouteError(res, error, 'Error processing bid');
  }
});

router.post('/:tournamentCode/undo-bid', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (!currentPlayerId) {
      const error = new Error('No player currently in auction');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player || player.auctionStatus !== 'InAuction') {
      const error = new Error('Player not in auction');
      error.status = 400;
      throw error;
    }

    if (!player.bidHistory || player.bidHistory.length === 0) {
      const error = new Error('No bids to undo');
      error.status = 400;
      throw error;
    }

    // Remove the last bid from history
    const lastBid = player.bidHistory.pop();
    const previousBid = player.bidHistory.length > 0 
      ? player.bidHistory[player.bidHistory.length - 1]
      : null;

    // Update player's current bid and bidder
    if (previousBid) {
      player.currentBid = previousBid.bidAmount;
      player.currentBidTeam = previousBid.bidder;
      player.currentBidTeamName = previousBid.teamName;
      
      tournament.auctionState.currentBid = previousBid.bidAmount;
      tournament.auctionState.highestBidder = previousBid.bidder;
      tournament.auctionState.highestBidderName = previousBid.teamName;
    } else {
      // No previous bids, reset to base price
      player.currentBid = 0;
      player.currentBidTeam = null;
      player.currentBidTeamName = null;
      
      tournament.auctionState.currentBid = 0;
      tournament.auctionState.highestBidder = null;
      tournament.auctionState.highestBidderName = null;
    }

    player.lastAuctionEventAt = new Date();
    await player.save();

    tournament.auctionState.lastBidTeamId = previousBid ? previousBid.bidder : null;
    tournament.auctionState.lastActionAt = new Date();
    
    appendAuctionLog(tournament, {
      message: `↶ Last bid (₹${lastBid.bidAmount.toLocaleString()} by ${lastBid.teamName}) undone`,
      type: 'status',
      meta: {
        playerId: player._id,
        undoneBid: lastBid
      }
    });

    await tournament.save();

    // Broadcast undo event
    broadcastEvent('bid:undone', tournament.code, {
      playerId: player._id,
      playerName: player.name,
      undoneBid: lastBid,
      currentBid: tournament.auctionState.currentBid,
      highestBidder: tournament.auctionState.highestBidder
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error undoing bid');
  }
});

router.post('/:tournamentCode/seats/vote', authenticateSeat, async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    if (req.seatAuth.payload.tournamentCode !== tournament.code) {
      return res.status(403).json({ success: false, message: 'Seat not linked to this tournament' });
    }

    // Multi-seat voting is an AuctionPro-exclusive feature.
    // Keep this in sync with readiness checks in ensureAuctionStartReadiness.
    if (tournament.plan !== 'AuctionPro') {
      return res.status(403).json({
        success: false,
        message: 'Auction Pro features are not enabled for this tournament'
      });
    }

    const seat = req.seatAuth?.seat;
    const team = req.seatAuth?.team;

    if (!seat || !team) {
      return res.status(401).json({ success: false, message: 'Seat session invalid' });
    }

    const action = (req.body?.action || '').toLowerCase();
    if (!['call', 'pass', 'override_call'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid vote action' });
    }

    const currentPlayerId = tournament.auctionState?.currentPlayer;
    if (!currentPlayerId) {
      return res.status(400).json({ success: false, message: 'No player currently in auction' });
    }

    const player = await Player.findById(currentPlayerId);
    if (!player || player.auctionStatus !== 'InAuction') {
      return res.status(400).json({ success: false, message: 'Player not available for bidding' });
    }

    const policy = getSeatPolicy(team);
    const consensusStore = getSeatConsensusStore(tournament);
    const key = buildSeatConsensusKey(team._id, player._id);

    if (!consensusStore[key] || consensusStore[key].playerId !== String(player._id)) {
      consensusStore[key] = {
        playerId: String(player._id),
        votes: []
      };
    }

    const entry = consensusStore[key];
    entry.votes = entry.votes.filter((vote) => vote.seatId !== String(seat._id));
    entry.votes.push({
      seatId: String(seat._id),
      seatLabel: seat.label,
      action,
      at: new Date()
    });

    tournament.markModified('auctionState.seatConsensus');

    seat.lastVoteAt = new Date();
    await team.save();

    const eligibleSeats = (team.seats || []).filter((item) => item.isVoter !== false && item.status !== 'Disabled');
    const eligibleCount = eligibleSeats.length || 1;

    let bidTriggered = false;
    let bidResult = null;
    const consensusResult = evaluateSeatConsensus({
      policy,
      votes: entry.votes,
      eligibleCount
    });

    const leadOverride = action === 'override_call' && policy.allowLeadOverride && seat.isLead;

    if (leadOverride || consensusResult.resolved || (policy.mode === 'single' && action !== 'pass')) {
      // Check if current player is in force auction mode (quota bypass)
      const currentPlayerId = tournament.auctionState?.currentPlayer;
      const forceAuctionPlayers = tournament.auctionState?.forceAuctionPlayers || [];
      const bypassQuota = currentPlayerId && forceAuctionPlayers.some(id => String(id) === String(currentPlayerId));
      
      bidResult = await executeTeamBid({
        tournament,
        teamId: team._id,
        actorContext: { actor: 'seat', seatId: String(seat._id) },
        bypassQuota: bypassQuota || false
      });
      bidTriggered = true;
      if (policy.autoResetOnBid !== false) {
        delete consensusStore[key];
        tournament.markModified('auctionState.seatConsensus');
        await tournament.save();
      }
    } else {
      await tournament.save();
    }

    res.json({
      success: true,
      bidTriggered,
      consensus: {
        required: consensusResult.required,
        callVotes: consensusResult.callVotes,
        passVotes: consensusResult.passVotes,
        eligible: eligibleCount,
        votes: entry.votes
      },
      refreshSuggested: bidTriggered,
      bidAmount: bidResult?.bidAmount
    });
  } catch (error) {
    console.error('Seat vote error:', error);
    handleRouteError(res, error, 'Unable to process seat vote');
  }
});

router.post('/:tournamentCode/sold', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const currentPlayerId = tournament.auctionState?.currentPlayer;
    
    // Check if this player is in force auction mode (quota bypass)
    const forceAuctionPlayers = tournament.auctionState?.forceAuctionPlayers || [];
    const isForceAuction = forceAuctionPlayers.some(id => String(id) === String(currentPlayerId));
    const bypassQuota = req.body?.bypassQuota === true || isForceAuction;

    if (!currentPlayerId) {
      const error = new Error('No active player to finalize');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player || player.auctionStatus !== 'InAuction') {
      const error = new Error('Player not currently in auction');
      error.status = 400;
      throw error;
    }

    const teamId =
      tournament.auctionState?.highestBidder ||
      player.currentBidTeam;

    if (!teamId) {
      const error = new Error('Cannot finalize sale without a highest bidder');
      error.status = 400;
      throw error;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      const error = new Error('Winning team not found');
      error.status = 404;
      throw error;
    }

    // Check if team quota is full (unless bypassing)
    if (!bypassQuota) {
      const teamSnapshots = await computeTeamSnapshots(tournament);
      const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(teamId));
      if (teamSnapshot && teamSnapshot.remainingPlayers === 0) {
        const error = new Error(`Team ${team.name} has reached maximum player quota (${tournament.maxPlayers || 16}). Use force auction or direct assign to bypass quota.`);
        error.status = 400;
        error.code = 'QUOTA_FULL';
        throw error;
      }
    }

    const soldPrice = player.currentBid || tournament.auctionState.currentBid || player.basePrice || 0;
    player.auctionStatus = 'Sold';
    player.soldPrice = soldPrice;
    player.soldTo = team._id;
    player.soldToName = team.name;
    player.soldAt = new Date();
    player.currentBidTeam = team._id;
    player.currentBidTeamName = team.name;
    player.lastAuctionEventAt = new Date();
    // Mark transaction type: ForceAuction if bypassing quota, otherwise Auction (default)
    player.transactionType = bypassQuota ? 'ForceAuction' : 'Auction';
    await player.save();

    await Team.updateOne(
      { _id: team._id },
      {
        $addToSet: { purchasedPlayers: player._id }
      }
    );
    const balanceSnapshot = await recalculateTeamBalance(team._id, tournament);

    // Remove from force auction players list if present
    if (Array.isArray(tournament.auctionState.forceAuctionPlayers)) {
      tournament.auctionState.forceAuctionPlayers = tournament.auctionState.forceAuctionPlayers.filter(
        (id) => String(id) !== String(player._id)
      );
    }

    tournament.auctionState.stage = 'Sold';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset when player sold
    tournament.auctionState.timerSeconds = 0;
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `✅ ${player.name} sold to ${team.name} for ₹${soldPrice.toLocaleString()}${bypassQuota ? ' (quota bypassed)' : ''}`,
      type: 'status',
      meta: {
        playerId: player._id,
        teamId: team._id,
        amount: soldPrice,
        bypassQuota: bypassQuota || false
      }
    });
    await tournament.save();

    // Broadcast player:sold event globally
    broadcastEvent('player:sold', tournament.code, {
      playerId: player._id,
      playerName: player.name,
      soldPrice,
      teamId: team._id,
      teamName: team.name
    });
    
    // Multi-screen sync with sold animation
    if (io) {
      // Also emit player:sold directly to display room to ensure it's received
      io.to(`display:${tournament.code}`).emit('player:sold', {
        tournamentCode: tournament.code,
        playerId: player._id,
        playerName: player.name,
        soldPrice,
        teamId: team._id,
        teamName: team.name
      });
      
      io.to(`display:${tournament.code}`).emit('sync:display', {
        type: 'sold',
        tournamentCode: tournament.code,
        currentPlayer: null,
        currentBid: 0,
        leadingTeam: null,
        timer: 0
      });
      
      // Sound cue for sold
      io.to(`display:${tournament.code}`).emit('sound:play', {
        tournamentCode: tournament.code,
        sound: 'sold'
      });
      
      // Commentary update
      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: `🎉 ${player.name} sold to ${team.name} for ₹${soldPrice.toLocaleString('en-IN')}!`
      });
    }
    // Send team-specific notification
    if (io) {
      io.emit('team:notification', {
        tournamentCode: tournament.code,
        teamId: team._id,
        type: 'sold',
        message: `🏆 You've successfully bought ${player.name} for ₹${soldPrice.toLocaleString('en-IN')}!`,
        playerName: player.name,
        price: soldPrice
      });
    }
    broadcastEvent('auction:update-balance', tournament.code, {
      teamId: team._id,
      newBalance: balanceSnapshot.currentBalance
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error finalizing player sale');
  }
});

router.post('/:tournamentCode/pending', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const currentPlayerId = tournament.auctionState?.currentPlayer;

    if (!currentPlayerId) {
      const error = new Error('No active player to move to pending');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player) {
      const error = new Error('Player not found');
      error.status = 404;
      throw error;
    }

    player.auctionStatus = 'Pending';
    player.pendingAt = new Date();
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.lastAuctionEventAt = new Date();
    await player.save();

    tournament.auctionState.stage = 'Pending';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null; // Reset when moved to pending
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    if (!Array.isArray(tournament.auctionState.pendingPlayers)) {
      tournament.auctionState.pendingPlayers = [];
    }
    if (!tournament.auctionState.pendingPlayers.some((id) => String(id) === String(player._id))) {
      tournament.auctionState.pendingPlayers.push(player._id);
    }
    appendAuctionLog(tournament, {
      message: `⏳ ${player.name} moved to pending list`,
      type: 'status',
      meta: { playerId: player._id }
    });
    await tournament.save();

    broadcastEvent('player:pending', tournament.code, {
      playerId: player._id,
      playerName: player.name
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error moving player to pending');
  }
});

router.post('/:tournamentCode/pending-to-available', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const tournamentCode = tournament.code;
    
    // Check if there are any pending players
    const pendingCount = await Player.countDocuments({ 
      tournamentCode, 
      auctionStatus: 'Pending' 
    });
    
    if (pendingCount === 0) {
      const error = new Error('No pending players to move');
      error.status = 400;
      throw error;
    }
    
    // Move all pending players to available
    const result = await Player.updateMany(
      { tournamentCode, auctionStatus: 'Pending' },
      {
        $set: {
          auctionStatus: 'Available',
          pendingAt: null
        }
      }
    );
    
    appendAuctionLog(tournament, {
      message: `🔄 ${result.modifiedCount} pending player(s) moved to available list`,
      type: 'status',
      meta: { count: result.modifiedCount }
    });
    await tournament.save();
    
    broadcastEvent('players:restored', tournament.code, {
      count: result.modifiedCount
    });
    
    res.json({
      success: true,
      message: `${result.modifiedCount} player(s) moved to available`,
      count: result.modifiedCount,
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error moving pending players to available');
  }
});

router.post('/:tournamentCode/unsold-to-available', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const tournamentCode = tournament.code;
    
    // Check if there are any unsold players
    const unsoldCount = await Player.countDocuments({ 
      tournamentCode, 
      auctionStatus: 'Unsold' 
    });
    
    if (unsoldCount === 0) {
      const error = new Error('No unsold players to move');
      error.status = 400;
      throw error;
    }
    
    // Move all unsold players to available
    const result = await Player.updateMany(
      { tournamentCode, auctionStatus: 'Unsold' },
      {
        $set: {
          auctionStatus: 'Available',
          unsoldAt: null,
          currentBid: 0,
          currentBidTeam: null,
          currentBidTeamName: null,
          bidHistory: []
        }
      }
    );
    
    appendAuctionLog(tournament, {
      message: `🔄 ${result.modifiedCount} unsold player(s) moved to available list`,
      type: 'status',
      meta: { count: result.modifiedCount }
    });
    await tournament.save();
    
    broadcastEvent('players:restored', tournament.code, {
      count: result.modifiedCount,
      type: 'unsold'
    });
    
    res.json({
      success: true,
      message: `${result.modifiedCount} unsold player(s) moved to available`,
      count: result.modifiedCount,
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error moving unsold players to available');
  }
});

router.post('/:tournamentCode/withdrawn/:playerId/to-available', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId } = req.params;
    
    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code,
      auctionStatus: 'Withdrawn'
    });
    
    if (!player) {
      const error = new Error('Player not found or not withdrawn');
      error.status = 404;
      throw error;
    }
    
    // Move player to available
    player.auctionStatus = 'Available';
    player.withdrawnAt = null;
    player.withdrawalReason = null;
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    await player.save();
    
    // Remove from tournament's withdrawnPlayers array
    if (tournament.withdrawnPlayers && tournament.withdrawnPlayers.length > 0) {
      tournament.withdrawnPlayers = tournament.withdrawnPlayers.filter(
        (id) => String(id) !== String(player._id)
      );
      tournament.markModified('withdrawnPlayers');
    }
    
    appendAuctionLog(tournament, {
      message: `🔄 ${player.name} moved from withdrawn to available list`,
      type: 'status',
      meta: { playerId: player._id, playerName: player.name }
    });
    await tournament.save();
    
    broadcastEvent('player:restored', tournament.code, {
      playerId: player._id,
      playerName: player.name,
      type: 'withdrawn'
    });
    
    res.json({
      success: true,
      message: `${player.name} moved to available list`,
      player: {
        _id: player._id,
        name: player.name,
        auctionStatus: player.auctionStatus
      },
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error moving withdrawn player to available');
  }
});

router.post('/:tournamentCode/withdrawn-to-available', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const tournamentCode = tournament.code;
    
    // Check if there are any withdrawn players
    const withdrawnCount = await Player.countDocuments({ 
      tournamentCode, 
      auctionStatus: 'Withdrawn' 
    });
    
    if (withdrawnCount === 0) {
      const error = new Error('No withdrawn players to move');
      error.status = 400;
      throw error;
    }
    
    // Move all withdrawn players to available
    const result = await Player.updateMany(
      { tournamentCode, auctionStatus: 'Withdrawn' },
      {
        $set: {
          auctionStatus: 'Available',
          withdrawnAt: null,
          withdrawalReason: null,
          currentBid: 0,
          currentBidTeam: null,
          currentBidTeamName: null,
          bidHistory: []
        }
      }
    );
    
    // Remove from tournament's withdrawnPlayers array
    if (tournament.withdrawnPlayers && tournament.withdrawnPlayers.length > 0) {
      tournament.withdrawnPlayers = [];
      tournament.markModified('withdrawnPlayers');
    }
    
    appendAuctionLog(tournament, {
      message: `🔄 ${result.modifiedCount} withdrawn player(s) moved to available list`,
      type: 'status',
      meta: { count: result.modifiedCount }
    });
    await tournament.save();
    
    broadcastEvent('players:restored', tournament.code, {
      count: result.modifiedCount,
      type: 'withdrawn'
    });
    
    res.json({
      success: true,
      message: `${result.modifiedCount} withdrawn player(s) moved to available`,
      count: result.modifiedCount,
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error moving withdrawn players to available');
  }
});

router.post('/:tournamentCode/recall-last-sold', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    
    const tournamentCode = tournament.code;
    
    // Find the last sold player (most recent soldAt)
    const lastSoldPlayer = await Player.findOne({
      tournamentCode,
      auctionStatus: 'Sold'
    })
    .sort({ soldAt: -1 })
    .lean();
    
    if (!lastSoldPlayer) {
      const error = new Error('No sold players found');
      error.status = 400;
      throw error;
    }
    
    // Get the full player document to update
    const player = await Player.findById(lastSoldPlayer._id);
    if (!player) {
      const error = new Error('Player not found');
      error.status = 404;
      throw error;
    }
    
    const soldPrice = player.soldPrice || 0;
    const teamId = player.soldTo;
    const teamName = player.soldToName;
    
    // Refund the team and remove player from purchasedPlayers
    if (teamId) {
      const team = await Team.findById(teamId);
      if (team) {
        // Remove player from purchasedPlayers array
        team.purchasedPlayers = (team.purchasedPlayers || []).filter(
          (pid) => String(pid) !== String(player._id)
        );
        await team.save();
        
        // Recalculate team balance (this will refund the amount)
        await recalculateTeamBalance(team._id, tournament);
        
        // Get updated team to broadcast new balance
        const updatedTeam = await Team.findById(teamId);
        broadcastEvent('auction:update-balance', tournament.code, {
          teamId: team._id,
          newBalance: updatedTeam.currentBalance
        });
      }
    }
    
    // Reset player to Available status
    player.auctionStatus = 'Available';
    player.soldPrice = null;
    player.soldTo = null;
    player.soldToName = null;
    player.soldAt = null;
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.lastAuctionEventAt = new Date();
    await player.save();
    
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `↩️ Last sold player recalled: ${player.name} moved back to available (refunded ₹${soldPrice.toLocaleString()} to ${teamName || 'team'})`,
      type: 'status',
      meta: { 
        playerId: player._id, 
        playerName: player.name,
        refundAmount: soldPrice, 
        teamId 
      }
    });
    await tournament.save();
    
    // Broadcast recall event
    broadcastEvent('player:recalled', tournament.code, {
      playerId: player._id,
      playerName: player.name,
      refundAmount: soldPrice,
      teamId,
      teamName
    });
    
    res.json({
      success: true,
      message: `${player.name} recalled and moved to available list`,
      player: {
        id: player._id,
        name: player.name,
        refundAmount: soldPrice,
        teamName
      },
      ...(await buildAuctionStatusPayload(tournament))
    });
  } catch (error) {
    handleRouteError(res, error, 'Error recalling last sold player');
  }
});

// Mark player as Unsold
router.post('/:tournamentCode/mark-unsold', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const currentPlayerId = tournament.auctionState?.currentPlayer;

    if (!currentPlayerId) {
      const error = new Error('No active player to mark as unsold');
      error.status = 400;
      throw error;
    }

    const player = await Player.findById(currentPlayerId);
    if (!player) {
      const error = new Error('Player not found');
      error.status = 404;
      throw error;
    }

    // Check if player has bids
    if (player.bidHistory && player.bidHistory.length > 0) {
      const error = new Error('⚠️ Player has bids. Cannot mark unsold.');
      error.status = 400;
      throw error;
    }

    // Mark player as unsold
    player.auctionStatus = 'Unsold';
    player.unsoldAt = new Date();
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.remarks = player.remarks || 'Marked unsold manually by controller';
    player.lastAuctionEventAt = new Date();
    await player.save();

    tournament.auctionState.stage = 'Idle';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null;
    clearLastCallState(tournament);
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `❌ ${player.name} marked as Unsold`,
      type: 'status',
      meta: { playerId: player._id }
    });
    await tournament.save();

    // Broadcast unsold event
    broadcastEvent('player:unsold', tournament.code, {
      playerId: player._id,
      playerName: player.name
    });

    // Auto-pick next player after 3 seconds
    setTimeout(async () => {
      try {
        const availablePlayers = await Player.find({
          tournamentCode: tournament.code,
          auctionStatus: 'Available'
        }).lean();

        if (availablePlayers.length > 0) {
          const randomIndex = Math.floor(Math.random() * availablePlayers.length);
          const selected = await Player.findById(availablePlayers[randomIndex]._id);

          selected.auctionStatus = 'InAuction';
          selected.currentBid = 0;
          selected.currentBidTeam = null;
          selected.currentBidTeamName = null;
          selected.bidHistory = [];
          selected.auctionedAt = new Date();
          selected.lastAuctionEventAt = new Date();
          await selected.save();

          const updatedTournament = await findTournamentByCode(tournament.code);
          updatedTournament.auctionState.status = 'Running';
          updatedTournament.auctionState.stage = 'Bidding';
          updatedTournament.auctionState.currentPlayer = selected._id;
          updatedTournament.auctionState.currentBid = 0;
          updatedTournament.auctionState.highestBidder = null;
          updatedTournament.auctionState.highestBidderName = null;
          updatedTournament.auctionState.lastBidTeamId = null;
          updatedTournament.auctionState.timerSeconds = updatedTournament.auctionState.timerSeconds || 0;
          updatedTournament.auctionState.lastActionAt = new Date();
          appendAuctionLog(updatedTournament, {
            message: `Player ${selected.name} entered the auction floor`,
            type: 'status',
            meta: { playerId: selected._id }
          });
          await updatedTournament.save();

          const playerPayload = selected.toObject();
          broadcastEvent('player:next', tournament.code, { player: playerPayload });
        }
      } catch (err) {
        console.error('Error auto-picking next player after unsold:', err);
      }
    }, 3000);

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error marking player as unsold');
  }
});

router.post('/:tournamentCode/reauction/:playerId', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId } = req.params;

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });
    if (!player || (player.auctionStatus !== 'Pending' && player.auctionStatus !== 'Unsold')) {
      const error = new Error('Player not in pending or unsold list');
      error.status = 400;
      throw error;
    }

    const wasPending = player.auctionStatus === 'Pending';
    player.auctionStatus = 'Available';
    player.pendingAt = null;
    player.unsoldAt = null;
    player.lastAuctionEventAt = new Date();
    await player.save();

    // Remove from pending players if applicable
    if (wasPending) {
      tournament.auctionState.pendingPlayers = (tournament.auctionState.pendingPlayers || []).filter(
        (id) => String(id) !== String(player._id)
      );
    }
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `♻️ ${player.name} reintroduced to auction pool`,
      type: 'status',
      meta: { playerId: player._id }
    });
    await tournament.save();

    broadcastEvent('player:reauction', tournament.code, {
      playerId: player._id
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error reintroducing player to auction');
  }
});

router.post('/:tournamentCode/pending/force-auction/:playerId', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId } = req.params;

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });
    if (!player || player.auctionStatus !== 'Pending') {
      const error = new Error('Player not in pending list');
      error.status = 400;
      throw error;
    }

    // Move player to InAuction status
    player.auctionStatus = 'InAuction';
    player.pendingAt = null;
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.lastAuctionEventAt = new Date();
    await player.save();

    // Remove from pending players list
    if (Array.isArray(tournament.auctionState.pendingPlayers)) {
      tournament.auctionState.pendingPlayers = tournament.auctionState.pendingPlayers.filter(
        (id) => String(id) !== String(player._id)
      );
    }

    // Set force auction flag for this player (quota bypass mode)
    if (!tournament.auctionState.forceAuctionPlayers) {
      tournament.auctionState.forceAuctionPlayers = [];
    }
    if (!tournament.auctionState.forceAuctionPlayers.includes(player._id)) {
      tournament.auctionState.forceAuctionPlayers.push(player._id);
    }

    // If no current player in auction, set this player as current
    if (!tournament.auctionState.currentPlayer) {
      tournament.auctionState.currentPlayer = player._id;
      tournament.auctionState.currentBid = 0;
      tournament.auctionState.highestBidder = null;
      tournament.auctionState.highestBidderName = null;
      tournament.auctionState.stage = 'Bidding';
      tournament.auctionState.timerSeconds = tournament.auctionState.timerSeconds || 30;
    }

    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `🚀 ${player.name} put in force auction (quota bypass enabled)`,
      type: 'status',
      meta: { playerId: player._id, bypassQuota: true }
    });
    await tournament.save();

    broadcastEvent('player:force-auction', tournament.code, {
      playerId: player._id,
      playerName: player.name
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error putting player in force auction');
  }
});

router.post('/:tournamentCode/pending/direct-assign/:playerId', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId } = req.params;
    const { teamId, price } = req.body;

    if (!teamId) {
      const error = new Error('Team ID is required');
      error.status = 400;
      throw error;
    }

    const priceValue = typeof price === 'number' ? price : parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      const error = new Error('Price must be a valid non-negative number');
      error.status = 400;
      throw error;
    }

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });
    if (!player || player.auctionStatus !== 'Pending') {
      const error = new Error('Player not in pending list');
      error.status = 400;
      throw error;
    }

    const team = await Team.findById(teamId);
    if (!team || team.tournamentCode !== tournament.code) {
      const error = new Error('Team not found or does not belong to this tournament');
      error.status = 404;
      throw error;
    }

    // Check team balance if price > 0
    if (priceValue > 0) {
      const teamSnapshots = await computeTeamSnapshots(tournament);
      const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(teamId));
      if (!teamSnapshot) {
        const error = new Error('Team financial snapshot not found');
        error.status = 400;
        throw error;
      }
      if (priceValue > teamSnapshot.currentBalance) {
        const error = new Error(`Team ${team.name} has insufficient balance. Available: ₹${teamSnapshot.currentBalance.toLocaleString()}, Required: ₹${priceValue.toLocaleString()}`);
        error.status = 400;
        throw error;
      }
    }

    // Assign player to team
    player.auctionStatus = 'Sold';
    player.soldPrice = priceValue;
    player.soldTo = team._id;
    player.soldToName = team.name;
    player.soldAt = new Date();
    player.pendingAt = null;
    player.lastAuctionEventAt = new Date();
    player.transactionType = 'DirectAssign';
    await player.save();

    // Add to team's purchased players
    await Team.updateOne(
      { _id: team._id },
      {
        $addToSet: { purchasedPlayers: player._id }
      }
    );

    // Recalculate team balance
    await recalculateTeamBalance(team._id, tournament);

    // Remove from pending players list
    if (Array.isArray(tournament.auctionState.pendingPlayers)) {
      tournament.auctionState.pendingPlayers = tournament.auctionState.pendingPlayers.filter(
        (id) => String(id) !== String(player._id)
      );
    }

    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `📋 ${player.name} directly assigned to ${team.name} for ₹${priceValue.toLocaleString()} (quota bypassed)`,
      type: 'status',
      meta: {
        playerId: player._id,
        teamId: team._id,
        amount: priceValue,
        bypassQuota: true,
        directAssign: true
      }
    });
    await tournament.save();

    // Broadcast player:sold event
    broadcastEvent('player:sold', tournament.code, {
      playerId: player._id,
      playerName: player.name,
      soldPrice: priceValue,
      teamId: team._id,
      teamName: team.name,
      directAssign: true
    });

    if (io) {
      io.to(`display:${tournament.code}`).emit('player:sold', {
        tournamentCode: tournament.code,
        playerId: player._id,
        playerName: player.name,
        soldPrice: priceValue,
        teamId: team._id,
        teamName: team.name,
        directAssign: true
      });

      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: `📋 ${player.name} directly assigned to ${team.name} for ₹${priceValue.toLocaleString()}`
      });
    }

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error directly assigning player');
  }
});

router.post('/:tournamentCode/restart', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const allowedRoles = ['SuperAdmin', 'TournamentAdmin'];
    if (!allowedRoles.includes(req.user?.role)) {
      const error = new Error('Only SuperAdmin or TournamentAdmin can restart the auction');
      error.status = 403;
      throw error;
    }

    const tournamentCode = tournament.code;

    // Reset all players to a clean state
    await Player.updateMany(
      { tournamentCode },
      {
        $set: {
          auctionStatus: 'Available',
          currentBid: 0,
          currentBidTeam: null,
          currentBidTeamName: null,
          soldPrice: null,
          soldTo: null,
          soldToName: null,
          soldAt: null,
          auctionedAt: null,
          pendingAt: null,
          unsoldAt: null,
          withdrawnAt: null,
          withdrawalReason: null,
          bidHistory: [],
          lastAuctionEventAt: null,
          remarks: null
        }
      }
    );

    // Reset teams (balances + purchased player cache)
    const fallbackBudget = tournament.auctionRules?.maxFundForTeam || 0;
    const teams = await Team.find({ tournamentCode });
    await Promise.all(
      teams.map(async (team) => {
        const startingBudget =
          typeof team.budget === 'number' && team.budget > 0 ? team.budget : fallbackBudget;
        team.purchasedPlayers = [];
        team.currentBalance = startingBudget || 0;
        await team.save();
      })
    );

    // Reset tournament level state
    if (!tournament.auctionState) {
      tournament.auctionState = {};
    }

    clearLastCallState(tournament);

    tournament.auctionStatus = 'NotStarted';
    tournament.auctionEndedAt = null;
    tournament.withdrawnPlayers = [];

    const now = new Date();
    tournament.auctionState.status = 'NotStarted';
    tournament.auctionState.stage = 'Idle';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null;
    tournament.auctionState.timerSeconds = 0;
    tournament.auctionState.pendingPlayers = [];
    tournament.auctionState.logs = [];
    tournament.auctionState.lastActionAt = now;
    tournament.auctionState.lastStartedAt = null;
    tournament.auctionState.completedAt = null;
    tournament.auctionState.completedSummary = null;
    tournament.auctionState.reportPdf = null;
    tournament.auctionState.currentRound = 1;
    tournament.auctionState.isLocked = false;

    appendAuctionLog(tournament, {
      message: '🔄 Auction reset to initial state',
      type: 'status'
    });

    tournament.markModified('auctionState');
    await tournament.save();

    await logAuditEvent({
      action: 'auction:reset',
      entityType: 'Auction',
      entityId: tournament._id,
      entityName: tournament.name,
      tournamentCode,
      user: req.user,
      changes: {
        status: 'NotStarted',
        stage: 'Idle'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    broadcastEvent('auction:reset', tournamentCode, {
      message: 'Auction has been reset by an administrator'
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error restarting auction');
  }
});

// Withdraw player from auction
router.post('/:tournamentCode/withdraw', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId, reason } = req.body;

    if (!playerId) {
      const error = new Error('Player ID is required');
      error.status = 400;
      throw error;
    }

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });

    if (!player) {
      const error = new Error('Player not found');
      error.status = 404;
      throw error;
    }

    // Check if player is already withdrawn
    if (player.auctionStatus === 'Withdrawn') {
      const error = new Error('Player is already withdrawn');
      error.status = 400;
      throw error;
    }

    const wasInAuction = player.auctionStatus === 'InAuction';
    const wasSold = player.auctionStatus === 'Sold';
    const wasPending = player.auctionStatus === 'Pending';

    // If player is currently in auction, stop the auction
    if (wasInAuction && tournament.auctionState?.currentPlayer && 
        String(tournament.auctionState.currentPlayer) === String(playerId)) {
      tournament.auctionState.stage = 'Idle';
      tournament.auctionState.currentPlayer = null;
      tournament.auctionState.currentBid = 0;
      tournament.auctionState.highestBidder = null;
      tournament.auctionState.highestBidderName = null;
      tournament.auctionState.lastBidTeamId = null;
      clearLastCallState(tournament);
    }

    // Update player status
    player.auctionStatus = 'Withdrawn';
    player.withdrawnAt = new Date();
    player.withdrawalReason = reason || 'Withdrawn during auction due to unavailability';
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.lastAuctionEventAt = new Date();

    // If player was sold, refund the team
    if (wasSold && player.soldTo && player.soldPrice) {
      const team = await Team.findById(player.soldTo);
      if (team) {
        await recalculateTeamBalance(team._id, tournament);
        broadcastEvent('auction:update-balance', tournament.code, {
          teamId: team._id,
          newBalance: team.currentBalance
        });
      }
      player.soldPrice = 0;
      player.soldTo = null;
      player.soldToName = null;
      player.soldAt = null;
    }

    await player.save();

    // Add to withdrawn players list
    if (!Array.isArray(tournament.withdrawnPlayers)) {
      tournament.withdrawnPlayers = [];
    }
    if (!tournament.withdrawnPlayers.some((id) => String(id) === String(player._id))) {
      tournament.withdrawnPlayers.push(player._id);
    }

    // Remove from pending players if applicable
    if (wasPending && Array.isArray(tournament.auctionState.pendingPlayers)) {
      tournament.auctionState.pendingPlayers = tournament.auctionState.pendingPlayers.filter(
        (id) => String(id) !== String(player._id)
      );
    }

    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `🚫 ${player.name} withdrawn from auction${wasSold ? ' (sale revoked, refund processed)' : ''}`,
      type: 'status',
      meta: { playerId: player._id, reason: player.withdrawalReason }
    });
    await tournament.save();

    // Broadcast withdrawal event
    broadcastEvent('player:withdrawn', tournament.code, {
      playerId: player._id,
      name: player.name,
      reason: player.withdrawalReason,
      wasSold,
      wasInAuction
    });

    // If player was in auction, automatically pick next player
    if (wasInAuction) {
      setTimeout(async () => {
        try {
          const availablePlayers = await Player.find({
            tournamentCode: tournament.code,
            auctionStatus: 'Available'
          }).lean();

          if (availablePlayers.length > 0) {
            const randomIndex = Math.floor(Math.random() * availablePlayers.length);
            const selected = await Player.findById(availablePlayers[randomIndex]._id);

            selected.auctionStatus = 'InAuction';
            selected.currentBid = 0;
            selected.currentBidTeam = null;
            selected.currentBidTeamName = null;
            selected.bidHistory = [];
            selected.auctionedAt = new Date();
            selected.lastAuctionEventAt = new Date();
            await selected.save();

            const updatedTournament = await findTournamentByCode(tournament.code);
            updatedTournament.auctionState.status = 'Running';
            updatedTournament.auctionState.stage = 'Bidding';
            updatedTournament.auctionState.currentPlayer = selected._id;
            updatedTournament.auctionState.currentBid = 0;
            updatedTournament.auctionState.highestBidder = null;
            updatedTournament.auctionState.highestBidderName = null;
            updatedTournament.auctionState.lastBidTeamId = null;
            updatedTournament.auctionState.timerSeconds = updatedTournament.auctionState.timerSeconds || 0;
            clearLastCallState(updatedTournament);
            updatedTournament.auctionState.lastActionAt = new Date();
            appendAuctionLog(updatedTournament, {
              message: `Player ${selected.name} entered the auction floor`,
              type: 'status',
              meta: { playerId: selected._id }
            });
            await updatedTournament.save();

            const playerPayload = selected.toObject();
            broadcastEvent('player:next', tournament.code, { player: playerPayload });
          }
        } catch (err) {
          console.error('Error auto-picking next player after withdrawal:', err);
        }
      }, 3000);
    }

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error withdrawing player');
  }
});

// Revoke sale (withdraw a sold player)
router.post('/:tournamentCode/revoke-sale/:playerId', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);
    const { playerId } = req.params;
    const { reason } = req.body;

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });

    if (!player) {
      const error = new Error('Player not found');
      error.status = 404;
      throw error;
    }

    if (player.auctionStatus !== 'Sold') {
      const error = new Error('Player is not sold. Use withdraw endpoint instead.');
      error.status = 400;
      throw error;
    }

    const soldPrice = player.soldPrice || 0;
    const teamId = player.soldTo;
    const teamName = player.soldToName;

    // Refund the team
    if (teamId && soldPrice > 0) {
      const team = await Team.findById(teamId);
      if (team) {
        await recalculateTeamBalance(team._id, tournament);
        broadcastEvent('auction:update-balance', tournament.code, {
          teamId: team._id,
          newBalance: team.currentBalance
        });
      }
    }

    // Update player status
    player.auctionStatus = 'Withdrawn';
    player.withdrawnAt = new Date();
    player.withdrawalReason = reason || 'Sale revoked - player unavailable';
    player.soldPrice = 0;
    player.soldTo = null;
    player.soldToName = null;
    player.soldAt = null;
    player.currentBid = 0;
    player.currentBidTeam = null;
    player.currentBidTeamName = null;
    player.bidHistory = [];
    player.lastAuctionEventAt = new Date();
    await player.save();

    // Add to withdrawn players list
    if (!Array.isArray(tournament.withdrawnPlayers)) {
      tournament.withdrawnPlayers = [];
    }
    if (!tournament.withdrawnPlayers.some((id) => String(id) === String(player._id))) {
      tournament.withdrawnPlayers.push(player._id);
    }

    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `🚫 Sale revoked: ${player.name} withdrawn (refunded ₹${soldPrice.toLocaleString()} to ${teamName || 'team'})`,
      type: 'status',
      meta: { playerId: player._id, refundAmount: soldPrice, teamId }
    });
    await tournament.save();

    // Broadcast withdrawal event
    broadcastEvent('player:withdrawn', tournament.code, {
      playerId: player._id,
      name: player.name,
      reason: player.withdrawalReason,
      wasSold: true,
      refundAmount: soldPrice,
      teamId,
      teamName
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error revoking sale');
  }
});

// Update sold player details (change team, change price)
router.post('/:tournamentCode/update-sold-player/:playerId', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    // Allow updates even if auction is disabled/completed - this is for results page editing
    // checkAuctionEnabled(tournament);
    const { playerId } = req.params;
    const { teamId, price, bypassBalanceCheck } = req.body;

    if (!teamId) {
      const error = new Error('Team ID is required');
      error.status = 400;
      throw error;
    }

    const priceValue = typeof price === 'number' ? price : parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      const error = new Error('Price must be a valid non-negative number');
      error.status = 400;
      throw error;
    }

    const player = await Player.findOne({
      _id: playerId,
      tournamentCode: tournament.code
    });
    if (!player) {
      const error = new Error(`Player not found with ID: ${playerId}`);
      error.status = 404;
      throw error;
    }
    if (player.auctionStatus !== 'Sold') {
      const error = new Error(`Player is not sold. Current status: ${player.auctionStatus}`);
      error.status = 400;
      throw error;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      const error = new Error(`Team not found with ID: ${teamId}`);
      error.status = 404;
      throw error;
    }
    if (team.tournamentCode !== tournament.code) {
      const error = new Error(`Team ${team.name} does not belong to tournament ${tournament.code}`);
      error.status = 400;
      throw error;
    }

    const oldTeamId = player.soldTo ? String(player.soldTo) : null;
    const oldPrice = player.soldPrice || 0;
    const oldTeamName = player.soldToName || 'N/A';

    // Check new team balance if price changed
    if (oldTeamId && String(oldTeamId) === String(teamId)) {
      // Same team - check if price increase is affordable
      // Note: currentBalance already has oldPrice deducted, so we just need to check if priceDiff is affordable
      const teamSnapshots = await computeTeamSnapshots(tournament);
      const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(teamId));
      if (!teamSnapshot) {
        const error = new Error('Team financial snapshot not found');
        error.status = 400;
        throw error;
      }
      const priceDiff = priceValue - oldPrice;
      if (!bypassBalanceCheck && priceDiff > 0 && priceDiff > teamSnapshot.currentBalance) {
        const error = new Error(`Team ${team.name} has insufficient balance for price increase. Available: ₹${teamSnapshot.currentBalance.toLocaleString()}, Required: ₹${priceDiff.toLocaleString()}`);
        error.status = 400;
        throw error;
      }
      // Price decrease is always allowed (refund)
    } else {
      // Different team (or no old team) - need to check if new team can afford the full price
      // For different team: We need to check new team's balance WITHOUT the old team's refund yet
      // because computeTeamSnapshots calculates based on current database state
      // The new team's current balance is what they have right now (without this player)
      const teamSnapshots = await computeTeamSnapshots(tournament);
      const teamSnapshot = teamSnapshots.find((item) => String(item._id) === String(teamId));
      if (!teamSnapshot) {
        const error = new Error('Team financial snapshot not found');
        error.status = 400;
        throw error;
      }
      
      // Check if new team can afford the price
      // Note: If old team exists, they will be refunded, but that doesn't affect new team's balance
      if (!bypassBalanceCheck && priceValue > teamSnapshot.currentBalance) {
        const error = new Error(`Team ${team.name} has insufficient balance. Available: ₹${teamSnapshot.currentBalance.toLocaleString()}, Required: ₹${priceValue.toLocaleString()}`);
        error.status = 400;
        throw error;
      }
    }

    // Update player
    player.soldPrice = priceValue;
    player.soldTo = team._id;
    player.soldToName = team.name;
    player.lastAuctionEventAt = new Date();
    await player.save();

    // Update team purchased players
    if (oldTeamId && String(oldTeamId) !== String(teamId)) {
      // Remove from old team
      await Team.updateOne(
        { _id: oldTeamId },
        { $pull: { purchasedPlayers: player._id } }
      );
    }
    // Add to new team (only if not already there)
    await Team.updateOne(
      { _id: team._id },
      { $addToSet: { purchasedPlayers: player._id } }
    );

    // Recalculate team balances (order matters: refund old team first, then charge new team)
    if (oldTeamId && String(oldTeamId) !== String(teamId)) {
      // Refund old team
      await recalculateTeamBalance(oldTeamId, tournament);
      broadcastEvent('auction:update-balance', tournament.code, {
        teamId: oldTeamId
      });
    }
    // Charge new team
    await recalculateTeamBalance(team._id, tournament);

    broadcastEvent('auction:update-balance', tournament.code, {
      teamId: team._id
    });

    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: `✏️ ${player.name} updated: ${oldTeamName || 'N/A'} → ${team.name}, ₹${oldPrice.toLocaleString()} → ₹${priceValue.toLocaleString()}`,
      type: 'status',
      meta: {
        playerId: player._id,
        oldTeamId,
        newTeamId: team._id,
        oldPrice,
        newPrice: priceValue
      }
    });
    await tournament.save();

    if (io) {
      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: `✏️ ${player.name} updated: ${oldTeamName || 'N/A'} → ${team.name}, ₹${oldPrice.toLocaleString()} → ₹${priceValue.toLocaleString()}`
      });
    }

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error updating sold player');
  }
});

// Start Round 2 (Re-Auction)
router.post('/:tournamentCode/start-round-2', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    if (tournament.auctionState.status !== 'Completed') {
      const error = new Error('Auction must be completed before starting Round 2');
      error.status = 400;
      throw error;
    }

    const pendingAndUnsold = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: { $in: ['Pending', 'Unsold'] }
    });

    if (pendingAndUnsold.length === 0) {
      const error = new Error('No pending or unsold players available for Round 2');
      error.status = 400;
      throw error;
    }

    // Reset players to Available for Round 2
    await Player.updateMany(
      {
        tournamentCode: tournament.code,
        auctionStatus: { $in: ['Pending', 'Unsold'] }
      },
      {
        $set: {
          auctionStatus: 'Available',
          currentBid: 0,
          currentBidTeam: null,
          currentBidTeamName: null,
          bidHistory: [],
          pendingAt: null,
          unsoldAt: null,
          lastAuctionEventAt: new Date()
        }
      }
    );

    tournament.auctionState.status = 'Running';
    tournament.auctionState.stage = 'Initialize';
    tournament.auctionState.currentRound = 2;
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.lastBidTeamId = null;
    tournament.auctionState.pendingPlayers = [];
    tournament.auctionState.lastActionAt = new Date();
    tournament.auctionState.lastStartedAt = new Date();
    appendAuctionLog(tournament, {
      message: `🔄 Round 2 started with ${pendingAndUnsold.length} players from pending/unsold pool`,
      type: 'status',
      meta: { round: 2, playersCount: pendingAndUnsold.length }
    });

    await tournament.save();

    broadcastEvent('auction:start', tournament.code, {
      status: 'Running',
      round: 2
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error starting Round 2');
  }
});

// Unlock auction access
router.post('/:tournamentCode/unlock', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    checkAuctionEnabled(tournament);

    tournament.auctionState.isLocked = false;
    tournament.auctionState.lastActionAt = new Date();
    appendAuctionLog(tournament, {
      message: 'Auction access unlocked - All users can now view',
      type: 'status'
    });
    await tournament.save();

    broadcastEvent('auction:unlocked', tournament.code, {
      message: 'Auction access unlocked'
    });

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error unlocking auction');
  }
});

router.post('/:tournamentCode/end', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    // Note: Ending auction is allowed even when disabled, as it's a cleanup action
    const previousStatus = tournament.auctionState?.status || 'NotStarted';

    const pendingPlayers = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Pending'
    }).select('_id name');

    const now = new Date();
    let pendingConvertedToUnsold = 0;
    if (pendingPlayers.length > 0) {
      pendingConvertedToUnsold = pendingPlayers.length;
      await Player.updateMany(
        {
          tournamentCode: tournament.code,
          auctionStatus: 'Pending'
        },
        {
          $set: {
            auctionStatus: 'Unsold',
            unsoldAt: now,
            lastAuctionEventAt: now
          }
        }
      );
    }

    const currentRound = tournament.auctionState?.currentRound || 1;
    tournament.auctionState.status = 'Completed';
    tournament.auctionState.stage = 'Finalizing';
    tournament.auctionState.currentPlayer = null;
    tournament.auctionState.currentBid = 0;
    tournament.auctionState.highestBidder = null;
    tournament.auctionState.highestBidderName = null;
    tournament.auctionState.pendingPlayers = [];
    tournament.auctionState.timerSeconds = 0;
    tournament.auctionState.lastActionAt = now;
    tournament.auctionState.completedAt = now;
    appendAuctionLog(tournament, {
      message: `🏁 Round ${currentRound} completed. ${pendingPlayers.length} pending players marked as unsold.`,
      type: 'status',
      meta: { round: currentRound, pendingCount: pendingPlayers.length }
    });

    const teamSnapshots = await computeTeamSnapshots(tournament);
    await persistTeamBalances(teamSnapshots);

    const completionSummary = await buildCompletionSummary(tournament, {
      pendingConvertedToUnsold
    });
    tournament.auctionState.completedSummary = completionSummary;
    tournament.auctionStatus = 'Completed';
    tournament.auctionEndedAt = now;
    tournament.markModified('auctionState');

    // Set auto-delete date if auto-delete is enabled
    const SystemSettings = require('../models/SystemSettings');
    const systemSettings = await SystemSettings.getSettings();
    
    // Determine if auto-delete should be enabled for this tournament
    let shouldAutoDelete = false;
    let daysToUse = null;
    
    if (tournament.autoDeleteEnabled === false) {
      // Tournament explicitly disabled auto-delete
      shouldAutoDelete = false;
    } else if (tournament.autoDeleteEnabled === true) {
      // Tournament explicitly enabled auto-delete
      shouldAutoDelete = true;
      daysToUse = tournament.autoDeleteDays || systemSettings.autoDeleteDays;
    } else if (systemSettings.autoDeleteEnabled) {
      // Use system setting
      shouldAutoDelete = true;
      daysToUse = systemSettings.autoDeleteDays;
    }
    
    if (shouldAutoDelete && daysToUse) {
      const deleteDate = new Date(now);
      deleteDate.setDate(deleteDate.getDate() + daysToUse);
      tournament.autoDeleteAt = deleteDate;
    } else {
      tournament.autoDeleteAt = null;
    }

    let reportPath = null;
    try {
      reportPath = await generateAuctionReport(tournament.code);
      tournament.auctionState.reportPdf = reportPath;
    } catch (reportErr) {
      appendAuctionLog(tournament, {
        message: `⚠️ Failed to generate auction report: ${reportErr.message}`,
        type: 'error'
      });
    }

    tournament.status = 'Completed';
    await tournament.save();

    await logAuditEvent({
      action: 'auction:end',
      entityType: 'Tournament',
      entityId: tournament._id,
      entityName: tournament.name,
      tournamentCode: tournament.code,
      user: req.user,
      changes: {
        auctionStatus: { from: previousStatus, to: 'Completed' },
        pendingPlayersConverted: pendingConvertedToUnsold
      },
      metadata: {
        summary: completionSummary,
        reportGenerated: Boolean(reportPath)
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    broadcastEvent('auction:end', tournament.code, {
      message: 'Auction completed successfully!',
      pendingConvertedToUnsold,
      summary: completionSummary,
      completedAt: now,
      reportPdf: tournament.auctionState?.reportPdf || null
    });
    
    // Multi-screen sync for auction end
    if (io) {
      io.to(`display:${tournament.code}`).emit('sync:display', {
        type: 'end',
        tournamentCode: tournament.code,
        currentPlayer: null,
        currentBid: 0,
        leadingTeam: null,
        timer: 0
      });
      
      io.to(`display:${tournament.code}`).emit('commentary:update', {
        tournamentCode: tournament.code,
        text: '🏁 Auction completed! See final results at PlayLive.com'
      });
    }

    res.json(await buildAuctionStatusPayload(tournament));
  } catch (error) {
    handleRouteError(res, error, 'Error ending auction');
  }
});

router.get('/:tournamentCode/report', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournament = await Tournament.findOne({ code: req.params.tournamentCode });
    if (!tournament || !tournament.auctionState?.reportPdf) {
      const error = new Error('Auction report not available');
      error.status = 404;
      throw error;
    }

    const reportPath = path.join(__dirname, '..', tournament.auctionState.reportPdf);
    if (!fs.existsSync(reportPath)) {
      const error = new Error('Report file missing');
      error.status = 404;
      throw error;
    }

    res.download(reportPath, path.basename(reportPath));
  } catch (error) {
    handleRouteError(res, error, 'Unable to download report');
  }
});

// Legacy/public spectator endpoints (updated for new statuses)
router.get('/summary/:tournamentCode', authenticateToken, async (req, res) => {
  try {
    const totalPlayers = await Player.countDocuments({ tournamentCode: req.params.tournamentCode });
    const auctioned = await Player.countDocuments({
      tournamentCode: req.params.tournamentCode,
      auctionStatus: { $in: ['Sold', 'Unsold'] }
    });
    const remaining = totalPlayers - auctioned;

    const soldPlayers = await Player.find({
      tournamentCode: req.params.tournamentCode,
      auctionStatus: 'Sold'
    }).populate('soldTo');
    const teamSpends = {};
    soldPlayers.forEach((player) => {
      const teamName = player.soldToName || player.soldTo?.name || 'Unknown';
      teamSpends[teamName] = (teamSpends[teamName] || 0) + (player.soldPrice || 0);
    });

    const topBidders = Object.entries(teamSpends)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    res.json({ success: true, summary: { totalPlayers, auctioned, remaining, topBidders } });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching summary');
  }
});

router.get('/records/:tournamentCode', authenticateToken, async (req, res) => {
  try {
    const players = await Player.find({
      tournamentCode: req.params.tournamentCode,
      auctionStatus: { $in: ['Sold', 'Unsold'] }
    }).populate('soldTo');
    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching records');
  }
});

router.get('/live/:tournamentCode', async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ code: req.params.tournamentCode });
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if auction is locked - if so, return locked status for public viewers
    if (tournament.auctionState?.isLocked) {
      // Allow public view if explicitly requested (for public display page)
      // But restrict socket access via server.js
      // For now, allow read-only access but show locked status
    }

    const currentPlayer = tournament.auctionState?.currentPlayer
      ? await Player.findById(tournament.auctionState.currentPlayer).lean()
      : null;

    const auctionStatus = tournament.auctionStatus || tournament.auctionState?.status || 'NotStarted';
    const currentBid = tournament.auctionState?.currentBid || 0;
    const highestBidderName = tournament.auctionState?.highestBidderName || null;

    res.json({
      success: true,
      tournament: {
        name: tournament.name,
        sport: tournament.sport,
        code: tournament.code,
        maxPlayers: tournament.maxPlayers,
        auctionAdvancedSettings: tournament.auctionAdvancedSettings || {},
        auctionRules: tournament.auctionRules || {}
      },
      currentPlayer,
      auctionStatus,
      currentBid,
      highestBidderName,
      isLocked: tournament.auctionState?.isLocked || false,
      auctionEndedAt: tournament.auctionEndedAt || tournament.auctionState?.completedAt || null,
      completionSummary: tournament.auctionState?.completedSummary || null
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching live auction data');
  }
});

router.get('/live-teams/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const teams = await computeTeamSnapshots(tournament);
    res.json({ success: true, teams });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching teams');
  }
});

router.get('/live-summary/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);

    const totalPlayers = await Player.countDocuments({ tournamentCode: tournament.code });
    const auctioned = await Player.countDocuments({
      tournamentCode: tournament.code,
      auctionStatus: { $in: ['Sold', 'Unsold'] }
    });
    const remaining = totalPlayers - auctioned;
    const unsold = await Player.countDocuments({
      tournamentCode: tournament.code,
      auctionStatus: 'Unsold'
    });
    const pending = await Player.countDocuments({
      tournamentCode: tournament.code,
      auctionStatus: 'Pending'
    });

    const soldPlayers = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Sold'
    }).populate('soldTo');
    const teamSpends = {};
    soldPlayers.forEach((player) => {
      const teamName = player.soldToName || player.soldTo?.name || 'Unknown';
      teamSpends[teamName] = (teamSpends[teamName] || 0) + (player.soldPrice || 0);
    });

    const topBidders = Object.entries(teamSpends)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const mostExpensivePlayer = soldPlayers
      .filter((p) => typeof p.soldPrice === 'number')
      .sort((a, b) => b.soldPrice - a.soldPrice)[0];

    const lastSoldPlayer = soldPlayers
      .filter((p) => p.soldAt)
      .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))[0];

    const nextPlayer = await Player.findOne({
      tournamentCode: tournament.code,
      auctionStatus: 'Available'
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      summary: {
        totalPlayers,
        auctioned,
        remaining,
        unsold,
        pending,
        topBidders,
        mostExpensivePlayer: mostExpensivePlayer
          ? {
              name: mostExpensivePlayer.name,
              soldPrice: mostExpensivePlayer.soldPrice,
              soldToName: mostExpensivePlayer.soldToName
            }
          : null,
        lastSoldPlayer: lastSoldPlayer
          ? {
              _id: lastSoldPlayer._id,
              name: lastSoldPlayer.name,
              playerId: lastSoldPlayer.playerId,
              photo: lastSoldPlayer.photo,
              role: lastSoldPlayer.role,
              city: lastSoldPlayer.city,
              soldPrice: lastSoldPlayer.soldPrice,
              soldTo: lastSoldPlayer.soldTo?._id || lastSoldPlayer.soldTo,
              soldToName: lastSoldPlayer.soldToName,
              soldAt: lastSoldPlayer.soldAt,
              basePrice: lastSoldPlayer.basePrice
            }
          : null,
        nextPlayerUp: nextPlayer
          ? {
              name: nextPlayer.name,
              role: nextPlayer.role
            }
          : null
      }
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching summary');
  }
});

router.get('/live-history/:tournamentCode', async (req, res) => {
  try {
    const players = await Player.find({
      tournamentCode: req.params.tournamentCode,
      auctionStatus: { $in: ['Sold', 'Unsold'] }
    })
      .populate('soldTo')
      .sort({ updatedAt: -1 });
      // Removed .limit(10) to show all players

    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching history');
  }
});

router.get('/live-team-details/:tournamentCode/:teamId', async (req, res) => {
  try {
    const { tournamentCode, teamId } = req.params;

    const team = await Team.findById(teamId);
    if (!team || team.tournamentCode !== tournamentCode) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const playersBought = await Player.find({
      tournamentCode,
      soldTo: teamId,
      auctionStatus: 'Sold'
    }).sort({ soldAt: -1 });

    const tournament = await Tournament.findOne({ code: tournamentCode });
    const totalSpent = playersBought.reduce((sum, player) => sum + (player.soldPrice || 0), 0);
    const budgetUsed = totalSpent;
    
    // Get budget from team or tournament
    const teamBudget = team.budget > 0 ? team.budget : (tournament?.auctionRules?.maxFundForTeam || 0);
    const budgetBalance = Math.max(0, teamBudget - budgetUsed);
    const playersCount = playersBought.length;
    const highestBid = playersBought.length > 0 ? Math.max(...playersBought.map((p) => p.soldPrice || 0)) : 0;
    const avgPrice = playersCount > 0 ? totalSpent / playersCount : 0;
    
    // Calculate max possible bid
    const basePrice = tournament?.basePrice || tournament?.auctionRules?.baseValueOfPlayer || 0;
    const maxPlayers = tournament?.maxPlayers || 16;
    const remainingPlayers = Math.max(0, maxPlayers - playersCount);
    const maxPossibleBid = remainingPlayers > 0
      ? Math.max(0, budgetBalance - ((remainingPlayers - 1) * basePrice))
      : 0;

    const playersByRole = {};
    playersBought.forEach((player) => {
      const role = player.role || 'Unknown';
      playersByRole[role] = (playersByRole[role] || 0) + 1;
    });

    const recentPurchases = playersBought.slice(0, 5);

    res.json({
      success: true,
      team: {
        _id: team._id,
        name: team.name,
        maxPlayers: maxPlayers,
        logo: team.logo,
        owner: team.owner,
        budget: teamBudget,
        budgetUsed,
        budgetBalance,
        playersBought: playersCount,
        highestBid,
        maxBid: maxPossibleBid,
        maxPossibleBid,
        totalSpent,
        avgPrice,
        playersByRole,
        recentPurchases
      },
      players: playersBought
    });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching team details');
  }
});

// Unsold List Endpoint
router.get('/live-unsold/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const players = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Unsold'
    })
      .select('_id playerId name role basePrice unsoldAt photo city bidHistory')
      .sort({ unsoldAt: -1 })
      .lean();

    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching unsold players');
  }
});

// Pending List Endpoint
router.get('/live-pending/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const players = await Player.find({
      tournamentCode: tournament.code,
      auctionStatus: 'Pending'
    })
      .select('_id playerId name role basePrice currentBid pendingAt photo city bidHistory currentBidTeamName')
      .sort({ pendingAt: 1, name: 1 })
      .lean();

    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching pending players');
  }
});

// Total List Endpoint
router.get('/live-total/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    const players = await Player.find({
      tournamentCode: tournament.code
    })
      .select('_id playerId name role basePrice auctionStatus photo city soldPrice soldToName soldAt unsoldAt pendingAt withdrawnAt registeredAt bidHistory currentBid currentBidTeamName')
      .sort({ registeredAt: 1, createdAt: 1 })
      .lean();

    res.json({ success: true, players });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching total players');
  }
});

// Bidwise List Endpoint
router.get('/live-bidwise/:tournamentCode', async (req, res) => {
  try {
    const tournament = await findTournamentByCode(req.params.tournamentCode);
    
    // Find all players that have bids (currentBid > 0 or bidHistory.length > 0)
    const allPlayers = await Player.find({
      tournamentCode: tournament.code,
      $or: [
        { currentBid: { $gt: 0 } },
        { 'bidHistory.0': { $exists: true } }
      ]
    })
      .select('_id playerId name role basePrice currentBid auctionStatus photo city bidHistory currentBidTeamName soldPrice soldToName')
      .lean();

    // Calculate highest bid for each player and sort by it
    const playersWithHighestBid = allPlayers.map(player => {
      let highestBid = player.currentBid || 0;
      
      if (player.bidHistory && player.bidHistory.length > 0) {
        const maxBidFromHistory = Math.max(
          ...player.bidHistory.map(bid => bid.bidAmount || 0)
        );
        highestBid = Math.max(highestBid, maxBidFromHistory);
      }
      
      return {
        ...player,
        highestBid
      };
    });

    // Sort by highest bid descending
    playersWithHighestBid.sort((a, b) => b.highestBid - a.highestBid);

    res.json({ success: true, players: playersWithHighestBid });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching bidwise players');
  }
});

router.post('/:tournamentCode/ui-events', authenticateToken, async (req, res) => {
  try {
    ensureTournamentAdmin(req);
    const tournamentCode = req.params.tournamentCode;
    const tournament = await findTournamentByCode(tournamentCode);
    const { event, experience, ...metadata } = req.body || {};

    if (!event) {
      return res.status(400).json({ success: false, message: 'event is required' });
    }

    await logAuditEvent({
      action: `ui:${event}`,
      entityType: 'AuctionUI',
      entityId: tournament._id,
      entityName: tournament.name,
      tournamentCode,
      user: req.user,
      metadata: {
        experience: experience || 'unknown',
        ...metadata
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error, 'Unable to log UI event');
  }
});

module.exports = { router, setIo };

