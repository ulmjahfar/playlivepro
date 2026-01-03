import React from 'react';
import { Link } from 'react-router-dom';

function Error500() {
  return (
    <div className="error-page">
      <div className="error-container">
        <h1>500</h1>
        <h2>Server Error</h2>
        <p>Please try again later.</p>
        <Link to="/" className="btn">Go to Homepage</Link>
      </div>
    </div>
  );
}

export default Error500;
