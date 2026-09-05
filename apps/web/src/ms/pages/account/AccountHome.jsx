"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { formatDay, prettyStatus, rupees, statusTone } from "./format";

export default function AccountHome() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
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
    api("/v1/me/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

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

  return (
    <>
      <h1>Hi {user?.fullName || "there"}</h1>
      <p className="account-lead">
        Manage your profile, trips, KYC, invoices, and support from one place.
      </p>
      {error && <p className="account-msg err">{error}</p>}
      {info && <p className="account-msg ok">{info}</p>}
      {(data?.subscriptions || []).some((s) => s.swapDueReason === "SERVICE") && (
        <p className="account-msg warn">
          Your car is due for a service swap. We will move you to another vehicle of the same class — fleet ops will confirm the replacement.
        </p>
      )}

      <div className="account-grid">
        <div className="account-stat">
          <span>KYC</span>
          <strong className={`account-pill ${statusTone(user?.kycStatus)}`}>
            {prettyStatus(user?.kycStatus)}
          </strong>
        </div>
        <div className="account-stat">
          <span>Bookings</span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="account-stat">
          <span>Wallet</span>
          <strong>{rupees(data?.wallet?.balancePaise)}</strong>
        </div>
        <div className="account-stat">
          <span>Open tickets</span>
          <strong>{tickets.filter((t) => t.status === "OPEN" || t.status === "PENDING").length}</strong>
        </div>
      </div>

      <div className="account-card" style={{ marginBottom: 16 }}>
        <h2>Profile</h2>
        {user?.nameLocked && (
          <p className="account-hint">
            Your name is locked to the approved KYC record. Support can update it if needed.
          </p>
        )}
        <form onSubmit={saveProfile}>
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

      <div className="account-card" style={{ marginBottom: 16 }}>
        <h2>Addresses</h2>
        {(user?.addresses || []).length === 0 && <p className="account-empty">No saved addresses yet.</p>}
        <ul className="account-list">
          {(user?.addresses || []).map((a) => (
            <li key={a.id} className="account-item" style={{ gridTemplateColumns: "1fr auto" }}>
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
          <div className="account-row">
            <div className="account-field" style={{ flex: 1 }}>
              <input
                placeholder="City"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
              />
            </div>
            <div className="account-field" style={{ flex: 1 }}>
              <input
                placeholder="State"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
              />
            </div>
            <div className="account-field" style={{ width: 120 }}>
              <input
                placeholder="PIN"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
          </div>
          <button className="account-btn ghost" type="submit" disabled={busy}>
            Save address
          </button>
        </form>
      </div>

      <div className="account-card">
        <h2>Recent bookings</h2>
        {bookings.length === 0 && (
          <p className="account-empty">
            No trips yet. <Link to="/fleet">Browse cars</Link>
          </p>
        )}
        <div className="account-list">
          {bookings.slice(0, 4).map((b) => (
            <Link key={b.id} className="account-item" to={`/account/bookings/${b.publicId}`}>
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
          <p style={{ marginTop: 12 }}>
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
