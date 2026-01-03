import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';
import { toast } from 'react-toastify';

function TournamentFinance() {
  const { code } = useParams();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);

  const fetchTournament = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTournament(res.data.tournament);
    } catch (err) {
      console.error('Error fetching tournament:', err);
    }
  }, [code]);

  const fetchFinanceSummary = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/finance/${code}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error fetching finance summary:', err);
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchTournament();
    fetchFinanceSummary();
  }, [code, fetchTournament, fetchFinanceSummary]);

  const handleExportPDF = () => {
    // Placeholder for PDF export
    alert('PDF Export functionality not implemented yet.');
  };

  const handleExportExcel = () => {
    // Placeholder for Excel export
    alert('Excel Export functionality not implemented yet.');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading finance data...</div>
      </div>
    );
  }

  return (
    <div className="tournament-finance" style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          {tournament?.name || 'Tournament'} Finance
        </h1>
        <p style={{ color: '#666' }}>Financial summary and revenue tracking</p>
      </div>

      {summary && (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Total Revenue</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                ₹{summary.totalRevenue?.toLocaleString('en-IN') || '0'}
              </p>
            </div>
            <div style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Pending Payments</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>
                ₹{summary.pendingPayments?.toLocaleString('en-IN') || '0'}
              </p>
            </div>
            <div style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Net Balance</h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
                ₹{((summary.totalRevenue || 0) - (summary.pendingPayments || 0)).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {summary.entries && summary.entries.length > 0 && (
            <div style={{
              background: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginBottom: '2rem'
            }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Revenue Breakdown</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee' }}>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.entries.map((entry, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '1rem' }}>{entry.category}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold' }}>
                        ₹{entry.amount?.toLocaleString('en-IN') || '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleExportPDF} 
              style={{
                padding: '0.75rem 1.5rem',
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Export as PDF
            </button>
            <button 
              onClick={handleExportExcel} 
              style={{
                padding: '0.75rem 1.5rem',
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Export as Excel
            </button>
          </div>
        </>
      )}

      {!summary && !loading && (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p>No finance data available for this tournament.</p>
        </div>
      )}
    </div>
  );
}

export default TournamentFinance;

