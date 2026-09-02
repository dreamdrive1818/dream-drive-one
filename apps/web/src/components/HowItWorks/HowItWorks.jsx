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
} from "@fortawesome/free-solid-svg-icons";
import BookNowBanner from "../Booknow/BookNowBanner";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./HowItWorks.css";

const steps = [
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

const HowItWorks = () => {
  const navigate = useNavigate();

  return (
    <>
      <section className="how-it-works">
        <div className="hiw-shell">
          <AnimateOnScroll className="hiw-intro delay-2">
            <p className="hiw-eyebrow">How it works</p>
            <h2 className="hiw-title">
              Five steps.
              <br />
              <span>Zero confusion.</span>
            </h2>
            <p className="hiw-lead">
              Book a self-drive car in Ranchi without the usual rental maze —
              select, pay, sign, drive, return.
            </p>
            <button
              type="button"
              className="hiw-cta"
              onClick={() => navigate("/fleet")}
            >
              Start with a car
              <span className="hiw-cta-arrow" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
              </span>
            </button>
          </AnimateOnScroll>

          <AnimateOnScroll className="hiw-timeline delay-3">
            <ol className="hiw-list">
              {steps.map((step, index) => (
                <li key={step.title} className="hiw-item">
                  <div className="hiw-rail" aria-hidden="true">
                    <span className="hiw-node">
                      <FontAwesomeIcon icon={step.icon} />
                    </span>
                  </div>
                  <div className="hiw-copy">
                    <span className="hiw-index">
                      Step {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </AnimateOnScroll>
        </div>
      </section>
      <BookNowBanner />
    </>
  );
};

export default HowItWorks;
