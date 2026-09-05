"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, getToken } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TABS = [
  ["revenue", "Revenue"],
  ["bookings", "Bookings"],
  ["deposits", "Deposits"],
  ["partners", "Partners"],
  ["gst", "GST"],
  ["mismatch", "Razorpay mismatch"],
];

function inr(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function monthStartIst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

async function downloadCsv(path, filename) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
      "x-ops-city-id": localStorage.getItem("dd_ops_city") || "",
      "x-ops-branch-id": localStorage.getItem("dd_ops_branch") || "",
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Loading reports…</p>}>
      <ReportsPage />
    </Suspense>
  );
}

function ReportsPage() {
  const search = useSearchParams();
  const initial = search.get("tab") || "revenue";
  const seed = useMemo(monthStartIst, []);
  const [tab, setTab] = useState(TABS.some(([id]) => id === initial) ? initial : "revenue");
  const [from, setFrom] = useState(seed.from);
  const [to, setTo] = useState(seed.to);
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState([]);
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [series, setSeries] = useState(null);
  const [form, setForm] = useState({ prefix: "", gstin: "", nextNumber: 1, fyLabel: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = me?.roles || [];
  const isCityManager = roles.includes("CITY_MANAGER") && !roles.includes("SUPER_ADMIN") && !roles.includes("FINANCE");
  const canMarkSeries = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE");
  const visibleTabs = isCityManager ? TABS.filter(([id]) => ["revenue", "bookings", "deposits", "gst"].includes(id)) : TABS;

  function qs() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (cityId) params.set("cityId", cityId);
    const s = params.toString();
    return s ? `?${s}` : "";
  }

  function load(nextTab = tab) {
    setError("");
    api(`/v1/admin/reports/${nextTab}${qs()}`)
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e.message);
      });
  }

  useEffect(() => {
    api("/v1/me").then(setMe).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => setCities([]));
    api("/v1/admin/finance/invoice-series")
      .then((row) => {
        setSeries(row);
        setForm({
          prefix: row.prefix || "",
          gstin: row.gstin || "",
          nextNumber: row.nextNumber || 1,
          fyLabel: row.fyLabel || "",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function onExport() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await downloadCsv(`/v1/admin/reports/${tab}/export${qs()}`, `dreamdrive-${tab}-${from}-${to}.csv`);
      setInfo("CSV downloaded. Export is written to the audit log.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSeries(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const row = await api("/v1/admin/finance/invoice-series", {
        method: "PUT",
        body: {
          prefix: form.prefix,
          gstin: form.gstin || null,
          nextNumber: Number(form.nextNumber),
          fyLabel: form.fyLabel,
        },
      });
      setSeries(row);
      setInfo(`GST series marked: next invoice will be ${row.prefix}${String(row.nextNumber).padStart(5, "0")}`);
      if (tab === "gst") load("gst");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const totals = data?.totals || {};

  return (
    <div className="stack">
      <h2>Finance reports</h2>
      <p className="muted">
        Date range is Asia/Kolkata. CITY_MANAGER sees own city only. CSV export is audited.
      </p>
      {error && <p className="err">{error}</p>}
      {info && <p className="muted">{info}</p>}

      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          load(tab);
        }}
      >
        <label>
          From (IST)
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To (IST)
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {!isCityManager && (
          <label>
            City
            <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">Run</button>
        <button type="button" className="ghost" disabled={busy} onClick={onExport}>
          {busy ? "Exporting…" : "Export CSV"}
        </button>
      </form>

      <div className="tabs">
        {visibleTabs.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {data && (
        <div className="grid">
          {tab === "revenue" && (
            <>
              <div className="card">
                <h3>Collections</h3>
                <strong>{inr(totals.collectionsPaise)}</strong>
              </div>
              <div className="card">
                <h3>Refunds</h3>
                <strong>{inr(totals.refundsPaise)}</strong>
              </div>
              <div className="card">
                <h3>Net</h3>
                <strong>{inr(totals.netPaise)}</strong>
              </div>
              <div className="card">
                <h3>Outstanding balances</h3>
                <strong>{inr(totals.outstandingPaise)}</strong>
              </div>
            </>
          )}
          {tab === "bookings" && (
            <>
              <div className="card">
                <h3>Bookings</h3>
                <strong>{totals.count ?? 0}</strong>
              </div>
              <div className="card">
                <h3>Booked value</h3>
                <strong>{inr(totals.amountPaise)}</strong>
              </div>
              <div className="card">
                <h3>Collected</h3>
                <strong>{inr(totals.paidPaise)}</strong>
              </div>
              <div className="card">
                <h3>Outstanding</h3>
                <strong>{inr(totals.outstandingPaise)}</strong>
              </div>
            </>
          )}
          {tab === "deposits" && (
            <>
              <div className="card">
                <h3>Deposit liability</h3>
                <strong>{inr(totals.liabilityPaise)}</strong>
              </div>
              <div className="card">
                <h3>Held now</h3>
                <strong>{totals.outstandingCount ?? 0}</strong>
              </div>
            </>
          )}
          {tab === "partners" && (
            <>
              <div className="card">
                <h3>Unpaid payouts</h3>
                <strong>{inr(totals.unpaidPaise)}</strong>
              </div>
              <div className="card">
                <h3>Paid in range</h3>
                <strong>{inr(totals.paidPaise)}</strong>
              </div>
              <div className="card">
                <h3>On hold</h3>
                <strong>{totals.heldCount ?? 0}</strong>
              </div>
            </>
          )}
          {tab === "gst" && (
            <>
              <div className="card">
                <h3>Taxable</h3>
                <strong>{inr(totals.taxablePaise)}</strong>
              </div>
              <div className="card">
                <h3>CGST</h3>
                <strong>{inr(totals.cgstPaise)}</strong>
              </div>
              <div className="card">
                <h3>SGST</h3>
                <strong>{inr(totals.sgstPaise)}</strong>
              </div>
              <div className="card">
                <h3>IGST</h3>
                <strong>{inr(totals.igstPaise)}</strong>
              </div>
            </>
          )}
          {tab === "mismatch" && (
            <>
              <div className="card">
                <h3>Open mismatches</h3>
                <strong>{totals.count ?? 0}</strong>
              </div>
              <div className="card">
                <h3>Amount</h3>
                <strong>{inr(totals.amountPaise)}</strong>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "revenue" && data?.byCity?.length > 0 && (
        <div className="card">
          <h3>P&amp;L-lite by city</h3>
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>Collections</th>
                <th>Refunds</th>
                <th>Net</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.byCity.map((c) => (
                <tr key={c.cityId || c.cityName}>
                  <td>{c.cityName}</td>
                  <td>{inr(c.collectionsPaise)}</td>
                  <td>{inr(c.refundsPaise)}</td>
                  <td>{inr(c.netPaise)}</td>
                  <td>{inr(c.outstandingPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gst" && canMarkSeries && (
        <div className="card">
          <h3>GST invoice series</h3>
          <p className="muted">
            Next number: {series ? `${series.prefix}${String(series.nextNumber).padStart(5, "0")}` : "—"} · FY {series?.fyLabel || form.fyLabel}
          </p>
          <form onSubmit={saveSeries}>
            <div className="row">
              <label>
                Prefix
                <input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
              </label>
              <label>
                FY label
                <input value={form.fyLabel} onChange={(e) => setForm({ ...form, fyLabel: e.target.value })} />
              </label>
              <label>
                Next number
                <input
                  type="number"
                  min="1"
                  value={form.nextNumber}
                  onChange={(e) => setForm({ ...form, nextNumber: e.target.value })}
                />
              </label>
              <label>
                GSTIN
                <input
                  value={form.gstin}
                  maxLength={15}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                />
              </label>
            </div>
            <button type="submit" disabled={busy}>
              Mark series
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <Table tab={tab} data={data} />
      </div>
    </div>
  );
}

function Table({ tab, data }) {
  if (!data) return <p className="muted">Loading…</p>;
  if (tab === "revenue") {
    const rows = data.rows || [];
    if (!rows.length) return <p className="muted">No collections in this range.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Date (IST)</th>
            <th>Booking</th>
            <th>City</th>
            <th>Kind</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.createdIst}</td>
              <td>{r.bookingPublicId}</td>
              <td>{r.cityName}</td>
              <td>{r.kind}</td>
              <td>{inr(r.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "bookings") {
    const rows = data.rows || [];
    if (!rows.length) return <p className="muted">No bookings in this range.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Status</th>
            <th>City</th>
            <th>Value</th>
            <th>Paid</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.publicId}</td>
              <td>{r.status}</td>
              <td>{r.cityName}</td>
              <td>{inr(r.amountPaise)}</td>
              <td>{inr(r.paidPaise)}</td>
              <td>{inr(r.outstandingPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "deposits") {
    const rows = data.outstanding || [];
    if (!rows.length) return <p className="muted">No held deposits.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Booking</th>
            <th>City</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.bookingPublicId}</td>
              <td>{r.cityName}</td>
              <td>{inr(r.amountPaise)}</td>
              <td>{r.bookingStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "partners") {
    const rows = data.rows || [];
    if (!rows.length) return <p className="muted">No settlements in this range.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Partner</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Held</th>
            <th>UTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.partnerName}</td>
              <td>{inr(r.amountPaise)}</td>
              <td>{r.paid ? "Paid" : "Open"}</td>
              <td>{r.held ? r.holdReason || "Hold" : "—"}</td>
              <td>{r.utr || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (tab === "gst") {
    const rows = data.rows || [];
    if (!rows.length) return <p className="muted">No tax invoices in this range.</p>;
    return (
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Booking</th>
            <th>City</th>
            <th>Taxable</th>
            <th>CGST</th>
            <th>SGST</th>
            <th>IGST</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td>
              <td>{r.bookingPublicId}</td>
              <td>{r.cityName}</td>
              <td>{inr(r.taxablePaise)}</td>
              <td>{inr(r.cgstPaise)}</td>
              <td>{inr(r.sgstPaise)}</td>
              <td>{inr(r.igstPaise)}</td>
              <td>{inr(r.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const rows = data.rows || [];
  if (!rows.length) return <p className="muted">No Razorpay mismatches. Run recon from Payments if the queue is empty.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Razorpay payment</th>
          <th>Settlement</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.razorpayPaymentId}</td>
            <td>{r.razorpaySettlementId || "—"}</td>
            <td>{inr(r.amountPaise)}</td>
            <td>{r.status}</td>
            <td>{r.notes || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
