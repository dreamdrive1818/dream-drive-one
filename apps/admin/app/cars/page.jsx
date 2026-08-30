"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function CarsPage() {
  const [rows, setRows] = useState([]);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState({ name: "", slug: "", type: "hatchback", seats: 5, fuel: "petrol", transmission: "manual", cityId: "" });
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/car-models").then(setRows).catch((e) => setError(e.message));
    api("/v1/admin/cities").then(setCities).catch(() => {});
  }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api("/v1/admin/car-models", { method: "POST", body: { ...form, published: true, seats: Number(form.seats) } });
      setForm({ ...form, name: "", slug: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Car models</h2>
      {error && <p className="err">{error}</p>}
      <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
        <div className="row">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></label>
          <label>Type<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
          <label>City
            <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              <option value="">Select</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <button type="submit">Add car</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>City</th><th>Published</th><th>Vehicles</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.city?.name}</td>
                <td>{c.published ? "yes" : "no"}</td>
                <td>{c.vehicles?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
