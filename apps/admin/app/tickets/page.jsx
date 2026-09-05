"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];

export default function TicketsPage() {
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [image, setImage] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = me?.roles || [];
  const canOwn = roles.includes("SUPPORT") || roles.includes("SUPER_ADMIN");
  const canInternal = canOwn;

  function load() {
    const qs = new URLSearchParams();
    if (statusFilter) qs.set("status", statusFilter);
    if (overdueOnly) qs.set("overdue", "1");
    api(`/v1/admin/tickets${qs.toString() ? `?${qs}` : ""}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api("/v1/me")
      .then(setMe)
      .catch(() => undefined);
    api("/v1/admin/users?staff=1")
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items || [];
        setStaff(list.filter((u) => (u.roles || []).some((r) => r === "SUPPORT" || r === "SUPER_ADMIN")));
      })
      .catch(() => setStaff([]));
  }, []);

  useEffect(load, [statusFilter, overdueOnly]);

  async function openTicket(id) {
    setError("");
    try {
      setOpen(await api(`/v1/admin/tickets/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function uploadImage() {
    if (!image) return undefined;
    const body = new FormData();
    body.append("file", image);
    body.append("folder", "tickets");
    const uploaded = await api("/v1/uploads", { method: "POST", body });
    return uploaded.url || uploaded.secure_url;
  }

  async function send(e) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const imageUrl = await uploadImage();
      const data = await api(`/v1/admin/tickets/${open.id}/messages`, {
        method: "POST",
        body: { body: reply, internal, imageUrl },
      });
      setOpen(data);
      setReply("");
      setImage(null);
      setInternal(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    if (!open || !canOwn) return;
    setBusy(true);
    try {
      setOpen(await api(`/v1/admin/tickets/${open.id}`, { method: "PATCH", body: { status } }));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assign(assignedToId) {
    if (!open || !canOwn) return;
    setBusy(true);
    try {
      setOpen(
        await api(`/v1/admin/tickets/${open.id}`, {
          method: "PATCH",
          body: { assignedToId: assignedToId || null },
        })
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Support tickets</h2>
      {error && <p className="err">{error}</p>}
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="row" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            style={{ width: "auto" }}
          />
          SLA overdue
        </label>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Subject</th>
              <th>Booking</th>
              <th>Assignee</th>
              <th>SLA</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((t) => (
              <tr key={t.id}>
                <td>{t.user?.email}</td>
                <td>{t.subject}</td>
                <td>{t.booking?.publicId || "—"}</td>
                <td>{t.assignedTo?.email || "Unassigned"}</td>
                <td>{t.slaOverdue ? "Overdue" : t.slaDueAt ? new Date(t.slaDueAt).toLocaleString() : "—"}</td>
                <td>{t.status}</td>
                <td>
                  <button className="ghost" type="button" onClick={() => openTicket(t.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="card">
          <h3>{open.subject}</h3>
          <p className="muted">
            {open.user?.email} · {open.status}
            {open.booking?.publicId ? ` · booking ${open.booking.publicId}` : ""}
            {open.slaOverdue ? " · SLA overdue" : ""}
          </p>
          {canOwn && (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                {STATUSES.map((s) => (
                  <button key={s} className="ghost" type="button" disabled={busy} onClick={() => setStatus(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <label>
                Assign to SUPPORT
                <select
                  value={open.assignedToId || ""}
                  onChange={(e) => assign(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Unassigned</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.profile?.fullName || u.email}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(open.messages || []).map((m) => (
            <p key={m.id} className="muted">
              {m.internal ? "[internal] " : ""}
              {m.body}
              {m.imageUrl ? (
                <>
                  <br />
                  <a href={m.imageUrl} target="_blank" rel="noreferrer">
                    Attachment
                  </a>
                </>
              ) : null}
              <br />
              {new Date(m.createdAt).toLocaleString()}
            </p>
          ))}
          <form onSubmit={send}>
            <label>
              Reply
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} required={!image} />
            </label>
            <label>
              Image
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </label>
            {canInternal && (
              <label className="row">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Internal note (hidden from customer)
              </label>
            )}
            <button type="submit" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
