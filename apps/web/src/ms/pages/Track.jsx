"use client";

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getToken } from "../api";
import { useAuth } from "../AuthContext";
import { subscribeBookingStatus } from "../bookingSocket";
import { formatInr, RENTAL_TYPE_LABELS } from "../fleetSearch";
import "./Checkout.css";

const STEPS = [
  "HOLD",
  "AWAITING_PAYMENT",
  "AWAITING_KYC",
  "AWAITING_SIGNATURE",
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
  "COMPLETED",
];

export default function Track() {
  const { bookingId } = useParams();
  const { user, ready } = useAuth();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestUnlocked, setGuestUnlocked] = useState(false);

  async function loadAsUser() {
    const row = await api(`/v1/bookings/${bookingId}`);
    setBooking(row);
    setError("");
  }

  useEffect(() => {
    if (!ready) return undefined;
    if (user || getToken()) {
      loadAsUser().catch((e) => {
        if (e.status === 401 || e.status === 403) {
          setError("");
        } else {
          setError(e.message);
        }
      });
    }
    return undefined;
  }, [ready, user, bookingId]);

  useEffect(() => {
    if (!booking?.id && !booking?.publicId) return undefined;
    const id = booking.publicId || booking.id;
    return subscribeBookingStatus(
      id,
      (event) => {
        if (event.booking) setBooking(event.booking);
        else if (event.payload?.status) {
          setBooking((prev) =>
            prev ? { ...prev, status: event.payload.status } : prev
          );
          if (user || getToken()) loadAsUser().catch(() => undefined);
        }
      },
      user || getToken() ? () => api(`/v1/bookings/${bookingId}`) : null
    );
  }, [booking?.id, booking?.publicId, bookingId, user]);

  async function sendOtp(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/public/bookings/track/otp", {
        method: "POST",
        body: { publicId: bookingId, phone },
      });
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const row = await api("/v1/public/bookings/track/verify", {
        method: "POST",
        body: { publicId: bookingId, phone, code },
      });
      setBooking(row);
      setGuestUnlocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!booking && ready && !user && !guestUnlocked) {
    return (
      <section className="checkout-page">
        <div className="checkout-inner">
          <h1>Track booking</h1>
          <p className="checkout-lead">
            Enter the mobile number on the booking to view <strong>{bookingId}</strong>.
          </p>
          {error && <p className="checkout-err">{error}</p>}
          <form className="checkout-card" onSubmit={otpSent ? verifyOtp : sendOtp}>
            <div className="checkout-field">
              <label>Mobile number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </div>
            {otpSent && (
              <div className="checkout-field">
                <label>OTP</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
              </div>
            )}
            <button className="checkout-btn" type="submit" disabled={busy}>
              {otpSent ? "Verify & view" : "Send OTP"}
            </button>
            <p className="checkout-muted" style={{ marginTop: 12 }}>
              Already have an account? <Link to={`/login?redirect=/track/${bookingId}`}>Sign in</Link>
            </p>
          </form>
        </div>
      </section>
    );
  }

  if (error && !booking) {
    return <p className="checkout-page" style={{ padding: 24 }}>{error}</p>;
  }
  if (!booking) {
    return <p className="checkout-page" style={{ padding: 24 }}>Loading…</p>;
  }

  const driver = booking.driverAssignment?.driver;
  const statusIndex = STEPS.indexOf(booking.status);

  return (
    <section className="checkout-page">
      <div className="checkout-inner">
        <h1>Tracking {booking.publicId}</h1>
        <p className="checkout-lead">
          {RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType} ·{" "}
          <strong>{booking.status.replace(/_/g, " ")}</strong>
        </p>
        {error && <p className="checkout-err">{error}</p>}

        <div className="checkout-card">
          <div className="checkout-row">
            <span>When</span>
            <span>
              {new Date(booking.startsAt).toLocaleString("en-IN")} →{" "}
              {new Date(booking.endsAt).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="checkout-row">
            <span>Amount</span>
            <span>{formatInr(booking.amountPaise)}</span>
          </div>
          {booking.pickupBranch?.name && (
            <div className="checkout-row">
              <span>Pickup</span>
              <span>{booking.pickupBranch.name}</span>
            </div>
          )}
          {driver && (
            <div className="checkout-row">
              <span>Driver</span>
              <span>{driver.fullName}{driver.phone ? ` · ${driver.phone}` : ""}</span>
            </div>
          )}
          {booking.vehicle?.registration && (
            <div className="checkout-row">
              <span>Vehicle</span>
              <span>{booking.vehicle.registration}</span>
            </div>
          )}
        </div>

        <div className="checkout-card">
          <h3 style={{ marginTop: 0 }}>Timeline</h3>
          <ol style={{ paddingLeft: 18, fontSize: "1.35rem", lineHeight: 1.7 }}>
            {STEPS.filter((step) => {
              if (booking.rentalType !== "SELF_DRIVE" && (step === "AWAITING_KYC" || step === "AWAITING_SIGNATURE")) {
                return false;
              }
              return true;
            }).map((step) => {
              const done = statusIndex >= STEPS.indexOf(step) || booking.status === step;
              const hist = (booking.history || []).find((h) => h.to === step);
              return (
                <li key={step} style={{ opacity: done ? 1 : 0.45 }}>
                  {step.replace(/_/g, " ")}
                  {hist?.reason ? ` — ${hist.reason}` : ""}
                </li>
              );
            })}
            {["CANCELLED", "NO_SHOW"].includes(booking.status) && (
              <li>{booking.status.replace(/_/g, " ")}</li>
            )}
          </ol>
        </div>

        {user && (
          <Link className="checkout-btn ghost" to={`/account/bookings/${booking.id}`}>
            Booking details
          </Link>
        )}
      </div>
    </section>
  );
}
