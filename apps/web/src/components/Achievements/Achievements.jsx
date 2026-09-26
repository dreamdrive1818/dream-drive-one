import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faThumbsUp,
  faLightbulb,
  faLeaf,
  faStar,
  faChartLine,
  faUsers,
  faMedal,
  faCarOn,
} from "@fortawesome/free-solid-svg-icons";
import "./Achievement.css";

const SCENE_ASSET = "/achievements-road-day.jpg";

const achievements = [
  {
    icon: faThumbsUp,
    title: "Customer Choice Award",
    tone: "teal",
    blurb: "Chosen by riders who value comfort and care.",
  },
  {
    icon: faCarOn,
    title: "Safety Drive Excellence",
    tone: "teal",
    blurb: "Well-maintained cars, ready for every trip.",
  },
  {
    icon: faLightbulb,
    title: "Innovation Champion",
    tone: "amber",
    blurb: "Simple booking and smoother self-drive journeys.",
  },
  {
    icon: faLeaf,
    title: "Sustainable Travel Partner",
    tone: "green",
    blurb: "Thoughtful travel choices for Ranchi roads.",
  },
  {
    icon: faStar,
    title: "Best Customer Support",
    tone: "purple",
    blurb: "Help when you need it — before and during your ride.",
  },
  {
    icon: faChartLine,
    title: "Business Growth Milestone",
    tone: "blue",
    blurb: "Growing with every trusted booking in Ranchi.",
  },
  {
    icon: faUsers,
    title: "Community Engagement",
    tone: "periwinkle",
    blurb: "Built around local travellers and everyday trips.",
  },
  {
    icon: faMedal,
    title: "Industry Leadership",
    tone: "amber",
    blurb: "Setting a clear standard for self-drive service.",
  },
];

// The section layout is a fixed 2 × 3 grid, in this order.
const DISPLAYED_TITLES = [
  "Safety Drive Excellence",
  "Innovation Champion",
  "Sustainable Travel Partner",
  "Best Customer Support",
  "Business Growth Milestone",
  "Community Engagement",
];

const displayed = DISPLAYED_TITLES.map((title) =>
  achievements.find((item) => item.title === title)
).filter(Boolean);

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (y, delay) => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
});

const eyebrowIn = fadeUp(8, 0.05);
const headingIn = fadeUp(16, 0.12);
const leadIn = fadeUp(10, 0.2);

const sceneIn = {
  hidden: { opacity: 0, x: -20, scale: 0.97 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.9, ease: EASE, delay: 0.1 },
  },
};

const gridIn = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.22 } },
};

const cardIn = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const Achievements = () => {
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.25 },
      };

  return (
    <motion.section
      className="achievements"
      aria-labelledby="achievements-title"
      {...reveal}
    >
      <div className="achievements-shell">
        <div className="achievements-intro">
          <motion.p className="achievements-eyebrow" variants={eyebrowIn}>
            Achievements
          </motion.p>
          <motion.h2
            id="achievements-title"
            className="achievements-heading"
            variants={headingIn}
          >
            Milestones we’re
            <span>proud of</span>
          </motion.h2>
          <motion.p className="achievements-lead" variants={leadIn}>
            Recognition that reflects how we care for every ride — safety,
            service, and trust on the road in Ranchi.
          </motion.p>
        </div>

        <motion.div
          className="achievements-scene"
          aria-hidden="true"
          variants={sceneIn}
        >
          <img
            src={SCENE_ASSET}
            alt=""
            width="2048"
            height="818"
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        <motion.ul className="achievements-grid" variants={gridIn}>
          {displayed.map((item) => (
            <motion.li
              key={item.title}
              className={`achievement-card achievement-tone--${item.tone}`}
              variants={cardIn}
            >
              <span className="achievement-card-icon" aria-hidden="true">
                <FontAwesomeIcon icon={item.icon} />
              </span>
              <div className="achievement-card-body">
                <h3>{item.title}</h3>
                <p>{item.blurb}</p>
              </div>
              <span className="achievement-card-arrow" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.section>
  );
};

export default Achievements;
