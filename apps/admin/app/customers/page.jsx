"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

function friendlyError(message) {
  if (/internal server error|econnrefused|can't reach the api|failed to fetch/i.test(String(message || ""))) {
    return "Could not load customers. Keep the API running on port 4000, then retry.";
  }
  return message;
}

function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(search = q) {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ customers: "1" });
      if (search.trim()) params.set("q", search.trim());
      const data = await api(`/v1/admin/users?${params}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(friendlyError(e.message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  async function disable(id) {
    if (!window.confirm("Disable this customer account?")) return;
    setError("");
    try {
      await api(`/v1/admin/users/${id}/disable`, { method: "POST", body: {} });
      setOk("Customer disabled");
      await load();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  return (
    <div className="staff-page">
      <div className="staff-hero">
        <div>
          <h2>Customers</h2>
          <p className="muted">People who book on the website. Staff accounts live under Staff.</p>
        </div>
        <span className="staff-count">{rows.length} customers</span>
      </div>
      {error && (
        <p className="err">
          {error}{" "}
          <button type="button" className="ghost" onClick={() => load(q)}>Retry</button>
        </p>
      )}
      {ok && <p className="ok">{ok}</p>}
      <div className="card">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
        >
          <input
            placeholder="Search email, phone, name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        {loading && !rows.length ? (
          <div className="staff-dir">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skel staff-skel" />
            ))}
          </div>
        ) : (
          <div className="staff-dir">
            {rows.map((u) => (
              <article key={u.id} className="staff-person">
                <div className="staff-avatar">{initials(u.fullName, u.email)}</div>
                <div className="staff-person-meta">
                  <p className="staff-name">{u.fullName || "—"}</p>
                  <div className="muted">{u.email}</div>
                  {u.phone ? <div className="muted">{u.phone}</div> : null}
                  <div className="access-chips">
                    <span className="chip">{u.status || "ACTIVE"}</span>
                    <span className="chip">KYC {String(u.kycStatus || "NOT_STARTED").replace(/_/g, " ")}</span>
                  </div>
                </div>
                <div className="staff-person-side">
                  <div className="row">
                    {u.status !== "DISABLED" && (
                      <button className="ghost" type="button" onClick={() => disable(u.id)}>
                        Disable
                      </button>
                    )}
                    <Link href={`/customers/${u.id}`}>View</Link>
                  </div>
                </div>
              </article>
            ))}
            {!loading && !rows.length ? <p className="muted">No customers yet.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
