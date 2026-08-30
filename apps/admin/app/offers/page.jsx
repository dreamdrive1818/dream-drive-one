"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/offers").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>Offers</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Redemptions</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.code}</td><td>{o.type}</td><td>{o.value}</td><td>{o.redemptions?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
