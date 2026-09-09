import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faUserFriends,
  faShieldAlt,
  faMobileAlt,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import Achievements from "../Achievements/Achievements";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import "./About.css";

const highlights = [
  {
    icon: faCarSide,
    title: "Wide car selection",
    desc: "Hatchbacks to 7-seater SUVs — Nexon, Compass, and more.",
  },
  {
    icon: faUserFriends,
    title: "Freedom to drive",
    desc: "No drivers, no limits. Go when and where you want.",
  },
  {
    icon: faShieldAlt,
    title: "Reliable & safe",
    desc: "Sanitized, insured, and regularly serviced vehicles.",
  },
  {
    icon: faMobileAlt,
    title: "Doorstep delivery",
    desc: "Book online and get the car delivered to you.",
  },
];

const About = () => {
  return (
    <>
      <section className="about-page">
        <div className="about-inner">
          <header className="about-header">
            <p className="about-eyebrow">About us</p>
            <h1>
              Welcome to <span>Dream Drive</span>
            </h1>
            <p className="about-lead">
              Ranchi’s trusted self-drive car rental — clean cars, clear pricing,
              and freedom on every trip.
            </p>
          </header>

          <AnimateOnScroll className="about-intro">
            <p>
              Whether you’re planning a quick city run or a weekend getaway, we
              offer a wide range of well-maintained cars — including 7-seater
              SUVs — at affordable rates.
            </p>
            <p>
              No drivers. No time limits. Just smooth, comfortable rides with
              flexible packages, doorstep delivery, and 24×7 support.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll className="about-highlights">
            <div className="about-section-head">
              <p className="about-eyebrow">Why us</p>
              <h2>Why choose Dream Drive?</h2>
            </div>
            <div className="about-highlights-grid">
              {highlights.map((item) => (
                <article className="about-highlight" key={item.title}>
                  <span className="about-highlight-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll className="about-split">
            <div className="about-copy">
              <p className="about-eyebrow">Our story</p>
              <h2>Built for a better rental</h2>
              <p>
                Dream Drive started from a desire to fix car rental in Ranchi —
                long queues, unreliable vehicles, and hidden charges.
              </p>
              <p>
                We’ve refined the model by listening to real feedback: transparent
                pricing, quality control, and support when you need it.
              </p>
            </div>
            <div className="about-visual" aria-hidden="true">
              <img
                src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750163087/jeep_smrjsp.png"
                alt=""
              />
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll className="about-split about-split--reverse">
            <div className="about-copy">
              <p className="about-eyebrow">Our mission</p>
              <h2>Freedom on every journey</h2>
              <p>
                Make self-drive rental in Ranchi easy, reliable, and enjoyable —
                from hatchbacks to 7-seater SUVs for family trips, weekends, or
                business.
              </p>
              <p>
                Because every journey matters — and we’re here to make yours
                unforgettable.
              </p>
              <Link className="about-cta" to="/fleet">
                Browse cars
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
            <div className="about-visual" aria-hidden="true">
              <img
                src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png"
                alt=""
              />
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <Achievements />
    </>
  );
};

export default About;
