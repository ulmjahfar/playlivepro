import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-team-register.css';

function TeamRegister() {
  const { tournamentCode } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    captainName: '',
    mobile: '',
    email: '',
    city: '',
    numberOfPlayers: '',
    guestPlayers: []
  });
  const [countryCode] = useState('+91'); // Fixed country code
  const [logoPath, setLogoPath] = useState('');
  const [guestPhotoUrls, setGuestPhotoUrls] = useState([]);
  const [errors, setErrors] = useState({});
  const [teamCapacity, setTeamCapacity] = useState({ filled: 0, limit: null });
  const [teamCapacityLoading, setTeamCapacityLoading] = useState(true);

  const parseTeamLimit = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
  };

  const fetchTournament = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tournaments/${tournamentCode}`);
      const tournamentData = response.data.tournament;
      setTournament(tournamentData);
      // Set numberOfPlayers to tournament maxPlayers automatically
      if (tournamentData && tournamentData.maxPlayers) {
        setFormData((prev) => ({
          ...prev,
          numberOfPlayers: tournamentData.maxPlayers.toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
      alert('Tournament not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [tournamentCode, navigate]);

  const fetchTeamCapacity = useCallback(async () => {
    if (!tournament) return;
    try {
      setTeamCapacityLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/teams/${tournamentCode}`);
      const teams = Array.isArray(response.data?.teams) ? response.data.teams : [];
      setTeamCapacity({
        filled: teams.length,
        limit: parseTeamLimit(tournament.participatingTeams)
      });
    } catch (error) {
      console.error('Error fetching team slots:', error);
    } finally {
      setTeamCapacityLoading(false);
    }
  }, [tournamentCode, tournament]);

  // Ensure scrolling works on this page
  useEffect(() => {
    // Add class to body/html to enable scrolling
    document.body.classList.add('team-register-page-active');
    document.documentElement.classList.add('team-register-page-active');
    
    // Ensure body/html can scroll
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.height = 'auto';
    
    return () => {
      // Cleanup on unmount
      document.body.classList.remove('team-register-page-active');
      document.documentElement.classList.remove('team-register-page-active');
      document.body.style.overflowY = '';
      document.body.style.height = '';
      document.documentElement.style.overflowY = '';
      document.documentElement.style.height = '';
    };
  }, []);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  useEffect(() => {
    if (!tournament) return;
    fetchTeamCapacity();
  }, [tournament, fetchTeamCapacity]);

  const capitalizeName = (str) => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'name') {
      processedValue = value.toUpperCase();
    } else if (name === 'captainName' || name === 'city') {
      processedValue = capitalizeName(value);
    } else if (name === 'mobile') {
      // Only allow digits, max 10 digits
      processedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const addGuestPlayer = () => {
    if (formData.guestPlayers.length >= 2) {
      alert('Maximum 2 guest players allowed');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      guestPlayers: [...prev.guestPlayers, { name: '', role: '' }]
    }));
    setGuestPhotoUrls((prev) => [...prev, '']);
  };

  const updateGuestPlayer = (index, field, value) => {
    const updatedGuests = [...formData.guestPlayers];
    updatedGuests[index][field] = field === 'name' ? capitalizeName(value) : value;
    setFormData((prev) => ({ ...prev, guestPlayers: updatedGuests }));
  };

  const removeGuestPlayer = (index) => {
    setFormData((prev) => ({
      ...prev,
      guestPlayers: prev.guestPlayers.filter((_, i) => i !== index)
    }));
    setGuestPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGuestPhotoChange = (index, url) => {
    setGuestPhotoUrls((prev) => {
      const next = [...prev];
      next[index] = url || '';
      return next;
    });
  };

  const validateForm = () => {
    if (!tournament) return false;

    const newErrors = {};

    if (!formData.name || formData.name !== formData.name.toUpperCase() || formData.name.length < 3) {
      newErrors.name = 'Team name must be uppercase and at least 3 characters.';
    }

    // Captain/Manager is optional - only validate format if provided
    if (formData.captainName && formData.captainName.trim().length < 2) {
      newErrors.captainName = 'Captain name must be at least 2 characters if provided.';
    }

    // Mobile is optional - only validate format if provided
    if (formData.mobile && formData.mobile.trim() !== '') {
      const mobileRegex = /^[6-9]\d{9}$/;
      if (!mobileRegex.test(formData.mobile)) {
        newErrors.mobile = 'Enter valid 10-digit mobile number.';
      }
    }

    // Email is optional - only validate format if provided
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Enter a valid email address.';
      }
    }

    if (!formData.city) {
      newErrors.city = 'City is required.';
    }

    const numPlayers = parseInt(formData.numberOfPlayers, 10);
    if (!numPlayers || numPlayers !== tournament.maxPlayers) {
      newErrors.numberOfPlayers = `Number of players must be ${tournament.maxPlayers} (tournament maximum).`;
    }

    if (!logoPath) {
      newErrors.logo = 'Team logo is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check if registration is disabled or limit is reached
    if (!tournament.teamRegistrationEnabled) {
      alert('Team registration is closed for this tournament.');
      return;
    }
    const teamLimit = parseTeamLimit(tournament.participatingTeams);
    if (teamLimit && teamCapacity.filled >= teamLimit) {
      alert('Team registration slots are full for this tournament.');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'guestPlayers') {
          submitData.append(key, JSON.stringify(formData[key]));
        } else if (key === 'mobile') {
          // Only append mobile if provided, otherwise send empty string
          if (formData.mobile && formData.mobile.trim() !== '') {
            submitData.append(key, `${countryCode}${formData.mobile}`);
          } else {
            submitData.append(key, '');
          }
        } else {
          // Append all fields (empty strings for optional fields are fine)
          submitData.append(key, formData[key] || '');
        }
      });
      submitData.append('teamIcons', JSON.stringify([]));

      if (logoPath) {
        submitData.append('logoPath', logoPath);
      }
      if (guestPhotoUrls.length) {
        submitData.append('guestPhotoUrls', JSON.stringify(guestPhotoUrls));
      } else {
        submitData.append('guestPhotoUrls', JSON.stringify([]));
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/teams/register/${tournamentCode}`,
        submitData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      navigate(`/team-registration-success/${response.data.teamId}`);
    } catch (error) {
      console.error('Registration error:', error);
      alert(error.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!tournament) return <div className="error">Tournament not found</div>;

  const teamLimit = teamCapacity.limit ?? parseTeamLimit(tournament.participatingTeams);
  const isTeamCapacityReached = Boolean(teamLimit) && teamCapacity.filled >= teamLimit;
  const isRegistrationDisabled = !tournament.teamRegistrationEnabled || isTeamCapacityReached;
  return (
    <div className="team-register-page">
      <div className="simple-register-container">
        <div className="form-header">
          {tournament.logo && (
            <div className="tournament-logo-container">
              <img 
                src={`${API_BASE_URL}/${tournament.logo}`} 
                alt={tournament.name} 
                className="tournament-logo"
              />
            </div>
          )}
          <div className="header-content">
            <h1 className="simple-title">Team Registration</h1>
            <h2 className="simple-subtitle">{tournament.name}</h2>
            {tournament.location && (
              <p className="tournament-location">📍 {tournament.location}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="simple-form">
          {/* Registration Status Banner */}
          {(teamLimit || !tournament.teamRegistrationEnabled) && (
            <div
              className={`registration-status-banner ${isRegistrationDisabled ? 'status-full' : 'status-available'}`}
              role="alert"
            >
              <div className="status-content">
                <div className="status-icon">
                  {isRegistrationDisabled ? '🔒' : '✅'}
                </div>
                <div className="status-text">
                  <strong>
                    {isRegistrationDisabled 
                      ? (!tournament.teamRegistrationEnabled ? 'Registration Closed' : 'Registration Full')
                      : 'Registration Open'}
                  </strong>
                  <span>
                    {teamCapacityLoading
                      ? 'Checking availability...'
                      : teamLimit
                        ? `${teamCapacity.filled} of ${teamLimit} teams registered`
                        : 'Team registration is currently disabled'}
                  </span>
                  {isRegistrationDisabled && (
                    <span className="status-warning">
                      {!tournament.teamRegistrationEnabled
                        ? 'Team registration has been closed for this tournament.'
                        : 'All team slots have been filled. Registration is now closed.'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <fieldset disabled={submitting || isRegistrationDisabled} className="form-fieldset" style={{ border: 'none', padding: 0, margin: 0 }}>
          <div className="form-group">
            <label htmlFor="teamName">Team Name</label>
            <input
              id="teamName"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="TEAM NAME"
              style={{ textTransform: 'uppercase' }}
              required
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Team Logo</label>
            <ImageUploadCrop
              uploadType="teamLogo"
              aspect={1}
              uploadPath={`${API_BASE_URL}/api/teams/upload-logo`}
              placeholder="Upload team logo"
              maxSizeMB={1}
              onComplete={(url) => {
                setLogoPath(url);
                if (errors.logo) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.logo;
                    return next;
                  });
                }
              }}
              onError={(message) => {
                setLogoPath('');
                setErrors((prev) => ({ ...prev, logo: message || 'Failed to upload logo.' }));
              }}
            />
            {errors.logo && <span className="field-error">{errors.logo}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="captainName">Captain / Manager <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Optional)</span></label>
            <input
              id="captainName"
              type="text"
              name="captainName"
              value={formData.captainName}
              onChange={handleInputChange}
              placeholder="Captain name"
            />
            {errors.captainName && <span className="field-error">{errors.captainName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="mobileNumber">Mobile Number <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Optional)</span></label>
            <div className="phone-input-container">
              <span className="country-code-display">
                {countryCode}
              </span>
              <input
                id="mobileNumber"
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                placeholder="9876543210"
                maxLength="10"
                style={{ flex: 1 }}
              />
            </div>
            {errors.mobile && <span className="field-error">{errors.mobile}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="emailAddress">Email <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Optional)</span></label>
            <input
              id="emailAddress"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="email@example.com"
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              id="city"
              type="text"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="City"
              required
            />
            {errors.city && <span className="field-error">{errors.city}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="numberOfPlayers">Number of Players</label>
            <div className="fixed-value-display">
              <span className="fixed-value">{tournament.maxPlayers}</span>
              <span className="fixed-value-label">Maximum players per team</span>
            </div>
            <input
              type="hidden"
              name="numberOfPlayers"
              value={tournament.maxPlayers}
            />
            {errors.numberOfPlayers && <span className="field-error">{errors.numberOfPlayers}</span>}
          </div>

          {/* Guest Players Section */}
          <div className="guest-section">
            <div className="guest-section-header">
              <h3>Guest Players (Optional)</h3>
              {formData.guestPlayers.length < 2 && (
                <button type="button" onClick={addGuestPlayer} className="btn-add-guest">
                  + Add Guest
                </button>
              )}
            </div>

            {formData.guestPlayers.map((guest, index) => (
              <div key={index} className="guest-card">
                <div className="guest-card-header">
                  <h4>Guest {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => removeGuestPlayer(index)}
                    className="btn-remove-guest"
                  >
                    Remove
                  </button>
                </div>
                <div className="guest-fields">
                  <div className="form-group">
                    <label htmlFor={`guest-name-${index}`}>Name</label>
                    <input
                      id={`guest-name-${index}`}
                      type="text"
                      value={guest.name}
                      onChange={(e) => updateGuestPlayer(index, 'name', e.target.value)}
                      placeholder="Guest name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`guest-role-${index}`}>Role</label>
                    <select
                      id={`guest-role-${index}`}
                      value={guest.role}
                      onChange={(e) => updateGuestPlayer(index, 'role', e.target.value)}
                    >
                      <option value="">Select role</option>
                      <option value="Player">Player</option>
                      <option value="Coach">Coach</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Photo</label>
                  <ImageUploadCrop
                    uploadType={`guestPhoto${index + 1}`}
                    aspect={3 / 4}
                    uploadPath={`${API_BASE_URL}/api/teams/upload-photo`}
                    placeholder="Upload guest photo"
                    maxSizeMB={2}
                    onComplete={(url) => handleGuestPhotoChange(index, url)}
                    onError={() => handleGuestPhotoChange(index, '')}
                  />
                </div>
              </div>
            ))}
          </div>
          </fieldset>

          <button 
            type="submit" 
            disabled={submitting || isRegistrationDisabled} 
            className={`submit-btn ${isRegistrationDisabled ? 'btn-disabled' : ''}`}
          >
            {isRegistrationDisabled 
              ? (!tournament.teamRegistrationEnabled ? 'Registration Closed' : 'Registration Full')
              : submitting 
                ? 'Submitting...' 
                : 'Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TeamRegister;
