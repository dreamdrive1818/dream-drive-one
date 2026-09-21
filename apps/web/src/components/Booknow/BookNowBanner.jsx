import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faPlay,
  faCarSide,
  faShieldHalved,
  faLocationDot,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import "./BookNowBanner.css";
import { useLocalContext } from "../../context/LocalContext";

const FEATURES = [
  {
    icon: faCarSide,
    title: "Wide range",
    text: "Hatchback to Luxury",
  },
  {
    icon: faShieldHalved,
    title: "Transparent",
    text: "No hidden charges",
  },
  {
    icon: faLocationDot,
    title: "Easy pickup",
    text: "Multiple locations",
  },
  {
    icon: faStar,
    title: "4.8/5",
    text: "Customer rating",
  },
];

const BookNowBanner = () => {
  const { handleNavigation } = useLocalContext();
  const navigate = useNavigate();

  return (
    <section className="book-banner" aria-label="Book a car">
      <div className="book-banner-bg" aria-hidden="true" />
      <div className="book-banner-shade" aria-hidden="true" />

      <div className="book-banner-frame">
        <div className="book-banner-main">
          <div className="book-banner-copy">
            <p className="book-banner-kicker">
              Ready when you are
              <span className="book-banner-kicker-line" aria-hidden="true" />
            </p>

            <h2 className="book-banner-title">
              Start your <span>journey</span> today.
            </h2>

            <p className="book-banner-lead">
              Self-drive cars in Ranchi — transparent rates, quick pickup, zero
              fuss.
            </p>

            <div className="book-banner-actions">
              <button
                type="button"
                className="book-banner-cta"
                onClick={handleNavigation}
              >
                Book now
                <FontAwesomeIcon icon={faArrowRight} />
              </button>

              <button
                type="button"
                className="book-banner-secondary"
                onClick={() => navigate("/howitworks")}
              >
                <span className="book-banner-play" aria-hidden="true">
                  <FontAwesomeIcon icon={faPlay} />
                </span>
                <span className="book-banner-secondary-copy">
                  <strong>Watch video</strong>
                  <em>See how it works</em>
                </span>
              </button>
            </div>
          </div>

          <p className="book-banner-script" aria-hidden="true">
            Drive Your Way
          </p>
        </div>

        <div className="book-banner-featurebar">
          <ul className="book-banner-features">
            {FEATURES.map((item) => (
              <li key={item.title} className="book-banner-feature">
                <span className="book-banner-feature-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="book-banner-trust"
            onClick={handleNavigation}
          >
            <span className="book-banner-avatars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="book-banner-trust-copy">
              <strong>10K+</strong>
              <em>Happy Customers</em>
            </span>
            <span className="book-banner-trust-arrow" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default BookNowBanner;
