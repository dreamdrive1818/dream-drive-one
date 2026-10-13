"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiFresh, peekApi } from "../../api";
import { useAuth } from "../../AuthContext";
import { formatDay, formatWhen, prettyStatus, rupees, statusTone } from "./format";
import { tokenDuePaise } from "../../fleetSearch";

const BALANCE_STATUSES = new Set(["CONFIRMED", "HANDOVER", "ONGOING"]);

function focusField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}

function timeOf(value) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function buildPending(user, data) {
  const items = [];
  const now = Date.now();
  const carName = (b) => b.carModel?.name || `Booking ${b.publicId}`;
  const when = (b) => `${formatDay(b.startsAt)} → ${formatDay(b.endsAt)}`;
  const kyc = user?.kycStatus;
  const kycInReview = kyc === "SUBMITTED" || kyc === "UNDER_REVIEW";
  let kycCovered = false;
  const signBookings = new Set();

  for (const b of data?.bookings || []) {
    const starts = timeOf(b.startsAt);
    const ends = timeOf(b.endsAt);
    const paid = b.paidPaise || 0;

    if (b.status === "HOLD" || b.status === "AWAITING_PAYMENT") {
      const holdLive = paid > 0 || !b.holdExpiresAt || timeOf(b.holdExpiresAt) > now;
      const tokenDue = Math.max(0, tokenDuePaise(b.tokenPaise, b.amountPaise) - paid);
      if (holdLive && starts > now && tokenDue > 0) {
        items.push({
          key: `pay-${b.id}`,
          title: `Pay to confirm ${carName(b)}`,
          detail: `${when(b)} · Token ${rupees(tokenDue)}`,
          to: `/checkout/pay?booking=${encodeURIComponent(b.publicId)}`,
          cta: "Pay now",
        });
      }
    } else if (b.status === "AWAITING_KYC" && ends > now && kyc !== "APPROVED") {
      kycCovered = true;
      items.push(
        kycInReview
          ? {
              key: `kyc-${b.id}`,
              waiting: true,
              title: `KYC under review for ${carName(b)}`,
              detail: `${when(b)} · The booking confirms once KYC is approved.`,
              to: "/account/kyc",
              cta: "View",
            }
          : {
              key: `kyc-${b.id}`,
              title: `Upload KYC for ${carName(b)}`,
              detail: `${when(b)} · Needed before we can hand over the car`,
              to: "/account/kyc",
              cta: "Complete KYC",
            }
      );
    } else if (b.status === "AWAITING_SIGNATURE" && ends > now) {
      signBookings.add(b.publicId);
      items.push({
        key: `sign-${b.id}`,
        title: `Sign the rental agreement for ${carName(b)}`,
        detail: when(b),
        to: "/account/agreements",
        cta: "Sign",
      });
    } else if (b.status === "RETURN_PENDING") {
      const overdue = ends > 0 && ends < now;
      items.push({
        key: `return-${b.id}`,
        title: overdue ? `${carName(b)} return is overdue` : `Return ${carName(b)}`,
        detail: `${overdue ? "Was due" : "Due"} ${formatWhen(b.endsAt)}`,
        to: `/account/bookings/${b.publicId}`,
        cta: "View",
      });
    }

    const balance = (b.amountPaise || 0) - paid;
    if (BALANCE_STATUSES.has(b.status) && ends > now && balance > 0) {
      const beforeStart = b.status === "CONFIRMED";
      items.push({
        key: `balance-${b.id}`,
        waiting: beforeStart,
        title: `${rupees(balance)} balance for ${carName(b)}`,
        detail: beforeStart
          ? `Payable at handover on ${formatDay(b.startsAt)}`
          : "Due now — settle it with our team",
        to: `/account/bookings/${b.publicId}`,
        cta: "View",
      });
    }
  }

  for (const a of data?.documents?.agreements || []) {
    if (a.status !== "SENT" || signBookings.has(a.booking?.publicId)) continue;
    items.push({
      key: `agreement-${a.id}`,
      title: "Agreement waiting for your signature",
      detail: a.booking?.publicId ? `Booking ${a.booking.publicId}` : "",
      to: "/account/agreements",
      cta: "Sign",
    });
  }

  if (!kycCovered) {
    if (kyc === "NOT_STARTED" || !kyc) {
      items.push({
        key: "kyc",
        title: "Complete your KYC",
        detail: "Upload your driving licence and ID once — it is needed before your first trip.",
        to: "/account/kyc",
        cta: "Start KYC",
      });
    } else if (kyc === "REJECTED") {
      items.push({
        key: "kyc",
        title: "KYC needs attention",
        detail: "Some documents were not accepted. Re-upload them to continue.",
        to: "/account/kyc",
        cta: "Fix KYC",
      });
    } else if (kycInReview) {
      items.push({
        key: "kyc",
        waiting: true,
        title: "KYC under review",
        detail: "Nothing to do — we will notify you once it is approved.",
        to: "/account/kyc",
        cta: "View",
      });
    }
  }

  if ((data?.subscriptions || []).some((s) => s.swapDueReason === "SERVICE")) {
    items.push({
      key: "swap",
      waiting: true,
      title: "Service swap due",
      detail: "We will move you to another car of the same class — fleet ops will confirm the replacement.",
      to: "/subscriptions",
      cta: "View",
    });
  }

  const subjects = (rows) =>
    rows
      .slice(0, 2)
      .map((t) => t.subject)
      .filter(Boolean)
      .join(" · ");
  const tickets = data?.tickets || [];
  const replied = tickets.filter((t) => t.status === "PENDING");
  const waitingOnUs = tickets.filter((t) => t.status === "OPEN");
  if (replied.length) {
    items.push({
      key: "tickets-replied",
      title: `Support replied on ${replied.length} ticket${replied.length === 1 ? "" : "s"}`,
      detail: subjects(replied),
      to: "/account/tickets",
      cta: "Reply",
    });
  }
  if (waitingOnUs.length) {
    items.push({
      key: "tickets-open",
      waiting: true,
      title: `${waitingOnUs.length} support ticket${waitingOnUs.length === 1 ? "" : "s"} with our team`,
      detail: subjects(waitingOnUs),
      to: "/account/tickets",
      cta: "View",
    });
  }

  if (user?.pendingPhone) {
    items.push({
      key: "phone-verify",
      title: "Verify your new mobile number",
      detail: `Enter the OTP sent to your email to confirm ${user.pendingPhone}.`,
      focus: "otp",
      cta: "Verify",
    });
  } else if (!user?.phone) {
    items.push({
      key: "phone",
      title: "Add your mobile number",
      detail: "We use it to coordinate pickup and handover.",
      focus: "phone",
      cta: "Add",
    });
  }

  if (!(user?.addresses || []).length) {
    items.push({
      key: "address",
      title: "Add your address",
      detail: "Saves time at checkout and on invoices.",
      focus: "line1",
      cta: "Add",
    });
  }

  return items;
}

