"use client";

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function CarDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/v1/public/cars/${slug}`).then(setCar).catch((e) => setError(e.message));
  }, [slug]);

  async function book() {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      const quote = await api("/v1/quotes", {
        method: "POST",
        body: {
          carModelId: car.id,
          rentalType: "SELF_DRIVE",
          startsAt: new Date(from).toISOString(),
          endsAt: new Date(to).toISOString(),
        },
      });
      navigate(`/checkout/${quote.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!car) return <p style={{ padding: 24 }}>{error || "Loading…"}</p>;

  return (
    <section style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>{car.name}</h1>
      <p>{car.seats} seats · {car.fuel} · {car.transmission}</p>
      <label>From <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <br />
      <label>To <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <div style={{ marginTop: 16 }}>
        <button onClick={book} disabled={!from || !to}>Get quote & checkout</button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </section>
  );
}
