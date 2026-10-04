import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faArrowRight,
  faTag,
  faCloudShowersHeavy,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import "./SaleModal.css";

const SESSION_KEY = "dreamdrive_sale_modal_dismissed";
const MOBILE_QUERY = "(max-width: 768px)";
const DESKTOP_DELAY_MS = 900;
const MOBILE_DELAY_MS = 30000;
const PLACEHOLDER_IMAGE = /placehold\.co|placeholder\.com|dummyimage\.com/i;

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
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const timer = setTimeout(() => {
      if (window.matchMedia(MOBILE_QUERY).matches && window.location.pathname.startsWith("/account")) return;
      setOpen(true);
    }, mobile ? MOBILE_DELAY_MS : DESKTOP_DELAY_MS);
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
  const customImage =
    promoBanner.imageUrl && !PLACEHOLDER_IMAGE.test(promoBanner.imageUrl);

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

        <div
          className={`sale-modal__media${customImage ? "" : " sale-modal__media--offer"}`}
          aria-hidden="true"
        >
          {customImage ? (
            <img src={promoBanner.imageUrl} alt="" />
          ) : (
            <>
              <img src="/sale-offer-scene.jpg" alt="" width="1248" height="644" />
              <div className="sale-modal__offer">
                <span className="sale-modal__offer-tag">
                  <FontAwesomeIcon icon={faTag} />
                  Limited-time offer
                </span>
                <p className="sale-modal__offer-title">
                  Monsoon
                  <span>Deals</span>
                </p>
                <span className="sale-modal__offer-drops">
                  <FontAwesomeIcon icon={faCloudShowersHeavy} />
                  Rain or shine
                </span>
              </div>
            </>
          )}
        </div>

        <div className="sale-modal__body">
          {customImage ? <p className="sale-modal__eyebrow">Limited-time offer</p> : null}
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
