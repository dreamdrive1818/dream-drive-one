"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "../lib/api";
import { useEffect } from "react";

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
  ["/reports", "Reports"],
];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (path !== "/login" && !getToken()) router.replace("/login");
  }, [path, router]);

  if (path === "/login") return children;

  return (
    <div className="shell">
      <aside>
        <h1>Dream-Drive</h1>
        <p className="muted">Operations</p>
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
