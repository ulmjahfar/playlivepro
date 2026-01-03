import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import ImageUploadCrop from './components/ImageUploadCrop';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-player-register.css';
import html2canvas from 'html2canvas';

function PlayerRegister({ tournamentCode: propTournamentCode, adminMode = false, onSuccess }) {
  const { tournamentCode: paramTournamentCode } = useParams();
  const tournamentCode = propTournamentCode || paramTournamentCode;

  const [tournament, setTournament] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', city: '', role: '', remarks: '' });
  const [countryCode, setCountryCode] = useState('+91');
  const [confirmed, setConfirmed] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [cardUrl, setCardUrl] = useState('');
  const [photo, setPhoto] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [registeredPlayer, setRegisteredPlayer] = useState(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [realTimeErrors, setRealTimeErrors] = useState({});
  const [activeStep, setActiveStep] = useState(1);
  const [limitModal, setLimitModal] = useState(null);
  const [registrationStats, setRegistrationStats] = useState({ count: null, limit: null });
  const [statsLoading, setStatsLoading] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [isPhotoUploaded, setIsPhotoUploaded] = useState(false);

  const steps = ['Player Details', 'Review & Submit'];
  const stepsTotal = steps.length;

  const receiptInputRef = useRef(null);
  const receiptDropRef = useRef(null);
  const cardPreviewRef = useRef(null);

  const triggerFileDownload = useCallback((blob, filename) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const downloadCardAsImage = useCallback(async () => {
    if (!cardPreviewRef.current) return;
    try {
      const canvas = await html2canvas(cardPreviewRef.current, {
        backgroundColor: null,
        scale: window.devicePixelRatio < 2 ? 2 : window.devicePixelRatio,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: cardPreviewRef.current.offsetWidth,
        height: cardPreviewRef.current.offsetHeight,
        onclone: (clonedDoc) => {
          // Ensure all styles are preserved in the cloned document
          const clonedCard = clonedDoc.querySelector('.pl-player-card[data-custom-design="true"]');
          if (clonedCard) {
            // Force text-shadow to be computed and applied
            const textElements = clonedCard.querySelectorAll('[style*="textShadow"], [style*="text-shadow"]');
            textElements.forEach(el => {
              const computedStyle = window.getComputedStyle(el);
              if (computedStyle.textShadow && computedStyle.textShadow !== 'none') {
                el.style.textShadow = computedStyle.textShadow;
              }
            });
          }
        }
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            triggerFileDownload(blob, `${playerId}.jpg`);
          }
          resolve();
        }, 'image/jpeg', 0.92);
      });
    } catch (error) {
      console.error('Client-side JPG generation failed:', error);
      throw error;
    }
  }, [playerId, triggerFileDownload]);

  const handleDownloadCardJpg = useCallback(async () => {
    if (!playerId) {
      alert('Player ID is missing. Please refresh and try again.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/players/card-jpg/${playerId}`);
      if (!response.ok) {
        throw new Error('JPG not available');
      }
      const blob = await response.blob();
      triggerFileDownload(blob, `${playerId}.jpg`);
    } catch (error) {
      console.warn('Server JPG not available, falling back to client-side generation:', error);
      try {
        await downloadCardAsImage();
      } catch (fallbackError) {
        console.error('Failed to download JPG card', fallbackError);
        alert('Unable to download the JPG card right now. Please try again in a moment.');
      }
    }
  }, [playerId, triggerFileDownload, downloadCardAsImage]);

  const fetchTournament = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${tournamentCode}`);
      setTournament(res.data.tournament);
    } catch (err) {
      console.error(err);
      setMessage('❌ Tournament not found.');
    }
  }, [tournamentCode]);

  const fetchRegistrationStats = useCallback(async () => {
    if (!tournamentCode) return;
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/players/${tournamentCode}/count`);
      setRegistrationStats({
        count: typeof res.data.count === 'number' ? res.data.count : null,
        limit: typeof res.data.limit === 'number' ? res.data.limit : null
      });
    } catch (error) {
      console.error('Failed to load registration stats', error);
      setRegistrationStats((prev) => ({ ...prev, count: null }));
    } finally {
      setStatsLoading(false);
    }
  }, [tournamentCode]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  useEffect(() => {
    fetchRegistrationStats();
  }, [fetchRegistrationStats]);

  // Ensure scrolling works on this page
  useEffect(() => {
    // Add class to body/html to enable scrolling
    document.body.classList.add('player-register-page-active');
    document.documentElement.classList.add('player-register-page-active');
    
    // Ensure body/html can scroll
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflowY = 'auto';
    document.documentElement.style.height = 'auto';
    
    return () => {
      // Cleanup on unmount
      document.body.classList.remove('player-register-page-active');
      document.documentElement.classList.remove('player-register-page-active');
      document.body.style.overflowY = '';
      document.body.style.height = '';
      document.documentElement.style.overflowY = '';
      document.documentElement.style.height = '';
    };
  }, []);

  useEffect(() => {
    if (adminMode) {
      setConfirmed(true);
    }
  }, [adminMode]);

  const getRegistrationStatus = () => {
    if (!tournament) return 'Loading';

    const now = new Date();
    const start = tournament.registrationStartDate ? new Date(tournament.registrationStartDate) : null;
    const end = tournament.registrationEndDate ? new Date(tournament.registrationEndDate) : null;

    if (tournament.registrationStatus === 'Closed Early') {
      return 'Closed Early';
    }

    if (tournament.playerRegistrationEnabled) {
      // Manual overrides should take precedence, even if dates are outside the window.
      if (tournament.registrationStatus === 'Closed') {
        return 'Closed';
      }
      return 'Active';
    }

    if (tournament.registrationStatus === 'Closed') {
      return 'Closed';
    }

    if (tournament.registrationStatus === 'Not Started') {
      return 'Not Started';
    }

    if (start && now < start) {
      return 'Not Started';
    }

    if (end && now > end) {
      return 'Closed';
    }

    return 'Closed';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const processedValue = (name === 'name' || name === 'city') ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, [name]: processedValue }));
    validateField(name, processedValue);
  };

  const validateField = (name, value) => {
    const errors = { ...realTimeErrors };

    switch (name) {
      case 'name':
        if (!value.trim()) {
          errors.name = 'Name is required';
        } else if (value.length < 2) {
          errors.name = 'Name must be at least 2 characters';
        } else {
          delete errors.name;
        }
        break;
      case 'mobile': {
        const mobileRegex = /^\d{10}$/;
        if (!mobileRegex.test(value)) {
          errors.mobile = 'Enter valid 10-digit mobile number';
        } else {
          delete errors.mobile;
        }
        break;
      }
      case 'city':
        if (!value.trim()) {
          errors.city = 'City/Place is required';
        } else {
          delete errors.city;
        }
        break;
      case 'role':
        if (!value) {
          errors.role = 'Please select a role';
        } else {
          delete errors.role;
        }
        break;
      default:
        break;
    }

    setRealTimeErrors(errors);
  };

  const validateMobile = (mobile) => /^\d{10}$/.test(mobile);

  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) errors.name = 'Name is required';
    if (!validateMobile(form.mobile)) errors.mobile = 'Enter valid 10-digit mobile number';
    if (!form.city.trim()) errors.city = 'City/Place is required';
    if (!form.role) errors.role = 'Please select a role';
    if (!photo) errors.photo = 'Please upload a player photo';
    if (tournament?.paymentReceiptMandatory && !receipt) {
      errors.receipt = 'Payment receipt is required for this tournament';
    }

    setRealTimeErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleReceiptChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage('❌ File size exceeds 2MB limit.');
        return;
      }
      setReceipt(file);
      setReceiptPreview(file.name);
    }
  };

  const handleReceiptDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage('❌ File size exceeds 2MB limit.');
        return;
      }
      if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
        setMessage('❌ Only image files and PDFs are allowed.');
        return;
      }
      setReceipt(file);
      setReceiptPreview(file.name);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getRoleOptions = () => {
    if (!tournament) return [];
    if (tournament.sport === 'Cricket') return ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
    if (tournament.sport === 'Football') return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
    if (tournament.sport === 'Volleyball') return ['Setter', 'Attacker', 'Blocker', 'Libero'];
    if (tournament.sport === 'Basketball') return ['Point Guard', 'Center', 'Forward', 'Shooting Guard'];
    return [];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (activeStep !== stepsTotal) {
      if (validateStep(activeStep)) {
        setActiveStep(stepsTotal);
      }
      return;
    }

    if (!validateForm()) return;
    if (!confirmed) {
      setMessage('❌ Please confirm that the details are correct.');
      return;
    }

    setIsSubmitting(true);
    setShowUploadProgress(true);
    setUploadProgress(0);

    try {
      const data = new FormData();
      Object.keys(form).forEach((key) => data.append(key, form[key]));
      data.append('tournamentCode', tournamentCode);
      data.append('countryCode', countryCode);
      if (photo) data.append('photo', photo);
      if (receipt) data.append('receipt', receipt);

      const res = await axios.post(`${API_BASE_URL}/api/players/register`, data, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      setPlayerId(res.data.player.playerId);
      setCardUrl(res.data.cardUrl || '');
      setRegisteredPlayer(res.data.player);
      fetchRegistrationStats();
      if (adminMode && onSuccess) {
        onSuccess();
      } else {
        setShowSuccessModal(true);
      }
    } catch (err) {
      console.error(err);
      const apiMessage = err?.response?.data?.message;
      setMessage(apiMessage ? `❌ ${apiMessage}` : '❌ Error registering player. Please try again.');
      if (err?.response?.data?.code === 'PLAYER_LIMIT_REACHED') {
        fetchTournament();
        fetchRegistrationStats();
        setLimitModal({
          title: 'Registration Closed',
          message: apiMessage || 'Player registration is closed because the limit has been reached.'
        });
      }
      if (err?.response?.data?.code === 'RECEIPT_REQUIRED') {
        setRealTimeErrors((prev) => ({ ...prev, receipt: apiMessage || 'Payment receipt is required for this tournament' }));
        setActiveStep(1); // Go back to step 1 to show the error
      }
    } finally {
      setIsSubmitting(false);
      setShowUploadProgress(false);
      setUploadProgress(0);
    }
  };

  const resetForm = useCallback(() => {
    setForm({ name: '', mobile: '', city: '', role: '', remarks: '' });
    setCountryCode('+91');
    setConfirmed(false);
    setPhoto(null);
    setIsPhotoUploaded(false);
    setReceipt(null);
    setReceiptPreview(null);
    setMessage('');
    setRealTimeErrors({});
    setActiveStep(1);
  }, []);

  const status = getRegistrationStatus();

  const renderStatusCallout = () => {
    if (status === 'Active') return null;

    const isUpcoming = status === 'Not Started';
    const title = isUpcoming ? 'Registration not open yet' : 'Registration closed';
    const description = isUpcoming
      ? `Registration opens on ${new Date(tournament.registrationStartDate).toLocaleDateString()}. Please check back soon.`
      : status === 'Closed'
        ? `Player registration closed on ${new Date(tournament.registrationEndDate).toLocaleDateString()}.`
        : 'Registration was closed early by the tournament admin.';

    return (
      <section className={`status-callout ${isUpcoming ? 'upcoming' : 'closed'}`}>
        <div className="callout-icon">{isUpcoming ? '🕒' : '🚫'}</div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </section>
    );
  };

  const validateStep = useCallback((step) => {
    const draftErrors = { ...realTimeErrors };

    if (step === 1) {
      delete draftErrors.name;
      delete draftErrors.role;
      delete draftErrors.mobile;
      delete draftErrors.city;
      delete draftErrors.photo;
      delete draftErrors.receipt;

      if (!form.name.trim()) {
        draftErrors.name = 'Name is required';
      }
      if (!form.role) {
        draftErrors.role = 'Please select a role';
      }
      if (!validateMobile(form.mobile)) {
        draftErrors.mobile = 'Enter valid 10-digit mobile number';
      }
      if (!form.city.trim()) {
        draftErrors.city = 'City/Place is required';
      }
      if (!photo) {
        draftErrors.photo = 'Please upload a player photo';
      }
      if (tournament?.paymentReceiptMandatory && !receipt) {
        draftErrors.receipt = 'Payment receipt is required for this tournament';
      }
    }

    setRealTimeErrors(draftErrors);

    if (step === 1) {
      return !draftErrors.name && !draftErrors.role && !draftErrors.mobile && !draftErrors.city && !draftErrors.photo && !draftErrors.receipt;
    }
    return true;
  }, [form, photo, realTimeErrors]);

  const handleNextStep = useCallback(() => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, stepsTotal));
    }
  }, [activeStep, validateStep, stepsTotal]);

  const handlePrevStep = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 1));
  }, []);

  if (!tournament) {
    return (
      <div className="player-register-page">
        <div className="register-loading-card">
          <div className="loading-spinner"></div>
          <p>Loading tournament details...</p>
        </div>
      </div>
    );
  }

  const statusBadgeText = (() => {
    if (status === 'Active') return '🟢 Registration Open';
    if (status === 'Not Started') return '🕒 Registration Upcoming';
    if (status === 'Closed') return '🚫 Registration Closed';
    if (status === 'Closed Early') return '🚫 Closed Early';
    return 'Registration';
  })();

  return (
    <div className="player-register-page">
      {status !== 'Active' ? (
        <div className="register-container-simple">
          {renderStatusCallout()}
        </div>
      ) : (
        <div className="register-container-simple">
          <div className="register-form-simple">
            <form onSubmit={handleSubmit} noValidate>
              {activeStep === 1 && (
                <div className="form-section-simple">
                  <div className="tournament-header-inline">
                    {tournament.logo && (
                      <img
                        src={
                          tournament.logo.startsWith('http')
                            ? tournament.logo
                            : tournament.logo.startsWith('/')
                              ? `${API_BASE_URL}${tournament.logo}`
                              : `${API_BASE_URL}/${tournament.logo}`
                        }
                        alt={`${tournament.name} logo`}
                        className="tournament-logo-inline"
                        onClick={() => setShowLogoModal(true)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view larger logo"
                      />
                    )}
                    <h1 className="tournament-name-inline">{tournament.name}</h1>
                    <div className="registration-status-badge">
                      <div className={`status-indicator ${status === 'Active' ? 'status-open' : 'status-closed'}`}>
                        {status === 'Active' ? 'Open' : 'Closed'}
                      </div>
                    </div>
                  </div>
                  <h2>Player Registration</h2>
                  <div className="form-grid-simple">
                    <div className={`form-field ${realTimeErrors.name ? 'has-error' : ''}`}>
                      <label htmlFor="player-name">Full Name *</label>
                      <input
                        id="player-name"
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        required
                      />
                      {realTimeErrors.name && <span className="field-error">{realTimeErrors.name}</span>}
                    </div>
                    <div className={`form-field ${realTimeErrors.role ? 'has-error' : ''}`}>
                      <label htmlFor="role">Playing Role *</label>
                      <select
                        id="role"
                        name="role"
                        value={form.role}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select role</option>
                        {getRoleOptions().map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      {realTimeErrors.role && <span className="field-error">{realTimeErrors.role}</span>}
                    </div>
                    <div className={`form-field ${realTimeErrors.mobile ? 'has-error' : ''}`}>
                      <label htmlFor="mobile-number">Mobile Number *</label>
                      <div className="phone-input">
                        <select
                          id="country-code"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                        >
                          <option value="+91">+91</option>
                          <option value="+966">+966</option>
                        </select>
                        <input
                          id="mobile-number"
                          type="tel"
                          name="mobile"
                          value={form.mobile}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            handleChange({ target: { name: 'mobile', value } });
                          }}
                          placeholder="9876543210"
                          maxLength="10"
                          required
                        />
                      </div>
                      {realTimeErrors.mobile && <span className="field-error">{realTimeErrors.mobile}</span>}
                    </div>
                    <div className={`form-field ${realTimeErrors.city ? 'has-error' : ''}`}>
                      <label htmlFor="city">City / Hometown *</label>
                      <input
                        id="city"
                        type="text"
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        placeholder="Enter your city"
                        required
                      />
                      {realTimeErrors.city && <span className="field-error">{realTimeErrors.city}</span>}
                    </div>
                    <div className="form-field full-width">
                      <label htmlFor="remarks">Highlights (Optional)</label>
                      <textarea
                        id="remarks"
                        name="remarks"
                        value={form.remarks}
                        onChange={handleChange}
                        placeholder="Share your achievements, experience, etc."
                        rows="3"
                      />
                    </div>
                    <div className={`form-field full-width photo-uploader ${realTimeErrors.photo ? 'has-error' : ''}`}>
                      <label>Player Photo *</label>
                      <ImageUploadCrop
                        uploadType="playerPhoto"
                        aspect={3 / 4}
                        uploadPath={`${API_BASE_URL}/api/players/upload-photo`}
                        placeholder="Upload your photo"
                        maxSizeMB={2}
                        onUploadStart={() => {
                          setRealTimeErrors((prev) => {
                            const next = { ...prev };
                            delete next.photo;
                            return next;
                          });
                        }}
                        onUploadEnd={() => {}}
                        onComplete={(url) => {
                          setPhoto(url);
                          setIsPhotoUploaded(true);
                          setRealTimeErrors((prev) => {
                            const next = { ...prev };
                            delete next.photo;
                            return next;
                          });
                        }}
                        onError={(errorMessage) => {
                          setPhoto(null);
                          setIsPhotoUploaded(false);
                          setRealTimeErrors((prev) => ({ ...prev, photo: errorMessage }));
                        }}
                      />
                      {isPhotoUploaded && photo && (
                        <span className="image-upload-success">✓ Image uploaded</span>
                      )}
                      {realTimeErrors.photo && <span className="field-error">{realTimeErrors.photo}</span>}
                    </div>
                    <div className={`form-field full-width ${realTimeErrors.receipt ? 'has-error' : ''}`}>
                      <label htmlFor="receipt-upload">
                        Payment Receipt {tournament?.paymentReceiptMandatory ? '(Required)' : '(Optional)'}
                      </label>
                      <div
                        ref={receiptDropRef}
                        className="receipt-dropzone"
                        onClick={() => receiptInputRef.current?.click()}
                        onDrop={handleReceiptDrop}
                        onDragOver={handleDragOver}
                        role="button"
                        tabIndex={0}
                      >
                        {receiptPreview ? (
                          <div className="dropzone-preview">
                            <span className="file-icon">📄</span>
                            <div>
                              <strong>{receiptPreview}</strong>
                              <small>Click to change</small>
                            </div>
                          </div>
                        ) : (
                          <div className="dropzone-placeholder">
                            <span className="upload-icon">📤</span>
                            <div>
                              <p>Drag & drop or click to upload</p>
                              <small>JPG or PDF up to 2MB</small>
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          handleReceiptChange(e);
                          if (e.target.files[0]) {
                            setRealTimeErrors((prev) => {
                              const next = { ...prev };
                              delete next.receipt;
                              return next;
                            });
                          }
                        }}
                        required={tournament?.paymentReceiptMandatory || false}
                        style={{ display: 'none' }}
                      />
                      {realTimeErrors.receipt && <span className="field-error">{realTimeErrors.receipt}</span>}
                    </div>
                  </div>
                  <div className="form-actions-simple">
                    <button type="button" className="btn-primary" onClick={handleNextStep}>
                      Review & Submit →
                    </button>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="form-section-simple">
                  <div className="tournament-header-inline">
                    {tournament.logo && (
                      <img
                        src={
                          tournament.logo.startsWith('http')
                            ? tournament.logo
                            : tournament.logo.startsWith('/')
                              ? `${API_BASE_URL}${tournament.logo}`
                              : `${API_BASE_URL}/${tournament.logo}`
                        }
                        alt={`${tournament.name} logo`}
                        className="tournament-logo-inline"
                        onClick={() => setShowLogoModal(true)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view larger logo"
                      />
                    )}
                    <h1 className="tournament-name-inline">{tournament.name}</h1>
                    <div className="registration-status-badge">
                      <div className={`status-indicator ${status === 'Active' ? 'status-open' : 'status-closed'}`}>
                        {status === 'Active' ? 'Open' : 'Closed'}
                      </div>
                    </div>
                  </div>
                  <h2>Review Your Information</h2>
                  <div className="review-summary">
                    <div className="review-item">
                      <span>Name:</span>
                      <strong>{form.name || 'Not provided'}</strong>
                    </div>
                    <div className="review-item">
                      <span>Role:</span>
                      <strong>{form.role || 'Not selected'}</strong>
                    </div>
                    <div className="review-item">
                      <span>Mobile:</span>
                      <strong>{form.mobile ? `${countryCode} ${form.mobile}` : 'Not provided'}</strong>
                    </div>
                    <div className="review-item">
                      <span>City:</span>
                      <strong>{form.city || 'Not provided'}</strong>
                    </div>
                    {form.remarks && (
                      <div className="review-item">
                        <span>Highlights:</span>
                        <strong>{form.remarks}</strong>
                      </div>
                    )}
                    <div className="review-item">
                      <span>Photo:</span>
                      <strong>{photo ? '✓ Uploaded' : 'Not uploaded'}</strong>
                    </div>
                    <div className="review-item">
                      <span>Payment Receipt:</span>
                      <strong>{receipt ? '✓ Uploaded' : tournament?.paymentReceiptMandatory ? '⚠️ Required' : 'Not uploaded'}</strong>
                    </div>
                  </div>
                  <div className="confirmation-checkbox">
                    <label htmlFor="confirm-details">
                      <input
                        id="confirm-details"
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      I confirm that all information is correct
                    </label>
                  </div>
                  {message && (
                    <div className={`message ${message.includes('❌') ? 'error' : 'success'}`} role="alert">
                      <p>{message}</p>
                    </div>
                  )}
                  <div className="form-actions-simple">
                    <button type="button" className="btn-secondary" onClick={handlePrevStep}>
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting || !confirmed || Object.keys(realTimeErrors).length > 0}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-small"></span>
                          Submitting...
                        </>
                      ) : (
                        'Submit Registration'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {showUploadProgress && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="progress-header">
              <div className="progress-spinner"></div>
              <div className="progress-text">
                <div className="progress-percentage">{uploadProgress}%</div>
                <div className="progress-message">Uploading player registration…</div>
              </div>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <div className="progress-subtext">
              Keep this window open until the upload completes.
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div
          className="success-modal-overlay"
          onClick={() => {
            setShowSuccessModal(false);
            resetForm();
          }}
        >
          <div
            className="success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="registration-success-title"
            aria-describedby="registration-success-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-glow" aria-hidden="true"></div>
            <div className="confetti-splash" aria-hidden="true"></div>
            <header className="success-header">
              <div className="success-header__top">
                {tournament?.logo && (
                  <div className="success-tournament-logo-wrapper">
                    <img
                      src={
                        tournament.logo.startsWith('http')
                          ? tournament.logo
                          : tournament.logo.startsWith('/')
                            ? `${API_BASE_URL}${tournament.logo}`
                            : `${API_BASE_URL}/${tournament.logo}`
                      }
                      alt={`${tournament.name} logo`}
                      className="success-tournament-logo"
                      onClick={() => setShowLogoModal(true)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view larger logo"
                    />
                  </div>
                )}
                <div className="success-header__info">
                  <h1 className="success-tournament-name">{tournament?.name || 'Tournament'}</h1>
                  <p className="success-tournament-label">Player Registration Successful</p>
                </div>
              </div>
            </header>

            <div className="success-player-details">
              <div className="success-player-image">
                {registeredPlayer?.photo ? (
                  <img
                    src={
                      registeredPlayer.photo.startsWith('http')
                        ? registeredPlayer.photo
                        : registeredPlayer.photo.startsWith('/')
                          ? `${API_BASE_URL}${registeredPlayer.photo}`
                          : `${API_BASE_URL}/${registeredPlayer.photo}`
                    }
                    alt={registeredPlayer?.name || form.name}
                    className="player-photo-success"
                  />
                ) : photo ? (
                  <img
                    src={
                      photo.startsWith('http')
                        ? photo
                        : photo.startsWith('/')
                          ? `${API_BASE_URL}${photo}`
                          : `${API_BASE_URL}/${photo}`
                    }
                    alt={form.name}
                    className="player-photo-success"
                  />
                ) : null}
              </div>
              <div className="success-player-info">
                <div className="success-info-item">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{registeredPlayer?.name || form.name}</span>
                </div>
                <div className="success-info-item">
                  <span className="info-label">Role:</span>
                  <span className="info-value">{registeredPlayer?.role || form.role || 'N/A'}</span>
                </div>
                <div className="success-info-item">
                  <span className="info-label">Mobile:</span>
                  <span className="info-value">
                    {registeredPlayer?.mobile
                      ? `${registeredPlayer?.countryCode || '+91'} ${registeredPlayer.mobile}`
                      : form.mobile
                        ? `${countryCode} ${form.mobile}`
                        : 'N/A'}
                  </span>
                </div>
                <div className="success-info-item">
                  <span className="info-label">City:</span>
                  <span className="info-value">{registeredPlayer?.city || form.city || 'N/A'}</span>
                </div>
                {registeredPlayer?.remarks || form.remarks ? (
                  <div className="success-info-item">
                    <span className="info-label">Highlights:</span>
                    <span className="info-value">{registeredPlayer?.remarks || form.remarks}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="success-actions">
              <div className="success-actions__primary">
                <button
                  type="button"
                  className="success-button register-another"
                  onClick={() => {
                    setShowSuccessModal(false);
                    resetForm();
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                    <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Register another player
                </button>
                <button
                  type="button"
                  className="success-button close-button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    resetForm();
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="https://www.w3.org/2000/svg">
                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {limitModal && (
        <div
          className="success-modal-overlay"
          onClick={() => setLimitModal(null)}
        >
          <div
            className="success-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-modal-title"
            aria-describedby="limit-modal-description"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="success-close"
              onClick={() => setLimitModal(null)}
              aria-label="Close registration limit notice"
            >
              ×
            </button>
            <header className="success-header">
              <div className="success-header__top">
                <div className="success-header__info">
                  <p className="success-tournament-label">NOTICE</p>
                  <h2 id="limit-modal-title">{limitModal.title}</h2>
                </div>
              </div>
            </header>
            <div className="success-message">
              <p id="limit-modal-description">{limitModal.message}</p>
            </div>
            <div className="success-actions">
              <button
                type="button"
                className="success-button primary"
                onClick={() => setLimitModal(null)}
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoModal && tournament?.logo && (
        <div
          className="logo-modal-overlay"
          onClick={() => setShowLogoModal(false)}
        >
          <div
            className="logo-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="logo-modal-close"
              onClick={() => setShowLogoModal(false)}
              aria-label="Close logo modal"
            >
              ×
            </button>
            <img
              src={
                tournament.logo.startsWith('http')
                  ? tournament.logo
                  : tournament.logo.startsWith('/')
                    ? `${API_BASE_URL}${tournament.logo}`
                    : `${API_BASE_URL}/${tournament.logo}`
              }
              alt={`${tournament.name} logo`}
              className="logo-modal-image"
            />
            <p className="logo-modal-title">{tournament.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerRegister;
