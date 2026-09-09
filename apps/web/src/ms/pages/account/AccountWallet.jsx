"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faGift } from "@fortawesome/free-solid-svg-icons";
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
      <header className="account-header">
        <p className="account-eyebrow">Rewards</p>
        <h1>Wallet & rewards</h1>
        <p className="account-lead">
          Balance, loyalty points, and referrals — credit after completed trips.
        </p>
      </header>

      {error && <p className="account-msg err">{error}</p>}
      {info && <p className="account-msg ok">{info}</p>}

      <div className="account-grid account-grid--3">
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
          <strong className="wallet-code">{referral?.code || "—"}</strong>
        </div>
      </div>

      <div className="account-card">
        <h2>Share referral</h2>
        <p className="account-hint">
          Friends claim your code before their first completed trip. You get wallet
          credit when they finish.
        </p>

        <div className="wallet-referral">
          <div className="wallet-referral-code" aria-label="Your referral code">
            <FontAwesomeIcon icon={faGift} />
            <span>{referral?.code || "Loading…"}</span>
          </div>
          <button
            type="button"
            className="account-btn"
            onClick={copyCode}
            disabled={!referral?.code}
          >
            <FontAwesomeIcon icon={faCopy} />
            Copy code
          </button>
        </div>

        {!referral?.claimedCode ? (
          <form className="wallet-claim" onSubmit={claim}>
            <div className="account-field">
              <label htmlFor="claim-code">Have a friend’s code?</label>
              <input
                id="claim-code"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value)}
                placeholder="Enter code"
                autoComplete="off"
              />
            </div>
            <button
              className="account-btn"
              type="submit"
              disabled={busy || !claimCode.trim()}
            >
              {busy ? "Claiming…" : "Claim"}
            </button>
          </form>
        ) : (
          <p className="account-empty">You claimed {referral.claimedCode}.</p>
        )}
      </div>

      <div className="account-card">
        <h2>Loyalty activity</h2>
        {(loyalty?.txns || []).length === 0 ? (
          <p className="account-empty">
            Points appear after completed trips (₹1 = 1 point).
          </p>
        ) : (
          <div className="account-table-wrap">
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
                    <td className={t.points > 0 ? "wallet-pos" : undefined}>
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="account-card">
        <h2>Wallet transactions</h2>
        {(wallet?.txns || []).length === 0 ? (
          <p className="account-empty">No wallet transactions yet.</p>
        ) : (
          <div className="account-table-wrap">
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
        )}
      </div>
    </>
  );
}
