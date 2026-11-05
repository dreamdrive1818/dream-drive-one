"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { formatInr, tokenDuePaise, RENTAL_TYPE_LABELS } from "../fleetSearch";
import { CheckoutSkeleton } from "../../components/Skeleton/Skeleton";
import AuthModal from "../AuthModal";
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DUMMY_STEPS = [
  { key: "connecting", label: "Connecting to test gateway" },
  { key: "authorising", label: "Authorising payment" },
  { key: "success", label: "Payment confirmed" },
];

function DummyPayment({ amountPaise, stage }) {
  const current = DUMMY_STEPS.findIndex((s) => s.key === stage);
  const done = stage === "success";
  return (
    <div className="dummy-pay" role="dialog" aria-modal="true" aria-label="Test payment">
      <div className="dummy-pay-panel">
        <span className="dummy-pay-badge">Test mode · no money is charged</span>
        <div className={`dummy-pay-cardart${done ? " is-done" : ""}`} aria-hidden="true">
          <span className="dummy-pay-chip" />
          <span className="dummy-pay-number">•••• •••• •••• 4242</span>
          <span className="dummy-pay-holder">DREAM DRIVE TEST</span>
        </div>
        <p className="dummy-pay-amount">{formatInr(amountPaise)}</p>
        <div className={`dummy-pay-status${done ? " is-done" : ""}`} aria-live="polite">
          {done ? (
            <svg className="dummy-pay-check" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
          ) : (
            <ClipLoader color="#007c82" size={22} />
          )}
          <span>{DUMMY_STEPS[current]?.label}…</span>
        </div>
        <ol className="dummy-pay-steps">
          {DUMMY_STEPS.map((s, i) => (
            <li
              key={s.key}
              className={i < current || done ? "is-done" : i === current ? "is-current" : ""}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const PAYABLE_STATUSES = ["HOLD", "AWAITING_PAYMENT"];

/** Mirrors the API's phone rules so we never post a number it will reject. */
function normalizePhone(raw) {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  return /^[6-9]\d{9}$/.test(phone) ? phone : "";
}

/** Mirrors the API's date-of-birth rules (YYYY-MM-DD, age 18–100). */
function dateOfBirthError(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter a valid date of birth.";
  const dob = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return "Enter a valid date of birth.";
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 18) return "You must be at least 18 years old.";
  if (age > 100) return "Enter a valid date of birth.";
  return "";
}

function nextAfterToken(booking) {
  if (booking.rentalType === "SELF_DRIVE") {
    return `/account/kyc?booking=${encodeURIComponent(booking.publicId || booking.id)}`;
  }
  return `/checkout/success?booking=${booking.publicId}&type=${booking.rentalType}`;
}

function formatDatePart(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimePart(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function explainPayError(err, paymentsMock) {
  const message = err?.message && !/^bad request$/i.test(err.message) ? err.message : "";
  if (/authentication failed/i.test(message)) {
    return "The payment gateway rejected this request, so the token was not charged. You are still signed in. Try again in a moment.";
  }
  if (paymentsMock) {
    return `Mock payment did not go through${message ? `: ${message}` : ""}. No money was charged. Check your details and try again.`;
  }
  return message || "Payment could not be completed. Try again.";
}

function isDetailError(message) {
  return /full name|date of birth|18 years|mobile number|terms and conditions|no email/i.test(message || "");
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Pay() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking") || "";
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [useWallet, setUseWallet] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [terms, setTerms] = useState(null);
  const [dummy, setDummy] = useState(null);
  const [paymentsMock, setPaymentsMock] = useState(false);
  const payingRef = useRef(false);
  const nameLocked = Boolean(user?.nameLocked);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setAuthOpen(false);
    if (!bookingId) return;
    Promise.all([
      api(`/v1/bookings/${bookingId}`, { cache: false }),
      api("/v1/me/wallet").catch(() => null),
    ])
      .then(([row, w]) => {
        setBooking(row);
        setWallet(w);
        if (row.status === "CANCELLED" || row.status === "NO_SHOW") {
          setLoadError("This booking was cancelled. Start a new quote from the fleet.");
          return;
        }
        if (row.status && !PAYABLE_STATUSES.includes(row.status)) {
          navigate(nextAfterToken(row), { replace: true });
        }
      })
      .catch((e) => setLoadError(e.message || "Could not load this booking."));
    api("/v1/public/pages/terms")
      .then(setTerms)
      .catch(() => setTerms(null));
    api("/v1/public/config")
      .then((cfg) => setPaymentsMock(Boolean(cfg?.paymentsMock)))
      .catch(() => undefined);
  }, [ready, user, bookingId, navigate]);

  useEffect(() => {
    if (!user) return;
    setFullName((current) => current || user.fullName || "");
    setDateOfBirth((current) => current || user.dateOfBirth || "");
    setPhone((current) => current || user.phone || "");
  }, [user]);

  async function openRazorpay(order) {
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
        modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
      });
      rzp.on("payment.failed", () => reject(new Error("Payment failed")));
      rzp.open();
    });
  }

  async function runDummyPayment(order) {
    setDummy({ amountPaise: order.amountPaise, stage: "connecting" });
    await wait(900);
    setDummy((d) => ({ ...d, stage: "authorising" }));
    await Promise.all([
      api("/v1/payments/verify", { method: "POST", body: { paymentId: order.paymentId } }),
      wait(1300),
    ]);
    setDummy((d) => ({ ...d, stage: "success" }));
    await wait(1200);
  }

  async function pay() {
    if (!booking || payingRef.current) return;
    const name = (nameLocked ? user?.fullName || fullName : fullName).trim().replace(/\s+/g, " ");
    if (name.length < 2) {
      setError("Enter your full name.");
      return;
    }
    const dobError = dateOfBirthError(dateOfBirth);
    if (dobError) {
      setError(dobError);
      return;
    }
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the terms and conditions to pay the token.");
      return;
    }
    if (!user?.email) {
      setError("Your account has no email. Sign in again and retry.");
      return;
    }
    payingRef.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await api(`/v1/bookings/${booking.id}`, { cache: false });
      setBooking(latest);
      if (latest.status === "CANCELLED" || latest.status === "NO_SHOW") {
        setLoadError("This booking was cancelled. Start a new quote from the fleet.");
        return;
      }
      if (!PAYABLE_STATUSES.includes(latest.status)) {
        navigate(nextAfterToken(latest), { replace: true });
        return;
      }
      await api(`/v1/bookings/${latest.id}/essentials`, {
        method: "POST",
        body: {
          fullName: name,
          dateOfBirth,
          phone: cleanPhone,
          email: user.email,
          termsAccepted: true,
        },
      });
      const due = tokenDuePaise(latest.tokenPaise, latest.amountPaise);
      if (due <= 0) {
        navigate(nextAfterToken(latest));
        return;
      }
      const walletPaise =
        useWallet && wallet?.balancePaise > 0
          ? Math.min(wallet.balancePaise, due)
          : 0;
      const order = await api("/v1/payments/orders", {
        method: "POST",
        body: { bookingId: latest.id, kind: "TOKEN", walletPaise },
      });
      if (order.mock) setPaymentsMock(true);
      if (!order.paidInFull) {
        if (order.mock) {
          await runDummyPayment(order);
        } else {
          await openRazorpay(order);
        }
      }
      navigate(nextAfterToken(latest));
    } catch (err) {
      setDummy(null);
      if (err.status === 400 && /nothing to pay|no longer waiting/i.test(err.message || "")) {
        navigate(nextAfterToken(booking), { replace: true });
        return;
      }
      if (err.status === 401 && /sign in required/i.test(err.message || "")) {
        setAuthOpen(true);
        setError("Sign in again to pay the token.");
        return;
      }
      setError(explainPayError(err, paymentsMock));
    } finally {
      payingRef.current = false;
      setBusy(false);
    }
  }

  if (!ready || (!booking && !loadError && bookingId)) {
    return <CheckoutSkeleton label="Loading payment" />;
  }

  if (!bookingId || loadError || !booking) {
    return (
      <div className="checkout-page">
        <div className="checkout-inner">
          <div className="checkout-state checkout-state--error" role="alert">
            <h1>{loadError || "Booking not found"}</h1>
            <p>Open the booking from your account, or start a new quote from the fleet.</p>
            <Link to="/account/bookings" className="checkout-text-link">My bookings</Link>
            {" · "}
            <Link to="/fleet" className="checkout-text-link">Browse cars</Link>
          </div>
        </div>
      </div>
    );
  }

  const due = tokenDuePaise(booking.tokenPaise, booking.amountPaise);
  const balance = Math.max(0, (booking.amountPaise || 0) - due);
  const walletApplied = useWallet && wallet?.balancePaise > 0 ? Math.min(wallet.balancePaise, due) : 0;
  const payNow = Math.max(0, due - walletApplied);
  const selfDrive = booking.rentalType === "SELF_DRIVE";
  const pickupBranch = booking.pickupBranch?.name;
  const dropBranch = booking.dropBranch?.name;
  const cityName = booking.pickupBranch?.city?.name;
  const detailError = isDetailError(error);
  const payLabel = `${paymentsMock ? "Mock pay" : "Pay"} ${formatInr(payNow)} token`;

  return (
    <div className="checkout-page pay-page">
      <div className="checkout-inner">
        <header className="checkout-intro">
          <div className="checkout-intro-copy">
            <nav className="checkout-crumb" aria-label="Checkout">
              <Link to="/fleet">Fleet</Link>
              <span aria-hidden="true">/</span>
              <span>Checkout</span>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Payment</span>
            </nav>
            <h1>Pay the token</h1>
            <p>
              Booking {booking.publicId}. Only the token is charged now
              {selfDrive ? ". Licence and ID come next." : ". The balance is collected before the trip."}
            </p>
          </div>
        </header>

        <ol className="checkout-steps" aria-label="Booking steps">
          <li className="is-done"><span className="checkout-step-dot" aria-hidden="true">1</span><span className="checkout-step-label">Car</span></li>
          <li className="is-done"><span className="checkout-step-dot" aria-hidden="true">2</span><span className="checkout-step-label">Review</span></li>
          <li className="is-current" aria-current="step"><span className="checkout-step-dot" aria-hidden="true">3</span><span className="checkout-step-label">Token</span></li>
          <li><span className="checkout-step-dot" aria-hidden="true">4</span><span className="checkout-step-label">{selfDrive ? "KYC" : "Confirmed"}</span></li>
        </ol>

        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-card pay-trip" aria-labelledby="pay-trip-heading">
              <div className="pay-trip-top">
                <div>
                  <h2 id="pay-trip-heading">Your trip</h2>
                  <p className="checkout-car-name">
                    {RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType}
                    {cityName ? ` · ${cityName}` : ""}
                  </p>
                  <p className="checkout-quote-id">Booking {booking.publicId}</p>
                </div>
                <span className="pay-status">Token due</span>
              </div>
              <div className="checkout-journey">
                <div className="checkout-journey-point">
                  <p className="checkout-journey-kicker">Pickup</p>
                  <p className="checkout-journey-date">{formatDatePart(booking.startsAt) || "—"}</p>
                  <p className="checkout-journey-time">{formatTimePart(booking.startsAt)}</p>
                </div>
                <div className="checkout-journey-connector" aria-hidden="true">
                  <span />
                </div>
                <div className="checkout-journey-point">
                  <p className="checkout-journey-kicker">Return</p>
                  <p className="checkout-journey-date">{formatDatePart(booking.endsAt) || "—"}</p>
                  <p className="checkout-journey-time">{formatTimePart(booking.endsAt)}</p>
                </div>
              </div>
              {pickupBranch || dropBranch ? (
                <div className="checkout-trip-secondary">
                  {pickupBranch ? <span className="checkout-chip">Pickup: {pickupBranch}</span> : null}
                  {dropBranch ? <span className="checkout-chip">Drop: {dropBranch}</span> : null}
                </div>
              ) : null}
            </section>

            <section className="checkout-card" aria-labelledby="pay-details-heading">
              <h2 id="pay-details-heading">Driver details</h2>
              <p className="checkout-essentials-lead">
                These details go on the booking and the rental agreement.
              </p>
              <div className="checkout-fields">
                <label className="pay-field-wide">
                  Full name
                  <input
                    value={nameLocked ? user?.fullName || fullName : fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    readOnly={nameLocked}
                    title={nameLocked ? "Name is locked to your approved KYC record" : undefined}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Date of birth
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                </label>
                <label>
                  Mobile number
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10-digit mobile"
                    required
                  />
                </label>
                <label className="pay-field-wide">
                  Email
                  <input value={user?.email || ""} readOnly autoComplete="email" />
                </label>
              </div>
              <label className={`pay-terms${termsAccepted ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  I have read and agree to the{" "}
                  <Link to="/termsandconditions" target="_blank" rel="noreferrer">
                    Terms & Conditions
                  </Link>
                  .
                </span>
              </label>
              {terms?.body ? (
                <div className="pay-agreement">
                  <button
                    type="button"
                    className="pay-agreement-toggle"
                    aria-expanded={termsOpen}
                    onClick={() => setTermsOpen((open) => !open)}
                  >
                    {termsOpen ? "Hide agreement" : "Read the agreement"}
                  </button>
                  {termsOpen ? (
                    <div
                      className="checkout-terms-box"
                      dangerouslySetInnerHTML={{ __html: terms.body }}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="checkout-essentials-lead pay-reserve-note">
                  The token reserves the car. The remaining rental is due before handover.
                </p>
              )}
              {detailError ? (
                <p className="pay-alert" id="pay-alert" role="alert">
                  <strong>Check these details</strong>
                  <span>{error}</span>
                </p>
              ) : null}
            </section>
          </div>

          <aside className="checkout-summary pay-summary" aria-labelledby="pay-summary-heading">
            <div className="pay-due">
              <p className="pay-due-kicker">Pay now</p>
              <p className="pay-due-amount" id="pay-summary-heading">{formatInr(payNow)}</p>
              <p className="pay-due-sub">
                {selfDrive
                  ? "Token only. After this you’ll upload your licence and ID."
                  : "Token only. The rest of the rental is collected before the trip."}
              </p>
            </div>
            <div className="checkout-summary-body">
              <div className="checkout-price-rows">
                <div className="checkout-price-row">
                  <span>Trip total</span>
                  <strong>{formatInr(booking.amountPaise)}</strong>
                </div>
                <div className="checkout-price-row">
                  <span>Token</span>
                  <strong>{formatInr(due)}</strong>
                </div>
                {balance > 0 ? (
                  <div className="checkout-price-row">
                    <span>Balance before handover</span>
                    <strong>{formatInr(balance)}</strong>
                  </div>
                ) : null}
                {(wallet?.balancePaise || 0) > 0 ? (
                  <label className="pay-wallet">
                    <span>
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                      />
                      Use wallet ({formatInr(wallet.balancePaise)})
                    </span>
                    <strong>−{formatInr(Math.min(wallet.balancePaise, due))}</strong>
                  </label>
                ) : null}
              </div>
              {paymentsMock ? (
                <p className="pay-mock" role="note">
                  <strong>Test mode.</strong> No money is charged. The token is marked paid and the booking continues.
                </p>
              ) : null}
              {!detailError && error ? (
                <p className="pay-alert" id="pay-alert" role="alert">
                  <strong>Payment didn’t start</strong>
                  <span>{error}</span>
                </p>
              ) : null}
              <button type="button" className="checkout-cta checkout-cta--inline" onClick={pay} disabled={busy || !termsAccepted}>
                {busy ? (
                  <span className="checkout-cta-busy">
                    <ClipLoader color="#fff" size={18} />
                    Processing…
                  </span>
                ) : (
                  payLabel
                )}
              </button>
              <Link to={`/account/bookings/${booking.id}`} className="pay-text-link">
                View booking
              </Link>
              <p className="pay-secure">
                <IconLock />
                <span>Card details stay with the payment gateway. Dream Drive only records the token.</span>
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="checkout-mobile-bar">
        <div className="checkout-mobile-bar-price">
          <span>Pay now</span>
          <strong>{formatInr(payNow)}</strong>
        </div>
        <button type="button" className="checkout-cta" onClick={pay} disabled={busy || !termsAccepted}>
          {busy ? "Processing…" : payLabel}
        </button>
      </div>

      {dummy ? <DummyPayment amountPaise={dummy.amountPaise} stage={dummy.stage} /> : null}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
        initialMode="password"
      />
    </div>
  );
}
