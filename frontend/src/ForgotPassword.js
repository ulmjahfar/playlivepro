import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import BackButton from './components/BackButton';
import { API_BASE_URL } from './utils/apiConfig';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      setMessage('✅ Password reset instructions have been sent to your email.');
      setTimeout(() => navigate('/login/super-admin'), 3000);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.message || 'Error sending reset email'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <BackButton />
      <h2>Forgot your password?</h2>
      <form onSubmit={handleSubmit}>
        <input
          id="forgot-password-email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
      <button type="button" onClick={() => navigate('/login/super-admin')} className="back-link">← Back to Login</button>
      <p className={`message ${message.includes('❌') ? 'error' : 'success'}`}>{message}</p>
    </div>
  );
}

export default ForgotPassword;
