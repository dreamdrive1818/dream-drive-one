"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/reports/revenue").then((d) => setInvoices(d.payments || [])).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Payments</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Booking</th><th>Kind</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>
            {invoices.map((p) => (
              <tr key={p.id}>
                <td>{p.booking?.publicId}</td>
                <td>{p.kind}</td>
                <td>{p.status}</td>
                <td>₹{(p.amountPaise / 100).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
