"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { firebaseAuthMessage, isLocalDev } from "./authUtils";
import { useLocalContext } from "../context/LocalContext";
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
  const { auth: authFlags } = useLocalContext() || {};
  const canPassword = authFlags?.password !== false;
  const canOtp = authFlags?.otp !== false;
  const canRegister = authFlags?.register !== false;
  const canGoogle = authFlags?.google !== false;
  const canFacebook = Boolean(authFlags?.facebook);
  const hasSocial = canGoogle || canFacebook;
  const hasEmailAuth = canPassword || canOtp || canRegister;
  const anySignIn = canPassword || canOtp || canGoogle || canFacebook;

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [tabHighlight, setTabHighlight] = useState(false);
  const [devEmail, setDevEmail] = useState("customer@dreamdrive.test");
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const succeed = useRef(false);
  const registerNameRef = useRef(null);

  useEffect(() => {
    setShowDevLogin(isLocalDev());
  }, []);

  useEffect(() => {
    const preferred = initialMode;
    const next =
      (preferred === "password" && canPassword && "password") ||
      (preferred === "otp" && canOtp && "otp") ||
      (preferred === "register" && canRegister && "register") ||
      (canPassword && "password") ||
      (canOtp && "otp") ||
      (canRegister && "register") ||
      "password";
    setMode(next);
  }, [initialMode, canPassword, canOtp, canRegister]);

  useEffect(() => {
    if (!canGoogle || !GOOGLE_CLIENT_ID || typeof window === "undefined") return undefined;
    if (document.getElementById("dd-google-gsi")) return undefined;
    const script = document.createElement("script");
    script.id = "dd-google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
    return undefined;
  }, [canGoogle]);

  useEffect(() => {
    if (!canFacebook || !FACEBOOK_APP_ID || typeof window === "undefined") return undefined;

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
  }, [canFacebook]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  // Clear the tab-highlight pulse after animation completes
  useEffect(() => {
    if (!tabHighlight) return undefined;
    const t = setTimeout(() => setTabHighlight(false), 1600);
    return () => clearTimeout(t);
  }, [tabHighlight]);

  useEffect(() => {
    if (mode !== "register" || !tabHighlight) return;
    registerNameRef.current?.focus();
  }, [mode, tabHighlight]);

  function resetMessages() {
    setError("");
    setInfo("");
    setFieldErrors({});
  }

  function finish() {
    succeed.current = true;
    onSuccess?.();
  }

  function flattenAuthError(err) {
    const parts = [];
    const walk = (value) => {
      if (!value) return;
      if (typeof value === "string") {
        parts.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (typeof value === "object") {
        walk(value.message);
        walk(value.error);
        walk(value.code);
      }
    };
    walk(err?.message);
    walk(err?.data);
    walk(err?.code);
    return parts.join(" ");
  }

  /** True when the server says this email has no registered account. */
  function isUserNotFoundError(err) {
    const code = err?.code || "";
    const msg = flattenAuthError(err);
    return (
      code === "auth/user-not-found" ||
      /EMAIL_NOT_FOUND|auth\/user-not-found|No account found with this email/i.test(
        msg
      )
    );
  }

  function bounceToCreateAccount() {
    if (!canRegister) {
      setError("No account found with that email.");
      return;
    }
    setMode("register");
    setOtpSent(false);
    setOtpCode("");
    setResendSeconds(0);
    setTabHighlight(true);
    setError("");
    setInfo("No account found with that email — create one below to get started.");
    setFieldErrors({});
  }

  function loginEmailError() {
    return validateEmail(email);
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    resetMessages();
    const emailErr = loginEmailError();
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      setError(emailErr);
      return;
    }
    setLoading(true);
    try {
      await loginWithEmailPassword(email, password);
      finish();
    } catch (err) {
      if (isUserNotFoundError(err)) bounceToCreateAccount();
      else setError(firebaseAuthMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSend(e) {
    e?.preventDefault();
    resetMessages();
    const emailErr = loginEmailError();
    if (emailErr) {
      setFieldErrors({ email: emailErr });
      setError(emailErr);
      return;
    }
    setLoading(true);
    try {
      await sendOtp(email);
      setOtpSent(true);
      setResendSeconds(OTP_RESEND_SECONDS);
      setInfo("We sent a verification code to your email.");
    } catch (err) {
      if (isUserNotFoundError(err)) bounceToCreateAccount();
      else setError(err.message || "Could not send verification code.");
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
    const nextErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      phone: validateMobile(phone),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };
    const first = Object.values(nextErrors).find(Boolean);
    if (first) {
      setFieldErrors(nextErrors);
      setError(first);
      return;
    }
    const mobile = normalizeIndianMobile(phone);
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim(), mobile);
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
        {anySignIn ? (
          <>
        {hasSocial ? (
        <div className="customer-login-social">
          {canGoogle ? (
          <button
            type="button"
            className="customer-login-social-btn customer-login-social-btn--google"
            onClick={handleGoogle}
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          ) : null}
          {canFacebook ? (
          <button
            type="button"
            className="customer-login-social-btn customer-login-social-btn--facebook"
            onClick={handleFacebook}
            disabled={loading}
          >
            <FacebookIcon />
            Continue with Facebook
          </button>
          ) : null}
        </div>
        ) : null}

        {hasSocial && hasEmailAuth ? (
        <div className="customer-login-divider" role="separator">
          <span>or continue with email</span>
        </div>
        ) : null}

        {hasEmailAuth && (Number(canPassword) + Number(canOtp) + Number(canRegister) > 1) ? (
        <div className="customer-login-tabs" role="tablist" aria-label="Sign-in method">
          {canPassword ? (
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
          ) : null}
          {canOtp ? (
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
          ) : null}
          {canRegister ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`customer-login-tab${mode === "register" ? " is-active" : ""}${tabHighlight ? " is-highlight" : ""}`}
            onClick={switchToRegister}
            disabled={loading}
          >
            Create account
          </button>
          ) : null}
        </div>
        ) : null}

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

        {hasEmailAuth ? (
        <div key={mode} className="customer-login-form-stage">
          {mode === "password" && canPassword ? (
            <form onSubmit={handlePasswordSubmit} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-email`}>Email</label>
                <input
                  id={`${idPrefix}-email`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  disabled={loading}
                  className={fieldErrors.email ? "is-invalid" : ""}
                />
                {fieldErrors.email ? (
                  <p className="customer-login-field-error">{fieldErrors.email}</p>
                ) : null}
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
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              {canRegister ? (
                <button
                  type="button"
                  className="customer-login-link-btn"
                  onClick={switchToRegister}
                  disabled={loading}
                >
                  Don’t have an account? Create account
                </button>
              ) : null}
            </form>
          ) : mode === "register" && canRegister ? (
            <form onSubmit={handleRegisterSubmit} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-name`}>Full name</label>
                <input
                  ref={registerNameRef}
                  id={`${idPrefix}-register-name`}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                  disabled={loading}
                  className={fieldErrors.fullName ? "is-invalid" : ""}
                />
                {fieldErrors.fullName ? (
                  <p className="customer-login-field-error">{fieldErrors.fullName}</p>
                ) : null}
              </div>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-email`}>Email</label>
                <input
                  id={`${idPrefix}-register-email`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  disabled={loading}
                  className={fieldErrors.email ? "is-invalid" : ""}
                />
                {fieldErrors.email ? (
                  <p className="customer-login-field-error">{fieldErrors.email}</p>
                ) : null}
              </div>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-phone`}>Mobile</label>
                <input
                  id={`${idPrefix}-register-phone`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatMobileInput(e.target.value))}
                  placeholder="10-digit mobile"
                  required
                  maxLength={14}
                  disabled={loading}
                  className={fieldErrors.phone ? "is-invalid" : ""}
                />
                {fieldErrors.phone ? (
                  <p className="customer-login-field-error">{fieldErrors.phone}</p>
                ) : (
                  <p className="customer-login-field-hint">10-digit Indian number, starting with 6–9.</p>
                )}
              </div>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-password`}>Password</label>
                <div className="customer-login-input-wrap">
                  <input
                    id={`${idPrefix}-register-password`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    disabled={loading}
                    className={fieldErrors.password ? "is-invalid" : ""}
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
                {fieldErrors.password ? (
                  <p className="customer-login-field-error">{fieldErrors.password}</p>
                ) : null}
              </div>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-register-confirm`}>Confirm password</label>
                <div className="customer-login-input-wrap">
                  <input
                    id={`${idPrefix}-register-confirm`}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                    disabled={loading}
                    className={fieldErrors.confirmPassword ? "is-invalid" : ""}
                  />
                  <button
                    type="button"
                    className="customer-login-password-toggle"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={loading}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {fieldErrors.confirmPassword ? (
                  <p className="customer-login-field-error">{fieldErrors.confirmPassword}</p>
                ) : null}
              </div>
              <button
                type="submit"
                className="customer-login-submit"
                disabled={loading}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
              {canPassword ? (
                <button
                  type="button"
                  className="customer-login-link-btn"
                  onClick={switchToPassword}
                  disabled={loading}
                >
                  Already have an account? Sign in
                </button>
              ) : null}
            </form>
          ) : mode === "otp" && canOtp ? (
            <form onSubmit={otpSent ? handleOtpVerify : handleOtpSend} noValidate>
              <div className="customer-login-field">
                <label htmlFor={`${idPrefix}-otp-email`}>Email</label>
                <input
                  id={`${idPrefix}-otp-email`}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  disabled={loading || otpSent}
                  className={fieldErrors.email ? "is-invalid" : ""}
                />
                {fieldErrors.email ? (
                  <p className="customer-login-field-error">{fieldErrors.email}</p>
                ) : null}
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

                  {canPassword ? (
                  <button
                    type="button"
                    className="customer-login-link-btn"
                    onClick={switchToPassword}
                    disabled={loading}
                  >
                    Sign in with password instead
                  </button>
                  ) : null}
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

                  {canPassword ? (
                  <button
                    type="button"
                    className="customer-login-link-btn"
                    onClick={switchToPassword}
                    disabled={loading}
                  >
                    Sign in with password instead
                  </button>
                  ) : null}
                  {canRegister ? (
                  <button
                    type="button"
                    className="customer-login-link-btn"
                    onClick={switchToRegister}
                    disabled={loading}
                  >
                    Don’t have an account? Create account
                  </button>
                  ) : null}
                </>
              )}
            </form>
          ) : null}
        </div>
        ) : null}
          </>
        ) : (
          <p className="customer-login-info" role="status">
            Customer sign-in is temporarily unavailable. Please try again later or call the branch.
          </p>
        )}

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

