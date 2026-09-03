"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken } from "../lib/api";
import { useEffect, useState } from "react";

const LINKS = [
  ["/", "Dashboard"],
  ["/bookings", "Bookings"],
  ["/cars", "Cars"],
  ["/vehicles", "Vehicles"],
  ["/drivers", "Drivers"],
  ["/kyc", "KYC"],
  ["/customers", "Customers"],
  ["/payments", "Payments"],
  ["/partners", "Partners"],
  ["/leads", "Leads"],
  ["/offers", "Offers"],
  ["/cms", "CMS"],
  ["/banners", "Banners"],
  ["/blogs", "Blogs"],
  ["/media", "Media"],
  ["/reports", "Reports"],
  ["/audit", "Audit"],
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

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);

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
      })
      .catch(() => {
        localStorage.removeItem("dd_token");
        router.replace("/login");
      });
  }, [path, router]);

  if (path === "/login") return children;

  return (
    <div className="shell">
      <aside>
        <h1>Dream-Drive</h1>
        <p className="muted">{me?.email || "Operations"}</p>
        <nav>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "active" : ""}>
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
      <main>{children}</main>
    </div>
  );
}
