"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function toLocalInput(value) {
  const d = value ? new Date(value) : new Date(Date.now() + 30 * 864e5);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  return {
    code: "",
    count: "1",
    type: "PERCENT",
    value: "10",
    endsAt: toLocalInput(Date.now() + 30 * 864e5),
    singleUse: true,
  };
}

function rupees(paise) {
  return `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;
}

export default function CouponsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expiry, setExpiry] = useState({});
  const [copied, setCopied] = useState("");
  const [created, setCreated] = useState([]);

  function load() {
    api("/v1/admin/coupons")
      .then((list) => {
        const next = Array.isArray(list) ? list : [];
        setRows(next);
        const map = {};
        next.forEach((c) => {
          map[c.id] = toLocalInput(c.endsAt);
        });
        setExpiry(map);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated([]);
    try {
      const valueNum = Number(form.value);
      const payload = {
        code: form.code.trim() || undefined,
        count: Number(form.count) || 1,
        type: form.type,
        value: form.type === "FLAT" ? Math.round(valueNum * 100) : valueNum,
        endsAt: new Date(form.endsAt).toISOString(),
        singleUse: form.singleUse,
      };
      const res = await api("/v1/admin/coupons", { method: "POST", body: payload });
      setCreated(res.coupons || []);
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveExpiry(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/coupons/${id}`, {
        method: "PATCH",
        body: { endsAt: new Date(expiry[id]).toISOString() },
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function expireNow(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/v1/admin/coupons/${id}`, {
        method: "PATCH",
        body: { endsAt: new Date().toISOString(), active: false },
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("Could not copy code");
    }
  }

  return (
    <div>
      <h2>Coupons</h2>
      <p className="muted">
        Generate discount codes for checkout. Single-use coupons expire after one apply. You can also set
        or change an expiry date at any time.
      </p>
      {error && <p className="err">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Generate coupon</h3>
        <form onSubmit={generate} className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "end" }}>
          <label style={{ minWidth: 140 }}>
            Code (optional)
            <input
              placeholder="Auto generate"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </label>
          <label style={{ minWidth: 90 }}>
            How many
            <input
              type="number"
              min="1"
              max="25"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
            />
          </label>
          <label style={{ minWidth: 120 }}>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="PERCENT">Percent off</option>
              <option value="FLAT">Flat ₹ off</option>
            </select>
          </label>
          <label style={{ minWidth: 110 }}>
            {form.type === "PERCENT" ? "Percent" : "Amount ₹"}
            <input
              required
              type="number"
              min="1"
              max={form.type === "PERCENT" ? "100" : undefined}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>
          <label style={{ minWidth: 200 }}>
            Expires
            <input
              required
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </label>
          <label className="row" style={{ width: "auto", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={form.singleUse}
              onChange={(e) => setForm({ ...form, singleUse: e.target.checked })}
              style={{ width: "auto" }}
            />
            Single use (expire after 1 apply)
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </form>
        {created.length > 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            Created: {created.map((c) => c.code).join(", ")}
          </p>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Uses</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <button type="button" className="ghost" onClick={() => copyCode(c.code)}>
                    {c.code}
                  </button>
                  {copied === c.code ? <span className="muted"> copied</span> : null}
                </td>
                <td>
                  {c.type === "PERCENT" ? `${c.value}%` : rupees(c.value)}
                  {c.singleUse ? <span className="muted"> · once</span> : null}
                </td>
                <td>
                  {c.usedCount}
                  {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                </td>
                <td>
                  <div className="row" style={{ margin: 0 }}>
                    <input
                      type="datetime-local"
                      value={expiry[c.id] || ""}
                      onChange={(e) => setExpiry({ ...expiry, [c.id]: e.target.value })}
                      style={{ maxWidth: 200 }}
                    />
                    <button type="button" className="ghost" disabled={busy} onClick={() => saveExpiry(c.id)}>
                      Save
                    </button>
                  </div>
                </td>
                <td>{c.status}</td>
                <td>
                  {c.status === "ACTIVE" || c.status === "SCHEDULED" ? (
                    <button type="button" className="ghost" disabled={busy} onClick={() => expireNow(c.id)}>
                      Expire now
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No coupons yet. Generate one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
