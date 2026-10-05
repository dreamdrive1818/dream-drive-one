"use client";

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faBan,
  faCalendarCheck,
  faCalendarDays,
  faChevronRight,
  faCarSide,
  faCheck,
  faCircleCheck,
  faCopy,
  faClock,
  faCreditCard,
  faFileSignature,
  faFlagCheckered,
  faHashtag,
  faHeadset,
  faIdCard,
  faIndianRupeeSign,
  faKey,
  faLocationDot,
  faLock,
  faMobileScreen,
  faRoad,
  faRotateLeft,
  faRoute,
  faShieldHalved,
  faTriangleExclamation,
  faUser,
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

const STEP_META = {
  HOLD: { label: "Car reserved", icon: faLock },
  AWAITING_PAYMENT: { label: "Payment", icon: faCreditCard },
  AWAITING_KYC: { label: "Documents (KYC)", icon: faIdCard },
  AWAITING_SIGNATURE: { label: "Agreement", icon: faFileSignature },
  CONFIRMED: { label: "Confirmed", icon: faCalendarCheck },
  HANDOVER: { label: "Car handover", icon: faKey },
  ONGOING: { label: "On trip", icon: faRoad },
  RETURN_PENDING: { label: "Return", icon: faRotateLeft },
  COMPLETED: { label: "Trip completed", icon: faFlagCheckered },
  CANCELLED: { label: "Cancelled", icon: faBan },
  NO_SHOW: { label: "No-show", icon: faTriangleExclamation },
};

const STATUS_COPY = {
  DRAFT: ["Booking started", "This booking hasn't been completed yet."],
  HOLD: ["Car reserved", "Your car is on hold. Complete payment to confirm the booking."],
  AWAITING_PAYMENT: ["Waiting for payment", "Complete the payment to confirm your booking."],
  AWAITING_KYC: ["Documents needed", "Upload your licence and ID so we can verify them."],
  AWAITING_SIGNATURE: ["Agreement pending", "Sign the rental agreement to finish confirming."],
  CONFIRMED: ["Booking confirmed", "You're all set. We'll see you at pickup."],
  HANDOVER: ["Car handover", "Your car is being handed over."],
  ONGOING: ["Trip in progress", "Enjoy the drive. Reach out if you need anything."],
  RETURN_PENDING: ["Return pending", "The car return is being processed."],
  COMPLETED: ["Trip completed", "Thanks for driving with Dream Drive."],
  CANCELLED: ["Booking cancelled", "This booking was cancelled."],
  NO_SHOW: ["Marked as no-show", "The car wasn't picked up within the grace period."],
};

const STATUS_TONE = {
  DRAFT: "pending",
  HOLD: "pending",
  AWAITING_PAYMENT: "pending",
  AWAITING_KYC: "pending",
  AWAITING_SIGNATURE: "pending",
  CONFIRMED: "confirmed",
  HANDOVER: "confirmed",
  ONGOING: "active",
  RETURN_PENDING: "active",
  COMPLETED: "done",
  CANCELLED: "bad",
  NO_SHOW: "bad",
};

const LOOKUP_STAGES = [
  { icon: faCreditCard, tone: "amber", title: "Payment & documents", text: "See what's pending before pickup." },
  { icon: faCalendarCheck, tone: "teal", title: "Confirmation", text: "Know the moment your booking is confirmed." },
  { icon: faKey, tone: "blue", title: "Handover & trip", text: "Follow the car handover and your trip." },
  { icon: faFlagCheckered, tone: "green", title: "Return", text: "Track the return until the trip is closed." },
];

