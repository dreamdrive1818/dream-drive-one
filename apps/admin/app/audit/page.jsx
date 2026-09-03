"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/admin/audit?take=200")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Audit log</h2>
      <p className="muted">Privileged identity actions (login, roles, invite, disable).</p>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.actor?.email || r.actorId || "—"}</td>
                <td>{r.action}</td>
                <td>{r.entityId || r.entity}</td>
                <td>{r.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
