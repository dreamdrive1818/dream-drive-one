"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, getOpsBranch, getOpsCity, setOpsScope } from "../lib/api";
import { roleLabel } from "../lib/rbac";

const CARDS = [
  ["handoversToday", "Today’s handovers", "/bookings"],
  ["overdueReturns", "Overdue returns", "/bookings"],
  ["pendingKyc", "Pending KYC", "/kyc"],
  ["pendingSignatures", "Pending signatures", "/agreements"],
  ["failedPayments", "Failed payments", "/payments"],
  ["workshop", "Vehicles in workshop", "/maintenance"],
  ["vehiclesAvailable", "Vehicles free", "/fleet?view=vehicles"],
  ["bookings", "Bookings", "/bookings"],
];

function greetingNow() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  );
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function displayName(user) {
  const full = user?.fullName?.trim();
  if (full) return full.split(/\s+/)[0];
  const local = String(user?.email || "").split("@")[0];
  if (!local) return "";
  const token = local.split(/[._+-]/)[0];
  return token ? token.charAt(0).toUpperCase() + token.slice(1) : "";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [cities, setCities] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cityId, setCityId] = useState("");
  const [branchId, setBranchId] = useState("");

  const canSwitchCity = Boolean(me?.canSwitchCity);
  const canSwitchBranch = Boolean(me?.canSwitchBranch);
  const branches = useMemo(() => {
    const city = cities.find((c) => c.id === cityId);
    return city?.branches || [];
  }, [cities, cityId]);

  function load(nextFrom = from, nextTo = to) {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const qs = params.toString() ? `?${params}` : "";
    api(`/v1/admin/dashboard${qs}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api("/v1/me")
      .then((user) => {
        setMe(user);
        setCityId(user.canSwitchCity ? getOpsCity() : user.cityId || "");
        setBranchId(user.canSwitchCity || user.canSwitchBranch ? getOpsBranch() : user.branchId || "");
      })
      .catch(() => undefined);
    api("/v1/admin/cities").then(setCities).catch(() => setCities([]));
    load();
  }, []);

  function applyLocation(nextCity, nextBranch) {
    setCityId(nextCity);
    setBranchId(nextBranch);
    setOpsScope(nextCity, nextBranch);
    load();
  }

  if (error) return <p className="err">{error}</p>;

  const name = displayName(me);
  const greet = greetingNow();
  const role = (me?.roles || []).find((r) => r !== "CUSTOMER");
  const scopeLabel = data?.scope?.branchName
    ? `${data.scope.cityName || ""} · ${data.scope.branchName}`
    : data?.scope?.cityName || "All locations";
  const hello = (
    <div className="dash-hello">
      <div>
        <p className="dash-greet">
          {greet}{name ? `, ${name}` : ""}
        </p>
        <h2>Dashboard</h2>
        {data ? (
          <p className="muted">Operations for {scopeLabel}. Switch city/branch to filter every admin list.</p>
        ) : (
          <p className="muted">Loading today’s numbers…</p>
        )}
      </div>
      <div className="dash-hello-meta">
        <span>{todayLabel()}</span>
        {role ? <span className="chip">{roleLabel(role)}</span> : null}
      </div>
    </div>
  );

  if (!data) {
    return hello;
  }

  return (
    <div>
      {hello}
      <form
        className="row"
        style={{ marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        {(canSwitchCity || canSwitchBranch) && (
          <>
            <label>
              City
              <select
                value={cityId}
                disabled={!canSwitchCity}
                onChange={(e) => applyLocation(e.target.value, "")}
              >
                {canSwitchCity && <option value="">All cities</option>}
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              <select value={branchId} onChange={(e) => applyLocation(cityId, e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit">Filter</button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setFrom("");
            setTo("");
            load("", "");
          }}
        >
          Today
        </button>
      </form>
      <div className="grid">
        {CARDS.map(([key, label, href]) => (
          <Link key={key} href={href} className="card">
            <h3>{label}</h3>
            <strong>{data[key] ?? 0}</strong>
          </Link>
        ))}
        <div className="card">
          <h3>Revenue</h3>
          <strong>₹{((data.revenuePaise || 0) / 100).toLocaleString("en-IN")}</strong>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>By status</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {(data.byStatus || []).map((row) => (
              <tr key={row.status}>
                <td>{row.status}</td>
                <td>{row._count}</td>
              </tr>
            ))}
            {!(data.byStatus || []).length && (
              <tr>
                <td colSpan={2} className="muted">
                  No bookings in this location.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
