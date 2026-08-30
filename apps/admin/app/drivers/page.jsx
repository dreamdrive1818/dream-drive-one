"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/drivers").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Drivers</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Branch</th><th>Active</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.fullName}</td><td>{d.phone}</td><td>{d.branch?.name}</td><td>{d.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