const EASE = [0.22, 1, 0.36, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

function labelStatus(status) {
  return STEP_META[status]?.label || String(status || "").replace(/_/g, " ").toLowerCase();
}

function accountBookingHref(booking, user) {
  const dest = `/account/bookings/${booking.id || booking.publicId}`;
  if (user) return dest;
  return `/login?redirect=${encodeURIComponent(dest)}`;
}

function payHref(booking) {
  return `/checkout/pay?booking=${encodeURIComponent(booking.publicId || booking.id)}`;
}

function stepReached(step, booking, statusIndex, history) {
  if (step === "HOLD") return true;
  if (booking.status === step) return true;
  if (statusIndex >= STEPS.indexOf(step) && STEPS.includes(booking.status)) return true;
  return (history || []).some((h) => h.to === step);
}

function stageHref(step, bookingId) {
  return `/track/${encodeURIComponent(bookingId)}?stage=${encodeURIComponent(step)}`;
}

function timelineHref(bookingId) {
  return `/track/${encodeURIComponent(bookingId)}`;
}

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatDuration(start, end) {
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const hours = Math.round(ms / 36e5);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} hr${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function Shell({ label, children, motionProps, narrow }) {
  return (
    <section className="track-page" aria-label={label}>
      <div className="trk-bg" aria-hidden="true" />
      <motion.div
        className={`track-inner${narrow ? " track-inner--narrow" : ""}`}
        variants={stagger}
        {...motionProps}
      >
        {children}
      </motion.div>
    </section>
  );
}

function AccessIntro({ eyebrow, title, highlight, lead }) {
  return (
    <motion.header className="trk-intro" variants={rise}>
      <p className="trk-eyebrow">{eyebrow}</p>
      <h1>
        {title} <span>{highlight}</span>
      </h1>
      <p className="trk-lead">{lead}</p>
    </motion.header>
  );
}

function StagesCard() {
  return (
    <motion.aside className="trk-stages" variants={rise} aria-label="What you can track">
      <div className="trk-stages-head">
        <span className="trk-live">
          <span className="trk-live-dot" aria-hidden="true" />
          Live updates
        </span>
        <h2>What you&apos;ll see</h2>
        <p>Your booking status refreshes on its own as things move along.</p>
      </div>
      <ol className="trk-stages-list">
        {LOOKUP_STAGES.map((s) => (
          <li key={s.title}>
            <span className={`trk-tile trk-tile--${s.tone}`} aria-hidden="true">
              <FontAwesomeIcon icon={s.icon} />
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
            </span>
          </li>
        ))}
      </ol>
    </motion.aside>
  );
}

function StageView({ booking, step, user, bookingId, motionProps, copied, copyValue }) {
  const hist = (booking.history || []).find((h) => h.to === step);
  const [title, text] = STATUS_COPY[step] || [STEP_META[step]?.label || step, ""];
  const payable = ["HOLD", "AWAITING_PAYMENT"].includes(booking.status);
  const signUrl = (booking.agreements || [])
    .map((a) => a.signUrl || a.envelope?.signUrl)
    .find(Boolean);
  const pickup = booking.pickupBranch;
  const drop = booking.dropBranch;
  const driver = booking.driverAssignment?.driver;
  const facts = [
    booking.tourPackage?.name ? ["Tour package", booking.tourPackage.name] : null,
    pickup?.name ? ["Pickup", [pickup.name, pickup.city?.name].filter(Boolean).join(", ")] : null,
    drop?.name && drop.id !== pickup?.id
      ? ["Drop", [drop.name, drop.city?.name].filter(Boolean).join(", ")]
      : null,
    booking.vehicle?.registration ? ["Vehicle", booking.vehicle.registration] : null,
    driver?.fullName ? ["Driver", driver.fullName] : null,
    ["Trip starts", formatWhen(booking.startsAt)],
    ["Trip ends", formatWhen(booking.endsAt)],
    ["Amount", formatInr(booking.amountPaise)],
  ].filter(Boolean);

  return (
    <Shell label={title} motionProps={motionProps}>
      <motion.div className="trk-topbar" variants={rise}>
        <Link to={timelineHref(bookingId)} className="trk-back">
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to timeline
        </Link>
      </motion.div>

      <motion.header className={`trk-status trk-status--${STATUS_TONE[step] || "pending"}`} variants={rise}>
        <div className="trk-status-main">
          <p className="trk-status-kicker">
            <span>{STEP_META[step]?.label}</span>
            <span aria-hidden="true">•</span>
            <span>Booking {booking.publicId}</span>
          </p>
          <h1>
            <span className="trk-status-icon" aria-hidden="true">
              <FontAwesomeIcon icon={STEP_META[step]?.icon || faClock} />
            </span>
            {title}
          </h1>
          {text ? <p className="trk-status-text">{text}</p> : null}
        </div>
      </motion.header>

      <motion.section className="trk-card trk-stage-card" variants={rise}>
        <div className="trk-card-head">
          <h2>{STEP_META[step]?.label} details</h2>
          {hist?.createdAt ? <time>{formatWhen(hist.createdAt)}</time> : null}
        </div>
        {hist?.reason ? <p className="trk-stage-reason">{hist.reason}</p> : null}
        <dl className="trk-details">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="trk-stage-actions">
          {step === "HOLD" && payable ? (
            <Link className="trk-btn trk-btn--primary" to={payHref(booking)}>
              Complete payment
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          ) : null}
          {step === "AWAITING_PAYMENT" && payable ? (
            <Link className="trk-btn trk-btn--primary" to={payHref(booking)}>
              Pay now
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          ) : null}
          {step === "AWAITING_KYC" ? (
            <Link
              className="trk-btn trk-btn--primary"
              to={user ? "/account/kyc" : `/login?redirect=${encodeURIComponent("/account/kyc")}`}
            >
              Open documents
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          ) : null}
          {step === "AWAITING_SIGNATURE" ? (
            signUrl ? (
              <a className="trk-btn trk-btn--primary" href={signUrl} target="_blank" rel="noreferrer">
                Sign agreement
                <FontAwesomeIcon icon={faArrowRight} />
              </a>
            ) : (
              <Link
                className="trk-btn trk-btn--primary"
                to={
                  user
                    ? "/account/agreements"
                    : `/login?redirect=${encodeURIComponent("/account/agreements")}`
                }
              >
                Open agreements
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            )
          ) : null}
          {["CONFIRMED", "HANDOVER", "ONGOING", "RETURN_PENDING", "COMPLETED"].includes(step) ? (
            <Link className="trk-btn trk-btn--primary" to={accountBookingHref(booking, user)}>
              Open full booking
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          ) : null}
          <button
            type="button"
            className="trk-btn trk-btn--outline"
            onClick={() =>
              copyValue(
                [`${title} · ${booking.publicId}`, hist?.reason, `Track: ${timelineHref(booking.publicId)}`]
                  .filter(Boolean)
                  .join("\n"),
                "stage"
              )
            }
          >
            <FontAwesomeIcon icon={copied === "stage" ? faCheck : faCopy} />
            {copied === "stage" ? "Copied" : "Copy details"}
          </button>
        </div>
      </motion.section>
    </Shell>
  );
}

export default function Track() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const { user, ready } = useAuth();
  const reduceMotion = useReducedMotion();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTtl, setOtpTtl] = useState(0);
  const [busy, setBusy] = useState(false);
  const [guestUnlocked, setGuestUnlocked] = useState(false);
  const [publicIdInput, setPublicIdInput] = useState(bookingId || "");
  const [copied, setCopied] = useState("");

  const motionProps = reduceMotion
    ? { initial: "show", animate: "show" }
    : { initial: "hidden", animate: "show" };

  async function copyValue(text, key) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
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
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? "" : current)), 2000);
    } catch {
      setCopied("");
    }
  }

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
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api("/v1/public/bookings/track/otp", {
        method: "POST",
        body: { publicId: bookingId, phone },
      });
      setOtpTtl(Number(res?.expiresInSec) || 0);
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
      <Shell label="Track booking" motionProps={motionProps}>
        <div className="trk-access">
          <div className="trk-access-main">
            <AccessIntro
              eyebrow="Track booking"
              title="Where's my"
              highlight="booking?"
              lead="Enter the booking ID from your confirmation to see its live status, trip dates, and pickup details."
            />

            <motion.form
              className="trk-form"
              variants={rise}
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
              {error ? (
                <p className="trk-alert" role="alert">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  {error}
                </p>
              ) : null}
              <label className="trk-field" htmlFor="trk-id">
                <span>Booking ID</span>
                <span className="trk-input">
                  <FontAwesomeIcon icon={faHashtag} aria-hidden="true" />
                  <input
                    id="trk-id"
                    value={publicIdInput}
                    onChange={(e) => setPublicIdInput(e.target.value)}
                    placeholder="DD-123456"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                  />
                </span>
              </label>
              <button className="trk-btn trk-btn--primary" type="submit">
                Track booking
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <p className="trk-form-note">
                Find the ID in your booking confirmation. Signed in?{" "}
                <Link to="/account/bookings">Open my bookings</Link>
              </p>
            </motion.form>
          </div>

          <StagesCard />
        </div>
      </Shell>
    );
  }

  if (!booking && ready && !user && !guestUnlocked) {
    return (
      <Shell label="Verify booking access" motionProps={motionProps}>
        <div className="trk-access">
          <div className="trk-access-main">
            <AccessIntro
              eyebrow="Track booking"
              title="Verify it's"
              highlight="you"
              lead="For your privacy, confirm the mobile number used on this booking. We'll send a one-time code."
            />

            <motion.form
              className="trk-form"
              variants={rise}
              onSubmit={otpSent ? verifyOtp : sendOtp}
            >
              <div className="trk-form-top">
                <span className="trk-id-chip">
                  <FontAwesomeIcon icon={faHashtag} aria-hidden="true" />
                  {bookingId}
                </span>
                <ol className="trk-mini-steps" aria-label="Verification steps">
                  <li className={otpSent ? "is-done" : "is-current"}>
                    <span>{otpSent ? <FontAwesomeIcon icon={faCircleCheck} /> : 1}</span>
                    Mobile
                  </li>
                  <li className={otpSent ? "is-current" : ""}>
                    <span>2</span>
                    Code
                  </li>
                </ol>
              </div>

              {error ? (
                <p className="trk-alert" role="alert">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  {error}
                </p>
              ) : null}

              <label className="trk-field" htmlFor="trk-phone">
                <span>Mobile number</span>
                <span className={`trk-input${otpSent ? " is-locked" : ""}`}>
                  <FontAwesomeIcon icon={faMobileScreen} aria-hidden="true" />
                  <input
                    id="trk-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Mobile number on the booking"
                    readOnly={otpSent}
                  />
                  {otpSent ? (
                    <button
                      type="button"
                      className="trk-input-action"
                      onClick={() => {
                        setOtpSent(false);
                        setCode("");
                        setError("");
                      }}
                    >
                      Change
                    </button>
                  ) : null}
                </span>
              </label>

              {otpSent ? (
                <label className="trk-field" htmlFor="trk-otp">
                  <span>One-time code</span>
                  <span className="trk-input trk-input--otp">
                    <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" />
                    <input
                      id="trk-otp"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="••••••"
                      maxLength={6}
                      autoFocus
                    />
                  </span>
                  <small className="trk-field-hint">
                    Enter the 6-digit code we sent you
                    {otpTtl ? `. It's valid for ${Math.round(otpTtl / 60)} minutes.` : "."}
                  </small>
                </label>
              ) : null}

              <button className="trk-btn trk-btn--primary" type="submit" disabled={busy}>
                {busy ? "Please wait…" : otpSent ? "Verify & view booking" : "Send code"}
                {!busy ? <FontAwesomeIcon icon={faArrowRight} /> : null}
              </button>

              {otpSent ? (
                <button
                  type="button"
                  className="trk-link-btn"
                  onClick={() => sendOtp()}
                  disabled={busy}
                >
                  Didn&apos;t get it? Resend code
                </button>
              ) : null}

              <p className="trk-form-note">
                Have an account?{" "}
                <Link to={`/login?redirect=/track/${bookingId}`}>Sign in instead</Link>
                {" · "}
                <Link to="/track">Different booking</Link>
              </p>
            </motion.form>
          </div>

          <StagesCard />
        </div>
      </Shell>
    );
  }

  if (error && !booking) {
    return (
      <Shell label="Booking not available" motionProps={motionProps} narrow>
        <motion.div className="trk-empty" variants={rise}>
          <span className="trk-tile trk-tile--red trk-tile--lg" aria-hidden="true">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </span>
          <h1>We couldn&apos;t open this booking</h1>
          <p>{error}</p>
          <div className="trk-empty-actions">
            <Link className="trk-btn trk-btn--primary" to="/track">
              <FontAwesomeIcon icon={faArrowLeft} />
              Try another booking ID
            </Link>
            <Link className="trk-btn trk-btn--outline" to="/contact">
              Contact support
            </Link>
          </div>
        </motion.div>
      </Shell>
    );
  }

  if (!booking) {
    return <TrackSkeleton />;
  }

  const driver = booking.driverAssignment?.driver;
  const statusIndex = STEPS.indexOf(booking.status);
  const history = booking.history || [];
  const stage = params.get("stage");
  if (STEP_META[stage]) {
    return (
      <StageView
        booking={booking}
        step={stage}
        user={user}
        bookingId={booking.publicId || bookingId}
        motionProps={motionProps}
        copied={copied}
        copyValue={copyValue}
      />
    );
  }
  const terminated = ["CANCELLED", "NO_SHOW"].includes(booking.status);
  const visibleSteps = STEPS.filter((step) => {
    if (
      booking.rentalType !== "SELF_DRIVE" &&
      (step === "AWAITING_KYC" || step === "AWAITING_SIGNATURE")
    ) {
      return false;
    }
    if (terminated) return history.some((h) => h.to === step);
    return true;
  });
  const terminalHist = terminated ? history.find((h) => h.to === booking.status) : null;
  const tone = STATUS_TONE[booking.status] || "pending";
  const [statusTitle, statusText] = STATUS_COPY[booking.status] || [labelStatus(booking.status), ""];
  const currentVisible = visibleSteps.indexOf(booking.status);
  const progress = terminated
    ? 0
    : Math.round(((Math.max(currentVisible, 0) + 1) / visibleSteps.length) * 100);
  const rentalLabel = RENTAL_TYPE_LABELS[booking.rentalType] || booking.rentalType;
  const duration = formatDuration(booking.startsAt, booking.endsAt);
  const pickup = booking.pickupBranch;
  const drop = booking.dropBranch;

  const details = [
    booking.tourPackage?.name
      ? { icon: faRoute, label: "Tour package", value: booking.tourPackage.name }
      : null,
    pickup?.name
      ? {
          icon: faLocationDot,
          label: "Pickup",
          value: [pickup.name, pickup.city?.name].filter(Boolean).join(", "),
        }
      : null,
    drop?.name && drop.id !== pickup?.id
      ? {
          icon: faFlagCheckered,
          label: "Drop",
          value: [drop.name, drop.city?.name].filter(Boolean).join(", "),
        }
      : null,
    booking.vehicle?.registration
      ? { icon: faCarSide, label: "Vehicle", value: booking.vehicle.registration }
      : null,
    driver
      ? {
          icon: faUser,
          label: "Driver",
          value: driver.fullName,
          extra: driver.phone ? (
            <a href={`tel:${driver.phone}`} className="trk-detail-link">
              {driver.phone}
            </a>
          ) : null,
        }
      : null,
    { icon: faIndianRupeeSign, label: "Booking amount", value: formatInr(booking.amountPaise) },
  ].filter(Boolean);

  const detailsText = [
    `Dream Drive booking ${booking.publicId}`,
    `Status: ${labelStatus(booking.status)}`,
    `Trip: ${formatWhen(booking.startsAt)} → ${formatWhen(booking.endsAt)}`,
    rentalLabel ? `Type: ${rentalLabel}` : null,
    ...details.map((d) => `${d.label}: ${d.value}`),
    `Track: ${typeof window !== "undefined" ? `${window.location.origin}/track/${booking.publicId}` : `/track/${booking.publicId}`}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Shell label="Booking status" motionProps={motionProps}>
      <motion.div className="trk-topbar" variants={rise}>
        <Link to="/track" className="trk-back">
          <FontAwesomeIcon icon={faArrowLeft} />
          Track another booking
        </Link>
        <span className="trk-live">
          <span className="trk-live-dot" aria-hidden="true" />
          Live updates
        </span>
      </motion.div>

      <motion.header className={`trk-status trk-status--${tone}`} variants={rise}>
        <div className="trk-status-main">
          <p className="trk-status-kicker">
            <span>{rentalLabel}</span>
            <span aria-hidden="true">•</span>
            <span>Booking {booking.publicId}</span>
            <button
              type="button"
              className="trk-copy-btn trk-copy-btn--light"
              onClick={() => copyValue(booking.publicId, "id")}
              aria-label="Copy booking ID"
            >
              <FontAwesomeIcon icon={copied === "id" ? faCheck : faCopy} />
              {copied === "id" ? "Copied" : "Copy ID"}
            </button>
          </p>
          <h1>
            <span className="trk-status-icon" aria-hidden="true">
              <FontAwesomeIcon icon={STEP_META[booking.status]?.icon || faClock} />
            </span>
            {statusTitle}
          </h1>
          {statusText ? <p className="trk-status-text">{statusText}</p> : null}
        </div>

        {!terminated ? (
          <div className="trk-progress" aria-label={`Progress ${progress}%`}>
            <div className="trk-progress-head">
              <span>
                Step {Math.max(currentVisible, 0) + 1} of {visibleSteps.length}
              </span>
              <strong>{progress}%</strong>
            </div>
            <div className="trk-progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}
      </motion.header>

      <div className="trk-grid">
        <motion.section className="trk-card" variants={rise} aria-labelledby="trk-timeline-title">
          <div className="trk-card-head">
            <h2 id="trk-timeline-title">Booking timeline</h2>
            <span className={`trk-pill trk-pill--${tone}`}>{labelStatus(booking.status)}</span>
          </div>
          <ol className="trk-timeline">
            {visibleSteps.map((step) => {
              const stepIdx = STEPS.indexOf(step);
              const hist = history.find((h) => h.to === step);
              const current = booking.status === step;
              const done = statusIndex >= stepIdx || Boolean(hist);
              const href = stepReached(step, booking, statusIndex, history)
                ? stageHref(step, booking.publicId || bookingId)
                : null;
              const inner = (
                <>
                  <span className="trk-step-marker" aria-hidden="true">
                    <FontAwesomeIcon icon={done && !current ? faCircleCheck : STEP_META[step].icon} />
                  </span>
                  <div className="trk-step-body">
                    <div className="trk-step-row">
                      <strong>{STEP_META[step].label}</strong>
                      {hist?.createdAt ? <time>{formatStamp(hist.createdAt)}</time> : null}
                      {current && !hist?.createdAt ? <em>Current</em> : null}
                      {href ? (
                        <span className="trk-step-open">
                          Open
                          <FontAwesomeIcon icon={faChevronRight} />
                        </span>
                      ) : null}
                    </div>
                    {hist?.reason ? <p>{hist.reason}</p> : null}
                  </div>
                </>
              );
              return (
                <li
                  key={step}
                  className={["trk-step", done ? "is-done" : "", current ? "is-current" : "", href ? "is-link" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {href ? (
                    <Link
                      to={href}
                      className="trk-step-link"
                      aria-label={`Open ${STEP_META[step].label} page`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
            {terminated ? (
              <li className="trk-step is-done is-current is-bad">
                <span className="trk-step-marker" aria-hidden="true">
                  <FontAwesomeIcon icon={STEP_META[booking.status].icon} />
                </span>
                <div className="trk-step-body">
                  <div className="trk-step-row">
                    <strong>{STEP_META[booking.status].label}</strong>
                    {terminalHist?.createdAt ? <time>{formatStamp(terminalHist.createdAt)}</time> : null}
                  </div>
                  {terminalHist?.reason ? <p>{terminalHist.reason}</p> : null}
                </div>
              </li>
            ) : null}
          </ol>
        </motion.section>

        <div className="trk-side">
          <motion.section className="trk-card" variants={rise} aria-labelledby="trk-trip-title">
            <div className="trk-card-head">
              <h2 id="trk-trip-title">Trip details</h2>
              <button
                type="button"
                className="trk-copy-btn"
                onClick={() => copyValue(detailsText, "details")}
              >
                <FontAwesomeIcon icon={copied === "details" ? faCheck : faCopy} />
                {copied === "details" ? "Copied" : "Copy details"}
              </button>
            </div>

            <div className="trk-dates">
              <div>
                <span className="trk-dates-label">
                  <FontAwesomeIcon icon={faCalendarDays} />
                  Starts
                </span>
                <strong>{formatWhen(booking.startsAt)}</strong>
              </div>
              <span className="trk-dates-line" aria-hidden="true">
                {duration ? <em>{duration}</em> : null}
              </span>
              <div>
                <span className="trk-dates-label">
                  <FontAwesomeIcon icon={faFlagCheckered} />
                  Ends
                </span>
                <strong>{formatWhen(booking.endsAt)}</strong>
              </div>
            </div>

            <dl className="trk-details">
              {details.map((d) => (
                <div key={d.label}>
                  <dt>
                    <FontAwesomeIcon icon={d.icon} />
                    {d.label}
                  </dt>
                  <dd>
                    {d.value}
                    {d.extra ? <span>{d.extra}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>

            {user ? (
              <Link className="trk-btn trk-btn--outline trk-btn--block" to={`/account/bookings/${booking.id}`}>
                Open full booking
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            ) : null}
          </motion.section>

          <motion.aside className="trk-help" variants={rise}>
            <span className="trk-tile trk-tile--light" aria-hidden="true">
              <FontAwesomeIcon icon={faHeadset} />
            </span>
            <div>
              <h2>Need help with this booking?</h2>
              <p>Share your booking ID {booking.publicId} and we&apos;ll take it from there.</p>
            </div>
            <Link to="/contact" className="trk-btn trk-btn--light">
              Contact us
            </Link>
          </motion.aside>
        </div>
      </div>
    </Shell>
  );
}
