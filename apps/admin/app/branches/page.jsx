"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const EMPTY = { cityId: "", name: "", address: "", active: true };

export default function BranchesPage() {
  const [me, setMe] = useState(null);
  const [cities, setCities] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const canWrite = (me?.roles || []).includes("SUPER_ADMIN") || (me?.roles || []).includes("CITY_MANAGER");

  async function load(cityId = cityFilter) {
    setError("");
    try {
      const qs = cityId ? `?cityId=${encodeURIComponent(cityId)}` : "";
      setRows(await api(`/v1/admin/branches${qs}`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    api("/v1/me").then(setMe).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => setCities([]));
    load("");
  }, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (editId) {
        await api(`/v1/admin/branches/${editId}`, { method: "PATCH", body: form });
        setEditId(null);
      } else {
        await api("/v1/admin/branches", { method: "POST", body: form });
      }
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this branch?")) return;
    try {
      await api(`/v1/admin/branches/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Branches</h2>
      <p className="muted">
        Pickup and drop locations. Cross-branch one-way returns create a completed transfer on the vehicle.{" "}
        <Link href="/cities">Manage cities</Link>
      </p>
      {error && <p className="err">{error}</p>}
      {canWrite && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={save}>
          <h3>{editId ? "Edit branch" : "Add branch"}</h3>
          <div className="row">
            <label>
              City
              <select required value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
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
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Address
              <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          <div className="row">
            <button type="submit">{editId ? "Save" : "Create"}</button>
            {editId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      <div className="card">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load(cityFilter);
          }}
        >
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">All cities in scope</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">Filter</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>City</th>
              <th>Address</th>
              <th>Fleet</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.city?.name}</td>
                <td>{b.address}</td>
                <td>
                  {b._count?.vehicles ?? 0} cars · {b._count?.drivers ?? 0} drivers
                </td>
                <td>{b.active === false ? "Inactive" : "Active"}</td>
                <td>
                  {canWrite && (
                    <div className="row">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setEditId(b.id);
                          setForm({
                            cityId: b.cityId,
                            name: b.name,
                            address: b.address || "",
                            active: b.active !== false,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="ghost" onClick={() => remove(b.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No branches in this city.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
