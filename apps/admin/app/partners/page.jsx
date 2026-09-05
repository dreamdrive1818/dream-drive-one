"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const EMPTY = { name: "", email: "", phone: "", active: true };

export default function PartnersPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = me?.roles || [];
  const canWrite = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE");

  function load() {
    api("/v1/me").then(setMe).catch(() => {});
    api("/v1/admin/partners").then(setRows).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/v1/admin/partners", { method: "POST", body: form });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Partners</h2>
      <p className="muted">
        Car owners managed by staff. No partner login. Commission is frozen on the booking when a partner car is assigned.
      </p>
      {error && <p className="err">{error}</p>}

      {canWrite && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Onboard partner</h3>
          <form onSubmit={save}>
            <div className="row">
              <label>
                Name
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Vehicles</th>
              <th>Rules</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/partners/${p.id}`}>{p.name}</Link>
                </td>
                <td>
                  {p.email || "—"}
                  {p.phone ? <div className="muted">{p.phone}</div> : null}
                </td>
                <td>{p.vehicles?.length ?? 0}</td>
                <td>{p.rules?.length ?? 0}</td>
                <td>{p.active ? "yes" : "no"}</td>
                <td className="row">
                  <Link href={`/partners/${p.id}`} className="btn ghost">
                    Open
                  </Link>
                  <Link href={`/partners/${p.id}/ledger`} className="btn ghost">
                    Ledger
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No partners yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
