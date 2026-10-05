import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faMountainSun } from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import "./PopularGetaways.css";

const EASE = [0.22, 1, 0.36, 1];

const FALLBACK_CARDS = [
  {
    id: "patratu",
    name: "Patratu Valley",
    blurb: "A short scenic drive, ideal for a day trip in a compact SUV.",
    imageUrl: "/getaway-patratu.jpg",
  },
  {
    id: "netarhat",
    name: "Netarhat",
    blurb: "Plan an overnight stay and start early for the hill roads.",
    imageUrl: "/getaway-netarhat.jpg",
  },
  {
    id: "hundru",
    name: "Hundru",
    blurb: "Waterfalls and greens — a familiar weekend run from Ranchi.",
    imageUrl: "/getaway-hundru.jpg",
  },
];

const FALLBACK = {
  enabled: true,
  eyebrow: "Trip ideas",
  title: "Popular getaways from",
  highlight: "Ranchi",
  lead: "Netarhat, Patratu, and Hundru — self-drive days out with an SUV from Dream Drive.",
  ctaLabel: "Browse our fleet",
  ctaHref: "/fleet",
  guideLabel: "Read the weekend guide",
  guideHref: "/blogs/weekend-drives-from-ranchi",
  cards: FALLBACK_CARDS,
};

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

function go(navigate, href) {
  if (!href) return;
  if (/^https?:\/\//i.test(href)) {
    window.location.href = href;
    return;
  }
  navigate(href);
}

const PopularGetaways = () => {
  const navigate = useNavigate();
  const { cms } = useLocalContext();
  const reduceMotion = useReducedMotion();
  const section = cms?.getaways && typeof cms.getaways === "object" ? { ...FALLBACK, ...cms.getaways } : FALLBACK;
  const cards = Array.isArray(section.cards) && section.cards.length ? section.cards : FALLBACK.cards;
  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.2 },
      };

  if (section.enabled === false) return null;

  return (
    <motion.section
      className="pg-getaways"
      aria-labelledby="pg-getaways-title"
      {...reveal}
    >
      <div className="pg-getaways-inner">
        <header className="pg-getaways-head">
          {section.eyebrow ? (
            <motion.p className="pg-getaways-eyebrow" variants={fadeUp} custom={0}>
              <span className="pg-getaways-eyebrow-rule" aria-hidden="true" />
              {section.eyebrow}
              <span className="pg-getaways-eyebrow-rule" aria-hidden="true" />
            </motion.p>
          ) : null}
          <motion.h2 id="pg-getaways-title" className="pg-getaways-title" variants={fadeUp} custom={0.08}>
            {section.title} {section.highlight ? <span>{section.highlight}</span> : null}
          </motion.h2>
          {section.lead ? (
            <motion.p className="pg-getaways-lead" variants={fadeUp} custom={0.16}>
              {section.lead}
            </motion.p>
          ) : null}
        </header>

        <ul className="pg-getaways-grid">
          {cards.map((trip, index) => {
            const image = trip.imageUrl || trip.image;
            const body = (
              <article className="pg-getaways-card">
                <div className="pg-getaways-media">
                  <img src={image} alt="" loading="lazy" />
                  {trip.chip !== "" ? (
                    <span className="pg-getaways-chip">
                      <FontAwesomeIcon icon={faMountainSun} />
                      {trip.chip || "Weekend"}
                    </span>
                  ) : null}
                </div>
                <div className="pg-getaways-body">
                  <h3>{trip.name}</h3>
                  <p>{trip.blurb}</p>
                </div>
              </article>
            );
            return (
              <motion.li key={trip.id || trip.name} variants={cardIn} custom={index}>
                {trip.href ? (
                  <button type="button" className="pg-getaways-card-btn" onClick={() => go(navigate, trip.href)}>
                    {body}
                  </button>
                ) : (
                  body
                )}
              </motion.li>
            );
          })}
        </ul>

        <motion.div className="pg-getaways-actions" variants={fadeUp} custom={0.42}>
          {section.ctaLabel ? (
            <button type="button" className="pg-getaways-cta" onClick={() => go(navigate, section.ctaHref || "/fleet")}>
              {section.ctaLabel}
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          ) : null}
          {section.guideLabel ? (
            <button
              type="button"
              className="pg-getaways-link"
              onClick={() => go(navigate, section.guideHref || "/blogs/weekend-drives-from-ranchi")}
            >
              {section.guideLabel}
            </button>
          ) : null}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default PopularGetaways;
