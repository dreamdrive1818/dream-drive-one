"use client";

import React, { useEffect, useState } from "react";
import { api, getToken } from "../../api";
import { formatDay, rupees } from "./format";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function downloadPdf(invoice) {
  const res = await fetch(`${API}/v1/me/invoices/${invoice.id}/pdf`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new Error("Could not download PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountInvoices() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/v1/me/invoices")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }, []);

  async function onDownload(invoice) {
    setBusy(invoice.id);
    setError("");
    try {
      await downloadPdf(invoice);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <h1>Tax invoices</h1>
      <p className="account-lead">Download GST tax invoices for paid trips. Amounts include CGST/SGST or IGST.</p>
      {error && <p className="account-msg err">{error}</p>}
      <div className="account-card">
        {rows.length === 0 && <p className="account-empty">No invoices yet.</p>}
        <table className="account-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Booking</th>
              <th>Date</th>
              <th>Tax</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.number}</td>
                <td>{inv.booking?.publicId}</td>
                <td>{formatDay(inv.createdAt)}</td>
                <td>
                  {inv.igstPaise
                    ? `IGST ${rupees(inv.igstPaise)}`
                    : `CGST ${rupees(inv.cgstPaise || 0)} · SGST ${rupees(inv.sgstPaise || 0)}`}
                </td>
                <td>
                  {rupees(inv.amountPaise)}
                  {(inv.lines || [])
                    .filter((l) => /damage/i.test(l.label))
                    .map((l) => (
                      <div key={l.id || l.label} className="account-hint">
                        {l.label}
                      </div>
                    ))}
                </td>
                <td>
                  <button
                    className="account-btn ghost"
                    type="button"
                    disabled={busy === inv.id}
                    onClick={() => onDownload(inv)}
                  >
                    {busy === inv.id ? "Downloading…" : "Tax invoice PDF"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
