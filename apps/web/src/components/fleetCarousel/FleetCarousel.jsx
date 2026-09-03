import React, { useState, useEffect, useRef, useMemo } from "react";
import "./FleetCarousel.css";
import { useAdminContext } from "../../context/AdminContext";
import { useOrderContext } from "../../context/OrderContext";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faUserFriends,
  faSuitcaseRolling,
  faGasPump,
  faCogs,
} from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners";
import HowItWorks from "../HowItWorks/HowItWorks";
import { motion } from "framer-motion";
import { useLocalContext } from "../../context/LocalContext";

const isDiscountedCar = (car) => {
  const sale = Number(car?.salePrice);
  const price = Number(car?.price);
  return Number.isFinite(sale) && Number.isFinite(price) && sale > price;
};

const FleetCarousel = () => {
  const { fetchCars } = useAdminContext();
  const { promoBanner, stripBanner } = useLocalContext();
  const offerLabel = promoBanner?.title || stripBanner?.title || "Offers";
  const { handleOrder } = useOrderContext();

  const pricingVisible = true;

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const itemsPerPage = isMobile ? 1 : 3;
  const navigate = useNavigate();
  const location = useLocation();
  const isCarsPage = location.pathname === "/cars";
  const intervalRef = useRef(null);
  const touchStartX = useRef(null);

  const formatPrice = (value, { withDecimals = false } = {}) => {
    if (!pricingVisible) return "—";
    if (value === null || value === undefined || value === "") return "—";

    const num = Number(value);
    if (Number.isNaN(num)) return "—";

    return withDecimals ? `₹${num.toFixed(2)}` : `₹${num}`;
  };

  const dealCount = useMemo(
    () => cars.filter(isDiscountedCar).length,
    [cars]
  );

  const totalPages = Math.max(1, Math.ceil(cars.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    const loadCars = async () => {
      try {
        const carData = await fetchCars();
        const discountPct = (car) => {
          const sale = Number(car.salePrice);
          const price = Number(car.price);
          return ((sale - price) / sale) * 100;
        };
        const sortedCars = [...(carData || [])].sort((a, b) => {
          const aDisc = isDiscountedCar(a);
          const bDisc = isDiscountedCar(b);
          if (aDisc !== bDisc) return aDisc ? -1 : 1;
          if (aDisc && bDisc) return discountPct(b) - discountPct(a);
          return (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999);
        });
        setCars(sortedCars);
      } catch (err) {
        console.error("Failed to load fleet cars:", err);
        setCars([]);
      } finally {
        setLoading(false);
      }
    };
    loadCars();
  }, [fetchCars]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startAutoSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isHovering && totalPages > 0) {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }
    }, 6000);
  };

  useEffect(() => {
    if (totalPages > 1) {
      startAutoSlide();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [totalPages, isHovering]);

  const paginatedCars = useMemo(() => {
    return cars.slice(
      currentPage * itemsPerPage,
      currentPage * itemsPerPage + itemsPerPage
    );
  }, [cars, currentPage, itemsPerPage]);

  const goToPrevPage = () => {
    setCurrentPage((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
    startAutoSlide();
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
    startAutoSlide();
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null || totalPages <= 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) goToNextPage();
    else goToPrevPage();
  };

  const handleRent = (car) => {
    handleOrder(car);
    navigate("/order");
  };

  return (
    <>
      <motion.div
        className="fleet-container"
        style={{ paddingTop: isCarsPage ? "2rem" : "8rem" }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="fleet-div">
          <div className="fleet-header">
            {promoBanner || stripBanner ? (
              <span className="monsoon-section-tag">{offerLabel}</span>
            ) : null}
            <h4>THE CARS</h4>
            <h2>Our Impressive Fleet</h2>
            <p className="fleet-subtitle">
              {promoBanner?.body ||
                stripBanner?.body ||
                "Self-drive and chauffeur cars for city trips, weekends, and longer drives."}
            </p>
            {dealCount > 0 ? (
              <div className="fleet-deal-legend">
                <span className="fleet-deal-legend__swatch" />
                <span>
                  Highlighted cards are live deals ({dealCount}{" "}
                  available)
                </span>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="fleet-spinner">
              <ClipLoader size={75} color="#0e7c86" />
            </div>
          ) : (
            <>
              {isMobile && totalPages > 1 && (
                <div className="fleet-mobile-pager">
                  <button
                    type="button"
                    className="carousel-arrow left"
                    aria-label="Previous cars"
                    onClick={goToPrevPage}
                  >
                    &#8249;
                  </button>
                  <span className="carousel-page-label" aria-live="polite">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="carousel-arrow right"
                    aria-label="Next cars"
                    onClick={goToNextPage}
                  >
                    &#8250;
                  </button>
                </div>
              )}

              <div
                className="fleet-carousel-wrapper"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {!isMobile && totalPages > 1 && (
                  <button
                    type="button"
                    className="carousel-arrow left"
                    aria-label="Previous cars"
                    onClick={goToPrevPage}
                  >
                    &#8249;
                  </button>
                )}

                <div className="fleet-cards">
                  {paginatedCars.length === 0 ? (
                    <p className="fleet-empty">No cars available right now.</p>
                  ) : null}
                  {paginatedCars.map((car, index) => {
                    const absoluteIndex = currentPage * itemsPerPage + index;
                    const isAvailable = car.available === "Available";
                    const hasDiscount = pricingVisible && isDiscountedCar(car);
                    const saleNum = Number(car?.salePrice);
                    const priceNum = Number(car?.price);
                    const discountPercent = hasDiscount
                      ? Math.round(((saleNum - priceNum) / saleNum) * 100)
                      : 0;
                    const savings = hasDiscount ? saleNum - priceNum : 0;

                    return (
                      <motion.div
                        key={car.id}
                        className={[
                          "fleet-card",
                          hasDiscount ? "fleet-card--deal" : "fleet-card--regular",
                          !isAvailable ? "fleet-card-unavailable" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onMouseEnter={() => {
                          setHoveredIndex(absoluteIndex);
                          setIsHovering(true);
                        }}
                        onMouseLeave={() => {
                          setHoveredIndex(null);
                          setIsHovering(false);
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.2, duration: 0.6 }}
                      >
                        {hasDiscount ? (
                          <div className="fleet-deal-ribbon" aria-hidden="true">
                            {offerLabel}
                          </div>
                        ) : null}

                        <div className="fleet-card-top">
                          {hasDiscount ? (
                            <span className="fleet-discount-badge">
                              {discountPercent}% OFF
                            </span>
                          ) : null}
                          <div
                            className={`fleet-card-media ${
                              hasDiscount ? "fleet-card-media--deal" : ""
                            }`}
                          >
                            {car.images?.[0] ? (
                              <img src={car.images[0]} alt={car.name} />
                            ) : (
                              <div className="fleet-card-placeholder">
                                Image coming soon
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="fleet-card-bot">
                          <div className="fleet-card-bot-name">
                            {hasDiscount ? (
                              <span className="fleet-deal-chip">Sale live</span>
                            ) : null}
                            <h3>{car.name}</h3>
                            {car.details?.type ? (
                              <p className="fleet-card-type">{car.details.type}</p>
                            ) : null}
                          </div>

                          <div className="fleet-card-bot-section">
                            <div className="fleet-price-block">
                              <p className="fleet-price-label">
                                {hasDiscount ? "Deal price" : "Starting at"}
                              </p>
                              <span className="fleet-price-row">
                                {hasDiscount ? (
                                  <span className="fleet-sale-price">
                                    {formatPrice(car.salePrice)}
                                  </span>
                                ) : null}
                                <span
                                  className={`fleet-discount-price ${
                                    hasDiscount ? "fleet-discount-price--deal" : ""
                                  }`}
                                >
                                  {formatPrice(car?.price)}
                                </span>
                              </span>
                              {hasDiscount ? (
                                <span className="fleet-save-note">
                                  You save ₹{savings}
                                </span>
                              ) : null}
                            </div>

                            {isAvailable ? (
                              <button
                                className={
                                  hasDiscount ? "fleet-btn--deal" : undefined
                                }
                                onClick={() => handleRent(car)}
                              >
                                {hasDiscount ? "Grab Deal" : "Rent"}
                              </button>
                            ) : (
                              <button className="not-available-btn" disabled>
                                Not Available
                              </button>
                            )}
                          </div>
                        </div>

                        <div
                          className={`car-hover-info ${
                            hoveredIndex === absoluteIndex
                              ? "car-hover-info-show"
                              : ""
                          }`}
                        >
                          <div className="hover-top">
                            <div>
                              <strong>{formatPrice(car?.twelveHrWeekday)}</strong>
                              <p>12 Hr (Weekday)</p>
                            </div>
                            <div>
                              <strong>
                                {formatPrice(car?.twentyFourHrWeekday)}
                              </strong>
                              <p>24 Hr (Weekday)</p>
                            </div>
                            <div>
                              <strong>
                                {pricingVisible
                                  ? car?.details?.extraHr || "—"
                                  : "—"}
                              </strong>
                              <p>Extra Hr</p>
                            </div>
                          </div>

                          <div className="hover-bottom">
                            <div>
                              <FontAwesomeIcon icon={faCarSide} />
                              <p>{car.details?.type || "—"}</p>
                            </div>
                            <div>
                              <FontAwesomeIcon icon={faUserFriends} />
                              <p>{car.details?.seats || "—"}</p>
                            </div>
                            <div>
                              <FontAwesomeIcon icon={faSuitcaseRolling} />
                              <p>{car.details?.luggage || "—"}</p>
                            </div>
                            <div>
                              <FontAwesomeIcon icon={faGasPump} />
                              <p>{car.details?.fuel || "—"}</p>
                            </div>
                            <div>
                              <FontAwesomeIcon icon={faCogs} />
                              <p>{car.details?.mt || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {!isMobile && totalPages > 1 && (
                  <button
                    type="button"
                    className="carousel-arrow right"
                    aria-label="Next cars"
                    onClick={goToNextPage}
                  >
                    &#8250;
                  </button>
                )}
              </div>

              {!isMobile && totalPages > 1 && (
                <div className="carousel-dots">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={i === currentPage ? "active" : ""}
                      onClick={() => {
                        setCurrentPage(i);
                        startAutoSlide();
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {location.pathname === "/cars" && <HowItWorks />}
    </>
  );
};

export default FleetCarousel;
