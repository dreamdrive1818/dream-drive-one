import React from "react";
import "./About.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faUserFriends,
  faShieldAlt,
  faMobileAlt,
} from "@fortawesome/free-solid-svg-icons";
import Achievements from "../Achievements/Achievements";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";


const highlights = [
  {
    icon: faCarSide,
    title: "Wide Car Selection",
    desc: "Choose from hatchbacks to 7-seater SUVs like Nexon & Compass.",
  },
  {
    icon: faUserFriends,
    title: "Freedom to Drive",
    desc: "No drivers, no limits. Drive when and where you want.",
  },
  {
    icon: faShieldAlt,
    title: "Reliable & Safe",
    desc: "All cars are sanitized, insured, and regularly serviced.",
  },
  {
    icon: faMobileAlt,
    title: "Doorstep Delivery",
    desc: "Book online and get your car delivered at your convenience.",
  },
];

const About = () => {
  return (
    <>

      <section className="about-container">
        <div className="about-content">
          {/* Intro */}
          <AnimateOnScroll className="about-intro updated">
            <h2>Welcome to <span>Dream Drive</span></h2>
            <p className="tagline">Ranchi’s #1 Self-Drive Car Rental</p>
            <p>
              Dream Drive is Ranchi’s trusted name in self-drive car rentals. Whether you’re planning a quick city run or a weekend getaway, we offer a wide range of well-maintained cars — including 7-seater SUVs like Compass and Nexon — all at affordable rates.
            </p>
            <p>
               At Dream Drive, we believe in giving you the freedom to drive at your own pace. No drivers. No time limits. Just smooth, clean, and comfortable rides. With flexible packages, doorstep delivery, and 24x7 support, renting a car in Ranchi has never been easier.
            </p>
            <p>
              Whether it's for business, family travel, or a road trip — book your self-drive car today and experience convenience like never before.
            </p>
          </AnimateOnScroll>

          {/* Highlights */}
          <AnimateOnScroll className="about-highlights-section">
            <h3 className="highlight-heading">Why Choose Dream Drive?</h3>
            <div className="about-highlights-grid">
              {highlights.map((item, index) => (
                <div className="highlight-card" key={index}>
                  <div className="highlight-icon">
                    <FontAwesomeIcon icon={item.icon} />
                  </div>
                  <div className="highlight-info">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Our Story */}
          <AnimateOnScroll className="about-story delay-2">
            <div className="about-text-block">
              <h3>Our Story</h3>
              <p>
                DreamDrive was born out of a desire to revolutionize the way people experience car rentals in India.
                Tired of long queues, unreliable vehicles, and hidden charges, we decided it was time for a better way.
              </p>
              <p>
                Since launch, we’ve continuously refined our model by listening to real feedback and solving genuine problems.
                Our focus on transparent pricing, quality control, and real-time support has helped us earn a loyal customer base.
              </p>
            </div>
            <div className="about-image-block">
              <img
                src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750163087/jeep_smrjsp.png"
                alt="DreamDrive Fleet"
              />
            </div>
          </AnimateOnScroll>

          {/* Mission */}
          <AnimateOnScroll className="about-mission">
            <div className="about-image-block">
              <img
                src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png"
                alt="DreamDrive Nexon"
              />
            </div>
            <div className="about-text-block">
              <h3>Our Mission</h3>
              <p>
                At Dream Drive, our mission is to make self-drive car rental in Ranchi easy, reliable, and enjoyable for everyone. We’re transforming traditional car rental experiences by using smart technology, offering clean and new self-drive cars, and focusing on customer satisfaction.
              </p>
              <p>
              We aim to be the most trusted name in car rentals in Ranchi, providing everything from compact hatchbacks to 7-seater SUVs — perfect for family road trips, weekend getaways, or business needs. Whether you're booking a car for a day or a month, we’re here to deliver freedom, flexibility, and a seamless rental journey.
              </p>
              <p>
               Because at Dream Drive, every journey matters — <span>and we’re here to make yours unforgettable.</span>
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <Achievements />
    </>
  );
};

export default About;
