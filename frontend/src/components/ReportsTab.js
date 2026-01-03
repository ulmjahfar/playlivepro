import React, { useMemo } from 'react';
import './ReportsTab.css';

const ReportsTab = () => {
  const summaryCards = useMemo(
    () => [
      {
        label: 'Platform wide revenue',
        value: '₹3.2Cr',
        delta: '+12% QoQ',
        tone: 'success',
        hint: 'Combined ticketing & sponsorship inflow'
      },
      {
        label: 'Total participants',
        value: '18,420',
        delta: '+1,213 new this month',
        tone: 'info',
        hint: 'Players, managers & support staff'
      },
      {
        label: 'Ops SLA adherence',
        value: '97.4%',
        delta: '↓ 1.1% vs target',
        tone: 'warning',
        hint: 'Incidents resolved within defined cutoff'
      },
      {
        label: 'Compliance posture',
        value: '100%',
        delta: 'Audit ready',
        tone: 'success',
        hint: 'TDS, payouts & KYC renewals'
      }
    ],
    []
  );

  const intelligenceHighlights = useMemo(
    () => [
      {
        icon: '🛰️',
        title: 'Global operations pulse',
        description:
          '5 active tournaments, 11 onboarding, 4 pending approvals. Player churn lowest in quarter.'
      },
      {
        icon: '🧾',
        title: 'Financial governance',
        description:
          'Disbursement lag reduced to 36h average. 3 escalations flagged for manual review.'
      },
      {
        icon: '🛡️',
        title: 'Risk & compliance desk',
        description:
          'No open critical incidents. 8 KYCs expiring in < 7 days. Automated nudges scheduled.'
      }
    ],
    []
  );

  const scheduledReports = useMemo(
    () => [
      {
        name: 'Executive command pack',
        frequency: 'Daily • 07:30 AM IST',
        channels: ['Email', 'Slack'],
        owner: 'Auto-generated'
      },
      {
        name: 'Tournament financial close',
        frequency: 'Weekly • Fridays',
        channels: ['Email'],
        owner: 'Finance Ops'
      },
      {
        name: 'Ops SLA breach summary',
        frequency: 'Real-time alerts',
        channels: ['Slack', 'Pager'],
        owner: 'NOC Bot'
      }
    ],
    []
  );

  const coverageMatrix = useMemo(
    () => [
      {
        scope: 'Registrations & onboarding',
        status: 'Complete',
        detail: 'All sports, all cities synced',
        owner: 'Growth'
      },
      {
        scope: 'Auctions & budgets',
        status: 'In motion',
        detail: 'Awaiting final bid logs for 2 events',
        owner: 'Finance'
      },
      {
        scope: 'Disputes & resolutions',
        status: 'Needs attention',
        detail: '4 cases in arbitration beyond SLA',
        owner: 'Governance'
      },
      {
        scope: 'Broadcast & media',
        status: 'Complete',
        detail: 'OTT, highlights, social clips live',
        owner: 'Media Ops'
      }
    ],
    []
  );

  const upcomingMilestones = useMemo(
    () => [
      {
        label: 'Cricket Super League – budget sign-off',
        due: 'Due today',
        urgency: 'high'
      },
      {
        label: 'Q1 CFO review deck',
        due: 'Due in 2 days',
        urgency: 'medium'
      },
      {
        label: 'PAN India referees audit',
        due: 'Due in 6 days',
        urgency: 'low'
      }
    ],
    []
  );

  return (
    <div className="reports-tab">
      <section className="reports-hero surface-card">
        <div className="reports-hero__body">
          <span className="reports-hero__pill">📋 Superadmin Command Center</span>
          <h2>See the entire PlayLive operation in one glance</h2>
          <p>
            Monitor financials, participation, risk posture, and operational pulse across every
            tournament. Trigger deep-dive reports or download audits instantly.
          </p>
          <div className="reports-hero__actions">
            <button type="button" className="reports-primary">
              ⚡ Generate all-hands briefing
            </button>
            <button type="button" className="reports-secondary">
              ⬇️ Export compliance binder
            </button>
          </div>
        </div>
        <div className="reports-hero__summary">
          {summaryCards.map((card) => (
            <article key={card.label} className={`reports-metric reports-metric--${card.tone}`}>
              <span className="reports-metric__label">{card.label}</span>
              <span className="reports-metric__value">{card.value}</span>
              <span className="reports-metric__delta">{card.delta}</span>
              <span className="reports-metric__hint">{card.hint}</span>
            </article>
          ))}
        </div>
      </section>

      <div className="reports-layout">
        <main className="reports-main">
          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Intelligence</span>
                <h3>Executive signals</h3>
              </div>
              <button type="button" className="reports-link">
                View historical insights →
              </button>
            </header>
            <ul className="reports-intelligence">
              {intelligenceHighlights.map((item) => (
                <li key={item.title} className="reports-intelligence__item">
                  <span className="reports-intelligence__icon">{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Automation</span>
                <h3>Scheduled report packs</h3>
              </div>
              <button type="button" className="reports-link">
                Configure delivery →
              </button>
            </header>
            <div className="reports-schedule">
              {scheduledReports.map((report) => (
                <article key={report.name} className="reports-schedule__card">
                  <div className="reports-schedule__meta">
                    <strong>{report.name}</strong>
                    <span>{report.frequency}</span>
                  </div>
                  <div className="reports-schedule__channels">
                    {report.channels.map((channel) => (
                      <span key={channel}>{channel}</span>
                    ))}
                  </div>
                  <span className="reports-schedule__owner">{report.owner}</span>
                  <button type="button" className="reports-chip">
                    Send now
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Coverage</span>
                <h3>Data completeness tracker</h3>
              </div>
              <span className="reports-panel__meta">Refreshed 12 minutes ago</span>
            </header>
            <div className="reports-grid">
              {coverageMatrix.map((row) => (
                <article key={row.scope} className="reports-grid__row">
                  <div className="reports-grid__scope">
                    <strong>{row.scope}</strong>
                    <span>{row.detail}</span>
                  </div>
                  <span className={`reports-status reports-status--${row.status.replace(/\s+/g, '-').toLowerCase()}`}>
                    {row.status}
                  </span>
                  <span className="reports-grid__owner">{row.owner}</span>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="reports-side">
          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Action board</span>
                <h3>Upcoming milestones</h3>
              </div>
            </header>
            <ul className="reports-milestones">
              {upcomingMilestones.map((item) => (
                <li key={item.label} className={`reports-milestones__item reports-milestones__item--${item.urgency}`}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.due}</span>
                  </div>
                  <button type="button" className="reports-chip reports-chip--ghost">
                    Assign
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Self-serve</span>
                <h3>Generate instant reports</h3>
              </div>
            </header>
            <div className="reports-actions">
              <button type="button" className="reports-action">
                📄 Player onboarding ledger
              </button>
              <button type="button" className="reports-action">
                💳 Finance & payouts digest
              </button>
              <button type="button" className="reports-action">
                🛠 Ops escalation dossier
              </button>
              <button type="button" className="reports-action">
                📡 Broadcast analytics export
              </button>
            </div>
          </section>

          <section className="reports-panel surface-card">
            <header className="reports-panel__header">
              <div>
                <span className="reports-eyebrow">Sandbox</span>
                <h3>Build a custom query</h3>
              </div>
            </header>
            <form className="reports-form">
              <label className="reports-form__field">
                <span>Report focus</span>
                <select defaultValue="all">
                  <option value="all">All divisions</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                  <option value="compliance">Compliance</option>
                  <option value="engagement">Engagement</option>
                </select>
              </label>
              <label className="reports-form__field">
                <span>Date window</span>
                <input type="date" defaultValue="2025-01-01" />
              </label>
              <label className="reports-form__field">
                <span>Granularity</span>
                <div className="reports-toggle">
                  <button type="button" className="reports-toggle__option reports-toggle__option--active">
                    Weekly
                  </button>
                  <button type="button" className="reports-toggle__option">Monthly</button>
                  <button type="button" className="reports-toggle__option">Quarterly</button>
                </div>
              </label>
              <button type="button" className="reports-primary reports-primary--wide">
                🚀 Run custom report
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default ReportsTab;
