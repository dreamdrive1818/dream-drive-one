"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { formatWhen, rupees } from "./format";

export default function AccountWallet() {
  const [wallet, setWallet] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [referral, setReferral] = useState(null);
  const [claimCode, setClaimCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    Promise.all([
      api("/v1/me/wallet"),
      api("/v1/me/loyalty"),
      api("/v1/me/referrals"),
    ])
      .then(([w, l, r]) => {
        setWallet(w);
        setLoyalty(l);
        setReferral(r);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function claim(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const row = await api("/v1/me/referrals/claim", {
        method: "POST",
        body: { code: claimCode },
      });
      setReferral(row);
      setClaimCode("");
      setInfo("Referral code claimed. Credit lands after your first completed trip.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      setInfo("Referral code copied.");
    } catch {
      setInfo(referral.code);
    }
  }

  return (
    <>
      <h1>Wallet & rewards</h1>
      <p className="account-lead">Balance, loyalty points, and your referral code.</p>
      {error && <p className="account-msg err">{error}</p>}
      {info && <p className="account-msg">{info}</p>}

      <div className="account-grid">
        <div className="account-stat">
          <span>Wallet</span>
          <strong>{rupees(wallet?.balancePaise)}</strong>
        </div>
        <div className="account-stat">
          <span>Loyalty points</span>
          <strong>{loyalty?.points ?? 0}</strong>
        </div>
        <div className="account-stat">
          <span>Your referral code</span>
          <strong>{referral?.code || "—"}</strong>
        </div>
      </div>

      <div className="account-card">
        <h2>Share referral</h2>
        <p className="account-empty">
          Friends claim your code before their first completed trip. You get wallet credit when they finish.
        </p>
        <button type="button" className="account-btn" onClick={copyCode} disabled={!referral?.code}>
          Copy code
        </button>
        {!referral?.claimedCode && (
          <form className="account-form" onSubmit={claim} style={{ marginTop: 16 }}>
            <label>
              Have a friend’s code?
              <input
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value)}
                placeholder="Enter code"
              />
            </label>
            <button type="submit" disabled={busy || !claimCode.trim()}>
              Claim
            </button>
          </form>
        )}
        {referral?.claimedCode && (
          <p className="account-empty">You claimed {referral.claimedCode}.</p>
        )}
      </div>

      <div className="account-card">
        <h2>Loyalty activity</h2>
        {(loyalty?.txns || []).length === 0 && (
          <p className="account-empty">Points appear after completed trips (₹1 = 1 point).</p>
        )}
        <table className="account-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Reason</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {(loyalty?.txns || []).map((t) => (
              <tr key={t.id}>
                <td>{formatWhen(t.createdAt)}</td>
                <td>{t.reason}</td>
                <td>{t.points > 0 ? `+${t.points}` : t.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="account-card">
        <h2>Wallet transactions</h2>
        {(wallet?.txns || []).length === 0 && (
          <p className="account-empty">No wallet transactions yet.</p>
        )}
        <table className="account-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Reason</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(wallet?.txns || []).map((t) => (
              <tr key={t.id}>
                <td>{formatWhen(t.createdAt)}</td>
                <td>{t.reason}</td>
                <td>{rupees(t.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
