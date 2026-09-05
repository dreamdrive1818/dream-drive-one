"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const ROLE_OPTIONS = [
  "CUSTOMER",
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
];

export default function Page() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [cities, setCities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [invite, setInvite] = useState({
    email: "",
    fullName: "",
    role: "SUPPORT",
    cityId: "",
    branchId: "",
  });

  async function load(search = q) {
    setError("");
    try {
      const data = await api(`/v1/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`);
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load("");
    api("/v1/admin/cities").then(setCities).catch(() => {});
    api("/v1/admin/branches").then(setBranches).catch(() => {});
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
      await api(`/v1/admin/users/${id}/roles`, {
        method: "PATCH",
        body: { roles },
      });
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

  async function disable(id) {
    if (!window.confirm("Disable this user?")) return;
    setError("");
    try {
      await api(`/v1/admin/users/${id}/disable`, { method: "POST", body: {} });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Customers / staff</h2>
      {error && <p className="err">{error}</p>}
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
          <select
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value })}
          >
            {ROLE_OPTIONS.filter((r) => r !== "CUSTOMER").map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={invite.cityId}
            onChange={(e) => setInvite({ ...invite, cityId: e.target.value, branchId: "" })}
          >
            <option value="">All cities</option>
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
                  {b.name}
                </option>
              ))}
          </select>
          <button type="submit">Invite</button>
        </form>
      </div>
      <div className="card">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
        >
          <input
            placeholder="Search email, phone, name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Roles</th>
              <th>City / branch</th>
              <th>Status</th>
              <th>KYC</th>
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
                    defaultValue={(u.roles || [])[0] || "CUSTOMER"}
                    onChange={(e) => setRoles(u.id, [e.target.value])}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {(u.roles || []).some((r) => r !== "CUSTOMER") ? (
                    <div className="row">
                      <select
                        value={u.cityId || ""}
                        onChange={(e) => setScope(u.id, e.target.value, u.branchId)}
                      >
                        <option value="">All cities</option>
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
                  ) : (
                    "—"
                  )}
                </td>
                <td>{u.status}</td>
                <td>{u.kycStatus}</td>
                <td>
                  {u.status !== "DISABLED" && (
                    <button className="ghost" type="button" onClick={() => disable(u.id)}>
                      Disable
                    </button>
                  )}{" "}
                  <Link href={`/customers/${u.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
