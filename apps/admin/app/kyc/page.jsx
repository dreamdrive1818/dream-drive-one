"use client";
import { Fragment, useEffect, useState } from "react";
import { api } from "../../lib/api";

const FILTERS = ["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "NOT_STARTED"];

export default function KycPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ALL");
  const [openId, setOpenId] = useState("");
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    const q = status === "ALL" ? "" : `?status=${status}`;
    api(`/v1/admin/kyc${q}`).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [status]);

  async function decide(id, next, notes) {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/kyc/${id}/decision`, { method: "POST", body: { status: next, notes } });
      setRejectFor(null);
      setReason("");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(id) {
    try {
      await api(`/v1/admin/kyc/${id}/review`, { method: "POST", body: {} });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function reset(id) {
    try {
      await api(`/v1/admin/kyc/${id}/reset`, { method: "POST", body: {} });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function reupload(id, documentId, kind) {
    const notes = window.prompt(`Ask customer to re-upload ${kind}?`, `Please re-upload ${kind}`) || "";
    if (!notes.trim()) return;
    try {
      await api(`/v1/admin/kyc/${id}/request-reupload`, {
        method: "POST",
        body: { documentId, kind, notes },
      });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2>KYC</h2>
      <p className="muted">SUPPORT and SUPER_ADMIN can decide. SALES can view the queue.</p>
      {error && <p className="err">{error}</p>}
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
              <th>Customer</th>
              <th>Status</th>
              <th>Booking</th>
              <th>DL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <Fragment key={k.id}>
                <tr>
                  <td>
                    {k.user?.email}
                    {k.aadhaarLast4 ? <div className="muted">Aadhaar ****{k.aadhaarLast4}</div> : null}
                  </td>
                  <td>{k.status}</td>
                  <td>{k.booking?.publicId || "—"}</td>
                  <td>
                    {k.dlExpiresOn ? new Date(k.dlExpiresOn).toLocaleDateString("en-IN") : "—"}
                    {k.dlExpired ? <div className="err">Expired</div> : null}
                    {k.dlMissesDropOff ? <div className="err">Before drop-off</div> : null}
                    {k.dlExpiring && !k.dlExpired ? <div className="muted">Expires in 30 days</div> : null}
                  </td>
                  <td className="row">
                    <button className="ghost" onClick={() => setOpenId(openId === k.id ? "" : k.id)}>
                      {openId === k.id ? "Hide" : "Docs"}
                    </button>
                    {k.status === "SUBMITTED" && (
                      <button className="ghost" onClick={() => review(k.id)} disabled={busy}>
                        Review
                      </button>
                    )}
                    <button onClick={() => decide(k.id, "APPROVED")} disabled={busy}>
                      Approve
                    </button>
                    <button className="danger" onClick={() => { setRejectFor(k.id); setReason(k.notes || ""); }} disabled={busy}>
                      Reject
                    </button>
                    <button className="ghost" onClick={() => reset(k.id)} disabled={busy}>
                      Reset
                    </button>
                  </td>
                </tr>
                {openId === k.id && (
                  <tr key={`${k.id}-docs`}>
                    <td colSpan={5}>
                      <div className="stack">
                        {k.notes && <p className="muted">{k.notes}</p>}
                        {(k.documents || []).length === 0 && <p className="muted">No files attached.</p>}
                        {(k.documents || []).map((doc) => (
                          <div key={doc.id} className="row" style={{ alignItems: "flex-start" }}>
                            <div style={{ minWidth: 120 }}>
                              <strong>{doc.kind}</strong>
                              <div className="muted">{doc.status}</div>
                            </div>
                            {doc.url && (
                              <a href={doc.url} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            )}
                            {/\.(png|jpe?g|webp)(\?|$)/i.test(doc.url || "") || String(doc.mimeType || "").startsWith("image/") ? (
                              <img src={doc.url} alt={doc.kind} style={{ maxWidth: 220, borderRadius: 8 }} />
                            ) : null}
                            <button className="ghost" onClick={() => reupload(k.id, doc.id, doc.kind)}>
                              Request re-upload
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No KYC cases.</p>}
      </div>

      {rejectFor && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Reject KYC</h3>
          <label>
            Reason (required)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="row">
            <button className="danger" disabled={busy || !reason.trim()} onClick={() => decide(rejectFor, "REJECTED", reason)}>
              Confirm reject
            </button>
            <button className="ghost" onClick={() => setRejectFor(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
