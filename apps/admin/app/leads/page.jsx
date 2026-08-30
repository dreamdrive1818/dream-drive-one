"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/leads").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Leads</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td><td>{l.email}</td><td>{l.phone}</td><td>{l.status}</td><td>{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
