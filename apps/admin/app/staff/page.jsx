"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const ROLE_OPTIONS = [
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
];

export default function StaffPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [cities, setCities] = useState([]);
  const [invite, setInvite] = useState({
    email: "",
    fullName: "",
    role: "SUPPORT",
    cityId: "",
    branchId: "",
  });

  const roles = me?.roles || [];
  const isSuper = roles.includes("SUPER_ADMIN");
  const canInvite = isSuper || roles.includes("CITY_MANAGER");
  const roleOptions = isSuper ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r !== "SUPER_ADMIN" && r !== "CITY_MANAGER");
  const branches = cities.flatMap((c) => (c.branches || []).map((b) => ({ ...b, cityName: c.name })));

  async function load(search = q) {
    setError("");
    try {
      const data = await api(`/v1/admin/users?staff=1${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
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
    api("/v1/admin/cities").then(setCities).catch(() => {});
  }, []);
  }, []);

  async function sendInvite(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/users/invite", {
        method: "POST",
        body: {
          email: invite.email,
          fullName: invite.fullName,
          roles: [invite.role],
          cityId: invite.cityId || undefined,
          branchId: invite.branchId || undefined,
        },
      });
      setInvite({ email: "", fullName: "", role: "SUPPORT", cityId: "", branchId: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setRoles(id, roles) {
    setError("");
    try {
      await api(`/v1/admin/users/${id}/roles`, { method: "PATCH", body: { roles } });
      await load();
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Staff</h2>
      <p className="muted">
        Assign city and branch scope. Branch managers only see their branch; city managers see the city unless they pick a
        branch in the sidebar. SUPER_ADMIN bypasses location filters.
      </p>
      {error && <p className="err">{error}</p>}
      {canInvite && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Invite staff</h3>
          <form className="row" onSubmit={sendInvite}>
          <input
            placeholder="email"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            required
          />
          <input
            placeholder="name"
            value={invite.fullName}
            onChange={(e) => setInvite({ ...invite, fullName: e.target.value })}
          />
          <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
            {roleOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={invite.cityId}
            disabled={!isSuper}
            onChange={(e) => setInvite({ ...invite, cityId: e.target.value, branchId: "" })}
          >
            {isSuper && <option value="">All cities (super admin only)</option>}
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={invite.branchId}
            onChange={(e) => setInvite({ ...invite, branchId: e.target.value })}
          >
            <option value="">All branches</option>
            {branches
              .filter((b) => !invite.cityId || b.cityId === invite.cityId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.cityName} · {b.name}
                </option>
              ))}
          </select>
          <button type="submit">Invite</button>
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
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>City / branch</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.fullName}</td>
                <td>
                    <select
                      defaultValue={(u.roles || []).find((r) => r !== "CUSTOMER") || (u.roles || [])[0] || "SUPPORT"}
                      disabled={!isSuper}
                      onChange={(e) => setRoles(u.id, [e.target.value])}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                </td>
                <td>
                  <div className="row">
                    <select
                      value={u.cityId || ""}
                      onChange={(e) => setScope(u.id, e.target.value, u.branchId)}
                    >
                      <option value="">{isSuper ? "All cities" : "City required"}</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
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
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </td>
                <td>
                  <Link href={`/customers/${u.id}`}>Profile</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
