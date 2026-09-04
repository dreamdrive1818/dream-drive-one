"use client";

import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./Success.css";

function IconCheck() {
  return (
    <svg className="success-check-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        className="success-check-path"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 12.5 10 17l8.5-9.5"
      />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M12 3.8 21 20.2H3L12 3.8z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 9.5v4.8M12 17.2h.01"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="8.5"
        y="8.5"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M6.5 15.5H5.8A2.3 2.3 0 0 1 3.5 13.2V5.8A2.3 2.3 0 0 1 5.8 3.5h7.4a2.3 2.3 0 0 1 2.3 2.3v.7"
      />
    </svg>
  );
}

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4 8.5A2.5 2.5 0 0 0 4 13.5V16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5a2.5 2.5 0 0 0 0-5V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="1.6 2.2"
        d="M12 6.2v11.6"
      />
    </svg>
  );
}

function IconCarSide() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M3.5 14.5h17v3.6h-2.1a2.1 2.1 0 0 1-4.2 0H9.8a2.1 2.1 0 0 1-4.2 0H3.5v-3.6zM5.2 14.5l1.5-4.8A2 2 0 0 1 8.6 8.2h6.8a2 2 0 0 1 1.9 1.4l1.4 4.9"
      />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M4 11.2 19.5 4.5 13 20l-2.2-6.8z"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M12 3.5 19 6.5v5.2c0 4.4-2.9 7.4-7 9.1-4.1-1.7-7-4.7-7-9.1V6.5z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.8 12 2.1 2.1 4.3-4.4"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9 6 6 6-6 6"
      />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="m4 11 8-7 8 7v9H4z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        d="M10 20v-6h4v6"
      />
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
        strokeWidth="1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M12 11v5.2M12 7.6h.01"
      />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M9 17.5h6M10 20h4M8.2 14.2A5.5 5.5 0 1 1 15.8 14c-.7 1.1-1.5 1.9-1.8 3.5H10c-.3-1.6-1.1-2.4-1.8-3.5z"
      />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M16 6v7M22.5 9.5 18 14M25 16h-7"
      />
    </svg>
  );
}

const NEXT_STEPS = [
  {
    title: "Booking created",
    body: "Your reservation is saved with the reference above.",
  },
  {
    title: "Complete verification if needed",
    body: "Complete KYC if your booking requires it.",
  },
  {
    title: "Track booking updates",
    body: "Follow status changes as your trip is prepared.",
  },
  {
    title: "Vehicle handover",
    body: "Your trip begins after handover is confirmed.",
  },
];

