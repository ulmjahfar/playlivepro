import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import TournamentAdminLayout from './components/TournamentAdminLayout';
import ImageUploadCrop from './components/ImageUploadCrop';
import { toast } from 'react-toastify';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-tournament-view.css';
import './styles-tournament-teams.css';

function TournamentTeams() {
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState({ total: 0, remaining: 0, teams: 0, auctionReady: false });
  const [user] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [teams, setTeams] = useState([]);
  const [teamFilters, setTeamFilters] = useState({ search: '', sort: 'createdAt', group: 'all' });
  const [teamViewMode, setTeamViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    const storedMode = window.localStorage.getItem('teamsViewMode');
    return storedMode === 'list' ? 'list' : 'grid';
  });
  const [groupViewMode, setGroupViewMode] = useState(false);
  const [teamModal, setTeamModal] = useState(null);
  const [playerImageModal, setPlayerImageModal] = useState(null);
  const [editTeam, setEditTeam] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editLogoPath, setEditLogoPath] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [teamRegistrationStatus, setTeamRegistrationStatus] = useState('Not Started');
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importMode, setImportMode] = useState('preview');
  const [importLoading, setImportLoading] = useState(false);
  const [showImportInstructions, setShowImportInstructions] = useState(false);
  const navigate = useNavigate();
  const { code } = useParams();

  const isAuctionPro = useMemo(() => {
    const plan = tournament?.plan;
    if (!plan) return false;
    return plan.toString().replace(/\s+/g, '').toLowerCase() === 'auctionpro';
  }, [tournament?.plan]);

  // Removed unused fetchTournament and fetchPlayers functions - data is loaded in useEffect

  const fetchTeams = useCallback(async (showRefreshing = false, tournamentData) => {
    try {
      if (showRefreshing) setRefreshing(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/teams/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const currentTournament = tournamentData || tournament;
      setTeams(res.data.teams || []);
      setStats(prev => ({
        ...prev,
        teams: res.data.teams?.length || 0,
        auctionReady: currentTournament?.status === 'Active'
      }));
      setTeamRegistrationStatus(currentTournament?.teamRegistrationEnabled ? 'Active' : 'Closed');
    } catch (err) {
      console.error('Error fetching teams:', err);
      toast.error('Failed to load teams');
    } finally {
      setRefreshing(false);
    }
  }, [code, tournament]);

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
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      return;
    }
    const loadData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const [tournamentRes, playersRes, teamsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/players/${code}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { players: [] } })),
          axios.get(`${API_BASE_URL}/api/teams/${code}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => ({ data: { teams: [] } }))
        ]);

        const tournamentData = tournamentRes.data.tournament;
        setTournament(tournamentData);

        // Update stats with players
        const maxPlayers = tournamentData?.maxPlayers || 100;
        const playersCount = playersRes.data.players?.length || 0;
        setStats(prev => ({
          ...prev,
          total: playersCount,
          remaining: maxPlayers - playersCount
        }));

        // Update teams and related stats
        const teams = teamsRes.data.teams || [];
        setTeams(teams);
        setStats(prev => ({
          ...prev,
          teams: teams.length,
          auctionReady: tournamentData?.status === 'Active'
        }));
        setTeamRegistrationStatus(tournamentData?.teamRegistrationEnabled ? 'Active' : 'Closed');
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Failed to load tournament data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, navigate, code]);

  const handleCopyTeamLink = async () => {
    const link = `${window.location.origin}/register/team/${code}`;
    const success = await copyToClipboard(link);
    if (success) {
      toast.success('✅ Team link copied to clipboard!');
    } else {
      toast.error('Failed to copy team link');
    }
  };

  const handleShareWhatsApp = () => {
    const link = `${window.location.origin}/register/team/${code}`;
    const message = `🏆 Join the ${tournament?.name || 'Tournament'}!\nRegister your team here:\n🔗 ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCloseRegistration = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/close-registration`,
        { scope: 'team' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Team registration closed successfully');
      const tournamentRes = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedTournament = tournamentRes.data.tournament;
      setTournament(updatedTournament);
      await fetchTeams(false, updatedTournament);
    } catch (err) {
      console.error(err);
      toast.error('Failed to close team registration');
    }
  };

  const handleReopenRegistration = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/reopen-registration`,
        { scope: 'team' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Team registration reopened successfully');
      const tournamentRes = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updatedTournament = tournamentRes.data.tournament;
      setTournament(updatedTournament);
      await fetchTeams(false, updatedTournament);
    } catch (err) {
      console.error(err);
      toast.error('Failed to reopen team registration');
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API_BASE_URL}/api/teams/${teamId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Team "${teamName}" deleted successfully`);
      await fetchTeams(false); // Refresh the teams list
      if (teamModal && teamModal._id === teamId) {
        setTeamModal(null); // Close modal if the deleted team was open
      }
      if (editTeam && editTeam._id === teamId) {
        setEditTeam(null); // Close edit modal if the deleted team was open
      }
    } catch (err) {
      console.error('Error deleting team:', err);
      toast.error(err.response?.data?.message || 'Failed to delete team');
    }
  };

  const handleOpenEdit = (team) => {
    setEditTeam(team);
    setEditFormData({
      name: team.name || '',
      captainName: team.captainName || '',
      mobile: team.mobile || '',
      email: team.email || '',
      city: team.city || '',
      numberOfPlayers: team.numberOfPlayers || '',
      guestPlayers: team.guestPlayers ? [...team.guestPlayers] : [],
      teamIcons: team.teamIcons ? [...team.teamIcons] : [],
      group: team.group || '',
      groupIndex: team.groupIndex || ''
    });
    // Set current logo path if exists (store the relative path, not full URL)
    setEditLogoPath(team.logo || '');
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    const processedValue = name === 'name' ? value.toUpperCase() : value;
    setEditFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleUpdateGuestPlayer = (index, field, value) => {
    const updatedGuests = [...editFormData.guestPlayers];
    if (!updatedGuests[index]) {
      updatedGuests[index] = { name: '', role: '', photo: '' };
    }
    updatedGuests[index][field] = value;
    setEditFormData(prev => ({ ...prev, guestPlayers: updatedGuests }));
  };

  const handleAddGuestPlayer = () => {
    if (editFormData.guestPlayers.length >= 2) {
      toast.warning('Maximum 2 guest players allowed');
      return;
    }
    setEditFormData(prev => ({
      ...prev,
      guestPlayers: [...prev.guestPlayers, { name: '', role: '', photo: '' }]
    }));
  };

  const handleRemoveGuestPlayer = (index) => {
    setEditFormData(prev => ({
      ...prev,
      guestPlayers: prev.guestPlayers.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateTeam = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!editTeam) {
      console.error('No editTeam found');
      toast.error('No team selected for editing');
      return;
    }

    try {
      setEditSubmitting(true);
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Authentication required. Please login again.');
        setEditSubmitting(false);
        return;
      }

      // Validate required fields
      if (!editFormData.name || editFormData.name.trim().length < 3) {
        toast.error('Team name must be at least 3 characters');
        setEditSubmitting(false);
        return;
      }

      if (!editFormData.captainName || !editFormData.captainName.trim()) {
        toast.error('Captain name is required');
        setEditSubmitting(false);
        return;
      }

      if (!editFormData.mobile || !editFormData.mobile.trim()) {
        toast.error('Mobile number is required');
        setEditSubmitting(false);
        return;
      }

      if (!editFormData.email || !editFormData.email.trim()) {
        toast.error('Email is required');
        setEditSubmitting(false);
        return;
      }

      if (!editFormData.city || !editFormData.city.trim()) {
        toast.error('City is required');
        setEditSubmitting(false);
        return;
      }

      // Prepare form data - use FormData for multer compatibility
      const formDataToSend = new FormData();
      
      // Always send all fields, even if empty (backend will check for undefined)
      formDataToSend.append('name', (editFormData.name || '').trim().toUpperCase());
      formDataToSend.append('captainName', (editFormData.captainName || '').trim());
      formDataToSend.append('mobile', (editFormData.mobile || '').trim());
      formDataToSend.append('email', (editFormData.email || '').trim());
      formDataToSend.append('city', (editFormData.city || '').trim());
      
      // Send numberOfPlayers if it exists
      if (editFormData.numberOfPlayers !== undefined && editFormData.numberOfPlayers !== null && editFormData.numberOfPlayers !== '') {
        formDataToSend.append('numberOfPlayers', String(editFormData.numberOfPlayers));
      }
      
      // Always send guestPlayers and teamIcons as JSON strings
      formDataToSend.append('guestPlayers', JSON.stringify(editFormData.guestPlayers || []));
      formDataToSend.append('teamIcons', JSON.stringify(editFormData.teamIcons || []));
      
      // Send group and groupIndex if provided
      if (editFormData.group !== undefined) {
        formDataToSend.append('group', editFormData.group.trim() || '');
      }
      if (editFormData.groupIndex !== undefined && editFormData.groupIndex !== null && editFormData.groupIndex !== '') {
        formDataToSend.append('groupIndex', String(editFormData.groupIndex));
      }
      
      // Add logo path if a new logo was uploaded
      if (editLogoPath) {
        // Normalize logo path - remove leading slash if present
        let normalizedLogoPath = editLogoPath;
        if (normalizedLogoPath.startsWith('/')) {
          normalizedLogoPath = normalizedLogoPath.substring(1);
        }
        // Only send if it's a valid uploads path
        if (normalizedLogoPath.startsWith('uploads/')) {
          formDataToSend.append('logoPath', normalizedLogoPath);
        }
      }

      // Log form data for debugging
      const formDataEntries = {};
      for (let [key, value] of formDataToSend.entries()) {
        formDataEntries[key] = value;
      }
      const response = await axios.put(
        `${API_BASE_URL}/api/teams/${editTeam._id}`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`
            // Don't set Content-Type - let axios set it automatically for FormData
          }
        }
      );

      if (response.data.success) {
        toast.success('Team updated successfully');
        setEditTeam(null);
        setEditLogoPath('');
        await fetchTeams(false);
        if (teamModal && teamModal._id === editTeam._id) {
          setTeamModal(null);
        }
      } else {
        toast.error(response.data.message || 'Failed to update team');
      }
    } catch (err) {
      console.error('Error updating team:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update team';
      toast.error(errorMessage);
      console.error('Error details:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const [tournamentRes, playersRes, teamsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/players/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { players: [] } })),
        axios.get(`${API_BASE_URL}/api/teams/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { teams: [] } }))
      ]);

      const tournamentData = tournamentRes.data.tournament;
      setTournament(tournamentData);

      // Update stats with players
      const maxPlayers = tournamentData?.maxPlayers || 100;
      const playersCount = playersRes.data.players?.length || 0;
      setStats(prev => ({
        ...prev,
        total: playersCount,
        remaining: maxPlayers - playersCount
      }));

      // Update teams and related stats
      const teams = teamsRes.data.teams || [];
      setTeams(teams);
      setStats(prev => ({
        ...prev,
        teams: teams.length,
        auctionReady: tournamentData?.status === 'Active'
      }));
      setTeamRegistrationStatus(tournamentData?.teamRegistrationEnabled ? 'Active' : 'Closed');
      toast.success('Data refreshed successfully');
    } catch (err) {
      console.error('Error refreshing data:', err);
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/teams/import/template/${code}`,
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
      a.download = `team_import_template_${code}.xlsx`;
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

  const handleExportExcel = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/teams/excel/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `teams_${code}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Teams exported successfully');
    } catch (err) {
      console.error('Error exporting teams:', err);
      toast.error(err.response?.data?.message || 'Error exporting teams to Excel');
    }
  }, [code]);

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
    const headers = ['Row Number', 'Team Name', 'Captain Name', 'Mobile', 'Email', 'City', 'Number of Players', 'Error Message'];
    const rows = errorRows.map(result => [
      result.rowNumber,
      result.data.teamName || '',
      result.data.captainName || '',
      result.data.mobile || '',
      result.data.email || '',
      result.data.city || '',
      result.data.numberOfPlayers || '',
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
    a.download = `team_import_errors_${code}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    toast.success('Error file downloaded');
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
        `${API_BASE_URL}/api/teams/import/${code}`,
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
          toast.success(`Import completed! ${response.data.summary.success} teams created, ${response.data.summary.updated} updated, ${response.data.summary.errors} errors`);
          await fetchTeams(false);
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
        `${API_BASE_URL}/api/teams/import/${code}`,
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
        toast.success(`Import completed! ${response.data.summary.success} teams created, ${response.data.summary.updated} updated, ${response.data.summary.errors} errors`);
        await fetchTeams(false);
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

  // Apply team filters and sorting
  useEffect(() => {
    let filtered = teams.filter(team => {
      const matchesSearch = !teamFilters.search ||
        team.name?.toLowerCase().includes(teamFilters.search.toLowerCase()) ||
        team.captainName?.toLowerCase().includes(teamFilters.search.toLowerCase()) ||
        team.city?.toLowerCase().includes(teamFilters.search.toLowerCase());
      
      const matchesGroup = teamFilters.group === 'all' || 
        (teamFilters.group === 'ungrouped' && !team.group) ||
        team.group === teamFilters.group;
      
      return matchesSearch && matchesGroup;
    });

    // Sort
    filtered.sort((a, b) => {
      if (teamFilters.sort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (teamFilters.sort === 'city') return (a.city || '').localeCompare(b.city || '');
      if (teamFilters.sort === 'group') {
        // Sort by group first, then by name
        const groupA = a.group || 'ZZZ';
        const groupB = b.group || 'ZZZ';
        if (groupA !== groupB) return groupA.localeCompare(groupB);
        return (a.name || '').localeCompare(b.name || '');
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    setFilteredTeams(filtered);
  }, [teams, teamFilters]);

  // Get unique groups from teams
  const availableGroups = useMemo(() => {
    const groups = new Set();
    teams.forEach(team => {
      if (team.group) {
        groups.add(team.group);
      }
    });
    return Array.from(groups).sort();
  }, [teams]);

  // Group teams by group for grouped view
  const groupedTeams = useMemo(() => {
    if (!groupViewMode) return {};
    const grouped = {};
    filteredTeams.forEach(team => {
      const groupKey = team.group || 'Ungrouped';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(team);
    });
    // Sort groups alphabetically, with "Ungrouped" at the end
    const sortedGroups = {};
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Ungrouped') return 1;
      if (b === 'Ungrouped') return -1;
      return a.localeCompare(b);
    });
    sortedKeys.forEach(key => {
      sortedGroups[key] = grouped[key];
    });
    return sortedGroups;
  }, [filteredTeams, groupViewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('teamsViewMode', teamViewMode);
    } catch (err) {
      console.warn('Unable to persist teams view mode', err);
    }
  }, [teamViewMode]);

  const isPltc002 = (code || '').toUpperCase() === 'PLTC002';

  if (loading) {
    return (
      <TournamentAdminLayout>
        <div className="tournaments-admin-page">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading team directory…</p>
          </div>
        </div>
      </TournamentAdminLayout>
    );
  }

  if (!tournament) {
    return (
      <TournamentAdminLayout>
        <div className="tournaments-admin-page">
          <div className="empty-state">
            <h3>Tournament not found</h3>
            <p>Unable to load tournament information.</p>
          </div>
        </div>
      </TournamentAdminLayout>
    );
  }

  const totalGuestPlayers = teams.reduce((sum, team) => sum + (team.guestPlayers?.length || 0), 0);
  const avgPlayersPerTeam = teams.length > 0 ? Math.round(stats.total / teams.length) : 0;
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '—';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (Number.isNaN(diff) || diff < 0) return 'Just now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  const participatingSlotsRaw = tournament.participatingTeams || teams.length || 1;
  const participatingSlots = participatingSlotsRaw > 0 ? participatingSlotsRaw : 1;
  const pendingSlots = Math.max(participatingSlots - stats.teams, 0);

  const statusMeta = {
    title: teamRegistrationStatus === 'Active' ? 'Registration Active' : 'Registration Closed',
    hint: teamRegistrationStatus === 'Active' ? 'Teams can continue to register.' : 'No new teams can join.',
    tone: teamRegistrationStatus === 'Active' ? 'active' : 'closed'
  };

  return (
    <TournamentAdminLayout>
      <div className={`tournaments-admin-page teams-admin ${isPltc002 ? 'pltc002-teams-ui' : ''} teams-dynamic-mode`}>
        <section className="surface-card teams-actions">
          <div className="teams-actions__group">
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => window.open(`/register/team/${code}`, '_blank', 'noopener,noreferrer')}
            >
              Add team
            </button>
            <>
              <button
                type="button"
                className="admin-btn subtle"
                onClick={handleCopyTeamLink}
              >
                Copy team link
              </button>
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
                📤 Import Teams
              </button>
            </>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleExportExcel}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="admin-btn subtle"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => navigate(`/tournament/${code}/grouping`)}
            >
              📦 Team Grouping
            </button>
          </div>
          <div className="teams-actions__group">
            {teamRegistrationStatus === 'Active' ? (
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
          </div>
        </section>

        <section className="surface-card teams-metrics">
          <article className={`metric-tile tone-primary`}>
            <span className="metric-tile__label">Registered Teams</span>
            <span className="metric-tile__value">{stats.teams.toLocaleString()}</span>
            <span className="metric-tile__sub">of {participatingSlots.toLocaleString()} slots</span>
          </article>
          {pendingSlots > 0 && (
            <article className={`metric-tile tone-neutral`}>
              <span className="metric-tile__label">Slots Remaining</span>
              <span className="metric-tile__value">{pendingSlots.toLocaleString()}</span>
              <span className="metric-tile__sub">Space left for new teams</span>
            </article>
          )}
          <article className={`metric-tile tone-neutral`}>
            <span className="metric-tile__label">Total Players</span>
            <span className="metric-tile__value">{stats.total.toLocaleString()}</span>
            <span className="metric-tile__sub">Players across all teams</span>
          </article>
          <article className={`metric-tile tone-neutral`}>
            <span className="metric-tile__label">Guest Players</span>
            <span className="metric-tile__value">{totalGuestPlayers.toLocaleString()}</span>
            <span className="metric-tile__sub">Guest players registered</span>
          </article>
          {avgPlayersPerTeam > 0 && (
            <article className={`metric-tile tone-neutral`}>
              <span className="metric-tile__label">Avg Players/Team</span>
              <span className="metric-tile__value">{avgPlayersPerTeam}</span>
              <span className="metric-tile__sub">Average roster size</span>
            </article>
          )}
        </section>

        <section className="surface-card teams-workspace">
          <header className="workspace-header">
            <div className="workspace-header__content">
              <div className="workspace-header__titles">
                <div className="workspace-header__icon">⚽</div>
                <div>
                  <h2>Registered Teams</h2>
                  <div className="workspace-header__meta">
                    <span className="workspace-header__count">{filteredTeams.length}</span>
                    <span className="workspace-header__text">
                      {filteredTeams.length === 1 ? 'team' : 'teams'} shown
                      {filteredTeams.length !== stats.teams && (
                        <span className="workspace-header__total"> of {stats.teams} total</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="view-switch">
                <button
                  type="button"
                  className={teamViewMode === 'list' ? 'is-active' : ''}
                  onClick={() => setTeamViewMode('list')}
                  aria-label="Show teams as list"
                  title="List view"
                >
                  <span className="view-switch__icon">📋</span>
                  <span>List</span>
                </button>
                <button
                  type="button"
                  className={teamViewMode === 'grid' ? 'is-active' : ''}
                  onClick={() => setTeamViewMode('grid')}
                  aria-label="Show teams as cards"
                  title="Card view"
                >
                  <span className="view-switch__icon">🃏</span>
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </header>


          <div className="workspace-body">
            {filteredTeams.length === 0 ? (
              <div className="workspace-empty">
                <h3>No teams found</h3>
                <p>
                  {teams.length === 0
                    ? 'No teams registered yet. Share your registration link to collect entries.'
                    : 'No teams match the current filters. Try adjusting your search.'}
                </p>
                {teams.length === 0 && (
                  <button
                    type="button"
                    className="admin-btn primary"
                    onClick={handleCopyTeamLink}
                  >
                    Copy registration link
                  </button>
                )}
              </div>
            ) : groupViewMode ? (
              <div className="teams-grouped-view">
                {Object.keys(groupedTeams).length === 0 ? (
                  <div className="workspace-empty">
                    <h3>No teams in groups</h3>
                    <p>Assign teams to groups using the edit feature.</p>
                  </div>
                ) : (
                  Object.entries(groupedTeams).map(([groupName, groupTeams]) => (
                    <div key={groupName} className="team-group-section">
                      <div className="team-group-header">
                        <h3 className="team-group-title">
                          {groupName === 'Ungrouped' ? '🔷 Ungrouped Teams' : `📋 Group ${groupName}`}
                        </h3>
                        <span className="team-group-count">{groupTeams.length} team{groupTeams.length === 1 ? '' : 's'}</span>
                      </div>
                      {teamViewMode === 'grid' ? (
                        <div className="player-card-grid">
                          {groupTeams.map(team => {
                            const rosterCapacity = `${team.numberOfPlayers || 0} / ${tournament.maxPlayers || 100}`;
                            const guestCount = team.guestPlayers?.length || 0;
                            const registeredDate = team.createdAt
                              ? new Date(team.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                              : 'N/A';
                            const relativeRegistered = formatRelativeTime(team.createdAt);
                            return (
                              <article key={team._id} className="teams-card" aria-label={`${team.name} summary`}>
                                <div 
                                  className="teams-card-logo"
                                  onClick={() => team.logo && setPlayerImageModal({ url: `${API_BASE_URL}/${team.logo}`, name: team.name })}
                                  style={{ cursor: team.logo ? 'pointer' : 'default' }}
                                >
                                  {team.logo ? (
                                    <img
                                      src={`${API_BASE_URL}/${team.logo}`}
                                      alt={`${team.name} Logo`}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        if (e.target.nextSibling) {
                                          e.target.nextSibling.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  <div className="teams-card-logo-placeholder" style={{ display: team.logo ? 'none' : 'flex' }}>🏆</div>
                                  {team.group && (
                                    <div className="teams-card-logo-badges">
                                      <span className="teams-card-chip accent">Group {team.group}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="teams-card-body">
                                  <div className="teams-card-heading">
                                    <div>
                                      <p className="teams-card-eyebrow">Managed by {team.captainName || 'N/A'}</p>
                                      <h3 className="teams-card-title">{team.name}</h3>
                                    </div>
                                  </div>
                                  <div className="teams-card-meta-grid">
                                    <div className="teams-card-meta">
                                      <span className="teams-card-meta-label">Guests</span>
                                      <strong>{guestCount}</strong>
                                    </div>
                                    <div className="teams-card-meta">
                                      <span className="teams-card-meta-label">City</span>
                                      <strong>{team.city || 'N/A'}</strong>
                                    </div>
                                    <div className="teams-card-meta">
                                      <span className="teams-card-meta-label">Registered</span>
                                      <strong>{registeredDate}</strong>
                                    </div>
                                  </div>
                                  {(team.email || team.mobile) && (
                                    <div className="teams-card-tags">
                                      {team.email && <span className="teams-card-tag">📧 {team.email}</span>}
                                      {team.mobile && <span className="teams-card-tag">📞 {team.mobile}</span>}
                                    </div>
                                  )}
                                  {team.guestPlayers && team.guestPlayers.length > 0 && (
                                    <div className="teams-card-guest-players">
                                      <div className="teams-card-guest-players-label">Guest Players</div>
                                      <div className="teams-card-guest-players-grid">
                                        {team.guestPlayers.map((guest, idx) => {
                                          const buildPhotoUrl = (photo) => {
                                            if (!photo) return null;
                                            if (photo.startsWith('http')) return photo;
                                            if (photo.startsWith('uploads')) {
                                              return `${API_BASE_URL}/${photo}`;
                                            }
                                            if (photo.startsWith('/')) {
                                              return `${API_BASE_URL}${photo}`;
                                            }
                                            return `${API_BASE_URL}/uploads/${photo}`;
                                          };
                                          const photoUrl = buildPhotoUrl(guest.photo);
                                          return (
                                            <div 
                                              key={idx} 
                                              className="teams-card-guest-player"
                                              onClick={() => photoUrl && setPlayerImageModal({ url: photoUrl, name: guest.name || 'Guest Player' })}
                                              style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                                              title={guest.name || 'Guest Player'}
                                            >
                                              {photoUrl ? (
                                                <img
                                                  src={photoUrl}
                                                  alt={guest.name || 'Guest Player'}
                                                  onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    if (e.target.nextSibling) {
                                                      e.target.nextSibling.style.display = 'flex';
                                                    }
                                                  }}
                                                />
                                              ) : null}
                                              <div 
                                                className="teams-card-guest-player-placeholder"
                                                style={{ display: photoUrl ? 'none' : 'flex' }}
                                              >
                                                {guest.name?.charAt(0)?.toUpperCase() || 'G'}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <div className="teams-card-actions">
                                    <button 
                                      className="teams-card-btn"
                                      onClick={() => navigate(`/team/${team._id}/details`)}
                                    >
                                      📊 Dashboard
                                    </button>
                                    {isAuctionPro && (
                                      <button
                                        className="teams-card-btn warning"
                                        onClick={() => navigate(`/team/${team._id}/details#auction-pro`)}
                                      >
                                        🪑 Seats
                                      </button>
                                    )}
                                    <button 
                                      className="teams-card-btn"
                                      onClick={() => handleOpenEdit(team)}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button 
                                      className="teams-card-btn danger"
                                      onClick={() => handleDeleteTeam(team._id, team.name)}
                                    >
                                      🗑️ Delete
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="players-table-card">
                          <div className="table-wrapper">
                            <table className="players-table">
                              <thead>
                                <tr>
                                  <th>Logo</th>
                                  <th>Team Name</th>
                                  <th>Owner</th>
                                  <th>City</th>
                                  <th>Players</th>
                                  <th>Guest</th>
                                  <th>Email</th>
                                  <th>Registered</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupTeams.map(team => (
                                  <tr key={team._id}>
                                    <td>
                                      {team.logo ? (
                                        <img
                                          src={`${API_BASE_URL}/${team.logo}`}
                                          alt="Team Logo"
                                          style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            if (e.target.nextSibling) {
                                              e.target.nextSibling.style.display = 'flex';
                                            }
                                          }}
                                        />
                                      ) : null}
                                      <div style={{ 
                                        width: '56px', 
                                        height: '56px', 
                                        borderRadius: '12px', 
                                        background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                                        display: team.logo ? 'none' : 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '24px'
                                      }}>🏆</div>
                                    </td>
                                    <td><strong>{team.name}</strong></td>
                                    <td>{team.captainName || 'N/A'}</td>
                                    <td>{team.city || 'N/A'}</td>
                                    <td>{team.numberOfPlayers || 0} / {tournament.maxPlayers || 100}</td>
                                    <td>{team.guestPlayers?.length || 0}</td>
                                    <td>{team.email || 'N/A'}</td>
                                    <td>{team.createdAt ? new Date(team.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 'N/A'}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button 
                                          type="button"
                                          className="table-link"
                                          onClick={() => setTeamModal(team)}
                                        >
                                          View
                                        </button>
                                        <button 
                                          type="button"
                                          className="table-link"
                                          onClick={() => navigate(`/team/${team._id}/details`)}
                                        >
                                          Dashboard
                                        </button>
                                        {isAuctionPro && (
                                          <button
                                            type="button"
                                            className="table-link"
                                            onClick={() => navigate(`/team/${team._id}/details#auction-pro`)}
                                          >
                                            Seats
                                          </button>
                                        )}
                                        <button 
                                          type="button"
                                          className="table-link"
                                          onClick={() => handleOpenEdit(team)}
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          type="button"
                                          className="table-link"
                                          onClick={() => handleDeleteTeam(team._id, team.name)}
                                          style={{ color: '#fca5a5' }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : teamViewMode === 'grid' ? (
              <div className="player-card-grid">
                    {filteredTeams.map(team => {
                      const rosterCapacity = `${team.numberOfPlayers || 0} / ${tournament.maxPlayers || 100}`;
                      const guestCount = team.guestPlayers?.length || 0;
                      const registeredDate = team.createdAt
                        ? new Date(team.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'N/A';
                      const relativeRegistered = formatRelativeTime(team.createdAt);
                      return (
                        <article key={team._id} className="teams-card" aria-label={`${team.name} summary`}>
                          <div 
                            className="teams-card-logo"
                            onClick={() => team.logo && setPlayerImageModal({ url: `${API_BASE_URL}/${team.logo}`, name: team.name })}
                            style={{ cursor: team.logo ? 'pointer' : 'default' }}
                          >
                            {team.logo ? (
                              <img
                                src={`${API_BASE_URL}/${team.logo}`}
                                alt={`${team.name} Logo`}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div className="teams-card-logo-placeholder" style={{ display: team.logo ? 'none' : 'flex' }}>🏆</div>
                            <div className="teams-card-logo-badges">
                              {team.group && <span className="teams-card-chip accent">Group {team.group}</span>}
                            </div>
                          </div>
                          <div className="teams-card-body">
                            <div className="teams-card-heading">
                              <div>
                                <p className="teams-card-eyebrow">Managed by {team.captainName || 'N/A'}</p>
                                <h3 className="teams-card-title">{team.name}</h3>
                              </div>
                            </div>
                            <div className="teams-card-meta-grid">
                              <div className="teams-card-meta">
                                <span className="teams-card-meta-label">Guests</span>
                                <strong>{guestCount}</strong>
                              </div>
                              <div className="teams-card-meta">
                                <span className="teams-card-meta-label">City</span>
                                <strong>{team.city || 'N/A'}</strong>
                              </div>
                              <div className="teams-card-meta">
                                <span className="teams-card-meta-label">Registered</span>
                                <strong>{registeredDate}</strong>
                              </div>
                            </div>
                            {(team.email || team.mobile) && (
                              <div className="teams-card-tags">
                                {team.email && <span className="teams-card-tag">📧 {team.email}</span>}
                                {team.mobile && <span className="teams-card-tag">📞 {team.mobile}</span>}
                              </div>
                            )}
                            {team.guestPlayers && team.guestPlayers.length > 0 && (
                              <div className="teams-card-guest-players">
                                <div className="teams-card-guest-players-label">Guest Players</div>
                                <div className="teams-card-guest-players-grid">
                                  {team.guestPlayers.map((guest, idx) => {
                                    const buildPhotoUrl = (photo) => {
                                      if (!photo) return null;
                                      if (photo.startsWith('http')) return photo;
                                      if (photo.startsWith('uploads')) {
                                        return `${API_BASE_URL}/${photo}`;
                                      }
                                      if (photo.startsWith('/')) {
                                        return `${API_BASE_URL}${photo}`;
                                      }
                                      return `${API_BASE_URL}/uploads/${photo}`;
                                    };
                                    const photoUrl = buildPhotoUrl(guest.photo);
                                    return (
                                      <div 
                                        key={idx} 
                                        className="teams-card-guest-player"
                                        onClick={() => photoUrl && setPlayerImageModal({ url: photoUrl, name: guest.name || 'Guest Player' })}
                                        style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                                        title={guest.name || 'Guest Player'}
                                      >
                                        {photoUrl ? (
                                          <img
                                            src={photoUrl}
                                            alt={guest.name || 'Guest Player'}
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              if (e.target.nextSibling) {
                                                e.target.nextSibling.style.display = 'flex';
                                              }
                                            }}
                                          />
                                        ) : null}
                                        <div 
                                          className="teams-card-guest-player-placeholder"
                                          style={{ display: photoUrl ? 'none' : 'flex' }}
                                        >
                                          {guest.name?.charAt(0)?.toUpperCase() || 'G'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="teams-card-actions">
                              <button 
                                className="teams-card-btn"
                                onClick={() => navigate(`/team/${team._id}/details`)}
                              >
                                📊 Dashboard
                              </button>
                              {isAuctionPro && (
                                <button
                                  className="teams-card-btn warning"
                                  onClick={() => navigate(`/team/${team._id}/details#auction-pro`)}
                                >
                                  🪑 Seats
                                </button>
                              )}
                              <button 
                                className="teams-card-btn"
                                onClick={() => handleOpenEdit(team)}
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                className="teams-card-btn danger"
                                onClick={() => handleDeleteTeam(team._id, team.name)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
              </div>
            ) : (
              <div className="players-table-card">
                <div className="players-table-header">
                  <span>Registered teams</span>
                </div>
                <div className="table-wrapper">
                  <table className="players-table">
                    <thead>
                      <tr>
                        <th>Logo</th>
                        <th>Team Name</th>
                        <th>Group</th>
                        <th>Owner</th>
                        <th>City</th>
                        <th>Players</th>
                        <th>Guest</th>
                        <th>Email</th>
                        <th>Registered</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.map(team => (
                        <tr key={team._id}>
                          <td>
                            {team.logo ? (
                              <img
                                src={`${API_BASE_URL}/${team.logo}`}
                                alt="Team Logo"
                                style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  if (e.target.nextSibling) {
                                    e.target.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div style={{ 
                              width: '56px', 
                              height: '56px', 
                              borderRadius: '12px', 
                              background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                              display: team.logo ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px'
                            }}>🏆</div>
                          </td>
                          <td><strong>{team.name}</strong></td>
                          <td>{team.group ? <span className="teams-card-chip accent">Group {team.group}</span> : '—'}</td>
                          <td>{team.captainName || 'N/A'}</td>
                          <td>{team.city || 'N/A'}</td>
                          <td>{team.numberOfPlayers || 0} / {tournament.maxPlayers || 100}</td>
                          <td>{team.guestPlayers?.length || 0}</td>
                          <td>{team.email || 'N/A'}</td>
                          <td>{team.createdAt ? new Date(team.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : 'N/A'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button 
                                type="button"
                                className="table-link"
                                onClick={() => setTeamModal(team)}
                              >
                                View
                              </button>
                                <button 
                                  type="button"
                                  className="table-link"
                                  onClick={() => navigate(`/team/${team._id}/details`)}
                                >
                                  Dashboard
                                </button>
                                {isAuctionPro && (
                                  <button
                                    type="button"
                                    className="table-link"
                                    onClick={() => navigate(`/team/${team._id}/details#auction-pro`)}
                                  >
                                    Seats
                                  </button>
                                )}
                              <button 
                                type="button"
                                className="table-link"
                                onClick={() => handleOpenEdit(team)}
                              >
                                Edit
                              </button>
                              <button 
                                type="button"
                                className="table-link danger"
                                onClick={() => handleDeleteTeam(team._id, team.name)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="surface-card teams-links-section">
          <header>
            <h3>Registration links</h3>
            <p>Share these with teams to collect entries quickly.</p>
          </header>
          <div className="links-grid">
            <article className="link-card">
              <div className="link-card__body">
                <span className="link-card__label">Team registration</span>
                <p className="link-card__value">{window.location.origin}/register/team/{code}</p>
                <span className={`status-tag compact tone-${statusMeta.tone}`}>
                  <span className="status-tag__dot" />
                  <span>{statusMeta.title}</span>
                </span>
              </div>
              <div className="link-card__actions">
                <button
                  type="button"
                  className="admin-btn outline"
                  onClick={handleCopyTeamLink}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  onClick={() => window.open(`${window.location.origin}/register/team/${code}`, '_blank')}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="admin-btn outline"
                  onClick={handleShareWhatsApp}
                >
                  Share
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      {teamModal && (
          <div className="teams-modal-overlay" onClick={() => setTeamModal(null)}>
            <div className="teams-modal" onClick={(e) => e.stopPropagation()}>
              <div className="teams-modal-header">
                <h2 className="teams-modal-title">🏆 {teamModal.name}</h2>
                <button className="teams-modal-close" onClick={() => setTeamModal(null)}>×</button>
              </div>
              <div className="teams-modal-body">
                <div className="teams-modal-logo">
                  {teamModal.logo ? (
                    <img
                      src={`${API_BASE_URL}/${teamModal.logo}`}
                      alt={`${teamModal.name} Logo`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div className="teams-modal-logo-placeholder" style={{ display: teamModal.logo ? 'none' : 'flex' }}>🏆</div>
                </div>
                <div className="teams-modal-details">
                  <div className="teams-modal-detail">
                    <strong>Owner:</strong>
                    <span>{teamModal.captainName || 'N/A'}</span>
                  </div>
                  {teamModal.mobile && (
                    <div className="teams-modal-detail">
                      <strong>Contact:</strong>
                      <span>{teamModal.mobile}</span>
                    </div>
                  )}
                  {teamModal.email && (
                    <div className="teams-modal-detail">
                      <strong>Email:</strong>
                      <span>{teamModal.email}</span>
                    </div>
                  )}
                  <div className="teams-modal-detail">
                    <strong>City:</strong>
                    <span>{teamModal.city || 'N/A'}</span>
                  </div>
                  {teamModal.group && (
                    <div className="teams-modal-detail">
                      <strong>Group:</strong>
                      <span>Group {teamModal.group}</span>
                    </div>
                  )}
                  <div className="teams-modal-detail">
                    <strong>Registered Players:</strong>
                    <span>{teamModal.numberOfPlayers || 0} / {tournament.maxPlayers || 100}</span>
                  </div>
                  <div className="teams-modal-detail">
                    <strong>Guest Players:</strong>
                    <span>{teamModal.guestPlayers?.length || 0}</span>
                  </div>
                  {teamModal.createdAt && (
                    <div className="teams-modal-detail">
                      <strong>Registered:</strong>
                      <span>{new Date(teamModal.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</span>
                    </div>
                  )}
                </div>
                {teamModal.guestPlayers && teamModal.guestPlayers.length > 0 && (
                  <div className="teams-modal-players">
                    <h4 className="teams-modal-players-title">🧑‍🤝‍🧑 Guest Players</h4>
                    <div className="teams-modal-players-list">
                      {teamModal.guestPlayers.map((player, index) => {
                        const buildPhotoUrl = (photo) => {
                          if (!photo) return null;
                          if (photo.startsWith('http')) return photo;
                          if (photo.startsWith('uploads')) {
                            return `${API_BASE_URL}/${photo}`;
                          }
                          if (photo.startsWith('/')) {
                            return `${API_BASE_URL}${photo}`;
                          }
                          return `${API_BASE_URL}/uploads/${photo}`;
                        };
                        const photoUrl = buildPhotoUrl(player.photo);
                        return (
                          <div key={index} className="teams-modal-player-item">
                            <div 
                              className="teams-modal-player-image"
                              onClick={() => photoUrl && setPlayerImageModal({ url: photoUrl, name: player.name || 'Guest Player' })}
                              style={{ cursor: photoUrl ? 'pointer' : 'default' }}
                            >
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={player.name || 'Guest Player'}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) {
                                      e.target.nextSibling.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className="teams-modal-player-placeholder"
                                style={{ display: photoUrl ? 'none' : 'flex' }}
                              >
                                {player.name?.charAt(0)?.toUpperCase() || 'G'}
                              </div>
                            </div>
                            <div className="teams-modal-player-info">
                              <span className="teams-modal-player-name">{player.name || 'Unknown'}</span>
                              {player.role && (
                                <span className="teams-modal-player-role">{player.role}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="teams-modal-footer">
                <button
                  className="teams-btn teams-btn-primary"
                  onClick={() => {
                    toast.info('Export PDF feature coming soon');
                    setTeamModal(null);
                  }}
                >
                  📄 Export PDF
                </button>
                <button
                  className="teams-btn teams-btn-secondary"
                  onClick={() => {
                    handleOpenEdit(teamModal);
                    setTeamModal(null);
                  }}
                >
                  ✏️ Edit Team
                </button>
                <button
                  className="teams-btn teams-btn-secondary"
                  onClick={() => navigate(`/team/${teamModal._id}/details`)}
                >
                  📊 View Dashboard
                </button>
                <button
                  className="teams-btn teams-btn-secondary"
                  style={{ background: '#ef4444', color: 'white', border: 'none' }}
                  onClick={() => {
                    handleDeleteTeam(teamModal._id, teamModal.name);
                    setTeamModal(null);
                  }}
                >
                  🗑️ Delete Team
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Player Image Modal */}
        {playerImageModal && (
          <div className="player-image-modal-overlay" onClick={() => setPlayerImageModal(null)}>
            <div className="player-image-modal-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="player-image-modal-close"
                onClick={() => setPlayerImageModal(null)}
              >
                ×
              </button>
              <img 
                src={playerImageModal.url}
                alt={playerImageModal.name}
                className="player-image-modal-image"
              />
              <div className="player-image-modal-name">{playerImageModal.name}</div>
            </div>
          </div>
        )}

        {/* Edit Team Modal */}
        {editTeam && (
          <div className="teams-modal-overlay" onClick={() => !editSubmitting && setEditTeam(null)}>
            <div className="teams-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <div className="teams-modal-header">
                <h2 className="teams-modal-title">✏️ Edit Team: {editTeam.name}</h2>
                <button 
                  className="teams-modal-close" 
                  onClick={() => !editSubmitting && setEditTeam(null)}
                  disabled={editSubmitting}
                >
                  ×
                </button>
              </div>
              <div className="teams-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Logo Upload Section */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                      Team Logo
                    </label>
                    <div style={{ marginBottom: '12px' }}>
                      {editLogoPath && (
                        <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                          <img 
                            src={editLogoPath.startsWith('http') 
                              ? editLogoPath 
                              : `${API_BASE_URL}/${editLogoPath.startsWith('/') ? editLogoPath.substring(1) : editLogoPath}`} 
                            alt="Current Logo" 
                            style={{ 
                              maxWidth: '200px', 
                              maxHeight: '200px', 
                              borderRadius: '12px',
                              border: '2px solid #e2e8f0',
                              objectFit: 'cover'
                            }} 
                          />
                        </div>
                      )}
                      <ImageUploadCrop
                        uploadType="teamLogo"
                        currentImage={editLogoPath ? (editLogoPath.startsWith('http') 
                          ? editLogoPath 
                          : `${API_BASE_URL}${editLogoPath.startsWith('/') ? '' : '/'}${editLogoPath}`) : ''}
                        uploadPath={`${API_BASE_URL}/api/teams/upload-logo`}
                        placeholder="Tap to upload, crop & save team logo"
                        onComplete={(url) => {
                          // ImageUploadCrop returns the path like "/uploads/teams/..." or "uploads/teams/..."
                          // Normalize to remove leading slash and ensure it's a relative path
                          let logoPath = url;
                          if (url.startsWith('http')) {
                            // Extract path from full URL
                            logoPath = url.replace(`${API_BASE_URL}`, '');
                          }
                          // Remove leading slash if present
                          if (logoPath.startsWith('/')) {
                            logoPath = logoPath.substring(1);
                          }
                          setEditLogoPath(logoPath);
                        }}
                        onError={(message) => {
                          toast.error(message || 'Failed to upload logo');
                        }}
                        onRemove={() => {
                          setEditLogoPath('');
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                      Team Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      className="teams-search-input"
                      placeholder="Team Name (Uppercase)"
                      disabled={editSubmitting}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                      Captain Name *
                    </label>
                    <input
                      type="text"
                      name="captainName"
                      value={editFormData.captainName}
                      onChange={handleEditInputChange}
                      className="teams-search-input"
                      placeholder="Captain Name"
                      disabled={editSubmitting}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        Mobile *
                      </label>
                      <input
                        type="tel"
                        name="mobile"
                        value={editFormData.mobile}
                        onChange={handleEditInputChange}
                        className="teams-search-input"
                        placeholder="+91XXXXXXXXXX"
                        disabled={editSubmitting}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={editFormData.email}
                        onChange={handleEditInputChange}
                        className="teams-search-input"
                        placeholder="email@example.com"
                        disabled={editSubmitting}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        City *
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={editFormData.city}
                        onChange={handleEditInputChange}
                        className="teams-search-input"
                        placeholder="City"
                        disabled={editSubmitting}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        Number of Players
                      </label>
                      <input
                        type="number"
                        name="numberOfPlayers"
                        value={editFormData.numberOfPlayers}
                        onChange={handleEditInputChange}
                        className="teams-search-input"
                        placeholder="Number of Players"
                        min={tournament?.minPlayers || 11}
                        max={tournament?.maxPlayers || 16}
                        disabled={editSubmitting}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        Group (e.g., A, B, C)
                      </label>
                      <input
                        type="text"
                        name="group"
                        value={editFormData.group}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().trim();
                          setEditFormData(prev => ({ ...prev, group: value }));
                        }}
                        className="teams-search-input"
                        placeholder="Group (A, B, C, etc.)"
                        maxLength={10}
                        disabled={editSubmitting}
                      />
                      <small style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                        Leave empty to remove from group
                      </small>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1e293b' }}>
                        Group Index (for sorting)
                      </label>
                      <input
                        type="number"
                        name="groupIndex"
                        value={editFormData.groupIndex}
                        onChange={handleEditInputChange}
                        className="teams-search-input"
                        placeholder="0, 1, 2, etc."
                        min={0}
                        disabled={editSubmitting}
                      />
                      <small style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                        Optional: Used for ordering within group
                      </small>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontWeight: 600, color: '#1e293b' }}>
                        Guest Players (Max 2)
                      </label>
                      <button
                        type="button"
                        className="teams-btn teams-btn-secondary"
                        onClick={handleAddGuestPlayer}
                        disabled={editSubmitting || editFormData.guestPlayers.length >= 2}
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        + Add Guest
                      </button>
                    </div>
                    {editFormData.guestPlayers.map((guest, index) => (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'end' }}>
                        <input
                          type="text"
                          value={guest.name || ''}
                          onChange={(e) => handleUpdateGuestPlayer(index, 'name', e.target.value)}
                          className="teams-search-input"
                          placeholder="Guest Name"
                          disabled={editSubmitting}
                        />
                        <input
                          type="text"
                          value={guest.role || ''}
                          onChange={(e) => handleUpdateGuestPlayer(index, 'role', e.target.value)}
                          className="teams-search-input"
                          placeholder="Role"
                          disabled={editSubmitting}
                        />
                        <button
                          type="button"
                          className="teams-btn teams-btn-secondary"
                          onClick={() => handleRemoveGuestPlayer(index)}
                          disabled={editSubmitting}
                          style={{ padding: '10px 16px', background: '#ef4444', color: 'white', border: 'none' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="teams-modal-footer">
                <button
                  className="teams-btn teams-btn-secondary"
                  onClick={() => setEditTeam(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="teams-btn teams-btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUpdateTeam(e);
                  }}
                  disabled={editSubmitting}
                >
                  {editSubmitting ? '⏳ Updating...' : '💾 Update Team'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Import Teams Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={handleCloseImportModal}>
          <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Teams</h2>
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
                      <li>Fill in required fields for each team</li>
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
                      <li><strong>teamName</strong>: Uppercase, minimum 3 characters (e.g., "TEAM ALPHA")</li>
                      <li><strong>captainName</strong>: Captain full name</li>
                      <li><strong>mobile</strong>: 10-digit Indian format (e.g., "9876543210")</li>
                      <li><strong>email</strong>: Valid email address format</li>
                      <li><strong>city</strong>: City/Place name</li>
                      <li><strong>numberOfPlayers</strong>: Between tournament minimum and maximum</li>
                    </ul>

                    <h3>Step 4: Image/Logo Instructions</h3>
                    <p><strong>Option 1: Relative Path</strong></p>
                    <ul>
                      <li>Format: <code>uploads/team_logos/filename.jpg</code></li>
                      <li>File must exist on server</li>
                      <li>Upload logo files to server first, then reference in import file</li>
                    </ul>
                    <p><strong>Option 2: Full URL</strong></p>
                    <ul>
                      <li>Format: <code>https://example.com/logo.jpg</code></li>
                      <li>Will be downloaded automatically during import</li>
                    </ul>
                    <p><strong>Option 3: Leave Empty</strong></p>
                    <ul>
                      <li>Team will be created without logo</li>
                      <li>Logo can be added later via edit</li>
                    </ul>

                    <h3>Common Issues & Solutions</h3>
                    <ul>
                      <li><strong>"Invalid team name"</strong>: Ensure team name is uppercase and at least 3 characters</li>
                      <li><strong>"Invalid mobile number"</strong>: Use 10-digit format without spaces</li>
                      <li><strong>"Invalid email"</strong>: Check email format (must contain @ and domain)</li>
                      <li><strong>"Player count out of range"</strong>: Check tournament min/max player limits</li>
                      <li><strong>"Logo not found"</strong>: Verify file path or URL is correct and accessible</li>
                      <li><strong>"Duplicate team"</strong>: Team with same name + mobile already exists</li>
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
                          <th>Team Name</th>
                          <th>Captain</th>
                          <th>Mobile</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Errors/Warnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.results.map((result, idx) => (
                          <tr key={idx} className={result.isValid ? 'row-valid' : 'row-invalid'}>
                            <td>{result.rowNumber}</td>
                            <td>{result.data.teamName || '—'}</td>
                            <td>{result.data.captainName || '—'}</td>
                            <td>{result.data.mobile || '—'}</td>
                            <td>{result.data.email || '—'}</td>
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
                                <strong>Team:</strong> {result.data.teamName || '—'} | 
                                <strong> Captain:</strong> {result.data.captainName || '—'} | 
                                <strong> Mobile:</strong> {result.data.mobile || '—'}
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

      {/* Footer App Info */}
      <footer style={{
        marginTop: '48px',
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <img 
          src="/logo192.png" 
          alt="PlayLive" 
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          💙 Powered by <strong>PlayLive</strong> — Tournament Made Simple
        </p>
      </footer>
    </TournamentAdminLayout>
  );
}

export default TournamentTeams;
