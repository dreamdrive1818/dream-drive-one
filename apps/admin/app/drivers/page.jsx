"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const EMPTY = { fullName: "", phone: "", branchId: "", active: true };
const DOC_KINDS = ["DL", "BADGE", "ID", "POLICE_VERIFICATION"];

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

function toLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultWindow() {
  const from = new Date();
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { from: toLocal(from), to: toLocal(to) };
}

export default function DriversPage() {
  const [tab, setTab] = useState("roster");
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState({ branchId: "", active: "", q: "" });
  const [doc, setDoc] = useState({ kind: "DL", url: "", expiresAt: "", file: null });
  const [leave, setLeave] = useState({ startsAt: "", endsAt: "" });
  const [windowDates, setWindowDates] = useState(defaultWindow);
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (filter.branchId) params.set("branchId", filter.branchId);
    if (filter.active) params.set("active", filter.active);
    if (filter.q) params.set("q", filter.q);
    const qs = params.toString() ? `?${params}` : "";
    api(`/v1/admin/drivers${qs}`).then(setRows).catch((e) => setError(e.message));
    api("/v1/admin/branches").then(setBranches).catch(() => {});
  }

  useEffect(load, [filter.branchId, filter.active]);

  async function loadDetail(id) {
    try {
      setDetail(await api(`/v1/admin/drivers/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadAvailability() {
    setError("");
    const params = new URLSearchParams();
    if (windowDates.from) params.set("from", new Date(windowDates.from).toISOString());
    if (windowDates.to) params.set("to", new Date(windowDates.to).toISOString());
    if (filter.branchId) params.set("branchId", filter.branchId);
    try {
      setAvailability(await api(`/v1/admin/drivers/availability?${params}`));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (tab === "availability") loadAvailability();
  }, [tab, filter.branchId]);

  function edit(row) {
    setEditingId(row.id);
    setForm({
      fullName: row.fullName || "",
      phone: row.phone || "",
      branchId: row.branchId || "",
      active: row.active !== false,
    });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (editingId) {
        await api(`/v1/admin/drivers/${editingId}`, {
          method: "PATCH",
          body: {
            fullName: form.fullName,
            phone: form.phone,
            branchId: form.branchId,
            active: form.active,
          },
        });
      } else {
        await api("/v1/admin/drivers", { method: "POST", body: form });
      }
      setForm(EMPTY);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row) {
    setError("");
    try {
      await api(`/v1/admin/drivers/${row.id}`, { method: "PATCH", body: { active: !row.active } });
      load();
      if (openId === row.id) loadDetail(row.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this chauffeur?")) return;
    setError("");
    try {
      await api(`/v1/admin/drivers/${id}`, { method: "DELETE" });
      if (openId === id) {
        setOpenId("");
        setDetail(null);
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadDocFile() {
    if (!doc.file) return doc.url;
    const body = new FormData();
    body.append("file", doc.file);
    body.append("folder", "drivers");
    const uploaded = await api("/v1/uploads", { method: "POST", body });
    return uploaded.url || uploaded.secure_url || "";
  }

  async function addDoc(driverId) {
    setError("");
    try {
      const url = await uploadDocFile();
      if (!url) throw new Error("Document URL or file required");
      await api(`/v1/admin/drivers/${driverId}/documents`, {
        method: "POST",
        body: { kind: doc.kind, url, expiresAt: doc.expiresAt || null },
      });
      setDoc({ kind: "DL", url: "", expiresAt: "", file: null });
      load();
      loadDetail(driverId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeDoc(driverId, docId) {
    if (!window.confirm("Remove this document?")) return;
    try {
      await api(`/v1/admin/drivers/${driverId}/documents/${docId}`, { method: "DELETE" });
      load();
      loadDetail(driverId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addLeave(driverId) {
    setError("");
    try {
      await api(`/v1/admin/drivers/${driverId}/leave`, {
        method: "POST",
        body: {
          startsAt: new Date(leave.startsAt).toISOString(),
          endsAt: new Date(leave.endsAt).toISOString(),
        },
      });
      setLeave({ startsAt: "", endsAt: "" });
      load();
      loadDetail(driverId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLeave(driverId, leaveId) {
    if (!window.confirm("Remove this leave?")) return;
    try {
      await api(`/v1/admin/drivers/${driverId}/leave/${leaveId}`, { method: "DELETE" });
      load();
      loadDetail(driverId);
    } catch (err) {
      setError(err.message);
    }
  }

  const openRow = useMemo(
    () => (detail && detail.id === openId ? detail : rows.find((r) => r.id === openId)),
    [detail, openId, rows]
  );

  return (
    <div>
      <h2>Drivers</h2>
      <p className="muted">Chauffeurs for with-driver trips. Customers see name and phone only after assignment.</p>
      {error && <p className="err">{error}</p>}

      <div className="tabs">
        <button type="button" className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>
          Roster
        </button>
        <button type="button" className={tab === "availability" ? "active" : ""} onClick={() => setTab("availability")}>
          Availability
        </button>
      </div>

      {tab === "roster" && (
        <div className="stack">
          <div className="card">
            <h3>{editingId ? "Edit chauffeur" : "Add chauffeur"}</h3>
            <form onSubmit={save}>
              <div className="row">
                <label>
                  Name
                  <input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
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
                <label className="row" style={{ alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  Active
                </label>
              </div>
              <div className="row">
                <button type="submit" disabled={busy}>
                  {editingId ? "Save" : "Add driver"}
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
          </div>

          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <input
                placeholder="Search name or phone"
                value={filter.q}
                onChange={(e) => setFilter({ ...filter, q: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                style={{ maxWidth: 240 }}
              />
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
              <select
                value={filter.active}
                onChange={(e) => setFilter({ ...filter, active: e.target.value })}
                style={{ maxWidth: 140 }}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button type="button" className="ghost" onClick={load}>
                Search
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Branch</th>
                  <th>Docs</th>
                  <th>Assignment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dl = (row.documents || []).find((d) => String(d.kind).toUpperCase() === "DL");
                  const trip = (row.assignments || [])[0]?.booking;
                  const left = dl ? daysLeft(dl.expiresAt) : null;
                  return (
                    <tr key={row.id}>
                      <td>
                        {row.fullName}
                        <div className="muted">{row.active ? "Active" : "Inactive"}</div>
                      </td>
                      <td>{row.phone}</td>
                      <td>
                        {row.branch?.city?.name} · {row.branch?.name}
                      </td>
                      <td>
                        {(row.documents || []).length
                          ? (row.documents || []).map((d) => d.kind).join(", ")
                          : "—"}
                        {left != null && left <= 30 ? (
                          <div className={left < 0 ? "err" : "muted"}>DL {expiryLabel(dl.expiresAt)}</div>
                        ) : null}
                      </td>
                      <td>
                        {trip ? (
                          <>
                            {trip.publicId}
                            <div className="muted">{trip.status.replace(/_/g, " ")}</div>
                          </>
                        ) : (
                          "—"
                        )}
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
                        <button type="button" className="ghost" onClick={() => toggleActive(row)}>
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {openRow && (
            <div className="card">
              <h3>
                {openRow.fullName} · {openRow.phone}
              </h3>
              <p className="muted">
                {openRow.branch?.city?.name} · {openRow.branch?.name}
              </p>
              <div className="row" style={{ marginBottom: 12 }}>
                <button type="button" className="danger" onClick={() => remove(openRow.id)}>
                  Delete
                </button>
              </div>

              <h3>Documents (DL, badge)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Expiry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(openRow.documents || []).map((d) => (
                    <tr key={d.id}>
                      <td>
                        <a href={d.url} target="_blank" rel="noreferrer">
                          {d.kind}
                        </a>
                      </td>
                      <td className={daysLeft(d.expiresAt) < 0 ? "err" : ""}>
                        {d.expiresAt ? expiryLabel(d.expiresAt) : "—"}
                      </td>
                      <td>
                        <button type="button" className="ghost" onClick={() => removeDoc(openRow.id, d.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <select value={doc.kind} onChange={(e) => setDoc({ ...doc, kind: e.target.value })}>
                  {DOC_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={doc.expiresAt}
                  onChange={(e) => setDoc({ ...doc, expiresAt: e.target.value })}
                />
                <input
                  placeholder="URL"
                  value={doc.url}
                  onChange={(e) => setDoc({ ...doc, url: e.target.value, file: null })}
                />
                <input
                  type="file"
                  onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] || null })}
                />
                <button type="button" onClick={() => addDoc(openRow.id)}>
                  Add document
                </button>
              </div>

              <h3 style={{ marginTop: 20 }}>Leave</h3>
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(openRow.leaves || []).map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.startsAt).toLocaleString("en-IN")}</td>
                      <td>{new Date(l.endsAt).toLocaleString("en-IN")}</td>
                      <td>
                        <button type="button" className="ghost" onClick={() => removeLeave(openRow.id, l.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <label>
                  Starts
                  <input
                    type="datetime-local"
                    value={leave.startsAt}
                    onChange={(e) => setLeave({ ...leave, startsAt: e.target.value })}
                  />
                </label>
                <label>
                  Ends
                  <input
                    type="datetime-local"
                    value={leave.endsAt}
                    onChange={(e) => setLeave({ ...leave, endsAt: e.target.value })}
                  />
                </label>
                <button type="button" onClick={() => addLeave(openRow.id)} disabled={!leave.startsAt || !leave.endsAt}>
                  Add leave
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "availability" && (
        <div className="card">
          <h3>Who is free</h3>
          <div className="row" style={{ marginBottom: 12 }}>
            <label>
              From
              <input
                type="datetime-local"
                value={windowDates.from}
                onChange={(e) => setWindowDates({ ...windowDates, from: e.target.value })}
              />
            </label>
            <label>
              To
              <input
                type="datetime-local"
                value={windowDates.to}
                onChange={(e) => setWindowDates({ ...windowDates, to: e.target.value })}
              />
            </label>
            <button type="button" onClick={loadAvailability}>
              Check
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {availability.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.fullName}
                    <div className="muted">{d.phone}</div>
                  </td>
                  <td>
                    {d.branch?.city?.name} · {d.branch?.name}
                  </td>
                  <td>{d.available ? "Available" : "Busy"}</td>
                  <td className={d.available ? "muted" : "err"}>{(d.reasons || []).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
