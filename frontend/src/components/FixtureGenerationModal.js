import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../utils/apiConfig';
import './FixtureGenerationModal.css';

function FixtureGenerationModal({ isOpen, onClose, tournamentCode, onFixturesGenerated }) {
  const [fixtureType, setFixtureType] = useState('straight');
  const [matchCount, setMatchCount] = useState('1');
  const [customMatchCount, setCustomMatchCount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (matchCount === 'custom' && (!customMatchCount || parseInt(customMatchCount) < 1)) {
      toast.error('Please enter a valid custom match count');
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        fixtureType,
        matchCount: matchCount === 'custom' ? 'custom' : matchCount
      };

      if (matchCount === 'custom') {
        payload.customMatchCount = parseInt(customMatchCount);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/fixtures/${tournamentCode}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate fixtures');
      }

      toast.success(data.message || 'Fixtures generated successfully!');
      onFixturesGenerated();
      onClose();
    } catch (error) {
      console.error('Error generating fixtures:', error);
      toast.error(error.message || 'Failed to generate fixtures');
    } finally {
      setIsGenerating(false);
    }
  };

  const fixtureTypeDescriptions = {
    straight: 'Uses group order exactly as stored. Pairs teams within same group first, then cycles through combinations.',
    mixed: 'Combines all teams from all groups. Shuffles teams randomly each cycle. Groups only provide team list.',
    'mixed-group': 'Cross-group matching. Never pairs same-group teams until all cross-group options are exhausted.',
    'within-group': 'Each group generates its own mini-league. Round Robin within each group if match count is Round Robin.'
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="fixture-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="fixture-modal-header">
          <h2>Generate Fixtures</h2>
          <button className="fixture-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="fixture-modal-body">
          {/* Section A: Fixture Type Selection */}
          <div className="fixture-section">
            <h3 className="fixture-section-title">A — Select Fixture Type</h3>
            <div className="fixture-options">
              <label className="fixture-option">
                <input
                  type="radio"
                  name="fixtureType"
                  value="straight"
                  checked={fixtureType === 'straight'}
                  onChange={(e) => setFixtureType(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Straight</span>
                  <span className="fixture-option-desc">Use group order</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="fixtureType"
                  value="mixed"
                  checked={fixtureType === 'mixed'}
                  onChange={(e) => setFixtureType(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Mixed</span>
                  <span className="fixture-option-desc">Ignore groups, shuffle</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="fixtureType"
                  value="mixed-group"
                  checked={fixtureType === 'mixed-group'}
                  onChange={(e) => setFixtureType(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Mixed-Group</span>
                  <span className="fixture-option-desc">Cross groups</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="fixtureType"
                  value="within-group"
                  checked={fixtureType === 'within-group'}
                  onChange={(e) => setFixtureType(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Within-Group</span>
                  <span className="fixture-option-desc">Group-wise league</span>
                </div>
              </label>
            </div>
            <p className="fixture-description">{fixtureTypeDescriptions[fixtureType]}</p>
          </div>

          {/* Section B: Match Count Selection */}
          <div className="fixture-section">
            <h3 className="fixture-section-title">B — Select Match Count</h3>
            <div className="fixture-options">
              <label className="fixture-option">
                <input
                  type="radio"
                  name="matchCount"
                  value="1"
                  checked={matchCount === '1'}
                  onChange={(e) => setMatchCount(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">1 Match per team</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="matchCount"
                  value="2"
                  checked={matchCount === '2'}
                  onChange={(e) => setMatchCount(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">2 Matches per team</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="matchCount"
                  value="3"
                  checked={matchCount === '3'}
                  onChange={(e) => setMatchCount(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">3 Matches per team</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="matchCount"
                  value="round-robin"
                  checked={matchCount === 'round-robin'}
                  onChange={(e) => setMatchCount(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Round Robin</span>
                  <span className="fixture-option-desc">Auto based on group size</span>
                </div>
              </label>

              <label className="fixture-option">
                <input
                  type="radio"
                  name="matchCount"
                  value="custom"
                  checked={matchCount === 'custom'}
                  onChange={(e) => setMatchCount(e.target.value)}
                />
                <div className="fixture-option-content">
                  <span className="fixture-option-label">Custom</span>
                  <span className="fixture-option-desc">Admin inputs number</span>
                </div>
              </label>
            </div>

            {matchCount === 'custom' && (
              <div className="custom-match-count-input">
                <label>
                  Number of matches per team:
                  <input
                    type="number"
                    min="1"
                    value={customMatchCount}
                    onChange={(e) => setCustomMatchCount(e.target.value)}
                    placeholder="Enter number"
                    className="custom-input"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="fixture-modal-footer">
          <button className="fixture-btn-secondary" onClick={onClose} disabled={isGenerating}>
            Cancel
          </button>
          <button 
            className="fixture-btn-primary" 
            onClick={handleGenerate}
            disabled={isGenerating || (matchCount === 'custom' && !customMatchCount)}
          >
            {isGenerating ? 'Generating...' : 'Generate Fixtures'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FixtureGenerationModal;

