"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const RENTAL_TYPES = [
  "",
  "SELF_DRIVE",
  "WITH_DRIVER_LOCAL",
  "WITH_DRIVER_INTERCITY",
  "AIRPORT",
  "OUTSTATION",
  "ONE_WAY",
  "TOUR_PACKAGE",
  "SUBSCRIPTION",
];

const emptyForm = () => ({
  code: "",
  type: "PERCENT",
  value: "10",
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 16),
  maxRedemptions: "",
  cityId: "",
  rentalType: "",
  minDays: "",
});

export default function Page() {
  const [rows, setRows] = useState([]);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());

  function load() {
    api("/v1/admin/offers")
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api("/v1/admin/cities")
      .then((list) => setCities(Array.isArray(list) ? list : []))
      .catch(() => undefined);
  }, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/admin/offers", {
        method: "POST",
        body: {
          code: form.code,
          type: form.type,
          value: Number(form.value),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          cityId: form.cityId || null,
          rentalType: form.rentalType || null,
          minDays: form.minDays ? Number(form.minDays) : null,
        },
      });
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(id, active) {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/offers/${id}`, { method: "PATCH", body: { active } });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Offers</h2>
      <p className="muted">
        Percent or flat codes with date window, optional city / product / min days. Freeze abusive codes
        without deleting history.
      </p>
      {error && <p className="err">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Create offer</h3>
        <form onSubmit={create} className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            required
            placeholder="CODE"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="PERCENT">PERCENT</option>
            <option value="FLAT">FLAT (paise)</option>
          </select>
          <input
            required
            type="number"
            min="1"
            placeholder="Value"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
          />
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
          />
          <input
            type="number"
            min="1"
            placeholder="Max redemptions"
            value={form.maxRedemptions}
            onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
          />
          <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={form.rentalType}
            onChange={(e) => setForm({ ...form, rentalType: e.target.value })}
          >
            {RENTAL_TYPES.map((t) => (
              <option key={t || "all"} value={t}>
                {t || "All products"}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            placeholder="Min days"
            value={form.minDays}
            onChange={(e) => setForm({ ...form, minDays: e.target.value })}
          />
          <button type="submit" disabled={busy}>
            Create
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Window</th>
              <th>Scope</th>
              <th>Redemptions</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((o) => (
              <tr key={o.id}>
                <td>{o.code}</td>
                <td>{o.type}</td>
                <td>{o.type === "PERCENT" ? `${o.value}%` : `₹${(o.value / 100).toLocaleString("en-IN")}`}</td>
                <td className="muted">
                  {new Date(o.startsAt).toLocaleDateString("en-IN")} –{" "}
                  {new Date(o.endsAt).toLocaleDateString("en-IN")}
                </td>
                <td className="muted">
                  {[o.city?.name || "All cities", o.rentalType || "All products", o.minDays ? `≥${o.minDays}d` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
                <td>
                  {o.redemptions?.length ?? 0}
                  {o.maxRedemptions != null ? ` / ${o.maxRedemptions}` : ""}
                </td>
                <td>{o.active ? "Active" : "Frozen"}</td>
                <td>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => setActive(o.id, !o.active)}
                  >
                    {o.active ? "Freeze" : "Unfreeze"}
                  </button>
                </td>
              </tr>
            ))}
            {!(rows || []).length && (
              <tr>
                <td colSpan={8} className="muted">
                  No offers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
