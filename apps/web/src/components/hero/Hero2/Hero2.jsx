import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import "./Hero2.css";
import { useLocalContext } from "../../../context/LocalContext";

const CAR_BG = [
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png",
  "https://res.cloudinary.com/df10iqj1i/image/upload/v1766399135/24df9713-f67d-4f45-9da9-7ac8d7e124e8.png",
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png",
];

function go(navigate, link) {
  const href = link || "/fleet";
  if (/^https?:/i.test(href)) window.location.href = href;
  else navigate(href);
}

const Hero2 = () => {
  const navigate = useNavigate();
  const { heroBanner } = useLocalContext();
  const goFleet = () => go(navigate, heroBanner?.link);

  const cars = [
    CAR_BG[0],
    heroBanner?.imageUrl && !/dream[-_]?drive/i.test(heroBanner.imageUrl)
      ? heroBanner.imageUrl
      : CAR_BG[1],
    CAR_BG[2],
  ];

  return (
    <section className="hero2" aria-label="Dream Drive hero">
      <div className="hero2-bg" aria-hidden="true">
        <div className="hero2-bg-wash" />
        <div className="hero2-bg-cars">
          {cars.map((src, i) => (
            <img
              key={src}
              className={`hero2-bg-car hero2-bg-car--${i + 1}`}
              src={src}
              alt=""
            />
          ))}
        </div>
        <div className="hero2-bg-scrim" />
      </div>

      <div className="hero2-content">
        <h1 className="hero2-title">Weekend plans start with a car key.</h1>
        <p className="hero2-lead">
          {heroBanner?.body ||
            "Book a self-drive car in Ranchi — transparent rates, quick pickup, zero fuss."}
        </p>
        <div className="hero2-actions">
          <button type="button" className="hero2-cta" onClick={goFleet}>
            {heroBanner?.ctaText || "Find a car"}
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
          <button
            type="button"
            className="hero2-cta hero2-cta--ghost"
            onClick={() => navigate("/howitworks")}
          >
            See how it works
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero2;
