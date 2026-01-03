const express = require('express');
const router = express.Router();
const FeatureDefinition = require('../models/FeatureDefinition');
const TierConfig = require('../models/TierConfig');
const { authenticateToken } = require('./authRoutes');

const ALLOWED_TIERS = ['Standard', 'AuctionPro'];

const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  return next();
};

// List all feature definitions
router.get('/definitions', authenticateToken, async (req, res) => {
  try {
    const features = await FeatureDefinition.find().sort({ category: 1, name: 1 }).lean();
    res.json({ success: true, features });
  } catch (error) {
    console.error('Error fetching feature definitions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feature definitions' });
  }
});

// Upsert feature definition
router.post('/definitions', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id, name, defaultTier, category, description } = req.body;
    if (!id || !name || !defaultTier || !category) {
      return res.status(400).json({ success: false, message: 'id, name, defaultTier, and category are required' });
    }

    if (!ALLOWED_TIERS.includes(defaultTier)) {
      return res.status(400).json({ success: false, message: `Invalid default tier: ${defaultTier}` });
    }

    const feature = await FeatureDefinition.findOneAndUpdate(
      { id },
      { id, name, defaultTier, category, description },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, feature });
  } catch (error) {
    console.error('Error upserting feature definition:', error);
    res.status(500).json({ success: false, message: 'Failed to upsert feature definition' });
  }
});

// Update feature definition
router.put('/definitions/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.defaultTier && !ALLOWED_TIERS.includes(updates.defaultTier)) {
      return res.status(400).json({ success: false, message: `Invalid default tier: ${updates.defaultTier}` });
    }

    const feature = await FeatureDefinition.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true }
    );

    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    res.json({ success: true, feature });
  } catch (error) {
    console.error('Error updating feature definition:', error);
    res.status(500).json({ success: false, message: 'Failed to update feature definition' });
  }
});

// List tier configurations
router.get('/tier-configs', authenticateToken, async (req, res) => {
  try {
    const tiers = await TierConfig.find().sort({ tier: 1 }).lean();
    res.json({ success: true, tiers });
  } catch (error) {
    console.error('Error fetching tier configs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tier configurations' });
  }
});

// Update tier configuration
router.put('/tier-configs/:tier', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const tierKey = req.params.tier;
    if (!ALLOWED_TIERS.includes(tierKey)) {
      return res.status(400).json({ success: false, message: `Invalid tier: ${tierKey}` });
    }

    const features = Array.isArray(req.body.features)
      ? req.body.features.filter(Boolean)
      : [];
    const metadata = req.body.metadata || {};

    const existingFeatures = await FeatureDefinition.find({ id: { $in: features } }).select('id');
    const validFeatureIds = new Set(existingFeatures.map((feature) => feature.id));
    const filteredFeatures = features.filter((featureId) => validFeatureIds.has(featureId));

    const tierConfig = await TierConfig.findOneAndUpdate(
      { tier: tierKey },
      { tier: tierKey, features: filteredFeatures, metadata },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, tierConfig });
  } catch (error) {
    console.error('Error updating tier configuration:', error);
    res.status(500).json({ success: false, message: 'Failed to update tier configuration' });
  }
});

module.exports = router;