function normalizeIndianMobile(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let mobile = digits;
  if (mobile.length === 12 && mobile.startsWith("91")) mobile = mobile.slice(2);
  if (mobile.length === 11 && mobile.startsWith("0")) mobile = mobile.slice(1);
  return mobile;
}

function formatMobileInput(raw) {
  return String(raw || "").replace(/[^\d+\s-]/g, "").slice(0, 14);
}

function validateFullName(raw) {
  const name = String(raw || "").trim();
  if (name.length < 2) return "Enter your full name.";
  if (!/^[a-zA-Z][a-zA-Z .'-]{1,79}$/.test(name)) {
    return "Name can only include letters, spaces, and hyphens.";
  }
  return "";
}

function validateEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email) return "Enter your email address.";
  if (/[+]{2,}|\s/.test(String(raw || "")) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email (for example name@gmail.com).";
  }
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return "Enter a valid email (for example name@gmail.com).";
  }
  const domain = email.split("@")[1] || "";
  if (/gmial\.com|gmal\.com|gmail\.con|gamil\.com|yahooo\.|hotmial\./i.test(domain)) {
    return "Check the email spelling (did you mean gmail.com?).";
  }
  return "";
}

function validateMobile(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Enter your 10-digit mobile number.";
  if (/[a-zA-Z@]/.test(value)) return "Mobile must be a number, not an email.";
  const mobile = normalizeIndianMobile(value);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return "Enter a valid 10-digit Indian mobile number.";
  }
  return "";
}

function validatePassword(raw) {
  if (!raw) return "Enter a password.";
  if (raw.length < 8) return "Password must be at least 8 characters.";
  return "";
}

function validateConfirmPassword(password, confirm) {
  if (!confirm) return "Re-enter your password to confirm.";
  if (password !== confirm) return "Passwords do not match.";
  return "";
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
