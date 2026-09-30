"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>404 – Page not found</h2>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link href="/">Go to Dashboard</Link>
    </div>
  );
}
