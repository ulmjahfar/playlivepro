from pathlib import Path

path = Path(''frontend/src/TournamentNotifications.js'')
text = path.read_text()
text = text.replace('\r\n', '\n')

start_marker = "        <div className=\"notifications-content\" style={{ marginTop: '32px' }}>\n"
style_marker = "      <style>{`\n"
end_marker = "      `}</style>\n"

if start_marker not in text or style_marker not in text or end_marker not in text:
    raise SystemExit('Markers not found; aborting rewrite.')

start = text.index(start_marker)
style_start = text.index(style_marker, start)
style_end = text.index(end_marker, style_start) + len(end_marker)

new_block = '''        <div className="notifications-grid">
          <main className="notifications-main">
            <form onSubmit={handleSendNotification} className="notifications-form">
              <section className="notifications-card composer-card">
                <header className="card-header">
                  <div>
                    <p className="card-eyebrow">Message</p>
                    <h2>Compose your update</h2>
                    <p className="card-subtitle">{composerSubtitle}</p>
                  </div>
                  <div className="card-stat">
                    <span>Channel health</span>
                    <strong>{deliverabilityScore}% ready</strong>
                    <small>{activeChannel.ready} contacts available</small>
                  </div>
                </header>

                <div className="channel-switch">
                  {Object.values(channelConfig).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`channel-pill ${notificationForm.type === option.id ? 'active' : ''}`}
                      onClick={() => setNotificationForm(prev => ({ ...prev, type: option.id }))}
                    >
                      <span className="channel-pill__icon">{option.icon}</span>
                      <div className="channel-pill__copy">
                        <strong>{option.label}</strong>
                        <span>{option.caption}</span>
                      </div>
                      <span className="channel-pill__meta">
                        {option.ready}/{totalPlayers || 0} ready
                      </span>
                    </button>
                  ))}
                </div>

                <div className="composer-body">
                  <div className="composer-editor">
                    <div className="field-headline">
                      <label htmlFor="notification-message">Message content</label>
                      <span>{notificationForm.message.length} characters</span>
                    </div>
                    <textarea
                      id="notification-message"
                      name="message"
                      value={notificationForm.message}
                      onChange={handleFormChange}
                      required
                      rows="7"
                      placeholder="Type your update here... lead with the What, When, and Action needed."
                      className="textarea-modern composer-textarea"
                    />
                    <div className="template-grid">
                      {primaryTemplates.map((template) => (
                        <button
                          type="button"
                          key={template.id}
                          className="template-chip"
                          onClick={() => handleTemplateApply(template.body)}
                        >
                          <span className="template-chip__title">{template.title}</span>
                          <span className="template-chip__meta">{template.meta}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="composer-preview">
                    <p className="preview-label">
                      {notificationForm.type === 'email' ? 'Email preview' : 'WhatsApp preview'}
                    </p>
                    <div className={`preview-bubble preview-bubble--${activeChannel.tone}`}>
                      <div className="preview-bubble__header">
                        <span className="preview-channel-icon">{activeChannel.icon}</span>
                        <div>
                          <strong>{tournament.name}</strong>
                          <span>{notificationForm.type === 'email' ? 'via email' : 'via WhatsApp'}</span>
                        </div>
                      </div>
                      <p>{previewMessage}</p>
                    </div>
                    <div className="preview-meta">
                      <div>
                        <span>Estimated reach</span>
                        <strong>{selectedReachCount}</strong>
                        <small>{audienceScopeLabel}</small>
                      </div>
                      <div className="preview-meter">
                        <div
                          className="preview-meter__value"
                          style={{ width: `${deliverabilityScore}%` }}
                        />
                      </div>
                      <small>{deliverabilityScore}% of roster has valid contact for this channel</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="notifications-card audience-card">
                <header className="card-header">
                  <div>
                    <p className="card-eyebrow">Audience</p>
                    <h2>Choose recipients</h2>
                    <p className="card-subtitle">Blend full-roster blasts with curated groups.</p>
                  </div>
                  <div className="audience-metrics">
                    {audienceMetrics.map((metric) => (
                      <div key={metric.label} className="audience-metric">
                        <span>{metric label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                  </div>
                </header>

                <label className="audience-toggle">
                  <input
                    type="checkbox"
                    name="sendToAll"
                    checked={notificationForm.sendToAll}
                    onChange={handleFormChange}
                    className="modern-checkbox"
                  />
                  <span className="audience-toggle__control"></span>
                  <div className="audience-toggle__copy">
                    <strong>Send to every registered player</strong>
                    <span>{totalPlayers} players · {activeChannel.ready} contacts ready</span>
                  </div>
                </label>

                {!notificationForm.sendToAll && (
                  <div className="player-selection-section-modern">
                    <div className="player-selection-header-modern">
                      <div>
                        <h3>Select recipients</h3>
                        <p>Search, filter, and hand-pick the people to notify.</p>
                      </div>
                      <div className="selection-actions-modern">
                        <button
                          type="button"
                          onClick={selectAllPlayers}
                          className="action-btn-modern-notif"
                        >
                          <span>✓</span>
                          <span>Select All</span>
                        </button>
                        <button
                          type="button"
                          onClick={clearSelection}
                          className="action-btn-modern-notif"
                        >
                          <span>✕</span>
                          <span>Clear</span>
                        </button>
                        <div className="selection-badge-modern">
                          <span className="badge-count-modern">
                            {notificationForm.sendToAll ? totalPlayers : selectedPlayers.length}
                          </span>
                          <span>selected</span>
                        </div>
                      </div>
                    </div>

                    <div className="player-search-wrapper-modern">
                      <span className="search-icon-modern">🔍</span>
                      <input
                        type="text"
                        placeholder="Search by name, player ID, mobile number, or city..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input-modern"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="search-clear-modern"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="player-list-container-modern">
                      {filteredPlayers.length === 0 ? (
                        <div className="empty-player-list">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <p>No players found matching your search criteria.</p>
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="btn btn-secondary btn-sm"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <div className="player-list">
                          {filteredPlayers.map(player => {
