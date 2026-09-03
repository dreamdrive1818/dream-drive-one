import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLocalContext } from "../../context/LocalContext";
import "./SaleModal.css";

const SESSION_KEY = "dreamdrive_sale_modal_dismissed";

const SaleModal = () => {
  const [open, setOpen] = useState(false);
  const { promoBanner } = useLocalContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.includes("admin");

  useEffect(() => {
    if (isAdmin || !promoBanner) return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [isAdmin, promoBanner]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  };

  const handleCta = () => {
    dismiss();
    const link = promoBanner?.link || "/fleet";
    if (/^https?:/i.test(link)) window.location.href = link;
    else navigate(link);
  };

  if (isAdmin || !open || !promoBanner) return null;

  return (
    <div className="sale-modal-overlay" onClick={dismiss} role="presentation">
      <div
        className="sale-modal sale-modal--monsoon"
        role="dialog"
        aria-modal="true"
        aria-label={promoBanner.title || "Offer"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sale-modal__glow" aria-hidden="true" />
        <button type="button" className="sale-modal__close" onClick={dismiss} aria-label="Close offer">
          ✕
        </button>
        <div className="sale-modal__badge">{promoBanner.title}</div>
        <p className="sale-modal__eyebrow">Dream Drive</p>
        <h2 className="sale-modal__title">{promoBanner.title}</h2>
        <p className="sale-modal__lead">{promoBanner.body}</p>
        {promoBanner.imageUrl ? (
          <img src={promoBanner.imageUrl} alt="" style={{ width: "100%", borderRadius: 12, margin: "12px 0" }} />
        ) : null}
        <div className="sale-modal__actions">
          <button type="button" className="sale-modal__cta" onClick={handleCta}>
            {promoBanner.ctaText || "View offers"}
          </button>
          <button type="button" className="sale-modal__later" onClick={dismiss}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleModal;
