"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

function rupees(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function fuelLabel(ins) {
  if (!ins) return "—";
  return ins.fuelUnit === "PERCENT" ? `${ins.fuelLevel}%` : `${ins.fuelLevel}/8`;
}

export default function InspectionsPage() {
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    api(`/v1/admin/inspections${params.toString() ? `?${params}` : ""}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [type, status]);

  async function closeInspection(id) {
    setBusy(id);
    setError("");
    try {
      await api(`/v1/admin/inspections/${id}/close`, { method: "POST", body: {} });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h2>Inspections</h2>
      <p className="muted">Handover and return photo logs. Close a return to release the deposit.</p>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="HANDOVER">Handover</option>
          <option value="RETURN">Return</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
        <input placeholder="Booking id" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="ghost" onClick={load}>
          Search
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Booking</th>
            <th>Type</th>
            <th>Vehicle</th>
            <th>Odo / fuel</th>
            <th>Damages</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                No inspections yet.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const damageTotal = (row.damages || []).reduce((s, d) => s + (d.amountPaise || 0), 0);
            return (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                <td>
                  <Link href={`/bookings/${row.booking?.id || row.bookingId}`}>{row.booking?.publicId || row.bookingId}</Link>
                  <div className="muted">{row.booking?.status}</div>
                </td>
                <td>{row.type}</td>
                <td>{row.vehicle?.registration || "—"}</td>
                <td>
                  {row.odometerKm} km
                  <div className="muted">{fuelLabel(row)}</div>
                </td>
                <td>{damageTotal ? rupees(damageTotal) : "—"}</td>
                <td>{row.status}</td>
                <td>
                  {row.type === "RETURN" && row.status === "OPEN" ? (
                    <button type="button" disabled={busy === row.id} onClick={() => closeInspection(row.id)}>
                      Close
                    </button>
                  ) : (
                    <Link className="btn ghost" href={`/bookings/${row.booking?.id || row.bookingId}`}>
                      Open booking
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
