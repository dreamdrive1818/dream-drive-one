import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandPointer,
  faIndianRupeeSign,
  faPenNib,
  faCarOn,
  faCarSide,
  faArrowRight,
  faShieldHalved,
  faHeadset,
  faTags,
  faTruck,
  faLock,
  faCheck,
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import BookNowBanner from "../Booknow/BookNowBanner";
import { TYPE_OPTIONS } from "../../ms/fleetSearch";
import "./HowItWorks.css";

/** Verified existing Dream Drive process steps (from current HowItWorks). */
const STEPS = [
  {
    title: "Select",
    description: "Browse the fleet and pick the car that fits your trip.",
    icon: faHandPointer,
  },
  {
    title: "Book & Pay",
    description: "Lock your dates and pay securely online in minutes.",
    icon: faIndianRupeeSign,
  },
  {
    title: "Sign Consent",
    description: "We email the consent form — sign it digitally, done.",
    icon: faPenNib,
  },
  {
    title: "Drive",
    description: "Pick up the keys and hit the road when you’re ready.",
    icon: faCarOn,
  },
  {
    title: "Return",
    description: "Bring it back at the end of your rental. That’s it.",
    icon: faCarSide,
  },
];

/** Non-numeric trust items from existing project copy — no fake counts. */
const TRUST_ITEMS = [
  {
    id: "cars",
    icon: faShieldHalved,
    title: "Well-maintained cars",
    text: "Clean rides ready for your trip.",
  },
  {
    id: "support",
    icon: faHeadset,
    title: "24×7 support",
    text: "Help when you need it.",
  },
  {
    id: "pricing",
    icon: faTags,
    title: "Clear pricing",
    text: "What you see is what you pay.",
  },
  {
    id: "delivery",
    icon: faTruck,
    title: "Doorstep delivery",
    text: "Available in Ranchi.",
  },
];

/** Real fleet body types used by the search filters. */
const FLEET_TYPES = TYPE_OPTIONS.filter((t) => t.value).map((t) => t.label);

/** Project-owned assets — decorative scenery + existing Cloudinary cutouts. */
const SCENIC_ASSET = "/success-hero-landscape.jpg";
const PARKED_CAR_ASSET =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png";
const DRIVE_CAR_ASSET =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png";

const EASE = [0.22, 1, 0.36, 1];

/* ── Road geometry (desktop scene, viewBox units) ── */

const VIEW_W = 1240;
const VIEW_H = 620;

/** Road start → 5 step stops → road end. Tangents keep the curve organic. */
const ROAD_NODES = [
  { x: -220, y: 660, tx: 0.8, ty: -0.6 },
  { x: 150, y: 392, tx: 1, ty: -0.12 },
  { x: 408, y: 462, tx: 1, ty: 0.06 },
  { x: 652, y: 350, tx: 1, ty: -0.14 },
  { x: 896, y: 440, tx: 1, ty: 0.08 },
  { x: 1110, y: 338, tx: 1, ty: -0.2 },
  { x: 1440, y: 250, tx: 1, ty: -0.22 },
];

/** Callout placement per step: side of the road, stem length and nudge (cqw). */
const STEP_LAYOUT = [
  { side: "above", lift: 6.2, dx: 3.2 },
  { side: "below", lift: 4.6, dx: -1.6 },
  { side: "above", lift: 6.6, dx: -3.4 },
  { side: "below", lift: 4.8, dx: 2.4 },
  { side: "above", lift: 6.4, dx: -1.8 },
];

const unit = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

const bezierAt = (s, t) => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * s.p0.x + b * s.c1.x + c * s.c2.x + d * s.p3.x,
    y: a * s.p0.y + b * s.c1.y + c * s.c2.y + d * s.p3.y,
  };
};

