import React, { useState, useEffect, useMemo, useRef } from "react";
import "./FleetCarousel.css";
import { useAdminContext } from "../../context/AdminContext";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faChevronLeft,
  faChevronRight,
  faCheck,
  faDoorOpen,
  faGasPump,
  faCalendarDays,
  faMagnifyingGlass,
  faSuitcase,
  faUserFriends,
} from "@fortawesome/free-solid-svg-icons";
import HowItWorks from "../HowItWorks/HowItWorks";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "../../ms/api";
import {
  filtersToSearchParams,
  dateToIsoAtHour,
  validateDateRange,
} from "../../ms/fleetSearch";

/**
 * Reference class strip labels → internal fleet type filters.
 * Visual labels match the mockup; filtering uses real inventory types.
 */
const CLASS_STRIP = [
  { label: "Economy", type: "Hatchback" },
  { label: "Intermediate", type: "Sedan" },
  { label: "Standard", type: "SUV" },
  { label: "Luxury", type: "Luxury" },
];

const BODY_TYPES = CLASS_STRIP.map((c) => c.type);

/** Verified Dream Drive offer points — layout matches reference checklist. */
const OFFER_INCLUDES = [
  "Transparent pricing",
  "Self-drive option",
  "Digital booking",
  "Quick pickup",
];

const ROAD_PRESENCE = "/fleet-road-presence.png";
const EASE = [0.22, 1, 0.36, 1];

/** Project-owned Cloudinary cutouts — used when API returns placeholders. */
const FLEET_ASSETS = {
  nexon:
    "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750168799/tata-nexon-right-front-three-quarter2-removebg-preview_lad5vy_gfkhzv.png",
  jeep:
    "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750163087/jeep_smrjsp.png",
  brezza:
    "https://res.cloudinary.com/dcrfks1tq/image/upload/v1751568965/maruti-suzuki-vitara-brezza-ldi-diesel-pearl-arctic-white-82811366-6pbqe-removebg-preview_pgoccl.png",
  sedan:
    "https://res.cloudinary.com/df10iqj1i/image/upload/v1766399135/24df9713-f67d-4f45-9da9-7ac8d7e124e8.png",
  generic:
    "https://res.cloudinary.com/dcrfks1tq/image/upload/v1750169101/test_QkNB2Ri_axzqkj.png",
};

const DEFAULT_CLASS_IMAGES = {
  Hatchback: FLEET_ASSETS.brezza,
  Sedan: FLEET_ASSETS.sedan,
  SUV: FLEET_ASSETS.nexon,
  Luxury: FLEET_ASSETS.jeep,
};

const categoryTypeMatches = (carType, category) => {
  const type = String(carType || "").toLowerCase();
  const cat = String(category || "").toLowerCase();
  if (!type || !cat) return false;
  if (type.includes(cat)) return true;
  if (cat === "hatchback" && (type.includes("hatch") || type.includes("economy")))
    return true;
  // Intermediate — sedan + family MPV when no pure sedans in inventory
  if (
    cat === "sedan" &&
    (type.includes("sedan") || type.includes("mpv") || type.includes("muv"))
  )
    return true;
  if (cat === "suv" && (type.includes("suv") || type.includes("crossover")))
    return true;
  if (cat === "muv" && (type.includes("mpv") || type.includes("muv"))) return true;
  if (cat === "luxury" && type.includes("luxury")) return true;
  return false;
};

