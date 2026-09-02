import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudShowersHeavy,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import "./DreamCarBanner.css";

const DreamCarBanner = () => {
  const navigate = useNavigate();

  return (
    <section className="dream-banner">
      <div className="dream-banner-shell">
        <div className="dream-banner-glow" aria-hidden="true" />
        <div className="dream-banner-dots" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <div className="banner-content">
          <span className="dream-banner-badge">
            <FontAwesomeIcon icon={faCloudShowersHeavy} aria-hidden="true" />
            Monsoon Sale
          </span>
          <h2>
            Monsoon Sale is On —
            <span>Reserve your dream car before offers end</span>
          </h2>
          <p>
            Rain or shine deals on self-drive cars across Ranchi. Limited-time
            rates — book while they last.
          </p>
          <button
            type="button"
            className="banner-btn"
            onClick={() => navigate("/fleet")}
          >
            Grab Monsoon Deal
            <span className="banner-btn-arrow" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </button>
        </div>

        <div className="banner-image" aria-hidden="true">
          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png"
            alt=""
          />
        </div>
      </div>
    </section>
  );
};

export default DreamCarBanner;
