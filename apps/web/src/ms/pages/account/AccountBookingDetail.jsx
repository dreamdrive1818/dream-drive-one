"use client";

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getToken } from "../../api";
import { formatWhen, prettyStatus, rupees, statusTone } from "./format";

export default function AccountBookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api(`/v1/bookings/${id}`)
      .then(setBooking)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function cancel() {
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      const result = await api(`/v1/bookings/${booking.id}/cancel`, { method: "POST", body: {} });
      if (result?.refundPct != null) {
        setError("");
        window.alert(
          result.refundPct > 0
            ? `Cancelled. Refund ${result.refundPct}% (₹${((result.refundPaise || 0) / 100).toLocaleString("en-IN")}) per cancellation policy.`
            : "Cancelled. No refund is due under the current cancellation policy."
        );
      }
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!booking && !error) return <p className="account-empty">Loading booking…</p>;
  if (error && !booking) return <p className="account-msg err">{error}</p>;

  const canCancel = !["HANDOVER", "ONGOING", "COMPLETED", "CANCELLED"].includes(booking.status);

  return (
    <>
      <p className="account-hint">
        <Link to="/account/bookings">← All bookings</Link>
      </p>
      <h1>{booking.publicId}</h1>
      <p className="account-lead">
        <span className={`account-pill ${statusTone(booking.status)}`}>{prettyStatus(booking.status)}</span>
        {" · "}
        {rupees(booking.amountPaise)}
      </p>
      {error && <p className="account-msg err">{error}</p>}
      {booking.subscription?.swapDueReason === "SERVICE" && (
        <p className="account-msg warn">
          Swap due to service. Your current car is going into the workshop; we will assign a replacement of the same class.
        </p>
      )}

      <div className="account-card" style={{ marginBottom: 16 }}>
        <p>
          {formatWhen(booking.startsAt)} → {formatWhen(booking.endsAt)}
        </p>
        <p>{booking.rentalType?.replace(/_/g, " ")}</p>
        {booking.vehicle?.registration && (
          <p>
            Vehicle: <strong>{booking.vehicle.registration}</strong>
          </p>
        )}
        {booking.driverAssignment?.driver && (
          <p>
            Driver: <strong>{booking.driverAssignment.driver.fullName}</strong>
            {booking.driverAssignment.driver.phone
              ? ` · ${booking.driverAssignment.driver.phone}`
              : ""}
          </p>
        )}
        {booking.kycCase && (
          <p>
            KYC: <strong>{prettyStatus(booking.kycCase.status)}</strong>
            {" · "}
            <Link to="/account/kyc">Update documents</Link>
          </p>
        )}
        {(booking.agreements || []).map((a) => (
          <p key={a.id}>
            Agreement: <strong>{prettyStatus(a.status)}</strong>
            {" · "}
            <button
              className="account-btn ghost"
              type="button"
              onClick={() => {
                const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                const signed = a.status === "SIGNED" || a.status === "WAIVED";
                fetch(`${API}/v1/me/agreements/${a.id}/${signed ? "signed-pdf" : "pdf"}`, {
                  headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
                })
                  .then((res) => {
                    if (!res.ok) throw new Error("Could not download PDF");
                    return res.blob();
                  })
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "rental-agreement.pdf";
                    link.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              Download PDF
            </button>
          </p>
        ))}
        {(booking.extras || []).some((ex) => /damage/i.test(ex.label)) && (
          <p>
            Damage charges:{" "}
            <strong>
              {rupees(
                (booking.extras || [])
                  .filter((ex) => /damage/i.test(ex.label))
                  .reduce((s, ex) => s + (ex.amountPaise || 0), 0)
              )}
            </strong>
            {" · "}
            <Link to="/account/invoices">View invoices</Link>
          </p>
        )}
        <div className="account-row" style={{ marginTop: 12 }}>
          <Link className="account-btn" to={`/track/${booking.publicId}`}>
            Open tracking
          </Link>
          <Link className="account-btn ghost" to="/account/tickets">
            Need help?
          </Link>
          {canCancel && (
            <button className="account-btn danger" type="button" disabled={busy} onClick={cancel}>
              Cancel booking
            </button>
          )}
        </div>
      </div>

      <div className="account-card">
        <h2>Status history</h2>
        <ol>
          {(booking.history || []).map((h) => (
            <li key={h.id}>
              {prettyStatus(h.to)} {h.reason ? `— ${h.reason}` : ""} · {formatWhen(h.createdAt)}
            </li>
          ))}
        </ol>
      </div>

      {(booking.inspections || []).length > 0 && (
        <div className="account-card" style={{ marginTop: 16 }}>
          <h2>Vehicle inspections</h2>
          {(booking.inspections || []).map((ins) => (
            <div key={ins.id} style={{ marginBottom: 16 }}>
              <p>
                <strong>{prettyStatus(ins.type)}</strong>
                {" · "}
                {ins.odometerKm} km
                {" · fuel "}
                {ins.fuelUnit === "PERCENT" ? `${ins.fuelLevel}%` : `${ins.fuelLevel}/8`}
              </p>
              {(ins.damages || []).map((d) => (
                <p key={d.id}>
                  Damage: {d.description} · {rupees(d.amountPaise)}
                </p>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(ins.photos || []).map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
