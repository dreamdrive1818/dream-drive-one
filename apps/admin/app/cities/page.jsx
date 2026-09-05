"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const EMPTY_CITY = { name: "", slug: "", state: "", active: true };
const EMPTY_BRANCH = { cityId: "", name: "", address: "", active: true };

export default function CitiesPage() {
  const [me, setMe] = useState(null);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  const [cityForm, setCityForm] = useState(EMPTY_CITY);
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH);
  const [editCity, setEditCity] = useState(null);
  const [editBranch, setEditBranch] = useState(null);

  const roles = me?.roles || [];
  const canCreateCity = roles.includes("SUPER_ADMIN");
  const canWrite = roles.includes("SUPER_ADMIN") || roles.includes("CITY_MANAGER");

  async function load() {
    setError("");
    try {
      setCities(await api("/v1/admin/cities"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    api("/v1/me").then(setMe).catch(() => {});
    load();
  }, []);

  async function saveCity(e) {
    e.preventDefault();
    setError("");
    try {
      if (editCity) {
        await api(`/v1/admin/cities/${editCity}`, { method: "PATCH", body: cityForm });
        setEditCity(null);
      } else {
        await api("/v1/admin/cities", { method: "POST", body: cityForm });
      }
      setCityForm(EMPTY_CITY);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBranch(e) {
    e.preventDefault();
    setError("");
    try {
      if (editBranch) {
        await api(`/v1/admin/branches/${editBranch}`, { method: "PATCH", body: branchForm });
        setEditBranch(null);
      } else {
        await api("/v1/admin/branches", { method: "POST", body: branchForm });
      }
      setBranchForm(EMPTY_BRANCH);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeCity(id) {
    if (!window.confirm("Delete this city?")) return;
    setError("");
    try {
      await api(`/v1/admin/cities/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeBranch(id) {
    if (!window.confirm("Delete this branch?")) return;
    setError("");
    try {
      await api(`/v1/admin/branches/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Cities & branches</h2>
      <p className="muted">
        Every vehicle, booking and driver belongs to a branch. Staff without SUPER_ADMIN only see their assigned city.
      </p>
      {error && <p className="err">{error}</p>}
      {canWrite && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          {(canCreateCity || editCity) && (
            <form className="card" onSubmit={saveCity}>
              <h3>{editCity ? "Edit city" : "Add city"}</h3>
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
              <label className="row">
                <input
                  type="checkbox"
                  checked={cityForm.active}
                  onChange={(e) => setCityForm({ ...cityForm, active: e.target.checked })}
                />
                Active
              </label>
              <div className="row">
                <button type="submit">{editCity ? "Save city" : "Create city"}</button>
                {editCity && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setEditCity(null);
                      setCityForm(EMPTY_CITY);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          <form className="card" onSubmit={saveBranch}>
            <h3>{editBranch ? "Edit branch" : "Add branch"}</h3>
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
            <label className="row">
              <input
                type="checkbox"
                checked={branchForm.active}
                onChange={(e) => setBranchForm({ ...branchForm, active: e.target.checked })}
              />
              Active
            </label>
            <div className="row">
              <button type="submit">{editBranch ? "Save branch" : "Create branch"}</button>
              {editBranch && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditBranch(null);
                    setBranchForm(EMPTY_BRANCH);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {cities.map((city) => (
        <div className="card" key={city.id} style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>
              {city.name} <span className="muted">{city.state}</span>{" "}
              {!city.active && <span className="err">inactive</span>}
            </h3>
            {canWrite && (
              <div className="row">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditCity(city.id);
                    setCityForm({
                      name: city.name,
                      slug: city.slug,
                      state: city.state,
                      active: city.active !== false,
                    });
                  }}
                >
                  Edit
                </button>
                {canCreateCity && (
                  <button type="button" className="ghost" onClick={() => removeCity(city.id)}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="muted">
            {city._count?.branches ?? (city.branches || []).length} branches · {city._count?.staff ?? 0} staff
          </p>
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Address</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(city.branches || []).map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.address}</td>
                  <td>{b.active === false ? "Inactive" : "Active"}</td>
                  <td>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditBranch(b.id);
                            setBranchForm({
                              cityId: city.id,
                              name: b.name,
                              address: b.address || "",
                              active: b.active !== false,
                            });
                          }}
                        >
                          Edit
                        </button>{" "}
                        <button type="button" className="ghost" onClick={() => removeBranch(b.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!(city.branches || []).length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No branches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
