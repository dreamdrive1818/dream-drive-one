"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getToken } from "../../lib/api";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const FILTERS = ["ALL", "DRAFT", "SENT", "SIGNED", "WAIVED", "VOID"];
const RENTAL_TYPES = ["", "SELF_DRIVE", "WITH_DRIVER_LOCAL", "WITH_DRIVER_INTERCITY", "AIRPORT", "OUTSTATION", "SUBSCRIPTION"];

async function downloadPdf(id, signed) {
  const path = signed ? `/v1/me/agreements/${id}/signed-pdf` : `/v1/admin/agreements/${id}/pdf`;
  const res = await fetch(`${API}${path}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) throw new Error("Could not download PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = signed ? `agreement-signed.pdf` : `agreement.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgreementsPage() {
  const [tab, setTab] = useState("agreements");
  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [cities, setCities] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [form, setForm] = useState({
    id: "",
    name: "",
    html: "",
    cityId: "",
    rentalType: "",
    active: true,
  });

  function loadAgreements() {
    const q = status === "ALL" ? "" : `?status=${status}`;
    api(`/v1/admin/agreements${q}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  function loadTemplates() {
    api("/v1/admin/agreement-templates")
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api("/v1/public/cities")
      .then((data) => setCities(Array.isArray(data) ? data : data.cities || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === "agreements") loadAgreements();
    else loadTemplates();
  }, [tab, status]);

  async function act(label, fn) {
    setBusy(label);
    setError("");
    try {
      await fn();
      if (tab === "agreements") loadAgreements();
      else loadTemplates();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h2>Agreements</h2>
      <p className="muted">Generate PDF, send Leegality, wet-ink waiver, void / re-issue. SUPER_ADMIN voids.</p>
      {error && <p className="err">{error}</p>}
      <div className="tabs">
        <button className={tab === "agreements" ? "active" : ""} onClick={() => setTab("agreements")}>
          Envelopes
        </button>
        <button className={tab === "templates" ? "active" : ""} onClick={() => setTab("templates")}>
          Templates
        </button>
      </div>

      {tab === "agreements" && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Generate from booking</h3>
            <div className="row">
              <input
                placeholder="Booking id or public id"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              />
              <button
                disabled={busy || !bookingId.trim()}
                onClick={() =>
                  act("generate", () =>
                    api("/v1/agreements/generate", { method: "POST", body: { bookingId: bookingId.trim() } })
                  )
                }
              >
                Generate
              </button>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            {FILTERS.map((s) => (
              <button key={s} className={status === s ? "" : "ghost"} onClick={() => setStatus(s)}>
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Envelope</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">No agreements.</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/bookings/${row.booking?.id || row.bookingId}`}>{row.booking?.publicId || row.bookingId}</Link>
                    </td>
                    <td>{row.booking?.user?.profile?.fullName || row.booking?.user?.email || "—"}</td>
                    <td>{row.status}</td>
                    <td>{row.envelope?.status || "—"}</td>
                    <td className="row">
                      <button className="ghost" onClick={() => downloadPdf(row.id, false).catch((e) => setError(e.message))}>
                        PDF
                      </button>
                      {(row.status === "SIGNED" || row.status === "WAIVED") && (
                        <button className="ghost" onClick={() => downloadPdf(row.id, true).catch((e) => setError(e.message))}>
                          Signed
                        </button>
                      )}
                      {row.status === "DRAFT" && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() => act(`send-${row.id}`, () => api(`/v1/agreements/${row.id}/send-leegality`, { method: "POST", body: {} }))}
                        >
                          Send eSign
                        </button>
                      )}
                      {row.status !== "VOID" && row.status !== "SIGNED" && row.status !== "WAIVED" && (
                        <button
                          disabled={busy}
                          onClick={() => act(`sign-${row.id}`, () => api(`/v1/admin/agreements/${row.id}/mark-signed`, { method: "POST", body: {} }))}
                        >
                          Mark signed
                        </button>
                      )}
                      {row.status !== "VOID" && (
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt("Void reason?", "Re-issue") || "";
                            if (!reason.trim()) return;
                            const reissue = window.confirm("Also generate a replacement agreement?");
                            return act(`void-${row.id}`, () =>
                              api(`/v1/admin/agreements/${row.id}/void`, { method: "POST", body: { reason, reissue } })
                            );
                          }}
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "templates" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <h3>{form.id ? "Edit template" : "New template"}</h3>
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              City
              <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product
              <select value={form.rentalType} onChange={(e) => setForm({ ...form, rentalType: e.target.value })}>
                {RENTAL_TYPES.map((t) => (
                  <option key={t || "all"} value={t}>
                    {t || "All products"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              HTML
              <textarea
                value={form.html}
                onChange={(e) => setForm({ ...form, html: e.target.value })}
                placeholder="Use {{publicId}} {{customer}} {{vehicle}} {{registration}} {{startsAt}} {{endsAt}} {{amount}} {{deposit}} {{city}} {{state}} {{jurisdiction}}"
              />
            </label>
            <div className="row">
              <button
                disabled={busy || !form.name || !form.html}
                onClick={() =>
                  act("save", async () => {
                    const body = {
                      name: form.name,
                      html: form.html,
                      cityId: form.cityId || null,
                      rentalType: form.rentalType || null,
                      active: form.active,
                    };
                    if (form.id) await api(`/v1/admin/agreement-templates/${form.id}`, { method: "PATCH", body });
                    else await api("/v1/admin/agreement-templates", { method: "POST", body });
                    setForm({ id: "", name: "", html: "", cityId: "", rentalType: "", active: true });
                  })
                }
              >
                Save
              </button>
              {form.id && (
                <button className="ghost" onClick={() => setForm({ id: "", name: "", html: "", cityId: "", rentalType: "", active: true })}>
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="card">
            <h3>Saved templates</h3>
            {templates.length === 0 && <p className="muted">None yet — generate uses the built-in default.</p>}
            {templates.map((t) => (
              <div key={t.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                <strong>{t.name}</strong>
                <p className="muted">
                  {t.city?.name || "All cities"} · {t.rentalType || "All products"} · {t.active ? "active" : "inactive"}
                </p>
                <div className="row">
                  <button className="ghost" onClick={() => setForm({
                    id: t.id,
                    name: t.name,
                    html: t.html,
                    cityId: t.cityId || "",
                    rentalType: t.rentalType || "",
                    active: t.active,
                  })}>
                    Edit
                  </button>
                  {t.active && (
                    <button
                      className="danger"
                      onClick={() => act(`del-${t.id}`, () => api(`/v1/admin/agreement-templates/${t.id}`, { method: "DELETE" }))}
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
