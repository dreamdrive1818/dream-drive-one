"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const STATUSES = [
  "",
  "HOLD",
  "AWAITING_PAYMENT",
  "AWAITING_KYC",
  "AWAITING_SIGNATURE",
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const RENTAL_TYPES = [
  "SELF_DRIVE",
  "WITH_DRIVER_LOCAL",
  "WITH_DRIVER_INTERCITY",
  "AIRPORT",
  "OUTSTATION",
  "ONE_WAY",
];

function rupees(paise) {
  return `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;
}

export default function BookingsPage() {
  const [rows, setRows] = useState([]);
  const [cars, setCars] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    customerEmail: "customer@dreamdrive.test",
    carModelId: "",
    rentalType: "SELF_DRIVE",
    startsAt: "",
    endsAt: "",
    comped: false,
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    api(`/v1/admin/bookings${params.toString() ? `?${params}` : ""}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api("/v1/admin/car-models").then(setCars).catch(() => undefined);
  }, [status]);

  async function createBooking(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api("/v1/admin/bookings", {
        method: "POST",
        body: {
          customerEmail: form.customerEmail,
          carModelId: form.carModelId,
          rentalType: form.rentalType,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          notes: form.notes || undefined,
          comped: form.comped,
        },
      });
      setShowCreate(false);
      window.location.href = `/bookings/${created.id}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Bookings</h2>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <input
          placeholder="Search id / email / phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ maxWidth: 260 }}
        />
        <button className="ghost" type="button" onClick={load}>Search</button>
        <button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Close" : "Create booking"}
        </button>
      </div>

      {showCreate && (
        <form className="card" onSubmit={createBooking} style={{ marginBottom: 16 }}>
          <h3>Create on behalf of customer</h3>
          <div className="row">
            <label>
              Customer email
              <input
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                required
              />
            </label>
            <label>
              Car
              <select
                value={form.carModelId}
                onChange={(e) => setForm({ ...form, carModelId: e.target.value })}
                required
              >
                <option value="">Select</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Rental type
              <select
                value={form.rentalType}
                onChange={(e) => setForm({ ...form, rentalType: e.target.value })}
              >
                {RENTAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              Starts
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </label>
            <label>
              Ends
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </label>
            <label>
              Notes
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={form.comped}
              onChange={(e) => setForm({ ...form, comped: e.target.checked })}
              style={{ width: "auto" }}
            />
            Comp token (skip payment)
          </label>
          <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Car</th>
              <th>Type</th>
              <th>When</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/bookings/${b.id}`}>{b.publicId}</Link></td>
                <td>{b.user?.email}</td>
                <td>{b.carModel?.name || "—"}</td>
                <td>{b.rentalType}</td>
                <td>{new Date(b.startsAt).toLocaleString("en-IN")}</td>
                <td>{rupees(b.amountPaise)}</td>
                <td>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
