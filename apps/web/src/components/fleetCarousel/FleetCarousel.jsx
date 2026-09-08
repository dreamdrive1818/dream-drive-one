import React, { useState, useEffect, useRef, useMemo } from "react";
import "./FleetCarousel.css";
import { useAdminContext } from "../../context/AdminContext";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faUserFriends,
  faGasPump,
  faCogs,
  faStar,
  faLeaf,
  faHeart,
  faArrowRight,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { ClipLoader } from "react-spinners";
import HowItWorks from "../HowItWorks/HowItWorks";
import { motion } from "framer-motion";

const FILTERS = ["All", "Hatchback", "Sedan", "SUV", "MUV", "Luxury"];

const CARD_BADGES = [
  { label: "Popular", icon: faStar, tone: "popular" },
  { label: "Spacious", icon: faUserFriends, tone: "spacious" },
  { label: "Budget Friendly", icon: faLeaf, tone: "budget" },
];

const CAR_CUTOUTS = [
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png",
  "https://res.cloudinary.com/df10iqj1i/image/upload/v1766399135/24df9713-f67d-4f45-9da9-7ac8d7e124e8.png",
  "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png",
];

function resolveCarImage(car, index = 0) {
  const name = car?.name || "";
  if (/nexon/i.test(name)) return CAR_CUTOUTS[0];
  if (/innova|crysta/i.test(name)) return CAR_CUTOUTS[1];
  if (/swift|baleno|i20|wagon|alto|dzire/i.test(name)) return CAR_CUTOUTS[2];
  return CAR_CUTOUTS[index % CAR_CUTOUTS.length];
}

const isDiscountedCar = (car) => {
  const sale = Number(car?.salePrice);
  const price = Number(car?.price);
  return Number.isFinite(sale) && Number.isFinite(price) && sale > price;
};

const transmissionLabel = (mt) => {
  if (!mt) return "—";
  if (String(mt).toUpperCase() === "YES") return "Manual";
  if (String(mt).toUpperCase() === "NO") return "Automatic";
  return mt;
};

const seatsLabel = (seats) => {
  if (!seats) return "—";
  const raw = String(seats);
  if (/seater/i.test(raw)) return raw;
  return `${raw} Seater`;
};

