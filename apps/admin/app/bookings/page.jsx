"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function heatClass(count, max) {
  if (!count) return "is-occ-0";
  if (!max) return "is-occ-1";
  const ratio = count / max;
  if (ratio >= 0.75) return "is-occ-3";
  if (ratio >= 0.4) return "is-occ-2";
  return "is-occ-1";
}

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

function customerName(user) {
  return user?.profile?.fullName?.trim() || "";
}

function StatusPill({ status }) {
  if (!status) return "—";
  return <span className={`status-pill status-${status}`}>{String(status).replace(/_/g, " ")}</span>;
}

export default function BookingsPage() {
  const [rows, setRows] = useState([]);
  const [cars, setCars] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [calendar, setCalendar] = useState(null);
  const [onDate, setOnDate] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "customer@dreamdrive.test",
    carModelId: "",
    rentalType: "SELF_DRIVE",
    startsAt: "",
    endsAt: "",
    comped: false,
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCal, setLoadingCal] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "grid";
    if (window.matchMedia("(max-width: 960px)").matches) return "grid";
    const saved = localStorage.getItem("dd_bookings_view");
    return saved === "grid" || saved === "list" ? saved : "list";
  });
  const pageSize = 100;

  function load(nextPage = page) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (onDate) params.set("onDate", onDate);
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    api(`/v1/admin/bookings?${params}`)
      .then((res) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setRows(items);
        setTotal(Array.isArray(res) ? items.length : res.total || 0);
        setPages(Array.isArray(res) ? 1 : res.pages || 1);
        setPage(Array.isArray(res) ? 1 : res.page || nextPage);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadCalendar(m = month) {
    setLoadingCal(true);
    api(`/v1/admin/bookings/calendar?month=${m}`)
      .then(setCalendar)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingCal(false));
  }

  useEffect(() => {
    api("/v1/admin/car-models").then(setCars).catch(() => undefined);
    const phone = window.matchMedia("(max-width: 960px)");
    function apply(mobile) {
      if (mobile) {
        const saved = localStorage.getItem("dd_bookings_view_m");
        setView(saved === "list" ? "list" : "grid");
        return;
      }
      const saved = localStorage.getItem("dd_bookings_view");
      setView(saved === "grid" || saved === "list" ? saved : "list");
    }
    apply(phone.matches);
    function onChange(e) {
      apply(e.matches);
    }
    phone.addEventListener("change", onChange);
    return () => phone.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    load(page);
  }, [status, onDate, page]);

  useEffect(() => {
    loadCalendar(month);
  }, [month]);

  const calendarCells = useMemo(() => {
    const key = calendar?.month || month;
    const [y, mo] = key.split("-").map(Number);
    const startPad = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
    const byDate = Object.fromEntries((calendar?.days || []).map((d) => [d.date, d]));
    const n = calendar?.days?.length || new Date(y, mo, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= n; d += 1) {
      const date = `${key}-${String(d).padStart(2, "0")}`;
      cells.push(byDate[date] || { date, count: 0, bookings: [] });
    }
    return cells;
  }, [calendar, month]);

  const peakCount = calendar?.peak?.count || 0;

  function pickDay(date) {
    setPage(1);
    setOnDate((cur) => (cur === date ? "" : date));
  }

  function setViewMode(next) {
    setView(next);
    try {
      const key = window.matchMedia("(max-width: 960px)").matches
        ? "dd_bookings_view_m"
        : "dd_bookings_view";
      localStorage.setItem(key, next);
    } catch { /* ignore */ }
  }

  async function createBooking(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api("/v1/admin/bookings", {
        method: "POST",
        body: {
          customerEmail: form.customerEmail,
          customerName: form.customerName || undefined,
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

      <div className="bookings-toolbar">
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>{s || "All statuses"}</option>
              ))}
            </select>
            <input
              placeholder="Search id / name / email / phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (page !== 1) setPage(1);
                  else load(1);
                }
              }}
              style={{ maxWidth: 260 }}
            />
            <button
              className="ghost"
              type="button"
              onClick={() => {
                if (page !== 1) setPage(1);
                else load(1);
              }}
            >
              Search
            </button>
            <button type="button" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Close" : "Create booking"}
            </button>
            <div className="view-toggle" role="group" aria-label="Layout">
              <button
                type="button"
                className={view === "list" ? "is-active" : "ghost"}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
              <button
                type="button"
                className={view === "grid" ? "is-active" : "ghost"}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>
            </div>
          </div>

          {onDate && (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="muted">
                Showing bookings on <strong>{onDate}</strong>
              </span>
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setPage(1);
                  setOnDate("");
                }}
              >
                Clear date
              </button>
            </div>
          )}

          {showCreate && (
            <form className="card" onSubmit={createBooking} style={{ marginBottom: 16 }}>
              <h3>Create on behalf of customer</h3>
              <div className="row">
                <label>
                  Customer name
                  <input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    placeholder="Full name"
                  />
                </label>
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

          {view === "grid" ? (
            <div className="booking-grid">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={`gskel-${i}`} className="card booking-card">
                    <span className="skel" />
                    <span className="skel" style={{ width: "70%", marginTop: 10 }} />
                    <span className="skel" style={{ width: "50%", marginTop: 10 }} />
                  </div>
                ))
              ) : rows.length ? (
                rows.map((b) => (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="card booking-card">
                    <div className="row" style={{ justifyContent: "space-between", margin: 0 }}>
                      <strong className="booking-card-id">{b.publicId}</strong>
                      <StatusPill status={b.status} />
                    </div>
                    <p className="booking-card-name">{customerName(b.user) || "—"}</p>
                    <p className="muted">{b.user?.email || ""}</p>
                    <p>{b.carModel?.name || "—"}</p>
                    <p className="muted">{b.rentalType.replace(/_/g, " ")}</p>
                    <div className="row" style={{ justifyContent: "space-between", margin: "8px 0 0" }}>
                      <span className="muted">{new Date(b.startsAt).toLocaleString("en-IN")}</span>
                      <span>{rupees(b.amountPaise)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="muted">No bookings</p>
              )}
            </div>
          ) : (
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
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={`skel-${i}`}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j}><span className="skel" /></td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length ? (
                    rows.map((b) => (
                      <tr key={b.id}>
                        <td><Link href={`/bookings/${b.id}`}>{b.publicId}</Link></td>
                        <td>
                          <div>{customerName(b.user) || "—"}</div>
                          <div className="muted">{b.user?.email || ""}</div>
                        </td>
                        <td>{b.carModel?.name || "—"}</td>
                        <td>{b.rentalType}</td>
                        <td>{new Date(b.startsAt).toLocaleString("en-IN")}</td>
                        <td>{rupees(b.amountPaise)}</td>
                        <td><StatusPill status={b.status} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="muted">No bookings</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="pager">
              <span className="muted">
                {loading
                  ? "Loading bookings…"
                  : total
                    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
                    : "No bookings"}
              </span>
              {pages > 1 && (
                <div className="row" style={{ margin: 0 }}>
                  <button
                    className="ghost"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span className="muted">Page {page} / {pages}</span>
                  <button
                    className="ghost"
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

        <div className="card bookings-cal">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>Cars booked</h3>
            <div className="row" style={{ margin: 0 }}>
              <button className="ghost" type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))}>←</button>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{monthLabel(month)}</span>
              <button className="ghost" type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))}>→</button>
            </div>
          </div>
          {loadingCal && !calendar ? (
            <div className="dd-loading"><i className="dd-spinner" /> Loading calendar…</div>
          ) : null}
          {calendar?.peak?.count > 0 && (
            <p className="muted" style={{ marginTop: 0 }}>
              Peak {calendar.peak.date}: {calendar.peak.count} car{calendar.peak.count === 1 ? "" : "s"}
            </p>
          )}
          <div className="avail-cal-week">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>
          <div className="avail-cal-grid">
            {calendarCells.map((day, i) => {
              if (!day) return <span key={`e-${i}`} className="avail-cal-empty" />;
              const dayNum = Number(day.date.slice(-2));
              const selected = onDate === day.date;
              const title = day.count
                ? day.bookings.map((b) => `${b.car} · ${b.publicId}`).join("\n")
                : "No cars booked";
              return (
                <button
                  key={day.date}
                  type="button"
                  title={title}
                  className={`avail-cal-day is-toggle ${heatClass(day.count, peakCount)}${selected ? " is-selected" : ""}`}
                  onClick={() => pickDay(day.date)}
                >
                  <span className="avail-cal-num">{dayNum}</span>
                  <span className="avail-cal-status">
                    {day.count ? `${day.count}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="avail-cal-legend">
            <span><i className="dot occ-0" /> None</span>
            <span><i className="dot occ-1" /> Light</span>
            <span><i className="dot occ-2" /> Busy</span>
            <span><i className="dot occ-3" /> Peak</span>
          </div>
        </div>
      </div>
    </div>
  );
}
