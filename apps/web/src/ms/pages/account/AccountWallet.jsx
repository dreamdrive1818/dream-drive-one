"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { formatWhen, rupees } from "./format";

export default function AccountWallet() {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/me/wallet")
      .then(setWallet)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Wallet</h1>
      <p className="account-lead">Loyalty balance and recent wallet activity.</p>
      {error && <p className="account-msg err">{error}</p>}
      <div className="account-grid">
        <div className="account-stat">
          <span>Balance</span>
          <strong>{rupees(wallet?.balancePaise)}</strong>
        </div>
      </div>
      <div className="account-card">
        <h2>Transactions</h2>
        {(wallet?.txns || []).length === 0 && <p className="account-empty">No wallet transactions yet.</p>}
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
