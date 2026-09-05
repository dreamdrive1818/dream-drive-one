"use client";

import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { formatWhen, prettyStatus, statusTone } from "./format";

export default function AccountTickets() {
  const [rows, setRows] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [openId, setOpenId] = useState("");
  const [thread, setThread] = useState(null);
  const [form, setForm] = useState({ subject: "", body: "", bookingId: "" });
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api("/v1/me/tickets")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
    api("/v1/me/bookings")
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }

  useEffect(load, []);

  async function createTicket(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/v1/me/tickets", {
        method: "POST",
        body: {
          subject: form.subject,
          body: form.body,
          bookingId: form.bookingId || undefined,
        },
      });
      setForm({ subject: "", body: "", bookingId: "" });
      setInfo("Ticket opened. Support will reply here.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openTicket(id) {
    setOpenId(id);
    setError("");
    try {
      setThread(await api(`/v1/me/tickets/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!openId) return;
    setBusy(true);
    try {
      const data = await api(`/v1/me/tickets/${openId}/messages`, {
        method: "POST",
        body: { body: reply },
      });
      setThread(data);
      setReply("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Support</h1>
      <p className="account-lead">Open a ticket linked to a booking. Internal staff notes stay hidden.</p>
      {error && <p className="account-msg err">{error}</p>}
      {info && <p className="account-msg ok">{info}</p>}

      <div className="account-card" style={{ marginBottom: 16 }}>
        <h2>New ticket</h2>
        <form onSubmit={createTicket}>
          <div className="account-field">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </div>
          <div className="account-field">
            <label htmlFor="booking">Booking (optional)</label>
            <select
              id="booking"
              value={form.bookingId}
              onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
            >
              <option value="">Not linked</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.publicId} · {prettyStatus(b.status)}
                </option>
              ))}
            </select>
          </div>
          <div className="account-field">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <button className="account-btn" type="submit" disabled={busy}>
            Submit ticket
          </button>
        </form>
      </div>

      <div className="account-card">
        <h2>Your tickets</h2>
        {rows.length === 0 && <p className="account-empty">No tickets yet.</p>}
        <div className="account-list">
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              className="account-item"
              style={{ gridTemplateColumns: "1fr auto", cursor: "pointer", textAlign: "left" }}
              onClick={() => openTicket(t.id)}
            >
              <div>
                <h3>{t.subject}</h3>
                <p>{formatWhen(t.messages?.[0]?.createdAt)}</p>
              </div>
              <span className={`account-pill ${statusTone(t.status)}`}>{prettyStatus(t.status)}</span>
            </button>
          ))}
        </div>
        {thread && (
          <div style={{ marginTop: 16 }}>
            <h3>{thread.subject}</h3>
            <div className="account-thread">
              {(thread.messages || []).map((m) => (
                <div key={m.id} className="account-bubble">
                  {m.body}
                  <time>{formatWhen(m.createdAt)}</time>
                </div>
              ))}
            </div>
            {thread.status !== "CLOSED" && (
              <form onSubmit={sendReply}>
                <div className="account-field">
                  <label htmlFor="reply">Reply</label>
                  <textarea id="reply" value={reply} onChange={(e) => setReply(e.target.value)} required />
                </div>
                <button className="account-btn" type="submit" disabled={busy}>
                  Send reply
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}
