import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandPointer,
  faIndianRupeeSign,
  faPenNib,
  faCarOn,
  faCarSide,
  faArrowRight,
  faPlay,
  faShieldHalved,
  faHeadset,
  faTags,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import BookNowBanner from "../Booknow/BookNowBanner";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./HowItWorks.css";

/** Verified existing Dream Drive process steps (from current HowItWorks). */
const STEPS = [
  {
    title: "Select",
    description: "Browse the fleet and pick the car that fits your trip.",
    icon: faHandPointer,
    tone: "mint",
  },
  {
    title: "Book & Pay",
    description: "Lock your dates and pay securely online in minutes.",
    icon: faIndianRupeeSign,
    tone: "blue",
  },
  {
    title: "Sign Consent",
    description: "We email the consent form — sign it digitally, done.",
    icon: faPenNib,
    tone: "lavender",
  },
  {
    title: "Drive",
    description: "Pick up the keys and hit the road when you’re ready.",
    icon: faCarOn,
    tone: "amber",
  },
  {
    title: "Return",
    description: "Bring it back at the end of your rental. That’s it.",
    icon: faCarSide,
    tone: "green",
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

const CAR_ASSET =
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png";

const SCENIC_ASSET = "/success-hero-landscape.jpg";

const HowItWorks = () => {
  const navigate = useNavigate();

  const scrollToSteps = () => {
    document.getElementById("hiw-steps")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <section className="how-it-works" aria-label="How it works">
        <div className="hiw-shell">
          <div className="hiw-main">
            <AnimateOnScroll className="hiw-left delay-2">
              <p className="hiw-eyebrow">How it works</p>

              <h2 className="hiw-title">
                <span className="hiw-title-line">Five steps.</span>
                <span className="hiw-title-line hiw-title-line--accent">
                  Zero confusion.
                </span>
              </h2>

              <p className="hiw-lead">
                Book a self-drive car in Ranchi without the usual rental maze —
                select, pay, sign, drive, return.
              </p>

              <div className="hiw-actions">
                <button
                  type="button"
                  className="hiw-cta"
                  onClick={() => navigate("/fleet")}
                >
                  Start Your Journey
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>

                <button
                  type="button"
                  className="hiw-secondary"
                  onClick={scrollToSteps}
                >
                  <span className="hiw-play" aria-hidden="true">
                    <FontAwesomeIcon icon={faPlay} />
                  </span>
                  <span className="hiw-secondary-copy">
                    <strong>How it works</strong>
                    <em>See the process</em>
                  </span>
                </button>
              </div>

              <div className="hiw-visual">
                <div className="hiw-visual-stage">
                  <div
                    className="hiw-scenic"
                    style={{ backgroundImage: `url(${SCENIC_ASSET})` }}
                    aria-hidden="true"
                  />
                  <span className="hiw-scenic-arc" aria-hidden="true" />
                  <span className="hiw-deco" aria-hidden="true" />
                  <img
                    src={CAR_ASSET}
                    alt="Dream Drive self-drive car"
                    className="hiw-car"
                  />
                </div>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll className="hiw-timeline delay-3">
              <ol className="hiw-list" id="hiw-steps">
                {STEPS.map((step, index) => (
                  <li
                    key={step.title}
                    className={`hiw-card hiw-card--${step.tone}`}
                  >
                    <span className="hiw-num" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="hiw-icon" aria-hidden="true">
                      <FontAwesomeIcon icon={step.icon} />
                    </span>

                    <div className="hiw-copy">
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>

                    <div className="hiw-thumb" aria-hidden="true">
                      {index === 0 ? (
                        <img src={CAR_ASSET} alt="" loading="lazy" />
                      ) : (
                        <FontAwesomeIcon icon={step.icon} />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </AnimateOnScroll>
          </div>

          <AnimateOnScroll className="hiw-trust delay-4">
            <ul className="hiw-trust-list">
              {TRUST_ITEMS.map((item, index) => (
                <li key={item.id} className="hiw-trust-item">
                  {index > 0 ? (
                    <span className="hiw-trust-divider" aria-hidden="true" />
                  ) : null}
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
          </AnimateOnScroll>
        </div>
      </section>
      <BookNowBanner />
    </>
  );
};

export default HowItWorks;
