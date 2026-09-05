"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import MediaPicker from "../../components/MediaPicker";

const EMPTY = {
  name: "",
  slug: "",
  type: "hatchback",
  seats: 5,
  fuel: "petrol",
  transmission: "manual",
  cityId: "",
  published: true,
  featured: false,
  displayOrder: 999,
  imageUrl: "",
};

const RENTAL_TYPES = [
  "SELF_DRIVE",
  "WITH_DRIVER_LOCAL",
  "WITH_DRIVER_INTERCITY",
  "AIRPORT",
  "OUTSTATION",
  "ONE_WAY",
];

export default function CarsPage() {
  const [rows, setRows] = useState([]);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState("");
  const [images, setImages] = useState([]);
  const [price, setPrice] = useState({
    carModelId: "",
    rentalType: "SELF_DRIVE",
    dailyPaise: 180000,
    extraKmPaise: 1200,
    depositPaise: 500000,
    startsOn: "",
    endsOn: "",
  });
  const [error, setError] = useState("");

  function load() {
    api("/v1/admin/car-models").then(setRows).catch((e) => setError(e.message));
    api("/v1/admin/cities").then(setCities).catch(() => {});
  }
  useEffect(load, []);

  function edit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      slug: row.slug || "",
      type: row.type || "hatchback",
      seats: row.seats || 5,
      fuel: row.fuel || "petrol",
      transmission: row.transmission || "manual",
      cityId: row.cityId || "",
      published: Boolean(row.published),
      featured: Boolean(row.featured),
      displayOrder: row.displayOrder ?? 999,
      imageUrl: "",
    });
    setImages((row.images || []).map((img) => img.url));
    setPrice((p) => ({ ...p, carModelId: row.id }));
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...form,
      seats: Number(form.seats),
      displayOrder: Number(form.displayOrder),
      images: images.map((url) => ({ url })),
    };
    try {
      if (editingId) await api(`/v1/admin/car-models/${editingId}`, { method: "PATCH", body });
      else await api("/v1/admin/car-models", { method: "POST", body });
      setForm(EMPTY);
      setImages([]);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(row, field) {
    try {
      await api(`/v1/admin/car-models/${row.id}`, {
        method: "PATCH",
        body: { [field]: !row[field] },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePrice(e) {
    e.preventDefault();
    if (!price.carModelId) {
      setError("Select a car (Edit) before adding a price rule.");
      return;
    }
    try {
      await api("/v1/admin/pricing-rules", {
        method: "PUT",
        body: {
          ...price,
          dailyPaise: Number(price.dailyPaise),
          extraKmPaise: Number(price.extraKmPaise),
          depositPaise: Number(price.depositPaise),
          startsOn: price.startsOn || null,
          endsOn: price.endsOn || null,
        },
      });
      setPrice((p) => ({ ...p, startsOn: "", endsOn: "" }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePrice(id) {
    if (!window.confirm("Delete this pricing rule?")) return;
    try {
      await api(`/v1/admin/pricing-rules/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const selected = rows.find((r) => r.id === (editingId || price.carModelId));

  return (
    <div className="stack">
      <h2>Car models</h2>
      {error && <p className="err">{error}</p>}

      <form className="card" onSubmit={save}>
        <h3>{editingId ? "Edit model" : "Add model"}</h3>
        <div className="row">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} /></label>
          <label>Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
          <label>Type<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
          <label>City
            <select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              <option value="">Select</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          <label>Seats<input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></label>
          <label>Fuel<input value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })} /></label>
          <label>Transmission<input value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} /></label>
          <label>Order<input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} /></label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} style={{ width: "auto" }} />
          Published
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} style={{ width: "auto" }} />
          Featured
        </label>
        <label>Image URL
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (form.imageUrl) {
                setImages((imgs) => [...imgs, form.imageUrl]);
                setForm({ ...form, imageUrl: "" });
              }
            }}
          >
            Add image URL
          </button>
          <MediaPicker onPick={(url) => setImages((imgs) => [...imgs, url])} />
        </div>
        {images.length ? (
          <div className="row" style={{ marginTop: 8 }}>
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                className="ghost"
                title="Remove"
                onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                style={{ padding: 4 }}
              >
                <img src={url} alt="" style={{ width: 72, height: 48, objectFit: "cover", borderRadius: 6 }} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="submit">{editingId ? "Update car" : "Add car"}</button>
          {editingId ? (
            <button type="button" className="ghost" onClick={() => { setEditingId(""); setForm(EMPTY); setImages([]); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <form className="card" onSubmit={savePrice}>
        <h3>Pricing {selected ? `· ${selected.name}` : ""}</h3>
        <p className="muted">Leave season dates empty for the base rate. Seasonal windows override the base rate while they are active.</p>
        <div className="row">
          <label>Rental
            <select value={price.rentalType} onChange={(e) => setPrice({ ...price, rentalType: e.target.value })}>
              {RENTAL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Daily (paise)<input type="number" value={price.dailyPaise} onChange={(e) => setPrice({ ...price, dailyPaise: e.target.value })} /></label>
          <label>Extra km (paise)<input type="number" value={price.extraKmPaise} onChange={(e) => setPrice({ ...price, extraKmPaise: e.target.value })} /></label>
          <label>Deposit (paise)<input type="number" value={price.depositPaise} onChange={(e) => setPrice({ ...price, depositPaise: e.target.value })} /></label>
        </div>
        <div className="row">
          <label>Season start<input type="date" value={price.startsOn} onChange={(e) => setPrice({ ...price, startsOn: e.target.value })} /></label>
          <label>Season end<input type="date" value={price.endsOn} onChange={(e) => setPrice({ ...price, endsOn: e.target.value })} /></label>
        </div>
        <button type="submit" disabled={!price.carModelId}>Save pricing rule</button>
        {selected?.pricingRules?.length ? (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Daily</th>
                <th>Season</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {selected.pricingRules.map((r) => (
                <tr key={r.id}>
                  <td>{r.rentalType}</td>
                  <td>₹{(r.dailyPaise / 100).toLocaleString("en-IN")}</td>
                  <td>
                    {r.startsOn || r.endsOn
                      ? `${r.startsOn ? String(r.startsOn).slice(0, 10) : "…"} → ${r.endsOn ? String(r.endsOn).slice(0, 10) : "…"}`
                      : "base"}
                  </td>
                  <td>
                    <button type="button" className="ghost" onClick={() => deletePrice(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Published</th>
              <th>Featured</th>
              <th>Vehicles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.city?.name}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => toggle(c, "published")}>
                    {c.published ? "yes" : "no"}
                  </button>
                </td>
                <td>
                  <button type="button" className="ghost" onClick={() => toggle(c, "featured")}>
                    {c.featured ? "yes" : "no"}
                  </button>
                </td>
                <td>{c.vehicles?.length ?? 0}</td>
                <td>
                  <button type="button" className="ghost" onClick={() => edit(c)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
