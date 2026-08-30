"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { loginDev, user } = useAuth();
  const [email, setEmail] = useState("customer@dreamdrive.test");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await loginDev(email);
      navigate("/account");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section style={{ maxWidth: 420, margin: "40px auto", padding: 24 }}>
      <h1>Sign in</h1>
      <p>Local demo uses a dev token. Try customer@dreamdrive.test</p>
      {user && <p>Signed in as {user.email}</p>}
      <form onSubmit={submit}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          style={{ width: "100%", padding: 10, margin: "12px 0" }}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit">Continue</button>
      </form>
    </section>
  );
}