const SEGMENTS = ROAD_NODES.slice(0, -1).map((a, i) => {
  const b = ROAD_NODES[i + 1];
  const ta = unit(a.tx, a.ty);
  const tb = unit(b.tx, b.ty);
  const k = Math.hypot(b.x - a.x, b.y - a.y) * 0.4;
  const seg = {
    p0: a,
    c1: { x: a.x + ta.x * k, y: a.y + ta.y * k },
    c2: { x: b.x - tb.x * k, y: b.y - tb.y * k },
    p3: b,
  };
  let len = 0;
  let prev = a;
  for (let n = 1; n <= 64; n += 1) {
    const p = bezierAt(seg, n / 64);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return { ...seg, len };
});

const fmt = (n) => Math.round(n * 10) / 10;

const ROAD_D = `M ${fmt(ROAD_NODES[0].x)} ${fmt(ROAD_NODES[0].y)} ${SEGMENTS.map(
  (s) =>
    `C ${fmt(s.c1.x)} ${fmt(s.c1.y)} ${fmt(s.c2.x)} ${fmt(s.c2.y)} ${fmt(
      s.p3.x
    )} ${fmt(s.p3.y)}`
).join(" ")}`;

const ROAD_TOTAL = SEGMENTS.reduce((sum, s) => sum + s.len, 0);

/** Fraction of the road length at which each step stop sits. */
const STEP_AT = SEGMENTS.slice(0, STEPS.length).map(
  (_, i) =>
    SEGMENTS.slice(0, i + 1).reduce((sum, s) => sum + s.len, 0) / ROAD_TOTAL
);

/**
 * Static Drive car: tyre-contact point (viewBox units) on the flatter approach
 * into the Drive valley, where a level car keeps all tyres on the asphalt.
 */
const CAR_SPOT = { x: 870, y: 421.7 };

const pctX = (x) => `${(x / VIEW_W) * 100}%`;
const pctY = (y) => `${(y / VIEW_H) * 100}%`;

const DESKTOP_QUERY = "(min-width: 1024px)";

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
};

const PINE_PATH =
  "M0 -1 L0.2 -0.66 L0.1 -0.66 L0.28 -0.34 L0.15 -0.34 L0.36 0 L-0.36 0 L-0.15 -0.34 L-0.28 -0.34 L-0.1 -0.66 L-0.2 -0.66 Z";

const RIDGE_PINES = [
  { x: 40, y: 262, s: 62, o: 0.55 },
  { x: 78, y: 270, s: 48, o: 0.4 },
  { x: 1318, y: 250, s: 70, o: 0.55 },
  { x: 1360, y: 262, s: 54, o: 0.42 },
  { x: 1396, y: 256, s: 60, o: 0.5 },
];

const FOREGROUND_PINES = [
  { x: 34, y: 220, s: 150, fill: "#4d8c82", o: 0.5 },
  { x: 86, y: 220, s: 110, fill: "#5f9d92", o: 0.42 },
  { x: 128, y: 220, s: 76, fill: "#7fb3a8", o: 0.38 },
];

/** Mobile/tablet road segments bend alternately to form one winding road. */
const SEG_PATHS = ["M28 0 C 50 30 6 70 28 100", "M28 0 C 6 30 50 70 28 100"];

