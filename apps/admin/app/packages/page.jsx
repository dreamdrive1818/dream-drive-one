"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const EMPTY_PACK = {
  name: "",
  slug: "",
  days: 2,
  pricePaise: 1000000,
  depositPaise: 0,
  cityId: "",
  carClass: "suv",
  inclusions: "",
  published: true,
  daysDetail: [
    { dayNumber: 1, title: "", description: "" },
    { dayNumber: 2, title: "", description: "" },
  ],
};

const CLASSES = ["hatchback", "sedan", "suv", "mpv", "luxury"];

function rupees(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

export default function PackagesPage() {
  const [tab, setTab] = useState("packages");
  const [error, setError] = useState("");
  const [cities, setCities] = useState([]);
  const [packages, setPackages] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [airports, setAirports] = useState([]);
  const [settings, setSettings] = useState({ driverAllowancePerNightPaise: 30000 });
  const [pack, setPack] = useState(EMPTY_PACK);
  const [editingId, setEditingId] = useState("");
  const [pair, setPair] = useState({ fromCityId: "", toCityId: "", oneWayPaise: 350000 });
  const [airport, setAirport] = useState({
    cityId: "",
    name: "",
    code: "",
    freeWaitMinutes: 45,
    waitPaisePerMin: 500,
    nightSurchargePaise: 20000,
    nightStartsHour: 22,
    nightEndsHour: 6,
    active: true,
  });
  const [editingAirport, setEditingAirport] = useState("");

  function load() {
    api("/v1/admin/packages").then(setPackages).catch((e) => setError(e.message));
    api("/v1/admin/city-pairs").then(setPairs).catch(() => {});
    api("/v1/admin/airports").then(setAirports).catch(() => {});
    api("/v1/admin/cities").then(setCities).catch(() => {});
    api("/v1/admin/catalog-settings").then(setSettings).catch(() => {});
  }
  useEffect(load, []);

  function setDayCount(n) {
    const days = Math.max(1, Number(n) || 1);
    const detail = [...(pack.daysDetail || [])];
    while (detail.length < days) {
      detail.push({ dayNumber: detail.length + 1, title: "", description: "" });
    }
    setPack({ ...pack, days, daysDetail: detail.slice(0, days).map((d, i) => ({ ...d, dayNumber: i + 1 })) });
  }

  async function savePack(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...pack,
      days: Number(pack.days),
      pricePaise: Number(pack.pricePaise),
      depositPaise: Number(pack.depositPaise) || 0,
      cityId: pack.cityId || null,
      daysDetail: (pack.daysDetail || []).filter((d) => d.title),
    };
    try {
      if (editingId) await api(`/v1/admin/packages/${editingId}`, { method: "PATCH", body });
      else await api("/v1/admin/packages", { method: "POST", body });
      setPack(EMPTY_PACK);
      setEditingId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePair(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/v1/admin/city-pairs", {
        method: "POST",
        body: { ...pair, oneWayPaise: Number(pair.oneWayPaise) },
      });
      setPair({ fromCityId: "", toCityId: "", oneWayPaise: 350000 });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveAirport(e) {
    e.preventDefault();
    setError("");
    const body = {
      ...airport,
      code: airport.code.trim().toUpperCase(),
      freeWaitMinutes: Number(airport.freeWaitMinutes),
      waitPaisePerMin: Number(airport.waitPaisePerMin),
      nightSurchargePaise: Number(airport.nightSurchargePaise),
      nightStartsHour: Number(airport.nightStartsHour),
      nightEndsHour: Number(airport.nightEndsHour),
    };
    try {
      if (editingAirport) await api(`/v1/admin/airports/${editingAirport}`, { method: "PATCH", body });
      else await api("/v1/admin/airports", { method: "POST", body });
      setAirport({
        cityId: "",
        name: "",
        code: "",
        freeWaitMinutes: 45,
        waitPaisePerMin: 500,
        nightSurchargePaise: 20000,
        nightStartsHour: 22,
        nightEndsHour: 6,
        active: true,
      });
      setEditingAirport("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePolicy(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await api("/v1/admin/catalog-settings", {
        method: "PUT",
        body: { driverAllowancePerNightPaise: Number(settings.driverAllowancePerNightPaise) },
      });
      setSettings(row);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <h2>Airport, one-way & tours</h2>
      <div className="tabs">
        {[
          ["packages", "Tour packages"],
          ["pairs", "City pairs"],
          ["airports", "Airports"],
          ["policy", "Outstation policy"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}

      {tab === "packages" && (
        <>
          <form className="card" onSubmit={savePack}>
            <h3>{editingId ? "Edit package" : "Add package"}</h3>
            <div className="row">
              <label>
                Name
                <input
                  value={pack.name}
                  onChange={(e) =>
                    setPack({
                      ...pack,
                      name: e.target.value,
                      slug: pack.slug || e.target.value.toLowerCase().replace(/\s+/g, "-"),
                    })
                  }
                  required
                />
              </label>
              <label>
                Slug
                <input value={pack.slug} onChange={(e) => setPack({ ...pack, slug: e.target.value })} required />
              </label>
              <label>
                Days
                <input type="number" min="1" value={pack.days} onChange={(e) => setDayCount(e.target.value)} />
              </label>
              <label>
                Price (paise)
                <input type="number" value={pack.pricePaise} onChange={(e) => setPack({ ...pack, pricePaise: e.target.value })} />
              </label>
              <label>
                Deposit (paise)
                <input type="number" value={pack.depositPaise} onChange={(e) => setPack({ ...pack, depositPaise: e.target.value })} />
              </label>
              <label>
                City
                <select value={pack.cityId} onChange={(e) => setPack({ ...pack, cityId: e.target.value })}>
                  <option value="">Any</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Car class
                <select value={pack.carClass} onChange={(e) => setPack({ ...pack, carClass: e.target.value })}>
                  <option value="">Any</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Inclusions
              <textarea value={pack.inclusions} onChange={(e) => setPack({ ...pack, inclusions: e.target.value })} />
            </label>
            {(pack.daysDetail || []).map((d, i) => (
              <div className="row" key={i}>
                <label>
                  Day {i + 1} title
                  <input
                    value={d.title}
                    onChange={(e) => {
                      const daysDetail = [...pack.daysDetail];
                      daysDetail[i] = { ...d, title: e.target.value };
                      setPack({ ...pack, daysDetail });
                    }}
                  />
                </label>
                <label>
                  Description
                  <input
                    value={d.description || ""}
                    onChange={(e) => {
                      const daysDetail = [...pack.daysDetail];
                      daysDetail[i] = { ...d, description: e.target.value };
                      setPack({ ...pack, daysDetail });
                    }}
                  />
                </label>
              </div>
            ))}
            <label className="row">
              <input
                type="checkbox"
                checked={pack.published}
                onChange={(e) => setPack({ ...pack, published: e.target.checked })}
                style={{ width: "auto" }}
              />
              Published
            </label>
            <div className="row">
              <button type="submit">{editingId ? "Save package" : "Create package"}</button>
              {editingId && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setEditingId("");
                    setPack(EMPTY_PACK);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Days</th>
                  <th>Price</th>
                  <th>Class</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.days}</td>
                    <td>{rupees(p.pricePaise)}</td>
                    <td>{p.carClass || "—"}</td>
                    <td>{p.published ? "Yes" : "No"}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setEditingId(p.id);
                          setPack({
                            name: p.name,
                            slug: p.slug,
                            days: p.days,
                            pricePaise: p.pricePaise,
                            depositPaise: p.depositPaise || 0,
                            cityId: p.cityId || "",
                            carClass: p.carClass || "",
                            inclusions: p.inclusions || "",
                            published: p.published,
                            daysDetail: (p.daysDetail || []).length
                              ? p.daysDetail
                              : Array.from({ length: p.days }, (_, i) => ({ dayNumber: i + 1, title: "", description: "" })),
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          api(`/v1/admin/packages/${p.id}/delete`, { method: "POST" })
                            .then(load)
                            .catch((e) => setError(e.message))
                        }
                      >
                        Unpublish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "pairs" && (
        <>
          <form className="card" onSubmit={savePair}>
            <h3>One-way city pair</h3>
            <div className="row">
              <label>
                From
                <select value={pair.fromCityId} onChange={(e) => setPair({ ...pair, fromCityId: e.target.value })} required>
                  <option value="">Select</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                To
                <select value={pair.toCityId} onChange={(e) => setPair({ ...pair, toCityId: e.target.value })} required>
                  <option value="">Select</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                One-way fee (paise)
                <input type="number" value={pair.oneWayPaise} onChange={(e) => setPair({ ...pair, oneWayPaise: e.target.value })} />
              </label>
            </div>
            <button type="submit">Save pair</button>
          </form>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Fee</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr key={p.id}>
                    <td>{p.fromCity?.name || p.fromCityId}</td>
                    <td>{p.toCity?.name || p.toCityId}</td>
                    <td>{rupees(p.oneWayPaise)}</td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          api(`/v1/admin/city-pairs/${p.id}/delete`, { method: "POST" })
                            .then(load)
                            .catch((e) => setError(e.message))
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "airports" && (
        <>
          <form className="card" onSubmit={saveAirport}>
            <h3>{editingAirport ? "Edit terminal" : "Add terminal"}</h3>
            <div className="row">
              <label>
                City
                <select value={airport.cityId} onChange={(e) => setAirport({ ...airport, cityId: e.target.value })} required>
                  <option value="">Select</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input value={airport.name} onChange={(e) => setAirport({ ...airport, name: e.target.value })} required />
              </label>
              <label>
                Code
                <input value={airport.code} onChange={(e) => setAirport({ ...airport, code: e.target.value })} required />
              </label>
              <label>
                Free wait (min)
                <input type="number" value={airport.freeWaitMinutes} onChange={(e) => setAirport({ ...airport, freeWaitMinutes: e.target.value })} />
              </label>
              <label>
                Wait paise / min
                <input type="number" value={airport.waitPaisePerMin} onChange={(e) => setAirport({ ...airport, waitPaisePerMin: e.target.value })} />
              </label>
              <label>
                Night surcharge (paise)
                <input type="number" value={airport.nightSurchargePaise} onChange={(e) => setAirport({ ...airport, nightSurchargePaise: e.target.value })} />
              </label>
              <label>
                Night from (hour)
                <input type="number" min="0" max="23" value={airport.nightStartsHour} onChange={(e) => setAirport({ ...airport, nightStartsHour: e.target.value })} />
              </label>
              <label>
                Night until (hour)
                <input type="number" min="0" max="23" value={airport.nightEndsHour} onChange={(e) => setAirport({ ...airport, nightEndsHour: e.target.value })} />
              </label>
            </div>
            <div className="row">
              <button type="submit">{editingAirport ? "Save terminal" : "Create terminal"}</button>
              {editingAirport && (
                <button type="button" className="ghost" onClick={() => setEditingAirport("")}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Terminal</th>
                  <th>City</th>
                  <th>Free wait</th>
                  <th>Wait / min</th>
                  <th>Night</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {airports.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name} ({a.code})</td>
                    <td>{a.city?.name}</td>
                    <td>{a.freeWaitMinutes} min</td>
                    <td>{rupees(a.waitPaisePerMin)}</td>
                    <td>{rupees(a.nightSurchargePaise)}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setEditingAirport(a.id);
                          setAirport({
                            cityId: a.cityId,
                            name: a.name,
                            code: a.code,
                            freeWaitMinutes: a.freeWaitMinutes,
                            waitPaisePerMin: a.waitPaisePerMin,
                            nightSurchargePaise: a.nightSurchargePaise,
                            nightStartsHour: a.nightStartsHour,
                            nightEndsHour: a.nightEndsHour,
                            active: a.active,
                          });
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "policy" && (
        <form className="card" onSubmit={savePolicy}>
          <h3>Outstation driver allowance</h3>
          <p className="muted">Auto-added per IST midnight the trip covers. CITY_MANAGER / FINANCE own this rate.</p>
          <label>
            Per night (paise)
            <input
              type="number"
              value={settings.driverAllowancePerNightPaise ?? 30000}
              onChange={(e) => setSettings({ ...settings, driverAllowancePerNightPaise: e.target.value })}
            />
          </label>
          <p className="muted">Current: {rupees(settings.driverAllowancePerNightPaise)}</p>
          <button type="submit">Save policy</button>
        </form>
      )}
    </div>
  );
}
