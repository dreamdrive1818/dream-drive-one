"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function KycPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  function load() {
    api("/v1/admin/kyc").then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, []);
  async function decide(id, status) {
    try {
      await api(`/v1/admin/kyc/${id}/decision`, { method: "POST", body: { status } });
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div>
      <h2>KYC</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Customer</th><th>Status</th><th>Booking</th><th></th></tr></thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.id}>
                <td>{k.user?.email}</td>
                <td>{k.status}</td>
                <td>{k.booking?.publicId}</td>
                <td className="row">
                  <button onClick={() => decide(k.id, "APPROVED")}>Approve</button>
                  <button className="danger" onClick={() => decide(k.id, "REJECTED")}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
