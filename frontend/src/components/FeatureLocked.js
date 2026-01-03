import React from 'react';
import '../styles-dashboard.css';

const FeatureLocked = ({ name, plan }) => (
  <div className="feature-locked-card">
    <div className="feature-locked-icon">🔒</div>
    <div className="feature-locked-content">
      <h4>{name || 'Feature unavailable'}</h4>
      <p>
        This feature is not included in your current plan
        {plan ? ` (${plan})` : ''}. Contact your Super Admin to upgrade or enable it.
      </p>
    </div>
  </div>
);

export default FeatureLocked;



