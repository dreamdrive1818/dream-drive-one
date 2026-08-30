"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/cms").then(setRows).catch((e) => setError(e.message));
  }, []);
  return (
    <div>
      <h2>CMS pages</h2>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead><tr><th>Slug</th><th>Title</th><th>Published</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}><td>{p.slug}</td><td>{p.title}</td><td>{p.published ? "yes" : "no"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
