"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileContract,
  faPenToSquare,
  faDownload,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import { api, getToken } from "../../api";
import { prettyStatus, statusTone } from "./format";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function downloadAgreement(id, signed) {
  const res = await fetch(
    `${API}/v1/me/agreements/${id}/${signed ? "signed-pdf" : "pdf"}`,
    {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }
  );
  if (!res.ok) throw new Error("Could not download PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = signed ? "rental-agreement-signed.pdf" : "rental-agreement.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountAgreements() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api("/v1/me/documents")
      .then((data) => setRows(data.agreements || []))
      .catch((e) => setError(e.message));
  }, []);

  async function onDownload(id, signed) {
    setBusy(id + (signed ? "-s" : ""));
    setError("");
    try {
      await downloadAgreement(id, signed);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <header className="account-header">
        <p className="account-eyebrow">Documents</p>
        <h1>Agreements</h1>
        <p className="account-lead">
          Rental agreements and e-sign status for your trips.
        </p>
      </header>

      {error && <p className="account-msg err">{error}</p>}

      <div className="account-card">
        {rows.length === 0 ? (
          <div className="agreements-empty">
            <span className="agreements-empty-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faFileContract} />
            </span>
            <p className="account-empty">
              No agreements yet. They appear after payment and KYC.
            </p>
            <Link className="account-btn" to="/account/bookings">
              View bookings
            </Link>
          </div>
        ) : (
          <div className="account-list">
            {rows.map((a) => {
              const bookingId = a.booking?.publicId || a.bookingId;
              const canSign =
                a.envelope?.signUrl &&
                a.status !== "SIGNED" &&
                a.status !== "WAIVED";
              const canSignedPdf =
                a.status === "SIGNED" || a.status === "WAIVED";

              return (
                <article key={a.id} className="agreements-item">
                  <span className="agreements-item-icon" aria-hidden="true">
                    <FontAwesomeIcon
                      icon={canSign ? faPenToSquare : faFileContract}
                    />
                  </span>
                  <div className="agreements-item-body">
                    <h3>{bookingId || "Agreement"}</h3>
                    <p>
                      {canSign
                        ? "Ready to sign"
                        : canSignedPdf
                          ? "Signed copy available"
                          : "Draft PDF available"}
                    </p>
                  </div>
                  <span className={`account-pill ${statusTone(a.status)}`}>
                    {prettyStatus(a.status)}
                  </span>
                  <div className="agreements-item-actions">
                    {canSign && (
                      <a
                        className="account-btn"
                        href={a.envelope.signUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Sign
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                      </a>
                    )}
                    <button
                      className="account-btn ghost"
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => onDownload(a.id, false)}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      {busy === a.id ? "Downloading…" : "PDF"}
                    </button>
                    {canSignedPdf && (
                      <button
                        className="account-btn ghost"
                        type="button"
                        disabled={busy === `${a.id}-s`}
                        onClick={() => onDownload(a.id, true)}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                        {busy === `${a.id}-s` ? "Downloading…" : "Signed PDF"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
