"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MediaPicker from "../../components/MediaPicker";

const EMPTY = {
  title: "",
  body: "",
  imageUrl: "",
  link: "/fleet",
  ctaText: "",
  placement: "STRIP",
  active: true,
};

export default function BannersPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/cms/banners").then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function edit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title || "",
      body: row.body || "",
      imageUrl: row.imageUrl || "",
      link: row.link || "/fleet",
      ctaText: row.ctaText || "",
      placement: row.placement || "STRIP",
      active: row.active !== false,
    });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api(`/v1/admin/cms/banners/${editingId}`, { method: "PATCH", body: form });
      else await api("/v1/admin/cms/banners", { method: "POST", body: form });
      setForm(EMPTY);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Banners</h2>
      <p className="muted">STRIP is the top promo bar. HOME_PROMO drives the sale modal and footer strip. HERO is the homepage hero copy.</p>
      {error && <p className="err">{error}</p>}
      <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
        <h3>{editingId ? "Edit banner" : "New banner"}</h3>
        <div className="row">
          <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Placement
            <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
              <option value="STRIP">Strip</option>
              <option value="HOME_PROMO">Home promo</option>
              <option value="HERO">Hero</option>
              <option value="SIDE">Side</option>
            </select>
          </label>
          <label>CTA text<input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} /></label>
        </div>
        <label>Body<input value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <label>Image URL<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required /></label>
        <MediaPicker onPick={(url) => setForm({ ...form, imageUrl: url })} />
        <label>Link<input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></label>
        <div className="row">
          <button type="submit">{editingId ? "Update banner" : "Add banner"}</button>
          {editingId ? <button type="button" className="ghost" onClick={() => { setEditingId(""); setForm(EMPTY); }}>Cancel</button> : null}
        </div>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>Title</th><th>Placement</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>{b.title}</td>
                <td>{b.placement}</td>
                <td>{b.active ? "yes" : "no"}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => edit(b)}>Edit</button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => api(`/v1/admin/cms/banners/${b.id}`, { method: "PATCH", body: { active: !b.active } }).then(load)}
                  >
                    {b.active ? "Unpublish" : "Publish"}
                  </button>
                  <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/banners/${b.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
