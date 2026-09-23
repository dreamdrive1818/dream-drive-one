"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default function AvailabilityPage() {
  const [settings, setSettings] = useState({ bufferHours: 3, maxRentalDays: 30 });
  const [vehicles, setVehicles] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [calendar, setCalendar] = useState(null);
  const [form, setForm] = useState({
    vehicleId: "",
    startsAt: "",
    endsAt: "",
    reason: "maintenance",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function loadBase() {
    api("/v1/admin/catalog-settings").then(setSettings).catch((e) => setError(e.message));
    api("/v1/admin/vehicles").then((rows) => {
      setVehicles(rows);
      if (!vehicleId && rows[0]) setVehicleId(rows[0].id);
    }).catch(() => {});
    api("/v1/admin/availability-blocks").then(setBlocks).catch(() => {});
  }

  async function loadCalendar(id = vehicleId, m = month) {
    if (!id) {
      setCalendar(null);
      return;
    }
    try {
      const data = await api(`/v1/admin/availability-calendar?vehicleId=${id}&month=${m}`);
      setCalendar(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(loadBase, []);
  useEffect(() => {
    loadCalendar();
  }, [vehicleId, month]);

  const calendarCells = useMemo(() => {
    if (!calendar?.month) return [];
    const [y, mo] = calendar.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const startPad = first.getUTCDay();
    const byDate = Object.fromEntries((calendar.days || []).map((d) => [d.date, d]));
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (const day of calendar.days || []) {
      cells.push(byDate[day.date]);
    }
    return cells;
  }, [calendar]);

  async function saveSettings(e) {
    e.preventDefault();
    setError("");
    try {
      const saved = await api("/v1/admin/catalog-settings", {
        method: "PUT",
        body: {
          bufferHours: Number(settings.bufferHours),
          maxRentalDays: Number(settings.maxRentalDays),
        },
      });
      setSettings(saved);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createBlock(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/availability-blocks", {
        method: "POST",
        body: {
          vehicleId: form.vehicleId,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          reason: form.reason,
        },
      });
      setForm({ ...form, startsAt: "", endsAt: "", reason: "maintenance" });
      loadBase();
      if (form.vehicleId === vehicleId) loadCalendar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this block?")) return;
    try {
      await api(`/v1/admin/availability-blocks/${id}`, { method: "DELETE" });
      loadBase();
      loadCalendar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDay(day) {
    if (!day?.canToggle || !vehicleId || busy) return;
    setBusy(true);
    setError("");
    try {
      if (day.status === "available") {
        await api("/v1/admin/availability-blocks/day", {
          method: "POST",
          body: { vehicleId, date: day.date, reason: "blocked" },
        });
      } else if (day.status === "blocked") {
        await api("/v1/admin/availability-blocks/day/unblock", {
          method: "POST",
          body: { vehicleId, date: day.date },
        });
      }
      await loadCalendar();
      loadBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setVehicleStatus(status) {
    if (!vehicleId) return;
    setError("");
    setBusy(true);
    try {
      await api(`/v1/admin/vehicles/${vehicleId}`, {
        method: "PATCH",
        body: { status },
      });
      await loadCalendar();
      loadBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = vehicles.find((v) => v.id === vehicleId);
  const vehicleStatus = calendar?.vehicle?.status || selected?.status || "";

  return (
    <div className="stack">
      <h2>Availability calendar</h2>
      <p className="muted">
        Tap a day to block or unblock. Bookings and holds stay unavailable until released from the booking.
      </p>
      {error && <p className="err">{error}</p>}

      <div className="card">
        <h3>Vehicle calendar</h3>
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ flex: 1, minWidth: 220 }}>
            Vehicle
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration} · {v.carModel?.name} · {v.branch?.city?.name || v.branch?.name} · {v.status}
                </option>
              ))}
            </select>
          </label>
          <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
            <button type="button" className="ghost" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              ‹
            </button>
            <strong style={{ fontSize: 16, minWidth: 140, textAlign: "center" }}>{monthLabel(month)}</strong>
            <button type="button" className="ghost" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              ›
            </button>
          </div>
        </div>

        {vehicleId && (
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="muted">Vehicle status: <strong style={{ color: "var(--text)" }}>{vehicleStatus}</strong></span>
            {vehicleStatus === "AVAILABLE" && (
              <button type="button" className="ghost" disabled={busy} onClick={() => setVehicleStatus("BLOCKED")}>
                Block vehicle
              </button>
            )}
            {vehicleStatus === "BLOCKED" && (
              <button type="button" disabled={busy} onClick={() => setVehicleStatus("AVAILABLE")}>
                Unblock vehicle
              </button>
            )}
          </div>
        )}

        <div className="avail-cal-week">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="avail-cal-grid">
          {calendarCells.map((day, i) => {
            if (!day) return <span key={`e-${i}`} className="avail-cal-empty" />;
            const dayNum = Number(day.date.slice(-2));
            return (
              <button
                key={day.date}
                type="button"
                disabled={!day.canToggle || busy}
                title={day.reason || day.status}
                className={`avail-cal-day is-${day.status} ${day.canToggle ? "is-toggle" : ""}`}
                onClick={() => toggleDay(day)}
              >
                <span className="avail-cal-num">{dayNum}</span>
                <span className="avail-cal-status">{day.status}</span>
              </button>
            );
          })}
        </div>

        <div className="avail-cal-legend">
          <span><i className="dot available" /> Available</span>
          <span><i className="dot blocked" /> Blocked (manual — click to unblock)</span>
          <span><i className="dot unavailable" /> Unavailable (booking / hold / maintenance)</span>
        </div>
      </div>

      <form className="card" onSubmit={saveSettings}>
        <h3>Buffer & rental caps</h3>
        <p className="muted">Buffer hours sit between drop-off and the next pickup so the car can be prepped.</p>
        <div className="row">
          <label>
            Buffer hours
            <input
              type="number"
              min="0"
              max="72"
              value={settings.bufferHours}
              onChange={(e) => setSettings({ ...settings, bufferHours: e.target.value })}
            />
          </label>
          <label>
            Max rental days
            <input
              type="number"
              min="1"
              max="365"
              value={settings.maxRentalDays}
              onChange={(e) => setSettings({ ...settings, maxRentalDays: e.target.value })}
            />
          </label>
        </div>
        <button type="submit">Save settings</button>
      </form>

      <form className="card" onSubmit={createBlock}>
        <h3>Block a date range</h3>
        <div className="row">
          <label>
            Vehicle
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration} · {v.carModel?.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label>
            To
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </label>
          <label>
            Reason
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <button type="submit">Add block</button>
      </form>

      <div className="card">
        <h3>Current blocks</h3>
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id}>
                <td>{b.vehicle?.registration} · {b.vehicle?.carModel?.name}</td>
                <td>{new Date(b.startsAt).toLocaleString()}</td>
                <td>{new Date(b.endsAt).toLocaleString()}</td>
                <td>{b.reason}</td>
                <td>
                  {String(b.reason).startsWith("HOLD:") || String(b.reason).startsWith("BOOKING:") ? (
                    <span className="muted">booking</span>
                  ) : (
                    <button type="button" className="ghost" onClick={() => remove(b.id)}>Unblock</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
