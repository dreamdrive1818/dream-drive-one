"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "LOST"];
const SOURCES = ["web", "contact", "whatsapp", "phone", "zoho", "ads", "referral", "walk-in"];
const RENTAL_TYPES = [
  "SELF_DRIVE",
  "WITH_DRIVER_LOCAL",
  "WITH_DRIVER_INTERCITY",
  "AIRPORT",
  "OUTSTATION",
  "ONE_WAY",
];

function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LeadsPage() {
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [cars, setCars] = useState([]);
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [reminderDue, setReminderDue] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [convert, setConvert] = useState({
    city: "",
    startsAt: "",
    endsAt: "",
    carModelId: "",
    rentalType: "SELF_DRIVE",
  });

  function load() {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (sourceFilter) qs.set("source", sourceFilter);
    if (reminderDue) qs.set("reminderDue", "1");
    if (q.trim()) qs.set("q", q.trim());
    api(`/v1/admin/leads${qs.toString() ? `?${qs}` : ""}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api("/v1/admin/users?staff=1")
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items || [];
        setStaff(
          list.filter((u) =>
            (u.roles || []).some((r) => ["SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN"].includes(r))
          )
        );
      })
      .catch(() => setStaff([]));
    api("/v1/admin/car-models")
      .then((data) => setCars(Array.isArray(data) ? data : []))
      .catch(() => setCars([]));
    api("/v1/admin/cities")
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, []);

  useEffect(load, [statusFilter, sourceFilter, reminderDue]);

  async function openLead(id) {
    setError("");
    try {
      const lead = await api(`/v1/admin/leads/${id}`);
      setOpen(lead);
      setConvert({
        city: lead.city || "",
        startsAt: "",
        endsAt: "",
        carModelId: "",
        rentalType: "SELF_DRIVE",
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function patch(id, body) {
    setBusy(true);
    setError("");
    try {
      const next = await api(`/v1/admin/leads/${id}`, { method: "PATCH", body });
      setOpen(next);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const next = await api(`/v1/admin/leads/${open.id}/notes`, { method: "POST", body: { note } });
      setNote("");
      setOpen(next);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function convertLead(e) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(`/v1/admin/leads/${open.id}/convert`, {
        method: "POST",
        body: {
          city: convert.city,
          startsAt: new Date(convert.startsAt).toISOString(),
          endsAt: new Date(convert.endsAt).toISOString(),
          carModelId: convert.carModelId,
          rentalType: convert.rentalType,
        },
      });
      setOpen(result.lead || result);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const overdue = (l) =>
    l.remindAt && !l.remindedAt && new Date(l.remindAt) < new Date() && l.status !== "BOOKED" && l.status !== "LOST";

  return (
    <div>
      <h2>Leads</h2>
      <p className="muted">
        Pipeline NEW → CONTACTED → QUALIFIED → BOOKED / LOST. Assign an owner, set a reminder, convert with city + dates.
      </p>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Search name / email / phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ maxWidth: 240 }}
        />
        <label className="row" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={reminderDue}
            onChange={(e) => setReminderDue(e.target.checked)}
            style={{ width: "auto" }}
          />
          Reminder due
        </label>
        <button className="ghost" type="button" onClick={load}>
          Search
        </button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>City</th>
              <th>Status</th>
              <th>Source</th>
              <th>Owner</th>
              <th>Reminder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>
                  {l.email || "—"}
                  <br />
                  <span className="muted">{l.phone || "no phone"}</span>
                </td>
                <td>{l.city || "—"}</td>
                <td>{l.status}</td>
                <td>{l.source}</td>
                <td>{l.assignedTo?.profile?.fullName || l.assignedTo?.email || "Unassigned"}</td>
                <td>{overdue(l) ? "Due" : l.remindAt ? new Date(l.remindAt).toLocaleString("en-IN") : "—"}</td>
                <td>
                  <button className="ghost" type="button" onClick={() => openLead(l.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!(rows || []).length && (
              <tr>
                <td colSpan={8} className="muted">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="card">
          <h3>{open.name || open.email}</h3>
          <p className="muted">
            {open.email || "no email"} · {open.phone || "no phone"} · {open.source || "web"}
            {open.city ? ` · ${open.city}` : ""}
            {open.booking?.publicId ? ` · booking ${open.booking.publicId}` : ""}
          </p>
          <div className="row" style={{ marginBottom: 12 }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={open.status === s ? "" : "ghost"}
                disabled={busy}
                onClick={() => patch(open.id, { status: s })}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="row">
            <label>
              Assign owner
              <select
                value={open.assignedToId || ""}
                onChange={(e) => patch(open.id, { assignedToId: e.target.value || null })}
                disabled={busy}
              >
                <option value="">Unassigned</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.profile?.fullName || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reminder
              <input
                type="datetime-local"
                value={toLocalInput(open.remindAt)}
                onChange={(e) => patch(open.id, { remindAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                disabled={busy}
              />
            </label>
            <label>
              City
              <select
                value={open.city || ""}
                onChange={(e) => patch(open.id, { city: e.target.value || null })}
                disabled={busy}
              >
                <option value="">Not set</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {open.status !== "BOOKED" && open.status !== "LOST" && (
            <form onSubmit={convertLead} style={{ marginTop: 16 }}>
              <h3>Convert to booking</h3>
              <p className="muted">Creates a priced quote and HOLD booking. Needs city, dates, and a car.</p>
              <div className="row">
                <label>
                  City
                  <select
                    value={convert.city}
                    onChange={(e) => setConvert({ ...convert, city: e.target.value })}
                    required
                  >
                    <option value="">Select</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Car
                  <select
                    value={convert.carModelId}
                    onChange={(e) => setConvert({ ...convert, carModelId: e.target.value })}
                    required
                  >
                    <option value="">Select</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rental type
                  <select
                    value={convert.rentalType}
                    onChange={(e) => setConvert({ ...convert, rentalType: e.target.value })}
                  >
                    {RENTAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Starts
                  <input
                    type="datetime-local"
                    value={convert.startsAt}
                    onChange={(e) => setConvert({ ...convert, startsAt: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Ends
                  <input
                    type="datetime-local"
                    value={convert.endsAt}
                    onChange={(e) => setConvert({ ...convert, endsAt: e.target.value })}
                    required
                  />
                </label>
              </div>
              <button type="submit" disabled={busy}>
                Convert to booking
              </button>
            </form>
          )}

          {open.booking?.id && (
            <p>
              Converted:{" "}
              <Link href={`/bookings/${open.booking.id}`}>{open.booking.publicId || open.booking.id}</Link>
            </p>
          )}

          <h3>Notes</h3>
          {(open.activities || []).map((a) => (
            <p key={a.id} className="muted">
              {a.note}
              <br />
              {a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN") : ""}
            </p>
          ))}
          {!(open.activities || []).length && <p className="muted">No notes yet.</p>}
          <form onSubmit={addNote}>
            <label>
              Add note
              <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
            </label>
            <button type="submit" disabled={busy}>
              Save note
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
