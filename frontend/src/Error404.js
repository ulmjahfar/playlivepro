import React from 'react';
import { Link } from 'react-router-dom';

function Error404() {
  return (
    <div className="error-page">
      <div className="error-container">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you are looking for does not exist.</p>
        <Link to="/" className="btn">Go to Homepage</Link>
      </div>
    </div>
  );
}

export default Error404;
