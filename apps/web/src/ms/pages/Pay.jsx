"use client";

import React, { useEffect, useState } from "react";
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

function nextAfterToken(booking) {
  if (booking.rentalType === "SELF_DRIVE") {
    return `/account/kyc?booking=${encodeURIComponent(booking.publicId || booking.id)}`;
  }
  return `/checkout/success?booking=${booking.publicId}&type=${booking.rentalType}`;
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
  const [terms, setTerms] = useState(null);

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
        if (row.status && !["HOLD", "AWAITING_PAYMENT"].includes(row.status)) {
          navigate(nextAfterToken(row), { replace: true });
        }
      })
      .catch((e) => setLoadError(e.message || "Could not load this booking."));
    api("/v1/public/pages/terms")
      .then(setTerms)
      .catch(() => setTerms(null));
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

  async function pay() {
    if (!booking) return;
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!dateOfBirth) {
      setError("Enter your date of birth.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, ""))) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the terms and conditions to pay the token.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/v1/bookings/${booking.id}/essentials`, {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          dateOfBirth,
          phone,
          email: user?.email || "",
          termsAccepted: true,
        },
      });
      const due = tokenDuePaise(booking.tokenPaise, booking.amountPaise);
      const walletPaise =
        useWallet && wallet?.balancePaise > 0
          ? Math.min(wallet.balancePaise, due)
          : 0;
      const order = await api("/v1/payments/orders", {
        method: "POST",
        body: { bookingId: booking.id, kind: "TOKEN", walletPaise },
      });
      if (!order.paidInFull) {
        if (order.mock) {
          await api("/v1/payments/verify", { method: "POST", body: { paymentId: order.paymentId } });
        } else {
          await openRazorpay(order);
        }
      }
      navigate(nextAfterToken(booking));
    } catch (err) {
      setError(err.message);
    } finally {
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
  const selfDrive = booking.rentalType === "SELF_DRIVE";

  return (
    <div className="checkout-page">
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
            <h1>Pay token</h1>
            <p>
              Booking {booking.publicId}. We only take the token now. Licence and ID documents come next, in KYC.
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
            <section className="checkout-card">
              <h2 style={{ marginTop: 0 }}>Your details</h2>
              <p className="checkout-essentials-lead">
                {RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType}
                {" · "}
                {new Date(booking.startsAt).toLocaleString("en-IN")} → {new Date(booking.endsAt).toLocaleString("en-IN")}
              </p>
              <div className="checkout-fields">
                <label>
                  Full name
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
                </label>
                <label>
                  Date of birth
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                </label>
                <label>
                  Email
                  <input value={user?.email || ""} readOnly autoComplete="email" />
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
              </div>
              <label className="checkout-terms">
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
                <div
                  className="checkout-terms-box"
                  dangerouslySetInnerHTML={{ __html: terms.body }}
                />
              ) : (
                <p className="checkout-essentials-lead">
                  The token reserves the car. The remaining rental is due before handover.
                </p>
              )}
            </section>
          </div>
          <aside className="checkout-summary">
            <div className="checkout-summary-head">
              <p className="checkout-summary-kicker">Amount due</p>
              <h2>Token payment</h2>
            </div>
            <div className="checkout-summary-body">
              <div className="checkout-price-rows">
                <div className="checkout-price-row">
                  <span>Trip total</span>
                  <strong>{formatInr(booking.amountPaise)}</strong>
                </div>
                <div className="checkout-price-row checkout-price-row--total">
                  <span>Pay now</span>
                  <strong>{formatInr(Math.max(0, due - walletApplied))}</strong>
                </div>
                {balance > 0 ? (
                  <div className="checkout-price-row">
                    <span>Balance before handover</span>
                    <strong>{formatInr(balance)}</strong>
                  </div>
                ) : null}
                {(wallet?.balancePaise || 0) > 0 && (
                  <label className="checkout-price-row" style={{ cursor: "pointer" }}>
                    <span>
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Use wallet ({formatInr(wallet.balancePaise)})
                    </span>
                    <strong>
                      −{formatInr(Math.min(wallet.balancePaise, due))}
                    </strong>
                  </label>
                )}
              </div>
              <p className="checkout-essentials-lead">
                {selfDrive
                  ? "After the token you’ll upload your licence and ID."
                  : "The rest of the rental is collected before the trip."}
              </p>
              {error ? <p className="checkout-error" role="alert">{error}</p> : null}
              <button type="button" className="checkout-cta" onClick={pay} disabled={busy || !termsAccepted}>
                {busy ? (
                  <span className="checkout-cta-busy">
                    <ClipLoader color="#fff" size={18} />
                    Processing…
                  </span>
                ) : (
                  `Pay ${formatInr(Math.max(0, due - walletApplied))} token`
                )}
              </button>
              <Link to={`/account/bookings/${booking.id}`} className="checkout-secondary-link">
                View booking
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
        initialMode="password"
      />
    </div>
  );
}
