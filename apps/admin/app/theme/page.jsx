"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const THEME_META = {
  winter: {
    label: "Winter",
    blurb: "Snowy visuals, cool-season rates, winter sale strip and promo copy.",
  },
  monsoon: {
    label: "Monsoon",
    blurb: "Rain-season styling with monsoon sale strip and promo copy.",
  },
  none: {
    label: "Off",
    blurb: "No seasonal theme. Promo banners can still run without themed chrome.",
  },
};

export default function ThemePage() {
  const [theme, setTheme] = useState("winter");
  const [applyCopy, setApplyCopy] = useState(true);
  const [presets, setPresets] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    setError("");
    api("/v1/admin/cms/theme")
      .then((data) => {
        setTheme(data.theme || "winter");
        setPresets(data.presets || null);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const data = await api("/v1/admin/cms/theme", {
        method: "PATCH",
        body: { theme, applyCopy: theme === "none" ? false : applyCopy },
      });
      setTheme(data.theme || theme);
      setPresets(data.presets || presets);
      setMsg(
        theme === "none"
          ? "Seasonal theme turned off."
          : applyCopy
            ? `${THEME_META[theme]?.label || theme} theme saved and banner copy updated.`
            : `${THEME_META[theme]?.label || theme} theme saved. Banner copy left unchanged.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const preview = theme !== "none" && presets?.[theme] ? presets[theme] : null;

  return (
    <div>
      <h2>Theme</h2>
      <p className="muted">
        Pick the seasonal look for the public site. Winter and Monsoon also control recommended
        strip and home-promo copy so labels never fight the visuals.
      </p>
      {error ? <p className="err">{error}</p> : null}
      {msg ? <p className="muted">{msg}</p> : null}

      <form className="card" onSubmit={save} style={{ marginBottom: 16 }}>
        <h3>Active theme</h3>
        <div className="row" style={{ gap: 12, marginBottom: 12 }}>
          {Object.entries(THEME_META).map(([key, meta]) => (
            <label
              key={key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 180,
                flex: "1 1 180px",
                padding: 12,
                borderRadius: 10,
                border: theme === key ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: theme === key ? "rgba(62, 224, 164, 0.08)" : "transparent",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="siteTheme"
                  value={key}
                  checked={theme === key}
                  onChange={() => setTheme(key)}
                />
                <strong>{meta.label}</strong>
              </span>
              <span className="muted">{meta.blurb}</span>
            </label>
          ))}
        </div>

        {theme !== "none" ? (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={applyCopy}
              onChange={(e) => setApplyCopy(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              Update strip + home promo banner copy to match this theme
              <span className="muted" style={{ display: "block" }}>
                Keeps “Monsoon Sale” from showing on a winter look (and the reverse).
              </span>
            </span>
          </label>
        ) : null}

        <div className="row">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save theme"}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="card">
          <h3>Recommended copy for {THEME_META[theme]?.label}</h3>
          <table>
            <thead>
              <tr>
                <th>Placement</th>
                <th>Title</th>
                <th>Body</th>
                <th>CTA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>STRIP</td>
                <td>{preview.strip.title}</td>
                <td>{preview.strip.body}</td>
                <td>{preview.strip.ctaText}</td>
              </tr>
              <tr>
                <td>HOME_PROMO</td>
                <td>{preview.promo.title}</td>
                <td>{preview.promo.body}</td>
                <td>{preview.promo.ctaText}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 12 }}>
            Fine-tune wording anytime under Banners. Theme only sets the site look and optional
            starter copy.
          </p>
        </div>
      ) : null}
    </div>
  );
}
