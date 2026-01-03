import React from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
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
  Legend
);

const AnalyticsCharts = ({ tournaments, stats }) => {
  // Player Trends Chart
  const playerTrendsData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Players Registered',
        data: [120, 150, 180, 200, 250, 300],
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4,
      },
    ],
  };

  // Team Breakdown Chart
  const teamBreakdownData = {
    labels: ['Cricket', 'Football', 'Volleyball', 'Basketball'],
    datasets: [
      {
        data: [45, 30, 15, 10],
        backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545'],
        hoverBackgroundColor: ['#0056b3', '#1e7e34', '#e0a800', '#c82333'],
      },
    ],
  };

  // Auction Insights Chart
  const auctionInsightsData = {
    labels: ['Completed Auctions', 'Active Auctions', 'Pending Auctions'],
    datasets: [
      {
        label: 'Auctions',
        data: [25, 8, 12],
        backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="analytics-charts">
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Player Registration Trends</h3>
          <Line data={playerTrendsData} options={chartOptions} height={50} />
        </div>

        <div className="chart-card">
          <h3>Team Distribution by Sport</h3>
          <Doughnut data={teamBreakdownData} height={50} />
        </div>

        <div className="chart-card">
          <h3>Auction Status Overview</h3>
          <Bar data={auctionInsightsData} options={chartOptions} height={50} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
