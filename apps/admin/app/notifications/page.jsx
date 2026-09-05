"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const EMPTY = { key: "", channel: "email", subject: "", body: "", existing: false };

export default function NotificationsPage() {
  const [tab, setTab] = useState("logs");
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState(null);

  const canEdit = (me?.roles || []).includes("SUPER_ADMIN");

  function load() {
    api("/v1/admin/notifications").then(setLogs).catch((e) => setError(e.message));
    api("/v1/admin/notification-templates").then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(() => {
    api("/v1/me").then(setMe).catch(() => undefined);
    load();
  }, []);

  function edit(row) {
    setForm({
      key: row.key,
      channel: row.channel || "email",
      subject: row.subject || "",
      body: row.body || "",
      existing: true,
    });
    setTab("templates");
  }

  async function save(e) {
    e.preventDefault();
    if (!form.key.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/notification-templates/${encodeURIComponent(form.key.trim())}`, {
        method: "PUT",
        body: { channel: form.channel, subject: form.subject, body: form.body },
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/notifications/${id}/resend`, { method: "POST", body: {} });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Notifications</h2>
      <p className="muted">
        Delivery log (email/phone masked) and templates. Placeholders use {"{{field}}"}. Keys cannot be renamed after save.
        SMS/WhatsApp channels are stored but not sent yet.
      </p>
      {error && <p className="err">{error}</p>}
      <div className="tabs">
        <button type="button" className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          Log
        </button>
        <button type="button" className={tab === "templates" ? "active" : ""} onClick={() => setTab("templates")}>
          Templates
        </button>
      </div>
      {tab === "logs" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Template</th>
                <th>To</th>
                <th>Status</th>
                <th>Tries</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(logs) ? logs : []).map((n) => (
                <tr key={n.id}>
                  <td>{n.createdAt ? new Date(n.createdAt).toLocaleString("en-IN") : "—"}</td>
                  <td>{n.template}{n.ref ? ` · ${n.ref}` : ""}</td>
                  <td>{n.to}</td>
                  <td>{n.status}</td>
                  <td>{n.attempts ?? "—"}</td>
                  <td>
                    {canEdit && (
                      <button className="ghost" type="button" disabled={busy} onClick={() => resend(n.id)}>
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!(logs || []).length && (
                <tr>
                  <td colSpan={6} className="muted">No notification log yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "templates" && (
        <>
          {canEdit && (
            <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
              <h3>{form.existing ? `Edit ${form.key}` : "New template"}</h3>
              <div className="row">
                <label>
                  Key
                  <input
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    required
                    placeholder="booking_confirmed"
                    disabled={form.existing}
                  />
                </label>
                <label>
                  Channel
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                    <option value="email">email</option>
                    <option value="sms">sms (later)</option>
                    <option value="whatsapp">whatsapp (later)</option>
                    <option value="push">push</option>
                  </select>
                </label>
              </div>
              <label>
                Subject
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </label>
              <label>
                Body
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
              </label>
              <div className="row">
                <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save template"}</button>
                <button type="button" className="ghost" onClick={() => setForm(EMPTY)}>Clear</button>
              </div>
            </form>
          )}
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Channel</th>
                  <th>Subject</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(templates) ? templates : []).map((t) => (
                  <tr key={t.key}>
                    <td>{t.key}</td>
                    <td>{t.channel}</td>
                    <td>{t.subject}</td>
                    <td>
                      {canEdit && (
                        <button className="ghost" type="button" onClick={() => edit(t)}>Edit</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!(templates || []).length && (
                  <tr>
                    <td colSpan={4} className="muted">No templates yet. Seed the database or save one here.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
