"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/admin/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid">
        <div className="card"><h3>Bookings</h3><strong>{data.bookings}</strong></div>
        <div className="card"><h3>Pending KYC</h3><strong>{data.pendingKyc}</strong></div>
        <div className="card"><h3>Vehicles free</h3><strong>{data.vehiclesAvailable}</strong></div>
        <div className="card"><h3>Revenue</h3><strong>₹{(data.revenuePaise / 100).toLocaleString("en-IN")}</strong></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>By status</h3>
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {(data.byStatus || []).map((row) => (
              <tr key={row.status}><td>{row.status}</td><td>{row._count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
