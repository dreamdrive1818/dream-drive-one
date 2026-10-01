"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "../../lib/api";
import { isStaff } from "../../lib/rbac";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    api("/v1/me")
      .then((me) => {
        if (isStaff(me.roles)) router.replace("/");
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api("/v1/auth/staff-login", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password },
        retries: 2,
      });
      setToken(res.token);
      const me = res.user || (await api("/v1/me"));
      if (!isStaff(me.roles)) {
        localStorage.removeItem("dd_token");
        setError("This account is not staff.");
        return;
      }
      router.replace("/");
    } catch (err) {
      localStorage.removeItem("dd_token");
      setError(err.message || "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark">DD</span>
          <div>
            <p className="login-kicker">Dream Drive</p>
            <h1>Admin console</h1>
          </div>
        </div>
        <p className="muted login-lead">
          Sign in with your staff email and password. Super admin assigns each person the modules they can use.
        </p>
        <form onSubmit={submit} className="login-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@dreamdrive.test"
              required
            />
          </label>
          <label>
            Password
            <span className="login-pass">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="ghost login-eye"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {error && <p className="err">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
