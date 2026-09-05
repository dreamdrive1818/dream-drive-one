"use client";

import React, { useEffect, useState } from "react";
import { api, getToken } from "../../api";
import { prettyStatus, statusTone } from "./format";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function downloadAgreement(id, signed) {
  const res = await fetch(`${API}/v1/me/agreements/${id}/${signed ? "signed-pdf" : "pdf"}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new Error("Could not download PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = signed ? "rental-agreement-signed.pdf" : "rental-agreement.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountAgreements() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/v1/me/documents")
      .then((data) => setRows(data.agreements || []))
      .catch((e) => setError(e.message));
  }, []);

  async function onDownload(id, signed) {
    setBusy(id + (signed ? "-s" : ""));
    setError("");
    try {
      await downloadAgreement(id, signed);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <h1>Agreements</h1>
      <p className="account-lead">Rental agreements and e-sign status for your trips.</p>
      {error && <p className="account-msg err">{error}</p>}
      <div className="account-card">
        {rows.length === 0 && <p className="account-empty">No agreements yet. They appear after payment and KYC.</p>}
        <table className="account-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.booking?.publicId || a.bookingId}</td>
                <td>
                  <span className={`account-pill ${statusTone(a.status)}`}>{prettyStatus(a.status)}</span>
                </td>
                <td>
                  <button
                    className="account-btn ghost"
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => onDownload(a.id, false)}
                  >
                    {busy === a.id ? "Downloading…" : "PDF"}
                  </button>
                  {(a.status === "SIGNED" || a.status === "WAIVED") && (
                    <button
                      className="account-btn ghost"
                      type="button"
                      disabled={busy === `${a.id}-s`}
                      onClick={() => onDownload(a.id, true)}
                    >
                      Signed PDF
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
