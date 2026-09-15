import React, { useState, useEffect, useRef, useMemo } from "react";
import "./FleetCarousel.css";
import { useAdminContext } from "../../context/AdminContext";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faArrowRight,
  faChevronLeft,
  faChevronRight,
  faStar,
  faUserFriends,
  faCogs,
  faGasPump,
} from "@fortawesome/free-solid-svg-icons";
import HowItWorks from "../HowItWorks/HowItWorks";
import { motion } from "framer-motion";

const FILTERS = ["All", "Hatchback", "Sedan", "SUV", "MUV", "Luxury"];
const DISCOVERY_CATEGORIES = ["Hatchback", "Sedan", "SUV", "MUV", "Luxury"];

const IMG_NEXON =
  "https://w0.peakpx.com/wallpaper/943/675/HD-wallpaper-tata-nexon-crossovers-2020-cars-studio-2020-tata-nexon-indian-cars-tata.jpg";
const IMG_TOYOTA =
  "https://images.pexels.com/photos/30287502/pexels-photo-30287502/free-photo-of-close-up-of-toyota-car-grille-with-raindrops.jpeg?cs=tinysrgb&dpr=1&w=500";
const IMG_SWIFT =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWFxiSE-Gr0dzYBhJ9W231pjACm_C03UjxJe5qU8WSnfbCroPOK-Xlzy8&s=10";
const IMG_THAR =
  "https://play-lh.googleusercontent.com/oYOUjAZasWlrlJQ2dahkIKND_90VTq1TWvJgdFTm44RiE3NQ4m6qPr5gNGFKKO93oSKkqSkrxBRkIwnm4zax";

/** Display image overrides for known fleet cars (Home showcase only). */
const FLEET_IMAGE_OVERRIDES = [
  { match: /tata\s*nexon/i, url: IMG_NEXON },
  { match: /toyota|innova/i, url: IMG_TOYOTA },
  { match: /maruti|swift/i, url: IMG_SWIFT },
  { match: /mahindra|thar/i, url: IMG_THAR },
];

/** Category strip fallbacks when no matching fleet car image exists. */
const CATEGORY_IMAGE_FALLBACKS = {
  Hatchback: IMG_SWIFT,
  Sedan: IMG_TOYOTA,
  SUV: IMG_NEXON,
  MUV: IMG_TOYOTA,
  Luxury: IMG_THAR,
};

const categoryTypeMatches = (carType, category) => {
  const type = String(carType || "").toLowerCase();
  const cat = String(category || "").toLowerCase();
  if (!type || !cat) return false;
  if (type.includes(cat)) return true;
  // Treat MPV and MUV as the same family for discovery thumbs
  if (cat === "muv" && (type.includes("mpv") || type.includes("muv"))) {
    return true;
  }
  if (cat === "suv" && type.includes("crossover")) return true;
  return false;
};

const isDiscountedCar = (car) => {
  const sale = Number(car?.salePrice);
  const price = Number(car?.price);
  return Number.isFinite(sale) && Number.isFinite(price) && sale > price;
};

const transmissionLabel = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value);
  if (raw.toUpperCase() === "YES") return "Manual";
  if (raw.toUpperCase() === "NO") return "Automatic";
  return raw;
};

const seatsLabel = (seats) => {
  if (seats === null || seats === undefined || seats === "") return null;
  const raw = String(seats);
  if (/seater/i.test(raw)) return raw;
  return `${raw} Seater`;
};

const fuelLabel = (fuel) => {
  if (fuel === null || fuel === undefined || fuel === "") return null;
  return String(fuel);
};

const resolveOverrideImage = (car) => {
  const name = String(car?.name || "");
  if (!name) return "";
  const hit = FLEET_IMAGE_OVERRIDES.find((entry) => entry.match.test(name));
  return hit?.url || "";
};

const resolveCarImage = (car) => {
  const override = resolveOverrideImage(car);
  if (override) return override;

  const images = Array.isArray(car?.images) ? car.images : [];
  for (const entry of images) {
    if (!entry) continue;
    if (typeof entry === "string" && entry.trim()) return entry.trim();
    if (typeof entry === "object" && entry.url && String(entry.url).trim()) {
      return String(entry.url).trim();
    }
  }
  return "";
};

