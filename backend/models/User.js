const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plainPassword: { type: String }, // Store plain password for TournamentAdmin
  role: { type: String, enum: ['SuperAdmin', 'TournamentAdmin', 'TournamentManager', 'AuctionController', 'Player'], required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }, // For TournamentAdmin
  name: { type: String }, // Full name for TournamentAdmin
  mobile: { type: String }, // Mobile number for TournamentAdmin
  status: { type: String, enum: ['Active', 'Disabled', 'Pending', 'Suspended'], default: 'Active' }, // Status for TournamentAdmin
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  otp: { type: String },
  otpExpiry: { type: Date },
  passwordResetAt: { type: Date },
  disableReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
