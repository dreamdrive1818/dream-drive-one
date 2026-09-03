"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "../../lib/api";

const STAFF = new Set([
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
]);

function isStaff(roles) {
  return (roles || []).some((r) => STAFF.has(r));
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@dreamdrive.test");
  const [password, setPassword] = useState("");
  const [useDev, setUseDev] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (useDev) {
        setToken(`dev:${email.trim().toLowerCase()}`);
        await api("/v1/auth/sync", { method: "POST", body: { fullName: email } });
      } else {
        const res = await api("/v1/auth/login", {
          method: "POST",
          body: { email, password },
        });
        setToken(res.token);
      }
      const me = await api("/v1/me");
      if (!isStaff(me.roles)) {
        localStorage.removeItem("dd_token");
        setError("This account is not staff");
        return;
      }
      router.replace("/");
    } catch (err) {
      localStorage.removeItem("dd_token");
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login card">
      <h2>Staff sign in</h2>
      <p className="muted">
        Use your staff email. Local mock is for seeded accounts like admin@dreamdrive.test.
      </p>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {!useDev && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={useDev}
            onChange={(e) => setUseDev(e.target.checked)}
            style={{ width: "auto" }}
          />
          Local mock token (dev only)
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
