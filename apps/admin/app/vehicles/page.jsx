"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function SimpleTable({ title, path, columns, createPath, fields }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  function load() {
    api(path).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, []);
  return (
    <div>
      <h2>{title}</h2>
      {error && <p className="err">{error}</p>}
      {createPath && (
        <form
          className="card"
          style={{ marginBottom: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(createPath, { method: "POST", body: form });
              setForm({});
              load();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <div className="row">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button type="submit">Create</button>
        </form>
      )}
      <div className="card">
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  return (
    <SimpleTable
      title="Vehicles"
      path="/v1/admin/vehicles"
      createPath="/v1/admin/vehicles"
      fields={[
        { key: "registration", label: "Registration" },
        { key: "carModelId", label: "Car model id" },
        { key: "branchId", label: "Branch id" },
      ]}
      columns={[
        { key: "registration", label: "Reg" },
        { key: "status", label: "Status" },
        { key: "model", label: "Model", render: (r) => r.carModel?.name },
        { key: "branch", label: "Branch", render: (r) => r.branch?.name },
      ]}
    />
  );
}
