import React from "react";

import FleetCarousel from "../fleetCarousel/FleetCarousel";
import WhyChoose from "../whychooseus/WhyChooseUs";
import HowItWorks from "../HowItWorks/HowItWorks";
import Achievements from "../Achievements/Achievements";
import Contact from "../contact/Contact";
import Hero2 from "../hero/Hero2/Hero2";
import Testimonial from "../Testimonial/Testimonial";
import "./Home.css";
import { Helmet } from "react-helmet-async";
import { usePageSeoSuppression } from '../../utils/usePageSeoSuppression';

const Home = () => {
    usePageSeoSuppression(true);
  return (
    <div className="home">
     <Helmet>
        <title>Dream Drive | Ranchi’s Trusted Self-Drive Car Rentals</title>
        <meta
    name="description"
    content="Welcome to Dream Drive – Ranchi’s top choice for self-drive car rentals. Book SUVs like Nexon & Compass with flexible packages, 24x7 support, and doorstep delivery."
  />
   <meta
    property="og:title"
    content="Dream Drive | Self-Drive Car Rentals in Ranchi"
  />
      </Helmet>

      <Hero2 />
      <FleetCarousel />
      <WhyChoose />
      <HowItWorks />
      <Achievements />
      <Contact />
      <Testimonial />
    </div>
  );
};

export default Home;
