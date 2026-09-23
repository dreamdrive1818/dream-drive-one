"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AuthForm from "./AuthForm";
import "./pages/Login.css";

/**
 * Overlay sign-in / register modal for in-flow booking.
 * Portaled to document.body so it stays viewport-fixed even when
 * ancestors use transform (e.g. page fade animations).
 */
export default function AuthModal({
  open,
  onClose,
  onSuccess,
  initialMode = "password",
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;

    const onWheel = (e) => {
      if (e.target.closest(".customer-auth-modal-panel")) return;
      e.preventDefault();
      window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: "auto" });
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      className="customer-auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-auth-modal-title"
    >
      <button
        type="button"
        className="customer-auth-modal-backdrop"
        aria-label="Close sign in"
        onClick={onClose}
      />
      <div className="customer-auth-modal-panel">
        <button
          type="button"
          className="customer-auth-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <span id="customer-auth-modal-title" className="customer-login-sr-only">
          Sign in or create account
        </span>
        <AuthForm
          compact
          idPrefix="modal-auth"
          initialMode={initialMode}
          onSuccess={() => {
            onSuccess?.();
          }}
        />
      </div>
    </div>,
    document.body
  );
}
