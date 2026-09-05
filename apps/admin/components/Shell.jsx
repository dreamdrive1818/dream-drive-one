"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, getOpsBranch, getOpsCity, getToken, setOpsScope } from "../lib/api";
import { useEffect, useMemo, useState } from "react";

const LINKS = [
  ["/", "Dashboard", null],
  ["/bookings", "Bookings", ["SALES", "SUPPORT", "FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"]],
  ["/cars", "Cars", ["FLEET_OPS", "CITY_MANAGER", "SALES"]],
  ["/vehicles", "Vehicles", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"]],
  ["/availability", "Availability", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SALES"]],
  ["/drivers", "Drivers", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"]],
  ["/maintenance", "Maintenance", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"]],
  ["/inspections", "Inspections", ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"]],
  ["/kyc", "KYC", ["SUPPORT", "SALES"]],
  ["/agreements", "Agreements", ["SUPPORT", "SALES"]],
  ["/customers", "Customers", ["SUPPORT", "SALES"]],
  ["/staff", "Staff", ["CITY_MANAGER"]],
  ["/cities", "Cities", ["CITY_MANAGER"]],
  ["/branches", "Branches", ["CITY_MANAGER", "FLEET_OPS", "BRANCH_MANAGER"]],
  ["/tickets", "Tickets", ["SUPPORT", "SALES"]],
  ["/payments", "Payments", ["FINANCE"]],
  ["/partners", "Partners", ["FINANCE", "FLEET_OPS", "CITY_MANAGER"]],
  ["/settlements", "Settlements", ["FINANCE"]],
  ["/leads", "Leads", ["SALES"]],
  ["/offers", "Offers", ["SALES"]],
  ["/packages", "Trips & tours", ["SALES", "FLEET_OPS"]],
  ["/cms", "CMS", ["SALES"]],
  ["/banners", "Banners", ["SALES"]],
  ["/blogs", "Blogs", ["SALES"]],
  ["/media", "Media", ["SALES"]],
  ["/reports", "Reports", ["FINANCE"]],
  ["/audit", "Audit", []],
];

const STAFF = new Set([
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
]);

function canSee(roles, allowed) {
  if ((roles || []).includes("SUPER_ADMIN")) return true;
  if (allowed == null) return true;
  return allowed.some((role) => roles.includes(role));
}

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [branchId, setBranchId] = useState("");

  const roles = me?.roles || [];
  const isSuper = roles.includes("SUPER_ADMIN");
  const isCityManager = Boolean(me?.canSwitchBranch && !me?.canSwitchCity);
  const isBranchLocked = !isSuper && !isCityManager;
  const canSwitch = isSuper || isCityManager;

  useEffect(() => {
    if (path === "/login") return;
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/me")
      .then((user) => {
        if (!(user.roles || []).some((r) => STAFF.has(r))) {
          localStorage.removeItem("dd_token");
          router.replace("/login");
          return;
        }
        setMe(user);
        const savedCity = getOpsCity();
        const savedBranch = getOpsBranch();
        if ((user.roles || []).includes("SUPER_ADMIN")) {
          setCityId(savedCity);
          setBranchId(savedBranch);
        } else if ((user.roles || []).includes("CITY_MANAGER")) {
          setCityId(user.cityId || "");
          setBranchId(savedBranch);
          if (user.cityId && (savedCity !== user.cityId)) {
            setOpsScope(user.cityId, savedBranch);
          }
        } else {
          setCityId(user.cityId || "");
          setBranchId(user.branchId || "");
          if (savedCity !== (user.cityId || "") || savedBranch !== (user.branchId || "")) {
            setOpsScope(user.cityId || "", user.branchId || "");
          }
        }
      })
      .catch(() => {
        localStorage.removeItem("dd_token");
        router.replace("/login");
      });
  }, [path, router]);

  useEffect(() => {
    if (path === "/login" || !me) return;
    api("/v1/admin/cities")
      .then(setCities)
      .catch(() => setCities([]));
  }, [path, me]);

  useEffect(() => {
    function onScope(event) {
      setCityId(event.detail?.cityId || "");
      setBranchId(event.detail?.branchId || "");
    }
    window.addEventListener("dd-ops-scope", onScope);
    return () => window.removeEventListener("dd-ops-scope", onScope);
  }, []);

  const branches = useMemo(() => {
    const city = cities.find((c) => c.id === cityId);
    return city?.branches || cities.flatMap((c) => c.branches || []);
  }, [cities, cityId]);

  const lockedLabel = useMemo(() => {
    const city = cities.find((c) => c.id === cityId);
    const branch = (city?.branches || cities.flatMap((c) => c.branches || [])).find((b) => b.id === branchId);
    if (branch) return `${city?.name || ""} · ${branch.name}`.trim();
    if (city) return city.name;
    return "No location assigned";
  }, [cities, cityId, branchId]);

  function applyScope(nextCity, nextBranch) {
    setCityId(nextCity);
    setBranchId(nextBranch);
    setOpsScope(nextCity, nextBranch);
  }

  if (path === "/login") return children;

  return (
    <div className="shell">
      <aside>
        <h1>Dream-Drive</h1>
        <p className="muted">{me?.email || "Operations"}</p>
        <div className="scope-switch">
          <span className="muted">Location</span>
          {canSwitch ? (
            <>
              <select
                value={cityId}
                disabled={isCityManager}
                onChange={(e) => applyScope(e.target.value, "")}
              >
                {isSuper && <option value="">All cities</option>}
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={branchId}
                onChange={(e) => applyScope(cityId, e.target.value)}
                disabled={isCityManager && !cityId}
              >
                <option value="">All branches</option>
                {(cityId ? branches.filter((b) => b.cityId === cityId || !b.cityId) : branches).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="scope-lock">{isBranchLocked ? lockedLabel : "All locations"}</p>
          )}
        </div>
        <nav>
          {LINKS.filter(([, , allowed]) => canSee(roles, allowed)).map(([href, label]) => (
            <Link key={href} href={href} className={path === href || (href !== "/" && path.startsWith(href)) ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
        <button
          className="ghost"
          onClick={() => {
            localStorage.removeItem("dd_token");
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </aside>
      <main key={`${cityId}-${branchId}`}>{children}</main>
    </div>
  );
}
