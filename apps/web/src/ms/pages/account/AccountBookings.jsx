"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDay, prettyStatus, rupees, statusTone } from "./format";

export default function AccountBookings() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/me/bookings")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Bookings</h1>
      <p className="account-lead">Open a trip to track status, KYC, and agreements.</p>
      {error && <p className="account-msg err">{error}</p>}
      {rows.length === 0 && !error && (
        <div className="account-card">
          <p className="account-empty">
            No bookings yet. <Link to="/fleet">Find a car</Link>
          </p>
        </div>
      )}
      <div className="account-list">
        {rows.map((b) => (
          <Link key={b.id} className="account-item" to={`/account/bookings/${b.publicId}`}>
            <img src={b.carModel?.images?.[0]?.url || "/favicon.ico"} alt="" />
            <div>
              <h3>{b.carModel?.name || b.publicId}</h3>
              <p>
                {b.pickupBranch?.name || "Pickup"} · {formatDay(b.startsAt)} → {formatDay(b.endsAt)}
                <br />
                {rupees(b.amountPaise)} · {b.rentalType?.replace(/_/g, " ")}
                {b.subscription?.swapDueReason === "SERVICE" ? " · Swap due to service" : ""}
              </p>
            </div>
            <span className={`account-pill ${statusTone(b.status)}`}>{prettyStatus(b.status)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
