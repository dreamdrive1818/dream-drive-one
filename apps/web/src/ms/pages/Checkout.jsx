"use client";

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { RENTAL_TYPE_LABELS, formatInr } from "../fleetSearch";
import { loadQuoteHandoff, saveQuoteHandoff } from "../quoteStorage";
import "./Checkout.css";

function loadRazorpay() {
  if (typeof window === "undefined") return Promise.reject(new Error("window missing"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load Razorpay"));
    document.body.appendChild(script);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDatePart(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimePart(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLockedUntil(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isQuoteExpired(expiresAt) {
  if (!expiresAt) return false;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

function rentalLabel(type) {
  if (!type) return "";
  return RENTAL_TYPE_LABELS[type] || type;
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"
      />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15.5"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M8 3.5V7M16 3.5V7M3.5 10h17"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 8v4.5L15 15"
      />
    </svg>
  );
}

function IconCar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M3.5 14.5h17v4h-2.2a2.3 2.3 0 0 1-4.6 0H9.3a2.3 2.3 0 0 1-4.6 0H3.5v-4zM5 14.5l1.6-5.2A2 2 0 0 1 8.5 8h7a2 2 0 0 1 1.9 1.3L19 14.5"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M3.6 13.2 12.8 4H20v7.2l-9.2 9.2a2 2 0 0 1-2.8 0l-4.4-4.4a2 2 0 0 1 0-2.8z"
      />
      <circle cx="16.2" cy="7.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 11v5.2M12 7.6h.01"
      />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 6.5 8.5 12 15 17.5M8.5 12H20"
      />
    </svg>
  );
}

export default function Checkout() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready: authReady } = useAuth();
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  const [offerError, setOfferError] = useState("");

  useEffect(() => {
    const fromNav = location.state?.quote;
    const stored = loadQuoteHandoff(quoteId);
    const handoff =
      fromNav?.id === quoteId ? fromNav : stored?.id === quoteId ? stored : null;
    if (handoff) {
      setQuote({ ...handoff, id: quoteId });
    } else if (quoteId) {
      setQuote({ id: quoteId });
    } else {
      setQuote(null);
    }
    setReady(true);
  }, [quoteId, location.state]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      const next = encodeURIComponent(`/checkout/${quoteId}`);
      navigate(`/login?redirect=${next}`, { replace: true });
    }
  }, [authReady, user, quoteId, navigate]);

  useEffect(() => {
    if (!user || !quoteId) return;
    api(`/v1/quotes/${quoteId}`)
      .then((row) => {
        setQuote(row);
        saveQuoteHandoff(row, row.carModel);
        if (row.expired) setError("This quote has expired. Pick dates again on the car page.");
      })
      .catch((err) => {
        if (err.status === 401) {
          const next = encodeURIComponent(`/checkout/${quoteId}`);
          navigate(`/login?redirect=${next}`, { replace: true });
        }
      });
  }, [user, quoteId, navigate]);

  async function pollPayment(paymentId) {
    for (let i = 0; i < 12; i += 1) {
      const payment = await api(`/v1/payments/${paymentId}`).catch(() => null);
      if (payment?.status === "SUCCESS") return payment;
      if (payment?.status === "FAILED") throw new Error("Payment failed");
      await sleep(1500);
    }
    return api(`/v1/payments/${paymentId}`);
  }

  async function openRazorpay(order, booking) {
    const Razorpay = await loadRazorpay();
    return new Promise((resolve, reject) => {
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Dream Drive",
        description: `Token for ${booking.publicId}`,
        order_id: order.orderId,
        prefill: {
          email: user?.email || "",
          name: user?.fullName || user?.profile?.fullName || "",
        },
        handler: async (response) => {
          try {
            await api("/v1/payments/verify", {
              method: "POST",
              body: {
                paymentId: order.paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
            resolve(true);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled")),
        },
      });
      rzp.on("payment.failed", () => reject(new Error("Payment failed")));
      rzp.open();
    });
  }

  async function pay() {
    if (!quote || quote.expired) {
      setError("This quote has expired. Go back and select dates again.");
      return;
    }
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
      } else {
        await openRazorpay(order, booking);
      }
      await pollPayment(order.paymentId).catch(() => null);
      navigate(
        `/checkout/success?booking=${booking.publicId}&type=${booking.rentalType}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyOffer(e) {
    e.preventDefault();
    setOfferMessage("");
    setOfferError("");
    const trimmed = String(code || "").trim();
    if (!trimmed || !quoteId) {
      setOfferError("Enter a promo code to apply.");
      return;
    }
    setApplying(true);
    try {
      const row = await api(`/v1/quotes/${quoteId}/apply-offer`, {
        method: "POST",
        body: { code: trimmed },
      });
      setQuote(row);
      saveQuoteHandoff(row, row.carModel);
      setOfferMessage("Promo code applied.");
    } catch (err) {
      setOfferError(err.message || "Could not apply this promo code.");
    } finally {
      setApplying(false);
    }
  }

  if (!ready) {
    return (
      <div className="checkout-page">
        <div className="checkout-state" aria-live="polite">
          <ClipLoader color="var(--primary-color, #0072ce)" size={36} />
          <p>Loading your quote…</p>
        </div>
      </div>
    );
  }

  if (!quoteId || !quote) {
    return (
      <div className="checkout-page">
        <div className="checkout-inner">
          <div className="checkout-state checkout-state--error" role="alert">
            <h1>Quote not found</h1>
            <p>
              We could not restore this checkout. Go back to search and request a
              new quote.
            </p>
            <Link to="/fleet" className="checkout-text-link">
              Back to fleet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pickupDate = formatDatePart(quote.startsAt);
  const pickupTime = formatTimePart(quote.startsAt);
  const returnDate = formatDatePart(quote.endsAt);
  const returnTime = formatTimePart(quote.endsAt);
  const typeLabel = rentalLabel(quote.rentalType);
  const lockedUntil = formatLockedUntil(quote.expiresAt);
  const expired = isQuoteExpired(quote.expiresAt);
  const hasAmount = quote.amountPaise != null;
  const hasDeposit = quote.depositPaise != null;
  const imageUrl =
    quote.imageUrl ||
    quote.coverUrl ||
    quote.payload?.imageUrl ||
    quote.payload?.coverUrl ||
    "";
  const carHref = quote.carSlug ? `/cars/${quote.carSlug}` : "";
  const ctaDisabled = busy || applying || expired || !quoteId;
  const hasPickup = Boolean(pickupDate || pickupTime);
  const hasReturn = Boolean(returnDate || returnTime);

  return (
    <div className="checkout-page">
      <div className="checkout-inner">
        <header className="checkout-intro">
          <div className="checkout-intro-copy">
            <nav className="checkout-crumb" aria-label="Checkout">
              <Link to="/fleet">Fleet</Link>
              <span aria-hidden="true">/</span>
              {carHref ? <Link to={carHref}>Car</Link> : <span>Car</span>}
              <span aria-hidden="true">/</span>
              <span aria-current="page">Checkout</span>
            </nav>
            <h1>Review your booking</h1>
            <p>Check your trip details before continuing to payment.</p>
          </div>
          <div className="checkout-intro-art" aria-hidden="true">
            <span className="checkout-art-board">
              <IconCar />
            </span>
            <span className="checkout-art-check">✓</span>
          </div>
        </header>

        <ol className="checkout-steps" aria-label="Booking steps">
          <li className="is-done">
            <span className="checkout-step-dot" aria-hidden="true">1</span>
            <span className="checkout-step-label">Car</span>
          </li>
          <li className="is-current" aria-current="step">
            <span className="checkout-step-dot" aria-hidden="true">2</span>
            <span className="checkout-step-label">Review</span>
          </li>
          <li>
            <span className="checkout-step-dot" aria-hidden="true">3</span>
            <span className="checkout-step-label">Payment</span>
          </li>
          <li>
            <span className="checkout-step-dot" aria-hidden="true">4</span>
            <span className="checkout-step-label">Confirmed</span>
          </li>
        </ol>

        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-card" aria-labelledby="checkout-car-heading">
              <div className="checkout-card-row">
                <div className="checkout-icon-box">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" />
                  ) : (
                    <IconCar />
                  )}
                </div>
                <div className="checkout-card-copy">
                  <h2 id="checkout-car-heading">Your car</h2>
                  <p className="checkout-car-name">
                    {quote.carName || "Selected car"}
                  </p>
                  {quote.cityName ? (
                    <p className="checkout-car-meta">
                      <span className="checkout-inline-icon">
                        <IconPin />
                      </span>
                      {quote.cityName}
                    </p>
                  ) : null}
                  {typeLabel ? (
                    <p className="checkout-car-type">{typeLabel}</p>
                  ) : null}
                  <p className="checkout-quote-id">Quote {quote.id}</p>
                </div>
              </div>
            </section>

            <section className="checkout-card" aria-labelledby="checkout-trip-heading">
              <div className="checkout-card-row">
                <div className="checkout-icon-box">
                  <IconCalendar />
                </div>
                <div className="checkout-card-copy">
                  <h2 id="checkout-trip-heading">Trip details</h2>
                  {hasPickup || hasReturn ? (
                    <div className={`checkout-journey${hasPickup && hasReturn ? "" : " checkout-journey--single"}`}>
                      {hasPickup ? (
                        <div className="checkout-journey-point">
                          <p className="checkout-journey-kicker">Pickup</p>
                          {pickupDate ? (
                            <p className="checkout-journey-date">{pickupDate}</p>
                          ) : null}
                          {pickupTime ? (
                            <p className="checkout-journey-time">{pickupTime}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {hasPickup && hasReturn ? (
                        <div className="checkout-journey-connector" aria-hidden="true">
                          <span />
                        </div>
                      ) : null}
                      {hasReturn ? (
                        <div className="checkout-journey-point">
                          <p className="checkout-journey-kicker">Return</p>
                          {returnDate ? (
                            <p className="checkout-journey-date">{returnDate}</p>
                          ) : null}
                          {returnTime ? (
                            <p className="checkout-journey-time">{returnTime}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {typeLabel || quote.cityName ? (
                    <div className="checkout-trip-secondary">
                      {typeLabel ? (
                        <span className="checkout-chip">{typeLabel}</span>
                      ) : null}
                      {quote.cityName ? (
                        <span className="checkout-chip">{quote.cityName}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {!pickupDate && !returnDate && !typeLabel && !quote.cityName ? (
                    <p className="checkout-empty">
                      Trip dates will appear here when this quote includes them.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="checkout-card" aria-labelledby="checkout-offer-heading">
              <div className="checkout-card-row">
                <div className="checkout-icon-box">
                  <IconTag />
                </div>
                <div className="checkout-card-copy checkout-card-copy--offer">
                  <h2 id="checkout-offer-heading">Have a promo code?</h2>
                  <form className="checkout-offer" onSubmit={applyOffer}>
                    <div className="checkout-offer-row">
                      <label htmlFor="checkout-promo" className="checkout-sr-only">
                        Promo code
                      </label>
                      <input
                        id="checkout-promo"
                        type="text"
                        autoComplete="off"
                        placeholder="Enter code"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setOfferMessage("");
                          setOfferError("");
                        }}
                        disabled={busy || applying || expired}
                      />
                      <button
                        type="submit"
                        className="checkout-offer-apply"
                        disabled={busy || applying || expired || !String(code).trim()}
                      >
                        {applying ? "Applying…" : "Apply"}
                      </button>
                    </div>
                    {offerMessage ? (
                      <p className="checkout-offer-ok" role="status">
                        {offerMessage}
                      </p>
                    ) : null}
                    {offerError ? (
                      <p className="checkout-offer-bad" role="alert">
                        {offerError}
                      </p>
                    ) : null}
                  </form>
                </div>
              </div>
            </section>

            <aside className="checkout-note">
              <span className="checkout-note-mark" aria-hidden="true">
                <IconInfo />
              </span>
              <div className="checkout-note-body">
                {lockedUntil && !expired ? (
                  <p>
                    This quote’s price is locked until {lockedUntil}. Continue
                    before it expires to keep these details.
                  </p>
                ) : null}
                {hasDeposit && quote.depositPaise > 0 ? (
                  <p>
                    A deposit of {formatInr(quote.depositPaise)} is shown from
                    this quote. It is listed separately from the rental amount.
                  </p>
                ) : null}
                {!lockedUntil && !(hasDeposit && quote.depositPaise > 0) ? (
                  <p>
                    Review the details above. Continuing will create a booking
                    from this quote.
                  </p>
                ) : null}
              </div>
            </aside>
          </div>

          <aside className="checkout-summary" aria-labelledby="checkout-summary-heading">
            <div className="checkout-summary-head">
              <p className="checkout-summary-kicker">Your quote</p>
              <h2 id="checkout-summary-heading">Price summary</h2>
            </div>
            <div className="checkout-summary-body">
              {expired ? (
                <p className="checkout-expired" role="status">
                  This quote has expired. Return to the car page and request a new
                  quote.
                </p>
              ) : null}

              {lockedUntil && !expired ? (
                <p className="checkout-locked">Price locked until {lockedUntil}</p>
              ) : null}

              <div className="checkout-price-rows">
                {hasAmount ? (
                  <div className="checkout-price-row">
                    <span>Rental amount</span>
                    <strong>{formatInr(quote.amountPaise)}</strong>
                  </div>
                ) : null}
                {hasDeposit && quote.depositPaise > 0 ? (
                  <div className="checkout-price-row checkout-price-row--deposit">
                    <span>Deposit</span>
                    <strong>{formatInr(quote.depositPaise)}</strong>
                  </div>
                ) : null}
                {hasAmount ? (
                  <div className="checkout-price-row checkout-price-row--total">
                    <span>Amount due</span>
                    <strong>{formatInr(quote.amountPaise)}</strong>
                  </div>
                ) : (
                  <p className="checkout-empty">
                    Amount will show here when the quote includes a price.
                  </p>
                )}
              </div>

              {error ? (
                <p className="checkout-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                className="checkout-cta"
                onClick={pay}
                disabled={ctaDisabled}
              >
                {busy ? (
                  <span className="checkout-cta-busy">
                    <ClipLoader color="#fff" size={18} />
                    Processing…
                  </span>
                ) : (
                  "Continue to payment"
                )}
              </button>

              {carHref ? (
                <Link to={carHref} className="checkout-secondary-link">
                  <IconArrowLeft />
                  Back to car
                </Link>
              ) : (
                <Link to="/fleet" className="checkout-secondary-link">
                  <IconArrowLeft />
                  Back to fleet
                </Link>
              )}
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}
