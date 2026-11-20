"use client";

import React, { useEffect, useRef } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import { useLocalContext } from "../../../context/LocalContext";
import { AccountSkeleton } from "../../../components/Skeleton/Skeleton";
import "./Account.css";

const LINKS = [
  ["", "Overview", IconGrid],
  ["bookings", "Bookings", IconCalendar],
  ["kyc", "KYC", IconId],
  ["agreements", "Agreements", IconFile],
  ["invoices", "Invoices", IconReceipt],
  ["wallet", "Wallet", IconWallet],
  ["tickets", "Support", IconLife],
];

const TITLES = {
  "": "Overview",
  bookings: "Bookings",
  kyc: "KYC",
  agreements: "Agreements",
  invoices: "Invoices",
  wallet: "Wallet",
  tickets: "Support",
};

function sectionTitle(pathname) {
  const key = pathname.replace(/^\/account\/?/, "").split("/").filter(Boolean)[0] || "";
  return TITLES[key] || "Account";
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return String(parts[0] || "DD").slice(0, 2).toUpperCase();
}

export default function AccountLayout() {
  const { user, ready, logout } = useAuth();
  const { webinfo } = useLocalContext();
  const location = useLocation();
  const navRef = useRef(null);
  const title = sectionTitle(location.pathname);
  const name = user?.fullName || "Your account";

  useEffect(() => {
    const root = navRef.current;
    if (!root) return undefined;
    const frame = requestAnimationFrame(() => {
      const active = root.querySelector("a.is-active");
      active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, ready]);

  useEffect(() => {
    document.body.classList.add("account-shell");
    return () => document.body.classList.remove("account-shell");
  }, []);

  if (!ready) {
    return <AccountSkeleton />;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${next}`} replace />;
  }

  return (
    <div className="dash-shell">
      <aside className="dash-side">
        <div className="dash-side-head">
          <Link to="/" className="dash-brand" aria-label="Dream Drive home">
            <img src={webinfo?.logo} alt="Dream Drive" />
          </Link>
          <button type="button" className="dash-signout dash-signout--mobile" onClick={logout}>
            Sign out
          </button>
        </div>
        <nav className="dash-nav" aria-label="Account" ref={navRef}>
          {LINKS.map(([to, label, Icon]) => (
            <NavLink
              key={to || "home"}
              to={to ? `/account/${to}` : "/account"}
              end={to === ""}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/subscriptions" className={({ isActive }) => (isActive ? "is-active" : undefined)}>
            <IconRepeat />
            <span>Subscriptions</span>
          </NavLink>
        </nav>
        <div className="dash-user">
          <span className="dash-avatar" aria-hidden="true">{initials(name)}</span>
          <div className="dash-user-copy">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" className="dash-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="dash-body">
        <header className="dash-top">
          <div>
            <p className="dash-kicker">Dashboard</p>
            <p key={title} className="dash-title account-section-enter">
              {title}
            </p>
          </div>
          <Link to="/fleet" className="dash-browse">Browse cars</Link>
        </header>
        <div className="account-main">
          <div key={location.pathname} className="account-section-enter">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconId() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 10.5h5M13.5 13.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 3.8V9h5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15l-2.2-1.4L14 20.5l-2.3-1.4L9.4 20.5 7.2 19.1 5 20.5V5A1.5 1.5 0 0 1 6.5 3.5H7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6.5" width="18" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.2" r="1" fill="currentColor" />
    </svg>
  );
}

function IconLife() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.8v5.6M12 14.6v5.6M3.8 12h5.6M14.6 12h5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h9.5a3.5 3.5 0 0 1 3.5 3.5V13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 17H7.5A3.5 3.5 0 0 1 4 13.5V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 4.5 17.5 7 14.5 9.5M9.5 14.5 6.5 17 9.5 19.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
