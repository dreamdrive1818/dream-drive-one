"use client";

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { formatInr, RENTAL_TYPE_LABELS } from "../fleetSearch";
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

export default function Pay() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking") || "";
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [useWallet, setUseWallet] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const next = encodeURIComponent(`/checkout/pay?booking=${bookingId}`);
      navigate(`/login?redirect=${next}`, { replace: true });
      return;
    }
    if (!bookingId) return;
    Promise.all([
      api(`/v1/bookings/${bookingId}`),
      api("/v1/me/wallet").catch(() => null),
    ])
      .then(([row, w]) => {
        setBooking(row);
        setWallet(w);
        if (row.status && !["HOLD", "AWAITING_PAYMENT"].includes(row.status)) {
          navigate(`/checkout/success?booking=${row.publicId}&type=${row.rentalType}`, { replace: true });
        }
      })
      .catch((e) => setError(e.message));
  }, [ready, user, bookingId, navigate]);

  async function pollPayment(paymentId) {
    for (let i = 0; i < 12; i += 1) {
      const payment = await api(`/v1/payments/${paymentId}`).catch(() => null);
      if (payment?.status === "SUCCESS") return payment;
      if (payment?.status === "FAILED") throw new Error("Payment failed");
      await sleep(1500);
    }
    return api(`/v1/payments/${paymentId}`);
  }

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
    setBusy(true);
    setError("");
    try {
      const walletPaise =
        useWallet && wallet?.balancePaise > 0
          ? Math.min(wallet.balancePaise, booking.amountPaise || 0)
          : 0;
      const order = await api("/v1/payments/orders", {
        method: "POST",
        body: { bookingId: booking.id, kind: "TOKEN", walletPaise },
      });
      if (order.paidInFull) {
        navigate(`/checkout/success?booking=${booking.publicId}&type=${booking.rentalType}`);
        return;
      }
      if (order.mock) {
        await api("/v1/payments/verify", { method: "POST", body: { paymentId: order.paymentId } });
      } else {
        await openRazorpay(order);
      }
      await pollPayment(order.paymentId).catch(() => null);
      navigate(`/checkout/success?booking=${booking.publicId}&type=${booking.rentalType}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || (!booking && !error && bookingId)) {
    return (
      <div className="checkout-page">
        <div className="checkout-state" aria-live="polite">
          <ClipLoader color="var(--primary-color, #0072ce)" size={36} />
          <p>Loading payment…</p>
        </div>
      </div>
    );
  }

  if (!bookingId || error) {
    return (
      <div className="checkout-page">
        <div className="checkout-inner">
          <div className="checkout-state checkout-state--error" role="alert">
            <h1>{error || "Booking not found"}</h1>
            <p>Open the booking from your account, or start a new quote from the fleet.</p>
            <Link to="/account/bookings" className="checkout-text-link">My bookings</Link>
            {" · "}
            <Link to="/fleet" className="checkout-text-link">Browse cars</Link>
          </div>
        </div>
      </div>
    );
  }

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
            <p>Complete payment for booking {booking.publicId}. Status updates only after the server confirms the payment.</p>
          </div>
        </header>

        <ol className="checkout-steps" aria-label="Booking steps">
          <li className="is-done"><span className="checkout-step-dot" aria-hidden="true">1</span><span className="checkout-step-label">Car</span></li>
          <li className="is-done"><span className="checkout-step-dot" aria-hidden="true">2</span><span className="checkout-step-label">Review</span></li>
          <li className="is-current" aria-current="step"><span className="checkout-step-dot" aria-hidden="true">3</span><span className="checkout-step-label">Payment</span></li>
          <li><span className="checkout-step-dot" aria-hidden="true">4</span><span className="checkout-step-label">Confirmed</span></li>
        </ol>

        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-card">
              <h2 style={{ marginTop: 0 }}>{booking.publicId}</h2>
              <p>{RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType}</p>
              <p>{new Date(booking.startsAt).toLocaleString("en-IN")} → {new Date(booking.endsAt).toLocaleString("en-IN")}</p>
              <p>Status: {booking.status?.replace(/_/g, " ")}</p>
            </section>
          </div>
          <aside className="checkout-summary">
            <div className="checkout-summary-head">
              <p className="checkout-summary-kicker">Amount due</p>
              <h2>Token payment</h2>
            </div>
            <div className="checkout-summary-body">
              <div className="checkout-price-rows">
                <div className="checkout-price-row checkout-price-row--total">
                  <span>Pay now</span>
                  <strong>{formatInr(booking.amountPaise)}</strong>
                </div>
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
                      −{formatInr(Math.min(wallet.balancePaise, booking.amountPaise || 0))}
                    </strong>
                  </label>
                )}
              </div>
              {error ? <p className="checkout-error" role="alert">{error}</p> : null}
              <button type="button" className="checkout-cta" onClick={pay} disabled={busy}>
                {busy ? (
                  <span className="checkout-cta-busy">
                    <ClipLoader color="#fff" size={18} />
                    Processing…
                  </span>
                ) : (
                  "Pay now"
                )}
              </button>
              <Link to={`/account/bookings/${booking.id}`} className="checkout-secondary-link">
                View booking
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