/** Name-aware match so strip classes map to live inventory (e.g. Thar → Luxury). */
const categoryMatchesCar = (car, category) => {
  const type = car?.details?.type || car?.type || "";
  const name = String(car?.name || "").toLowerCase();
  const cat = String(category || "").toLowerCase();

  if (cat === "luxury") {
    return (
      categoryTypeMatches(type, "Luxury") ||
      /thar|fortuner|mercedes|bmw|audi|lexus/.test(name)
    );
  }
  if (cat === "suv") {
    // Keep premium SUVs under Luxury, not Standard
    if (/thar|fortuner|mercedes|bmw|audi|lexus/.test(name)) return false;
    return categoryTypeMatches(type, category);
  }
  return categoryTypeMatches(type, category);
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

const isPlaceholderUrl = (url) =>
  /placehold\.co|placeholder|via\.placeholder|dummyimage|picsum\.photos/i.test(
    String(url || "")
  );

const marketingImageForCar = (car) => {
  const name = String(car?.name || "").toLowerCase();
  const type = String(car?.details?.type || car?.type || "").toLowerCase();

  if (/nexon|tata/.test(name)) return FLEET_ASSETS.nexon;
  if (/thar|mahindra|jeep|wrangler|compass/.test(name)) return FLEET_ASSETS.jeep;
  if (/swift|brezza|baleno|wagon|alto|maruti|suzuki/.test(name))
    return FLEET_ASSETS.brezza;
  if (/innova|crysta|toyota|fortuner|sedan|city|ciaz/.test(name))
    return FLEET_ASSETS.sedan;

  if (/suv|crossover/.test(type)) return FLEET_ASSETS.nexon;
  if (/hatch|hatchback/.test(type)) return FLEET_ASSETS.brezza;
  if (/sedan/.test(type)) return FLEET_ASSETS.sedan;
  if (/mpv|muv|van/.test(type)) return FLEET_ASSETS.sedan;
  if (/luxury/.test(type)) return FLEET_ASSETS.jeep;

  return FLEET_ASSETS.generic;
};

const resolveCarImage = (car) => {
  const images = Array.isArray(car?.images) ? car.images : [];
  for (const entry of images) {
    if (!entry) continue;
    const url =
      typeof entry === "string"
        ? entry.trim()
        : entry.url
          ? String(entry.url).trim()
          : "";
    if (url && !isPlaceholderUrl(url)) return url;
  }
  return marketingImageForCar(car);
};

const FleetCarousel = () => {
  const { fetchCars } = useAdminContext();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const isCarsPage = location.pathname === "/cars";
  const catStripRef = useRef(null);

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState("Hatchback");
  const [brokenImages, setBrokenImages] = useState(() => new Set());
  const [currentPage, setCurrentPage] = useState(0);

  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [vehicleClass, setVehicleClass] = useState("Hatchback");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchError, setSearchError] = useState("");

  const itemsPerPage = 3;

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return `₹${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  useEffect(() => {
    api("/v1/public/cities")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCities(list);
        if (list[0]?.id) setCityId(list[0].id);
      })
      .catch(() => {});
  }, []);

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

  const filteredCars = useMemo(() => {
    return cars.filter((car) => categoryMatchesCar(car, activeType));
  }, [cars, activeType]);

  const displayCars = useMemo(() => {
    // If active class empty, fall back to full fleet so UI never looks broken
    return filteredCars.length > 0 ? filteredCars : cars;
  }, [filteredCars, cars]);

  const totalPages = Math.max(1, Math.ceil(displayCars.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(0);
  }, [activeType]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    if (loading || cars.length === 0) return;
    const hasActive = cars.some((car) => categoryMatchesCar(car, activeType));
    if (hasActive) return;
    const first = BODY_TYPES.find((cat) =>
      cars.some((car) => categoryMatchesCar(car, cat))
    );
    if (first) {
      setActiveType(first);
      setVehicleClass(first);
    }
  }, [cars, loading, activeType]);

  const pageCars = useMemo(
    () =>
      displayCars.slice(
        currentPage * itemsPerPage,
        currentPage * itemsPerPage + itemsPerPage
      ),
    [displayCars, currentPage, itemsPerPage]
  );

  const categoryImages = useMemo(() => {
    const map = {};
    for (const item of CLASS_STRIP) {
      const match = cars.find((car) => {
        if (!categoryMatchesCar(car, item.type)) return false;
        const url = resolveCarImage(car);
        return Boolean(url) && !brokenImages.has(url);
      });
      const fromCar = match ? resolveCarImage(match) : "";
      const fallback = DEFAULT_CLASS_IMAGES[item.type] || FLEET_ASSETS.generic;
      map[item.type] =
        fromCar && !brokenImages.has(fromCar) ? fromCar : fallback;
    }
    return map;
  }, [cars, brokenImages]);

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
    const seats = car.details?.seats != null && car.details?.seats !== ""
      ? String(car.details.seats).replace(/seater/i, "").trim()
      : null;
    const doors = car.details?.doors ? String(car.details.doors) : null;
    const bags = car.details?.bags || car.details?.luggage || null;
    const fuel = car.details?.fuel ? String(car.details.fuel) : null;
    const transmission = transmissionLabel(
      car.details?.transmission ?? car.details?.mt
    );
    const price = formatPrice(car.price);
    const year = car.details?.year || car.year || "";
    const available =
      car.available === "Available" ||
      car.available === true ||
      car.available === undefined;
    return {
      imageUrl,
      showImage,
      seats,
      doors,
      bags,
      fuel,
      transmission,
      price,
      year,
      isAvailable: available,
    };
  };

  const handleViewCar = (car) => {
    const slug = car.slug || car.urlSlug;
    if (slug) navigate(`/cars/${slug}`);
    else navigate("/fleet");
  };

  const selectClass = (type) => {
    setActiveType(type);
    setVehicleClass(type);
  };

  const handleQuickSearch = (e) => {
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
      rentalType: "SELF_DRIVE",
      type: vehicleClass ? String(vehicleClass).toLowerCase() : "",
    });
    navigate(`/fleet?${params.toString()}`);
  };

  const scrollCats = (dir) => {
    catStripRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  const resultCount =
    filteredCars.length > 0 ? filteredCars.length : cars.length;

  return (
    <>
      <section
        className="fleet-section"
        style={{ paddingTop: isCarsPage ? "3.5rem" : undefined }}
        aria-label="Explore the fleet"
      >
        <div className="fleet-wave" aria-hidden="true" />

        <div className="fleet-shell">
          <header className="fleet-intro">
            <p className="fleet-intro-eyebrow">Explore the fleet</p>
            <h2 className="fleet-intro-title">
              Choose the car that fits <em>your trip</em>
            </h2>
            <p className="fleet-intro-sub">
              Self-drive cars in Ranchi — search, filter, and book in minutes.
            </p>
          </header>

          <div className="fleet-grid">
            <aside className="fleet-aside">
              <form className="fleet-qs" onSubmit={handleQuickSearch}>
                <h3>Quick Search</h3>

                <label>
                  Location
                  <select
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
                </label>

                <label>
                  Vehicle Class
                  <select
                    value={vehicleClass}
                    onChange={(e) => selectClass(e.target.value)}
                  >
                    {CLASS_STRIP.map((c) => (
                      <option key={c.type} value={c.type}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="fleet-qs-row">
                  <label>
                    Pick-Up
                    <span className="fleet-qs-date">
                      <FontAwesomeIcon icon={faCalendarDays} />
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </span>
                  </label>
                  <label>
                    Return
                    <span className="fleet-qs-date">
                      <FontAwesomeIcon icon={faCalendarDays} />
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </span>
                  </label>
                </div>

                {searchError ? (
                  <p className="fleet-qs-err" role="alert">
                    {searchError}
                  </p>
                ) : null}

                <button type="submit" className="fleet-qs-btn">
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                  Search
                </button>
              </form>

              <div className="fleet-body">
                <h4>Body Type</h4>
                {BODY_TYPES.map((type) => (
                  <label key={type} className="fleet-body-item">
                    <input
                      type="checkbox"
                      checked={activeType === type}
                      onChange={() => selectClass(type)}
                    />
                    <i aria-hidden="true">
                      <FontAwesomeIcon icon={faCheck} />
                    </i>
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </aside>

            <div className="fleet-main">
              <header className="fleet-main-head">
                <h2>Search Results</h2>
                {!loading && cars.length > 0 ? (
                  <p>
                    found {resultCount} car{resultCount === 1 ? "" : "s"} for
                    your request
                  </p>
                ) : null}
              </header>

              <div className="fleet-classes">
                <button
                  type="button"
                  className="fleet-classes-arrow"
                  aria-label="Previous"
                  onClick={() => scrollCats(-1)}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <div className="fleet-classes-track" ref={catStripRef}>
                  {CLASS_STRIP.map((item) => {
                    const active = activeType === item.type;
                    const thumb = categoryImages[item.type];
                    return (
                      <button
                        key={item.type}
                        type="button"
                        className={`fleet-class ${
                          active ? "is-active" : ""
                        }`}
                        onClick={() => selectClass(item.type)}
                      >
                        <span className="fleet-class-pic">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              onError={() => markImageBroken(thumb)}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faCarSide} />
                          )}
                          {active ? (
                            <em>
                              <FontAwesomeIcon icon={faCheck} />
                            </em>
                          ) : null}
                        </span>
                        <span className="fleet-class-name">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="fleet-classes-arrow"
                  aria-label="Next"
                  onClick={() => scrollCats(1)}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>

              {loading ? (
                <div className="fleet-loading">
                  <div />
                  <div />
                </div>
              ) : cars.length === 0 ? (
                <div className="fleet-empty">
                  <p>Fleet coming soon</p>
                </div>
              ) : (
                <div className="fleet-list">
                  {pageCars.map((car, index) => {
                    const meta = getCarMeta(car);
                    return (
                      <motion.article
                        key={`${car.id}-${currentPage}`}
                        className="fleet-row"
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 12 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.35,
                          delay: reduceMotion ? 0 : index * 0.06,
                          ease: EASE,
                        }}
                      >
                        <div className="fleet-row-pic">
                          {meta.showImage ? (
                            <img
                              src={meta.imageUrl}
                              alt={car.name || "Vehicle"}
                              onError={() => markImageBroken(meta.imageUrl)}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faCarSide} />
                          )}
                        </div>

                        <div className="fleet-row-info">
                          <h3>
                            {car.name || "—"}
                            {meta.year ? <span>{meta.year}</span> : null}
                          </h3>

                          <ul className="fleet-row-specs">
                            {meta.seats ? (
                              <li>
                                <FontAwesomeIcon icon={faUserFriends} />
                                {meta.seats}
                              </li>
                            ) : null}
                            {meta.doors ? (
                              <li>
                                <FontAwesomeIcon icon={faDoorOpen} />
                                {meta.doors}
                              </li>
                            ) : null}
                            {meta.bags ? (
                              <li>
                                <FontAwesomeIcon icon={faSuitcase} />
                                {meta.bags}
                              </li>
                            ) : null}
                            {meta.fuel ? (
                              <li>
                                <FontAwesomeIcon icon={faGasPump} />
                                {meta.fuel}
                              </li>
                            ) : null}
                          </ul>

                          <div className="fleet-row-offer">
                            <p>This offer includes:</p>
                            <ul>
                              {OFFER_INCLUDES.map((item) => (
                                <li key={item}>
                                  <FontAwesomeIcon icon={faCheck} />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="fleet-row-buy">
                          {meta.price ? (
                            <>
                              <strong>{meta.price}</strong>
                              <span>per day</span>
                            </>
                          ) : (
                            <span>See details</span>
                          )}
                          <button
                            type="button"
                            disabled={!meta.isAvailable}
                            onClick={() => handleViewCar(car)}
                          >
                            {meta.isAvailable ? "Rent Now" : "Unavailable"}
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}

                  {totalPages > 1 ? (
                    <div className="fleet-pages">
                      <button
                        type="button"
                        aria-label="Previous page"
                        onClick={() =>
                          setCurrentPage((p) =>
                            p === 0 ? totalPages - 1 : p - 1
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </button>
                      <span>
                        {currentPage + 1}/{totalPages}
                      </span>
                      <button
                        type="button"
                        aria-label="Next page"
                        onClick={() =>
                          setCurrentPage((p) => (p + 1) % totalPages)
                        }
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <motion.div
            className="fleet-jeep-wrap"
            aria-hidden="true"
            initial={reduceMotion ? false : { opacity: 0, x: 80, scale: 0.92 }}
            whileInView={
              reduceMotion
                ? undefined
                : { opacity: 1, x: 0, scale: 1 }
            }
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.85,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="fleet-jeep-exhaust" aria-hidden="true">
              <i className="fleet-dust fleet-dust--base" />
              <i className="fleet-dust fleet-dust--1" />
              <i className="fleet-dust fleet-dust--2" />
              <i className="fleet-dust fleet-dust--3" />
              <i className="fleet-dust fleet-dust--4" />
            </span>
            <span className="fleet-jeep-ambient" />
            <span className="fleet-jeep-ground" />
            <motion.img
              src={ROAD_PRESENCE}
              alt=""
              className={`fleet-jeep${reduceMotion ? "" : " fleet-jeep--live"}`}
              whileHover={
                reduceMotion
                  ? undefined
                  : { scale: 1.04, y: -6, transition: { duration: 0.35 } }
              }
            />
          </motion.div>
        </div>
      </section>

      {isCarsPage && <HowItWorks />}
    </>
  );
};

export default FleetCarousel;
