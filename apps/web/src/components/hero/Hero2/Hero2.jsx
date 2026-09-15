import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCalendarDays,
  faLocationDot,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import "./Hero2.css";
import { useLocalContext } from "../../../context/LocalContext";
import { api } from "../../../ms/api";
import { RENTAL_TYPES, filtersToSearchParams, dateToIsoAtHour, validateDateRange } from "../../../ms/fleetSearch";

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
  
  // Real dynamic vehicle image from CMS heroBanner or project Cloudinary assets
  const featuredCarImage =
    heroBanner?.imageUrl && !/dream[-_]?drive/i.test(heroBanner.imageUrl)
      ? heroBanner.imageUrl
      : CAR_BG[1];

  // Dynamic Cities from API
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rentalType, setRentalType] = useState("SELF_DRIVE");
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    api("/v1/public/cities")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCities(list);
        if (list[0]?.id) setCityId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const goFleet = () => go(navigate, heroBanner?.link);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!cityId && cities.length > 0) {
      setSearchError("Please select a pickup city.");
      return;
    }
    const from = dateToIsoAtHour(fromDate, 10);
    const to = dateToIsoAtHour(toDate, 10);
    const err = validateDateRange(from, to);
    if (err) {
      setSearchError(err);
      return;
    }
    setSearchError("");
    const params = filtersToSearchParams({
      cityId,
      from,
      to,
      rentalType,
    });
    navigate(`/fleet?${params.toString()}`);
  };

  return (
    <section className="hero2-human" aria-label="Dream Drive Hero">
      <div className="hero2-human-container">
        
        {/* Unboxed 2-Column Hero Composition */}
        <div className="hero2-composition-row">
          
          {/* Left Column: CMS Copy & Core Hero Messaging */}
          <div className="hero2-copy-block">
            <div className="hero2-location-tag">
              <FontAwesomeIcon icon={faLocationDot} className="loc-icon" />
              <span>Ranchi & Surrounding Cities</span>
            </div>

            <h1 className="hero2-human-title">
              Rent the perfect car for <span className="title-highlight">any trip.</span>
            </h1>

            <p className="hero2-human-sub">
              {heroBanner?.body ||
                "Book a self-drive car in Ranchi — transparent rates, quick pickup, zero fuss."}
            </p>

            {/* Clean Secondary Actions */}
            <div className="hero2-actions-row">
              <button type="button" className="btn-primary-hero" onClick={goFleet}>
                <span>{heroBanner?.ctaText || "Find a car"}</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
              <button
                type="button"
                className="btn-secondary-hero"
                onClick={() => navigate("/howitworks")}
              >
                See how it works
              </button>
            </div>
          </div>

          {/* Right Column: Large Clean Vehicle Showcase (Unboxed, Part of Composition) */}
          <div className="hero2-visual-block">
            <img
              src={featuredCarImage}
              alt="Dream Drive Car Rental"
              className="hero2-large-car-img"
            />
          </div>

        </div>

        {/* Prominent Booking Search Module (First Viewport Integration) */}
        <div className="hero2-search-card-clean">
          <div className="search-bar-top">
            <div className="rental-type-toggle">
              {RENTAL_TYPES.slice(0, 2).map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`toggle-btn ${rentalType === type.value ? "toggle-active" : ""}`}
                  onClick={() => setRentalType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="search-perks">
              <span><FontAwesomeIcon icon={faCheck} className="perk-check" /> Transparent Rates</span>
              <span><FontAwesomeIcon icon={faCheck} className="perk-check" /> Quick Pickup</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="clean-search-form">
            <div className="input-field-group">
              
              {/* City Input */}
              <div className="clean-input-box">
                <label htmlFor="clean-city">
                  <FontAwesomeIcon icon={faLocationDot} className="box-icon" /> Pickup City
                </label>
                <select
                  id="clean-city"
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                >
                  {cities.length === 0 && <option value="">Ranchi</option>}
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div className="clean-input-box">
                <label htmlFor="clean-from">
                  <FontAwesomeIcon icon={faCalendarDays} className="box-icon" /> Pickup Date
                </label>
                <input
                  id="clean-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="clean-input-box">
                <label htmlFor="clean-to">
                  <FontAwesomeIcon icon={faCalendarDays} className="box-icon" /> Return Date
                </label>
                <input
                  id="clean-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

            </div>

            <button type="submit" className="btn-search-main">
              Search Cars <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </form>

          {searchError && <p className="search-error-msg">{searchError}</p>}
        </div>

      </div>
    </section>
  );
};

export default Hero2;