const FleetCarousel = () => {
  const { fetchCars } = useAdminContext();
  const pricingVisible = true;

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(
    window.innerWidth > 768 && window.innerWidth <= 1100
  );
  const [activeFilter, setActiveFilter] = useState("All");
  const [wishlist, setWishlist] = useState(() => new Set());

  const itemsPerPage = isMobile ? 1 : isTablet ? 2 : 3;
  const navigate = useNavigate();
  const location = useLocation();
  const isCarsPage = location.pathname === "/cars";
  const intervalRef = useRef(null);
  const touchStartX = useRef(null);

  const formatPrice = (value) => {
    if (!pricingVisible) return "—";
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return "—";
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const filteredCars = useMemo(() => {
    if (activeFilter === "All") return cars;
    return cars.filter((car) => {
      const type = String(car.details?.type || "").toLowerCase();
      return type.includes(activeFilter.toLowerCase());
    });
  }, [cars, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCars.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(0);
  }, [activeFilter]);

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
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w <= 768);
      setIsTablet(w > 768 && w <= 1100);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startAutoSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isHovering && totalPages > 1) {
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
  }, [totalPages, isHovering, filteredCars.length]);

  const paginatedCars = useMemo(() => {
    return filteredCars.slice(
      currentPage * itemsPerPage,
      currentPage * itemsPerPage + itemsPerPage
    );
  }, [filteredCars, currentPage, itemsPerPage]);

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
    const slug = car.slug || car.urlSlug;
    if (slug) navigate(`/cars/${slug}`);
    else navigate("/fleet");
  };

  const toggleWish = (id) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <motion.section
        className="fleet-container"
        style={{ paddingTop: isCarsPage ? "4rem" : undefined }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        aria-label="Our fleet"
      >
        <div className="fleet-bg" aria-hidden="true" />

        <div className="fleet-div">
          <div className="fleet-heading-row">
            <div className="fleet-header">
              <span className="fleet-offer-badge">
                <FontAwesomeIcon icon={faCarSide} />
                Monsoon Deals Are Live
              </span>

              <h2 className="fleet-title">
                Our Impressive <span>Fleet</span>
              </h2>

              <p className="fleet-subtitle">
                Save on selected self-drive cars this season.
              </p>
            </div>
          </div>

          <div className="fleet-filters" role="tablist" aria-label="Car type filters">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                className={`fleet-filter ${
                  activeFilter === filter ? "fleet-filter--active" : ""
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="fleet-spinner">
              <ClipLoader size={64} color="#0a5658" />
            </div>
          ) : (
            <>
              <div
                className="fleet-carousel-wrapper"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <button
                  type="button"
                  className="fleet-arrow fleet-arrow--left"
                  aria-label="Previous cars"
                  onClick={goToPrevPage}
                  disabled={totalPages <= 1}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <div className="fleet-cards">
                  {paginatedCars.length === 0 ? (
                    <p className="fleet-empty">No cars available right now.</p>
                  ) : null}

                  {paginatedCars.map((car, index) => {
                    const absoluteIndex = currentPage * itemsPerPage + index;
                    const isAvailable = car.available === "Available";
                    const badge = CARD_BADGES[absoluteIndex % CARD_BADGES.length];
                    const wished = wishlist.has(car.id);

                    return (
                      <motion.article
                        key={car.id}
                        className={`fleet-card ${
                          !isAvailable ? "fleet-card--unavailable" : ""
                        }`}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08, duration: 0.45 }}
                      >
                        <div className="fleet-card-media">
                          <img
                            src={resolveCarImage(car, absoluteIndex)}
                            alt={car.name}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = CAR_CUTOUTS[0];
                            }}
                          />

                          <span
                            className={`fleet-card-badge fleet-card-badge--${badge.tone}`}
                          >
                            <FontAwesomeIcon icon={badge.icon} />
                            {badge.label}
                          </span>

                          <button
                            type="button"
                            className={`fleet-wish ${wished ? "fleet-wish--on" : ""}`}
                            aria-label={
                              wished ? "Remove from wishlist" : "Add to wishlist"
                            }
                            onClick={() => toggleWish(car.id)}
                          >
                            <FontAwesomeIcon
                              icon={wished ? faHeart : faHeartRegular}
                            />
                          </button>
                        </div>

                        <div className="fleet-card-body">
                          <div className="fleet-card-heading">
                            <h3>{car.name}</h3>
                            <p>{car.details?.type || "Car"}</p>
                          </div>

                          <ul className="fleet-card-specs">
                            <li>
                              <FontAwesomeIcon icon={faUserFriends} />
                              <span>{seatsLabel(car.details?.seats)}</span>
                            </li>
                            <li>
                              <FontAwesomeIcon icon={faCogs} />
                              <span>{transmissionLabel(car.details?.mt)}</span>
                            </li>
                            <li>
                              <FontAwesomeIcon icon={faGasPump} />
                              <span>{car.details?.fuel || "—"}</span>
                            </li>
                          </ul>

                          <div className="fleet-card-footer">
                            <div className="fleet-price-block">
                              <p className="fleet-price-label">Starting at</p>
                              <p className="fleet-price-value">
                                {formatPrice(
                                  pricingVisible ? car.price : null
                                )}
                                <span>/day</span>
                              </p>
                            </div>

                            {isAvailable ? (
                              <button
                                type="button"
                                className="fleet-rent-btn"
                                onClick={() => handleRent(car)}
                              >
                                Rent Now
                                <FontAwesomeIcon icon={faArrowRight} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="fleet-rent-btn fleet-rent-btn--disabled"
                                disabled
                              >
                                Not Available
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="fleet-arrow fleet-arrow--right"
                  aria-label="Next cars"
                  onClick={goToNextPage}
                  disabled={totalPages <= 1}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {location.pathname === "/cars" && <HowItWorks />}
    </>
  );
};

export default FleetCarousel;
