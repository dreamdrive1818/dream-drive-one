"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { firebaseAuthMessage, isLocalDev } from "./authUtils";
import "./pages/Login.css";

const OTP_RESEND_SECONDS = 60;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

/**
 * Sign-in / register form used by the /login page and AuthModal.
 * @param {{ onSuccess?: () => void, initialMode?: "password"|"otp"|"register", idPrefix?: string, compact?: boolean }} props
 */
export default function AuthForm({
  onSuccess,
  initialMode = "password",
  idPrefix = "auth",
  compact = false,
}) {
  const {
    loginWithEmailPassword,
    loginDev,
    sendOtp,
    loginOtp,
    register,
    loginGoogle,
    loginFacebook,
  } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devEmail, setDevEmail] = useState("customer@dreamdrive.test");
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const succeed = useRef(false);

  useEffect(() => {
    setShowDevLogin(isLocalDev());
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined") return undefined;
    if (document.getElementById("dd-google-gsi")) return undefined;
    const script = document.createElement("script");
    script.id = "dd-google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    if (!FACEBOOK_APP_ID || typeof window === "undefined") return undefined;

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
      setFbReady(true);
    };

    if (document.getElementById("dd-facebook-jssdk")) {
      if (window.FB) setFbReady(true);
      return undefined;
    }

    const script = document.createElement("script");
    script.id = "dd-facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return undefined;
  }, []);

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

  function finish() {
    succeed.current = true;
    onSuccess?.();
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await loginWithEmailPassword(email, password);
      finish();
    } catch (err) {
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
    try {
      await loginOtp(email, otpCode);
      finish();
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDevSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await loginDev(devEmail);
      finish();
    } catch (err) {
      setError(err.message || "Dev sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await register(email, password, fullName);
      finish();
    } catch (err) {
      setError(firebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured yet.");
      return;
    }
    if (!window.google?.accounts?.id) {
      setError("Google Sign-In is still loading. Try again in a moment.");
      return;
    }
    resetMessages();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setLoading(true);
        try {
          await loginGoogle(response.credential);
          finish();
        } catch (err) {
          setError(firebaseAuthMessage(err));
        } finally {
          setLoading(false);
        }
      },
    });
    window.google.accounts.id.prompt((notification) => {
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        setError("Google sign-in was blocked. Check popup settings and try again.");
      }
    });
  }

  function handleFacebook() {
    if (!FACEBOOK_APP_ID) {
      setError("Facebook sign-in is not configured yet.");
      return;
    }
    if (!fbReady || !window.FB) {
      setError("Facebook Sign-In is still loading. Try again in a moment.");
      return;
    }
    resetMessages();
    window.FB.login(
      async (response) => {
        if (!response?.authResponse?.accessToken) {
          if (response?.status !== "connected") {
            setError("Facebook sign-in was cancelled.");
          }
          return;
        }
        setLoading(true);
        try {
          await loginFacebook(response.authResponse.accessToken);
          finish();
        } catch (err) {
          setError(err.message || "Facebook sign-in failed.");
        } finally {
          setLoading(false);
        }
      },
      { scope: "email,public_profile" }
    );
  }

  function switchToPassword() {
    resetMessages();
    setMode("password");
    setOtpSent(false);
    setOtpCode("");
    setResendSeconds(0);
  }

  function switchToRegister() {
    resetMessages();
    setMode("register");
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

  const title =
    mode === "register"
      ? "Create account"
      : mode === "otp"
        ? "Email sign-in"
        : "Welcome back";
  const lead =
    mode === "register"
      ? "Set up an account to book cars and track your trips."
      : mode === "otp"
        ? "We’ll email you a one-time code — no password needed."
        : compact
          ? "Sign in to continue your booking."
          : "Sign in to manage bookings, checkout, and account details.";

  return (
    <div className={`customer-login-shell${compact ? " customer-login-shell--compact" : ""}`}>
      <header className="customer-login-header">
        <p className="customer-login-eyebrow">Dream Drive</p>
        {compact ? (
          <h2 className="customer-login-title-modal">{title}</h2>
        ) : (
          <h1>{title}</h1>
        )}
        <p className="customer-login-subtitle">{lead}</p>
      </header>

      <div className="customer-login-card">
        <div className="customer-login-social">
          <button
            type="button"
            className="customer-login-social-btn customer-login-social-btn--google"
            onClick={handleGoogle}
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            className="customer-login-social-btn customer-login-social-btn--facebook"
            onClick={handleFacebook}
            disabled={loading}
          >
            <FacebookIcon />
            Continue with Facebook
          </button>
        </div>

        <div className="customer-login-divider" role="separator">
          <span>or continue with email</span>
        </div>

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
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`customer-login-tab${mode === "register" ? " is-active" : ""}`}
            onClick={switchToRegister}
            disabled={loading}
          >
            Create account
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

        <div key={mode} className="customer-login-form-stage">
          {mode === "password" ? (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-email`}>Email</label>
                <input
                  id={`${idPrefix}-email`}
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
                <label htmlFor={`${idPrefix}-password`}>Password</label>
                <div className="customer-login-input-wrap">
                  <input
                    id={`${idPrefix}-password`}
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
          ) : mode === "register" ? (
            <form onSubmit={handleRegisterSubmit} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-name`}>Full name</label>
                <input
                  id={`${idPrefix}-register-name`}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={loading}
                />
              </div>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-email`}>Email</label>
                <input
                  id={`${idPrefix}-register-email`}
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
                <label htmlFor={`${idPrefix}-register-password`}>Password</label>
                <input
                  id={`${idPrefix}-register-password`}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="customer-login-submit"
                disabled={loading || !email.trim() || !password || !fullName.trim()}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleOtpVerify : handleOtpSend} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-otp-email`}>Email</label>
                <input
                  id={`${idPrefix}-otp-email`}
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
                    <label htmlFor={`${idPrefix}-otp-code`}>Verification code</label>
                    <input
                      id={`${idPrefix}-otp-code`}
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
        </div>

        {showDevLogin && !compact && (
          <details className="customer-login-dev" open>
            <summary>Developer sign-in (localhost only)</summary>
            <div className="customer-login-dev-body">
              <p className="customer-login-dev-note">
                Uses a dev bearer token when the gateway has{" "}
                <code>DEV_AUTH_BYPASS</code> enabled.
              </p>
              <form onSubmit={handleDevSubmit}>
                <div className="customer-login-field">
                  <label htmlFor={`${idPrefix}-dev-email`}>Dev email</label>
                  <input
                    id={`${idPrefix}-dev-email`}
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.4V9.84c0-2.37 1.4-3.69 3.56-3.69 1.03 0 2.11.19 2.11.19v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.9h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z"
      />
    </svg>
  );
}
