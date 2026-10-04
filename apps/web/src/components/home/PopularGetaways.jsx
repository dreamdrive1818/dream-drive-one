import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faMountainSun } from "@fortawesome/free-solid-svg-icons";
import "./PopularGetaways.css";

const EASE = [0.22, 1, 0.36, 1];

/** Copy aligned with seed blog “Weekend drives from Ranchi” — no invented distances or ratings. */
const GETAWAYS = [
  {
    id: "patratu",
    name: "Patratu Valley",
    blurb: "A short scenic drive, ideal for a day trip in a compact SUV.",
    image: "/getaway-patratu.jpg",
  },
  {
    id: "netarhat",
    name: "Netarhat",
    blurb: "Plan an overnight stay and start early for the hill roads.",
    image: "/getaway-netarhat.jpg",
  },
  {
    id: "hundru",
    name: "Hundru",
    blurb: "Waterfalls and greens — a familiar weekend run from Ranchi.",
    image: "/getaway-hundru.jpg",
  },
];

const GUIDE_SLUG = "weekend-drives-from-ranchi";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE, delay },
  }),
};

const cardIn = {
  hidden: { opacity: 0, y: 22 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay: 0.2 + i * 0.08 },
  }),
};

const PopularGetaways = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.2 },
      };

  return (
    <motion.section
      className="pg-getaways"
      aria-labelledby="pg-getaways-title"
      {...reveal}
    >
      <div className="pg-getaways-inner">
        <header className="pg-getaways-head">
          <motion.p className="pg-getaways-eyebrow" variants={fadeUp} custom={0}>
            <span className="pg-getaways-eyebrow-rule" aria-hidden="true" />
            Trip ideas
            <span className="pg-getaways-eyebrow-rule" aria-hidden="true" />
          </motion.p>
          <motion.h2 id="pg-getaways-title" className="pg-getaways-title" variants={fadeUp} custom={0.08}>
            Popular getaways from <span>Ranchi</span>
          </motion.h2>
          <motion.p className="pg-getaways-lead" variants={fadeUp} custom={0.16}>
            Netarhat, Patratu, and Hundru — self-drive days out with an SUV from Dream Drive.
          </motion.p>
        </header>

        <ul className="pg-getaways-grid">
          {GETAWAYS.map((trip, index) => (
            <motion.li key={trip.id} variants={cardIn} custom={index}>
              <article className="pg-getaways-card">
                <div className="pg-getaways-media">
                  <img src={trip.image} alt="" loading="lazy" />
                  <span className="pg-getaways-chip">
                    <FontAwesomeIcon icon={faMountainSun} />
                    Weekend
                  </span>
                </div>
                <div className="pg-getaways-body">
                  <h3>{trip.name}</h3>
                  <p>{trip.blurb}</p>
                </div>
              </article>
            </motion.li>
          ))}
        </ul>

        <motion.div className="pg-getaways-actions" variants={fadeUp} custom={0.42}>
          <button type="button" className="pg-getaways-cta" onClick={() => navigate("/fleet")}>
            Browse our fleet
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <button
            type="button"
            className="pg-getaways-link"
            onClick={() => navigate(`/blogs/${GUIDE_SLUG}`)}
          >
            Read the weekend guide
          </button>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default PopularGetaways;
