"use client";

import React from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function Success() {
  const [params] = useSearchParams();
  const booking = params.get("booking");
  return (
    <section style={{ padding: 24, textAlign: "center" }}>
      <h1>Payment received</h1>
      <p>Booking {booking}. Complete KYC next for self-drive.</p>
      <p>
        <Link to={`/track/${booking}`}>Track booking</Link>
        {" · "}
        <Link to="/account/kyc">Upload KYC</Link>
      </p>
    </section>
  );
}