const FleetCarousel = () => {
  const { fetchCars } = useAdminContext();
  const pricingVisible = true;

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [brokenImages, setBrokenImages] = useState(() => new Set());

  const itemsPerPage = 3;
  const navigate = useNavigate();
  const location = useLocation();
  const isCarsPage = location.pathname === "/cars";
  const intervalRef = useRef(null);
  const touchStartX = useRef(null);

  const formatPrice = (value) => {
    if (!pricingVisible) return null;
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const filteredCars = useMemo(() => {
    if (activeFilter === "All") return cars;
    return cars.filter((car) => {
      const type = String(car.details?.type || car.type || "").toLowerCase();
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

  const pageCars = useMemo(() => {
    return filteredCars.slice(
      currentPage * itemsPerPage,
      currentPage * itemsPerPage + itemsPerPage
    );
  }, [filteredCars, currentPage, itemsPerPage]);

  const featuredCar = pageCars[0] || null;
  const secondaryCars = pageCars.slice(1);

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

  const handleViewCar = (car) => {
    const slug = car.slug || car.urlSlug;
    if (slug) navigate(`/cars/${slug}`);
    else navigate("/fleet");
  };

  const markImageBroken = (url) => {
    if (!url) return;
    setBrokenImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const getCarMeta = (car) => {
    const imageUrl = resolveCarImage(car);
    const showImage = Boolean(imageUrl) && !brokenImages.has(imageUrl);
    const category = car.details?.type || car.type || "";
    const transmission = transmissionLabel(
      car.details?.transmission ?? car.details?.mt
    );
    const seats = seatsLabel(car.details?.seats);
    const fuel = fuelLabel(car.details?.fuel);
    const price = formatPrice(pricingVisible ? car.price : null);
    const specs = [seats, transmission, fuel].filter(Boolean);
    return {
      imageUrl,
      showImage,
      category,
      transmission,
      seats,
      fuel,
      price,
      specs,
      isAvailable: car.available === "Available",
    };
  };

  const pageLabel = String(currentPage + 1).padStart(2, "0");
  const totalLabel = String(totalPages).padStart(2, "0");

  const categoryImages = useMemo(() => {
    const map = {};
    for (const cat of DISCOVERY_CATEGORIES) {
      const match = cars.find((car) => {
        const type = car.details?.type || car.type || "";
        if (!categoryTypeMatches(type, cat)) return false;
        const url = resolveCarImage(car);
        return Boolean(url) && !brokenImages.has(url);
      });

      if (match) {
        map[cat] = {
          url: resolveCarImage(match),
          key: String(match.id),
        };
      } else {
        const fallback = CATEGORY_IMAGE_FALLBACKS[cat];
        if (fallback && !brokenImages.has(fallback)) {
          map[cat] = { url: fallback, key: `fallback-${cat}` };
        }
      }
    }
    return map;
  }, [cars, brokenImages]);

  const showEmptyState = !loading && cars.length === 0;
  const showFilterEmpty =
    !loading && cars.length > 0 && filteredCars.length === 0;

  const renderImage = (car, meta, variant) => {
    if (meta.showImage) {
      return (
        <img
          src={meta.imageUrl}
          alt={car.name || "Vehicle"}
          loading="lazy"
          className={`fleet-img fleet-img--${variant}`}
          onError={() => markImageBroken(meta.imageUrl)}
        />
      );
    }
    return (
      <div className={`fleet-placeholder fleet-placeholder--${variant}`}>
        <FontAwesomeIcon icon={faCarSide} />
        <span>Image unavailable</span>
      </div>
    );
  };

  return (
    <>
      <motion.section
        className="fleet-container"
        style={{ paddingTop: isCarsPage ? "3.5rem" : undefined }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        aria-label="Our fleet"
      >
        <div className="fleet-div">
          <header className="fleet-header">
            <div className="fleet-header-copy">
              <p className="fleet-eyebrow">Explore the fleet</p>
              <h2 className="fleet-title">
                Our Impressive <span>Fleet</span>
              </h2>
              <p className="fleet-subtitle">
                Self-drive cars ready for your next trip.
              </p>
            </div>
            {/* Trust strip omitted — no verified CMS claims available */}
          </header>

          <div className="fleet-toolbar">
            <div
              className="fleet-filters"
              role="tablist"
              aria-label="Car type filters"
            >
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

            {!loading && !showEmptyState && totalPages > 1 ? (
              <div className="fleet-pager" aria-label="Fleet navigation">
                <button
                  type="button"
                  className="fleet-pager-btn"
                  aria-label="Previous cars"
                  onClick={goToPrevPage}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <p className="fleet-pager-index">
                  <strong>{pageLabel}</strong>
                  <span> / {totalLabel}</span>
                </p>
                <button
                  type="button"
                  className="fleet-pager-btn"
                  aria-label="Next cars"
                  onClick={goToNextPage}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="fleet-skeleton" aria-hidden="true">
              <div className="fleet-skeleton-featured" />
              <div className="fleet-skeleton-side">
                <div className="fleet-skeleton-row" />
                <div className="fleet-skeleton-row" />
              </div>
            </div>
          ) : showEmptyState ? (
            <div className="fleet-empty-state">
              <div className="fleet-empty-state-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faCarSide} />
              </div>
              <h3>Fleet coming soon</h3>
              <p>Our fleet will appear here when vehicles are available.</p>
              <button
                type="button"
                className="fleet-empty-state-cta"
                onClick={() => navigate("/fleet")}
              >
                Explore Fleet
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          ) : showFilterEmpty ? (
            <p className="fleet-empty">No cars match this category.</p>
          ) : (
            <>
              <div
                className="fleet-showcase"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {featuredCar
                  ? (() => {
                      const meta = getCarMeta(featuredCar);
                      return (
                        <motion.article
                          key={`featured-${featuredCar.id}-${currentPage}`}
                          className={`fleet-featured ${
                            !meta.isAvailable
                              ? "fleet-featured--unavailable"
                              : ""
                          }`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.35 }}
                        >
                          <div className="fleet-featured-media">
                            {renderImage(featuredCar, meta, "featured")}
                            <div className="fleet-featured-shade" aria-hidden="true" />
                          </div>

                          <div className="fleet-featured-content">
                            {meta.category ? (
                              <p className="fleet-featured-category">
                                {meta.category}
                              </p>
                            ) : null}

                            <h3 className="fleet-featured-name">
                              {featuredCar.name || "—"}
                            </h3>

                            {meta.specs.length > 0 ? (
                              <ul className="fleet-featured-specs">
                                {meta.seats ? (
                                  <li>
                                    <FontAwesomeIcon icon={faUserFriends} />
                                    <span>{meta.seats}</span>
                                  </li>
                                ) : null}
                                {meta.transmission ? (
                                  <li>
                                    <FontAwesomeIcon icon={faCogs} />
                                    <span>{meta.transmission}</span>
                                  </li>
                                ) : null}
                                {meta.fuel ? (
                                  <li>
                                    <FontAwesomeIcon icon={faGasPump} />
                                    <span>{meta.fuel}</span>
                                  </li>
                                ) : null}
                              </ul>
                            ) : null}

                            <div className="fleet-featured-footer">
                              <div className="fleet-featured-price">
                                {meta.price ? (
                                  <>
                                    <p className="fleet-price-label">
                                      Starting from
                                    </p>
                                    <p className="fleet-price-value">
                                      {meta.price}
                                      <span>/day</span>
                                    </p>
                                  </>
                                ) : null}
                              </div>

                              {meta.isAvailable ? (
                                <button
                                  type="button"
                                  className="fleet-featured-cta"
                                  onClick={() => handleViewCar(featuredCar)}
                                >
                                  View Car
                                  <FontAwesomeIcon icon={faArrowRight} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="fleet-featured-cta fleet-featured-cta--disabled"
                                  disabled
                                >
                                  Not Available
                                </button>
                              )}
                            </div>
                          </div>

                          {totalPages > 1 ? (
                            <div
                              className="fleet-featured-dots"
                              aria-hidden="true"
                            >
                              {Array.from({
                                length: Math.min(totalPages, 6),
                              }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`fleet-dot ${
                                    i === currentPage % Math.min(totalPages, 6)
                                      ? "fleet-dot--active"
                                      : ""
                                  }`}
                                />
                              ))}
                            </div>
                          ) : null}
                        </motion.article>
                      );
                    })()
                  : null}

                {secondaryCars.length > 0 ? (
                  <aside className="fleet-secondary" aria-label="More vehicles">
                    {secondaryCars.map((car, index) => {
                      const meta = getCarMeta(car);
                      const metaLine = [
                        meta.category,
                        meta.seats,
                        meta.transmission,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <motion.button
                          key={`secondary-${car.id}-${currentPage}`}
                          type="button"
                          className={`fleet-secondary-card ${
                            !meta.isAvailable
                              ? "fleet-secondary-card--unavailable"
                              : ""
                          }`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.06 + index * 0.05,
                            duration: 0.3,
                          }}
                          onClick={() =>
                            meta.isAvailable ? handleViewCar(car) : undefined
                          }
                          disabled={!meta.isAvailable}
                        >
                          <div className="fleet-secondary-media">
                            {renderImage(car, meta, "secondary")}
                            <div
                              className="fleet-secondary-shade"
                              aria-hidden="true"
                            />
                          </div>

                          <div className="fleet-secondary-body">
                            <div className="fleet-secondary-copy">
                              <h4>{car.name || "—"}</h4>
                              {metaLine ? <p>{metaLine}</p> : null}
                              {meta.price ? (
                                <p className="fleet-secondary-price">
                                  {meta.price}
                                  <span>/day</span>
                                </p>
                              ) : null}
                            </div>

                            <span
                              className="fleet-secondary-arrow"
                              aria-hidden="true"
                            >
                              <FontAwesomeIcon icon={faArrowRight} />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </aside>
                ) : null}
              </div>

              <div className="fleet-discovery">
                <div className="fleet-discovery-intro">
                  <span className="fleet-discovery-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                  <div>
                    <p className="fleet-discovery-title">
                      Find the perfect car for every journey
                    </p>
                    <p className="fleet-discovery-sub">
                      Browse by category or view the full fleet.
                    </p>
                  </div>
                </div>

                <div className="fleet-discovery-cats">
                  {DISCOVERY_CATEGORIES.map((cat) => {
                    const thumb = categoryImages[cat];
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`fleet-discovery-cat ${
                          activeFilter === cat
                            ? "fleet-discovery-cat--active"
                            : ""
                        }`}
                        onClick={() => setActiveFilter(cat)}
                      >
                        <span
                          className="fleet-discovery-cat-icon"
                          aria-hidden="true"
                        >
                          {thumb ? (
                            <img
                              src={thumb.url}
                              alt=""
                              loading="lazy"
                              onError={() => markImageBroken(thumb.url)}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faCarSide} />
                          )}
                        </span>
                        <span className="fleet-discovery-cat-name">{cat}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="fleet-discovery-cta"
                  onClick={() => navigate("/fleet")}
                >
                  View all cars
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
              </div>

              {totalPages > 1 ? (
                <div className="fleet-pager fleet-pager--mobile">
                  <button
                    type="button"
                    className="fleet-pager-btn"
                    aria-label="Previous cars"
                    onClick={goToPrevPage}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <p className="fleet-pager-index">
                    <strong>{pageLabel}</strong>
                    <span> / {totalLabel}</span>
                  </p>
                  <button
                    type="button"
                    className="fleet-pager-btn"
                    aria-label="Next cars"
                    onClick={goToNextPage}
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </motion.section>

      {location.pathname === "/cars" && <HowItWorks />}
    </>
  );
};

export default FleetCarousel;
