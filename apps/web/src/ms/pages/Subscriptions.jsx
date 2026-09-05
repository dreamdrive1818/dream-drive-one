"use client";

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { formatInr } from "../fleetSearch";
import "./Checkout.css";

export default function Subscriptions() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/v1/public/subscriptions/plans")
      .then((rows) => setPlans(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e.message));
  }, []);

  async function subscribe(planId) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent("/subscriptions")}`);
      return;
    }
    setBusy(planId);
    setError("");
    try {
      const sub = await api("/v1/subscriptions", { method: "POST", body: { planId } });
      const publicId = sub?.booking?.publicId || sub?.bookingId;
      if (publicId) navigate(`/checkout/pay?booking=${encodeURIComponent(publicId)}`);
      else navigate("/account/bookings");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="checkout-page">
      <div className="checkout-inner">
        <h1>Subscriptions</h1>
        <p className="checkout-lead">
          Keep a car for a month or longer. Price and included kilometres come from the plan — we do not invent amounts in the browser.
        </p>
        {!ready ? null : !user ? (
          <p className="checkout-muted">
            <Link to={`/login?redirect=${encodeURIComponent("/subscriptions")}`}>Sign in</Link> to subscribe.
          </p>
        ) : null}
        {error && <p className="checkout-err">{error}</p>}
        <div className="checkout-layout" style={{ gridTemplateColumns: "1fr" }}>
          {(plans || []).map((p) => {
            const img = p.carModel?.images?.[0]?.url;
            return (
              <article key={p.id} className="checkout-card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                {img ? (
                  <img src={img} alt="" style={{ width: 140, height: 90, objectFit: "cover", borderRadius: 10 }} />
                ) : null}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 style={{ margin: "0 0 6px" }}>{p.carModel?.name || "Car"}</h2>
                  <p className="checkout-muted" style={{ margin: 0 }}>
                    {p.months} month{p.months === 1 ? "" : "s"} · {p.includedKm} km included
                    {p.maintenanceIncl ? " · maintenance included" : ""}
                    {p.swapAllowed ? " · swap allowed" : ""}
                  </p>
                  {p.carModel?.slug ? (
                    <p>
                      <Link to={`/cars/${p.carModel.slug}`}>View car</Link>
                    </p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>{formatInr(p.pricePaise)}</p>
                  {p.depositPaise > 0 && (
                    <p className="checkout-muted" style={{ margin: "4px 0 10px" }}>
                      Deposit {formatInr(p.depositPaise)}
                    </p>
                  )}
                  <button
                    className="checkout-cta"
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => subscribe(p.id)}
                    style={{ minWidth: 160 }}
                  >
                    {busy === p.id ? "Starting…" : user ? "Subscribe" : "Sign in to subscribe"}
                  </button>
                </div>
              </article>
            );
          })}
          {!(plans || []).length && !error && <p className="checkout-empty">No subscription plans are published yet.</p>}
        </div>
      </div>
    </section>
  );
}
