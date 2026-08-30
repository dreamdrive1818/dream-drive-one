"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Search() {
  const [cities, setCities] = useState([]);
  const [cars, setCars] = useState([]);
  const [cityId, setCityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/public/cities").then((rows) => {
      setCities(rows);
      if (rows[0]) setCityId(rows[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  async function search(e) {
    e?.preventDefault();
    const params = new URLSearchParams({ cityId, rentalType: "SELF_DRIVE" });
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    try {
      setCars(await api(`/v1/public/search?${params}`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (cityId) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  return (
    <section style={{ padding: 24 }}>
      <h1>Search cars</h1>
      <form onSubmit={search} style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
          {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="submit">Search</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {cars.map((car) => (
          <Link key={car.id} to={`/cars/${car.slug}`} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 12 }}>
            <h3>{car.name}</h3>
            <p>{car.seats} seats · {car.fuel} · {car.transmission}</p>
            <p><strong>₹{(car.pricePaise / 100).toLocaleString("en-IN")}</strong> / day</p>
            <p>{car.available === false ? "Unavailable" : "Available"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