const HowItWorks = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const sectionRef = useRef(null);
  const sceneRef = useRef(null);
  const [reached, setReached] = useState(0);

  const { scrollYProgress: sectionProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const { scrollYProgress: journey } = useScroll({
    target: sceneRef,
    offset: ["start 0.82", "end 0.62"],
  });

  const mountainsY = useTransform(sectionProgress, [0, 1], [20, -20]);
  const foregroundY = useTransform(sectionProgress, [0, 1], [-10, 10]);

  const syncReached = (v) => {
    setReached(STEP_AT.filter((f) => v >= f - 0.012).length);
  };

  useMotionValueEvent(journey, "change", (v) => {
    if (isDesktop && !reduceMotion) syncReached(v);
  });

  useEffect(() => {
    if (isDesktop && !reduceMotion) syncReached(journey.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, reduceMotion]);

  const activeCount = reduceMotion ? STEPS.length : reached;

  const revealOnView = (amount) =>
    reduceMotion
      ? { initial: "show", animate: "show" }
      : {
          initial: "hidden",
          whileInView: "show",
          viewport: { once: true, amount },
        };

  const reveal = revealOnView(0.15);

  /**
   * Per-step choreography: card → connector → road node. On desktop the steps
   * follow each other along the road; on mobile each step reveals on its own
   * as it scrolls in, so only the short in-step offsets apply.
   */
  const stepStart = (i) => (isDesktop ? 0.3 + i * 0.1 : 0);
  const beat = isDesktop
    ? { marker: 0.18, stem: 0.22, node: 0.5, ring: 0.62, visual: 0.3 }
    : { marker: 0.08, stem: 0.18, node: 0.08, ring: 0.3, visual: 0 };

  const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE, delay },
    }),
  };

  const landscape = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: 1.1, ease: EASE, delay: 0.1 },
    },
  };

  const foregroundIn = {
    hidden: { opacity: 0.4 },
    show: {
      opacity: 1,
      transition: { duration: 1.2, ease: EASE, delay: 0.3 },
    },
  };

  const roadIn = {
    hidden: { opacity: 0.75 },
    show: { opacity: 1, transition: { duration: 0.8, ease: EASE } },
  };

  const cardIn = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    show: (i) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: EASE, delay: stepStart(i) },
    }),
  };

  const numIn = {
    hidden: { scale: 0.75 },
    show: (i) => ({
      scale: [0.75, 1.08, 1],
      transition: {
        duration: 0.55,
        times: [0, 0.6, 1],
        ease: "easeOut",
        delay: stepStart(i) + beat.marker,
      },
    }),
  };

  const stemIn = {
    hidden: { scaleY: 0 },
    show: (i) => ({
      scaleY: 1,
      transition: { duration: 0.35, ease: EASE, delay: stepStart(i) + beat.stem },
    }),
  };

  const pinIn = {
    hidden: { scale: 0.75 },
    show: (i) => ({
      scale: isDesktop ? 1 : [0.75, 1.08, 1],
      transition: {
        duration: isDesktop ? 0.4 : 0.55,
        ease: isDesktop ? EASE : "easeOut",
        delay: stepStart(i) + beat.node,
      },
    }),
  };

  const pinDotIn = {
    hidden: { opacity: 0.4 },
    show: (i) => ({
      opacity: 1,
      transition: { duration: 0.4, delay: stepStart(i) + beat.node },
    }),
  };

  const ringOnce = (offset) => ({
    hidden: { scale: 1, opacity: 0 },
    show: (i) => ({
      scale: [1, 1.03, 1.5],
      opacity: [0, 0.35, 0],
      transition: {
        duration: 0.9,
        times: [0, 0.08, 1],
        ease: "easeOut",
        delay: stepStart(i) + offset,
      },
    }),
  });
  const pinRingIn = ringOnce(beat.ring);
  const numRingIn = ringOnce(beat.marker + 0.12);

  const segIn = {
    hidden: { scaleY: 0 },
    show: (i) => ({
      scaleY: 1,
      transition: { duration: 0.5, ease: EASE, delay: stepStart(i) + beat.stem },
    }),
  };

  const visualIn = {
    hidden: { opacity: 0, y: 14, scale: 0.96 },
    show: (i) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: EASE,
        delay: stepStart(i) + beat.visual,
      },
    }),
  };

  const carIn = {
    hidden: { opacity: 0, scale: 0.94, y: 8 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6, ease: EASE, delay: stepStart(4) + beat.node + 0.3 },
    },
  };

  const stepMotionProps = (index) => {
    if (reduceMotion || isDesktop) return {};
    return {
      initial: "hidden",
      whileInView: "show",
      viewport: { once: true, amount: 0.45 },
      onViewportEnter: () => setReached((n) => Math.max(n, index + 1)),
    };
  };

  return (
    <>
      <motion.section
        ref={sectionRef}
        className="how-it-works"
        aria-labelledby="hiw-heading"
        {...reveal}
      >
        <div className="hiw-sky" aria-hidden="true" />

        <motion.div
          className="hiw-mountains"
          aria-hidden="true"
          variants={landscape}
          style={reduceMotion ? undefined : { y: mountainsY }}
        >
          <div
            className="hiw-mtn hiw-mtn--main"
            style={{ backgroundImage: `url(${SCENIC_ASSET})` }}
          />
          <div
            className="hiw-mtn hiw-mtn--mirror"
            style={{ backgroundImage: `url(${SCENIC_ASSET})` }}
          />
          <div className="hiw-mist" />
        </motion.div>

        <motion.div
          className="hiw-ground"
          aria-hidden="true"
          variants={landscape}
        >
          <svg viewBox="0 0 1440 600" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hiw-ridge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#cfe5de" stopOpacity="0.85" />
                <stop offset="1" stopColor="#e6f1ed" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="hiw-meadow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#dcebe4" />
                <stop offset="0.45" stopColor="#edf5f1" />
                <stop offset="1" stopColor="#f7faf8" />
              </linearGradient>
            </defs>
            <path
              d="M0 250 C 160 214 300 268 470 238 S 780 206 960 240 S 1260 212 1440 236 L1440 600 L0 600 Z"
              fill="url(#hiw-ridge)"
            />
            {RIDGE_PINES.map((p, i) => (
              <path
                key={i}
                d={PINE_PATH}
                transform={`translate(${p.x} ${p.y}) scale(${p.s * 0.55} ${p.s})`}
                fill="#5f9d92"
                opacity={p.o}
              />
            ))}
            <path
              d="M0 318 C 210 290 390 338 600 312 S 960 290 1140 318 S 1340 300 1440 306 L1440 600 L0 600 Z"
              fill="url(#hiw-meadow)"
            />
          </svg>
        </motion.div>

        <div className="hiw-shell">
          <header className="hiw-head">
            <motion.p className="hiw-eyebrow" variants={fadeUp} custom={0}>
              <span className="hiw-eyebrow-rule" aria-hidden="true" />
              The Dream Drive Journey
              <span className="hiw-eyebrow-rule" aria-hidden="true" />
            </motion.p>
            <motion.h2
              id="hiw-heading"
              className="hiw-title"
              variants={fadeUp}
              custom={0.1}
            >
              How It <span className="hiw-title-accent">Works</span>
            </motion.h2>
            <motion.p className="hiw-lead" variants={fadeUp} custom={0.2}>
              Five simple steps from choosing your car to returning it.
            </motion.p>
          </header>

          <motion.p
            className="hiw-script"
            aria-hidden="true"
            variants={fadeUp}
            custom={0.36}
          >
            <span>Same Roads.</span>
            <span>New Stories.</span>
            <svg viewBox="0 0 120 16" className="hiw-script-swash">
              <path d="M4 11 C 34 3 72 3 116 7" />
              <path d="M22 14 C 48 9 78 9 104 11" />
            </svg>
          </motion.p>

          <motion.div
            className="hiw-scene"
            ref={sceneRef}
            {...revealOnView(isDesktop ? 0.35 : 0.01)}
          >
            <svg
              className="hiw-road"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="hiw-road-fade"
                  gradientUnits="userSpaceOnUse"
                  x1="-220"
                  y1="0"
                  x2="1440"
                  y2="0"
                >
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.14" stopColor="#fff" stopOpacity="1" />
                  <stop offset="0.8" stopColor="#fff" stopOpacity="1" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="hiw-asphalt" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#56626b" />
                  <stop offset="0.5" stopColor="#4a555e" />
                  <stop offset="1" stopColor="#66727a" />
                </linearGradient>
                <filter id="hiw-road-shadow" x="-10%" y="-20%" width="120%" height="140%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
                <mask
                  id="hiw-road-reveal"
                  maskUnits="userSpaceOnUse"
                  x="-260"
                  y="0"
                  width="1760"
                  height={VIEW_H + 80}
                >
                  <path
                    d={ROAD_D}
                    fill="none"
                    stroke="url(#hiw-road-fade)"
                    strokeWidth="120"
                    strokeLinecap="round"
                  />
                </mask>
              </defs>

              <motion.g mask="url(#hiw-road-reveal)" variants={roadIn}>
                <path
                  d={ROAD_D}
                  className="hiw-road-shadow"
                  filter="url(#hiw-road-shadow)"
                />
                <path d={ROAD_D} className="hiw-road-shoulder" />
                <path d={ROAD_D} className="hiw-road-edge" />
                <path
                  d={ROAD_D}
                  className="hiw-road-asphalt"
                  stroke="url(#hiw-asphalt)"
                />
                <path d={ROAD_D} className="hiw-road-dash" />
                <motion.path
                  d={ROAD_D}
                  className="hiw-road-progress"
                  style={{ pathLength: reduceMotion ? 1 : journey }}
                />
              </motion.g>
            </svg>

            <motion.div
              className="hiw-visual hiw-visual--parked"
              aria-hidden="true"
              variants={visualIn}
              custom={0}
              data-active={activeCount >= 1 || undefined}
            >
              <img src={PARKED_CAR_ASSET} alt="" loading="lazy" />
            </motion.div>

            <motion.div
              className="hiw-visual hiw-visual--pay"
              aria-hidden="true"
              variants={visualIn}
              custom={1}
              data-active={activeCount >= 2 || undefined}
            >
              <span className="hiw-phone">
                <span className="hiw-phone-notch" />
                <span className="hiw-phone-bar" />
                <span className="hiw-phone-bar hiw-phone-bar--short" />
                <span className="hiw-phone-coin">
                  <FontAwesomeIcon icon={faIndianRupeeSign} />
                </span>
                <span className="hiw-phone-pay">
                  <FontAwesomeIcon icon={faLock} />
                </span>
              </span>
            </motion.div>

            <motion.div
              className="hiw-visual hiw-visual--doc"
              aria-hidden="true"
              variants={visualIn}
              custom={2}
              data-active={activeCount >= 3 || undefined}
            >
              <span className="hiw-doc">
                <span className="hiw-doc-line hiw-doc-line--title" />
                <span className="hiw-doc-line" />
                <span className="hiw-doc-line" />
                <span className="hiw-doc-line hiw-doc-line--short" />
                <svg viewBox="0 0 80 28" className="hiw-doc-sign">
                  <path d="M4 20 C 12 4 18 4 16 18 C 15 26 24 8 30 12 C 34 15 32 22 38 18 C 44 14 48 10 54 16 C 58 20 64 14 76 12" />
                </svg>
              </span>
              <span className="hiw-doc-check">
                <FontAwesomeIcon icon={faCheck} />
              </span>
            </motion.div>

            <div
              className="hiw-car-track"
              aria-hidden="true"
              style={{ left: pctX(CAR_SPOT.x), top: pctY(CAR_SPOT.y) }}
            >
              <motion.div
                className="hiw-car"
                variants={carIn}
                data-active={activeCount >= 4 || undefined}
              >
                <span className="hiw-car-shadow" />
                <img src={DRIVE_CAR_ASSET} alt="" loading="lazy" />
              </motion.div>
            </div>

            <motion.div
              className="hiw-visual hiw-visual--return"
              aria-hidden="true"
              variants={visualIn}
              custom={4}
              data-active={activeCount >= 5 || undefined}
            >
              <span className="hiw-return-key">
                <FontAwesomeIcon icon={faKey} />
              </span>
              <span className="hiw-return-check">
                <FontAwesomeIcon icon={faCheck} />
              </span>
            </motion.div>

            <ol className="hiw-steps">
              {STEPS.map((step, index) => {
                const node = ROAD_NODES[index + 1];
                const layout = STEP_LAYOUT[index];
                const isReached = index < activeCount;
                const isCurrent = index === activeCount - 1;
                const num = String(index + 1).padStart(2, "0");

                return (
                  <motion.li
                    key={step.title}
                    className={`hiw-step hiw-step--${layout.side}${
                      isReached ? " is-reached" : ""
                    }${isCurrent ? " is-current" : ""}`}
                    style={{
                      "--x": pctX(node.x),
                      "--y": pctY(node.y),
                      "--lift": `${layout.lift}cqw`,
                      "--dx": `${layout.dx}cqw`,
                    }}
                    {...stepMotionProps(index)}
                  >
                    {index < STEPS.length - 1 ? (
                      <motion.svg
                        className="hiw-seg"
                        viewBox="0 0 56 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        variants={segIn}
                        custom={index}
                      >
                        <path className="hiw-seg-edge" d={SEG_PATHS[index % 2]} />
                        <path className="hiw-seg-asphalt" d={SEG_PATHS[index % 2]} />
                        <path className="hiw-seg-dash" d={SEG_PATHS[index % 2]} />
                      </motion.svg>
                    ) : null}

                    <motion.span
                      className="hiw-pin"
                      aria-hidden="true"
                      variants={pinIn}
                      custom={index}
                    >
                      <motion.span
                        className="hiw-pin-ring"
                        variants={pinRingIn}
                        custom={index}
                      />
                      <motion.span
                        className="hiw-pin-dot"
                        variants={pinDotIn}
                        custom={index}
                      />
                      <span className="hiw-pin-num">{num}</span>
                    </motion.span>

                    <motion.span
                      className="hiw-stem"
                      aria-hidden="true"
                      variants={stemIn}
                      custom={index}
                    />

                    <motion.div className="hiw-card" variants={cardIn} custom={index}>
                      <div className="hiw-card-head">
                        <motion.span
                          className="hiw-num"
                          aria-hidden="true"
                          variants={numIn}
                          custom={index}
                        >
                          <motion.span
                            className="hiw-num-ring"
                            variants={numRingIn}
                            custom={index}
                          />
                          {num}
                        </motion.span>
                        <h3 className="hiw-card-title">{step.title}</h3>
                        <span className="hiw-icon" aria-hidden="true">
                          <FontAwesomeIcon icon={step.icon} />
                        </span>
                      </div>
                      <p className="hiw-card-text">{step.description}</p>

                      {index === 0 ? (
                        <ul className="hiw-types" aria-label="Fleet types">
                          {FLEET_TYPES.map((type) => (
                            <li key={type}>{type}</li>
                          ))}
                        </ul>
                      ) : null}

                      {index === 3 ? (
                        <img
                          className="hiw-card-car"
                          src={DRIVE_CAR_ASSET}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                        />
                      ) : null}
                    </motion.div>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>

          <motion.div
            className="hiw-footer"
            variants={fadeUp}
            custom={0}
            {...revealOnView(0.3)}
          >
            <button
              type="button"
              className="hiw-cta"
              onClick={() => navigate("/fleet")}
            >
              Start Your Journey
              <FontAwesomeIcon icon={faArrowRight} />
            </button>

            <ul className="hiw-trust-list">
              {TRUST_ITEMS.map((item) => (
                <li key={item.id} className="hiw-trust-item">
                  <span className="hiw-trust-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  <div className="hiw-trust-copy">
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          className="hiw-foreground"
          aria-hidden="true"
          variants={foregroundIn}
          style={reduceMotion ? undefined : { y: foregroundY }}
        >
          {["left", "right"].map((side) => (
            <svg
              key={side}
              className={`hiw-foreground-pines hiw-foreground-pines--${side}`}
              viewBox="0 0 180 220"
            >
              {FOREGROUND_PINES.map((p, i) => (
                <path
                  key={i}
                  d={PINE_PATH}
                  transform={`translate(${p.x} ${p.y}) scale(${p.s * 0.5} ${p.s})`}
                  fill={p.fill}
                  opacity={p.o}
                />
              ))}
            </svg>
          ))}
        </motion.div>
      </motion.section>
      <BookNowBanner />
    </>
  );
};

export default HowItWorks;
