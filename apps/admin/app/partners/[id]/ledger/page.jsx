"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

function inr(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function ymd(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function PartnerLedgerPage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [partner, setPartner] = useState(null);
  const [ledger, setLedger] = useState({ entries: [], balancePaise: 0 });
  const [period, setPeriod] = useState({ start: "", end: "" });
  const [adjust, setAdjust] = useState({ amount: "", note: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const roles = me?.roles || [];
  const canGenerate = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE") || roles.includes("CITY_MANAGER");
  const canAdjust = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE");

  function load() {
    api("/v1/me").then(setMe).catch(() => {});
    api(`/v1/admin/partners/${id}`).then(setPartner).catch((e) => setError(e.message));
    api(`/v1/admin/partners/${id}/ledger`).then(setLedger).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!id) return;
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    setPeriod({ start: ymd(start), end: ymd(end) });
    load();
  }, [id]);

  async function generate(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    try {
      const created = await api("/v1/admin/settlements/generate", {
        method: "POST",
        body: {
          partnerId: id,
          periodStart: new Date(period.start).toISOString(),
          periodEnd: new Date(`${period.end}T23:59:59.000Z`).toISOString(),
        },
      });
      setResult(created);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function postAdjust(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/admin/partners/${id}/ledger/adjust`, {
        method: "POST",
        body: { amountPaise: Math.round(Number(adjust.amount) * 100), note: adjust.note },
      });
      setAdjust({ amount: "", note: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Link href={`/partners/${id}`} className="muted">
          ← {partner?.name || "Partner"}
        </Link>
        <Link href="/settlements" className="btn ghost">
          Settlements
        </Link>
      </div>
      <h2>Ledger</h2>
      <p className="muted">Balance {inr(ledger.balancePaise)}. CITY_MANAGER can propose a settlement; only Finance can mark it paid.</p>
      {error && <p className="err">{error}</p>}

      {canGenerate && (
        <div className="card">
          <h3>Generate settlement</h3>
          <form onSubmit={generate} className="row">
            <label>
              From
              <input type="date" required value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
            </label>
            <label>
              To
              <input type="date" required value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
            </label>
            <button type="submit">Generate</button>
          </form>
          {result && (
            <p className="muted" style={{ marginTop: 8 }}>
              {inr(result.amountPaise)} · {result.held ? `HOLD: ${result.holdReason}` : "Ready to pay"} · {result.lines?.length || 0} lines
            </p>
          )}
        </div>
      )}

      {canAdjust && (
        <div className="card">
          <h3>Adjustment</h3>
          <form onSubmit={postAdjust} className="row">
            <label>
              Amount ₹ (negative to debit)
              <input type="number" step="0.01" required value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
            </label>
            <label>
              Note
              <input required value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
            </label>
            <button type="submit">Post</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Booking</th>
              <th>Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {(ledger.entries || []).map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString("en-IN")}</td>
                <td>{e.type}</td>
                <td>{e.booking?.publicId || "—"}</td>
                <td>{inr(e.amountPaise)}</td>
                <td>{e.note || "—"}</td>
              </tr>
            ))}
            {!(ledger.entries || []).length && (
              <tr>
                <td colSpan={5} className="muted">
                  No ledger entries yet. They post when a partner trip is completed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
