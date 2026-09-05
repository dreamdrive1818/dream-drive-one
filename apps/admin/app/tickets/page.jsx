"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function TicketsPage() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api("/v1/admin/tickets")
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function openTicket(id) {
    setError("");
    try {
      setOpen(await api(`/v1/admin/tickets/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function send(e) {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      const data = await api(`/v1/admin/tickets/${open.id}/messages`, {
        method: "POST",
        body: { body: reply, internal },
      });
      setOpen(data);
      setReply("");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    if (!open) return;
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

  return (
    <div>
      <h2>Support tickets</h2>
      {error && <p className="err">{error}</p>}
      <div className="card" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Subject</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((t) => (
              <tr key={t.id}>
                <td>{t.user?.email}</td>
                <td>{t.subject}</td>
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
          </p>
          <div className="row" style={{ marginBottom: 12 }}>
            {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => (
              <button key={s} className="ghost" type="button" disabled={busy} onClick={() => setStatus(s)}>
                {s}
              </button>
            ))}
          </div>
          {(open.messages || []).map((m) => (
            <p key={m.id} className="muted">
              {m.internal ? "[internal] " : ""}
              {m.body}
              <br />
              {new Date(m.createdAt).toLocaleString()}
            </p>
          ))}
          <form onSubmit={send}>
            <label>
              Reply
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} required />
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                style={{ width: "auto" }}
              />
              Internal note (hidden from customer)
            </label>
            <button type="submit" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
