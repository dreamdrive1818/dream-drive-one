import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import "./BookNowBanner.css";
import { useLocalContext } from "../../context/LocalContext";

const BANNER_ASSET = "/book-banner-night.jpg";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (y, delay) => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
});

const eyebrowIn = fadeUp(8, 0.1);
const titleIn = fadeUp(18, 0.18);
const bodyIn = fadeUp(12, 0.26);

const mediaIn = {
  hidden: { opacity: 0, scale: 1.03 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.9, ease: EASE },
  },
};

const BookNowBanner = () => {
  const { handleNavigation } = useLocalContext();
  const reduceMotion = useReducedMotion();

  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.35 },
      };

  return (
    <motion.section
      className="book-banner"
      aria-labelledby="book-banner-title"
      {...reveal}
    >
      <motion.div className="book-banner-media" aria-hidden="true" variants={mediaIn}>
        <img src={BANNER_ASSET} alt="" loading="lazy" />
      </motion.div>
      <div className="book-banner-shade" aria-hidden="true" />

      <div className="book-banner-inner">
        <div className="book-banner-copy">
          <motion.p className="book-banner-eyebrow" variants={eyebrowIn}>
            Ready when you are
            <span className="book-banner-eyebrow-rule" aria-hidden="true" />
          </motion.p>

          <motion.h2
            id="book-banner-title"
            className="book-banner-title"
            variants={titleIn}
          >
            Ready for your <span>next drive?</span>
          </motion.h2>

          <motion.div variants={bodyIn}>
            <p className="book-banner-lead">
              Choose your car, select your dates, and get on the road.
            </p>

            <button
              type="button"
              className="book-banner-cta"
              onClick={handleNavigation}
            >
              Explore cars
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default BookNowBanner;
