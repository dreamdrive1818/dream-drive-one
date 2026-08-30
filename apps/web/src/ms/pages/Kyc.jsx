"use client";

import React, { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Kyc() {
  const { user } = useAuth();
  const [url, setUrl] = useState("https://placehold.co/600x400?text=DL");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    try {
      await api("/v1/kyc/uploads", { method: "POST", body: { kind: "DL", url } });
      await api("/v1/kyc/submit", {
        method: "POST",
        body: { documents: [{ kind: "DL", url }, { kind: "AADHAAR", url }] },
      });
      setMessage("KYC submitted. Admin will review.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  if (!user) return <p style={{ padding: 24 }}>Sign in first.</p>;

  return (
    <section style={{ padding: 24, maxWidth: 520 }}>
      <h1>KYC</h1>
      <form onSubmit={submit}>
        <label>
          Document URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: "100%" }} />
        </label>
        <button type="submit" style={{ marginTop: 12 }}>Submit</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}
