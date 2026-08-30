"use client";

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export default function Checkout() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState("WELCOME10");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQuote({ id: quoteId });
  }, [quoteId]);

  async function pay() {
    setBusy(true);
    setError("");
    try {
      if (code) {
        await api(`/v1/quotes/${quoteId}/apply-offer`, { method: "POST", body: { code } }).catch(() => {});
      }
      const booking = await api("/v1/bookings", { method: "POST", body: { quoteId } });
      const order = await api("/v1/payments/orders", {
        method: "POST",
        body: { bookingId: booking.id, kind: "TOKEN" },
      });
      if (order.mock) {
        await api("/v1/payments/verify", {
          method: "POST",
          body: { paymentId: order.paymentId },
        });
      }
      navigate(`/checkout/success?booking=${booking.publicId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1>Checkout</h1>
      <p>Quote {quote?.id}</p>
      <label>
        Offer code
        <input value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button onClick={pay} disabled={busy}>{busy ? "Paying…" : "Pay token (test)"}</button>
    </section>
  );
}
