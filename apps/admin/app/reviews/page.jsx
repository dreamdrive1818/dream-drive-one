"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function ReviewsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  function load() {
    api("/v1/admin/reviews")
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function moderate(id, published) {
    setBusy(id);
    setError("");
    try {
      await api(`/v1/admin/reviews/${id}`, { method: "PATCH", body: { published } });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h2>Reviews</h2>
      <p className="muted">Customer trip reviews. Publish to show on the public car page. Flagged rows need a read before going live.</p>
      {error && <p className="err">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Car</th>
              <th>Customer</th>
              <th>Rating</th>
              <th>Review</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(rows) ? rows : []).map((r) => (
              <tr key={r.id}>
                <td>{r.booking?.publicId || r.bookingId}</td>
                <td>{r.carModel?.name}</td>
                <td>{r.user?.profile?.fullName || r.user?.email}</td>
                <td>{r.rating} / 5</td>
                <td>{r.body || "—"}</td>
                <td>
                  {r.flagged ? "Flagged" : r.published ? "Published" : "Pending"}
                </td>
                <td>
                  {r.published ? (
                    <button className="ghost" type="button" disabled={busy === r.id} onClick={() => moderate(r.id, false)}>
                      Unpublish
                    </button>
                  ) : (
                    <button type="button" disabled={busy === r.id} onClick={() => moderate(r.id, true)}>
                      Publish
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!(rows || []).length && (
              <tr>
                <td colSpan={7} className="muted">No reviews yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
