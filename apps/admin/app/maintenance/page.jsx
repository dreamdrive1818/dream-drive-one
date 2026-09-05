"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const EMPTY_JOB = {
  vehicleId: "",
  workshopId: "",
  type: "PREVENTIVE",
  startsAt: "",
  endsAt: "",
  labourPaise: 0,
  notes: "",
  parts: [{ name: "", qty: 1, unitPaise: 0 }],
};

const EMPTY_SHOP = { name: "", address: "", phone: "", cityId: "", active: true };

function rupees(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function partsTotal(parts) {
  return (parts || []).reduce((sum, p) => sum + Number(p.qty || 0) * Number(p.unitPaise || 0), 0);
}

export default function MaintenancePage() {
  const [tab, setTab] = useState("jobs");
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [jobs, setJobs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState(EMPTY_JOB);
  const [shop, setShop] = useState(EMPTY_SHOP);
  const [editingShop, setEditingShop] = useState("");
  const [complete, setComplete] = useState({});

  const roles = me?.roles || [];
  const canWrite = roles.includes("SUPER_ADMIN") || roles.includes("FLEET_OPS") || roles.includes("BRANCH_MANAGER") || roles.includes("CITY_MANAGER");

  function load() {
    api("/v1/me").then(setMe).catch(() => {});
    api(`/v1/admin/maintenance-jobs${status ? `?status=${status}` : ""}`)
      .then(setJobs)
      .catch((e) => setError(e.message));
    api("/v1/admin/vehicles").then(setVehicles).catch(() => {});
    api("/v1/admin/workshops").then(setWorkshops).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => {});
  }
  useEffect(load, [status]);

  const suggested = useMemo(() => Number(form.labourPaise || 0) + partsTotal(form.parts), [form]);

  function setPart(i, patch) {
    const parts = [...form.parts];
    parts[i] = { ...parts[i], ...patch };
    setForm({ ...form, parts });
  }

  async function saveJob(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/maintenance-jobs", {
        method: "POST",
        body: {
          vehicleId: form.vehicleId,
          workshopId: form.workshopId || null,
          type: form.type,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          labourPaise: Number(form.labourPaise) || 0,
          costPaise: suggested,
          notes: form.notes || null,
          parts: (form.parts || []).filter((p) => p.name.trim()),
        },
      });
      setForm(EMPTY_JOB);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function completeJob(id) {
    setError("");
    const row = complete[id] || {};
    try {
      await api(`/v1/admin/maintenance-jobs/${id}/complete`, {
        method: "POST",
        body: {
          odometerKm: Number(row.odometerKm),
          costPaise: row.costPaise != null && row.costPaise !== "" ? Number(row.costPaise) : undefined,
        },
      });
      setComplete((c) => ({ ...c, [id]: {} }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelJob(id) {
    if (!window.confirm("Cancel this workshop job? The car will return to availability if no other open jobs remain.")) return;
    try {
      await api(`/v1/admin/maintenance-jobs/${id}/cancel`, { method: "POST" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveShop(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...shop,
      cityId: shop.cityId || null,
      active: Boolean(shop.active),
    };
    try {
      if (editingShop) await api(`/v1/admin/workshops/${editingShop}`, { method: "PATCH", body });
      else await api("/v1/admin/workshops", { method: "POST", body });
      setShop(EMPTY_SHOP);
      setEditingShop("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h2>Maintenance & workshop</h2>
      <p className="muted">
        Schedule service so search cannot promise a car that is in the bay. Completing a job needs odometer and cost, then the vehicle is AVAILABLE again.
      </p>
      {error && <p className="err">{error}</p>}
      {!canWrite && <p className="muted">Finance can view labour and parts cost. Fleet ops schedule and close jobs.</p>}

      <div className="tabs">
        <button type="button" className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>Jobs</button>
        <button type="button" className={tab === "shops" ? "active" : ""} onClick={() => setTab("shops")}>Workshops</button>
      </div>

      {tab === "jobs" && (
        <>
          {canWrite && (
            <form className="card" onSubmit={saveJob}>
              <h3>Create job</h3>
              <div className="row">
                <label>
                  Vehicle
                  <select required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                    <option value="">Select</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} · {v.carModel?.name} · {v.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Workshop
                  <select value={form.workshopId} onChange={(e) => setForm({ ...form, workshopId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {workshops.filter((w) => w.active).map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="PREVENTIVE">Preventive</option>
                    <option value="BREAKDOWN">Breakdown</option>
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Starts
                  <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </label>
                <label>
                  Ends
                  <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                </label>
                <label>
                  Labour (paise)
                  <input type="number" min="0" value={form.labourPaise} onChange={(e) => setForm({ ...form, labourPaise: e.target.value })} />
                </label>
              </div>
              <p className="muted">Leave dates empty to plan a job. Adding dates writes an availability block immediately. An ongoing trip must be swapped or returned first.</p>
              {(form.parts || []).map((p, i) => (
                <div className="row" key={i}>
                  <label>
                    Part
                    <input value={p.name} onChange={(e) => setPart(i, { name: e.target.value })} placeholder="Oil filter" />
                  </label>
                  <label>
                    Qty
                    <input type="number" min="1" value={p.qty} onChange={(e) => setPart(i, { qty: Number(e.target.value) })} />
                  </label>
                  <label>
                    Unit paise
                    <input type="number" min="0" value={p.unitPaise} onChange={(e) => setPart(i, { unitPaise: Number(e.target.value) })} />
                  </label>
                </div>
              ))}
              <div className="row">
                <button type="button" className="ghost" onClick={() => setForm({ ...form, parts: [...form.parts, { name: "", qty: 1, unitPaise: 0 }] })}>
                  Add part
                </button>
                <span className="muted">Suggested total {rupees(suggested)}</span>
              </div>
              <label>
                Notes
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <button type="submit">Save job</button>
            </form>
          )}

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Jobs</h3>
              <label style={{ margin: 0, width: 180 }}>
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="OPEN">Open</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Slot</th>
                  <th>Workshop</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const closed = j.status === "COMPLETED" || j.status === "CANCELLED";
                  const row = complete[j.id] || { odometerKm: j.vehicle?.odometerKm ?? "", costPaise: j.costPaise };
                  return (
                    <tr key={j.id}>
                      <td>
                        {j.vehicle?.registration}
                        <div className="muted">{j.vehicle?.carModel?.name} · {j.vehicle?.odometerKm} km</div>
                      </td>
                      <td>{j.type}</td>
                      <td>
                        {j.startsAt ? `${new Date(j.startsAt).toLocaleString()} → ${new Date(j.endsAt).toLocaleString()}` : "Unscheduled"}
                      </td>
                      <td>{j.workshop?.name || "—"}</td>
                      <td>
                        {rupees(j.costPaise)}
                        <div className="muted">labour {rupees(j.labourPaise)} · {(j.parts || []).map((p) => `${p.qty}× ${p.name}`).join(", ") || "no parts"}</div>
                      </td>
                      <td>{j.status}</td>
                      <td>
                        {canWrite && !closed && (
                          <div className="stack">
                            <input
                              type="number"
                              min="0"
                              placeholder="Odometer"
                              value={row.odometerKm}
                              onChange={(e) => setComplete((c) => ({ ...c, [j.id]: { ...row, odometerKm: e.target.value } }))}
                            />
                            <input
                              type="number"
                              min="0"
                              placeholder="Cost paise"
                              value={row.costPaise}
                              onChange={(e) => setComplete((c) => ({ ...c, [j.id]: { ...row, costPaise: e.target.value } }))}
                            />
                            <div className="row">
                              <button type="button" onClick={() => completeJob(j.id)}>Complete</button>
                              <button type="button" className="ghost" onClick={() => cancelJob(j.id)}>Cancel</button>
                            </div>
                          </div>
                        )}
                        {j.status === "COMPLETED" && j.odometerKm != null && <span className="muted">{j.odometerKm} km</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {jobs.length === 0 && <p className="muted">No jobs yet.</p>}
          </div>
        </>
      )}

      {tab === "shops" && (
        <>
          {canWrite && (
            <form className="card" onSubmit={saveShop}>
              <h3>{editingShop ? "Edit workshop" : "Add workshop"}</h3>
              <div className="row">
                <label>
                  Name
                  <input required value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} />
                </label>
                <label>
                  Address
                  <input required value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} />
                </label>
                <label>
                  Phone
                  <input value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} />
                </label>
                <label>
                  City
                  <select value={shop.cityId} onChange={(e) => setShop({ ...shop, cityId: e.target.value })}>
                    <option value="">None</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit">{editingShop ? "Save workshop" : "Create workshop"}</button>
              {editingShop && (
                <button type="button" className="ghost" onClick={() => { setEditingShop(""); setShop(EMPTY_SHOP); }}>
                  Cancel
                </button>
              )}
            </form>
          )}
          <div className="card">
            <h3>Workshops</h3>
            <table>
              <thead>
                <tr><th>Name</th><th>Address</th><th>City</th><th>Jobs</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {workshops.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{w.address}</td>
                    <td>{w.city?.name || "—"}</td>
                    <td>{w._count?.jobs ?? 0}</td>
                    <td>{w.active ? "yes" : "no"}</td>
                    <td>
                      {canWrite && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditingShop(w.id);
                            setShop({
                              name: w.name,
                              address: w.address,
                              phone: w.phone || "",
                              cityId: w.cityId || "",
                              active: w.active,
                            });
                          }}
                        >
                          Edit
                        </button>
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
