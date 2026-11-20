"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faCarSide,
  faLocationDot,
  faClock,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { api, getToken } from "../../api";
import { RENTAL_TYPE_LABELS, tokenDuePaise } from "../../fleetSearch";
import {
  formatDay,
  formatTime,
  formatWhen,
  prettyStatus,
  rupees,
  statusTone,
  tripHours,
} from "./format";
import { Skeleton, SkeletonText } from "../../../components/Skeleton/Skeleton";
import "./AccountBookingDetail.css";

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function trackingUrl(publicId) {
  if (typeof window === "undefined") return `/track/${publicId}`;
  return `${window.location.origin}/track/${publicId}`;
}

function orderDetailsText(booking) {
  const car = booking.carModel || booking.vehicle?.carModel;
  return [
    `Dream Drive booking ${booking.publicId}`,
    `Status: ${prettyStatus(booking.status)}`,
    `Amount: ${rupees(booking.amountPaise)}`,
    `Trip: ${formatWhen(booking.startsAt)} → ${formatWhen(booking.endsAt)}`,
    booking.rentalType
      ? `Type: ${RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType}`
      : null,
    car?.name ? `Car: ${car.name}` : null,
    booking.vehicle?.registration ? `Vehicle: ${booking.vehicle.registration}` : null,
    booking.pickupBranch?.name
      ? `Pickup: ${booking.pickupBranch.name}${
          booking.pickupBranch.city?.name ? `, ${booking.pickupBranch.city.name}` : ""
        }`
      : null,
    booking.dropBranch?.name
      ? `Drop: ${booking.dropBranch.name}${
          booking.dropBranch.city?.name ? `, ${booking.dropBranch.city.name}` : ""
        }`
      : null,
    booking.driverAssignment?.driver?.fullName
      ? `Driver: ${booking.driverAssignment.driver.fullName}${
          booking.driverAssignment.driver.phone
            ? ` (${booking.driverAssignment.driver.phone})`
            : ""
        }`
      : null,
    `Track: ${trackingUrl(booking.publicId)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function nextStep(booking) {
  if (booking.status === "AWAITING_PAYMENT") {
    return {
      title: "Pay the token to reserve this car",
      body: "Only the token is charged now. The remaining rental is collected before handover.",
      cta: "Pay token now",
      to: `/checkout/pay?booking=${encodeURIComponent(booking.publicId)}`,
      tone: "pay",
    };
  }
  if (booking.status === "AWAITING_KYC") {
    return {
      title: "Upload your licence and ID",
      body: "KYC is required for self-drive before the agreement and handover.",
      cta: "Complete KYC",
      to: `/account/kyc?booking=${encodeURIComponent(booking.publicId)}`,
      tone: "next",
    };
  }
  if (booking.status === "AWAITING_SIGNATURE") {
    return {
      title: "Sign the rental agreement",
      body: "Review and sign to confirm the booking.",
      cta: "Open agreements",
      to: "/account/agreements",
      tone: "next",
    };
  }
  return null;
}

export default function AccountBookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewInfo, setReviewInfo] = useState("");
  const [copied, setCopied] = useState("");

  function load() {
    return api(`/v1/bookings/${id}`, { cache: false })
      .then(setBooking)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    let cancelled = false;
    setError("");
    api(`/v1/bookings/${id}`, { cache: false })
      .then(async (row) => {
        if (cancelled) return;
        setBooking(row);
        if (row.status !== "AWAITING_PAYMENT" && row.status !== "HOLD") return;
        setSyncing(true);
        try {
          const synced = await api("/v1/payments/sync", {
            method: "POST",
            body: { bookingId: row.id },
          });
          if (cancelled) return;
          if (synced?.status && synced.status !== row.status) {
            const latest = await api(`/v1/bookings/${row.id}`, { cache: false });
            if (!cancelled) setBooking(latest);
          }
        } catch {
          /* best-effort */
        } finally {
          if (!cancelled) setSyncing(false);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function copyValue(text, key) {
    try {
      await copyToClipboard(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? "" : current)), 2000);
    } catch {
      setCopied("");
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      const result = await api(`/v1/bookings/${booking.id}/cancel`, {
        method: "POST",
        body: {},
      });
      if (result?.refundPct != null) {
        setError("");
        window.alert(
          result.refundPct > 0
            ? `Cancelled. Refund ${result.refundPct}% (₹${((result.refundPaise || 0) / 100).toLocaleString("en-IN")}) per cancellation policy.`
            : "Cancelled. No refund is due under the current cancellation policy."
        );
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setReviewInfo("");
    try {
      await api("/v1/reviews", {
        method: "POST",
        body: {
          bookingId: booking.id,
          carModelId: booking.carModelId,
          rating: Number(rating),
          body: reviewBody,
        },
      });
      setReviewInfo("Review submitted. It appears on the car page after staff publish it.");
      setReviewBody("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const derived = useMemo(() => {
    if (!booking) return null;
    const car = booking.carModel || booking.vehicle?.carModel || null;
    const imageUrl = car?.images?.[0]?.url || "";
    const tokenDue = tokenDuePaise(booking.tokenPaise, booking.amountPaise);
    const paidToken = (booking.payments || [])
      .filter((p) => p.status === "SUCCESS" && ["TOKEN", "WALLET"].includes(p.kind))
      .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
    const paidTotal = (booking.payments || [])
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + (p.amountPaise || 0), 0);
    const tokenRemaining = Math.max(0, tokenDue - paidToken);
    const hours = tripHours(booking.startsAt, booking.endsAt);
    const step = nextStep(booking);
    return { car, imageUrl, tokenDue, paidToken, paidTotal, tokenRemaining, hours, step };
  }, [booking]);

  if (!booking && !error) {
    return (
      <div className="account-card" aria-busy="true" aria-label="Loading booking" style={{ minHeight: 280 }}>
        <Skeleton height={28} width="40%" className="dd-skel-mb" />
        <Skeleton height={14} width="55%" className="dd-skel-mb-sm" />
        <SkeletonText lines={4} />
        <Skeleton height={120} width="100%" className="dd-skel-mt" />
      </div>
    );
  }
  if (error && !booking) return <p className="account-msg err">{error}</p>;

  const canCancel = !["HANDOVER", "ONGOING", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(
    booking.status
  );
  const showTracking = !["HOLD", "AWAITING_PAYMENT", "CANCELLED", "NO_SHOW", "DRAFT"].includes(
    booking.status
  );
  const signUrl = (booking.agreements || [])
    .map((a) => a.signUrl || a.envelope?.signUrl)
    .find(Boolean);
  const driverPhone = booking.driverAssignment?.driver?.phone;
  const { car, imageUrl, tokenDue, paidTotal, tokenRemaining, hours, step } = derived;

  return (
    <div className="bkd">
      <p className="account-hint">
        <Link to="/account/bookings">← All bookings</Link>
      </p>

      <header className="bkd-header">
        <div className="bkd-header-main">
          <div className="account-title-row">
            <h1>{booking.publicId}</h1>
            <button
              type="button"
              className="account-copy-btn"
              onClick={() => copyValue(booking.publicId, "id")}
              aria-label="Copy booking ID"
            >
              <FontAwesomeIcon icon={copied === "id" ? faCheck : faCopy} />
              {copied === "id" ? "Copied" : "Copy ID"}
            </button>
          </div>
          <div className="bkd-meta">
            <span className={`account-pill ${statusTone(booking.status)}`}>
              {prettyStatus(booking.status)}
            </span>
            <span className="bkd-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="bkd-meta-amount">{rupees(booking.amountPaise)}</span>
            <span className="bkd-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="bkd-meta-type">
              {RENTAL_TYPE_LABELS[booking.rentalType] || prettyStatus(booking.rentalType)}
            </span>
            {syncing ? <span className="bkd-sync">Checking payment…</span> : null}
          </div>
        </div>
      </header>

      {error ? <p className="account-msg err">{error}</p> : null}
      {reviewInfo ? <p className="account-msg ok">{reviewInfo}</p> : null}
      {booking.subscription?.swapDueReason === "SERVICE" ? (
        <p className="account-msg warn">
          Swap due to service. Your current car is going into the workshop; we will assign a
          replacement of the same class.
        </p>
      ) : null}

      {step ? (
        <section className={`bkd-next bkd-next--${step.tone}`} aria-label="Next step">
          <div>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            {booking.status === "AWAITING_PAYMENT" && tokenRemaining > 0 ? (
              <p className="bkd-next-due">Token due now: <strong>{rupees(tokenRemaining)}</strong></p>
            ) : null}
          </div>
          <Link className="account-btn bkd-next-cta" to={step.to}>
            {step.cta}
            <FontAwesomeIcon icon={faArrowRight} />
          </Link>
        </section>
      ) : null}

      <div className="bkd-layout">
        <div className="bkd-main">
          <section className="account-card bkd-card">
            <div className="bkd-card-head">
              <h2>Trip</h2>
              {hours ? <span className="bkd-chip">{hours}h rental</span> : null}
            </div>
            <div className="bkd-journey">
              <div className="bkd-journey-point">
                <span className="bkd-journey-kicker">
                  <FontAwesomeIcon icon={faClock} /> Pickup
                </span>
                <strong>{formatDay(booking.startsAt)}</strong>
                <span>{formatTime(booking.startsAt)}</span>
                {booking.pickupBranch?.name ? (
                  <span className="bkd-journey-place">
                    <FontAwesomeIcon icon={faLocationDot} />
                    {booking.pickupBranch.name}
                    {booking.pickupBranch.city?.name
                      ? `, ${booking.pickupBranch.city.name}`
                      : ""}
                  </span>
                ) : null}
              </div>
              <div className="bkd-journey-line" aria-hidden="true" />
              <div className="bkd-journey-point">
                <span className="bkd-journey-kicker">
                  <FontAwesomeIcon icon={faClock} /> Return
                </span>
                <strong>{formatDay(booking.endsAt)}</strong>
                <span>{formatTime(booking.endsAt)}</span>
                {booking.dropBranch?.name ? (
                  <span className="bkd-journey-place">
                    <FontAwesomeIcon icon={faLocationDot} />
                    {booking.dropBranch.name}
                    {booking.dropBranch.city?.name ? `, ${booking.dropBranch.city.name}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
            {(booking.flightNumber || booking.terminal || booking.tourPackage) && (
              <dl className="bkd-facts">
                {booking.tourPackage ? (
                  <div>
                    <dt>Package</dt>
                    <dd>
                      {booking.tourPackage.name}
                      {booking.tourPackage.days ? ` · ${booking.tourPackage.days} days` : ""}
                    </dd>
                  </div>
                ) : null}
                {booking.terminal ? (
                  <div>
                    <dt>Terminal</dt>
                    <dd>
                      {booking.terminal.name}
                      {booking.terminal.code ? ` (${booking.terminal.code})` : ""}
                    </dd>
                  </div>
                ) : null}
                {booking.flightNumber ? (
                  <div>
                    <dt>Flight</dt>
                    <dd>{booking.flightNumber}</dd>
                  </div>
                ) : null}
                {booking.estimatedKm != null ? (
                  <div>
                    <dt>Estimated km</dt>
                    <dd>{booking.estimatedKm}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </section>

          <section className="account-card bkd-card">
            <div className="bkd-card-head">
              <h2>Vehicle</h2>
            </div>
            <div className="bkd-vehicle">
              <div className="bkd-vehicle-media" aria-hidden={!imageUrl}>
                {imageUrl ? (
                  <img src={imageUrl} alt="" />
                ) : (
                  <FontAwesomeIcon icon={faCarSide} />
                )}
              </div>
              <div className="bkd-vehicle-copy">
                <strong>{car?.name || "Assigned at confirmation"}</strong>
                {booking.vehicle?.registration ? (
                  <p className="bkd-reg">{booking.vehicle.registration}</p>
                ) : (
                  <p className="bkd-muted">Registration shown after the car is reserved.</p>
                )}
                <div className="bkd-specs">
                  {car?.type ? <span>{car.type}</span> : null}
                  {car?.seats ? <span>{car.seats} seats</span> : null}
                  {car?.fuel ? <span>{car.fuel}</span> : null}
                  {car?.transmission ? <span>{car.transmission}</span> : null}
                  {booking.vehicle?.color ? <span>{booking.vehicle.color}</span> : null}
                </div>
                {car?.slug ? (
                  <Link className="bkd-text-link" to={`/cars/${car.slug}`}>
                    View car page
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          {(booking.driverAssignment?.driver || booking.kycCase || (booking.agreements || []).length > 0) && (
            <section className="account-card bkd-card">
              <div className="bkd-card-head">
                <h2>People & documents</h2>
              </div>
              <dl className="bkd-facts">
                {booking.user?.profile?.fullName || booking.user?.email ? (
                  <div>
                    <dt>Booked by</dt>
                    <dd>
                      {booking.user?.profile?.fullName || "—"}
                      {booking.user?.phone ? ` · ${booking.user.phone}` : ""}
                      {booking.user?.email ? (
                        <>
                          <br />
                          <span className="bkd-muted">{booking.user.email}</span>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {booking.driverAssignment?.driver ? (
                  <div>
                    <dt>Driver</dt>
                    <dd>
                      {booking.driverAssignment.driver.fullName}
                      {booking.driverAssignment.driver.phone
                        ? ` · ${booking.driverAssignment.driver.phone}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
                {booking.kycCase ? (
                  <div>
                    <dt>KYC</dt>
                    <dd>
                      {prettyStatus(booking.kycCase.status)}{" "}
                      <Link className="bkd-text-link" to="/account/kyc">
                        Update documents
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {(booking.agreements || []).map((a) => (
                  <div key={a.id}>
                    <dt>Agreement</dt>
                    <dd>
                      {prettyStatus(a.status)}{" "}
                      <button
                        className="bkd-text-btn"
                        type="button"
                        onClick={() => {
                          const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                          const signed = a.status === "SIGNED" || a.status === "WAIVED";
                          fetch(
                            `${API}/v1/me/agreements/${a.id}/${signed ? "signed-pdf" : "pdf"}`,
                            {
                              headers: getToken()
                                ? { Authorization: `Bearer ${getToken()}` }
                                : {},
                            }
                          )
                            .then((res) => {
                              if (!res.ok) throw new Error("Could not download PDF");
                              return res.blob();
                            })
                            .then((blob) => {
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = "rental-agreement.pdf";
                              link.click();
                              URL.revokeObjectURL(url);
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Download PDF
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="account-card bkd-card">
            <div className="bkd-card-head">
              <h2>Payments</h2>
            </div>
            <dl className="bkd-facts bkd-facts--money">
              <div>
                <dt>Trip total</dt>
                <dd>{rupees(booking.amountPaise)}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>
                  {rupees(tokenDue)}
                  {booking.status === "AWAITING_PAYMENT" && tokenRemaining > 0
                    ? ` · ${rupees(tokenRemaining)} due`
                    : ""}
                </dd>
              </div>
              {booking.depositPaise > 0 ? (
                <div>
                  <dt>Deposit (due at pickup)</dt>
                  <dd>{rupees(booking.depositPaise)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Paid so far</dt>
                <dd>{rupees(paidTotal)}</dd>
              </div>
              <div>
                <dt>Balance before handover</dt>
                <dd>{rupees(Math.max(0, booking.amountPaise - paidTotal))}</dd>
              </div>
            </dl>
            {(booking.payments || []).length > 0 ? (
              <ul className="bkd-pay-list">
                {(booking.payments || []).map((p) => (
                  <li key={p.id}>
                    <span>
                      {prettyStatus(p.kind)} · {prettyStatus(p.status)}
                    </span>
                    <strong>{rupees(p.amountPaise)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bkd-muted">No payments recorded yet.</p>
            )}
            {(booking.extras || []).length > 0 ? (
              <>
                <h3 className="bkd-subhead">Extras</h3>
                <ul className="bkd-pay-list">
                  {(booking.extras || []).map((ex) => (
                    <li key={ex.id}>
                      <span>{ex.label}</span>
                      <strong>{rupees(ex.amountPaise)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <Link className="bkd-text-link" to="/account/invoices">
              View invoices
            </Link>
          </section>

          <section className="account-card bkd-card">
            <div className="bkd-card-head">
              <h2>Status history</h2>
            </div>
            <ol className="bkd-timeline">
              {(booking.history || []).length === 0 ? (
                <li className="bkd-muted">No history yet.</li>
              ) : (
                (booking.history || []).map((h) => (
                  <li key={h.id}>
                    <span className="bkd-timeline-dot" aria-hidden="true" />
                    <div>
                      <strong>{prettyStatus(h.to)}</strong>
                      {h.reason ? <span className="bkd-muted"> — {h.reason}</span> : null}
                      <time dateTime={h.createdAt}>{formatWhen(h.createdAt)}</time>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </section>

          {(booking.inspections || []).length > 0 && (
            <section className="account-card bkd-card">
              <div className="bkd-card-head">
                <h2>Vehicle inspections</h2>
              </div>
              {(booking.inspections || []).map((ins) => (
                <div key={ins.id} className="bkd-inspection">
                  <p>
                    <strong>{prettyStatus(ins.type)}</strong>
                    {" · "}
                    {ins.odometerKm} km
                    {" · fuel "}
                    {ins.fuelUnit === "PERCENT" ? `${ins.fuelLevel}%` : `${ins.fuelLevel}/8`}
                  </p>
                  {(ins.damages || []).map((d) => (
                    <p key={d.id}>
                      Damage: {d.description} · {rupees(d.amountPaise)}
                    </p>
                  ))}
                  <div className="bkd-photos">
                    {(ins.photos || []).map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        <img src={p.url} alt="" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {booking.status === "COMPLETED" && (
            <section className="account-card bkd-card">
              <div className="bkd-card-head">
                <h2>Rate this trip</h2>
              </div>
              {booking.review ? (
                <p>
                  You rated this trip <strong>{booking.review.rating}/5</strong>
                  {booking.review.published ? " · published" : " · waiting for moderation"}
                </p>
              ) : (
                <form onSubmit={submitReview}>
                  <div className="account-field">
                    <label htmlFor="rating">Rating</label>
                    <select
                      id="rating"
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="account-field">
                    <label htmlFor="review-body">Comments</label>
                    <textarea
                      id="review-body"
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      placeholder="How was the car?"
                    />
                  </div>
                  <button className="account-btn" type="submit" disabled={busy}>
                    Submit review
                  </button>
                </form>
              )}
            </section>
          )}
        </div>

        <aside className="bkd-side">
          <section className="account-card bkd-side-card">
            <p className="bkd-side-kicker">Summary</p>
            <p className="bkd-side-amount">{rupees(booking.amountPaise)}</p>
            <p className="bkd-muted">
              {RENTAL_TYPE_LABELS[booking.rentalType] || prettyStatus(booking.rentalType)}
              {hours ? ` · ${hours}h` : ""}
            </p>
            <div className="bkd-side-actions">
              {booking.status === "AWAITING_PAYMENT" && (
                <Link
                  className="account-btn"
                  to={`/checkout/pay?booking=${encodeURIComponent(booking.publicId)}`}
                >
                  Pay {rupees(tokenRemaining || tokenDue)} token
                </Link>
              )}
              {booking.status === "AWAITING_KYC" && (
                <Link className="account-btn" to="/account/kyc">
                  Complete KYC
                </Link>
              )}
              {booking.status === "AWAITING_SIGNATURE" && signUrl && (
                <a className="account-btn" href={signUrl} target="_blank" rel="noreferrer">
                  Sign agreement
                </a>
              )}
              {booking.status === "AWAITING_SIGNATURE" && !signUrl && (
                <Link className="account-btn" to="/account/agreements">
                  Open agreements
                </Link>
              )}
              {["CONFIRMED", "HANDOVER", "ONGOING"].includes(booking.status) && driverPhone && (
                <a className="account-btn" href={`tel:${driverPhone}`}>
                  Call driver
                </a>
              )}
              {["CANCELLED", "NO_SHOW"].includes(booking.status) && (
                <Link className="account-btn" to="/fleet">
                  Book again
                </Link>
              )}
              {showTracking && (
                <Link className="account-btn ghost" to={`/track/${booking.publicId}`}>
                  Open tracking
                </Link>
              )}
              <button
                type="button"
                className="account-btn ghost"
                onClick={() => copyValue(orderDetailsText(booking), "details")}
              >
                <FontAwesomeIcon icon={copied === "details" ? faCheck : faCopy} />
                {copied === "details" ? "Copied details" : "Copy details"}
              </button>
              <Link className="account-btn ghost" to="/account/tickets">
                Need help?
              </Link>
            </div>
            {canCancel ? (
              <button
                className="bkd-cancel"
                type="button"
                disabled={busy}
                onClick={cancel}
              >
                Cancel booking
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
