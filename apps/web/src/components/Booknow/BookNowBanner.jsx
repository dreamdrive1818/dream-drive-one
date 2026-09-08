import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import "./BookNowBanner.css";
import { useLocalContext } from "../../context/LocalContext";

const BookNowBanner = () => {
  const { handleNavigation } = useLocalContext();

  return (
    <section className="book-banner" aria-label="Book a car">
      <div className="book-banner-bg" aria-hidden="true" />
      <div className="book-banner-inner">
        <p className="book-banner-kicker">Ready when you are</p>
        <h2 className="book-banner-title">Start your journey today.</h2>
        <p className="book-banner-lead">
          Self-drive cars in Ranchi — transparent rates, quick pickup, zero fuss.
        </p>
        <button
          type="button"
          className="book-banner-cta"
          onClick={handleNavigation}
        >
          Book now
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </section>
  );
};

export default BookNowBanner;
