"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MediaPicker from "../../components/MediaPicker";

const EMPTY = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverUrl: "",
  author: "Dream Drive",
  categoryId: "",
  published: false,
  metaTitle: "",
  metaDescription: "",
};

export default function BlogsPage() {
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [comments, setComments] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/cms/blogs").then(setPosts).catch((e) => setError(e.message));
    api("/v1/admin/cms/categories").then(setCategories).catch(() => {});
    api("/v1/admin/cms/comments").then(setComments).catch(() => {});
  }
  useEffect(load, []);

  function editPost(p) {
    setEditingId(p.id);
    setForm({
      title: p.title || "",
      slug: p.slug || "",
      excerpt: p.excerpt || "",
      body: p.body || p.content || "",
      coverUrl: p.coverUrl || p.imageLink || "",
      author: p.author || "Dream Drive",
      categoryId: p.categoryId || "",
      published: Boolean(p.published),
      metaTitle: p.metaTitle || p.seoTitle || "",
      metaDescription: p.metaDescription || p.seoDescription || "",
    });
    setTab("posts");
  }

  async function savePost(e) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api(`/v1/admin/cms/blogs/${editingId}`, { method: "PATCH", body: form });
      else await api("/v1/admin/cms/blogs", { method: "POST", body: form });
      setForm(EMPTY);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Blogs</h2>
      <div className="tabs">
        <button className={tab === "posts" ? "active" : ""} type="button" onClick={() => setTab("posts")}>Posts</button>
        <button className={tab === "categories" ? "active" : ""} type="button" onClick={() => setTab("categories")}>Categories</button>
        <button className={tab === "comments" ? "active" : ""} type="button" onClick={() => setTab("comments")}>Comments</button>
      </div>
      {error && <p className="err">{error}</p>}

      {tab === "posts" && (
        <div className="stack">
          <form className="card" onSubmit={savePost}>
            <h3>{editingId ? "Edit post" : "New post"}</h3>
            <div className="row">
              <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></label>
              <label>Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
              <label>Author<input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
              <label>Category
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <label>Excerpt<input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></label>
            <label>Cover URL<input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} /></label>
            <MediaPicker onPick={(url) => setForm({ ...form, coverUrl: url })} />
            <label>Body<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
            <label>Meta title<input value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} /></label>
            <label>Meta description<textarea value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} style={{ width: "auto" }} />
              Published
            </label>
            <button type="submit">{editingId ? "Update post" : "Save post"}</button>
            {editingId ? <button type="button" className="ghost" onClick={() => { setEditingId(""); setForm(EMPTY); }}>Cancel</button> : null}
          </form>
          <div className="card">
            <table>
              <thead><tr><th>Title</th><th>Slug</th><th>Published</th><th></th></tr></thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.slug}</td>
                    <td>{p.published ? "yes" : "no"}</td>
                    <td>
                      <button type="button" className="ghost" onClick={() => editPost(p)}>Edit</button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => api(`/v1/admin/cms/blogs/${p.id}`, { method: "PATCH", body: { published: !p.published, metaTitle: p.metaTitle || p.title, metaDescription: p.metaDescription || p.excerpt } }).then(load)}
                      >
                        {p.published ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/blogs/${p.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="stack">
          <form className="card" onSubmit={(e) => { e.preventDefault(); api("/v1/admin/cms/categories", { method: "POST", body: { name: categoryName } }).then(() => { setCategoryName(""); load(); }).catch((err) => setError(err.message)); }}>
            <label>Name<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /></label>
            <button type="submit">Add category</button>
          </form>
          <div className="card">
            <table>
              <thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.slug}</td>
                    <td><button type="button" className="danger" onClick={() => api(`/v1/admin/cms/categories/${c.id}`, { method: "DELETE" }).then(load)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "comments" && (
        <div className="card">
          <table>
            <thead><tr><th>Post</th><th>From</th><th>Comment</th><th>Approved</th><th></th></tr></thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.id}>
                  <td>{c.postTitle}</td>
                  <td>{c.name}</td>
                  <td>{c.body}</td>
                  <td>{c.approved ? "yes" : "no"}</td>
                  <td>
                    <button type="button" className="ghost" onClick={() => api(`/v1/admin/cms/comments/${c.id}`, { method: "PATCH", body: { approved: !c.approved } }).then(load)}>
                      {c.approved ? "Hide" : "Approve"}
                    </button>
                    <button type="button" className="danger" onClick={() => api(`/v1/admin/cms/comments/${c.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
