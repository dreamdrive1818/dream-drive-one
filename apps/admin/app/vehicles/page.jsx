"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const EMPTY = {
  registration: "",
  carModelId: "",
  branchId: "",
  year: "",
  color: "",
  odometerKm: "",
  ownerType: "COMPANY",
  partnerId: "",
  status: "AVAILABLE",
};

const STATUSES = ["AVAILABLE", "ON_TRIP", "MAINTENANCE", "BLOCKED", "SOLD"];
const DOC_KINDS = ["RC", "INSURANCE", "PUC", "PERMIT", "FITNESS"];

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function expiryLabel(expiresAt) {
  const days = daysLeft(expiresAt);
  if (days == null) return "—";
  if (days < 0) return `Expired ${Math.abs(days)}d`;
  if (days === 0) return "Expires today";
  return `${days}d`;
}

export default function VehiclesPage() {
  const [tab, setTab] = useState("vehicles");
  const [rows, setRows] = useState([]);
  const [models, setModels] = useState([]);
  const [cities, setCities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [partners, setPartners] = useState([]);
  const [expiries, setExpiries] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState({ status: "", branchId: "", q: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState({ kind: "INSURANCE", url: "", expiresAt: "", file: null });
  const [transfer, setTransfer] = useState({ branchId: "", odometerKm: "", notes: "" });
  const [transfers, setTransfers] = useState([]);
  const [cityForm, setCityForm] = useState({ name: "", slug: "", state: "" });
  const [branchForm, setBranchForm] = useState({ cityId: "", name: "", address: "" });
  const [contract, setContract] = useState({ partnerId: "", startsOn: "", endsOn: "" });

  function load() {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.q) params.set("q", filter.q);
    const qs = params.toString() ? `?${params}` : "";
    api(`/v1/admin/vehicles${qs}`).then(setRows).catch((e) => setError(e.message));
    api("/v1/admin/car-models").then(setModels).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => {});
    api("/v1/admin/branches").then(setBranches).catch(() => {});
    api("/v1/admin/partners").then(setPartners).catch(() => setPartners([]));
    api("/v1/admin/vehicles/expiries?days=30").then(setExpiries).catch(() => {});
    api("/v1/admin/vehicle-transfers?status=PENDING").then(setTransfers).catch(() => setTransfers([]));
  }

  useEffect(load, [filter.status, filter.branchId]);

  async function loadDetail(id) {
    try {
      const row = await api(`/v1/admin/vehicles/${id}`);
      setDetail(row);
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      registration: row.registration || "",
      carModelId: row.carModelId || "",
      branchId: row.branchId || "",
      year: row.year ?? "",
      color: row.color || "",
      odometerKm: row.odometerKm ?? "",
      ownerType: row.ownerType || "COMPANY",
      partnerId: row.partnerId || "",
      status: row.status || "AVAILABLE",
    });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = {
      registration: form.registration,
      carModelId: form.carModelId,
      branchId: editingId ? undefined : form.branchId,
      year: form.year ? Number(form.year) : undefined,
      color: form.color || undefined,
      odometerKm: form.odometerKm === "" ? undefined : Number(form.odometerKm),
      ownerType: form.ownerType,
      partnerId: form.ownerType === "PARTNER" ? form.partnerId : null,
      status: editingId ? form.status : undefined,
    };
    try {
      if (editingId) await api(`/v1/admin/vehicles/${editingId}`, { method: "PATCH", body });
      else await api("/v1/admin/vehicles", { method: "POST", body });
      setForm(EMPTY);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id, status) {
    setError("");
    try {
      await api(`/v1/admin/vehicles/${id}`, { method: "PATCH", body: { status } });
      load();
      if (openId === id) loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function moveBranch(id, immediate) {
    if (!transfer.branchId) return;
    setError("");
    try {
      await api(`/v1/admin/vehicles/${id}/transfer-branch`, {
        method: "POST",
        body: {
          branchId: transfer.branchId,
          odometerKm: transfer.odometerKm ? Number(transfer.odometerKm) : undefined,
          notes: transfer.notes || undefined,
          immediate,
        },
      });
      setTransfer({ branchId: "", odometerKm: "", notes: "" });
      load();
      loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadDocFile() {
    if (!doc.file) return doc.url;
    const body = new FormData();
    body.append("file", doc.file);
    body.append("folder", "fleet");
    const uploaded = await api("/v1/uploads", { method: "POST", body });
    return uploaded.url || uploaded.secure_url || "";
  }

  async function addDoc(vehicleId) {
    setError("");
    try {
      const url = await uploadDocFile();
      if (!url) throw new Error("Document URL or file required");
      await api(`/v1/admin/vehicles/${vehicleId}/documents`, {
        method: "POST",
        body: { kind: doc.kind, url, expiresAt: doc.expiresAt || null },
      });
      setDoc({ kind: "INSURANCE", url: "", expiresAt: "", file: null });
      load();
      loadDetail(vehicleId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeDoc(vehicleId, docId) {
    if (!window.confirm("Remove this document?")) return;
    try {
      await api(`/v1/admin/vehicles/${vehicleId}/documents/${docId}`, { method: "DELETE" });
      load();
      loadDetail(vehicleId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveCity(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/cities", { method: "POST", body: cityForm });
      setCityForm({ name: "", slug: "", state: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBranch(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/branches", { method: "POST", body: branchForm });
      setBranchForm({ cityId: "", name: "", address: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveContract(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/admin/partners/${contract.partnerId}/contracts`, {
        method: "POST",
        body: { startsOn: contract.startsOn, endsOn: contract.endsOn || null },
      });
      setContract({ partnerId: "", startsOn: "", endsOn: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const expiryCount = useMemo(
    () => expiries.filter((row) => row.expired || (row.daysLeft != null && row.daysLeft <= 30)).length,
    [expiries]
  );

  return (
    <div className="stack">
      <h2>Vehicles</h2>
      <p className="muted">
        Physical cars (plates), not marketing models. Insurance must cover a booking before assignment.
      </p>
      {error && <p className="err">{error}</p>}

      <div className="tabs">
        <button className={tab === "vehicles" ? "active" : ""} onClick={() => setTab("vehicles")}>
          Fleet
        </button>
        <button className={tab === "expiries" ? "active" : ""} onClick={() => setTab("expiries")}>
          Expiries{expiryCount ? ` (${expiryCount})` : ""}
        </button>
        <button className={tab === "geo" ? "active" : ""} onClick={() => setTab("geo")}>
          Cities & branches
        </button>
      </div>

      {tab === "vehicles" && (
        <>
          <form className="card" onSubmit={save}>
            <h3>{editingId ? "Edit vehicle" : "Add vehicle"}</h3>
            <div className="row">
              <label>
                Registration
                <input
                  required
                  value={form.registration}
                  onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })}
                  placeholder="KA01XX1234"
                />
              </label>
              <label>
                Model
                <select
                  required
                  value={form.carModelId}
                  onChange={(e) => setForm({ ...form, carModelId: e.target.value })}
                >
                  <option value="">Select</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              {!editingId && (
                <label>
                  Branch
                  <select
                    required
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  >
                    <option value="">Select</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.city?.name} · {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Year
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                />
              </label>
              <label>
                Colour
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </label>
              <label>
                Odometer km
                <input
                  type="number"
                  value={form.odometerKm}
                  onChange={(e) => setForm({ ...form, odometerKm: e.target.value })}
                />
              </label>
              <label>
                Owner
                <select
                  value={form.ownerType}
                  onChange={(e) => setForm({ ...form, ownerType: e.target.value })}
                >
                  <option value="COMPANY">Company</option>
                  <option value="PARTNER">Partner</option>
                </select>
              </label>
              {form.ownerType === "PARTNER" && (
                <label>
                  Partner
                  <select
                    required
                    value={form.partnerId}
                    onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
                  >
                    <option value="">Select</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.active ? "" : "(inactive)"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {editingId && (
                <label>
                  Status
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="row">
              <button type="submit" disabled={busy}>
                {editingId ? "Save" : "Create"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingId("");
                    setForm(EMPTY);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <input
                placeholder="Search plate"
                value={filter.q}
                onChange={(e) => setFilter({ ...filter, q: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                style={{ maxWidth: 180 }}
              />
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                style={{ maxWidth: 180 }}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={filter.branchId}
                onChange={(e) => setFilter({ ...filter, branchId: e.target.value })}
                style={{ maxWidth: 220 }}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.city?.name} · {b.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ghost" onClick={load}>
                Search
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Reg</th>
                  <th>Model</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Docs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const nextExpiry = (row.documents || [])
                    .filter((d) => d.expiresAt)
                    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
                  const left = nextExpiry ? daysLeft(nextExpiry.expiresAt) : null;
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.registration}
                        <div className="muted">{row.odometerKm?.toLocaleString("en-IN")} km</div>
                      </td>
                      <td>{row.carModel?.name}</td>
                      <td>
                        {row.branch?.city?.name} · {row.branch?.name}
                      </td>
                      <td>{row.status.replace(/_/g, " ")}</td>
                      <td>
                        {row.ownerType === "PARTNER" ? row.partner?.name || "Partner" : "Company"}
                      </td>
                      <td>
                        {(row.documents || []).length
                          ? (row.documents || []).map((d) => d.kind).join(", ")
                          : "—"}
                        {left != null && left <= 30 ? (
                          <div className={left < 0 ? "err" : "muted"}>
                            {nextExpiry.kind} {expiryLabel(nextExpiry.expiresAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="row">
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const next = openId === row.id ? "" : row.id;
                            setOpenId(next);
                            if (next) loadDetail(row.id);
                          }}
                        >
                          {openId === row.id ? "Hide" : "Manage"}
                        </button>
                        <button type="button" className="ghost" onClick={() => edit(row)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {transfers.length > 0 && (
            <div className="card">
              <h3>Pending branch transfers</h3>
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>To</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((job) => (
                    <tr key={job.id}>
                      <td>
                        {job.vehicle?.registration}
                        <div className="muted">{job.vehicle?.carModel?.name}</div>
                      </td>
                      <td>{branches.find((b) => b.id === job.toBranchId)?.name || job.toBranchId}</td>
                      <td>{job.notes || "—"}</td>
                      <td className="row">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api(`/v1/admin/vehicle-transfers/${job.id}/complete`, { method: "POST", body: {} });
                              load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={async () => {
                            try {
                              await api(`/v1/admin/vehicle-transfers/${job.id}/cancel`, { method: "POST", body: {} });
                              load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {openId && detail && detail.id === openId && (
            <div className="card">
              <h3>
                {detail.registration} · {detail.carModel?.name}
              </h3>
              <div className="row" style={{ marginBottom: 12 }}>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={detail.status === s ? "" : "ghost"}
                    onClick={() => setStatus(detail.id, s)}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              <h3>Transfer branch</h3>
              <div className="row">
                <label>
                  New branch
                  <select
                    value={transfer.branchId}
                    onChange={(e) => setTransfer({ ...transfer, branchId: e.target.value })}
                  >
                    <option value="">Select</option>
                    {branches
                      .filter((b) => b.id !== detail.branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.city?.name} · {b.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Odometer (optional)
                  <input
                    type="number"
                    value={transfer.odometerKm}
                    onChange={(e) => setTransfer({ ...transfer, odometerKm: e.target.value })}
                  />
                </label>
                <label>
                  Notes
                  <input
                    value={transfer.notes}
                    onChange={(e) => setTransfer({ ...transfer, notes: e.target.value })}
                  />
                </label>
                <button type="button" onClick={() => moveBranch(detail.id, true)}>
                  Move now
                </button>
                <button type="button" className="ghost" onClick={() => moveBranch(detail.id, false)}>
                  Queue transfer
                </button>
              </div>

              <h3>Documents</h3>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Expiry</th>
                    <th>File</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.documents || []).map((d) => (
                    <tr key={d.id}>
                      <td>{d.kind}</td>
                      <td className={daysLeft(d.expiresAt) < 0 ? "err" : ""}>
                        {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("en-IN") : "—"}{" "}
                        <span className="muted">{expiryLabel(d.expiresAt)}</span>
                      </td>
                      <td>
                        <a href={d.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </td>
                      <td>
                        <button type="button" className="ghost" onClick={() => removeDoc(detail.id, d.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 12 }}>
                <label>
                  Kind
                  <select value={doc.kind} onChange={(e) => setDoc({ ...doc, kind: e.target.value })}>
                    {DOC_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Expiry
                  <input
                    type="date"
                    value={doc.expiresAt}
                    onChange={(e) => setDoc({ ...doc, expiresAt: e.target.value })}
                  />
                </label>
                <label>
                  URL
                  <input
                    value={doc.url}
                    onChange={(e) => setDoc({ ...doc, url: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
                <label>
                  Or file
                  <input type="file" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] || null })} />
                </label>
                <button type="button" onClick={() => addDoc(detail.id)}>
                  Add document
                </button>
              </div>

              {(detail.odometerLogs || []).length > 0 && (
                <>
                  <h3>Odometer log</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Km</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.odometerLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                          <td>{log.km.toLocaleString("en-IN")}</td>
                          <td>
                            {log.source}
                            {log.notes ? <div className="muted">{log.notes}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </>
      )}

      {tab === "expiries" && (
        <div className="card">
          <h3>RC / insurance / PUC / permit expiring in 30 days</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  const result = await api("/v1/admin/vehicles/expiries/notify", { method: "POST", body: { days: 30 } });
                  window.alert(`Alerted ${result.documents || 0} documents (${result.sent || 0} emails).`);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Email fleet about expiries
            </button>
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                try {
                  const result = await api("/v1/admin/vehicles/backfill-documents", { method: "POST", body: {} });
                  window.alert(`Filled ${result.created || 0} missing RC/insurance/PUC/permit files.`);
                  load();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Fill missing docs on existing cars
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Kind</th>
                <th>Expires</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              {expiries.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.vehicle?.registration}
                    <div className="muted">{row.vehicle?.carModel?.name}</div>
                  </td>
                  <td>{row.kind}</td>
                  <td className={row.expired ? "err" : ""}>
                    {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("en-IN") : "—"} ·{" "}
                    {expiryLabel(row.expiresAt)}
                  </td>
                  <td>
                    {row.vehicle?.branch?.city?.name} · {row.vehicle?.branch?.name}
                  </td>
                </tr>
              ))}
              {!expiries.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No documents expiring in the next 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "geo" && (
        <>
          <form className="card" onSubmit={saveCity}>
            <h3>Add city</h3>
            <div className="row">
              <label>
                Name
                <input
                  required
                  value={cityForm.name}
                  onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                />
              </label>
              <label>
                Slug
                <input
                  required
                  value={cityForm.slug}
                  onChange={(e) => setCityForm({ ...cityForm, slug: e.target.value })}
                />
              </label>
              <label>
                State
                <input
                  required
                  value={cityForm.state}
                  onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
                />
              </label>
            </div>
            <button type="submit">Create city</button>
          </form>
          <div className="card">
            <h3>Cities</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>State</th>
                  <th>Branches</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.state}</td>
                    <td>{(c.branches || []).map((b) => b.name).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="card" onSubmit={saveBranch}>
            <h3>Add branch</h3>
            <div className="row">
              <label>
                City
                <select
                  required
                  value={branchForm.cityId}
                  onChange={(e) => setBranchForm({ ...branchForm, cityId: e.target.value })}
                >
                  <option value="">Select</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input
                  required
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                />
              </label>
              <label>
                Address
                <input
                  required
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                />
              </label>
            </div>
            <button type="submit">Create branch</button>
          </form>
          <form className="card" onSubmit={saveContract}>
            <h3>Partner contract (needed before attaching a partner car)</h3>
            <div className="row">
              <label>
                Partner
                <select
                  required
                  value={contract.partnerId}
                  onChange={(e) => setContract({ ...contract, partnerId: e.target.value })}
                >
                  <option value="">Select</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Starts
                <input
                  type="date"
                  required
                  value={contract.startsOn}
                  onChange={(e) => setContract({ ...contract, startsOn: e.target.value })}
                />
              </label>
              <label>
                Ends (optional)
                <input
                  type="date"
                  value={contract.endsOn}
                  onChange={(e) => setContract({ ...contract, endsOn: e.target.value })}
                />
              </label>
            </div>
            <button type="submit">Add contract</button>
          </form>
        </>
      )}
    </div>
  );
}
