const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  autoDeleteEnabled: { type: Boolean, default: false },
  autoDeleteDays: { type: Number, default: 45, min: 7 }, // Minimum 7 days
  appLogo: { type: String }, // Path to app logo file
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      autoDeleteEnabled: false,
      autoDeleteDays: 45,
      appLogo: null
    });
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);



