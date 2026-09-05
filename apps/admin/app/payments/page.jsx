"use client";
import { useEffect, useState } from "react";
import { api, getToken } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function downloadAdminPdf(invoice) {
  const res = await fetch(`${API}/v1/admin/invoices/${invoice.id}/pdf`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new Error("Could not download PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

const INR = (p) => `₹${(p / 100).toLocaleString("en-IN")}`;
const STATUS_COLORS = {
  SUCCESS: "#16a34a",
  CREATED: "#94a3b8",
  PENDING: "#eab308",
  FAILED: "#dc2626",
  REFUNDED: "#7c3aed",
  PARTIALLY_REFUNDED: "#c084fc",
};

function Tabs({ active, onChange }) {
  const tabs = ["Payments", "Invoices", "Deposits", "Recon"];
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t.toLowerCase())}
          style={{
            padding: "8px 20px",
            border: "1px solid #d1d5db",
            borderBottom: active === t.toLowerCase() ? "2px solid #1d4ed8" : "1px solid #d1d5db",
            background: active === t.toLowerCase() ? "#eff6ff" : "#fff",
            fontWeight: active === t.toLowerCase() ? 600 : 400,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function RefundModal({ payment, onClose, onDone }) {
  const [amount, setAmount] = useState(payment.amountPaise / 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/payments/${payment.id}/refund`, {
        method: "POST",
        body: { amountPaise: Math.round(amount * 100) },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, minWidth: 340 }}>
        <h3 style={{ margin: 0 }}>Issue Refund</h3>
        <p style={{ color: "#64748b", fontSize: 13 }}>
          Booking: {payment.booking?.publicId} · Paid: {INR(payment.amountPaise)}
        </p>
        {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
        <label style={{ display: "block", marginBottom: 8 }}>
          Refund amount (₹)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ display: "block", width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={submit} disabled={busy} style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            {busy ? "Processing…" : "Refund"}
          </button>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function OfflineModal({ onClose, onDone }) {
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("TOKEN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!bookingId || !amount) return;
    setBusy(true);
    setError("");
    try {
      await api("/v1/admin/payments/offline", {
        method: "POST",
        body: { bookingId, amountPaise: Math.round(Number(amount) * 100), kind },
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, minWidth: 340 }}>
        <h3 style={{ margin: 0 }}>Record Offline Payment</h3>
        {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
        <label style={{ display: "block", marginBottom: 8, marginTop: 12 }}>
          Booking ID
          <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="Public or internal ID" style={{ display: "block", width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Amount (₹)
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ display: "block", width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ display: "block", width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }}>
            <option value="TOKEN">Token</option>
            <option value="BALANCE">Balance</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="EXTRA">Extra</option>
            <option value="PENALTY">Penalty</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={submit} disabled={busy} style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            {busy ? "Saving…" : "Record Payment"}
          </button>
          <button onClick={onClose} style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [refunding, setRefunding] = useState(null);
  const [showOffline, setShowOffline] = useState(false);

  const load = () =>
    api("/v1/admin/payments").then(setRows).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>All Payments</h3>
        <button onClick={() => setShowOffline(true)} style={{ padding: "6px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          + Record Offline
        </button>
      </div>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "8px 6px" }}>Booking</th>
            <th>Kind</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Refunds</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "8px 6px" }}>{p.booking?.publicId}</td>
              <td>{p.kind}</td>
              <td>
                <span style={{ color: STATUS_COLORS[p.status] || "#475569", fontWeight: 600, fontSize: 13 }}>
                  {p.status}
                </span>
              </td>
              <td>{INR(p.amountPaise)}</td>
              <td>
                {(p.refunds || []).length > 0
                  ? p.refunds.map((r) => INR(r.amountPaise)).join(", ")
                  : "—"}
              </td>
              <td>
                {(p.status === "SUCCESS" || p.status === "PARTIALLY_REFUNDED") && (
                  <button
                    onClick={() => setRefunding(p)}
                    style={{ padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                  >
                    Refund
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {refunding && (
        <RefundModal
          payment={refunding}
          onClose={() => setRefunding(null)}
          onDone={() => { setRefunding(null); load(); }}
        />
      )}
      {showOffline && (
        <OfflineModal
          onClose={() => setShowOffline(false)}
          onDone={() => { setShowOffline(false); load(); }}
        />
      )}
    </>
  );
}

function InvoicesTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api("/v1/admin/invoices").then(setRows).catch((e) => setError(e.message));
  }, []);
  async function onDownload(inv) {
    setBusy(inv.id);
    setError("");
    try {
      await downloadAdminPdf(inv);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <h3>Invoices</h3>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "8px 6px" }}>Number</th>
            <th>Booking</th>
            <th>Amount</th>
            <th>GST</th>
            <th>CGST</th>
            <th>SGST</th>
            <th>IGST</th>
            <th>State</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "8px 6px" }}>{inv.number}</td>
              <td>{inv.booking?.publicId}</td>
              <td>{INR(inv.amountPaise)}</td>
              <td>{INR(inv.gstPaise)}</td>
              <td>{INR(inv.cgstPaise || 0)}</td>
              <td>{INR(inv.sgstPaise || 0)}</td>
              <td>{INR(inv.igstPaise || 0)}</td>
              <td style={{ fontSize: 12, color: "#64748b" }}>
                {inv.supplierState || "—"} → {inv.customerState || "—"}
              </td>
              <td>
                <button
                  onClick={() => onDownload(inv)}
                  disabled={busy === inv.id}
                  style={{ padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  {busy === inv.id ? "…" : "PDF"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function DepositsTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = () =>
    api("/v1/admin/deposits").then(setRows).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  async function action(id, type) {
    setBusy(id);
    try {
      await api(`/v1/admin/deposits/${id}/${type}`, { method: "POST" });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h3>Security Deposits</h3>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "8px 6px" }}>Booking</th>
            <th>Amount</th>
            <th>Held</th>
            <th>Released</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "8px 6px" }}>{d.booking?.publicId}</td>
              <td>{INR(d.amountPaise)}</td>
              <td>{d.held ? "✅ Held" : "—"}</td>
              <td>{d.released ? "✅ Released" : "—"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                {!d.held && !d.released && (
                  <button
                    onClick={() => action(d.id, "capture")}
                    disabled={busy === d.id}
                    style={{ padding: "4px 10px", background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                  >
                    Capture
                  </button>
                )}
                {d.held && !d.released && (
                  <button
                    onClick={() => action(d.id, "release")}
                    disabled={busy === d.id}
                    style={{ padding: "4px 10px", background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                  >
                    Release
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReconTab() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api("/v1/admin/payments/reconcile").then(setRows).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  async function run() {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await api("/v1/admin/payments/reconcile", { method: "POST" });
      setRows(res.rows || []);
      setInfo(res.mock ? `Mock recon: ${res.count} rows` : `Live recon: ${res.count} rows`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const color = {
    MATCHED: "#16a34a",
    OFFLINE: "#64748b",
    MISMATCH: "#dc2626",
    UNMATCHED_RAZORPAY: "#ea580c",
    UNMATCHED_INTERNAL: "#ca8a04",
    PENDING: "#94a3b8",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Razorpay settlement recon</h3>
        <button
          onClick={run}
          disabled={busy}
          style={{ padding: "6px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          {busy ? "Running…" : "Run reconciliation"}
        </button>
      </div>
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {info && <p style={{ color: "#16a34a" }}>{info}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
            <th style={{ padding: "8px 6px" }}>Razorpay payment</th>
            <th>Settlement</th>
            <th>Amount</th>
            <th>Fee</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "8px 6px", fontSize: 12 }}>{r.razorpayPaymentId}</td>
              <td style={{ fontSize: 12 }}>{r.razorpaySettlementId || "—"}</td>
              <td>{INR(r.amountPaise)}</td>
              <td>{INR(r.feePaise || 0)}</td>
              <td style={{ color: color[r.status] || "#475569", fontWeight: 600, fontSize: 13 }}>{r.status}</td>
              <td style={{ fontSize: 12, color: "#64748b" }}>{r.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
  const [tab, setTab] = useState("payments");

  return (
    <div>
      <h2>Payments, Invoices & Deposits</h2>
      <Tabs active={tab} onChange={setTab} />
      <div className="card">
        {tab === "payments" && <PaymentsTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "deposits" && <DepositsTab />}
        {tab === "recon" && <ReconTab />}
      </div>
    </div>
  );
}
