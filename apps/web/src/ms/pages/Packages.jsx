"use client";

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCalendarDays, faCarSide, faLocationDot } from "@fortawesome/free-solid-svg-icons";
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
    <section className="packages-page" aria-label="Tour packages">
      <div className="packages-inner">
        <header className="packages-header">
          <p className="packages-eyebrow">Tours</p>
          <h1>Tours & chauffeur trips</h1>
          <p className="packages-lead">
            Packaged itineraries at a fixed price. Airport transfers, outstation,
            and one-way trips are quoted from the car page.
          </p>
        </header>

        {loading ? (
          <div className="packages-loading">
            <ClipLoader color="#0e7c86" size={40} />
          </div>
        ) : null}

        {error ? <p className="packages-err">{error}</p> : null}

        {!loading && !rows.length && !error ? (
          <p className="packages-empty">No published tour packages yet.</p>
        ) : null}

        <div className="packages-grid">
          {rows.map((p) => {
            const days = p.daysDetail || [];
            const preview = days.slice(0, 3);
            return (
              <article key={p.id} className="packages-card">
                <div className="packages-card-top">
                  <p className="packages-kicker">
                    <span>
                      <FontAwesomeIcon icon={faCalendarDays} />
                      {p.days} day{p.days === 1 ? "" : "s"}
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faCarSide} />
                      {p.carClass || "Any class"}
                    </span>
                    {p.city?.name ? (
                      <span>
                        <FontAwesomeIcon icon={faLocationDot} />
                        {p.city.name}
                      </span>
                    ) : null}
                  </p>
                  <h2>{p.name}</h2>
                  <p className="packages-price">
                    {formatInr(p.pricePaise)}
                    <span>fixed package</span>
                  </p>
                  {p.inclusions ? (
                    <p className="packages-incl">{p.inclusions}</p>
                  ) : null}
                </div>

                {preview.length > 0 ? (
                  <ol className="packages-preview">
                    {preview.map((d) => (
                      <li key={d.id || d.dayNumber}>
                        <strong>Day {d.dayNumber}</strong>
                        <span>{d.title}</span>
                      </li>
                    ))}
                    {days.length > 3 ? (
                      <li className="packages-more">
                        +{days.length - 3} more day{days.length - 3 === 1 ? "" : "s"}
                      </li>
                    ) : null}
                  </ol>
                ) : null}

                <Link className="packages-cta" to={`/packages/${p.slug}`}>
                  View itinerary
                  <FontAwesomeIcon icon={faArrowRight} />
                </Link>
              </article>
            );
          })}
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
          <ClipLoader color="#0e7c86" size={40} />
        </div>
      </section>
    );
  }

  if (error || !pack) {
    return (
      <section className="packages-page">
        <div className="packages-inner">
          <p className="packages-err">{error || "Package not found"}</p>
          <Link to="/packages" className="packages-back">
            ← Back to packages
          </Link>
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
    <section className="packages-page packages-page--detail">
      <div className="packages-inner">
        <Link to="/packages" className="packages-back">
          ← All packages
        </Link>

        <div className="packages-detail">
          <header className="packages-detail-header">
            <p className="packages-kicker">
              <span>
                <FontAwesomeIcon icon={faCalendarDays} />
                {pack.days} day{pack.days === 1 ? "" : "s"}
              </span>
              {pack.carClass ? (
                <span>
                  <FontAwesomeIcon icon={faCarSide} />
                  {pack.carClass}
                </span>
              ) : null}
              {pack.city?.name ? (
                <span>
                  <FontAwesomeIcon icon={faLocationDot} />
                  {pack.city.name}
                </span>
              ) : null}
            </p>
            <h1>{pack.name}</h1>
            <p className="packages-price">
              {formatInr(pack.pricePaise)}
              <span>fixed package</span>
            </p>
            {pack.inclusions ? <p className="packages-incl">{pack.inclusions}</p> : null}
            <Link className="packages-cta" to={`/fleet?${params.toString()}`}>
              Choose a car and dates
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          </header>

          <div className="packages-detail-body">
            <h2>Itinerary</h2>
            <ol className="packages-itinerary">
              {(pack.daysDetail || []).map((d) => (
                <li key={d.id || d.dayNumber}>
                  <span className="packages-day-badge">Day {d.dayNumber}</span>
                  <div>
                    <strong>{d.title}</strong>
                    {d.description ? <p>{d.description}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
