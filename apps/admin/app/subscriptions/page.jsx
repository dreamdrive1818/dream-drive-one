"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const EMPTY = {
  carModelId: "",
  months: 1,
  pricePaise: 5000000,
  includedKm: 1500,
  depositPaise: 1000000,
  maintenanceIncl: true,
  swapAllowed: false,
};

function rupees(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

export default function SubscriptionsPage() {
  const [tab, setTab] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [subs, setSubs] = useState([]);
  const [cars, setCars] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [swap, setSwap] = useState({ id: "", vehicleId: "" });

  function load() {
    api("/v1/admin/subscriptions/plans").then(setPlans).catch((e) => setError(e.message));
    api("/v1/admin/subscriptions").then(setSubs).catch(() => setSubs([]));
    api("/v1/admin/car-models").then(setCars).catch(() => setCars([]));
    api("/v1/admin/vehicles").then(setVehicles).catch(() => setVehicles([]));
  }

  useEffect(load, []);

  async function createPlan(e) {
    e.preventDefault();
    setBusy("plan");
    setError("");
    try {
      await api("/v1/admin/subscriptions/plans", {
        method: "POST",
        body: {
          ...form,
          months: Number(form.months),
          pricePaise: Number(form.pricePaise),
          includedKm: Number(form.includedKm),
          depositPaise: Number(form.depositPaise) || 0,
        },
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function togglePlan(id, active) {
    setBusy(id);
    try {
      await api(`/v1/admin/subscriptions/plans/${id}`, { method: "PATCH", body: { active } });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function act(id, action) {
    setBusy(id);
    setError("");
    try {
      await api(`/v1/admin/subscriptions/${id}/${action}`, { method: "POST", body: {} });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function swapVehicle(e) {
    e.preventDefault();
    if (!swap.id || !swap.vehicleId) return;
    setBusy(swap.id);
    setError("");
    try {
      await api(`/v1/admin/subscriptions/${swap.id}/swap`, {
        method: "POST",
        body: { vehicleId: swap.vehicleId },
      });
      setSwap({ id: "", vehicleId: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h2>Subscriptions</h2>
      <p className="muted">Monthly plans and live subscriptions. Swap / pause / close happen here; the customer pays via the public checkout.</p>
      {error && <p className="err">{error}</p>}
      <div className="tabs">
        <button type="button" className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}>
          Plans
        </button>
        <button type="button" className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>
          Subscriptions
        </button>
      </div>

      {tab === "plans" && (
        <>
          <form className="card" onSubmit={createPlan} style={{ marginBottom: 16 }}>
            <h3>Create plan</h3>
            <div className="row">
              <label>
                Car
                <select value={form.carModelId} onChange={(e) => setForm({ ...form, carModelId: e.target.value })} required>
                  <option value="">Select</option>
                  {(Array.isArray(cars) ? cars : []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Months
                <input type="number" min="1" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} required />
              </label>
              <label>
                Price (paise)
                <input type="number" min="0" value={form.pricePaise} onChange={(e) => setForm({ ...form, pricePaise: e.target.value })} required />
              </label>
              <label>
                Included km
                <input type="number" min="0" value={form.includedKm} onChange={(e) => setForm({ ...form, includedKm: e.target.value })} required />
              </label>
              <label>
                Deposit (paise)
                <input type="number" min="0" value={form.depositPaise} onChange={(e) => setForm({ ...form, depositPaise: e.target.value })} />
              </label>
            </div>
            <div className="row">
              <label className="row">
                <input type="checkbox" checked={form.maintenanceIncl} onChange={(e) => setForm({ ...form, maintenanceIncl: e.target.checked })} style={{ width: "auto" }} />
                Maintenance included
              </label>
              <label className="row">
                <input type="checkbox" checked={form.swapAllowed} onChange={(e) => setForm({ ...form, swapAllowed: e.target.checked })} style={{ width: "auto" }} />
                Swap allowed
              </label>
              <button type="submit" disabled={busy === "plan"}>{busy === "plan" ? "Saving…" : "Create plan"}</button>
            </div>
          </form>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Car</th>
                  <th>Months</th>
                  <th>Price</th>
                  <th>Km</th>
                  <th>Subs</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(plans) ? plans : []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.carModel?.name}</td>
                    <td>{p.months}</td>
                    <td>{rupees(p.pricePaise)}</td>
                    <td>{p.includedKm}</td>
                    <td>{p._count?.subscriptions ?? 0}</td>
                    <td>{p.active ? "Yes" : "No"}</td>
                    <td>
                      <button className="ghost" type="button" disabled={busy === p.id} onClick={() => togglePlan(p.id, !p.active)}>
                        {p.active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "live" && (
        <>
          <form className="card" onSubmit={swapVehicle} style={{ marginBottom: 16 }}>
            <h3>Swap vehicle</h3>
            <div className="row">
              <label>
                Subscription
                <select value={swap.id} onChange={(e) => setSwap({ ...swap, id: e.target.value })}>
                  <option value="">Select</option>
                  {(subs || []).filter((s) => s.status === "ACTIVE").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.booking?.publicId || s.id} · {s.plan?.carModel?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vehicle
                <select value={swap.vehicleId} onChange={(e) => setSwap({ ...swap, vehicleId: e.target.value })}>
                  <option value="">Select</option>
                  {(Array.isArray(vehicles) ? vehicles : []).map((v) => (
                    <option key={v.id} value={v.id}>{v.registration}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy === swap.id}>Swap</button>
            </div>
          </form>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(subs) ? subs : []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.booking?.publicId}</td>
                    <td>{s.plan?.carModel?.name} · {s.plan?.months} mo</td>
                    <td>{s.status}</td>
                    <td>{s.booking?.vehicle?.registration || "—"}</td>
                    <td className="row">
                      {s.status === "ACTIVE" && (
                        <button className="ghost" type="button" disabled={Boolean(busy)} onClick={() => act(s.id, "pause")}>Pause</button>
                      )}
                      {s.status === "PAUSED" && (
                        <button className="ghost" type="button" disabled={Boolean(busy)} onClick={() => act(s.id, "resume")}>Resume</button>
                      )}
                      {s.status !== "CLOSED" && s.status !== "COMPLETED" && (
                        <button className="danger" type="button" disabled={Boolean(busy)} onClick={() => act(s.id, "close")}>Close</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
