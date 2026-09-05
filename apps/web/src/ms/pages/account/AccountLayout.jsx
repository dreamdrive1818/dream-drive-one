"use client";

import React from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../AuthContext";
import "./Account.css";

const LINKS = [
  ["", "Overview"],
  ["bookings", "Bookings"],
  ["kyc", "KYC"],
  ["agreements", "Agreements"],
  ["invoices", "Invoices"],
  ["wallet", "Wallet"],
  ["tickets", "Support"],
];

export default function AccountLayout() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <section className="account-page">
        <p className="account-empty" style={{ padding: 24 }}>
          Loading your account…
        </p>
      </section>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${next}`} replace />;
  }

  return (
    <section className="account-page">
      <div className="account-inner">
        <aside className="account-nav">
          <div className="account-nav-user">
            <strong>{user.fullName || "Your account"}</strong>
            <span>{user.email}</span>
          </div>
          <div className="account-nav-links">
            {LINKS.map(([to, label]) => (
              <NavLink
                key={to || "home"}
                to={to ? `/account/${to}` : "/account"}
                end={to === ""}
                className={({ isActive }) => (isActive ? "is-active" : "")}
              >
                {label}
              </NavLink>
            ))}
          </div>
          <button type="button" className="account-nav-link account-nav-signout" onClick={logout}>
            Sign out
          </button>
        </aside>
        <div className="account-main">
          <Outlet />
        </div>
      </div>
    </section>
  );
}

