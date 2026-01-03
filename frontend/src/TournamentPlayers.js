import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import PlayerRegister from './PlayerRegister';
import ImageUploadCrop from './components/ImageUploadCrop';
import { toast } from 'react-toastify';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-tournament-players.css';
import './styles-tournament-teams.css';

// Helper function for asset URLs
const getAssetUrlHelper = (asset) => {
  if (!asset) return null;
  if (asset.startsWith('http')) return asset;
  if (asset.startsWith('/')) return `${API_BASE_URL}${asset}`;
  if (asset.startsWith('uploads/')) return `${API_BASE_URL}/${asset}`;
  return `${API_BASE_URL}/uploads/${asset}`;
};

// Edit Player Form Component
const EditPlayerForm = ({ player, tournament, onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    name: player.name || '',
    mobile: player.mobile || '',
    city: player.city || '',
    role: player.role || '',
    remarks: player.remarks || ''
  });
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editReceipt, setEditReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getRoleOptions = () => {
    if (!tournament) return [];
    if (tournament.sport === 'Cricket') return ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
    if (tournament.sport === 'Football') return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
    if (tournament.sport === 'Volleyball') return ['Setter', 'Attacker', 'Blocker', 'Libero'];
    if (tournament.sport === 'Basketball') return ['Point Guard', 'Center', 'Forward', 'Shooting Guard'];
    return [];
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleReceiptChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 2 * 1024 * 1024) {
      toast.error('Receipt size exceeds 2MB limit.');
      return;
    }
    setEditReceipt(file);
  };

  const handlePhotoUploadComplete = (uploadResult) => {
    if (uploadResult?.url) {
      setEditPhotoUrl(uploadResult.url);
      toast.success('Photo updated successfully');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const data = new FormData();
      Object.keys(form).forEach(key => data.append(key, form[key]));
      if (editPhotoUrl) data.append('photoUrl', editPhotoUrl);
      if (editReceipt) data.append('receipt', editReceipt);

      await axios.put(`${API_BASE_URL}/api/players/${player.playerId}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Player updated successfully!');
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error updating player');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="edit-player-form">
      <div className="edit-form-header">
        <div className="edit-form-header__gradient-bg"></div>
        <div className="edit-form-header__content">
          <div className="edit-form-header__left">
            <div className="edit-form-header__icon-wrapper">
              <div className="edit-form-header__icon">✏️</div>
              <div className="icon-glow"></div>
            </div>
            <div className="edit-form-header__info">
              <h4>
                <span className="title-main">Edit Player</span>
                <span className="title-accent">Details</span>
              </h4>
              <p>
                <span className="info-icon">ℹ️</span>
                Update player information and profile details
              </p>
            </div>
          </div>
          <div className="edit-form-header__right">
            <div className="player-info-card">
              <div className="player-info-card__label">Player ID</div>
              <div className="player-info-card__value">{player.playerId}</div>
            </div>
            <div className="player-info-card">
              <div className="player-info-card__label">Name</div>
              <div className="player-info-card__value">{player.name}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="edit-form-sections">
        <section className="edit-form-section">
          <div className="section-header">
            <span className="section-icon">👤</span>
            <h5>Basic Information</h5>
          </div>
          <div className="edit-form-grid">
            <div className="form-group">
              <label>
                <span className="label-icon">📝</span>
                Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Enter player name"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">📱</span>
                Mobile <span className="required">*</span>
              </label>
              <input
                type="tel"
                name="mobile"
                value={form.mobile}
                onChange={handleChange}
                required
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                maxLength="10"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">📍</span>
                City <span className="required">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                placeholder="City/Place"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">⚽</span>
                Role <span className="required">*</span>
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">Select role</option>
                {getRoleOptions().map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="edit-form-section">
          <div className="section-header">
            <span className="section-icon">📸</span>
            <h5>Player Photo</h5>
          </div>
          <div className="photo-upload-wrapper">
            <ImageUploadCrop
              label="Player photo"
              placeholder="Click to upload or update photo"
              aspect={3 / 4}
              uploadType="playerPhoto"
              uploadPath={`${API_BASE_URL}/api/players/upload-photo`}
              initialImage={player.photo ? getAssetUrlHelper(player.photo) : undefined}
              previewShape="square"
              onUploadComplete={handlePhotoUploadComplete}
              onError={(message) => toast.error(message)}
            />
            {editPhotoUrl && (
              <div className="upload-success-indicator">
                <span className="success-icon">✓</span>
                <span>Photo ready to update</span>
              </div>
            )}
          </div>
        </section>

        <section className="edit-form-section">
          <div className="section-header">
            <span className="section-icon">🧾</span>
            <h5>Receipt</h5>
          </div>
          <div className="receipt-upload-wrapper">
            <label className="file-upload-label">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptChange}
                className="file-input-hidden"
              />
              <div className="file-upload-box">
                <span className="file-upload-icon">📄</span>
                <span className="file-upload-text">
                  {editReceipt ? editReceipt.name : 'Click to upload receipt (Image or PDF)'}
                </span>
                {!editReceipt && <span className="file-upload-hint">Max 2MB</span>}
              </div>
            </label>
            {editReceipt && (
              <div className="file-selected-indicator">
                <span className="file-icon">📎</span>
                <span className="file-name">{editReceipt.name}</span>
                <button
                  type="button"
                  className="file-remove-btn"
                  onClick={() => setEditReceipt(null)}
                >
                  ✕
                </button>
              </div>
            )}
            {player.receipt && !editReceipt && (
              <div className="current-file-info">
                <span className="info-icon">ℹ️</span>
                <span>Current: {player.receipt}</span>
              </div>
            )}
          </div>
        </section>

        <section className="edit-form-section">
          <div className="section-header">
            <span className="section-icon">📝</span>
            <h5>Additional Notes</h5>
          </div>
          <div className="form-group full-width">
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              placeholder="Add any additional remarks or notes about this player (optional)"
              rows="4"
              className="form-textarea"
            />
          </div>
        </section>
      </div>

      <div className="form-actions">
        <button 
          type="button" 
          onClick={onCancel} 
          className="form-action-btn cancel-btn" 
          disabled={isSubmitting}
        >
          <span>Cancel</span>
        </button>
        <button 
          type="submit" 
          className="form-action-btn submit-btn" 
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="loading-spinner-small"></span>
              <span>Updating...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Update Player</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};


// const CARD_THEMES = {
//   KPL2026: {
//     gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #2563eb 100%)',
//     accent: '#facc15',
//     accentSoft: 'rgba(250, 204, 21, 0.25)'
//   },
//   ULL2025: {
//     gradient: 'linear-gradient(135deg, #172554 0%, #1d4ed8 45%, #4c1d95 100%)',
//     accent: '#38bdf8',
//     accentSoft: 'rgba(56, 189, 248, 0.25)'
//   },
//   PLAYLIVE2025: {
//     gradient: 'linear-gradient(135deg, #1f2937 0%, #0f172a 50%, #334155 100%)',
//     accent: '#c084fc',
//     accentSoft: 'rgba(192, 132, 252, 0.25)'
//   },
//   default: {
//     gradient: 'linear-gradient(135deg, #1f004f 0%, #312e81 40%, #3b82f6 100%)',
//     accent: '#facc15',
//     accentSoft: 'rgba(250, 204, 21, 0.25)'
//   }
// };

// const resolveTournamentTheme = (tournament) => {
//   if (!tournament) return CARD_THEMES.default;
//   const codeKey = tournament.code?.toUpperCase() || '';
//   const nameKey = tournament.name?.replace(/\s+/g, '').toUpperCase() || '';
//   return CARD_THEMES[codeKey] || CARD_THEMES[nameKey] || CARD_THEMES.default;
// };

const getPlayerTimestampValue = (player) => {
  if (!player) return null;
  return (
    player.updatedAt ||
    player.createdAt ||
    player.registeredAt ||
    player.registrationDate ||
    player.created_on ||
    null
  );
};

const formatRecentDate = (timestamp) => {
  if (!timestamp) return 'Just added';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'Just added';
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
};

const extractPlayerNumber = (playerId) => {
  if (!playerId) return '';
  // Extract numeric part after the last dash (e.g., "PLTC003-1" -> "1")
  const match = String(playerId).match(/-(\d+)$/);
  return match ? match[1] : playerId;
};

function TournamentPlayers() {
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState({ total: 0, remaining: 0, teams: 0, auctionReady: false });
  const [user] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const normalizedRole = (user?.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
  const isTournamentAdmin = ['tournamentadmin', 'superadmin', 'tournamentmanager'].includes(normalizedRole);
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: '', city: '' });
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig] = useState({ field: 'playerId', direction: 'asc' });
  const [preview, setPreview] = useState(null); // { type: 'photo' | 'receipt', url, title }
  const [selectedPlayerModal, setSelectedPlayerModal] = useState(null); // Player object for modal view
  const [selectedImageModal, setSelectedImageModal] = useState(null); // Player object for image modal view
  // const [isPrinting, setIsPrinting] = useState(false);
  // const [exportTimestamp, setExportTimestamp] = useState(new Date());
  // const pdfExportRef = useRef(null);
  // const [showPdfExportLayout, setShowPdfExportLayout] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [photoEditorPlayer, setPhotoEditorPlayer] = useState(null);
  const [photoEditorSaving, setPhotoEditorSaving] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importMode, setImportMode] = useState('preview');
  const [importLoading, setImportLoading] = useState(false);
  const [showImportInstructions, setShowImportInstructions] = useState(false);
  const navigate = useNavigate();
  const { code } = useParams();
  const [viewMode, setViewMode] = useState('table');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const pageSize = 50;

  // Authentication check with browser back button protection
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
      
      try {
        const parsedUser = JSON.parse(storedUser);
        const normalizedRole = (parsedUser.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
        const allowedRoles = ['tournamentadmin', 'superadmin', 'tournamentmanager'];
        
        if (!allowedRoles.includes(normalizedRole)) {
          navigate('/login/tournament-admin', { replace: true });
          return false;
        }
        return true;
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login/tournament-admin', { replace: true });
        return false;
      }
    };

    if (!checkAuth()) {
      return;
    }

    const handlePageShow = (e) => {
      if (e.persisted) {
        checkAuth();
      }
    };

    const handleFocus = () => {
      checkAuth();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  useEffect(() => {
    if (tournament) {
      document.title = `Tournament Players - ${tournament.name}`;
    } else {
      document.title = 'Tournament Players';
    }
  }, [tournament]);

  // Load view mode preference from localStorage
  useEffect(() => {
    if (code) {
      const saved = localStorage.getItem(`playersViewMode_${code}`);
      if (saved && (saved === 'table' || saved === 'card')) {
        setViewMode(saved);
      }
    }
  }, [code]);

  // Save view mode preference to localStorage
  useEffect(() => {
    if (code) {
      localStorage.setItem(`playersViewMode_${code}`, viewMode);
    }
  }, [viewMode, code]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('.player-card-dropdown')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error(err);
    }
  }, [code]);

  const fetchPlayers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/players/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlayers(res.data.players || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching players:', err);
      toast.error('Failed to load players');
    }
  }, [code]);

  useEffect(() => {
    if (!user || !isTournamentAdmin) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      setIsBootstrapping(true);
      try {
        await Promise.all([fetchTournament(), fetchPlayers()]);
      } finally {
        setIsBootstrapping(false);
      }
    };
    loadData();
  }, [user, isTournamentAdmin, navigate, code, fetchTournament, fetchPlayers]);

  useEffect(() => {
    if (!tournament) return;
    setStats((prev) => ({
      ...prev,
      total: players.length,
      remaining: tournament.maxPlayers
        ? Math.max(tournament.maxPlayers - players.length, 0)
        : prev.remaining
    }));
  }, [players, tournament]);

  // const sortedPlayersForExport = useMemo(() => {
  //   if (!players || players.length === 0) return [];
  //   return [...players].sort((a, b) => {
  //     const aId = (a.playerId || '').toString().toLowerCase();
  //     const bId = (b.playerId || '').toString().toLowerCase();
  //     if (aId === bId) {
  //       return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
  //     }
  //     return aId.localeCompare(bId);
  //   });
  // }, [players]);

  // const playerPagesForExport = useMemo(() => {
  //   if (!sortedPlayersForExport.length) return [];
  //   const chunkSize = 25;
  //   const chunks = [];
  //   for (let i = 0; i < sortedPlayersForExport.length; i += chunkSize) {
  //     chunks.push(sortedPlayersForExport.slice(i, i + chunkSize));
  //   }
  //   return chunks;
  // }, [sortedPlayersForExport]);

  // const formattedExportTimestamp = useMemo(() => {
  //   return new Intl.DateTimeFormat(undefined, {
  //     dateStyle: 'medium',
  //     timeStyle: 'short'
  //   }).format(exportTimestamp);
  // }, [exportTimestamp]);

  // useEffect(() => {
  //   if (typeof window === 'undefined') return;
  //   const handleAfterPrint = () => {
  //     setIsPrinting(false);
  //     setShowPdfExportLayout(false);
  //   };
  //   window.addEventListener('afterprint', handleAfterPrint);
  //   return () => {
  //     window.removeEventListener('afterprint', handleAfterPrint);
  //   };
  // }, []);

  // useEffect(() => {
  //   if (typeof window === 'undefined') return;
  //   const handleBeforePrint = () => {
  //     if (!sortedPlayersForExport.length) {
  //       return;
  //     }
  //     setExportTimestamp(new Date());
  //     flushSync(() => {
  //       setIsPrinting(true);
  //       setShowPdfExportLayout(true);
  //     });
  //   };
  //   window.addEventListener('beforeprint', handleBeforePrint);
  //   return () => {
  //     window.removeEventListener('beforeprint', handleBeforePrint);
  //   };
  // }, [sortedPlayersForExport.length]);

  const handleExportCSV = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/reports/players/excel/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `players_${code}.xlsx`);
      document.body.appendChild(link);
      link.click();
      toast.success('CSV exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error exporting CSV');
    }
  }, [code]);

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/players/import/template/${code}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `player_import_template_${code}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success('Template downloaded successfully');
    } catch (err) {
      console.error('Error downloading template:', err);
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx'].includes(fileExtension)) {
      toast.error('Invalid file type. Please select a CSV or Excel file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setImportFile(file);
    setImportPreview(null);
    setImportResults(null);
    setImportMode('preview');
  };

  const handleFileUpload = async () => {
    if (!importFile) {
      toast.error('Please select a file first');
      return;
    }

    setImportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', importMode);

      const response = await axios.post(
        `${API_BASE_URL}/api/players/import/${code}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        if (importMode === 'preview') {
          setImportPreview(response.data);
        } else {
          setImportResults(response.data);
          toast.success(`Import completed! ${response.data.summary.success} players created, ${response.data.summary.updated} updated, ${response.data.summary.errors} errors`);
          await fetchPlayers();
        }
      } else {
        toast.error(response.data.message || 'Import failed');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importFile || !importPreview) {
      toast.error('Please preview the file first');
      return;
    }

    setImportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('mode', 'import');
      formData.append('updateDuplicates', 'false');

      const response = await axios.post(
        `${API_BASE_URL}/api/players/import/${code}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setImportResults(response.data);
        setImportMode('import');
        toast.success(`Import completed! ${response.data.summary.success} players created, ${response.data.summary.updated} updated, ${response.data.summary.errors} errors`);
        await fetchPlayers();
      } else {
        toast.error(response.data.message || 'Import failed');
      }
    } catch (err) {
      console.error('Error executing import:', err);
      toast.error(err.response?.data?.message || 'Failed to execute import');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCloseImportModal = () => {
    setImportModal(false);
    setImportFile(null);
    setImportPreview(null);
    setImportResults(null);
    setImportMode('preview');
    setShowImportInstructions(false);
  };

  const handleDownloadErrorFile = () => {
    if (!importResults || !importResults.results) {
      toast.error('No error data available');
      return;
    }

    const errorRows = importResults.results.filter(r => r.status === 'error');
    if (errorRows.length === 0) {
      toast.info('No errors to download');
      return;
    }

    // Create CSV content
    const headers = ['Row Number', 'Name', 'Mobile', 'City', 'Role', 'Error Message'];
    const rows = errorRows.map(result => [
      result.rowNumber,
      result.data.name || '',
      result.data.mobile || '',
      result.data.city || '',
      result.data.role || '',
      result.message || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `player_import_errors_${code}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    toast.success('Error file downloaded');
  };

  const handleViewCard = (player) => {
    window.open(`/player-card/${player.playerId}`, '_blank');
  };

  const handleDownloadCard = async (player) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/player-cards/generate/${player.playerId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rp_card_${player.playerId}.pdf`);
      document.body.appendChild(link);
      link.click();
      toast.success('RP Card downloaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error downloading card');
    }
  };

  const handleDeletePlayer = async (player) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/players/${player.playerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPlayers();
      toast.success('Player deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error deleting player');
    }
  };

  const handleDeleteAllPlayers = async () => {
    const playerCount = players.length;
    if (playerCount === 0) {
      toast.info('No players to delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${playerCount} registered players for this tournament?\n\nThis action cannot be undone and will permanently delete:\n- All player records\n- All player photos\n- All player receipts\n- All RP Cards`
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_BASE_URL}/api/players/tournament/${code}/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchPlayers();
      toast.success(response.data.message || `Successfully deleted ${response.data.deletedCount || playerCount} player(s)`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error deleting all players');
    }
  };

  const handleEditPlayer = (player) => {
    setEditingPlayer(player);
    setShowAddPlayerModal(true);
  };

  // const handleShareCard = (player) => {
  //   const message = `Check out ${player.name}'s player card: ${window.location.origin}/player-card/${player.playerId}`;
  //   const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  //   window.open(whatsappUrl, '_blank');
  //   toast.success('Opening WhatsApp...');
  // };

  const handleOpenPhotoEditor = useCallback((player) => {
    setPhotoEditorSaving(false);
    setPhotoEditorPlayer(player);
  }, []);

  const handleClosePhotoEditor = useCallback(() => {
    if (photoEditorSaving) return;
    setPhotoEditorPlayer(null);
  }, [photoEditorSaving]);

  const finalizePhotoUpdate = useCallback(
    async (player, uploadResult) => {
      if (!player || !uploadResult?.url) {
        toast.error('Upload did not return a usable photo URL.');
        return;
      }

      setPhotoEditorSaving(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.put(
          `${API_BASE_URL}/api/players/${player.playerId}`,
          { photoUrl: uploadResult.url },
          { headers }
        );
        const updatedPlayer = response.data?.player;

        if (updatedPlayer) {
          setPlayers((prev) =>
            prev.map((existing) => (existing._id === updatedPlayer._id ? updatedPlayer : existing))
          );
        } else {
          await fetchPlayers();
        }

        toast.success(`${player.name}'s photo updated`);
        setPhotoEditorPlayer(null);
      } catch (error) {
        console.error('Failed to update player photo:', error);
        const message = error.response?.data?.message || 'Failed to update player photo';
        toast.error(message);
      } finally {
        setPhotoEditorSaving(false);
      }
    },
    [fetchPlayers, setPlayers]
  );

  const handlePhotoUploadComplete = useCallback(
    (uploadResult) => {
      if (!photoEditorPlayer) {
        toast.error('Select a player before applying an upload.');
        return;
      }
      finalizePhotoUpdate(photoEditorPlayer, uploadResult);
    },
    [photoEditorPlayer, finalizePhotoUpdate]
  );

  const getRegistrationLink = useCallback(() => {
    // Always construct dynamically from current origin to avoid localhost issues
    return `${window.location.origin}/register/${code}`;
  }, [code]);

  const shareWhatsApp = (type) => {
    const link = type === 'player'
      ? getRegistrationLink()
      : tournament.teamRegistrationLink || `${window.location.origin}/register/team/${code}`;
    const message = `🏆 Join the ${tournament?.name || 'Tournament'}!\nRegister your ${type} here:\n🔗 ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // const handleSelectPlayer = (playerId) => {
  //   setSelectedPlayers(prev =>
  //     prev.includes(playerId)
  //       ? prev.filter(id => id !== playerId)
  //       : [...prev, playerId]
  //   );
  // };

  // const handleSelectAll = () => {
  //   if (selectedPlayers.length === filteredPlayers.length) {
  //     setSelectedPlayers([]);
  //   } else {
  //     setSelectedPlayers(filteredPlayers.map(p => p._id));
  //   }
  // };

  // const handleRoleChipClick = useCallback((role) => {
  //   setFilters((prev) => ({
  //     ...prev,
  //     role: prev.role === role ? '' : role
  //   }));
  // }, []);

  // const handleCityChipClick = useCallback((city) => {
  //   setFilters((prev) => ({
  //     ...prev,
  //     city: prev.city === city ? '' : city
  //   }));
  // }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', role: '', city: '' });
  }, []);

  const handleBatchAction = async (e) => {
    const action = e.target.value;
    if (!action) return;
    if (action === 'delete') {
      if (!window.confirm(`Delete ${selectedPlayers.length} selected players?`)) return;
      try {
        const token = localStorage.getItem('token');
        await Promise.all(selectedPlayers.map(id =>
          axios.delete(`${API_BASE_URL}/api/players/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ));
        fetchPlayers();
        setSelectedPlayers([]);
        toast.success('Selected players deleted');
      } catch (err) {
        console.error(err);
        toast.error('Error deleting players');
      }
    } else if (action === 'download') {
      // Batch download - for now, download individually
      selectedPlayers.forEach(id => {
        const player = filteredPlayers.find(p => p._id === id);
        if (player) handleDownloadCard(player);
      });
    } else if (action === 'export') {
      // Export selected - need backend support or filter client-side
      toast.info('Export selected feature coming soon');
    }
    e.target.value = '';
  };

  const getRoleOptions = () => {
    if (!tournament) return [];
    if (tournament.sport === 'Cricket') return ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
    if (tournament.sport === 'Football') return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
    if (tournament.sport === 'Volleyball') return ['Setter', 'Attacker', 'Blocker', 'Libero'];
    return [];
  };

  const getRegistrationStatus = () => {
    if (!tournament) return 'Not Started';

    const now = new Date();
    const start = tournament.registrationStartDate ? new Date(tournament.registrationStartDate) : null;
    const end = tournament.registrationEndDate ? new Date(tournament.registrationEndDate) : null;
    const manualStatus = tournament.registrationStatus;
    const isPlayerOpen = tournament.playerRegistrationEnabled;

    if (manualStatus === 'Closed Early') {
      return 'Closed Early';
    }

    if (isPlayerOpen) {
      if (manualStatus === 'Closed') {
        return 'Closed';
      }
      return 'Active';
    }

    if (manualStatus === 'Closed') {
      return 'Closed';
    }

    if (manualStatus === 'Not Started') {
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

  const handleCloseRegistration = async () => {
    if (!window.confirm('Are you sure you want to close registration early?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/tournaments/${code}/close-registration`, { scope: 'player' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTournament();
      toast.success('Registration closed successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error closing registration');
    }
  };

  const handleReopenRegistration = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/tournaments/${code}/reopen-registration`, { scope: 'player' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTournament();
      toast.success('Registration reopened successfully');
    } catch (err) {
      console.error(err);
      toast.error('Error reopening registration');
    }
  };

  const handleCopyLink = useCallback(async () => {
    const success = await copyToClipboard(getRegistrationLink());
    if (success) {
      toast.success('✅ Link copied to clipboard!');
    } else {
      toast.error('Failed to copy link');
    }
  }, [getRegistrationLink]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = players.filter(player => {
      const matchesSearch = !filters.search ||
        player.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        player.playerId.toLowerCase().includes(filters.search.toLowerCase()) ||
        player.city.toLowerCase().includes(filters.search.toLowerCase());
      const matchesRole = !filters.role || player.role === filters.role;
      const matchesCity = !filters.city || player.city === filters.city;
      return matchesSearch && matchesRole && matchesCity;
    });

    // Sort
    const sorted = filtered.sort((a, b) => {
      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;
      const field = sortConfig.field;

      if (field === 'registeredAt') {
        const dateDiff = new Date(a.registeredAt) - new Date(b.registeredAt);
        return dateDiff * directionMultiplier;
      }

      const fieldA = (a[field] || '').toString().toLowerCase();
      const fieldB = (b[field] || '').toString().toLowerCase();

      if (fieldA < fieldB) return -1 * directionMultiplier;
      if (fieldA > fieldB) return 1 * directionMultiplier;
      return 0;
    });

    setFilteredPlayers(sorted);
    setCurrentPage(1);
  }, [players, filters, sortConfig]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [filteredPlayers.length, currentPage, pageSize]);


  // Close modal on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selectedPlayerModal) {
        setSelectedPlayerModal(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedPlayerModal]);


  // const cardTheme = useMemo(() => resolveTournamentTheme(tournament), [tournament]);
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, currentPage, pageSize]);

  const uniqueCitiesCount = useMemo(() => {
    if (!players?.length) return 0;
    return new Set(players.map((player) => player.city).filter(Boolean)).size;
  }, [players]);

  const uniqueRolesCount = useMemo(() => {
    if (!players?.length) return 0;
    return new Set(players.map((player) => player.role).filter(Boolean)).size;
  }, [players]);

  const playersWithPhotos = useMemo(() => {
    if (!players?.length) return 0;
    return players.filter((player) => player.photo).length;
  }, [players]);

  const photoCompleteness = useMemo(() => {
    if (!players?.length) return 0;
    return Math.round((playersWithPhotos / players.length) * 100);
  }, [players, playersWithPhotos]);

  const roleDistribution = useMemo(() => {
    if (!players?.length) return [];
    const counts = players.reduce((acc, player) => {
      const role = player.role?.trim() || 'Role TBD';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([role, count]) => ({
        role,
        count,
        percent: Math.round((count / players.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [players]);

  const cityHighlights = useMemo(() => {
    if (!players?.length) return [];
    const counts = players.reduce((acc, player) => {
      const city = player.city?.trim() || 'City TBD';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([city, count]) => ({
        city,
        count,
        percent: Math.round((count / players.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [players]);

  // const roleChipOptions = useMemo(() => roleDistribution.slice(0, 4), [roleDistribution]);
  // const cityChipOptions = useMemo(() => cityHighlights.slice(0, 3), [cityHighlights]);

  const recentPlayers = useMemo(() => {
    if (!players?.length) return [];
    return [...players]
      .sort((a, b) => {
        const aTime = new Date(getPlayerTimestampValue(a) || 0).getTime();
        const bTime = new Date(getPlayerTimestampValue(b) || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [players]);

  const startIndex = filteredPlayers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = (currentPage - 1) * pageSize + paginatedPlayers.length;

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextPage = () => goToPage(currentPage + 1);
  const handlePrevPage = () => goToPage(currentPage - 1);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchPlayers();
    } finally {
      setIsRefreshing(false);
    }
  };

  // const handleSort = (field) => {
  //   setSortConfig((prev) => {
  //     if (prev.field === field) {
  //       return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
  //     }
  //     return { field, direction: 'asc' };
  //   });
  // };

  // const getSortIndicator = (field) => {
  //   if (sortConfig.field !== field) return '⇅';
  //   return sortConfig.direction === 'asc' ? '↑' : '↓';
  // };

  const getAssetUrl = (asset) => {
    if (!asset) return null;
    if (asset.startsWith('http')) return asset;
    if (asset.startsWith('/')) return `${API_BASE_URL}${asset}`;
    if (asset.startsWith('uploads/')) return `${API_BASE_URL}/${asset}`;
    return `${API_BASE_URL}/uploads/${asset}`;
  };

  const openPreview = (type, asset, title) => {
    const url = getAssetUrl(asset);
    if (!url) {
      toast.info('File not available');
      return;
    }
    if (type === 'receipt') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreview({ type, url, title });
  };

  const closePreview = () => setPreview(null);

  const registrationStatus = getRegistrationStatus();
  // Use playerPoolSize if available, otherwise fall back to maxPlayers
  const totalSlots = tournament?.playerPoolSize 
    ? Number(tournament.playerPoolSize) 
    : (tournament?.maxPlayers ? Number(tournament.maxPlayers) : null);
  const remainingSlots = totalSlots !== null ? Math.max(totalSlots - stats.total, 0) : null;

  const statusMeta = useMemo(() => {
    switch (registrationStatus) {
      case 'Active':
        return {
          title: 'Registration Active',
          hint: 'Players can continue to register.',
          tone: 'active'
        };
      case 'Closed':
        return {
          title: 'Registration Closed',
          hint: 'No new players can join.',
          tone: 'closed'
        };
      case 'Closed Early':
        return {
          title: 'Closed Early',
          hint: 'Registration ended before schedule.',
          tone: 'warning'
        };
      case 'Not Started':
      default:
        return {
          title: registrationStatus,
          hint: 'Player registration has not opened yet.',
          tone: 'idle'
        };
    }
  }, [registrationStatus]);

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(lastUpdated);
  }, [lastUpdated]);

  const summaryCards = useMemo(() => {
    const cards = [
      {
        key: 'registered',
        label: 'Registered Players',
        value: stats.total.toLocaleString(),
        sub: totalSlots ? `of ${totalSlots.toLocaleString()} slots` : null,
        tone: 'primary'
      }
    ];

    if (totalSlots !== null) {
      cards.push({
        key: 'remaining',
        label: 'Slots Remaining',
        value: remainingSlots.toLocaleString(),
        sub: remainingSlots === 0 ? 'All slots filled' : 'Space left for new players',
        tone: remainingSlots === 0 ? 'alert' : 'success'
      });
    } else {
      cards.push({
        key: 'open',
        label: 'Registration Capacity',
        value: 'Unlimited',
        sub: 'No maximum set',
        tone: 'primary'
      });
    }

    cards.push({
      key: 'cities',
      label: 'Cities Represented',
      value: uniqueCitiesCount.toLocaleString(),
      sub: uniqueCitiesCount === 1 ? 'Single city' : 'Diverse player base',
      tone: 'primary'
    });

    cards.push({
      key: 'roles',
      label: 'Roles Covered',
      value: uniqueRolesCount.toLocaleString(),
      sub: uniqueRolesCount ? 'Role diversity among players' : 'No role info yet',
      tone: uniqueRolesCount ? 'primary' : 'primary'
    });

    if (players.length > 0) {
      cards.push({
        key: 'photos',
        label: 'Photos Uploaded',
        value: `${photoCompleteness}%`,
        sub: `${playersWithPhotos} of ${players.length} players`,
        tone: photoCompleteness >= 80 ? 'success' : photoCompleteness >= 50 ? 'primary' : 'alert'
      });
    }

    return cards;
  }, [remainingSlots, stats.total, totalSlots, uniqueCitiesCount, uniqueRolesCount, players.length, playersWithPhotos, photoCompleteness]);

  const isPltc002 = (code || '').toUpperCase() === 'PLTC002';
  const insightsAvailable = roleDistribution.length > 0 || cityHighlights.length > 0 || recentPlayers.length > 0;
  // const filtersActive = Boolean(filters.role || filters.city);
  const pageClassName = `tournaments-admin-page players-admin players-theme-light ${isPltc002 ? 'pltc002-players-ui' : ''} players-dynamic-mode`;

  if (isBootstrapping) {
    return (
      <div className="players-loading">
        <div className="players-loading__card">
          <span className="players-loading__icon">⏳</span>
          <h3>Loading player directory…</h3>
          <p>Fetching the latest registrations and profile details.</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="players-empty">
        <h3>⚠️ Tournament Not Found</h3>
        <p>Unable to load tournament data. Please check your connection and try again.</p>
      </div>
    );
  }

  return (
    <>
      <div className={pageClassName}>
        <section className="surface-card players-actions">
          <div className="players-actions__group">
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => window.open(`/register/${code}`, '_blank')}
            >
              Add player
            </button>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleCopyLink}
            >
              Copy player link
            </button>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleExportCSV}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={() => navigate(`/tournament/${code}/settings/player-card-designer/all-cards`)}
            >
              Player Card
            </button>
            <>
              <button
                type="button"
                className="admin-btn subtle"
                onClick={handleDownloadTemplate}
              >
                📥 Download Template
              </button>
              <button
                type="button"
                className="admin-btn subtle"
                onClick={() => setImportModal(true)}
              >
                📤 Import Players
              </button>
            </>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
          <button
            type="button"
            className="admin-btn"
            onClick={handleDeleteAllPlayers}
              style={{
                padding: '8px 14px',
                background: '#dc3545',
                color: '#ffffff',
                border: '1px solid #dc3545',
                borderRadius: 'var(--dash-radius-sm, 8px)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition, all 0.2s ease)',
                boxShadow: 'var(--dash-shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.04))',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: 'fit-content'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#c82333';
                e.target.style.borderColor = '#c82333';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#dc3545';
                e.target.style.borderColor = '#dc3545';
              }}
            >
              <span>🗑️</span>
              <span>Delete all players</span>
            </button>
            {registrationStatus === 'Active' ? (
              <button
                type="button"
                className="admin-btn quiet"
                onClick={handleCloseRegistration}
              >
                Close registration
              </button>
            ) : (
              <button
                type="button"
                className="admin-btn quiet"
                onClick={handleReopenRegistration}
              >
                Reopen registration
              </button>
            )}
        </section>

        <section className="surface-card players-metrics">
          {summaryCards.map((card) => {
            const iconMap = {
              registered: '👥',
              remaining: '📊',
              open: '♾️',
              cities: '📍',
              roles: '⚽',
              photos: '📸'
            };
            return (
              <article key={card.key} className={`metric-tile tone-${card.tone || 'primary'}`}>
                <div className="metric-tile__icon">{iconMap[card.key] || '📈'}</div>
                <span className="metric-tile__label">{card.label}</span>
                <span className="metric-tile__value">{card.value}</span>
                {card.sub && <span className="metric-tile__sub">{card.sub}</span>}
              </article>
            );
          })}
        </section>

        {insightsAvailable && (
          <section className="surface-card players-insights">
            {roleDistribution.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>Role coverage</p>
                  </div>
                  <span className="insight-pill" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{stats.total.toLocaleString()} total</span>
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  {roleDistribution.slice(0, 4).map((role) => (
                    <div key={role.role} className="insight-progress" style={{ marginBottom: '4px' }}>
                      <div className="insight-progress__meta" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>
                        <span>{role.role}</span>
                        <span>{role.count} · {role.percent}%</span>
                      </div>
                      <div className="insight-progress__track" style={{ height: '4px' }}>
                        <span className="insight-progress__bar" style={{ width: `${role.percent}%`, height: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {cityHighlights.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>CITY MIX</p>
                  </div>
                  <span className="insight-pill muted" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{uniqueCitiesCount} cities</span>
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  <table className="city-mix-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#ffffff' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>City</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Players</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityHighlights.slice(0, 5).map((city) => (
                        <tr key={city.city} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: '#ffffff' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '600', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#111827' }}>{city.city}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{city.count}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{city.percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {recentPlayers.length > 0 && (
              <article className="insight-card" style={{ padding: '8px' }}>
                <header className="insight-card__header" style={{ padding: '0 0 4px 0', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', marginBottom: '0' }}>LATEST ACTIVITY</p>
                  </div>
                  {formattedLastUpdated && <span className="insight-pill muted" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Synced {formattedLastUpdated}</span>}
                </header>
                <div className="insight-card__body" style={{ padding: 0 }}>
                  <table className="recent-activity-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#ffffff' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Player ID</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>City</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: '0.65rem', fontWeight: '600', color: '#1f2937', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPlayers.map((player) => (
                        <tr key={player._id} style={{ borderBottom: '1px solid var(--border-color, #f3f4f6)', backgroundColor: '#ffffff' }}>
                          <td style={{ padding: '4px 8px', fontWeight: '600', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#111827' }}>{player.name}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{extractPlayerNumber(player.playerId)}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{player.city || 'City TBD'}</td>
                          <td style={{ padding: '4px 8px', color: '#111827', fontSize: '0.8rem', backgroundColor: '#ffffff' }}>{formatRecentDate(getPlayerTimestampValue(player))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}
          </section>
        )}

        <section className="surface-card players-workspace">
          <header className="workspace-header">
            <div className="workspace-header__top">
              <div className="workspace-header__titles">
                <h2>Registered players</h2>
                <span>{filteredPlayers.length} match{filteredPlayers.length === 1 ? '' : 'es'} · total {stats.total}</span>
              </div>
              <div className="view-toggle-buttons" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`admin-btn ${viewMode === 'table' ? 'primary' : 'subtle'}`}
                  style={{ 
                    padding: '6px 12px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Table View"
                >
                  <span>📊</span>
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('card')}
                  className={`admin-btn ${viewMode === 'card' ? 'primary' : 'subtle'}`}
                  style={{ 
                    padding: '6px 12px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Card View"
                >
                  <span>🎴</span>
                  <span>Card</span>
                </button>
              </div>
            </div>
            <div className="simple-filters-bar">
              <label className="simple-search-input">
                <span className="simple-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, city, or ID"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                />
              </label>
              <select
                className="simple-filter-select"
                value={filters.role}
                onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="">All roles</option>
                {getRoleOptions().map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                className="simple-filter-select"
                value={filters.city}
                onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
              >
                <option value="">All cities</option>
                {[...new Set(players.map((p) => p.city).filter(Boolean))].map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              {(filters.search || filters.role || filters.city) && (
                <button
                  type="button"
                  className="simple-filter-clear"
                  onClick={handleClearFilters}
                >
                  Clear
                </button>
              )}
            </div>
          </header>

          {selectedPlayers.length > 0 && (
            <div className="selection-banner">
              <span>
                {selectedPlayers.length} selected{' '}
                {selectedPlayers.length === 1 ? 'player' : 'players'}
              </span>
              <div className="selection-banner__actions">
                <button
                  type="button"
                  className="admin-btn subtle"
                  onClick={() => setSelectedPlayers([])}
                >
                  Clear
                </button>
                <select onChange={handleBatchAction} defaultValue="">
                  <option value="" disabled>
                    Batch actions
                  </option>
                  <option value="download">Download RP Cards</option>
                  <option value="delete">Delete selected</option>
                  <option value="export">Export selection</option>
                </select>
              </div>
            </div>
          )}

          <div className="workspace-body">
            {filteredPlayers.length === 0 ? (
              <div className="workspace-empty">
                <h3>No players found</h3>
                <p>
                  {players.length === 0
                    ? 'No players registered yet. Share your registration link to collect entries.'
                    : 'No players match the current filters. Try adjusting your search.'}
                </p>
                {players.length === 0 && (
                  <button
                    type="button"
                    className="admin-btn primary"
                    onClick={handleCopyLink}
                  >
                    Copy registration link
                  </button>
                )}
              </div>
            ) : viewMode === 'table' ? (
              <table className="players-table-simple">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Player ID</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>City</th>
                    <th>Mobile</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPlayers.map((player, index) => {
                    const photoUrl = player.photo ? getAssetUrl(player.photo) : null;
                    const hasReceipt = player.receipt && (typeof player.receipt === 'string' ? player.receipt.trim() !== '' : Boolean(player.receipt));
                    return (
                      <tr key={player._id}>
                        <td>
                          <div 
                            className="table-player-photo"
                            onClick={() => photoUrl && setSelectedImageModal(player)}
                            style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                          >
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={player.name}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div className="table-photo-placeholder" style={{ display: photoUrl ? 'none' : 'flex' }}>
                              👤
                            </div>
                          </div>
                        </td>
                        <td>{player.playerId?.split('-').pop() || player.playerId}</td>
                        <td>{player.name}</td>
                        <td>{player.role || 'N/A'}</td>
                        <td>{player.city || 'N/A'}</td>
                        <td>{player.mobile || 'N/A'}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="table-btn"
                              onClick={() => setSelectedPlayerModal(player)}
                              title="View"
                            >
                              👁️
                            </button>
                            <button
                              className="table-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasReceipt) {
                                  openPreview('receipt', player.receipt, `${player.name} - Payment Receipt`);
                                } else {
                                  toast.info('No receipt available for this player');
                                }
                              }}
                              title={hasReceipt ? "View payment receipt" : "No receipt available"}
                              disabled={!hasReceipt}
                              style={{ opacity: hasReceipt ? 1 : 0.5, cursor: hasReceipt ? 'pointer' : 'not-allowed' }}
                            >
                              🧾
                            </button>
                            <button
                              className="table-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPhotoEditor(player);
                              }}
                              title="Update Photo"
                            >
                              📸
                            </button>
                            <button
                              className="table-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPlayer(player);
                              }}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              className="table-btn table-btn-danger"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to delete ${player.name}? This action cannot be undone.`)) {
                                  await handleDeletePlayer(player);
                                }
                              }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="players-card-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                padding: '16px 0'
              }}>
                {paginatedPlayers.map((player) => {
                  const photoUrl = player.photo ? getAssetUrl(player.photo) : null;
                  const hasReceipt = player.receipt && (typeof player.receipt === 'string' ? player.receipt.trim() !== '' : Boolean(player.receipt));
                  const isDropdownOpen = openDropdownId === player._id;
                  
                  return (
                    <div
                      key={player._id}
                      className="player-card"
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Player Photo */}
                      <div
                        onClick={() => photoUrl && setSelectedImageModal(player)}
                        style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          margin: '0 auto',
                          cursor: photoUrl ? 'pointer' : 'default',
                          backgroundColor: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={player.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div style={{ display: photoUrl ? 'none' : 'flex', fontSize: '48px' }}>
                          👤
                        </div>
                      </div>

                      {/* Player Information */}
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <h3 style={{
                          margin: '0 0 8px 0',
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {player.name}
                        </h3>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}>
                          <div>
                            <strong style={{ color: '#374151' }}>ID:</strong> {player.playerId?.split('-').pop() || player.playerId}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>Role:</strong> {player.role || 'N/A'}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>City:</strong> {player.city || 'N/A'}
                          </div>
                          <div>
                            <strong style={{ color: '#374151' }}>Mobile:</strong> {player.mobile || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Action Dropdown */}
                      <div className="player-card-dropdown" style={{ position: 'relative', marginTop: 'auto' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(isDropdownOpen ? null : player._id);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>Actions</span>
                          <span>{isDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        
                        {isDropdownOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: 0,
                              right: 0,
                              marginBottom: '4px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                              zIndex: 10,
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden'
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                setSelectedPlayerModal(player);
                              }}
                              style={{
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#374151'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <span>👁️</span>
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                if (hasReceipt) {
                                  openPreview('receipt', player.receipt, `${player.name} - Payment Receipt`);
                                } else {
                                  toast.info('No receipt available for this player');
                                }
                              }}
                              disabled={!hasReceipt}
                              style={{
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: hasReceipt ? 'pointer' : 'not-allowed',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: hasReceipt ? '#374151' : '#9ca3af',
                                opacity: hasReceipt ? 1 : 0.5
                              }}
                              onMouseEnter={(e) => hasReceipt && (e.target.style.backgroundColor = '#f9fafb')}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <span>🧾</span>
                              <span>View Receipt</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                handleOpenPhotoEditor(player);
                              }}
                              style={{
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#374151'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <span>📸</span>
                              <span>Update Photo</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                handleEditPlayer(player);
                              }}
                              style={{
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#374151'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setOpenDropdownId(null);
                                if (window.confirm(`Are you sure you want to delete ${player.name}? This action cannot be undone.`)) {
                                  await handleDeletePlayer(player);
                                }
                              }}
                              style={{
                                padding: '10px 12px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#dc3545',
                                borderTop: '1px solid #e5e7eb'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#fef2f2'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {filteredPlayers.length > 0 && (
            <footer className="workspace-footer">
              <div className="workspace-footer__meta">
                Showing {filteredPlayers.length === 0 ? 0 : `${startIndex}-${endIndex}`} of{' '}
                {filteredPlayers.length} filtered · Total registered {stats.total}
              </div>
              <div className="workspace-pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="pagination-status">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </footer>
          )}
        </section>

        {photoEditorPlayer && (
          <div className="modal-overlay photo-editor-overlay" onClick={handleClosePhotoEditor}>
            <div className="modal-content photo-editor-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ flex: 1 }}>
                  <h3>Update player photo</h3>
                  <div
                    className="photo-editor-summary"
                    style={{
                      marginTop: '0.5rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted, #4b5563)'
                    }}
                  >
                    <strong>{photoEditorPlayer.name}</strong>
                    <span> · {photoEditorPlayer.playerId}</span>
                  </div>
                </div>
                <button
                  className="modal-close"
                  onClick={handleClosePhotoEditor}
                  aria-label="Close modal"
                  disabled={photoEditorSaving}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <ImageUploadCrop
                  key={photoEditorPlayer._id}
                  aspect={3 / 4}
                  uploadType="playerPhoto"
                  uploadPath={`${API_BASE_URL}/api/players/upload-photo`}
                  initialImage={photoEditorPlayer.photo ? getAssetUrl(photoEditorPlayer.photo) : undefined}
                  previewShape="square"
                  onUploadComplete={handlePhotoUploadComplete}
                  onError={(message) => toast.error(message)}
                />
                {photoEditorSaving && (
                  <div
                    className="photo-editor-status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginTop: '1rem'
                    }}
                  >
                    <span className="loading-spinner" aria-hidden="true" />
                    <span>Saving optimized image to player profile…</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAddPlayerModal && (
          <div className="modal-overlay" onClick={() => {
            setShowAddPlayerModal(false);
            setEditingPlayer(null);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editingPlayer ? 'Edit Player' : 'Add Player Manually'}</h3>
                <button className="modal-close" onClick={() => {
                  setShowAddPlayerModal(false);
                  setEditingPlayer(null);
                }} aria-label="Close modal">✕</button>
              </div>
              <div className="modal-body">
                {editingPlayer ? (
                  <EditPlayerForm
                    player={editingPlayer}
                    tournament={tournament}
                    onSuccess={() => {
                      setShowAddPlayerModal(false);
                      setEditingPlayer(null);
                      fetchPlayers();
                      toast.success('Player updated successfully!');
                    }}
                    onCancel={() => {
                      setShowAddPlayerModal(false);
                      setEditingPlayer(null);
                    }}
                  />
                ) : (
                  <PlayerRegister
                    tournamentCode={code}
                    adminMode={true}
                    onSuccess={() => {
                      setShowAddPlayerModal(false);
                      fetchPlayers();
                      toast.success('Player added successfully!');
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {preview && (
        <div className="players-preview-overlay" onClick={closePreview}>
          <div className="players-preview" onClick={(e) => e.stopPropagation()}>
            <button className="preview-close" onClick={closePreview} aria-label="Close preview">
              ×
            </button>
            <h3>{preview.title}</h3>
            {preview.type === 'photo' ? (
              <img src={preview.url} alt={preview.title} />
            ) : (
              <img src={preview.url} alt={preview.title} />
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImageModal && selectedImageModal.photo && (
        <div className="player-image-modal-overlay" onClick={() => setSelectedImageModal(null)}>
          <div className="player-image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="player-image-modal-close" onClick={() => setSelectedImageModal(null)} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img 
              src={getAssetUrl(selectedImageModal.photo)} 
              alt={selectedImageModal.name}
              className="player-image-modal-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="player-image-modal-name">{selectedImageModal.name}</div>
          </div>
        </div>
      )}

      {selectedPlayerModal && (
        <div className="teams-modal-overlay" onClick={() => setSelectedPlayerModal(null)}>
          <div className="teams-modal" onClick={(e) => e.stopPropagation()}>
            <div className="teams-modal-header">
              <h2 className="teams-modal-title">👤 {selectedPlayerModal.name}</h2>
              <button className="teams-modal-close" onClick={() => setSelectedPlayerModal(null)}>×</button>
            </div>
            <div className="teams-modal-body">
              <div className="teams-modal-logo">
                {selectedPlayerModal.photo ? (
                  <img
                    src={getAssetUrl(selectedPlayerModal.photo)}
                    alt={selectedPlayerModal.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className="teams-modal-logo-placeholder" style={{ display: selectedPlayerModal.photo ? 'none' : 'flex' }}>👤</div>
              </div>
              <div className="teams-modal-player-name">
                <h3>{selectedPlayerModal.name}</h3>
              </div>
              <div className="teams-modal-details">
                <div className="teams-modal-detail">
                  <strong>Player ID:</strong>
                  <span>{selectedPlayerModal.playerId}</span>
                </div>
                <div className="teams-modal-detail">
                  <strong>Role:</strong>
                  <span>{selectedPlayerModal.role || 'N/A'}</span>
                </div>
                <div className="teams-modal-detail">
                  <strong>City:</strong>
                  <span>{selectedPlayerModal.city || 'N/A'}</span>
                </div>
                {selectedPlayerModal.mobile && (
                  <div className="teams-modal-detail">
                    <strong>Contact:</strong>
                    <span>+91 {selectedPlayerModal.mobile}</span>
                  </div>
                )}
                {selectedPlayerModal.email && (
                  <div className="teams-modal-detail">
                    <strong>Email:</strong>
                    <span>{selectedPlayerModal.email}</span>
                  </div>
                )}
                <div className="teams-modal-detail">
                  <strong>Sport:</strong>
                  <span>{tournament?.sport || 'N/A'}</span>
                </div>
                {selectedPlayerModal.registeredAt && (
                  <div className="teams-modal-detail">
                    <strong>Registered:</strong>
                    <span>{new Date(selectedPlayerModal.registeredAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                )}
              </div>
              {selectedPlayerModal.remarks && (
                <div className="teams-modal-players">
                  <h4 className="teams-modal-players-title">📝 Remarks</h4>
                  <div className="teams-modal-players-list">
                    <div className="teams-modal-player-item">
                      {selectedPlayerModal.remarks}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="teams-modal-footer">
              <button
                className="teams-btn teams-btn-primary"
                onClick={() => {
                  handleViewCard(selectedPlayerModal);
                  setSelectedPlayerModal(null);
                }}
              >
                📄 View Full Card
              </button>
              <button
                className="teams-btn teams-btn-secondary"
                onClick={() => {
                  handleOpenPhotoEditor(selectedPlayerModal);
                  setSelectedPlayerModal(null);
                }}
              >
                📸 Update Photo
              </button>
              <button
                className="teams-btn teams-btn-secondary"
                onClick={() => {
                  handleEditPlayer(selectedPlayerModal);
                  setSelectedPlayerModal(null);
                }}
              >
                ✏️ Edit Player
              </button>
              <button
                className="teams-btn teams-btn-secondary"
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete ${selectedPlayerModal.name}? This action cannot be undone.`)) {
                    await handleDeletePlayer(selectedPlayerModal);
                    setSelectedPlayerModal(null);
                  }
                }}
              >
                🗑️ Delete Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Players Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={handleCloseImportModal}>
          <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Players</h2>
              <button className="modal-close" onClick={handleCloseImportModal}>×</button>
            </div>

            <div className="modal-body import-modal-body">
              {/* Instructions Section */}
              <div className="import-instructions-section">
                <button
                  type="button"
                  className="import-instructions-toggle"
                  onClick={() => setShowImportInstructions(!showImportInstructions)}
                >
                  📖 {showImportInstructions ? 'Hide' : 'Show'} Import Instructions
                </button>
                
                {showImportInstructions && (
                  <div className="import-instructions-content">
                    <h3>Step 1: Prepare Your File</h3>
                    <ol>
                      <li>Download the sample template using "Download Template" button</li>
                      <li>Open template in Excel or text editor</li>
                      <li>Fill in required fields for each player</li>
                      <li>Add optional fields as needed</li>
                    </ol>

                    <h3>Step 2: File Requirements</h3>
                    <ul>
                      <li>Format: CSV (.csv) or Excel (.xlsx)</li>
                      <li>Encoding: UTF-8</li>
                      <li>Max file size: 10MB</li>
                      <li>First row: Must contain column headers</li>
                    </ul>

                    <h3>Step 3: Required Fields</h3>
                    <ul>
                      <li><strong>name</strong>: Player full name</li>
                      <li><strong>mobile</strong>: 10-digit Indian format (e.g., "9876543210")</li>
                      <li><strong>city</strong>: City/Place name</li>
                      <li><strong>role</strong>: Valid role for tournament sport {tournament && (tournament.sport === 'Cricket' ? '(Batsman, Bowler, All-Rounder, Wicketkeeper)' :
                                     tournament.sport === 'Football' ? '(Goalkeeper, Defender, Midfielder, Forward)' :
                                     tournament.sport === 'Volleyball' ? '(Setter, Attacker, Blocker, Libero)' :
                                     '(Point Guard, Center, Forward, Shooting Guard)')}</li>
                    </ul>

                    <h3>Step 4: Optional Fields</h3>
                    <ul>
                      <li><strong>remarks</strong>: Special notes</li>
                      <li><strong>photo</strong>: Photo path (uploads/players/...) or URL</li>
                      <li><strong>receipt</strong>: Receipt path (uploads/...) or URL</li>
                      <li><strong>basePrice</strong>: Base price for auction (default: 1000)</li>
                    </ul>

                    <h3>Step 5: Photo Instructions</h3>
                    <p><strong>Option 1: Relative Path</strong></p>
                    <ul>
                      <li>Format: <code>uploads/players/filename.jpg</code></li>
                      <li>File must exist on server</li>
                      <li>Upload photo files to server first, then reference in import file</li>
                    </ul>
                    <p><strong>Option 2: Full URL</strong></p>
                    <ul>
                      <li>Format: <code>https://example.com/photo.jpg</code></li>
                      <li>Will be downloaded automatically during import</li>
                    </ul>
                    <p><strong>Option 3: Leave Empty</strong></p>
                    <ul>
                      <li>Player will be created without photo</li>
                      <li>Photo can be added later via edit</li>
                    </ul>

                    <h3>Step 6: Receipt Instructions</h3>
                    <p><strong>Option 1: Relative Path</strong></p>
                    <ul>
                      <li>Format: <code>uploads/receipts/filename.pdf</code></li>
                      <li>File must exist on server</li>
                    </ul>
                    <p><strong>Option 2: Full URL</strong></p>
                    <ul>
                      <li>Format: <code>https://example.com/receipt.pdf</code></li>
                      <li>Will be downloaded automatically</li>
                    </ul>
                    <p><strong>Option 3: Leave Empty</strong></p>
                    <ul>
                      <li>Player will be created without receipt</li>
                    </ul>

                    <h3>Common Issues & Solutions</h3>
                    <ul>
                      <li><strong>"Invalid mobile number"</strong>: Use 10-digit format without spaces</li>
                      <li><strong>"Invalid role"</strong>: Must match valid roles for tournament sport</li>
                      <li><strong>"Photo not found"</strong>: Verify file path or URL is correct and accessible</li>
                      <li><strong>"Receipt not found"</strong>: Verify file path or URL is correct and accessible</li>
                      <li><strong>"Duplicate player"</strong>: Player with same mobile already exists</li>
                      <li><strong>"Encoding error"</strong>: Save file as UTF-8 encoding</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* File Upload Section */}
              {!importPreview && !importResults && (
                <div className="import-upload-section">
                  <h3>Select File</h3>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="import-file-input"
                      accept=".csv,.xlsx"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="import-file-input" className="file-upload-label">
                      {importFile ? (
                        <div>
                          <span className="file-icon">📄</span>
                          <span className="file-name">{importFile.name}</span>
                          <span className="file-size">({(importFile.size / 1024).toFixed(2)} KB)</span>
                        </div>
                      ) : (
                        <div>
                          <span className="file-icon">📤</span>
                          <span>Click to select CSV or Excel file</span>
                          <small>Max size: 10MB</small>
                        </div>
                      )}
                    </label>
                  </div>

                  {importFile && (
                    <div className="import-actions">
                      <button
                        type="button"
                        className="admin-btn primary"
                        onClick={handleFileUpload}
                        disabled={importLoading}
                      >
                        {importLoading ? 'Processing...' : 'Preview Import'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn subtle"
                        onClick={() => {
                          setImportFile(null);
                          document.getElementById('import-file-input').value = '';
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Section */}
              {importPreview && importMode === 'preview' && (
                <div className="import-preview-section">
                  <h3>Preview (First 10 Rows)</h3>
                  <div className="preview-summary">
                    <div className="summary-item">
                      <span className="summary-label">Total Rows:</span>
                      <span className="summary-value">{importPreview.totalRows}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Valid:</span>
                      <span className="summary-value valid">{importPreview.summary.valid}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Invalid:</span>
                      <span className="summary-value error">{importPreview.summary.invalid}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Warnings:</span>
                      <span className="summary-value warning">{importPreview.summary.withWarnings}</span>
                    </div>
                  </div>

                  <div className="preview-table-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Name</th>
                          <th>Mobile</th>
                          <th>City</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Errors/Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.results.map((result, idx) => (
                          <tr key={idx} className={result.isValid ? 'row-valid' : 'row-invalid'}>
                            <td>{result.rowNumber}</td>
                            <td>{result.data.name || '—'}</td>
                            <td>{result.data.mobile || '—'}</td>
                            <td>{result.data.city || '—'}</td>
                            <td>{result.data.role || '—'}</td>
                            <td>
                              <span className={`status-badge ${result.isValid ? 'valid' : 'invalid'}`}>
                                {result.isValid ? '✓ Valid' : '✗ Invalid'}
                              </span>
                            </td>
                            <td>
                              {result.errors.length > 0 && (
                                <div className="error-list">
                                  {result.errors.map((error, i) => (
                                    <span key={i} className="error-item">⚠ {error}</span>
                                  ))}
                                </div>
                              )}
                              {result.warnings.length > 0 && (
                                <div className="warning-list">
                                  {result.warnings.map((warning, i) => (
                                    <span key={i} className="warning-item">ℹ {warning}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="import-actions">
                    <button
                      type="button"
                      className="admin-btn primary"
                      onClick={handleExecuteImport}
                      disabled={importLoading || importPreview.summary.invalid > 0}
                    >
                      {importLoading ? 'Importing...' : 'Execute Import'}
                    </button>
                    <button
                      type="button"
                      className="admin-btn subtle"
                      onClick={() => {
                        setImportPreview(null);
                        setImportFile(null);
                        document.getElementById('import-file-input').value = '';
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {importPreview.summary.invalid > 0 && (
                    <div className="import-warning">
                      ⚠️ Please fix errors before importing. Invalid rows will be skipped.
                    </div>
                  )}
                </div>
              )}

              {/* Results Section */}
              {importResults && importMode === 'import' && (
                <div className="import-results-section">
                  <h3>Import Results</h3>
                  <div className="results-summary">
                    <div className="summary-card success">
                      <span className="summary-icon">✓</span>
                      <div>
                        <span className="summary-label">Success</span>
                        <span className="summary-value">{importResults.summary.success}</span>
                      </div>
                    </div>
                    <div className="summary-card updated">
                      <span className="summary-icon">↻</span>
                      <div>
                        <span className="summary-label">Updated</span>
                        <span className="summary-value">{importResults.summary.updated}</span>
                      </div>
                    </div>
                    <div className="summary-card skipped">
                      <span className="summary-icon">⊘</span>
                      <div>
                        <span className="summary-label">Skipped</span>
                        <span className="summary-value">{importResults.summary.skipped}</span>
                      </div>
                    </div>
                    <div className="summary-card error">
                      <span className="summary-icon">✗</span>
                      <div>
                        <span className="summary-label">Errors</span>
                        <span className="summary-value">{importResults.summary.errors}</span>
                      </div>
                    </div>
                  </div>

                  {importResults.summary.errors > 0 && (
                    <div className="error-results">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4>Failed Rows</h4>
                        <button
                          type="button"
                          className="admin-btn subtle"
                          onClick={handleDownloadErrorFile}
                        >
                          📥 Download Error File
                        </button>
                      </div>
                      <div className="error-list-container">
                        {importResults.results
                          .filter(r => r.status === 'error')
                          .map((result, idx) => (
                            <div key={idx} className="error-item-card">
                              <div className="error-header">
                                <span>Row {result.rowNumber}</span>
                                <span className="error-message">{result.message}</span>
                              </div>
                              <div className="error-data">
                                <strong>Name:</strong> {result.data.name || '—'} | 
                                <strong> Mobile:</strong> {result.data.mobile || '—'} | 
                                <strong> Role:</strong> {result.data.role || '—'}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="import-actions">
                    <button
                      type="button"
                      className="admin-btn primary"
                      onClick={handleCloseImportModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Footer */}
      <footer style={{
        marginTop: '40px',
        padding: '24px 0',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#111827'
          }}>
            <img 
              src="/logo192.png" 
              alt="PlayLive Logo" 
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain'
              }}
            />
            <span>PlayLive</span>
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            Tournament Management Platform
          </p>
          <p style={{
            margin: 0,
            fontSize: '0.75rem',
            color: '#9ca3af'
          }}>
            © {new Date().getFullYear()} PlayLive. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}

export default TournamentPlayers;
