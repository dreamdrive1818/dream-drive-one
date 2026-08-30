import React, { useState } from "react";
import "./Login.css";
import { useNavigate } from "react-router-dom";
import { useAdminContext } from "../../context/AdminContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faLock,
  faShieldHalved,
  faGaugeHigh,
  faCarSide,
  faChartLine,
} from "@fortawesome/free-solid-svg-icons";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { AdminLogin } = useAdminContext();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await AdminLogin(email, password, navigate);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-panel admin-login-brand">
        <div className="admin-login-brand-inner">
          <img
            src="https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png"
            alt="Dream Drive"
            className="admin-login-logo"
          />
          <p className="admin-login-eyebrow">Dream Drive</p>
          <h1 className="admin-login-headline">
            Operate your fleet with clarity and control.
          </h1>
          <p className="admin-login-copy">
            Manage bookings, cars, customers, and content from one secure admin workspace.
          </p>

          <ul className="admin-login-features">
            <li>
              <FontAwesomeIcon icon={faGaugeHigh} />
              <span>Live operations dashboard</span>
            </li>
            <li>
              <FontAwesomeIcon icon={faCarSide} />
              <span>Fleet &amp; ride management</span>
            </li>
            <li>
              <FontAwesomeIcon icon={faChartLine} />
              <span>Customer and inquiry tracking</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="admin-login-panel admin-login-form-side">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <div className="admin-login-card-badge">
            <FontAwesomeIcon icon={faShieldHalved} />
            Secure admin access
          </div>

          <h2 className="admin-login-title">Sign in</h2>
          <p className="admin-login-subtitle">
            Enter your administrator credentials to continue.
          </p>

          <label className="admin-login-label" htmlFor="admin-email">
            Email
          </label>
          <div className="admin-login-field">
            <FontAwesomeIcon icon={faEnvelope} />
            <input
              id="admin-email"
              type="email"
              placeholder="admin@dreamdrive.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <label className="admin-login-label" htmlFor="admin-password">
            Password
          </label>
          <div className="admin-login-field">
            <FontAwesomeIcon icon={faLock} />
            <input
              id="admin-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="admin-error">{error}</p>}

          <button type="submit" className="admin-login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to dashboard"}
          </button>

          <p className="admin-login-footnote">
            Authorized personnel only. All sessions are monitored.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
