"use client";

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faGaugeHigh,
  faShieldHalved,
  faRightLeft,
  faCalendarDays,
} from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { formatInr } from "../fleetSearch";
import "./Subscriptions.css";

export default function Subscriptions() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/v1/public/subscriptions/plans")
      .then((rows) => setPlans(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function subscribe(planId) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent("/subscriptions")}`);
      return;
    }
    setBusy(planId);
    setError("");
    try {
      const sub = await api("/v1/subscriptions", {
        method: "POST",
        body: { planId },
      });
      const publicId = sub?.booking?.publicId || sub?.bookingId;
      if (publicId) {
        navigate(`/checkout/pay?booking=${encodeURIComponent(publicId)}`);
      } else {
        navigate("/account/bookings");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="subs-page" aria-label="Subscriptions">
      <div className="subs-inner">
        <header className="subs-header">
          <p className="subs-eyebrow">Subscriptions</p>
          <h1>Keep a car for longer</h1>
          <p className="subs-lead">
            Monthly plans with included kilometres. Pricing comes from the plan —
            nothing is inventing numbers in the browser.
          </p>
          {ready && !user ? (
            <p className="subs-signin">
              <Link to={`/login?redirect=${encodeURIComponent("/subscriptions")}`}>
                Sign in
              </Link>{" "}
              to subscribe.
            </p>
          ) : null}
        </header>

        {loading ? (
          <div className="subs-loading">
            <ClipLoader color="#0e7c86" size={40} />
          </div>
        ) : null}

        {error ? <p className="subs-err">{error}</p> : null}

        {!loading && !plans.length && !error ? (
          <p className="subs-empty">No subscription plans are published yet.</p>
        ) : null}

        <div className="subs-grid">
          {plans.map((p) => {
            const img = p.carModel?.images?.[0]?.url;
            const name = p.carModel?.name || "Car";
            return (
              <article key={p.id} className="subs-card">
                <div className="subs-media">
                  {img ? (
                    <img src={img} alt={name} loading="lazy" />
                  ) : (
                    <div className="subs-media-fallback">{name}</div>
                  )}
                </div>

                <div className="subs-body">
                  <h2>{name}</h2>
                  <p className="subs-price">
                    {formatInr(p.pricePaise)}
                    <span>/ plan</span>
                  </p>
                  {p.depositPaise > 0 ? (
                    <p className="subs-deposit">
                      Deposit {formatInr(p.depositPaise)}
                    </p>
                  ) : null}

                  <ul className="subs-meta">
                    <li>
                      <FontAwesomeIcon icon={faCalendarDays} />
                      {p.months} month{p.months === 1 ? "" : "s"}
                    </li>
                    <li>
                      <FontAwesomeIcon icon={faGaugeHigh} />
                      {p.includedKm} km included
                    </li>
                    {p.maintenanceIncl ? (
                      <li>
                        <FontAwesomeIcon icon={faShieldHalved} />
                        Maintenance included
                      </li>
                    ) : null}
                    {p.swapAllowed ? (
                      <li>
                        <FontAwesomeIcon icon={faRightLeft} />
                        Swap allowed
                      </li>
                    ) : null}
                  </ul>

                  <div className="subs-actions">
                    {p.carModel?.slug ? (
                      <Link className="subs-link" to={`/cars/${p.carModel.slug}`}>
                        View car
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="subs-cta"
                      disabled={busy === p.id}
                      onClick={() => subscribe(p.id)}
                    >
                      {busy === p.id
                        ? "Starting…"
                        : user
                          ? "Subscribe"
                          : "Sign in to subscribe"}
                      <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
