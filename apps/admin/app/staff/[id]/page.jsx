"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { generateStaffPassword, modulesForRoles, roleLabel } from "../../../lib/rbac";

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone || "Not set";
}

function formatSalary(value) {
  if (value == null || value === "") return "Not set";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Not set";
  return `₹${n.toLocaleString("en-IN")} / month`;
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function StaffProfilePage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [phone, setPhone] = useState("");
  const [salary, setSalary] = useState("");

  const isSuper = (me?.roles || []).includes("SUPER_ADMIN");
  const isCityManager = (me?.roles || []).includes("CITY_MANAGER");
  const canManageLocation = isSuper || isCityManager;
  const isSelf = Boolean(me?.id && data?.id && me.id === data.id);
  const staffRoles = (data?.roles || []).filter((r) => r !== "CUSTOMER");
  const access = useMemo(() => modulesForRoles(staffRoles), [staffRoles.join(",")]);
  const branches = cities.flatMap((c) => (c.branches || []).map((b) => ({ ...b, cityName: c.name })));

  async function load() {
    setError("");
    try {
      const row = await api(`/v1/admin/staff/${id}`);
      setData(row);
      setPhone(row.phone || "");
      setSalary(row.salaryInr != null ? String(row.salaryInr) : "");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    api("/v1/me").then(setMe).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => setCities([]));
  }, [id]);

  async function setScope(cityId, branchId) {
    setError("");
    setBusy(true);
    try {
      const row = await api(`/v1/admin/staff/${id}/scope`, {
        method: "PUT",
        body: { cityId: cityId || null, branchId: branchId || null },
      });
      setData((prev) => ({ ...prev, ...row }));
      setOk("Location updated");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    const password = newPw || generateStaffPassword();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const row = await api(`/v1/admin/users/${id}/password`, { method: "PATCH", body: { password } });
      setData((prev) => ({ ...prev, ...row }));
      setNewPw(password);
      setShowPw(true);
      setOk(`Password saved: ${row.issuedPassword || password}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveHr() {
    setError("");
    setBusy(true);
    try {
      const row = await api(`/v1/admin/staff/${id}/hr`, {
        method: "PATCH",
        body: {
          phone: phone.trim() || null,
          salaryInr: salary.trim() === "" ? null : Number(String(salary).replace(/,/g, "")),
        },
      });
      setData(row);
      setPhone(row.phone || "");
      setSalary(row.salaryInr != null ? String(row.salaryInr) : "");
      setOk("Phone and salary saved");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled() {
    setError("");
    setBusy(true);
    try {
      const path = data?.status === "DISABLED" ? "enable" : "disable";
      await api(`/v1/admin/users/${id}/${path}`, { method: "POST" });
      await load();
      setOk(path === "enable" ? "Staff enabled" : "Staff disabled");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="muted">Loading staff…</p>;

  const password = data?.issuedPassword || "";

  return (
    <div className="staff-page">
      <p className="muted">
        <Link href={canManageLocation ? "/staff" : "/"}>{canManageLocation ? "← Staff" : "← Dashboard"}</Link>
      </p>
      {error && <p className="err">{error}</p>}
      {ok && <p className="ok">{ok}</p>}
      {data && (
        <>
          <div className="staff-hero">
            <div className="row" style={{ alignItems: "center" }}>
              <div className="staff-avatar">{initials(data.fullName, data.email)}</div>
              <div>
                <h2 style={{ margin: 0 }}>{data.fullName || data.email}{isSelf ? " (you)" : ""}</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>{data.email}</p>
                {data.phone ? <p className="staff-assigned" style={{ margin: "4px 0 0" }}>{formatPhone(data.phone)}</p> : null}
              </div>
            </div>
            <span className="staff-count">{data.status}</span>
          </div>

          <div className="grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <h3>Location</h3>
              <p className="staff-assigned" style={{ marginTop: 0 }}>
                {data.cityName
                  ? `${data.cityName}${data.branchName ? ` · ${data.branchName}` : ""}`
                  : "No location assigned"}
              </p>
              {canManageLocation && (
                <div className="row">
                  <select
                    value={data.cityId || ""}
                    disabled={busy}
                    onChange={(e) => setScope(e.target.value, data.branchId)}
                  >
                    <option value="">{isSuper ? "All cities" : "City required"}</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={data.branchId || ""}
                    disabled={busy}
                    onChange={(e) => setScope(data.cityId, e.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches
                      .filter((b) => !data.cityId || b.cityId === data.cityId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="card">
              <h3>Phone & salary</h3>
              {isSuper ? (
                <>
                  <label>
                    Phone
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <label>
                    Monthly salary (₹)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="35000"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                    />
                  </label>
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    Staff can see these. Only super admin can change them.
                  </p>
                  <button type="button" disabled={busy} onClick={saveHr}>Save phone & salary</button>
                </>
              ) : (
                <div className="staff-hr-read">
                  <div>
                    <span className="muted">Phone</span>
                    <strong>{formatPhone(data.phone)}</strong>
                  </div>
                  <div>
                    <span className="muted">Salary</span>
                    <strong>{formatSalary(data.salaryInr)}</strong>
                  </div>
                </div>
              )}
            </div>
            <div className="card">
              <h3>Password</h3>
              <div className="staff-pw-cell">
                <code className="staff-pw-value">{password ? (showPw ? password : "••••••••") : "Not set"}</code>
                {password ? (
                  <>
                    <button type="button" className="ghost" onClick={() => setShowPw((v) => !v)}>
                      {showPw ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        if (await copyText(password)) setOk("Password copied");
                      }}
                    >
                      Copy
                    </button>
                  </>
                ) : null}
              </div>
              {isSuper && (
                <div className="row" style={{ marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="New password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <button type="button" className="ghost" onClick={() => setNewPw(generateStaffPassword())}>
                    Generate
                  </button>
                  <button type="button" disabled={busy} onClick={savePassword}>Save password</button>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Access</h3>
            <div className="access-chips">
              {staffRoles.map((r) => (
                <span key={r} className="chip">{roleLabel(r)}</span>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>They can open</p>
            <div className="access-chips">
              {access.map((label) => (
                <span key={label} className="chip">{label}</span>
              ))}
            </div>
          </div>

          {isSuper && me?.id !== data.id && (
            <div className="row" style={{ marginBottom: 16 }}>
              <button type="button" className="ghost" disabled={busy} onClick={toggleDisabled}>
                {data.status === "DISABLED" ? "Enable staff" : "Disable staff"}
              </button>
            </div>
          )}

          <div className="card">
            <h3>Recent activity</h3>
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>By</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(data.audits || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.action}</td>
                    <td>{row.actor?.email || "—"}</td>
                    <td>{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {!(data.audits || []).length && (
                  <tr>
                    <td colSpan={3} className="muted">No activity yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
