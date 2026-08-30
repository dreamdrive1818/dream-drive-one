"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function BookingsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  function load() {
    api("/v1/admin/bookings").then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function act(id, path, body) {
    setBusy(id + path);
    try {
      await api(`/v1/admin/bookings/${id}${path}`, { method: "POST", body });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h2>Bookings</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Customer</th><th>Status</th><th>When</th><th>Amount</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.publicId}</td>
                <td>{b.user?.email}</td>
                <td>{b.status}</td>
                <td>{new Date(b.startsAt).toLocaleString()}</td>
                <td>₹{(b.amountPaise / 100).toLocaleString("en-IN")}</td>
                <td className="row">
                  <button className="ghost" disabled={busy} onClick={() => act(b.id, "/status", { status: "CONFIRMED" })}>Confirm</button>
                  <button className="ghost" disabled={busy} onClick={() => act(b.id, "/handover", { odometerKm: 12000, fuelLevel: "full" })}>Handover</button>
                  <button className="ghost" disabled={busy} onClick={() => act(b.id, "/return", { odometerKm: 12100, fuelLevel: "half" })}>Return</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
