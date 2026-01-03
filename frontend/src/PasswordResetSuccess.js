import React from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from './components/BackButton';

function PasswordResetSuccess() {
  const navigate = useNavigate();

  return (
    <div className="form-container">
      <BackButton />
      <div style={{ textAlign: 'center' }}>
        <h2>✅ Password Reset Successful</h2>
        <p>Your password has been reset successfully.</p>
        <button onClick={() => navigate('/login/super-admin')} className="btn">Go to Login</button>
      </div>
    </div>
  );
}

export default PasswordResetSuccess;
