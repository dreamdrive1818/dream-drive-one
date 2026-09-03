"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function MediaPicker({ onPick, label = "Pick from media library" }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    api("/v1/admin/cms/media")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [open]);

  return (
    <div>
      <button type="button" className="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "Close library" : label}
      </button>
      {open ? (
        <div className="card" style={{ marginTop: 8 }}>
          {error && <p className="err">{error}</p>}
          {!rows.length && !error ? <p className="muted">No media yet. Upload on /media.</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {rows.map((m) => (
              <button
                key={m.id}
                type="button"
                className="ghost"
                style={{ padding: 6 }}
                onClick={() => {
                  onPick(m.url);
                  setOpen(false);
                }}
              >
                {String(m.mimeType || "").startsWith("image/") ? (
                  <img src={m.url} alt="" style={{ width: "100%", height: 64, objectFit: "cover", borderRadius: 6 }} />
                ) : (
                  <span className="muted">{m.filename || "file"}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
