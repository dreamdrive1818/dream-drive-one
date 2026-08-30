"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Page() {
  const [rev, setRev] = useState(null);
  const [gst, setGst] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/v1/admin/reports/revenue").then(setRev).catch((e) => setError(e.message));
    api("/v1/admin/reports/gst").then(setGst).catch(() => {});
  }, []);
  return (
    <div>
      <h2>Reports</h2>
      {error && <p className="err">{error}</p>}
      <div className="grid">
        <div className="card">
          <h3>Revenue</h3>
          <strong>₹{((rev?.totalPaise ?? 0) / 100).toLocaleString("en-IN")}</strong>
        </div>
        <div className="card">
          <h3>GST</h3>
          <strong>₹{((gst?.totalGstPaise ?? 0) / 100).toLocaleString("en-IN")}</strong>
        </div>
      </div>
    </div>
  );
}
