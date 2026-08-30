"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/partners").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Partners</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Vehicles</th><th>Active</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.email}</td><td>{p.vehicles?.length ?? 0}</td><td>{p.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
