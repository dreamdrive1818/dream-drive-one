"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function MediaPage() {
  const [rows, setRows] = useState([]);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/cms/media").then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      if (file) {
        const body = new FormData();
        body.append("file", file);
        body.append("category", "cms");
        await api("/v1/admin/cms/media/upload", { method: "POST", body });
        setFile(null);
      } else {
        await api("/v1/admin/cms/media", { method: "POST", body: { url, mimeType: "image/jpeg", category: "cms" } });
        setUrl("");
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Media</h2>
      <p className="muted">Images up to 8 MB. JPEG, PNG, WebP, GIF, SVG, PDF, MP4.</p>
      {error && <p className="err">{error}</p>}
      <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
        <label>Image URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
        <label>Or upload file<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        <button type="submit">Add media</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Preview</th><th>Type</th><th>Size</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  {String(m.mimeType || "").startsWith("image/") ? (
                    <img src={m.url} alt="" style={{ height: 40, borderRadius: 6 }} />
                  ) : (
                    <a href={m.url} target="_blank" rel="noreferrer">{m.filename || m.url}</a>
                  )}
                </td>
                <td>{m.mimeType}</td>
                <td>{m.sizeBytes ? `${Math.round(m.sizeBytes / 1024)} KB` : "—"}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => navigator.clipboard.writeText(m.url)}>Copy URL</button>
                  <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/media/${m.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