export default function Success() {
  const [params] = useSearchParams();
  const booking = params.get("booking");
  const [copied, setCopied] = useState(false);

  async function copyBookingId() {
    if (!booking) return;
    try {
      await navigator.clipboard.writeText(booking);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!booking) {
    return (
      <div className="success-page">
        <div className="success-inner">
          <section className="success-missing" role="status">
            <div className="success-missing-icon" aria-hidden="true">
              <IconWarn />
            </div>
            <p className="success-eyebrow">Booking reference</p>
            <h1>Booking reference unavailable</h1>
            <p className="success-lead">
              We could not find a booking ID in this link. Return to fleet and
              complete checkout again, or open a booking from your account when
              available.
            </p>
            <div className="success-missing-actions">
              <Link to="/fleet" className="success-btn success-btn--primary">
                <span>Browse cars</span>
                <IconChevron />
              </Link>
              <Link to="/" className="success-btn success-btn--ghost">
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="success-page">
      <header className="success-hero">
        <div className="success-hero-scene" aria-hidden="true">
          <img
            className="success-hero-landscape"
            src="/success-hero-landscape.jpg"
            alt=""
          />
          <img
            className="success-hero-car"
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png"
            alt=""
          />
        </div>

        <p className="success-script success-script--left">
          Good Journeys Ahead!
        </p>
        <div className="success-script success-script--right">
          <span>More Road Trips Await!</span>
          <span className="success-script-heart" aria-hidden="true">
            ♡
          </span>
        </div>

        <div className="success-hero-core">
          <div className="success-hero-icon" aria-hidden="true">
            <span className="success-spark success-spark--1" />
            <span className="success-spark success-spark--2" />
            <span className="success-spark success-spark--3" />
            <span className="success-spark success-spark--4" />
            <span className="success-spark success-spark--5" />
            <span className="success-spark success-spark--6" />
            <IconCheck />
          </div>
          <p className="success-eyebrow">Booking confirmed</p>
          <h1>Payment received</h1>
          <p className="success-lead">
            Your booking has been created successfully. You can track its
            progress or complete any required next steps.
          </p>
        </div>
      </header>

      <div className="success-inner">
        <section
          className="success-id-card"
          aria-labelledby="success-booking-label"
        >
          <div className="success-id-icon" aria-hidden="true">
            <IconTicket />
          </div>
          <div className="success-id-copy">
            <p id="success-booking-label" className="success-id-label">
              Booking ID
            </p>
            <div className="success-id-row">
              <p className="success-id-value">{booking}</p>
              <p className="success-id-hint">
                Keep this ID handy for future reference.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="success-copy-btn"
            onClick={copyBookingId}
            aria-label="Copy booking ID"
          >
            <IconCopy />
            {copied ? "Copied" : "Copy ID"}
          </button>
        </section>

        <div className="success-layout">
          <section
            className="success-card success-card--steps"
            aria-labelledby="success-next-heading"
          >
            <h2 id="success-next-heading">What happens next?</h2>
            <ol className="success-steps">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="success-step">
                  <div className="success-step-rail" aria-hidden="true">
                    <span className="success-step-num">{index + 1}</span>
                  </div>
                  <div className="success-step-copy">
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside
            className="success-card success-card--actions"
            aria-labelledby="success-actions-heading"
          >
            <header className="success-card-head">
              <div className="success-card-head-copy">
                <p className="success-card-kicker">Take the next step</p>
                <h2 id="success-actions-heading">Next actions</h2>
                <p className="success-card-lead">
                  Keep this booking ID handy. Use track for live updates, and
                  KYC only when it applies to your booking.
                </p>
              </div>
              <span className="success-card-spark" aria-hidden="true">
                <IconSpark />
              </span>
            </header>

            <div className="success-actions-body">
              <Link
                to={`/track/${booking}`}
                className="success-btn success-btn--primary"
              >
                <span className="success-btn-start">
                  <IconSend />
                  Track booking
                </span>
                <IconChevron />
              </Link>
              <Link
                to="/account/kyc"
                className="success-btn success-btn--secondary"
              >
                <span className="success-btn-start">
                  <IconShield />
                  Complete KYC
                </span>
                <IconChevron />
              </Link>

              <p className="success-kyc-hint">
                <span className="success-kyc-hint-icon" aria-hidden="true">
                  <IconInfo />
                </span>
                Required for applicable self-drive bookings.
              </p>

              <div className="success-secondary-links">
                <Link to="/fleet">
                  <IconCarSide />
                  Browse cars
                </Link>
                <span className="success-link-sep" aria-hidden="true" />
                <Link to="/">
                  <IconHome />
                  Back to home
                </Link>
              </div>
            </div>

            <div className="success-actions-visual" aria-hidden="true">
              <img
                src="/success-actions-corner.jpg"
                alt=""
                className="success-actions-visual-img"
              />
            </div>
            <p className="success-actions-visual-script" aria-hidden="true">
              Same Roads New Stories
            </p>
          </aside>
        </div>

        <aside className="success-help">
          <div className="success-help-icon" aria-hidden="true">
            <IconBulb />
          </div>
          <p>
            Need help? Contact our support team anytime. We&apos;re here to make
            your journey smooth.
          </p>
          <Link to="/contact" className="success-help-btn">
            Contact Support
            <IconChevron />
          </Link>
        </aside>
      </div>
    </div>
  );
}
