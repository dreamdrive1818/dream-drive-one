import React from "react";
import { useNavigate } from "react-router-dom";
import { useLocalContext } from "../../context/LocalContext";

const WinterPromoBar = () => {
  const navigate = useNavigate();
  const { stripBanner } = useLocalContext();

  if (!stripBanner) return null;

  const go = () => {
    const link = stripBanner.link || "/fleet";
    if (/^https?:/i.test(link)) window.location.href = link;
    else navigate(link);
  };

  return (
    <div className="winter-promo-bar" role="region" aria-label={stripBanner.title || "Offer"}>
      <span className="winter-promo-bar__tag">{stripBanner.title}</span>
      <span className="winter-promo-bar__copy">{stripBanner.body || stripBanner.title}</span>
      <button type="button" className="winter-promo-bar__cta" onClick={go}>
        {stripBanner.ctaText || "View offers"}
      </button>
    </div>
  );
};

export default WinterPromoBar;
