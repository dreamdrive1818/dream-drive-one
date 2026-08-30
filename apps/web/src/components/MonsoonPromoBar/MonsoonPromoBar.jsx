import React from "react";
import { useNavigate } from "react-router-dom";

const MonsoonPromoBar = () => {
  const navigate = useNavigate();

  return (
    <div className="monsoon-promo-bar" role="region" aria-label="Monsoon sale">
      <span className="monsoon-promo-bar__tag">Monsoon Sale</span>
      <span>Self-drive deals live now — rain or shine, save on selected cars.</span>
      <button
        type="button"
        className="monsoon-promo-bar__cta"
        onClick={() => navigate("/cars")}
      >
        Grab Offers
      </button>
    </div>
  );
};

export default MonsoonPromoBar;
