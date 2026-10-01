"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { ROLE_META, STAFF_ROLES, generateStaffPassword, modulesForRoles, roleLabel } from "../../lib/rbac";

const EMPTY = {
  email: "",
  fullName: "",
  password: "",
  confirm: "",
  phone: "",
  salaryInr: "",
  roles: ["SUPPORT"],
  cityId: "",
  branchId: "",
};

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function friendlyError(message) {
  if (/internal server error|econnrefused|can't reach the api|failed to fetch/i.test(String(message || ""))) {
    return "Could not load staff. Keep the API running on port 4000, then retry.";
  }
  return message;
}

function RoleCard({ role, checked, onToggle, compact }) {
  const meta = ROLE_META[role] || {};
  return (
    <label className={`role-pick${checked ? " is-on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="role-tick" aria-hidden>
        <svg viewBox="0 0 16 16">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
      <span className="role-copy">
        <strong>{meta.label || role}</strong>
        {!compact && <span>{meta.blurb}</span>}
      </span>
    </label>
  );
}

export default function StaffPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cities, setCities] = useState([]);
  const [invite, setInvite] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [resetPw, setResetPw] = useState("");
  const [showCreatePw, setShowCreatePw] = useState(true);
  const [created, setCreated] = useState(null);
  const [revealed, setRevealed] = useState({});

  const roles = me?.roles || [];
  const isSuper = roles.includes("SUPER_ADMIN");
  const canInvite = isSuper || roles.includes("CITY_MANAGER");
  const canSeePasswords = isSuper || roles.includes("CITY_MANAGER");
  const roleOptions = isSuper
    ? STAFF_ROLES
    : STAFF_ROLES.filter((r) => r !== "SUPER_ADMIN" && r !== "CITY_MANAGER");
  const branches = cities.flatMap((c) => (c.branches || []).map((b) => ({ ...b, cityName: c.name })));
  const accessPreview = useMemo(() => modulesForRoles(invite.roles), [invite.roles]);

  async function load(search = q) {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ staff: "1" });
      if (search.trim()) params.set("q", search.trim());
      const [data, cityRows, branchRows] = await Promise.all([
        api(`/v1/admin/users?${params}`),
        api("/v1/admin/cities"),
        api("/v1/admin/branches").catch(() => []),
      ]);
      setRows(Array.isArray(data) ? data : []);
      const nextCities = Array.isArray(cityRows) ? cityRows : [];
      if (Array.isArray(branchRows) && branchRows.length) {
        const byCity = new Map(nextCities.map((c) => [c.id, { ...c, branches: [...(c.branches || [])] }]));
        for (const b of branchRows) {
          const city = byCity.get(b.cityId);
          if (!city) continue;
          if (!(city.branches || []).some((row) => row.id === b.id)) {
            city.branches.push(b);
          }
        }
        setCities([...byCity.values()]);
      } else {
        setCities(nextCities);
      }
    } catch (e) {
      setError(friendlyError(e.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    api("/v1/me")
      .then((user) => {
        setMe(user);
        if (!(user.roles || []).includes("SUPER_ADMIN") && user.cityId) {
          setInvite((prev) => ({ ...prev, cityId: user.cityId }));
        }
      })
      .catch(() => {});
  }, []);

  function toggleInviteRole(role) {
    setInvite((prev) => {
      const has = prev.roles.includes(role);
      const next = has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
      return { ...prev, roles: next.length ? next : [role] };
    });
  }

  function fillGenerated(target) {
    const password = generateStaffPassword();
    if (target === "create") {
      setInvite((prev) => ({ ...prev, password, confirm: password }));
      setShowCreatePw(true);
    } else {
      setResetPw(password);
    }
    return password;
  }

  async function sendInvite(e) {
    e.preventDefault();
    setError("");
    setOk("");
    if (invite.password !== invite.confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!invite.roles.length) {
      setError("Pick at least one role");
      return;
    }
    const needsCity = invite.roles.some((r) => r !== "SUPER_ADMIN");
    if (needsCity && !invite.cityId) {
      setError("Pick a city so this staff member sees a location in their panel");
      return;
    }
    if (invite.roles.includes("BRANCH_MANAGER") && !invite.branchId) {
      setError("Branch managers need a branch");
      return;
    }
    setBusy(true);
    try {
      const made = await api("/v1/admin/users/invite", {
        method: "POST",
        body: {
          email: invite.email,
          fullName: invite.fullName,
          password: invite.password,
          roles: invite.roles,
          cityId: invite.cityId || undefined,
          branchId: invite.branchId || undefined,
          phone: isSuper ? invite.phone || undefined : undefined,
          salaryInr: isSuper && invite.salaryInr !== "" ? Number(String(invite.salaryInr).replace(/,/g, "")) : undefined,
        },
      });
      const password = made.issuedPassword || invite.password;
      setCreated({
        email: made.email || invite.email,
        name: made.fullName || invite.fullName,
        password,
      });
      setInvite({
        ...EMPTY,
        cityId: isSuper ? "" : invite.cityId,
        roles: ["SUPPORT"],
      });
      setOk(`Staff created. Password: ${password}`);
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function saveRoles(id, nextRoles) {
    setError("");
    setOk("");
    try {
      await api(`/v1/admin/users/${id}/roles`, { method: "PATCH", body: { roles: nextRoles } });
      setOk("Access updated");
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  async function setScope(id, cityId, branchId) {
    setError("");
    try {
      await api(`/v1/admin/staff/${id}/scope`, {
        method: "PUT",
        body: { cityId: cityId || null, branchId: branchId || null },
      });
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  async function setPassword(id) {
    if (!resetPw || resetPw.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setError("");
    try {
      const updated = await api(`/v1/admin/users/${id}/password`, { method: "PATCH", body: { password: resetPw } });
      setOk(`Password saved: ${updated.issuedPassword || resetPw}`);
      setResetPw("");
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  async function toggleDisabled(u) {
    setError("");
    try {
      const path = u.status === "DISABLED" ? "enable" : "disable";
      await api(`/v1/admin/users/${u.id}/${path}`, { method: "POST" });
      setOk(path === "enable" ? "Staff enabled" : "Staff disabled");
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  return (
    <div className="staff-page">
      <div className="staff-hero">
        <div>
          <h2>Staff & access</h2>
          <p className="muted">Create people, tap the roles they need, and keep their generated password here.</p>
        </div>
        <span className="staff-count">{rows.length} staff</span>
      </div>
      {error && (
        <p className="err">
          {error}{" "}
          <button type="button" className="ghost" onClick={() => load(q)}>Retry</button>
        </p>
      )}
      {ok && <p className="ok">{ok}</p>}
      {created?.password && (
        <div className="card created-pw">
          <div>
            <strong>Password ready for {created.name || created.email}</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>{created.email}</p>
          </div>
          <code className="staff-pw-value">{created.password}</code>
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              if (await copyText(created.password)) setOk("Password copied");
            }}
          >
            Copy password
          </button>
        </div>
      )}
      {canInvite && (
        <div className="card staff-create">
          <h3>Create staff</h3>
          <form className="staff-form" onSubmit={sendInvite}>
            <div className="row">
              <label>
                Full name
                <input
                  value={invite.fullName}
                  onChange={(e) => setInvite({ ...invite, fullName: e.target.value })}
                  placeholder="Priya Sharma"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  placeholder="ops@dreamdrive.test"
                  required
                />
              </label>
            </div>
            {isSuper && (
              <div className="row">
                <label>
                  Phone
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={invite.phone}
                    onChange={(e) => setInvite({ ...invite, phone: e.target.value })}
                    placeholder="9876543210"
                  />
                </label>
                <label>
                  Monthly salary (₹)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={invite.salaryInr}
                    onChange={(e) => setInvite({ ...invite, salaryInr: e.target.value })}
                    placeholder="35000"
                  />
                </label>
              </div>
            )}
            <div className="staff-pw-box">
              <div className="row">
                <label>
                  Password
                  <input
                    type={showCreatePw ? "text" : "password"}
                    value={invite.password}
                    onChange={(e) => setInvite({ ...invite, password: e.target.value, confirm: e.target.value })}
                    placeholder="Generate a password"
                    required
                    minLength={8}
                  />
                </label>
                <label>
                  Confirm
                  <input
                    type={showCreatePw ? "text" : "password"}
                    value={invite.confirm}
                    onChange={(e) => setInvite({ ...invite, confirm: e.target.value })}
                    required
                    minLength={8}
                  />
                </label>
              </div>
              <div className="row">
                <button type="button" onClick={() => fillGenerated("create")}>Generate password</button>
                <button type="button" className="ghost" onClick={() => setShowCreatePw((v) => !v)}>
                  {showCreatePw ? "Hide" : "Show"}
                </button>
                {invite.password ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={async () => {
                      if (await copyText(invite.password)) setOk("Password copied");
                    }}
                  >
                    Copy
                  </button>
                ) : null}
              </div>
            </div>
            <div className="row">
              <label>
                City
                <select
                  value={invite.cityId}
                  disabled={!isSuper}
                  onChange={(e) => setInvite({ ...invite, cityId: e.target.value, branchId: "" })}
                  required={invite.roles.some((r) => r !== "SUPER_ADMIN")}
                >
                  {isSuper && <option value="">All cities</option>}
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.active === false ? " (hidden)" : ""}</option>
                  ))}
                </select>
              </label>
              <label>
                Branch
                <select
                  value={invite.branchId}
                  onChange={(e) => setInvite({ ...invite, branchId: e.target.value })}
                >
                  <option value="">All branches</option>
                  {branches
                    .filter((b) => !invite.cityId || b.cityId === invite.cityId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>{b.cityName} · {b.name}</option>
                    ))}
                </select>
              </label>
            </div>
            {cities.length ? (
              <p className="muted" style={{ margin: "0 0 8px" }}>
                These cities come from Cities. Pick one so the staff panel shows their location.
              </p>
            ) : (
              <p className="err">No cities loaded. Add a city under Cities, then search staff again.</p>
            )}
            <p className="staff-section-label">Access roles</p>
            <div className="role-grid">
              {roleOptions.map((role) => (
                <RoleCard
                  key={role}
                  role={role}
                  checked={invite.roles.includes(role)}
                  onToggle={() => toggleInviteRole(role)}
                />
              ))}
            </div>
            <div className="access-preview">
              <span className="muted">They will see</span>
              <div className="access-chips">
                {accessPreview.map((label, i) => (
                  <span key={label} className="chip" style={{ animationDelay: `${i * 35}ms` }}>{label}</span>
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create staff"}</button>
          </form>
        </div>
      )}
      <div className="card">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
        >
          <input placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        {loading && !rows.length ? (
          <div className="staff-dir">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skel staff-skel" />
            ))}
          </div>
        ) : (
          <div className="staff-dir">
            {rows.map((u) => {
              const staffRoles = (u.roles || []).filter((r) => r !== "CUSTOMER");
              const open = editing === u.id;
              const shown = revealed[u.id];
              const password = u.issuedPassword || "";
              return (
                <article key={u.id} className={`staff-person${open ? " is-open" : ""}`}>
                  <div className="staff-avatar">{initials(u.fullName, u.email)}</div>
                  <div className="staff-person-meta">
                  <p className="staff-name">{u.fullName || "—"}</p>
                  <div className="muted">{u.email}</div>
                  <div className="staff-assigned">
                    {u.cityName
                      ? `${u.cityName}${u.branchName ? ` · ${u.branchName}` : ""}`
                      : "No location assigned"}
                  </div>
                    {u.status === "DISABLED" && <span className="status-pill status-CANCELLED">Disabled</span>}
                    <div className="access-chips">
                      {staffRoles.map((r, i) => (
                        <span key={r} className="chip" style={{ animationDelay: `${i * 40}ms` }}>{roleLabel(r)}</span>
                      ))}
                    </div>
                    {canSeePasswords && (
                      <div className="staff-pw-cell" style={{ marginTop: 10 }}>
                        {password ? (
                          <>
                            <code className="staff-pw-value">{shown ? password : "••••••••"}</code>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setRevealed((prev) => ({ ...prev, [u.id]: !shown }))}
                            >
                              {shown ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={async () => {
                                if (await copyText(password)) setOk(`Copied password for ${u.email}`);
                              }}
                            >
                              Copy
                            </button>
                          </>
                        ) : (
                          <span className="muted">{u.passwordSet ? "Password set before this update" : "No password yet"}</span>
                        )}
                      </div>
                    )}
                    {open && isSuper && (
                      <div className="staff-edit">
                        <div className="role-grid compact">
                          {roleOptions.map((role) => (
                            <RoleCard
                              key={role}
                              role={role}
                              compact
                              checked={editRoles.includes(role)}
                              onToggle={() => {
                                setEditRoles((prev) => {
                                  const has = prev.includes(role);
                                  const next = has ? prev.filter((r) => r !== role) : [...prev, role];
                                  return next.length ? next : prev;
                                });
                              }}
                            />
                          ))}
                        </div>
                        <div className="row">
                          <button type="button" onClick={() => saveRoles(u.id, editRoles)}>Save access</button>
                          <input
                            type="text"
                            placeholder="New password"
                            value={resetPw}
                            onChange={(e) => setResetPw(e.target.value)}
                          />
                          <button type="button" className="ghost" onClick={() => fillGenerated("reset")}>Generate</button>
                          <button type="button" className="ghost" onClick={() => setPassword(u.id)}>Save password</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="staff-person-side">
                    <select
                      value={u.cityId || ""}
                      onChange={(e) => setScope(u.id, e.target.value, u.branchId)}
                    >
                      <option value="">{isSuper ? "All cities" : "City required"}</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.active === false ? " (hidden)" : ""}</option>
                      ))}
                    </select>
                    <select
                      value={u.branchId || ""}
                      onChange={(e) => setScope(u.id, u.cityId, e.target.value)}
                    >
                      <option value="">All branches</option>
                      {branches
                        .filter((b) => !u.cityId || b.cityId === u.cityId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                    <div className="row">
                      {isSuper && (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditing(open ? null : u.id);
                            setEditRoles(staffRoles.length ? staffRoles : ["SUPPORT"]);
                            setResetPw("");
                          }}
                        >
                          {open ? "Close" : "Edit access"}
                        </button>
                      )}
                      {isSuper && me?.id !== u.id && (
                        <button type="button" className="ghost" onClick={() => toggleDisabled(u)}>
                          {u.status === "DISABLED" ? "Enable" : "Disable"}
                        </button>
                      )}
                      <Link href={`/staff/${u.id}`}>Profile</Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {!loading && !rows.length ? <p className="muted">No staff yet.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
