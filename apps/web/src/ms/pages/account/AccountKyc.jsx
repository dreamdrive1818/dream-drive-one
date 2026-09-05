"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { formatDay, prettyStatus, statusTone } from "./format";

const KINDS = [
  { kind: "DL", label: "Driving licence", accept: ".pdf,.jpg,.jpeg,.png,.webp", required: true },
  { kind: "AADHAAR", label: "Aadhaar", accept: ".pdf,.jpg,.jpeg,.png,.webp", required: true },
  { kind: "PAN", label: "PAN", accept: ".pdf,.jpg,.jpeg,.png,.webp", required: false },
  { kind: "SELFIE", label: "Selfie with ID", accept: ".jpg,.jpeg,.png,.webp", required: true },
  { kind: "ADDRESS", label: "Address proof", accept: ".pdf,.jpg,.jpeg,.png,.webp", required: false },
];

export default function AccountKyc() {
  const { user, refresh } = useAuth();
  const [payload, setPayload] = useState({ cases: [], reusable: false, kycValidUntil: null, kycStatus: "NOT_STARTED" });
  const [files, setFiles] = useState({});
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [dlExpiresOn, setDlExpiresOn] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cases = payload.cases || [];
  const latest = cases[0];
  const needs = useMemo(() => {
    const docs = latest?.documents || [];
    return docs.filter((d) => d.status === "NEEDS_REUPLOAD").map((d) => d.kind);
  }, [latest]);

  function load() {
    api("/v1/me/documents")
      .then((data) => {
        const list = Array.isArray(data.kyc) ? data.kyc : data.kyc?.cases || data.cases || [];
        setPayload({
          cases: list,
          reusable: Boolean(data.reusable),
          kycValidUntil: data.kycValidUntil,
          kycStatus: data.kycStatus || user?.kycStatus,
        });
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function uploadOne(kind, file) {
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    return api("/v1/kyc/uploads", { method: "POST", body });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const documents = [];
      for (const item of KINDS) {
        const file = files[item.kind];
        if (!file) continue;
        const uploaded = await uploadOne(item.kind, file);
        documents.push({
          kind: uploaded.kind || item.kind,
          url: uploaded.url,
          publicId: uploaded.publicId,
          mimeType: uploaded.mimeType || file.type,
          bytes: uploaded.bytes || file.size,
        });
      }
      if (needs.length && needs.some((kind) => !documents.find((d) => d.kind === kind))) {
        throw new Error(`Please re-upload: ${needs.join(", ")}`);
      }
      const result = await api("/v1/kyc/submit", {
        method: "POST",
        body: {
          documents,
          aadhaarNumber: aadhaarNumber.replace(/\s+/g, "") || undefined,
          panNumber: panNumber.trim() || undefined,
          dlExpiresOn: dlExpiresOn || undefined,
        },
      });
      setMessage(
        result.status === "APPROVED"
          ? "Approved KYC reused for this booking. You can sign the agreement next."
          : "KYC submitted. Our team will review it."
      );
      setFiles({});
      setAadhaarNumber("");
      setPanNumber("");
      await refresh();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const locked = payload.reusable && !needs.length && latest?.status === "APPROVED";
  const rejected = latest?.status === "REJECTED";

  return (
    <>
      <h1>KYC</h1>
      <p className="account-lead">
        Current status:{" "}
        <span className={`account-pill ${statusTone(payload.kycStatus || user?.kycStatus)}`}>
          {prettyStatus(payload.kycStatus || user?.kycStatus)}
        </span>
        {payload.kycValidUntil && (
          <> · valid until {formatDay(payload.kycValidUntil)}</>
        )}
      </p>
      {error && <p className="account-msg err">{error}</p>}
      {message && <p className="account-msg ok">{message}</p>}
      {rejected && latest?.notes && (
        <p className="account-msg err">Rejected: {latest.notes}. Re-upload the requested documents.</p>
      )}
      {needs.length > 0 && (
        <p className="account-msg err">Re-upload required: {needs.join(", ")}</p>
      )}

      {locked ? (
        <div className="account-card" style={{ marginBottom: 16 }}>
          <h2>Approved</h2>
          <p className="account-hint">
            This KYC can be reused for 12 months unless a document expires. Self-drive bookings skip a new upload
            when the driving licence still covers drop-off.
          </p>
          {latest?.aadhaarLast4 && <p>Aadhaar ending {latest.aadhaarLast4}</p>}
          {latest?.panLast4 && <p>PAN ending {latest.panLast4}</p>}
          {latest?.dlExpiresOn && <p>DL expires {formatDay(latest.dlExpiresOn)}</p>}
          <p className="account-hint">Need to replace a file? Contact support to reset KYC.</p>
        </div>
      ) : (
        <div className="account-card" style={{ marginBottom: 16 }}>
          <h2>{rejected ? "Re-submit documents" : "Submit documents"}</h2>
          <p className="account-hint">
            PDF, JPG, PNG or WebP · max 8 MB. Self-drive needs driving licence, Aadhaar (or address proof), and a selfie.
            Aadhaar and PAN numbers are hashed; we only keep the last 4 digits.
          </p>
          <form onSubmit={submit}>
            <div className="kyc-grid">
              {KINDS.map((item) => {
                const must = needs.includes(item.kind) || (item.required && !needs.length);
                const current = (latest?.documents || []).find((d) => d.kind === item.kind);
                return (
                  <label key={item.kind} className={`kyc-drop ${needs.includes(item.kind) ? "needs" : ""}`}>
                    <strong>
                      {item.label}
                      {must ? " *" : ""}
                    </strong>
                    <input
                      type="file"
                      accept={item.accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setFiles((prev) => ({ ...prev, [item.kind]: file || undefined }));
                      }}
                    />
                    <span>
                      {files[item.kind]?.name ||
                        (current ? `${prettyStatus(current.status)} on file` : "Choose file")}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="account-field">
              <label htmlFor="aadhaar">Aadhaar number</label>
              <input
                id="aadhaar"
                inputMode="numeric"
                autoComplete="off"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
                placeholder={latest?.aadhaarLast4 ? `Saved ending ${latest.aadhaarLast4}` : "12 digits"}
              />
            </div>
            <div className="account-field">
              <label htmlFor="pan">PAN</label>
              <input
                id="pan"
                autoComplete="off"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder={latest?.panLast4 ? `Saved ending ${latest.panLast4}` : "ABCDE1234F"}
              />
            </div>
            <div className="account-field">
              <label htmlFor="dlExpiry">Driving licence expiry</label>
              <input
                id="dlExpiry"
                type="date"
                value={dlExpiresOn}
                onChange={(e) => setDlExpiresOn(e.target.value)}
                required={!latest?.dlExpiresOn}
              />
            </div>
            <button className="account-btn" type="submit" disabled={busy}>
              {busy ? "Uploading…" : "Submit for review"}
            </button>
          </form>
        </div>
      )}

      <div className="account-card">
        <h2>History</h2>
        {cases.length === 0 && <p className="account-empty">No KYC cases yet.</p>}
        <div className="account-list">
          {cases.map((c) => (
            <div key={c.id} className="account-item" style={{ gridTemplateColumns: "1fr auto" }}>
              <div>
                <h3>{prettyStatus(c.status)}</h3>
                <p>
                  {c.booking?.publicId ? `Booking ${c.booking.publicId}` : "Account KYC"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </p>
                <p>
                  {(c.documents || []).map((d) => d.kind).join(" · ") || "No files"}
                  {c.dlExpiresOn ? ` · DL ${formatDay(c.dlExpiresOn)}` : ""}
                </p>
              </div>
              <span className={`account-pill ${statusTone(c.status)}`}>{prettyStatus(c.status)}</span>
            </div>
          ))}
        </div>
        <p className="account-hint" style={{ marginTop: 12 }}>
          After approval, open the booking to sign the agreement.{" "}
          <Link to="/account/bookings">My bookings</Link>
        </p>
      </div>
    </>
  );
}
