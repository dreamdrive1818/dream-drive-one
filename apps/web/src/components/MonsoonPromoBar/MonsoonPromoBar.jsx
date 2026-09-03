import React from "react";
import { useNavigate } from "react-router-dom";
import { useLocalContext } from "../../context/LocalContext";

const MonsoonPromoBar = () => {
  const navigate = useNavigate();
  const { stripBanner } = useLocalContext();

  if (!stripBanner) return null;

  const go = () => {
    const link = stripBanner.link || "/fleet";
    if (/^https?:/i.test(link)) window.location.href = link;
    else navigate(link);
  };

  return (
    <div className="monsoon-promo-bar" role="region" aria-label={stripBanner.title || "Offer"}>
      <span className="monsoon-promo-bar__tag">{stripBanner.title}</span>
      <span>{stripBanner.body || stripBanner.title}</span>
      <button type="button" className="monsoon-promo-bar__cta" onClick={go}>
        {stripBanner.ctaText || "View offers"}
      </button>
    </div>
  );
};

export default MonsoonPromoBar;
