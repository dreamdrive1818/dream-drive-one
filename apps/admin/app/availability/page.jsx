"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function AvailabilityPage() {
  const [settings, setSettings] = useState({ bufferHours: 3, maxRentalDays: 30 });
  const [vehicles, setVehicles] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState({
    vehicleId: "",
    startsAt: "",
    endsAt: "",
    reason: "maintenance",
  });
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/catalog-settings").then(setSettings).catch((e) => setError(e.message));
    api("/v1/admin/vehicles").then(setVehicles).catch(() => {});
    api("/v1/admin/availability-blocks").then(setBlocks).catch(() => {});
  }
  useEffect(load, []);

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
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Remove this block?")) return;
    try {
      await api(`/v1/admin/availability-blocks/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h2>Availability</h2>
      {error && <p className="err">{error}</p>}

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
        <h3>Block a vehicle</h3>
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
                    <button type="button" className="ghost" onClick={() => remove(b.id)}>Remove</button>
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
