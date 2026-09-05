"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";
import { subscribeBookingStatus } from "../../../lib/socket";

const STATUSES = [
  "AWAITING_PAYMENT",
  "AWAITING_KYC",
  "AWAITING_SIGNATURE",
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

function rupees(paise) {
  return `₹${((paise || 0) / 100).toLocaleString("en-IN")}`;
}

function toLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [overrideCity, setOverrideCity] = useState(false);
  const [nextStatus, setNextStatus] = useState("CONFIRMED");
  const [comped, setComped] = useState(false);
  const [reason, setReason] = useState("");
  const [extraLabel, setExtraLabel] = useState("");
  const [extraPaise, setExtraPaise] = useState("");
  const [handover, setHandover] = useState({
    odometerKm: "",
    fuelUnit: "EIGHTHS",
    fuelLevel: "8",
    notes: "",
    signatureUrl: "",
    photos: [],
    items: [
      { label: "Spare tyre", present: true },
      { label: "Jack & tools", present: true },
      { label: "First-aid kit", present: true },
      { label: "Fire extinguisher", present: true },
      { label: "Floor mats", present: true },
      { label: "Music system", present: true },
      { label: "RC / insurance copy", present: true },
    ],
  });
  const [ret, setRet] = useState({
    odometerKm: "",
    fuelUnit: "EIGHTHS",
    fuelLevel: "8",
    notes: "",
    signatureUrl: "",
    photos: [],
    damages: [{ description: "", amountRupees: "" }],
  });
  const [newDamage, setNewDamage] = useState({ description: "", amountRupees: "" });

  async function load() {
    const row = await api(`/v1/bookings/${id}`);
    setBooking(row);
    setNotes(row.notes || "");
    setFlightNumber(row.flightNumber || "");
    setStartsAt(toLocal(row.startsAt));
    setEndsAt(toLocal(row.endsAt));
    setVehicleId(row.vehicleId || "");
    setDriverId(row.driverAssignment?.driverId || "");
    setNextStatus(row.status);
    const lastHandover = (row.inspections || []).find((i) => i.type === "HANDOVER");
    if (lastHandover) {
      setRet((prev) => ({
        ...prev,
        fuelUnit: lastHandover.fuelUnit || "EIGHTHS",
        odometerKm: prev.odometerKm || String(lastHandover.odometerKm || ""),
      }));
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api("/v1/admin/vehicles").then(setVehicles).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!booking?.id) return;
    if (!booking.startsAt || !booking.endsAt || booking.rentalType === "SELF_DRIVE") {
      api("/v1/admin/drivers").then(setDrivers).catch(() => undefined);
      return;
    }
    const params = new URLSearchParams({
      from: new Date(booking.startsAt).toISOString(),
      to: new Date(booking.endsAt).toISOString(),
    });
    api(`/v1/admin/drivers/availability?${params}`)
      .then(setDrivers)
      .catch(() => api("/v1/admin/drivers").then(setDrivers).catch(() => undefined));
  }, [booking?.id, booking?.startsAt, booking?.endsAt, booking?.rentalType]);

  useEffect(() => {
    if (!booking?.id) return undefined;
    return subscribeBookingStatus(booking.publicId || booking.id, () => {
      load().catch(() => undefined);
    });
  }, [booking?.id, booking?.publicId]);

  async function act(label, fn) {
    setBusy(label);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(files, folder = "inspections") {
    const urls = [];
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const uploaded = await api("/v1/uploads", { method: "POST", body });
      const url = uploaded.url || uploaded.secure_url;
      if (url) urls.push(url);
    }
    return urls;
  }

  function fuelHint(unit) {
    return unit === "PERCENT" ? "0–100" : "0–8 or FULL";
  }

  if (!booking && !error) return <p className="muted">Loading booking…</p>;
  if (!booking) return <p className="err">{error}</p>;

  const modelVehicles = vehicles.filter((v) => v.carModelId === booking.carModelId);

  return (
    <div>
      <p className="muted">
        <Link href="/bookings">← Bookings</Link>
      </p>
      <h2>{booking.publicId}</h2>
      <p className="muted">
        {booking.user?.email} · {booking.rentalType} · {booking.status}
      </p>
      {error && <p className="err">{error}</p>}

      <div className="grid">
        <div className="card">
          <h3>Amount</h3>
          <strong>{rupees(booking.amountPaise)}</strong>
          <p className="muted">Deposit {rupees(booking.depositPaise)}</p>
        </div>
        <div className="card">
          <h3>Vehicle</h3>
          <strong>{booking.vehicle?.registration || "Unassigned"}</strong>
        </div>
        <div className="card">
          <h3>Driver</h3>
          <strong>{booking.driverAssignment?.driver?.fullName || "—"}</strong>
          {booking.driverAssignment?.driver?.phone && (
            <p className="muted">{booking.driverAssignment.driver.phone}</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Change dates / notes (re-quotes)</h3>
        <div className="row">
          <label>
            Starts
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label>
            Ends
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
          <label>
            Flight
            <input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} />
          </label>
        </div>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            act("patch", () =>
              api(`/v1/admin/bookings/${booking.id}`, {
                method: "PATCH",
                body: {
                  notes,
                  flightNumber,
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                },
              })
            )
          }
        >
          Save & re-check availability
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Assign</h3>
        <div className="row">
          <label>
            Vehicle
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select</option>
              {modelVehicles.map((v) => {
                const insured = (v.documents || []).some(
                  (d) => String(d.kind).toUpperCase() === "INSURANCE" && d.expiresAt
                );
                return (
                  <option key={v.id} value={v.id} disabled={["BLOCKED", "MAINTENANCE", "SOLD"].includes(v.status)}>
                    {v.registration} ({v.status}){insured ? "" : " · no insurance"}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            disabled={busy || !vehicleId}
            onClick={() =>
              act("vehicle", () =>
                api(`/v1/admin/bookings/${booking.id}/assign-vehicle`, {
                  method: "POST",
                  body: { vehicleId },
                })
              )
            }
          >
            Assign vehicle
          </button>
        </div>
        {booking.rentalType !== "SELF_DRIVE" && (
          <div className="row">
            <label>
              Driver
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                <option value="">Select</option>
                {drivers.map((d) => {
                  const notes = [];
                  if (d.available === false) notes.push((d.reasons || []).join(", ") || "unavailable");
                  if (d.active === false) notes.push("inactive");
                  return (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                      {d.branch?.city?.name ? ` · ${d.branch.city.name}` : ""}
                      {notes.length ? ` (${notes.join("; ")})` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={overrideCity}
                onChange={(e) => setOverrideCity(e.target.checked)}
                style={{ width: "auto" }}
              />
              City override (CITY_MANAGER)
            </label>
            <button
              type="button"
              className="ghost"
              disabled={busy || !driverId}
              onClick={() =>
                act("driver", () =>
                  api(`/v1/admin/bookings/${booking.id}/assign-driver`, {
                    method: "POST",
                    body: { driverId, overrideCity },
                  })
                )
              }
            >
              Assign driver
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Status</h3>
        <div className="row">
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="row">
            <input
              type="checkbox"
              checked={comped}
              onChange={(e) => setComped(e.target.checked)}
              style={{ width: "auto" }}
            />
            Comp (skip token)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act("status", () =>
                api(`/v1/admin/bookings/${booking.id}/status`, {
                  method: "POST",
                  body: { status: nextStatus, reason, comped },
                })
              )
            }
          >
            Update status
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() =>
              act("cancel", () =>
                api(`/v1/bookings/${booking.id}/cancel`, {
                  method: "POST",
                  body: { reason: reason || "admin cancel" },
                })
              )
            }
          >
            Cancel + policy refund
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Trip extras (extra km / hours on return)</h3>
        {(booking.extras || []).map((ex) => (
          <p key={ex.id} className="muted">
            {ex.label}: {rupees(ex.amountPaise)}
          </p>
        ))}
        <div className="row">
          <label>
            Label
            <input
              value={extraLabel}
              onChange={(e) => setExtraLabel(e.target.value)}
              placeholder="Extra km"
            />
          </label>
          <label>
            Amount (paise)
            <input type="number" value={extraPaise} onChange={(e) => setExtraPaise(e.target.value)} />
          </label>
          <button
            type="button"
            className="ghost"
            disabled={busy || !extraLabel || !Number(extraPaise)}
            onClick={() =>
              act("extras", () =>
                api(`/v1/admin/bookings/${booking.id}/extras`, {
                  method: "POST",
                  body: { extras: [{ label: extraLabel, amountPaise: Number(extraPaise) }] },
                }).then(() => {
                  setExtraLabel("");
                  setExtraPaise("");
                })
              )
            }
          >
            Add extra
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Agreement</h3>
        {(booking.agreements || []).length === 0 && <p className="muted">No agreement generated yet.</p>}
        {(booking.agreements || []).map((a) => (
          <p key={a.id} className="muted">
            {a.status} {a.pdfUrl ? "· PDF ready" : ""}
          </p>
        ))}
        <div className="row">
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() =>
              act("agreement", () =>
                api("/v1/agreements/generate", { method: "POST", body: { bookingId: booking.id } })
              )
            }
          >
            Generate agreement
          </button>
          <Link className="btn ghost" href="/agreements">
            Open agreements
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Handover / return</h3>
        {(booking.inspections || []).length === 0 && (
          <p className="muted">No inspections yet. Self-drive needs CONFIRMED + signed agreement.</p>
        )}
        {(booking.inspections || []).map((ins) => (
          <div key={ins.id} className="card" style={{ marginBottom: 12 }}>
            <p>
              <strong>{ins.type}</strong> · {ins.status} · {ins.odometerKm} km · fuel {ins.fuelLevel}
              {ins.fuelUnit === "PERCENT" ? "%" : "/8"}
            </p>
            {ins.notes ? <p className="muted">{ins.notes}</p> : null}
            {(ins.items || []).length > 0 && (
              <p className="muted">
                Accessories:{" "}
                {ins.items.map((it) => `${it.label}${it.present ? "" : " (missing)"}`).join(", ")}
              </p>
            )}
            {(ins.damages || []).map((d) => (
              <p key={d.id} className="muted">
                Damage: {d.description} · {rupees(d.amountPaise)} · {d.status}
                {d.status === "OPEN" ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() =>
                        act("waive", () =>
                          api(`/v1/admin/inspections/${ins.id}/damages/${d.id}/waive`, { method: "POST", body: {} })
                        )
                      }
                    >
                      Waive
                    </button>
                  </>
                ) : null}
              </p>
            ))}
            <div className="row" style={{ marginTop: 8 }}>
              {(ins.photos || []).map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                </a>
              ))}
              {ins.signatureUrl ? (
                <a href={ins.signatureUrl} target="_blank" rel="noreferrer">
                  <img src={ins.signatureUrl} alt="signature" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 8 }} />
                </a>
              ) : null}
            </div>
            {ins.type === "RETURN" && ins.status === "OPEN" ? (
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act("close", () => api(`/v1/admin/inspections/${ins.id}/close`, { method: "POST", body: {} }))}
                >
                  Close return (release deposit)
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {booking.status === "CONFIRMED" && booking.vehicleId ? (
          <div style={{ marginTop: 12 }}>
            <h3>Start handover</h3>
            <div className="row">
              <label>
                Odometer (km)
                <input
                  type="number"
                  value={handover.odometerKm}
                  onChange={(e) => setHandover({ ...handover, odometerKm: e.target.value })}
                />
              </label>
              <label>
                Fuel unit
                <select
                  value={handover.fuelUnit}
                  onChange={(e) => setHandover({ ...handover, fuelUnit: e.target.value })}
                >
                  <option value="EIGHTHS">Eighths</option>
                  <option value="PERCENT">Percent</option>
                </select>
              </label>
              <label>
                Fuel ({fuelHint(handover.fuelUnit)})
                <input
                  value={handover.fuelLevel}
                  onChange={(e) => setHandover({ ...handover, fuelLevel: e.target.value })}
                />
              </label>
            </div>
            {(handover.items || []).map((it, i) => (
              <label key={it.label} className="row" style={{ marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={it.present}
                  onChange={(e) => {
                    const items = [...handover.items];
                    items[i] = { ...it, present: e.target.checked };
                    setHandover({ ...handover, items });
                  }}
                  style={{ width: "auto" }}
                />
                {it.label}
              </label>
            ))}
            <label>
              Notes
              <textarea value={handover.notes} onChange={(e) => setHandover({ ...handover, notes: e.target.value })} />
            </label>
            <div className="row">
              <label>
                Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = [...(e.target.files || [])];
                    if (!files.length) return;
                    try {
                      const urls = await uploadFiles(files);
                      setHandover((h) => ({ ...h, photos: [...h.photos, ...urls] }));
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
              <label>
                Customer signature
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const [url] = await uploadFiles([file]);
                      setHandover((h) => ({ ...h, signatureUrl: url || "" }));
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
            </div>
            <div className="row">
              {handover.photos.map((url) => (
                <img key={url} src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !handover.odometerKm}
              onClick={() =>
                act("handover", () =>
                  api(`/v1/admin/bookings/${booking.id}/handover`, {
                    method: "POST",
                    body: {
                      odometerKm: Number(handover.odometerKm),
                      fuelLevel: handover.fuelLevel,
                      fuelUnit: handover.fuelUnit,
                      notes: handover.notes || undefined,
                      photos: handover.photos,
                      items: handover.items,
                      signatureUrl: handover.signatureUrl || undefined,
                    },
                  })
                )
              }
            >
              Record handover
            </button>
          </div>
        ) : null}

        {["HANDOVER", "ONGOING"].includes(booking.status) ? (
          <div style={{ marginTop: 16 }}>
            <h3>Start return</h3>
            <div className="row">
              <label>
                Odometer (km)
                <input
                  type="number"
                  value={ret.odometerKm}
                  onChange={(e) => setRet({ ...ret, odometerKm: e.target.value })}
                />
              </label>
              <label>
                Fuel unit
                <select value={ret.fuelUnit} onChange={(e) => setRet({ ...ret, fuelUnit: e.target.value })}>
                  <option value="EIGHTHS">Eighths</option>
                  <option value="PERCENT">Percent</option>
                </select>
              </label>
              <label>
                Fuel ({fuelHint(ret.fuelUnit)})
                <input value={ret.fuelLevel} onChange={(e) => setRet({ ...ret, fuelLevel: e.target.value })} />
              </label>
            </div>
            <label>
              Notes
              <textarea value={ret.notes} onChange={(e) => setRet({ ...ret, notes: e.target.value })} />
            </label>
            {(ret.damages || []).map((d, i) => (
              <div className="row" key={i}>
                <label>
                  Damage
                  <input
                    value={d.description}
                    onChange={(e) => {
                      const damages = [...ret.damages];
                      damages[i] = { ...d, description: e.target.value };
                      setRet({ ...ret, damages });
                    }}
                    placeholder="Rear bumper scratch"
                  />
                </label>
                <label>
                  Amount (₹)
                  <input
                    type="number"
                    value={d.amountRupees}
                    onChange={(e) => {
                      const damages = [...ret.damages];
                      damages[i] = { ...d, amountRupees: e.target.value };
                      setRet({ ...ret, damages });
                    }}
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              className="ghost"
              onClick={() => setRet({ ...ret, damages: [...ret.damages, { description: "", amountRupees: "" }] })}
            >
              Add damage line
            </button>
            <div className="row" style={{ marginTop: 8 }}>
              <label>
                Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = [...(e.target.files || [])];
                    if (!files.length) return;
                    try {
                      const urls = await uploadFiles(files);
                      setRet((r) => ({ ...r, photos: [...r.photos, ...urls] }));
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
              <label>
                Customer signature
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const [url] = await uploadFiles([file]);
                      setRet((r) => ({ ...r, signatureUrl: url || "" }));
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !ret.odometerKm}
              onClick={() =>
                act("return", () =>
                  api(`/v1/admin/bookings/${booking.id}/return`, {
                    method: "POST",
                    body: {
                      odometerKm: Number(ret.odometerKm),
                      fuelLevel: ret.fuelLevel,
                      fuelUnit: ret.fuelUnit,
                      notes: ret.notes || undefined,
                      photos: ret.photos,
                      signatureUrl: ret.signatureUrl || undefined,
                      damages: ret.damages
                        .filter((d) => d.description && Number(d.amountRupees) > 0)
                        .map((d) => ({
                          description: d.description,
                          amountPaise: Math.round(Number(d.amountRupees) * 100),
                        })),
                    },
                  })
                )
              }
            >
              Record return
            </button>
          </div>
        ) : null}

        {booking.status === "RETURN_PENDING" ? (
          <div style={{ marginTop: 16 }}>
            <h3>Add damage</h3>
            <div className="row">
              <label>
                Description
                <input
                  value={newDamage.description}
                  onChange={(e) => setNewDamage({ ...newDamage, description: e.target.value })}
                />
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  value={newDamage.amountRupees}
                  onChange={(e) => setNewDamage({ ...newDamage, amountRupees: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="ghost"
                disabled={busy || !newDamage.description || !Number(newDamage.amountRupees)}
                onClick={() => {
                  const returnIns = [...(booking.inspections || [])].reverse().find((i) => i.type === "RETURN");
                  if (!returnIns) {
                    setError("Return inspection missing");
                    return;
                  }
                  return act("damage", () =>
                    api(`/v1/admin/inspections/${returnIns.id}/damages`, {
                      method: "POST",
                      body: {
                        description: newDamage.description,
                        amountPaise: Math.round(Number(newDamage.amountRupees) * 100),
                      },
                    }).then(() => setNewDamage({ description: "", amountRupees: "" }))
                  );
                }}
              >
                Invoice damage
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Timeline</h3>
        <ol>
          {(booking.history || []).map((h) => (
            <li key={h.id}>
              {h.from ? `${h.from} → ` : ""}
              {h.to}
              {h.reason ? ` — ${h.reason}` : ""}
              <span className="muted"> {new Date(h.createdAt).toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
