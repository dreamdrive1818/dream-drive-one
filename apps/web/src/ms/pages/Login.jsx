"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  firebaseAuthMessage,
  getPostLoginPath,
  isLocalDev,
  readRedirectFromLocation,
} from "../authUtils";
import "./Login.css";

const OTP_RESEND_SECONDS = 60;

export default function Login() {
  const {
    user,
    ready,
    loginWithEmailPassword,
    loginDev,
    sendOtp,
    verifyOtp,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devEmail, setDevEmail] = useState("customer@dreamdrive.test");
  const [showDevLogin, setShowDevLogin] = useState(false);
  const isSubmitLogin = useRef(false);

  /** Single redirect path for every successful login method. */
  const completeLogin = useCallback(() => {
    const path = getPostLoginPath(readRedirectFromLocation());
    navigate(path, { replace: true });
  }, [navigate]);

  useEffect(() => {
    setShowDevLogin(isLocalDev());
  }, []);

  // Already signed in when landing on /login (not a fresh form submit).
  useEffect(() => {
    if (!ready || !user || isSubmitLogin.current) return;
    completeLogin();
  }, [ready, user, completeLogin]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  function resetMessages() {
    setError("");
    setInfo("");
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    isSubmitLogin.current = true;
    try {
      await loginWithEmailPassword(email, password);
      completeLogin();
    } catch (err) {
      isSubmitLogin.current = false;
      setError(firebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSend(e) {
    e?.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await sendOtp(email);
      setOtpSent(true);
      setResendSeconds(OTP_RESEND_SECONDS);
      setInfo("We sent a verification code to your email.");
    } catch (err) {
      setError(err.message || "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    isSubmitLogin.current = true;
    try {
      const result = await verifyOtp(email, otpCode);
      if (result.sessionStarted) {
        completeLogin();
        return;
      }
      isSubmitLogin.current = false;
      setInfo(
        "Your email was verified successfully. Full session login requires backend token support and is not available yet in production. Please sign in with your password, or use local development mode for OTP-based sessions."
      );
    } catch (err) {
      isSubmitLogin.current = false;
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDevSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    isSubmitLogin.current = true;
    try {
      await loginDev(devEmail);
      completeLogin();
    } catch (err) {
      isSubmitLogin.current = false;
      setError(err.message || "Dev sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  function switchToPassword() {
    resetMessages();
    setMode("password");
    setOtpSent(false);
    setOtpCode("");
    setResendSeconds(0);
  }

  function switchToOtp() {
    resetMessages();
    setMode("otp");
    setPassword("");
    setOtpSent(false);
    setOtpCode("");
    setResendSeconds(0);
  }

  if (!ready) {
    return (
      <div className="customer-login-page">
        <div className="customer-login-card">
          <p className="customer-login-subtitle">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-login-page">
      <div className="customer-login-card">
        <img
          src="https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png"
          alt="Dream Drive"
          className="customer-login-logo"
        />
        <h1>Sign in</h1>
        <p className="customer-login-subtitle">
          Access your bookings, checkout, and account details.
        </p>

        <div className="customer-login-tabs" role="tablist" aria-label="Sign-in method">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "password"}
            className={`customer-login-tab${mode === "password" ? " is-active" : ""}`}
            onClick={switchToPassword}
            disabled={loading}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "otp"}
            className={`customer-login-tab${mode === "otp" ? " is-active" : ""}`}
            onClick={switchToOtp}
            disabled={loading}
          >
            Email OTP
          </button>
        </div>

        {error && (
          <p className="customer-login-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="customer-login-info" role="status">
            {info}
          </p>
        )}

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="customer-login-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="customer-login-field">
              <label htmlFor="login-password">Password</label>
              <div className="customer-login-input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="customer-login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="customer-login-submit"
              disabled={loading || !email.trim() || !password}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={otpSent ? handleOtpVerify : handleOtpSend} noValidate>
            <div className="customer-login-field">
              <label htmlFor="otp-email">Email</label>
              <input
                id="otp-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || otpSent}
              />
            </div>

            {otpSent ? (
              <>
                <p className="customer-login-otp-hint">
                  Enter the 6-digit code sent to <strong>{email}</strong>.
                </p>
                <div className="customer-login-field">
                  <label htmlFor="otp-code">Verification code</label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="customer-login-submit"
                  disabled={loading || otpCode.length < 4}
                >
                  {loading ? "Verifying…" : "Verify & continue"}
                </button>

                <button
                  type="button"
                  className="customer-login-link-btn"
                  onClick={handleOtpSend}
                  disabled={loading || resendSeconds > 0}
                >
                  {resendSeconds > 0
                    ? `Resend code in ${resendSeconds}s`
                    : "Resend verification code"}
                </button>

                <button
                  type="button"
                  className="customer-login-link-btn"
                  onClick={switchToPassword}
                  disabled={loading}
                >
                  Sign in with password instead
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className="customer-login-submit"
                  disabled={loading || !email.trim()}
                >
                  {loading ? "Sending…" : "Send verification code"}
                </button>

                <button
                  type="button"
                  className="customer-login-link-btn"
                  onClick={switchToPassword}
                  disabled={loading}
                >
                  Sign in with password instead
                </button>
              </>
            )}
          </form>
        )}

        {showDevLogin && (
          <details className="customer-login-dev" open>
            <summary>Developer sign-in (localhost only)</summary>
            <div className="customer-login-dev-body">
              <p className="customer-login-dev-note">
                Uses a dev bearer token when the gateway has{" "}
                <code>DEV_AUTH_BYPASS</code> enabled. After OTP verify in local
                dev, the same dev token flow is used automatically.
              </p>
              <form onSubmit={handleDevSubmit}>
                <div className="customer-login-field">
                  <label htmlFor="dev-email">Dev email</label>
                  <input
                    id="dev-email"
                    type="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className="customer-login-submit"
                  disabled={loading || !devEmail.trim()}
                  style={{ background: "var(--dark-bg, #0b2d4a)" }}
                >
                  {loading ? "Signing in…" : "Continue with dev token"}
                </button>
              </form>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
