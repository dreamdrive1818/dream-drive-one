import React from "react";
import { useNavigate } from "react-router-dom";
import "./Hero2.css";

const RainDrops = () => (
  <div className="monsoon-rain" aria-hidden="true">
    {Array.from({ length: 10 }).map((_, i) => (
      <span key={i} />
    ))}
  </div>
);

const Hero2 = () => {
  const navigate = useNavigate();

  const handleNavigate = () => navigate("/cars");

  return (
    <section className="hero-banner">
      <RainDrops />
      <div className="hero-content reveal-bottom">
        <div className="monsoon-hero-pill">
          Monsoon Sale · Save on self-drive <strong>now</strong>
        </div>

        <h1>
          Drive Your <span className="highlight">Freedom!</span>
          <br />
          Choose <span className="highlight">Rent</span> or{" "}
          <span className="highlight">Self Drive</span> – The Car is Yours
        </h1>

        <p className="hero-subtitle">
          Rain or shine — book discounted self-drive cars for weekends,
          business trips, and city rides across Ranchi.
        </p>

        <div className="hero-buttons">
          <button className="btn-rent" onClick={handleNavigate}>
            View Monsoon Deals
          </button>
          <button className="btn-self" onClick={handleNavigate}>
            Self Drive
          </button>
        </div>

        <div className="car-showcase">
          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png"
            className="left-car fade-in-bottom delay-2"
            alt="Left Car"
          />
          <img
            src="https://res.cloudinary.com/df10iqj1i/image/upload/v1766399135/24df9713-f67d-4f45-9da9-7ac8d7e124e8.png"
            className="center-car fade-in-bottom delay-3"
            alt="Jeep Compass Limited 2024"
          />
          <img
            src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png"
            className="right-car fade-in-bottom delay-4"
            alt="Tata Nexon Dark Edition 2023"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero2;
