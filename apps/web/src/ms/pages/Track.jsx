"use client";

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCalendarDays,
  faCarSide,
  faLocationDot,
  faUser,
  faIndianRupeeSign,
} from "@fortawesome/free-solid-svg-icons";
import { api, getToken } from "../api";
import { useAuth } from "../AuthContext";
import { subscribeBookingStatus } from "../bookingSocket";
import { formatInr, RENTAL_TYPE_LABELS } from "../fleetSearch";
import { TrackSkeleton } from "../../components/Skeleton/Skeleton";
import "./Track.css";

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

function labelStatus(status) {
  return String(status || "").replace(/_/g, " ");
}

export default function Track() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { user, ready } = useAuth();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestUnlocked, setGuestUnlocked] = useState(false);
  const [publicIdInput, setPublicIdInput] = useState(bookingId || "");

  async function loadAsUser() {
    if (!bookingId) return;
    const row = await api(`/v1/bookings/${bookingId}`);
    setBooking(row);
    setError("");
  }

  useEffect(() => {
    if (!ready) return undefined;
    if (!bookingId) return undefined;
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

  if (!bookingId) {
    return (
      <section className="track-page" aria-label="Track booking">
        <div className="track-inner track-inner--narrow">
          <header className="track-header">
            <p className="track-eyebrow">Track order</p>
            <h1>Track your booking</h1>
            <p className="track-lead">
              Enter the booking ID from your confirmation (for example DD-XXXX).
            </p>
          </header>

          {error ? <p className="track-err">{error}</p> : null}

          <form
            className="track-panel"
            onSubmit={(e) => {
              e.preventDefault();
              const id = publicIdInput.trim();
              if (!id) {
                setError("Enter a booking ID.");
                return;
              }
              navigate(`/track/${encodeURIComponent(id)}`);
            }}
          >
            <label className="track-field">
              <span>Booking ID</span>
              <input
                value={publicIdInput}
                onChange={(e) => setPublicIdInput(e.target.value)}
                placeholder="DD-123456"
                autoComplete="off"
              />
            </label>
            <button className="track-cta" type="submit">
              Continue
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <p className="track-note">
              Signed in? <Link to="/account/bookings">Open bookings</Link>
            </p>
          </form>
        </div>
      </section>
    );
  }

  if (!booking && ready && !user && !guestUnlocked) {
    return (
      <section className="track-page" aria-label="Verify booking access">
        <div className="track-inner track-inner--narrow">
          <header className="track-header">
            <p className="track-eyebrow">Track order</p>
            <h1>Verify to view</h1>
            <p className="track-lead">
              Enter the mobile number on booking <strong>{bookingId}</strong> to
              continue.
            </p>
          </header>

          {error ? <p className="track-err">{error}</p> : null}

          <form
            className="track-panel"
            onSubmit={otpSent ? verifyOtp : sendOtp}
          >
            <label className="track-field">
              <span>Mobile number</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            {otpSent ? (
              <label className="track-field">
                <span>OTP</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>
            ) : null}
            <button className="track-cta" type="submit" disabled={busy}>
              {busy ? "Please wait…" : otpSent ? "Verify & view" : "Send OTP"}
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <p className="track-note">
              Already have an account?{" "}
              <Link to={`/login?redirect=/track/${bookingId}`}>Sign in</Link>
            </p>
          </form>
        </div>
      </section>
    );
  }

  if (error && !booking) {
    return (
      <section className="track-page">
        <div className="track-inner track-inner--narrow">
          <p className="track-err">{error}</p>
          <Link className="track-back" to="/track">
            ← Try another booking ID
          </Link>
        </div>
      </section>
    );
  }

  if (!booking) {
    return <TrackSkeleton />;
  }

  const driver = booking.driverAssignment?.driver;
  const statusIndex = STEPS.indexOf(booking.status);
  const visibleSteps = STEPS.filter((step) => {
    if (
      booking.rentalType !== "SELF_DRIVE" &&
      (step === "AWAITING_KYC" || step === "AWAITING_SIGNATURE")
    ) {
      return false;
    }
    return true;
  });

  return (
    <section className="track-page" aria-label="Booking status">
      <div className="track-inner">
        <header className="track-header track-header--left">
          <p className="track-eyebrow">Tracking</p>
          <h1>{booking.publicId}</h1>
          <p className="track-lead">
            {RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType}
          </p>
          <span className="track-status">{labelStatus(booking.status)}</span>
        </header>

        {error ? <p className="track-err">{error}</p> : null}

        <div className="track-layout">
          <div className="track-summary">
            <h2>Booking details</h2>
            <ul className="track-facts">
              <li>
                <FontAwesomeIcon icon={faCalendarDays} />
                <div>
                  <strong>When</strong>
                  <span>
                    {new Date(booking.startsAt).toLocaleString("en-IN")} →{" "}
                    {new Date(booking.endsAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </li>
              <li>
                <FontAwesomeIcon icon={faIndianRupeeSign} />
                <div>
                  <strong>Amount</strong>
                  <span>{formatInr(booking.amountPaise)}</span>
                </div>
              </li>
              {booking.pickupBranch?.name ? (
                <li>
                  <FontAwesomeIcon icon={faLocationDot} />
                  <div>
                    <strong>Pickup</strong>
                    <span>{booking.pickupBranch.name}</span>
                  </div>
                </li>
              ) : null}
              {driver ? (
                <li>
                  <FontAwesomeIcon icon={faUser} />
                  <div>
                    <strong>Driver</strong>
                    <span>
                      {driver.fullName}
                      {driver.phone ? ` · ${driver.phone}` : ""}
                    </span>
                  </div>
                </li>
              ) : null}
              {booking.vehicle?.registration ? (
                <li>
                  <FontAwesomeIcon icon={faCarSide} />
                  <div>
                    <strong>Vehicle</strong>
                    <span>{booking.vehicle.registration}</span>
                  </div>
                </li>
              ) : null}
            </ul>

            {user ? (
              <Link
                className="track-cta track-cta--ghost"
                to={`/account/bookings/${booking.id}`}
              >
                Booking details
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            ) : null}
          </div>

          <div className="track-timeline">
            <h2>Timeline</h2>
            <ol className="track-steps">
              {visibleSteps.map((step) => {
                const stepIdx = STEPS.indexOf(step);
                const done =
                  statusIndex >= stepIdx || booking.status === step;
                const current = booking.status === step;
                const hist = (booking.history || []).find((h) => h.to === step);
                return (
                  <li
                    key={step}
                    className={[
                      "track-step",
                      done ? "is-done" : "",
                      current ? "is-current" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="track-step-dot" aria-hidden="true" />
                    <div>
                      <strong>{labelStatus(step)}</strong>
                      {hist?.reason ? <p>{hist.reason}</p> : null}
                    </div>
                  </li>
                );
              })}
              {["CANCELLED", "NO_SHOW"].includes(booking.status) ? (
                <li className="track-step is-done is-current">
                  <span className="track-step-dot" aria-hidden="true" />
                  <div>
                    <strong>{labelStatus(booking.status)}</strong>
                  </div>
                </li>
              ) : null}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
