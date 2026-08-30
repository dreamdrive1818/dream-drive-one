"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function Track() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/v1/bookings/${bookingId}`).then(setBooking).catch((e) => setError(e.message));
  }, [bookingId]);

  if (error) return <p style={{ padding: 24 }}>{error}</p>;
  if (!booking) return <p style={{ padding: 24 }}>Loading…</p>;

  return (
    <section style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1>Tracking {booking.publicId}</h1>
      <p>Status: <strong>{booking.status}</strong></p>
      <ol>
        {(booking.history || []).map((h) => (
          <li key={h.id}>{h.to} {h.reason ? `— ${h.reason}` : ""}</li>
        ))}
      </ol>
    </section>
  );
}
