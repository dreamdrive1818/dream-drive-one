"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/users").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Customers / staff</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Roles</th><th>KYC</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.fullName}</td>
                <td>{(u.roles || []).join(", ")}</td>
                <td>{u.kycStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
