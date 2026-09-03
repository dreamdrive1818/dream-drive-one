import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbsUp,
  faChair,
  faStopwatch,
  faShieldHalved,
  faArrowRight,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./WhyChooseUs.css";

const FEATURES = [
  {
    id: "clean",
    icon: faChair,
    title: "Clean & Comfortable",
    text: "Choose from well-maintained cars that suit your style and needs.",
  },
  {
    id: "quick",
    icon: faStopwatch,
    title: "Quick & Easy",
    text: "Book your car in minutes — no hassle, no paperwork.",
  },
  {
    id: "honest",
    icon: faShieldHalved,
    title: "No Hidden Costs",
    text: "What you see is what you pay — simple and honest pricing.",
  },
];

const WhyChoose = () => {
  const { webinfo, promoBanner } = useLocalContext();
  const navigate = useNavigate();
  const brand = webinfo?.name || "Dream Drive";
  const phoneHref = webinfo?.phonecall
    ? `tel:${webinfo.phonecall}`
    : "tel:+917061112181";

  return (
    <section className="why-choose">
      <div className="why-choose-inner">
        <div className="why-choose-dots" aria-hidden="true">
          {Array.from({ length: 35 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <AnimateOnScroll className="why-left delay-2">
          <div className="why-badge" aria-hidden="true">
            <FontAwesomeIcon icon={faThumbsUp} />
          </div>

          <h2>
            Why Choose <span className="why-brand">{brand}?</span>
          </h2>

          <span className="why-rule" aria-hidden="true" />

          <p>
            {promoBanner?.body ||
              "Monsoon Sale is live — easy bookings, clean rides, and special rainy-season rates so you can hit the road with confidence."}
          </p>

          <button
            type="button"
            className="why-cta"
            onClick={() => navigate(promoBanner?.link || "/fleet")}
          >
            {promoBanner?.ctaText || "View Monsoon Deals"}
            <span className="why-cta-arrow" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </button>
        </AnimateOnScroll>

        <AnimateOnScroll className="why-visual delay-3">
          <div className="why-orbit" aria-hidden="true">
            <span className="why-orbit-ring why-orbit-ring--solid" />
            <span className="why-orbit-ring why-orbit-ring--dashed" />
            <span className="why-orbit-ring why-orbit-ring--soft" />
          </div>

          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png"
            alt={`${brand} featured car`}
            className="why-car-img"
          />

          <a href={phoneHref} className="why-call-now">
            <FontAwesomeIcon icon={faPhone} />
            Call Now
          </a>
        </AnimateOnScroll>

        <AnimateOnScroll className="why-features delay-4">
          <svg className="why-connectors" viewBox="0 0 120 420" aria-hidden="true">
            <path
              className="why-connector why-connector--1"
              d="M10,70 C55,70 70,55 110,70"
              fill="none"
            />
            <path
              className="why-connector why-connector--2"
              d="M10,210 C55,210 70,210 110,210"
              fill="none"
            />
            <path
              className="why-connector why-connector--3"
              d="M10,350 C55,350 70,365 110,350"
              fill="none"
            />
            <circle cx="10" cy="70" r="3.5" className="why-connector-dot" />
            <circle cx="10" cy="210" r="3.5" className="why-connector-dot" />
            <circle cx="10" cy="350" r="3.5" className="why-connector-dot" />
          </svg>

          <ul className="why-feature-list">
            {FEATURES.map((item) => (
              <li key={item.id} className="why-feature-card">
                <span className="why-feature-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <div className="why-feature-copy">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </AnimateOnScroll>
      </div>
    </section>
  );
};

export default WhyChoose;
