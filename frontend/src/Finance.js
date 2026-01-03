import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';

function Finance() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  // Helper function to calculate balance
  const calculateBalance = (income, expense) => {
    const incomeValue = Number(income) || 0;
    const expenseValue = Number(expense) || 0;
    return incomeValue - expenseValue;
  };

  // Calculate summary using useMemo for better performance
  const summary = useMemo(() => {
    const totalIncome = branches.reduce((sum, branch) => {
      return sum + (Number(branch.income) || 0);
    }, 0);
    
    const totalExpense = branches.reduce((sum, branch) => {
      return sum + (Number(branch.expense) || 0);
    }, 0);
    
    const balance = calculateBalance(totalIncome, totalExpense);
    
    return { totalIncome, totalExpense, balance };
  }, [branches]);

  // Calculate branch balances using useMemo
  const branchesWithBalance = useMemo(() => {
    return branches.map(branch => ({
      ...branch,
      balance: calculateBalance(branch.income, branch.expense)
    }));
  }, [branches]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/finance/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBranches(res.data.branches || []);
    } catch (err) {
      console.error('Error fetching branches:', err);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    // Placeholder for PDF export
    alert('PDF Export functionality not implemented yet.');
  };

  const handleExportExcel = () => {
    // Placeholder for Excel export
    alert('Excel Export functionality not implemented yet.');
  };

  return (
    <div className="finance">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="logo">PlayLive</div>
          <div className="welcome">Finance Summary</div>
        </div>
        <div className="dashboard-main">
          <h2>Branch-wise Cash Flow</h2>
          <div className="filters-section">
            <div className="filters">
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
              <input
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                placeholder="Filter by Month"
              />
            </div>
          </div>
          <div className="summary-cards">
            <div className="stat-card">
              <h3>Total Income</h3>
              <p>₹{summary.totalIncome.toLocaleString('en-IN')}</p>
            </div>
            <div className="stat-card">
              <h3>Total Expense</h3>
              <p>₹{summary.totalExpense.toLocaleString('en-IN')}</p>
            </div>
            <div className="stat-card">
              <h3>Balance</h3>
              <p>₹{summary.balance.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="finance-table">
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading financial data...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>Income</th>
                    <th>Expense</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {branchesWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                        No branch data available
                      </td>
                    </tr>
                  ) : (
                    branchesWithBalance.map(branch => (
                      <tr key={branch._id}>
                        <td>{branch.name || 'N/A'}</td>
                        <td>₹{(Number(branch.income) || 0).toLocaleString('en-IN')}</td>
                        <td>₹{(Number(branch.expense) || 0).toLocaleString('en-IN')}</td>
                        <td>₹{branch.balance.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="export-section">
            <button onClick={handleExportPDF} className="btn">Export as PDF</button>
            <button onClick={handleExportExcel} className="btn btn-secondary">Export as Excel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Finance;
