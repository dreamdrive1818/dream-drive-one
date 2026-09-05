"use client";

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { formatInr } from "../fleetSearch";
import "./Packages.css";

export default function Packages() {
  const { slug } = useParams();
  if (slug) return <PackageDetail slug={slug} />;
  return <PackageList />;
}

function PackageList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/public/packages")
      .then(setRows)
      .catch((e) => setError(e.message || "Could not load packages"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="packages-page">
      <div className="packages-inner">
        <header className="packages-header">
          <h1>Tours & chauffeur trips</h1>
          <p>
            Packaged itineraries at a fixed price. Airport transfers, outstation and one-way
            trips are quoted from the car page.
          </p>
        </header>
        {loading && (
          <div className="packages-loading">
            <ClipLoader color="var(--primary-color, #0072ce)" size={36} />
          </div>
        )}
        {error && <p className="packages-err">{error}</p>}
        {!loading && !rows.length && !error && (
          <p className="packages-empty">No published tour packages yet.</p>
        )}
        <div className="packages-grid">
          {rows.map((p) => (
            <article key={p.id} className="packages-card">
              <p className="packages-kicker">{p.days} day{p.days === 1 ? "" : "s"} · {p.carClass || "Any class"}</p>
              <h2>{p.name}</h2>
              {p.city?.name && <p className="packages-city">{p.city.name}</p>}
              <p className="packages-price">{formatInr(p.pricePaise)}</p>
              {p.inclusions && <p className="packages-incl">{p.inclusions}</p>}
              <ol>
                {(p.daysDetail || []).map((d) => (
                  <li key={d.id || d.dayNumber}>
                    Day {d.dayNumber}: {d.title}
                  </li>
                ))}
              </ol>
              <Link className="packages-cta" to={`/packages/${p.slug}`}>
                View itinerary
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PackageDetail({ slug }) {
  const [pack, setPack] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/v1/public/packages/${slug}`)
      .then(setPack)
      .catch((e) => setError(e.message || "Package not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <section className="packages-page">
        <div className="packages-inner packages-loading">
          <ClipLoader color="var(--primary-color, #0072ce)" size={36} />
        </div>
      </section>
    );
  }

  if (error || !pack) {
    return (
      <section className="packages-page">
        <div className="packages-inner">
          <p className="packages-err">{error || "Package not found"}</p>
          <Link to="/packages">Back to packages</Link>
        </div>
      </section>
    );
  }

  const params = new URLSearchParams({
    rentalType: "TOUR_PACKAGE",
    packageId: pack.id,
  });
  if (pack.cityId) params.set("cityId", pack.cityId);
  if (pack.carClass) params.set("type", pack.carClass);

  return (
    <section className="packages-page">
      <div className="packages-inner">
        <Link to="/packages" className="packages-back">← All packages</Link>
        <header className="packages-header" style={{ textAlign: "left" }}>
          <p className="packages-kicker">
            {pack.days} day{pack.days === 1 ? "" : "s"}
            {pack.carClass ? ` · ${pack.carClass}` : ""}
            {pack.city?.name ? ` · ${pack.city.name}` : ""}
          </p>
          <h1>{pack.name}</h1>
          <p className="packages-price">{formatInr(pack.pricePaise)}</p>
          {pack.inclusions && <p>{pack.inclusions}</p>}
        </header>
        <ol className="packages-itinerary">
          {(pack.daysDetail || []).map((d) => (
            <li key={d.id || d.dayNumber}>
              <strong>Day {d.dayNumber}: {d.title}</strong>
              {d.description && <p>{d.description}</p>}
            </li>
          ))}
        </ol>
        <Link className="packages-cta" to={`/fleet?${params.toString()}`}>
          Choose a car and dates
        </Link>
      </div>
    </section>
  );
}
