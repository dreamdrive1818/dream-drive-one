import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudShowersHeavy,
  faArrowRight,
  faCarSide,
  faTag,
  faShieldHalved,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import "./Hero2.css";
import { useLocalContext } from "../../../context/LocalContext";

const SteeringWheelIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <path d="M12 5.2v4.2M5.4 14.2l3.6-1.4M18.6 14.2l-3.6-1.4" />
  </svg>
);

const DotGrid = ({ className }) => (
  <div className={`hero2-dots ${className}`} aria-hidden="true">
    {Array.from({ length: 30 }).map((_, i) => (
      <span key={i} />
    ))}
  </div>
);

function go(navigate, link) {
  const href = link || "/fleet";
  if (/^https?:/i.test(href)) window.location.href = href;
  else navigate(href);
}

const Hero2 = () => {
  const navigate = useNavigate();
  const { heroBanner } = useLocalContext();
  const goFleet = () => go(navigate, heroBanner?.link);

  return (
    <section className="hero-banner hero2">
      <div className="hero2-shell">
        <div className="hero2-waves" aria-hidden="true">
          <svg
            className="hero2-wave hero2-wave--back"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0,224L48,208C96,192,192,160,288,154.7C384,149,480,171,576,186.7C672,203,768,213,864,197.3C960,181,1056,139,1152,133.3C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
          <svg
            className="hero2-wave hero2-wave--mid"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0,256L60,240C120,224,240,192,360,181.3C480,171,600,181,720,192C840,203,960,213,1080,208C1200,203,1320,181,1380,170.7L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
            />
          </svg>
          <svg
            className="hero2-wave hero2-wave--front"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0,288L80,272C160,256,320,224,480,213.3C640,203,800,213,960,229.3C1120,245,1280,267,1360,277.3L1440,288L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
            />
          </svg>
        </div>

        <DotGrid className="hero2-dots--left" />
        <DotGrid className="hero2-dots--right" />

        <div className="hero-content hero2-content">
          <div className="hero2-pill">
            <FontAwesomeIcon icon={faCloudShowersHeavy} className="hero2-pill-icon" />
            <span>
              {heroBanner?.title || "Monsoon Sale • Save on self-drive now"}
            </span>
          </div>

          <h1 className="hero2-title">
            Drive Your{" "}
            <span className="hero2-title-accent">
              Freedom!
              <span className="hero2-sparks" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
          </h1>

          <p className="hero2-lead">
            Choose <span className="highlight">Rent</span> or{" "}
            <span className="highlight">Self Drive</span> – The Car is Yours
          </p>

          <div className="hero2-divider" aria-hidden="true">
            <span className="hero2-divider-line" />
            <FontAwesomeIcon icon={faCarSide} className="hero2-divider-icon" />
            <span className="hero2-divider-line" />
          </div>

          <p className="hero-subtitle hero2-subtitle">
            {heroBanner?.body || (
              <>
                Rain or shine — book discounted self-drive cars for weekends,
                business trips, and city rides across{" "}
                <span className="hero2-city">Ranchi</span>.
              </>
            )}
          </p>

          <div className="hero-buttons hero2-buttons">
            <button type="button" className="btn-rent hero2-btn-primary" onClick={goFleet}>
              {heroBanner?.ctaText || "View Monsoon Deals"}
              <span className="hero2-btn-arrow" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
              </span>
            </button>
            <button type="button" className="btn-self hero2-btn-secondary" onClick={() => navigate("/fleet")}>
              <SteeringWheelIcon className="hero2-btn-wheel" />
              Self Drive
            </button>
          </div>
        </div>

        <div className="hero2-cars" aria-hidden="true">
          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png"
            className="hero2-car hero2-car--left"
            alt=""
          />
          <img
            src={
              heroBanner?.imageUrl ||
              "https://res.cloudinary.com/df10iqj1i/image/upload/v1766399135/24df9713-f67d-4f45-9da9-7ac8d7e124e8.png"
            }
            className="hero2-car hero2-car--center"
            alt=""
          />
          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png"
            className="hero2-car hero2-car--right"
            alt=""
          />
        </div>

        <ul className="hero2-features">
          <li className="hero2-feature">
            <span className="hero2-feature-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faTag} />
            </span>
            <span className="hero2-feature-copy">
              <strong>Best Prices</strong>
              <em>Guaranteed</em>
            </span>
          </li>
          <li className="hero2-feature">
            <span className="hero2-feature-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faShieldHalved} />
            </span>
            <span className="hero2-feature-copy">
              <strong>Safe &amp;</strong>
              <em>Reliable</em>
            </span>
          </li>
          <li className="hero2-feature">
            <span className="hero2-feature-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faLocationDot} />
            </span>
            <span className="hero2-feature-copy">
              <strong>Easy Pickup</strong>
              <em>Across Ranchi</em>
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
};

export default Hero2;
