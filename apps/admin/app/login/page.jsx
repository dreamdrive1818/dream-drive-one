"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@dreamdrive.test");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const token = `dev:${email.trim().toLowerCase()}`;
    setToken(token);
    try {
      await api("/v1/auth/sync", { method: "POST", body: { fullName: email } });
      const me = await api("/v1/me");
      if (!me.roles || me.roles.includes("CUSTOMER") && me.roles.length === 1) {
        setError("This account is not staff");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login card">
      <h2>Staff sign in</h2>
      <p className="muted">Local mock: Bearer dev:email — seed admin@dreamdrive.test</p>
      <form onSubmit={submit}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {error && <p className="err">{error}</p>}
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}
