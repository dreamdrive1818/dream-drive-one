"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

const RENTAL_TYPES = [
  ["", "All products (default)"],
  ["SELF_DRIVE", "Self-drive"],
  ["WITH_DRIVER_LOCAL", "With driver — local"],
  ["WITH_DRIVER_INTERCITY", "With driver — intercity"],
  ["AIRPORT", "Airport"],
  ["OUTSTATION", "Outstation"],
  ["ONE_WAY", "One-way"],
  ["TOUR_PACKAGE", "Tour package"],
  ["SUBSCRIPTION", "Subscription"],
];

const EMPTY_BANK = { accountName: "", accountNumber: "", ifsc: "", bankName: "", upi: "" };
const EMPTY_RULE = { rentalType: "", percent: "15", flat: "0" };

function inr(paise) {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN")}`;
}

function ymd(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function bankFrom(partner) {
  const b = partner?.bank || partner?.bankJson || {};
  return {
    accountName: b.accountName || "",
    accountNumber: b.accountNumber || "",
    ifsc: b.ifsc || "",
    bankName: b.bankName || "",
    upi: b.upi || "",
  };
}

export default function PartnerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [partner, setPartner] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", active: true });
  const [bank, setBank] = useState(EMPTY_BANK);
  const [contract, setContract] = useState({ startsOn: "", endsOn: "", notes: "" });
  const [rules, setRules] = useState([EMPTY_RULE]);
  const [attachId, setAttachId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const roles = me?.roles || [];
  const canWrite = roles.includes("SUPER_ADMIN") || roles.includes("FINANCE");
  const canFleet = canWrite || roles.includes("FLEET_OPS") || roles.includes("CITY_MANAGER");
  const canDelete = roles.includes("SUPER_ADMIN");

  async function load() {
    api("/v1/me").then(setMe).catch(() => {});
    try {
      const p = await api(`/v1/admin/partners/${id}`);
      setPartner(p);
      setForm({
        name: p.name || "",
        email: p.email || "",
        phone: p.phone || "",
        active: p.active !== false,
      });
      setBank(bankFrom(p));
      setRules(
        p.rules?.length
          ? p.rules.map((r) => ({
              rentalType: r.rentalType || "",
              percent: String((r.percentBps || 0) / 100),
              flat: String((r.flatPaise || 0) / 100),
            }))
          : [EMPTY_RULE]
      );
    } catch (e) {
      setError(e.message);
    }
    api("/v1/admin/vehicles")
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  const attachable = useMemo(
    () => vehicles.filter((v) => !v.partnerId || v.partnerId === id),
    [vehicles, id]
  );

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/v1/admin/partners/${id}`, {
        method: "PATCH",
        body: { ...form, bankJson: bank },
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveBank(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/admin/partners/${id}`, { method: "PATCH", body: { bankJson: bank } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addContract(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/admin/partners/${id}/contracts`, {
        method: "POST",
        body: {
          startsOn: new Date(contract.startsOn).toISOString(),
          endsOn: contract.endsOn ? new Date(contract.endsOn).toISOString() : null,
          notes: contract.notes || null,
        },
      });
      setContract({ startsOn: "", endsOn: "", notes: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeContract(contractId) {
    if (!window.confirm("Remove this contract?")) return;
    try {
      await api(`/v1/admin/partners/${id}/contracts/${contractId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveRules(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/admin/partners/${id}/commission-rules`, {
        method: "PUT",
        body: {
          rules: rules.map((r) => ({
            rentalType: r.rentalType || null,
            percentBps: Math.round(Number(r.percent || 0) * 100),
            flatPaise: Math.round(Number(r.flat || 0) * 100),
          })),
        },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function attach(e) {
    e.preventDefault();
    if (!attachId) return;
    setError("");
    try {
      await api(`/v1/admin/partners/${id}/vehicles`, { method: "POST", body: { vehicleId: attachId } });
      setAttachId("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function detach(vehicleId) {
    if (!window.confirm("Detach this vehicle from the partner?")) return;
    try {
      await api(`/v1/admin/partners/${id}/vehicles/${vehicleId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this partner?")) return;
    try {
      await api(`/v1/admin/partners/${id}`, { method: "DELETE" });
      router.push("/partners");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!partner) {
    return (
      <div>
        <h2>Partner</h2>
        {error ? <p className="err">{error}</p> : <p className="muted">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <Link href="/partners" className="muted">
          ← Partners
        </Link>
        <Link href={`/partners/${id}/ledger`} className="btn ghost">
          Ledger
        </Link>
        <Link href="/settlements" className="btn ghost">
          Settlements
        </Link>
      </div>
      <h2>{partner.name}</h2>
      <p className="muted">
        Balance {inr(partner.ledgerBalancePaise)} · {partner.openDamageCount || 0} open damage
        {partner.hasBank ? " · bank on file" : " · bank missing"}
      </p>
      {error && <p className="err">{error}</p>}

      <div className="card">
        <h3>Profile</h3>
        <form onSubmit={saveProfile}>
          <div className="row">
            <label>
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              Active
              <select
                value={form.active ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "yes" })}
                disabled={!canWrite}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          </div>
          {canWrite && (
            <div className="row">
              <button type="submit" disabled={busy}>
                Save profile
              </button>
              {canDelete && (
                <button type="button" className="danger" onClick={remove}>
                  Delete
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <h3>Bank (required before payout)</h3>
        <form onSubmit={saveBank}>
          <div className="row">
            <label>
              Account name
              <input value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              Account number
              <input value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              IFSC
              <input value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} disabled={!canWrite} />
            </label>
            <label>
              Bank name
              <input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} disabled={!canWrite} />
            </label>
            <label>
              UPI
              <input value={bank.upi} onChange={(e) => setBank({ ...bank, upi: e.target.value })} disabled={!canWrite} />
            </label>
          </div>
          {canWrite && <button type="submit">Save bank</button>}
        </form>
      </div>

      <div className="card">
        <h3>Contracts</h3>
        <table>
          <thead>
            <tr>
              <th>Starts</th>
              <th>Ends</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(partner.contracts || []).map((c) => (
              <tr key={c.id}>
                <td>{ymd(c.startsOn)}</td>
                <td>{c.endsOn ? ymd(c.endsOn) : "Open"}</td>
                <td>{c.notes || "—"}</td>
                <td>
                  {canFleet && (
                    <button type="button" className="ghost" onClick={() => removeContract(c.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!(partner.contracts || []).length && (
              <tr>
                <td colSpan={4} className="muted">
                  No contract — partner cars cannot be assigned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canFleet && (
          <form onSubmit={addContract} style={{ marginTop: 12 }}>
            <div className="row">
              <label>
                Starts
                <input type="date" required value={contract.startsOn} onChange={(e) => setContract({ ...contract, startsOn: e.target.value })} />
              </label>
              <label>
                Ends (optional)
                <input type="date" value={contract.endsOn} onChange={(e) => setContract({ ...contract, endsOn: e.target.value })} />
              </label>
              <label>
                Notes
                <input value={contract.notes} onChange={(e) => setContract({ ...contract, notes: e.target.value })} />
              </label>
            </div>
            <button type="submit">Add contract</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>Commission (% or flat per product)</h3>
        <p className="muted">New bookings snapshot these rates. Changing a rule does not rewrite past trips.</p>
        <form onSubmit={saveRules}>
          {rules.map((r, i) => (
            <div className="row" key={i}>
              <label>
                Product
                <select
                  value={r.rentalType}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, rentalType: e.target.value };
                    setRules(next);
                  }}
                  disabled={!canWrite}
                >
                  {RENTAL_TYPES.map(([v, label]) => (
                    <option key={v || "all"} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Percent
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={r.percent}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, percent: e.target.value };
                    setRules(next);
                  }}
                  disabled={!canWrite}
                />
              </label>
              <label>
                Flat ₹
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={r.flat}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...r, flat: e.target.value };
                    setRules(next);
                  }}
                  disabled={!canWrite}
                />
              </label>
              {canWrite && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setRules(rules.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {canWrite && (
            <div className="row">
              <button type="button" className="ghost" onClick={() => setRules([...rules, { ...EMPTY_RULE }])}>
                Add rule
              </button>
              <button type="submit">Save rules</button>
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <h3>Vehicles</h3>
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Model</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(partner.vehicles || []).map((v) => (
              <tr key={v.id}>
                <td>{v.registration}</td>
                <td>{v.carModel?.name || "—"}</td>
                <td>{v.status}</td>
                <td>
                  {canFleet && (
                    <button type="button" className="ghost" onClick={() => detach(v.id)}>
                      Detach
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!(partner.vehicles || []).length && (
              <tr>
                <td colSpan={4} className="muted">
                  No cars attached.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canFleet && (
          <form onSubmit={attach} className="row" style={{ marginTop: 12 }}>
            <label>
              Attach vehicle
              <select value={attachId} onChange={(e) => setAttachId(e.target.value)}>
                <option value="">Select</option>
                {attachable.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration} {v.partnerId === id ? "(already attached)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Attach</button>
          </form>
        )}
      </div>

      {!!(partner.openDamages || []).length && (
        <div className="card">
          <h3>Open damages (payout hold)</h3>
          <ul>
            {partner.openDamages.map((d) => (
              <li key={d.id}>
                {d.registration} · {d.publicId} · {d.description} · {inr(d.amountPaise)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
