import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChair,
  faStopwatch,
  faShieldHalved,
  faHeadset,
  faArrowRight,
  faPlay,
  faCarSide,
  faTags,
  faTruck,
  faLocationDot,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./WhyChooseUs.css";

/** Verified benefit copy from existing WhyChooseUs + LocalContext/About. */
const FEATURES = [
  {
    id: "clean",
    icon: faChair,
    tone: "mint",
    title: "Clean & Comfortable",
    text: "Choose from well-maintained cars that suit your style and needs.",
  },
  {
    id: "quick",
    icon: faStopwatch,
    tone: "blue",
    title: "Quick & Easy",
    text: "Book your car in minutes — no hassle, no paperwork.",
  },
  {
    id: "honest",
    icon: faShieldHalved,
    tone: "amber",
    title: "No Hidden Costs",
    text: "What you see is what you pay — simple and honest pricing.",
  },
  {
    id: "support",
    icon: faHeadset,
    tone: "lavender",
    title: "24×7 Support",
    text: "Flexible packages, doorstep delivery, and support when you need it.",
  },
];

/** Non-numeric trust items — no invented counts/ratings. */
const TRUST_ITEMS = [
  {
    id: "fleet",
    icon: faCarSide,
    title: "Well-maintained cars",
    label: "Ready for the road",
  },
  {
    id: "pricing",
    icon: faTags,
    title: "Clear pricing",
    label: "No hidden costs",
  },
  {
    id: "delivery",
    icon: faTruck,
    title: "Doorstep delivery",
    label: "Available in Ranchi",
  },
  {
    id: "support",
    icon: faHeadset,
    title: "24×7 support",
    label: "Here when you need us",
  },
];

const CAR_ASSET =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png";

const SCENIC_ASSET = "/success-hero-landscape.jpg";

const WhyChoose = () => {
  const { webinfo, promoBanner } = useLocalContext();
  const navigate = useNavigate();
  const brand = webinfo?.name || "Dream Drive";

  const description =
    promoBanner?.body ||
    webinfo?.seo?.description ||
    "Book SUVs like Nexon & Compass with flexible packages, 24×7 support, and doorstep delivery in Ranchi.";

  const primaryCtaLabel = promoBanner?.ctaText || "Explore Fleet";
  const primaryCtaRoute = promoBanner?.link || "/fleet";

  return (
    <section className="why-choose" aria-label={`Why choose ${brand}`}>
      <div className="why-choose-inner">
        <div className="why-choose-main">
          <AnimateOnScroll className="why-left delay-2">
            <p className="why-eyebrow">Why Choose {brand}</p>

            <h2 className="why-title">
              <span className="why-title-line">Why Choose</span>
              <span className="why-title-line why-title-line--accent">
                {brand}
              </span>
            </h2>

            <p className="why-desc">{description}</p>

            <div className="why-actions">
              <button
                type="button"
                className="why-cta"
                onClick={() => navigate(primaryCtaRoute)}
              >
                {primaryCtaLabel}
                <FontAwesomeIcon icon={faArrowRight} />
              </button>

              <button
                type="button"
                className="why-secondary"
                onClick={() => navigate("/howitworks")}
              >
                <span className="why-play" aria-hidden="true">
                  <FontAwesomeIcon icon={faPlay} />
                </span>
                <span className="why-secondary-copy">
                  <strong>How it works</strong>
                  <em>See the process</em>
                </span>
              </button>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll className="why-visual delay-3">
            <div className="why-visual-stage">
              <div
                className="why-scenic"
                style={{ backgroundImage: `url(${SCENIC_ASSET})` }}
                aria-hidden="true"
              />
              <span className="why-scenic-arc" aria-hidden="true" />

              <img
                src={CAR_ASSET}
                alt={`${brand} featured car`}
                className="why-car-img"
              />

              <div className="why-callout">
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                <div>
                  <span>Made for</span>
                  <strong>Every Journey</strong>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll className="why-features delay-4">
            <ul className="why-feature-grid">
              {FEATURES.map((item) => (
                <li
                  key={item.id}
                  className={`why-feature-card why-feature-card--${item.tone}`}
                >
                  <span className="why-feature-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </AnimateOnScroll>
        </div>

        <AnimateOnScroll className="why-trust delay-5">
          <ul className="why-trust-list">
            {TRUST_ITEMS.map((item, index) => (
              <li key={item.id} className="why-trust-item">
                {index > 0 ? (
                  <span className="why-trust-divider" aria-hidden="true" />
                ) : null}
                <span className="why-trust-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <div className="why-trust-copy">
                  <strong>{item.title}</strong>
                  <span>{item.label}</span>
                </div>
              </li>
            ))}
          </ul>
        </AnimateOnScroll>
      </div>
    </section>
  );
};

export default WhyChoose;
