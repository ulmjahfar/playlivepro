const FeatureDefinition = require('../models/FeatureDefinition');
const TierConfig = require('../models/TierConfig');

const defaultFeatures = [
  {
    id: 'tournament_core',
    name: 'Tournament Creation & Management',
    defaultTier: 'Standard',
    category: 'TournamentManagement',
    description: 'Core scheduling, status, and structure controls.'
  },
  {
    id: 'registration_portal',
    name: 'Player & Team Registration',
    defaultTier: 'Standard',
    category: 'Registration',
    description: 'Access to online registration forms and roster management.'
  },
  {
    id: 'notifications_email',
    name: 'Email Notifications',
    defaultTier: 'Standard',
    category: 'Notifications',
    description: 'Basic email alerts for admins and players.'
  },
  {
    id: 'auction_live',
    name: 'Live Auction System',
    defaultTier: 'Standard',
    category: 'Auction',
    description: 'Conduct live auctions with bidding controls and dashboards.'
  },
  {
    id: 'reports_suite',
    name: 'PDF & Excel Reports',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Export rosters, auctions, and finance summaries.'
  },
  {
    id: 'finance_tracker',
    name: 'Finance Tracker',
    defaultTier: 'Standard',
    category: 'Finance',
    description: 'Budget tracking, payments, and ledger exports.'
  },
  {
    id: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    defaultTier: 'Standard',
    category: 'Analytics',
    description: 'Insights on registration, teams, and player performance.'
  },
  {
    id: 'broadcast_mode',
    name: 'Broadcast Mode',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'Multi-screen real-time scoreboard + display experiences.'
  },
  {
    id: 'notifications_whatsapp',
    name: 'WhatsApp Notifications',
    defaultTier: 'Standard',
    category: 'Notifications',
    description: 'Automated WhatsApp alerts for teams and organizers.'
  },
  {
    id: 'reports_whatsapp',
    name: 'WhatsApp Reports',
    defaultTier: 'Standard',
    category: 'Reports',
    description: 'Send event and auction reports via WhatsApp instantly.'
  },
  {
    id: 'branding_advanced',
    name: 'Advanced Branding Suite',
    defaultTier: 'Standard',
    category: 'Branding',
    description: 'Custom themes, sponsor overlays, and co-branding tools.'
  },
  {
    id: 'admin_automation',
    name: 'Automation Toolkit',
    defaultTier: 'Standard',
    category: 'AdminTools',
    description: 'Automate reminders, approvals, and data syncing.'
  },
  {
    id: 'voice_announcer',
    name: 'Voice & AI Announcer',
    defaultTier: 'Standard',
    category: 'Broadcast',
    description: 'AI-powered voiceovers and announcements.'
  },
  {
    id: 'auction_pro_remote_bidding',
    name: 'Auction Pro Remote Bidding',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Secure remote bidding console with seat-level authentication.'
  },
  {
    id: 'auction_pro_multi_seat',
    name: 'Multi-seat Team Console',
    defaultTier: 'AuctionPro',
    category: 'Auction',
    description: 'Coordinate multiple team members with voting workflows and overrides.'
  },
  {
    id: 'auction_pro_insights',
    name: 'Auction Pro Insights',
    defaultTier: 'AuctionPro',
    category: 'Analytics',
    description: 'Live voting telemetry, seat health, and consensus diagnostics.'
  }
];

const defaultTierMatrix = {
  Standard: [
    'tournament_core',
    'registration_portal',
    'notifications_email',
    'auction_live',
    'reports_suite',
    'finance_tracker',
    'analytics_dashboard',
    'tournament_core',
    'registration_portal',
    'notifications_email',
    'auction_live',
    'reports_suite',
    'finance_tracker',
    'analytics_dashboard',
    'broadcast_mode',
    'notifications_whatsapp',
    'reports_whatsapp',
    'branding_advanced',
    'admin_automation',
    'voice_announcer'
  ],
  AuctionPro: [
    'tournament_core',
    'registration_portal',
    'notifications_email',
    'auction_live',
    'reports_suite',
    'finance_tracker',
    'analytics_dashboard',
    'broadcast_mode',
    'notifications_whatsapp',
    'reports_whatsapp',
    'branding_advanced',
    'admin_automation',
    'voice_announcer',
    'auction_pro_remote_bidding',
    'auction_pro_multi_seat',
    'auction_pro_insights'
  ]
};

async function seedTierSystem() {
  for (const feature of defaultFeatures) {
    await FeatureDefinition.findOneAndUpdate(
      { id: feature.id },
      feature,
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  const featureMap = new Map(defaultFeatures.map((feature) => [feature.id, feature]));

  for (const [tier, features] of Object.entries(defaultTierMatrix)) {
    const filteredFeatures = features.filter((featureId) => featureMap.has(featureId));
    await TierConfig.findOneAndUpdate(
      { tier },
      {
        tier,
        features: filteredFeatures,
        metadata: {
          displayName: tier,
          description:
            tier === 'Standard'
              ? 'Premium broadcast, automation, and analytics package.'
              : 'Remote multi-seat bidding with consensus controls, telemetry, and pro tooling.'
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
}

module.exports = seedTierSystem;



