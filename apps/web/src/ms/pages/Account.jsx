"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Account() {
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (user) api("/v1/me/bookings").then(setBookings).catch(() => setBookings([]));
  }, [user]);

  if (!user) {
    return <p style={{ padding: 24 }}>Please <Link to="/login">sign in</Link>.</p>;
  }

  return (
    <section style={{ padding: 24 }}>
      <h1>Hi {user.fullName || user.email}</h1>
      <p>KYC: {user.kycStatus}</p>
      <p>
        <Link to="/account/kyc">KYC</Link>
        {" · "}
        <button onClick={logout}>Sign out</button>
      </p>
      <h2>Bookings</h2>
      <ul>
        {bookings.map((b) => (
          <li key={b.id}>
            <Link to={`/track/${b.publicId}`}>{b.publicId}</Link> — {b.status} — ₹{(b.amountPaise / 100).toLocaleString("en-IN")}
          </li>
        ))}
      </ul>
    </section>
  );
}
