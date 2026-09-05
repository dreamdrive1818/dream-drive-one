"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const row = await api(`/v1/admin/customers/${id}`);
      setData(row);
      setName(row.fullName || "");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function addNote(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/v1/admin/customers/${id}/notes`, { method: "POST", body: { note } });
      setNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function overrideName(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/v1/admin/customers/${id}`, { method: "PATCH", body: { fullName: name } });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetKyc(kycId) {
    if (!window.confirm("Ask the customer to resubmit KYC?")) return;
    setBusy(true);
    try {
      await api(`/v1/admin/kyc/${kycId}/reset`, { method: "POST", body: {} });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="muted">Loading customer…</p>;

  return (
    <div>
      <p className="muted">
        <Link href="/customers">← Customers</Link>
        {" · "}Read-only view — impersonation is not allowed
      </p>
      <h2>{data?.fullName || data?.email}</h2>
      {error && <p className="err">{error}</p>}
      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Email</h3>
          <strong style={{ fontSize: 16 }}>{data?.email}</strong>
        </div>
        <div className="card">
          <h3>Phone</h3>
          <strong style={{ fontSize: 16 }}>{data?.phone || "—"}</strong>
        </div>
        <div className="card">
          <h3>KYC</h3>
          <strong style={{ fontSize: 16 }}>{data?.kycStatus}</strong>
        </div>
        <div className="card">
          <h3>Status</h3>
          <strong style={{ fontSize: 16 }}>{data?.status}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Name override (KYC lock)</h3>
        <form className="row" onSubmit={overrideName}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" disabled={busy}>
            Save name
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Bookings</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(data?.bookings || []).map((b) => (
              <tr key={b.id}>
                <td>{b.publicId}</td>
                <td>{b.status}</td>
                <td>₹{((b.amountPaise || 0) / 100).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>KYC cases</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Booking</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.documents?.kyc || []).map((k) => (
              <tr key={k.id}>
                <td>{k.status}</td>
                <td>{k.booking?.publicId || "—"}</td>
                <td>
                  {k.status !== "NOT_STARTED" && (
                    <button className="ghost" type="button" disabled={busy} onClick={() => resetKyc(k.id)}>
                      Reset request
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Internal notes</h3>
        <form className="row" onSubmit={addNote}>
          <input
            placeholder="Add a note the customer cannot see"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Add note
          </button>
        </form>
        <ul>
          {(data?.notes || []).map((n) => (
            <li key={n.id}>
              {n.payload?.note || n.action} — {n.actor?.email} — {new Date(n.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Tickets</h3>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.tickets || []).map((t) => (
              <tr key={t.id}>
                <td>{t.subject}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
