import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import jsPDF from 'jspdf';
import { copyToClipboard } from './utils/clipboard';
import { API_BASE_URL } from './utils/apiConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

function TeamDetails({ tournamentCode, teamId, onClose }) {
  const [teamData, setTeamData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'soldPrice', direction: 'desc' });
  const [filterRole, setFilterRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [auctionStatus] = useState('live'); // live, paused, completed

  const fetchTeamDetails = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auctions/live-team-details/${tournamentCode}/${teamId}`);
      setTeamData(response.data.team);
      setPlayers(response.data.players);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team details:', error);
      setLoading(false);
    }
  }, [tournamentCode, teamId]);

  useEffect(() => {
    fetchTeamDetails();
  }, [fetchTeamDetails]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPlayers = React.useMemo(() => {
    let sortableItems = [...players];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [players, sortConfig]);

  const filteredPlayers = sortedPlayers.filter(player => {
    const matchesRole = filterRole === '' || player.role === filterRole;
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.playerId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const budgetChartData = {
    labels: ['Used', 'Remaining'],
    datasets: [{
      label: 'Budget (₹)',
      data: [teamData?.budgetUsed || 0, teamData?.budgetBalance || 0],
      backgroundColor: ['#ff6b6b', '#4ecdc4'],
      borderColor: ['#ff5252', '#26d0ce'],
      borderWidth: 1,
    }],
  };

  const roleChartData = {
    labels: Object.keys(teamData?.playersByRole || {}),
    datasets: [{
      data: Object.values(teamData?.playersByRole || {}),
      backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#ff9f40'],
    }],
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Team Details: ${teamData?.name}`, 20, 20);
    doc.text(`Owner: ${teamData?.owner}`, 20, 30);
    doc.text(`Budget: ₹${teamData?.budget}`, 20, 40);
    doc.text(`Used: ₹${teamData?.budgetUsed}`, 20, 50);
    doc.text(`Balance: ₹${teamData?.budgetBalance}`, 20, 60);
    doc.text(`Players Bought: ${teamData?.playersBought}`, 20, 70);

    let y = 90;
    doc.text('Players:', 20, 80);
    filteredPlayers.forEach((player, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${index + 1}. ${player.name} - ₹${player.soldPrice} (${player.role})`, 20, y);
      y += 10;
    });

    doc.save(`${teamData?.name}_details.pdf`);
  };

  const shareLink = async () => {
    const url = window.location.href;
    const success = await copyToClipboard(url);
    if (success) {
      alert('Link copied to clipboard!');
    } else {
      alert('Failed to copy link. Please try again.');
    }
  };

  if (loading) return <div className="loading">Loading team details...</div>;

  return (
    <div className="team-details-modal">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>×</button>

        {/* Team Info Header */}
        <div className="team-header">
          <img src={teamData?.logo || '/default-logo.png'} alt={teamData?.name} className="team-logo" />
          <div className="team-info">
            <h2>{teamData?.name}</h2>
            <p>Owner: {teamData?.owner}</p>
            <div className={`auction-status ${auctionStatus}`}>
              {auctionStatus === 'live' ? '🔴 LIVE' : auctionStatus === 'paused' ? '⏸ PAUSED' : '✅ COMPLETED'}
            </div>
          </div>
        </div>

        {/* Budget Cards */}
        <div className="budget-cards">
          <div className="budget-card">
            <h3>Total Budget</h3>
            <p>₹{teamData?.budget?.toLocaleString()}</p>
          </div>
          <div className="budget-card">
            <h3>Used</h3>
            <p>₹{teamData?.budgetUsed?.toLocaleString()}</p>
          </div>
          <div className="budget-card">
            <h3>Balance</h3>
            <p>₹{teamData?.budgetBalance?.toLocaleString()}</p>
          </div>
        </div>

        {/* Insights Cards */}
        <div className="insights-cards">
          <div className="insight-card">
            <h4>Total Spent</h4>
            <p>₹{teamData?.totalSpent?.toLocaleString()}</p>
          </div>
          <div className="insight-card">
            <h4>Avg Price</h4>
            <p>₹{teamData?.avgPrice?.toLocaleString()}</p>
          </div>
          <div className="insight-card">
            <h4>Players</h4>
            <p>{teamData?.playersBought}</p>
          </div>
          <div className="insight-card">
            <h4>Highest Bid</h4>
            <p>₹{teamData?.highestBid?.toLocaleString()}</p>
          </div>
          <div className="insight-card">
            <h4>Max Possible Bid</h4>
            <p className="gold">₹{teamData?.maxBid?.toLocaleString()}</p>
          </div>
          <div className="insight-card">
            <h4>Budget %</h4>
            <p>{teamData?.budget ? ((teamData.budgetUsed / teamData.budget) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="progress-summary">
          <p>{teamData?.name} has spent {teamData?.budget ? ((teamData.budgetUsed / teamData.budget) * 100).toFixed(1) : 0}% of their budget, acquiring {teamData?.playersBought} players with an average cost of ₹{teamData?.avgPrice?.toLocaleString()}.</p>
        </div>

        {/* Charts */}
        <div className="charts-section">
          <div className="chart-container">
            <h3>Budget Utilization</h3>
            <Bar data={budgetChartData} />
          </div>
          <div className="chart-container">
            <h3>Players by Role</h3>
            <Pie data={roleChartData} />
          </div>
        </div>

        {/* Recent Purchases Ticker */}
        <div className="recent-ticker">
          <h4>Recent Purchases</h4>
          <div className="ticker">
            {teamData?.recentPurchases?.map((player) => (
              <span key={player._id || player.id || `${player.name}-${player.soldPrice}`}>{player.name} - ₹{player.soldPrice} | </span>
            ))}
          </div>
        </div>

        {/* Players Table */}
        <div className="players-section">
          <h3>Players Bought</h3>
          <div className="filters">
            <input
              type="text"
              placeholder="Search by name or ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-rounder">All-rounder</option>
              <option value="Wicket-keeper">Wicket-keeper</option>
            </select>
          </div>
          <table className="players-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')}>Name</th>
                <th onClick={() => handleSort('role')}>Role</th>
                <th onClick={() => handleSort('soldPrice')}>Price</th>
                <th onClick={() => handleSort('updatedAt')}>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(player => (
                <tr key={player._id}>
                  <td>{player.name}</td>
                  <td>{player.role}</td>
                  <td>₹{player.soldPrice}</td>
                  <td>{new Date(player.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={exportPDF}>📄 Export PDF</button>
          <button onClick={shareLink}>🔗 Share Link</button>
        </div>
      </div>
    </div>
  );
}

export default TeamDetails;
