const TierConfig = require('../models/TierConfig');

/**
 * Resolve allowed features for a tournament based on tier defaults and overrides.
 * @param {import('../models/Tournament')} tournament
 * @returns {Promise<string[]>}
 */
async function resolveTournamentFeatures(tournament) {
  const plan = tournament.plan || 'Standard';
  const tierConfig = await TierConfig.findOne({ tier: plan });
  const defaultFeatures = tierConfig ? tierConfig.features : [];
  const resolved = new Set(defaultFeatures);

  const overrides = tournament.featureOverrides || {};
  if (overrides instanceof Map) {
    overrides.forEach((value, key) => {
      if (value === true) {
        resolved.add(key);
      } else if (value === false) {
        resolved.delete(key);
      }
    });
  } else {
    Object.entries(overrides).forEach(([featureId, isEnabled]) => {
      if (isEnabled === true) {
        resolved.add(featureId);
      } else if (isEnabled === false) {
        resolved.delete(featureId);
      }
    });
  }

  return Array.from(resolved);
}

/**
 * Determine if a user has access to a feature given the tournament and role.
 * @param {Object} params
 * @param {string} params.featureId
 * @param {string} params.userRole
 * @param {Object} params.tournament
 * @returns {Promise<boolean>}
 */
async function hasFeatureAccess({ featureId, userRole, tournament }) {
  if (userRole === 'SuperAdmin' || userRole === 'SUPER_ADMIN') {
    return true;
  }

  if (!tournament) {
    return false;
  }

  const overrides = tournament.featureOverrides || {};
  const overrideValue = overrides instanceof Map ? overrides.get(featureId) : overrides[featureId];
  if (overrideValue !== undefined) {
    return !!overrideValue;
  }

  const tierConfig = await TierConfig.findOne({ tier: tournament.plan || 'Standard' });
  if (!tierConfig) {
    return false;
  }

  return tierConfig.features.includes(featureId);
}

module.exports = {
  resolveTournamentFeatures,
  hasFeatureAccess
};



