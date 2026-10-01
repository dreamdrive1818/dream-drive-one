"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, getOpsBranch, getOpsCity, getToken, setOpsScope } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import { NAV, canAccessPath, groupedNav, isStaff, roleLabel } from "../lib/rbac";

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

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
        if (!isStaff(user.roles || [])) {
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
    const ownProfile = me.id && (path === `/staff/${me.id}` || path.startsWith(`/staff/${me.id}/`));
    if (!canAccessPath(path, me.roles || []) && !ownProfile) {
      router.replace("/");
    }
  }, [me, path, router]);

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
    const named = [me?.cityName, me?.branchName].filter(Boolean).join(" · ");
    if (named) return named;
    const city = cities.find((c) => c.id === cityId);
    const branch = (city?.branches || cities.flatMap((c) => c.branches || [])).find((b) => b.id === branchId);
    if (branch) return `${city?.name || me?.cityName || ""} · ${branch.name}`.trim();
    if (city) return city.name;
    return "No location assigned";
  }, [cities, cityId, branchId, me]);

  useEffect(() => {
    setNavOpen(false);
  }, [path]);

  useEffect(() => {
    const active = groupedNav(me?.roles || []).find((group) =>
      group.items.some(([href]) => path === href || (href !== "/" && path.startsWith(href)))
    );
    if (!active?.key) return;
    setCollapsed((prev) => (prev[active.key] ? { ...prev, [active.key]: false } : prev));
  }, [path, me]);

  function applyScope(nextCity, nextBranch) {
    setCityId(nextCity);
    setBranchId(nextBranch);
    setOpsScope(nextCity, nextBranch);
  }

  const pageTitle =
    NAV.find(([href]) => href !== "/" && path.startsWith(href))?.[1] ||
    (path === "/" ? "Dashboard" : "Admin");
  const roleNames = roles.filter((r) => r !== "CUSTOMER").map(roleLabel).join(" · ");
  const navGroups = groupedNav(roles);

  function toggleGroup(key) {
    if (!key) return;
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function linkActive(href) {
    return path === href || (href !== "/" && path.startsWith(href));
  }

  if (path === "/login" || path === "/500" || path === "/404" || path === "/_error") {
    return children;
  }

  return (
    <div className={`shell${navOpen ? " is-nav-open" : ""}`}>
      <header className="topbar">
        <button
          type="button"
          className="menu-btn"
          aria-label="Open menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          Menu
        </button>
        <strong>{pageTitle}</strong>
        <span className="muted topbar-email">{me?.email || ""}</span>
      </header>
      <button
        type="button"
        className="aside-backdrop"
        aria-label="Close menu"
        onClick={() => setNavOpen(false)}
      />
      <aside>
        <div className="aside-brand">
          <h1>Dream-Drive</h1>
          <button type="button" className="ghost menu-close" onClick={() => setNavOpen(false)}>
            Close
          </button>
        </div>
        <p className="muted">{me?.email || "Operations"}</p>
        {roleNames ? <p className="aside-role">{roleNames}</p> : null}
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
          {navGroups.map((group) => {
            const current = group.items.some(([href]) => linkActive(href));
            const open = !group.key || !collapsed[group.key] || current;
            return (
              <div
                key={group.key || "home"}
                className={`nav-group${open ? " is-open" : ""}${current ? " is-active" : ""}`}
              >
                {group.label ? (
                  <button
                    type="button"
                    className={`nav-cat${current ? " is-active" : ""}`}
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={open}
                    aria-current={current ? "true" : undefined}
                  >
                    {group.label}
                  </button>
                ) : null}
                {open
                  ? group.items.map(([href, label]) => (
                      <Link key={href} href={href} className={linkActive(href) ? "active" : ""}>
                        {label}
                      </Link>
                    ))
                  : null}
              </div>
            );
          })}
        </nav>
        <div className="aside-actions">
          {me?.id ? (
            <Link
              href={`/staff/${me.id}`}
              className={`ghost aside-foot${path === `/staff/${me.id}` ? " active" : ""}`}
            >
              My profile
            </Link>
          ) : null}
          <button
            className="ghost aside-foot"
            onClick={() => {
              localStorage.removeItem("dd_token");
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main key={`${cityId}-${branchId}`}>{children}</main>
    </div>
  );
}
