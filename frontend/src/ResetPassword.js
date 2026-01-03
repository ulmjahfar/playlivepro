import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import BackButton from './components/BackButton';
import { API_BASE_URL } from './utils/apiConfig';

function ResetPassword() {
  const { token } = useParams();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/auth/verify-token`, { token });
        setValidToken(true);
      } catch (err) {
        setValidToken(false);
        setMessage('❌ Invalid or expired token.');
      }
    };
    verifyToken();
  }, [token]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setMessage('❌ Passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setMessage('❌ Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/reset-password`, { token, newPassword: form.newPassword });
      setMessage('✅ Password updated successfully! You can now log in.');
      setTimeout(() => navigate('/login/super-admin'), 3000);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'Error resetting password'));
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) return <div className="form-container"><BackButton />Verifying token...</div>;
  if (!validToken) return <div className="form-container"><BackButton /><p>{message}</p><button onClick={() => navigate('/forgot-password')}>Try Again</button></div>;

  return (
    <div className="form-container">
      <BackButton />
      <h2>Reset Your Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          id="reset-new-password"
          name="newPassword"
          type="password"
          placeholder="New Password"
          onChange={handleChange}
          required
        />
        <input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Confirm New Password"
          onChange={handleChange}
          required
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Saving...' : 'Save Password'}
        </button>
      </form>
      <p className={`message ${message.includes('❌') ? 'error' : 'success'}`}>{message}</p>
    </div>
  );
}

export default ResetPassword;
