"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MediaPicker from "../../components/MediaPicker";

const EMPTY_CARD = {
  name: "",
  blurb: "",
  imageUrl: "",
  chip: "Weekend",
  href: "",
  sortOrder: 0,
  active: true,
};

const EMPTY_SECTION = {
  enabled: true,
  eyebrow: "Trip ideas",
  title: "Popular getaways from",
  highlight: "Ranchi",
  lead: "",
  ctaLabel: "Browse our fleet",
  ctaHref: "/fleet",
  guideLabel: "Read the weekend guide",
  guideHref: "/blogs/weekend-drives-from-ranchi",
};

export default function GetawaysPage() {
  const [section, setSection] = useState(EMPTY_SECTION);
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState(EMPTY_CARD);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [sectionMsg, setSectionMsg] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  function apply(data) {
    setSection({
      enabled: data.enabled !== false,
      eyebrow: data.eyebrow || "",
      title: data.title || "",
      highlight: data.highlight || "",
      lead: data.lead || "",
      ctaLabel: data.ctaLabel || "",
      ctaHref: data.ctaHref || "",
      guideLabel: data.guideLabel || "",
      guideHref: data.guideHref || "",
    });
    setCards(Array.isArray(data.cards) ? data.cards : []);
  }

  function load() {
    api("/v1/admin/cms/getaways")
      .then(apply)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function edit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      blurb: row.blurb || "",
      imageUrl: row.imageUrl || "",
      chip: row.chip || "Weekend",
      href: row.href || "",
      sortOrder: row.sortOrder ?? 0,
      active: row.active !== false,
    });
  }

  async function saveSection(e) {
    e.preventDefault();
    setError("");
    setSectionMsg("");
    setSavingSection(true);
    try {
      const data = await api("/v1/admin/cms/getaways", { method: "PATCH", body: section });
      apply(data);
      setSectionMsg("Section saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSection(false);
    }
  }

  async function saveCard(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api(`/v1/admin/cms/getaways/cards/${editingId}`, { method: "PATCH", body: form });
      else await api("/v1/admin/cms/getaways/cards", { method: "POST", body: form });
      setForm(EMPTY_CARD);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Popular getaways</h2>
      <p className="muted">
        Homepage destination cards under How it works. Hidden on the site if the section is turned off.
      </p>
      {error && <p className="err">{error}</p>}

      <form className="card" onSubmit={saveSection} style={{ marginBottom: 16 }}>
        <h3>Section copy</h3>
        <label className="row" style={{ alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(e) => setSection({ ...section, enabled: e.target.checked })}
          />
          Show this section on the homepage
        </label>
        <div className="row">
          <label>Eyebrow<input value={section.eyebrow} onChange={(e) => setSection({ ...section, eyebrow: e.target.value })} /></label>
          <label>Title<input value={section.title} onChange={(e) => setSection({ ...section, title: e.target.value })} /></label>
          <label>Highlight city<input value={section.highlight} onChange={(e) => setSection({ ...section, highlight: e.target.value })} /></label>
        </div>
        <label>
          Lead
          <textarea rows={2} value={section.lead} onChange={(e) => setSection({ ...section, lead: e.target.value })} />
        </label>
        <div className="row">
          <label>Primary button<input value={section.ctaLabel} onChange={(e) => setSection({ ...section, ctaLabel: e.target.value })} /></label>
          <label>Primary link<input value={section.ctaHref} onChange={(e) => setSection({ ...section, ctaHref: e.target.value })} /></label>
        </div>
        <div className="row">
          <label>Guide button<input value={section.guideLabel} onChange={(e) => setSection({ ...section, guideLabel: e.target.value })} /></label>
          <label>Guide link<input value={section.guideHref} onChange={(e) => setSection({ ...section, guideHref: e.target.value })} /></label>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={savingSection}>{savingSection ? "Saving…" : "Save section"}</button>
          {sectionMsg ? <span style={{ color: "green" }}>{sectionMsg}</span> : null}
        </div>
      </form>

      <form className="card" onSubmit={saveCard} style={{ marginBottom: 16 }}>
        <h3>{editingId ? "Edit destination" : "New destination"}</h3>
        <div className="row">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Badge<input value={form.chip} onChange={(e) => setForm({ ...form, chip: e.target.value })} /></label>
          <label>Order<input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
        </div>
        <label>
          Short description
          <textarea rows={2} value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
        </label>
        <label>Image URL<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} required /></label>
        {form.imageUrl ? (
          <img src={form.imageUrl} alt="" style={{ width: 180, height: 110, objectFit: "cover", borderRadius: 8 }} />
        ) : null}
        <MediaPicker onPick={(url) => setForm({ ...form, imageUrl: url })} />
        <label>Optional card link<input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/blogs/weekend-drives-from-ranchi" /></label>
        <label className="row" style={{ alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Published
        </label>
        <div className="row">
          <button type="submit">{editingId ? "Update destination" : "Add destination"}</button>
          {editingId ? (
            <button type="button" className="ghost" onClick={() => { setEditingId(""); setForm(EMPTY_CARD); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Badge</th>
              <th>Shown</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt="" style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 6 }} />
                  ) : "—"}
                </td>
                <td>
                  <strong>{card.name}</strong>
                  <div className="muted">{card.blurb}</div>
                </td>
                <td>{card.chip}</td>
                <td>{card.active ? "yes" : "no"}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => edit(card)}>Edit</button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => api(`/v1/admin/cms/getaways/cards/${card.id}`, { method: "PATCH", body: { active: !card.active } }).then(load)}
                  >
                    {card.active ? "Hide" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => api(`/v1/admin/cms/getaways/cards/${card.id}`, { method: "DELETE" }).then(load)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
