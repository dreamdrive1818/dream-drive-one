import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCalendarCheck,
  faCloudShowersHeavy,
  faShieldHalved,
  faUmbrella,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import "./DreamCarBanner.css";

const DEFAULT_BADGE = "Monsoon deals are live";
const DEFAULT_HEADING = "Save on selected self-drive cars this season.";
const HIGHLIGHT = /self-drive cars?/i;

const FEATURES = [
  { icon: faUmbrella, tone: "teal", label: ["Special", "Monsoon Rates"] },
  { icon: faCalendarCheck, tone: "amber", label: ["Limited", "Time Offers"] },
  { icon: faShieldHalved, tone: "blue", label: ["Well-Maintained", "& Road Ready"] },
];

const EASE = [0.22, 1, 0.36, 1];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const sceneIn = {
  hidden: { opacity: 0, scale: 1.04 },
  show: { opacity: 1, scale: 1, transition: { duration: 1, ease: EASE } },
};

function Heading({ text }) {
  const match = text.match(HIGHLIGHT);
  if (!match) return text;
  const start = match.index;
  const end = start + match[0].length;
  const before = text.slice(0, start).trim();
  return (
    <>
      {before}
      {before ? <br className="dcb-title-break" /> : null}
      {before ? " " : null}
      <span>{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}

const DreamCarBanner = () => {
  const navigate = useNavigate();
  const { promoBanner } = useLocalContext();
  const reduceMotion = useReducedMotion();

  const badge = promoBanner?.title || DEFAULT_BADGE;
  const heading = promoBanner?.body || DEFAULT_HEADING;
  const cta = promoBanner?.ctaText || "See deals";

  const go = () => {
    const link = promoBanner?.link || "/fleet";
    if (/^https?:/i.test(link)) window.location.href = link;
    else navigate(link);
  };

  const motionProps = reduceMotion
    ? { initial: "show", animate: "show" }
    : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.3 } };

  return (
    <section className="dcb" aria-labelledby="dcb-title">
      <motion.div className="dcb-card" {...motionProps}>
        <motion.div className="dcb-scene" aria-hidden="true" variants={sceneIn}>
          <img
            src="/monsoon-banner-scene.jpg"
            alt=""
            width="1904"
            height="644"
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        <motion.div className="dcb-content" variants={stagger}>
          <motion.span className="dcb-badge" variants={rise}>
            <FontAwesomeIcon icon={faCloudShowersHeavy} aria-hidden="true" />
            {badge}
          </motion.span>

          <motion.h2 id="dcb-title" className="dcb-title" variants={rise}>
            <svg className="dcb-spark" viewBox="0 0 24 28" aria-hidden="true">
              <path d="M13 2.5 16.5 10" />
              <path d="M3 9.5 11 13" />
              <path d="M4 22 11.5 18.5" />
            </svg>
            <Heading text={heading} />
          </motion.h2>

          <motion.p className="dcb-lead" variants={rise}>
            Rain or shine deals on self-drive cars across Ranchi.{" "}
            <br className="dcb-lead-break" />
            Limited-time rates — book while they last.
          </motion.p>

          <motion.div variants={rise}>
            <button type="button" className="dcb-btn" onClick={go}>
              {cta}
              <span className="dcb-btn-arrow" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
              </span>
            </button>
          </motion.div>

          <motion.ul className="dcb-features" variants={rise}>
            {FEATURES.map((item) => (
              <li key={item.label.join(" ")} className="dcb-feature">
                <span className={`dcb-feature-icon dcb-feature-icon--${item.tone}`}>
                  <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
                </span>
                <span className="dcb-feature-text">
                  {item.label[0]}
                  <br />
                  {item.label[1]}
                </span>
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default DreamCarBanner;
