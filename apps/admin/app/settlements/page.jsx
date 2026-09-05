"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function inr(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function ymd(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function hasBank(partner) {
  const b = partner?.bankJson || {};
  return Boolean(b.accountName && b.accountNumber && b.ifsc);
}

export default function SettlementsPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState({ partnerId: "", start: "", end: "", all: false });
  const [utr, setUtr] = useState({});
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState(null);

  const roles = me?.roles || [];
  const canGenerate = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE") || roles.includes("CITY_MANAGER");
  const canPay = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE");

  function load() {
    api("/v1/me").then(setMe).catch(() => {});
    api("/v1/admin/settlements").then(setRows).catch((e) => setError(e.message));
    api("/v1/admin/partners").then(setPartners).catch(() => {});
  }

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    setForm((f) => ({ ...f, start: ymd(start), end: ymd(end) }));
    load();
  }, []);

  async function generate(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/settlements/generate", {
        method: "POST",
        body: {
          all: form.all,
          partnerId: form.all ? undefined : form.partnerId,
          periodStart: new Date(form.start).toISOString(),
          periodEnd: new Date(`${form.end}T23:59:59.000Z`).toISOString(),
        },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markPaid(id) {
    setError("");
    try {
      await api(`/v1/admin/settlements/${id}/mark-paid`, {
        method: "POST",
        body: { utr: utr[id] || undefined },
      });
      load();
      if (openId === id) setDetail(await api(`/v1/admin/settlements/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function release(id) {
    setError("");
    try {
      await api(`/v1/admin/settlements/${id}/release-hold`, { method: "POST", body: {} });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function open(id) {
    setOpenId(id);
    try {
      setDetail(await api(`/v1/admin/settlements/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h2>Settlements</h2>
      <p className="muted">
        Period payouts for partner cars. Open damage holds the payout. Bank details are required before mark-paid. CITY_MANAGER can generate, not pay.
      </p>
      {error && <p className="err">{error}</p>}

      {canGenerate && (
        <div className="card">
          <h3>Generate period</h3>
          <form onSubmit={generate}>
            <div className="row">
              <label>
                Partner
                <select
                  value={form.all ? "all" : form.partnerId}
                  onChange={(e) =>
                    setForm({ ...form, all: e.target.value === "all", partnerId: e.target.value === "all" ? "" : e.target.value })
                  }
                >
                  <option value="">Select</option>
                  <option value="all">All active partners</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label>
                To
                <input type="date" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
            <button type="submit">Generate</button>
          </form>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Partner</th>
              <th>Period</th>
              <th>Amount</th>
              <th>Status</th>
              <th>UTR</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/partners/${s.partnerId}`}>{s.partner?.name || s.partnerId}</Link>
                </td>
                <td>
                  {ymd(s.periodStart)} → {ymd(s.periodEnd)}
                </td>
                <td>{inr(s.amountPaise)}</td>
                <td>
                  {s.paid ? "Paid" : s.held ? "Held" : "Proposed"}
                  {s.held && s.holdReason ? <div className="muted">{s.holdReason}</div> : null}
                </td>
                <td>{s.utr || "—"}</td>
                <td className="row">
                  <button type="button" className="ghost" onClick={() => open(s.id)}>
                    Lines
                  </button>
                  {s.held && !s.paid && canGenerate && (
                    <button type="button" className="ghost" onClick={() => release(s.id)}>
                      Recheck hold
                    </button>
                  )}
                  {canPay && !s.paid && (
                    <>
                      <input
                        placeholder="UTR"
                        value={utr[s.id] || ""}
                        onChange={(e) => setUtr({ ...utr, [s.id]: e.target.value })}
                        style={{ width: 120 }}
                      />
                      <button type="button" onClick={() => markPaid(s.id)} disabled={s.held || !hasBank(s.partner)}>
                        Mark paid
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No settlements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && openId === detail.id && (
        <div className="card">
          <h3>Lines · {detail.partner?.name}</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Booking</th>
                <th>Amount</th>
                <th>Included</th>
              </tr>
            </thead>
            <tbody>
              {(detail.lines || []).map((line) => (
                <tr key={line.id}>
                  <td>{line.ledger?.type}</td>
                  <td>{line.ledger?.booking?.publicId || "—"}</td>
                  <td>{inr(line.ledger?.amountPaise)}</td>
                  <td>{line.excluded ? line.excludeReason || "Excluded" : "Yes"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