export default function AccountHome() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(() => peekApi("/v1/me/dashboard") || null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone || "",
  });
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  });
  const [otp, setOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState(user?.pendingPhone || "");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cached = peekApi("/v1/me/dashboard");
    if (cached) setData(cached);
    apiFresh("/v1/me/dashboard")
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((e) => {
        if (!cancelled && !cached) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#recent-bookings") return;
    const el = document.getElementById("recent-bookings");
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    setForm({ fullName: user?.fullName || "", phone: user?.phone || "" });
    setPendingPhone(user?.pendingPhone || "");
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await api("/v1/me", { method: "PATCH", body: form });
      if (res.phoneChangeRequired) {
        setPendingPhone(res.pendingPhone || form.phone);
        setInfo(
          res.devCode
            ? `We sent an OTP to confirm the new number. Dev code: ${res.devCode}`
            : "We sent an OTP to your email to confirm the new phone number."
        );
      } else {
        setInfo("Profile saved.");
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPhone(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/me/phone/verify", { method: "POST", body: { code: otp } });
      setOtp("");
      setPendingPhone("");
      setInfo("Phone number updated.");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addAddress(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/me/addresses", { method: "POST", body: { ...address, isDefault: true } });
      setAddress({ line1: "", line2: "", city: "", state: "", zip: "" });
      setInfo("Address saved.");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id) {
    setBusy(true);
    try {
      await api(`/v1/me/addresses/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const bookings = data?.bookings || [];
  const invoices = data?.invoices || [];
  const tickets = data?.tickets || [];
  const pending = useMemo(() => buildPending(user, data), [user, data]);
  const actionCount = pending.filter((p) => !p.waiting).length;

  return (
    <>
      <header className="account-header">
        <p className="account-eyebrow">Account</p>
        <h1>Hi {user?.fullName || "there"}</h1>
        <p className="account-lead">
          Profile, trips, KYC, invoices, and support — all in one place.
        </p>
      </header>
      {error && <p className="account-msg err">{error}</p>}
      {info && <p className="account-msg ok">{info}</p>}

      <div className="account-grid">
        <div className="account-stat">
          <span>KYC</span>
          <strong className={`account-pill ${statusTone(user?.kycStatus)}`}>
            {prettyStatus(user?.kycStatus)}
          </strong>
        </div>
        <a
          className="account-stat account-stat--link"
          href="#recent-bookings"
          onClick={(e) => {
            const el = document.getElementById("recent-bookings");
            if (!el) return;
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span>Bookings</span>
          <strong>{bookings.length}</strong>
        </a>
        <div className="account-stat">
          <span>Wallet</span>
          <strong>{rupees(data?.wallet?.balancePaise)}</strong>
        </div>
        <div className="account-stat">
          <span>Open tickets</span>
          <strong>{tickets.filter((t) => t.status === "OPEN" || t.status === "PENDING").length}</strong>
        </div>
      </div>

      <div className="account-card account-pending" id="pending-items">
        <div className="account-pending-head">
          <h2>Pending items</h2>
          {data && actionCount > 0 ? (
            <span className="account-pill warn">{actionCount} to do</span>
          ) : null}
        </div>
        {!data ? (
          <p className="account-empty">Checking your account…</p>
        ) : pending.length === 0 ? (
          <p className="account-empty">You are all set — nothing pending right now.</p>
        ) : (
          <ul className="account-pending-list">
            {pending.map((item) => (
              <li
                key={item.key}
                className={`account-pending-item${item.waiting ? " is-waiting" : ""}`}
              >
                <span className="account-pending-dot" aria-hidden="true" />
                <div className="account-pending-copy">
                  <h3>{item.title}</h3>
                  {item.detail ? <p>{item.detail}</p> : null}
                </div>
                {item.to ? (
                  <Link className="account-btn account-pending-cta" to={item.to}>
                    {item.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="account-btn account-pending-cta"
                    onClick={() => focusField(item.focus)}
                  >
                    {item.cta}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="account-home-split">
        <div className="account-card">
        <h2>Profile</h2>
        {user?.nameLocked && (
          <p className="account-hint">
            Your name is locked to the approved KYC record. Support can update it if needed.
          </p>
        )}
        <form onSubmit={saveProfile}>
          <div className="account-form-grid">
            <div className="account-field">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                value={form.fullName}
                disabled={user?.nameLocked}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="account-field">
              <label>Email</label>
              <input value={user?.email || ""} disabled />
            </div>
            <div className="account-field">
              <label htmlFor="phone">Mobile</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="10-digit mobile"
              />
            </div>
          </div>
          <button className="account-btn" type="submit" disabled={busy}>
            Save profile
          </button>
        </form>
        {pendingPhone && (
          <form onSubmit={confirmPhone} style={{ marginTop: 16 }}>
            <p className="account-hint">Confirm {pendingPhone} with the OTP sent to your email.</p>
            <div className="account-field">
              <label htmlFor="otp">OTP</label>
              <input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <button className="account-btn" type="submit" disabled={busy}>
              Verify phone
            </button>
          </form>
        )}
      </div>

      <div className="account-card">
        <h2>Addresses</h2>
        {(user?.addresses || []).length === 0 && <p className="account-empty">No saved addresses yet.</p>}
        <ul className="account-list">
          {(user?.addresses || []).map((a) => (
            <li key={a.id} className="account-item account-item--address">
              <div>
                <h3>{a.isDefault ? "Default address" : "Address"}</h3>
                <p>
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                  <br />
                  {[a.city, a.state, a.zip].filter(Boolean).join(", ")}
                </p>
              </div>
              <button className="account-btn ghost" type="button" onClick={() => removeAddress(a.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addAddress} style={{ marginTop: 12 }}>
          <div className="account-field">
            <label htmlFor="line1">Add address</label>
            <input
              id="line1"
              placeholder="Line 1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              required
            />
          </div>
          <div className="account-address-grid">
            <div className="account-field">
              <input
                placeholder="City"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
              />
            </div>
            <div className="account-field">
              <input
                placeholder="State"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
            </div>
            <div className="account-field account-field--pin">
              <input
                placeholder="PIN"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>
          <button className="account-btn" type="submit" disabled={busy}>
            Save address
          </button>
        </form>
        </div>
      </div>

      <div className="account-card" id="recent-bookings">
        <h2>Recent bookings</h2>
        {bookings.length === 0 && (
          <p className="account-empty">
            No trips yet. <Link to="/fleet">Browse cars</Link>
          </p>
        )}
        <div className="account-list">
          {bookings.slice(0, 4).map((b) => (
            <Link key={b.id} className="account-item account-item--booking" to={`/account/bookings/${b.publicId}`}>
              <img src={b.carModel?.images?.[0]?.url || "/favicon.ico"} alt="" />
              <div>
                <h3>{b.carModel?.name || b.publicId}</h3>
                <p>
                  {formatDay(b.startsAt)} → {formatDay(b.endsAt)} · {rupees(b.amountPaise)}
                </p>
              </div>
              <span className={`account-pill ${statusTone(b.status)}`}>{prettyStatus(b.status)}</span>
            </Link>
          ))}
        </div>
        {bookings.length > 0 && (
          <p className="account-links">
            <Link to="/account/bookings">View all bookings</Link>
            {invoices.length > 0 && (
              <>
                {" · "}
                <Link to="/account/invoices">Invoices</Link>
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}
