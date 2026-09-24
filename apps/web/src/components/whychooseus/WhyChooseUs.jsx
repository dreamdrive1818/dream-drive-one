import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChair,
  faStopwatch,
  faShieldHalved,
  faHeadset,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import "./WhyChooseUs.css";

const EASE = [0.22, 1, 0.36, 1];

/**
 * Verified benefit copy from existing WhyChooseUs + LocalContext/About.
 * `link` is the connector from the callout toward the car, in stage units
 * (1240 × 560); it starts beside the copy and ends just outside the car.
 */
const FEATURES = [
  {
    id: "clean",
    side: "left",
    icon: faChair,
    tone: "mint",
    title: "Clean & Comfortable",
    text: "Choose from well-maintained cars that suit your style and needs.",
    link: { d: "M262 118 C 330 116 380 132 446 182", start: [262, 118], end: [446, 182] },
  },
  {
    id: "honest",
    side: "left",
    icon: faShieldHalved,
    tone: "amber",
    title: "No Hidden Costs",
    text: "What you see is what you pay — simple and honest pricing.",
    link: { d: "M150 324 C 172 372 250 394 330 400", start: [150, 324], end: [330, 400] },
  },
  {
    id: "quick",
    side: "right",
    icon: faStopwatch,
    tone: "blue",
    title: "Quick & Easy",
    text: "Book your car in minutes — no hassle, no paperwork.",
    link: { d: "M924 86 C 872 88 858 140 800 160", start: [924, 86], end: [800, 160] },
  },
  {
    id: "support",
    side: "right",
    icon: faHeadset,
    tone: "lavender",
    title: "24×7 Support",
    text: "Flexible packages, doorstep delivery, and support when you need it.",
    link: { d: "M940 294 C 904 300 934 364 914 400", start: [940, 294], end: [914, 400] },
  },
];

const CAR_ASSET =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png";

const SCENIC_ASSET = "/success-hero-landscape.jpg";

const fadeUp = (y, delay) => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
});

const eyebrowIn = fadeUp(8, 0);
const titleIn = fadeUp(18, 0.08);
const leadIn = fadeUp(12, 0.16);

const sceneryIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: EASE, delay: 0.12 } },
};

const carIn = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE, delay: 0.22 },
  },
};

const pointIn = {
  hidden: ({ side }) => ({ opacity: 0, x: side === "left" ? -18 : 18 }),
  show: ({ order }) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: EASE, delay: 0.36 + order * 0.07 },
  }),
};

const linkIn = {
  hidden: { pathLength: 0 },
  show: (order) => ({
    pathLength: 1,
    transition: { duration: 0.5, ease: "easeInOut", delay: 0.5 + order * 0.07 },
  }),
};

const nodeIn = {
  hidden: { opacity: 0, scale: 0.4 },
  show: (delay) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: EASE, delay },
  }),
};

const WhyChoose = () => {
  const { webinfo } = useLocalContext();
  const reduceMotion = useReducedMotion();
  const brand = webinfo?.name || "Dream Drive";

  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.25 },
      };

  return (
    <motion.section
      className="why-choose"
      aria-labelledby="why-heading"
      {...reveal}
    >
      <div className="why-choose-inner">
        <header className="why-head">
          <motion.p className="why-eyebrow" variants={eyebrowIn}>
            <span className="why-eyebrow-rule" aria-hidden="true" />
            Why Choose {brand}
            <span className="why-eyebrow-rule" aria-hidden="true" />
          </motion.p>
          <motion.h2 id="why-heading" className="why-title" variants={titleIn}>
            <span className="why-title-line">Built Around Your</span>
            <span className="why-title-line why-title-line--accent">
              Journey.
            </span>
          </motion.h2>
          <motion.p className="why-lead" variants={leadIn}>
            Simple choices. Clear pricing. A smoother way to get on the road.
          </motion.p>
        </header>

        <div className="why-stage">
          <div className="why-visual">
            <motion.div
              className="why-scenery"
              aria-hidden="true"
              variants={sceneryIn}
            >
              <span
                className="why-scenery-mirror"
                style={{ backgroundImage: `url(${SCENIC_ASSET})` }}
              />
              <span className="why-scenery-main">
                <img src={SCENIC_ASSET} alt="" loading="lazy" />
              </span>
            </motion.div>

            <motion.div className="why-car" variants={carIn}>
              <span className="why-car-shadow" aria-hidden="true" />
              <img src={CAR_ASSET} alt={`${brand} featured car`} loading="lazy" />
            </motion.div>

            <span className="why-foreground" aria-hidden="true" />
          </div>

          <svg
            className="why-links"
            viewBox="0 0 1240 560"
            aria-hidden="true"
          >
            {FEATURES.map((item, order) => (
              <g key={item.id} className={`why-link why-link--${item.id}`}>
                <motion.path
                  className="why-link-path"
                  d={item.link.d}
                  variants={linkIn}
                  custom={order}
                />
                <motion.circle
                  className="why-link-start"
                  cx={item.link.start[0]}
                  cy={item.link.start[1]}
                  r="3.2"
                  variants={nodeIn}
                  custom={0.46 + order * 0.07}
                />
                <motion.g variants={nodeIn} custom={0.92 + order * 0.07}>
                  <circle
                    className="why-link-halo"
                    cx={item.link.end[0]}
                    cy={item.link.end[1]}
                    r="9"
                  />
                  <circle
                    className="why-link-end"
                    cx={item.link.end[0]}
                    cy={item.link.end[1]}
                    r="4.6"
                  />
                </motion.g>
              </g>
            ))}
          </svg>

          <ul className="why-points">
            {FEATURES.map((item, order) => (
              <motion.li
                key={item.id}
                className={`why-point why-point--${item.id} why-point--${item.side} why-point--${item.tone}`}
                variants={pointIn}
                custom={{ side: item.side, order }}
              >
                <span className="why-point-icon" aria-hidden="true">
                  <span className="why-point-icon-core">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                </span>
                <div className="why-point-copy">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
};

export default WhyChoose;
