"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MediaPicker from "../../components/MediaPicker";

const EMPTY_PAGE = {
  slug: "",
  title: "",
  body: "",
  excerpt: "",
  kind: "LEGAL",
  published: false,
  metaTitle: "",
  metaDescription: "",
  keywords: "",
  ogImage: "",
};

const EMPTY_TESTIMONIAL = { name: "", body: "", city: "", rating: 5, photoUrl: "", active: true };

export default function CmsPage() {
  const [tab, setTab] = useState("pages");
  const [pages, setPages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [pageForm, setPageForm] = useState(EMPTY_PAGE);
  const [editingId, setEditingId] = useState("");
  const [testimonialForm, setTestimonialForm] = useState(EMPTY_TESTIMONIAL);
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/cms/pages").then(setPages).catch((e) => setError(e.message));
    api("/v1/admin/cms/testimonials").then(setTestimonials).catch(() => {});
  }
  useEffect(load, []);

  function editPage(row) {
    setEditingId(row.id);
    setPageForm({
      slug: row.slug,
      title: row.title,
      body: row.body,
      excerpt: row.excerpt || "",
      kind: row.kind,
      published: row.published,
      metaTitle: row.metadata?.title || "",
      metaDescription: row.metadata?.description || "",
      keywords: row.metadata?.keywords || "",
      ogImage: row.metadata?.ogImage || "",
    });
    setTab("pages");
  }

  async function savePage(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...pageForm,
        metadata: {
          title: pageForm.metaTitle,
          description: pageForm.metaDescription,
          keywords: pageForm.keywords,
          ogImage: pageForm.ogImage,
        },
      };
      if (editingId) await api(`/v1/admin/cms/pages/${editingId}`, { method: "PATCH", body: payload });
      else await api("/v1/admin/cms/pages", { method: "POST", body: payload });
      setPageForm(EMPTY_PAGE);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveTestimonial(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/cms/testimonials", { method: "POST", body: testimonialForm });
      setTestimonialForm(EMPTY_TESTIMONIAL);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>CMS</h2>
      <div className="tabs">
        <button className={tab === "pages" ? "active" : ""} type="button" onClick={() => setTab("pages")}>Pages & SEO</button>
        <button className={tab === "testimonials" ? "active" : ""} type="button" onClick={() => setTab("testimonials")}>Testimonials</button>
      </div>
      {error && <p className="err">{error}</p>}

      {tab === "pages" && (
        <div className="stack">
          <form className="card" onSubmit={savePage}>
            <h3>{editingId ? "Edit page" : "New page"}</h3>
            <div className="row">
              <label>Title<input value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value, slug: pageForm.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></label>
              <label>Slug<input value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} /></label>
              <label>Kind
                <select value={pageForm.kind} onChange={(e) => setPageForm({ ...pageForm, kind: e.target.value })}>
                  <option value="LEGAL">Legal</option>
                  <option value="FAQ">FAQ</option>
                  <option value="LANDING">Landing</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
            </div>
            <label>Excerpt<input value={pageForm.excerpt} onChange={(e) => setPageForm({ ...pageForm, excerpt: e.target.value })} /></label>
            <label>Body<textarea value={pageForm.body} onChange={(e) => setPageForm({ ...pageForm, body: e.target.value })} /></label>
            <label>Meta title<input value={pageForm.metaTitle} onChange={(e) => setPageForm({ ...pageForm, metaTitle: e.target.value })} /></label>
            <label>Meta description<textarea value={pageForm.metaDescription} onChange={(e) => setPageForm({ ...pageForm, metaDescription: e.target.value })} /></label>
            <label>Keywords<input value={pageForm.keywords} onChange={(e) => setPageForm({ ...pageForm, keywords: e.target.value })} /></label>
            <label>OG image URL<input value={pageForm.ogImage} onChange={(e) => setPageForm({ ...pageForm, ogImage: e.target.value })} /></label>
            <MediaPicker onPick={(url) => setPageForm({ ...pageForm, ogImage: url })} />
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={pageForm.published} onChange={(e) => setPageForm({ ...pageForm, published: e.target.checked })} style={{ width: "auto" }} />
              Published
            </label>
            <div className="row">
              <button type="submit">{editingId ? "Update page" : "Save page"}</button>
              {editingId ? <button type="button" className="ghost" onClick={() => { setEditingId(""); setPageForm(EMPTY_PAGE); }}>Cancel</button> : null}
            </div>
          </form>
          <div className="card">
            <table>
              <thead><tr><th>Slug</th><th>Title</th><th>Kind</th><th>Published</th><th></th></tr></thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td>{p.slug}</td>
                    <td>{p.title}</td>
                    <td>{p.kind}</td>
                    <td>{p.published ? "yes" : "no"}</td>
                    <td>
                      <button type="button" className="ghost" onClick={() => editPage(p)}>Edit</button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => api(`/v1/admin/cms/pages/${p.id}`, { method: "PATCH", body: { published: !p.published, metaTitle: p.metadata?.title || p.title, metaDescription: p.metadata?.description || p.excerpt } }).then(load)}
                      >
                        {p.published ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/pages/${p.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "testimonials" && (
        <div className="stack">
          <form className="card" onSubmit={saveTestimonial}>
            <h3>Add testimonial</h3>
            <div className="row">
              <label>Name<input value={testimonialForm.name} onChange={(e) => setTestimonialForm({ ...testimonialForm, name: e.target.value })} /></label>
              <label>City<input value={testimonialForm.city} onChange={(e) => setTestimonialForm({ ...testimonialForm, city: e.target.value })} /></label>
              <label>Rating<input type="number" min="1" max="5" value={testimonialForm.rating} onChange={(e) => setTestimonialForm({ ...testimonialForm, rating: Number(e.target.value) })} /></label>
            </div>
            <label>Photo URL<input value={testimonialForm.photoUrl} onChange={(e) => setTestimonialForm({ ...testimonialForm, photoUrl: e.target.value })} /></label>
            <MediaPicker onPick={(url) => setTestimonialForm({ ...testimonialForm, photoUrl: url })} />
            <button type="submit">Add</button>
          </form>
          <div className="card">
            <table>
              <thead><tr><th>Name</th><th>Quote</th><th>Shown</th><th></th></tr></thead>
              <tbody>
                {testimonials.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.body}</td>
                    <td>{t.active ? "yes" : "pending"}</td>
                    <td>
                      {!t.active ? (
                        <button type="button" onClick={() => api(`/v1/admin/cms/testimonials/${t.id}`, { method: "PATCH", body: { active: true } }).then(load)}>Publish</button>
                      ) : (
                        <button type="button" className="ghost" onClick={() => api(`/v1/admin/cms/testimonials/${t.id}`, { method: "PATCH", body: { active: false } }).then(load)}>Hide</button>
                      )}
                      <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/testimonials/${t.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
