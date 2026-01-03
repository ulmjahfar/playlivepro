import React, { useState, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import './LiveAuctionGraph.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function LiveAuctionGraph({ auctionState, teams = [] }) {
  const [activeTab, setActiveTab] = useState('trends'); // 'trends', 'distribution', 'spending'

  // Bidding Trends Data
  const biddingTrendsData = useMemo(() => {
    if (!auctionState.soldPlayers || auctionState.soldPlayers.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Group sold players by time intervals (last 20 sales)
    const recentSales = auctionState.soldPlayers
      .slice(-20)
      .sort((a, b) => new Date(a.soldAt || 0) - new Date(b.soldAt || 0));

    const labels = recentSales.map((_, index) => `Sale ${index + 1}`);
    const prices = recentSales.map(p => p.soldPrice || 0);
    const avgPrices = [];
    let sum = 0;
    prices.forEach((price, index) => {
      sum += price;
      avgPrices.push(Math.round(sum / (index + 1)));
    });

    return {
      labels,
      datasets: [
        {
          label: 'Sale Price',
          data: prices,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Average Price',
          data: avgPrices,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.4,
          borderDash: [5, 5],
          pointRadius: 3,
        }
      ]
    };
  }, [auctionState.soldPlayers]);

  // Price Distribution Data
  const priceDistributionData = useMemo(() => {
    if (!auctionState.soldPlayers || auctionState.soldPlayers.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const prices = auctionState.soldPlayers
      .map(p => p.soldPrice || 0)
      .filter(p => p > 0);

    if (prices.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const bucketCount = 10;
    const bucketSize = range / bucketCount;

    const buckets = Array(bucketCount).fill(0);
    const bucketLabels = [];

    prices.forEach(price => {
      const bucketIndex = Math.min(
        Math.floor((price - min) / bucketSize),
        bucketCount - 1
      );
      buckets[bucketIndex]++;
    });

    for (let i = 0; i < bucketCount; i++) {
      const bucketMin = min + (i * bucketSize);
      const bucketMax = min + ((i + 1) * bucketSize);
      bucketLabels.push(`₹${Math.round(bucketMin).toLocaleString()} - ₹${Math.round(bucketMax).toLocaleString()}`);
    }

    return {
      labels: bucketLabels,
      datasets: [
        {
          label: 'Number of Players',
          data: buckets,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(251, 146, 60, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(168, 85, 247, 0.8)',
          ],
          borderColor: [
            'rgb(59, 130, 246)',
            'rgb(16, 185, 129)',
            'rgb(245, 158, 11)',
            'rgb(239, 68, 68)',
            'rgb(139, 92, 246)',
            'rgb(236, 72, 153)',
            'rgb(34, 197, 94)',
            'rgb(251, 146, 60)',
            'rgb(99, 102, 241)',
            'rgb(168, 85, 247)',
          ],
          borderWidth: 2,
        }
      ]
    };
  }, [auctionState.soldPlayers]);

  // Team Spending Comparison Data
  const teamSpendingData = useMemo(() => {
    if (!teams || teams.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const teamData = teams
      .map(team => ({
        name: team.name,
        spent: team.totalSpent || team.budgetUsed || 0,
        players: team.playersBought || 0,
        balance: team.currentBalance || team.budgetBalance || 0
      }))
      .filter(team => team.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10); // Top 10 teams

    return {
      labels: teamData.map(t => t.name),
      datasets: [
        {
          label: 'Total Spent',
          data: teamData.map(t => t.spent),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
        },
        {
          label: 'Remaining Balance',
          data: teamData.map(t => t.balance),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 2,
        }
      ]
    };
  }, [teams]);

  // Overall Statistics
  const stats = useMemo(() => {
    const soldPlayers = auctionState.soldPlayers || [];
    const totalSpent = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
    const avgPrice = soldPlayers.length > 0 ? totalSpent / soldPlayers.length : 0;
    const highestPrice = soldPlayers.length > 0 
      ? Math.max(...soldPlayers.map(p => p.soldPrice || 0))
      : 0;
    const lowestPrice = soldPlayers.length > 0
      ? Math.min(...soldPlayers.filter(p => p.soldPrice > 0).map(p => p.soldPrice || 0))
      : 0;

    return {
      totalSpent,
      avgPrice,
      highestPrice,
      lowestPrice,
      playersSold: soldPlayers.length
    };
  }, [auctionState.soldPlayers]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      }
    }
  };

  const lineChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₹' + value.toLocaleString('en-IN');
          }
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  return (
    <div className="live-auction-graph">
      <div className="graph-header">
        <h3>📊 Live Auction Analytics</h3>
        <div className="graph-tabs">
          <button
            className={`graph-tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            📈 Bidding Trends
          </button>
          <button
            className={`graph-tab ${activeTab === 'distribution' ? 'active' : ''}`}
            onClick={() => setActiveTab('distribution')}
          >
            📊 Price Distribution
          </button>
          <button
            className={`graph-tab ${activeTab === 'spending' ? 'active' : ''}`}
            onClick={() => setActiveTab('spending')}
          >
            💰 Team Spending
          </button>
        </div>
      </div>

      <div className="graph-stats">
        <div className="stat-card">
          <label>Total Spent</label>
          <span>₹{stats.totalSpent.toLocaleString('en-IN')}</span>
        </div>
        <div className="stat-card">
          <label>Average Price</label>
          <span>₹{Math.round(stats.avgPrice).toLocaleString('en-IN')}</span>
        </div>
        <div className="stat-card">
          <label>Highest Price</label>
          <span>₹{stats.highestPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="stat-card">
          <label>Players Sold</label>
          <span>{stats.playersSold}</span>
        </div>
      </div>

      <div className="graph-content">
        {activeTab === 'trends' && (
          <div className="chart-container">
            <h4>Bidding Trends (Last 20 Sales)</h4>
            {biddingTrendsData.labels.length > 0 ? (
              <Line data={biddingTrendsData} options={lineChartOptions} />
            ) : (
              <div className="no-data">No sales data available yet</div>
            )}
          </div>
        )}

        {activeTab === 'distribution' && (
          <div className="chart-container">
            <h4>Price Distribution</h4>
            {priceDistributionData.labels.length > 0 ? (
              <Bar data={priceDistributionData} options={barChartOptions} />
            ) : (
              <div className="no-data">No sales data available yet</div>
            )}
          </div>
        )}

        {activeTab === 'spending' && (
          <div className="chart-container">
            <h4>Team Spending Comparison (Top 10)</h4>
            {teamSpendingData.labels.length > 0 ? (
              <Bar data={teamSpendingData} options={barChartOptions} />
            ) : (
              <div className="no-data">No team spending data available yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveAuctionGraph;

