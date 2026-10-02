"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, peekApi } from "../../api";
import { AccountBookingsSkeleton } from "../../../components/Skeleton/Skeleton";
import { formatDay, prettyStatus, rupees, statusTone } from "./format";

export default function AccountBookings() {
  const cached = peekApi("/v1/me/bookings");
  const [rows, setRows] = useState(() => (Array.isArray(cached) ? cached : []));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!Array.isArray(cached));

  useEffect(() => {
    let cancelled = false;
    const hit = peekApi("/v1/me/bookings");
    if (Array.isArray(hit)) {
      setRows(hit);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError("");
    api("/v1/me/bookings")
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          if (!Array.isArray(peekApi("/v1/me/bookings"))) setRows([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <h1>Bookings</h1>
      <p className="account-lead">Open a trip to track status, KYC, and agreements.</p>
      {error && <p className="account-msg err">{error}</p>}
      {loading && <AccountBookingsSkeleton />}
      {!loading && rows.length === 0 && !error && (
        <div className="account-card">
          <p className="account-empty">
            No bookings yet. <Link to="/fleet">Find a car</Link>
          </p>
        </div>
      )}
      {!loading && (
        <div className="account-list">
          {rows.map((b) => (
            <Link key={b.id} className="account-item account-item--booking" to={`/account/bookings/${b.publicId}`}>
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
      )}
    </>
  );
}
