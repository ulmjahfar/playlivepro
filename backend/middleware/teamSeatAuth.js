const jwt = require('jsonwebtoken');
const Team = require('../models/Team');

const buildUnauthorized = () => ({
  success: false,
  message: 'Seat authentication failed. Please login again.'
});

async function authenticateSeat(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body?.seatToken) {
      token = req.body.seatToken;
    }

    if (!token) {
      return res.status(401).json(buildUnauthorized());
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    if (payload.type !== 'TeamSeat') {
      return res.status(401).json(buildUnauthorized());
    }

    const team = await Team.findById(payload.teamMongoId).select('+seats +auctionAccessCode');
    if (!team || team.tournamentCode !== payload.tournamentCode) {
      return res.status(401).json(buildUnauthorized());
    }

    const seat = team.seats?.id(payload.seatMongoId);
    if (!seat || seat.status === 'Disabled') {
      return res.status(401).json(buildUnauthorized());
    }

    if ((seat.authVersion || 0) !== (payload.authVersion || 0)) {
      return res.status(401).json(buildUnauthorized());
    }

    req.seatAuth = {
      payload,
      team,
      seat
    };
    next();
  } catch (error) {
    console.error('Seat authentication error:', error);
    return res.status(401).json(buildUnauthorized());
  }
}

module.exports = {
  authenticateSeat
};






