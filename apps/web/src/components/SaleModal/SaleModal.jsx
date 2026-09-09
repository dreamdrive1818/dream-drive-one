import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import "./SaleModal.css";

const SESSION_KEY = "dreamdrive_sale_modal_dismissed";

const SaleModal = () => {
  const [open, setOpen] = useState(false);
  const { promoBanner } = useLocalContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.includes("admin");

  const dismiss = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (isAdmin || !promoBanner) return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [isAdmin, promoBanner]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  const handleCta = () => {
    dismiss();
    const link = promoBanner?.link || "/fleet";
    if (/^https?:/i.test(link)) window.location.href = link;
    else navigate(link);
  };

  if (isAdmin || !open || !promoBanner) return null;

  const title = promoBanner.title || "Seasonal deals";
  const body =
    promoBanner.body || "Save on selected self-drive cars this season.";
  const cta = promoBanner.ctaText || "See deals";

  return (
    <div className="sale-modal-overlay" onClick={dismiss} role="presentation">
      <div
        className="sale-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="sale-modal__close"
          onClick={dismiss}
          aria-label="Close offer"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className="sale-modal__media" aria-hidden="true">
          {promoBanner.imageUrl ? (
            <img src={promoBanner.imageUrl} alt="" />
          ) : (
            <div className="sale-modal__media-fallback">
              <span>Dream Drive</span>
            </div>
          )}
        </div>

        <div className="sale-modal__body">
          <p className="sale-modal__eyebrow">Limited-time offer</p>
          <h2 id="sale-modal-title" className="sale-modal__title">
            {title}
          </h2>
          <p className="sale-modal__lead">{body}</p>

          <div className="sale-modal__actions">
            <button type="button" className="sale-modal__cta" onClick={handleCta}>
              {cta}
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button type="button" className="sale-modal__later" onClick={dismiss}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleModal;
