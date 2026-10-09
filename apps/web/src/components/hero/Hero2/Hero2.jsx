import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCalendarDays,
  faCarSide,
  faLocationDot,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";
import "./Hero2.css";
import { useLocalContext } from "../../../context/LocalContext";
import { api } from "../../../ms/api";
import {
  RENTAL_TYPES,
  filtersToSearchParams,
  dateToIsoAtHour,
  validateDateRange,
  defaultSearchDates,
  localDateYmd,
} from "../../../ms/fleetSearch";
import {
  lookupPickup,
  matchCityFromPlace,
  pickupCityMismatch,
  requestLiveCoords,
} from "../../../ms/livePickup";

/** Project-owned scenic hero stage (marketing asset in /public). */
const HERO_STAGE = "/hero-road-presence.jpg";

const EASE = [0.22, 1, 0.36, 1];

function go(navigate, link) {
  const href = link || "/fleet";
  if (/^https?:/i.test(href)) window.location.href = href;
  else navigate(href);
}

const Hero2 = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const heroRef = useRef(null);
  const { heroBanner, webinfo } = useLocalContext();

  const stageImage =
    heroBanner?.imageUrl &&
    !/dream[-_]?drive/i.test(heroBanner.imageUrl) &&
    !/\.png(\?|$)/i.test(heroBanner.imageUrl)
      ? heroBanner.imageUrl
      : HERO_STAGE;

  const defaults = defaultSearchDates();
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [pickupPlace, setPickupPlace] = useState("");
  const [locBusy, setLocBusy] = useState(true);
  const [locMsg, setLocMsg] = useState("");
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [rentalType, setRentalType] = useState("SELF_DRIVE");
  const [searchError, setSearchError] = useState("");
  const cityTouched = useRef(false);
  const todayMin = localDateYmd(0);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const stageY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 18]
  );
  const stageScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1, 1.05]
  );
  const copyParallax = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, -8]
  );

  useEffect(() => {
    let cancelled = false;
    setLocBusy(true);
    const citiesPromise = api("/v1/public/cities")
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .catch(() => []);
    const coordsPromise = requestLiveCoords().catch((err) => err);

    Promise.all([citiesPromise, coordsPromise]).then(async ([list, coordsOrErr]) => {
      if (cancelled) return;
      setCities(list);
      const denied = coordsOrErr instanceof Error || !coordsOrErr?.latitude;
      if (denied) {
        setLocMsg(
          coordsOrErr instanceof Error
            ? coordsOrErr.message
            : "Could not read your location."
        );
        setLocBusy(false);
        return;
      }
      try {
        const { place, city } = await lookupPickup(coordsOrErr, list);
        if (cancelled) return;
        const inferred = city || matchCityFromPlace(list, place);
        if (place) setPickupPlace(place);
        cityTouched.current = false;
        if (inferred?.id) {
          setCityId(inferred.id);
          setLocMsg("");
        } else {
          setLocMsg("Pickup location is set. Choose the nearest city we serve.");
        }
      } catch (err) {
        if (cancelled) return;
        setLocMsg(err?.message || "Could not turn that location into an address.");
      } finally {
        if (!cancelled) setLocBusy(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const goFleet = () => go(navigate, heroBanner?.link);

  const cityMismatch = pickupCityMismatch(cities, pickupPlace, cityId);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!cityId && cities.length > 0) {
      setSearchError("Please select a pickup city.");
      return;
    }
    if (cityMismatch) {
      setSearchError(cityMismatch);
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
      pickupPlace,
      from,
      to,
      rentalType,
    });
    params.set("go", "1");
    navigate(`/fleet?${params.toString()}`);
  };

  const eyebrow =
    webinfo?.seo?.tagline || "Ranchi’s trusted self-drive car rentals";
  const headline =
    heroBanner?.title || "Rent the perfect car for any trip.";
  const subcopy =
    heroBanner?.body ||
    "Explore Ranchi with comfort, freedom and transparent rates. Self-drive cars for every journey — city, outstation or weekend getaways.";
  const ctaLabel = heroBanner?.ctaText || "Browse cars";

  const fadeUp = (delay, y = 20) =>
    reduceMotion
      ? { initial: false, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  const headlineParts = (() => {
    const text = String(headline);
    const match = text.match(/^(.*?)(any trip\.?)(.*)$/i);
    if (match) {
      return [
        ...String(match[1])
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => ({ text: w, accent: false })),
        { text: match[2], accent: true },
        ...String(match[3])
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => ({ text: w, accent: false })),
      ];
    }
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.map((w, i) => ({
      text: w,
      accent: i === words.length - 1,
    }));
  })();

  const railItems = ["Cars", "People", "Places", "Better", "Journeys"];

  return (
    <section ref={heroRef} className="hero2-v2" aria-label="Dream Drive Hero">
      <div className="hero2-v2-shell">
        <div className="hero2-v2-stage">
          <motion.div
            className="hero2-v2-copy"
            style={reduceMotion ? undefined : { y: copyParallax }}
          >
            <motion.p className="hero2-v2-eyebrow" {...fadeUp(0.02, 10)}>
              <motion.span
                className="hero2-v2-eyebrow-line"
                aria-hidden="true"
                initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
              />
              {eyebrow}
            </motion.p>

            <h1 className="hero2-v2-title">
              <span className="hero2-v2-title-sr">{headline}</span>
              <span className="hero2-v2-title-anim" aria-hidden="true">
                {headlineParts.map((part, i) => (
                  <motion.span
                    key={`${part.text}-${i}`}
                    className={`hero2-v2-word${part.accent ? " hero2-accent" : ""}`}
                    initial={
                      reduceMotion
                        ? false
                        : { opacity: 0, y: 26 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.55,
                      delay: reduceMotion ? 0 : 0.1 + i * 0.06,
                      ease: EASE,
                    }}
                  >
                    {part.text}
                    {i < headlineParts.length - 1 ? "\u00A0" : ""}
                  </motion.span>
                ))}
              </span>
            </h1>

            <motion.p className="hero2-v2-sub" {...fadeUp(0.28)}>
              {subcopy}
            </motion.p>

            <motion.div className="hero2-v2-actions" {...fadeUp(0.36)}>
              <motion.button
                type="button"
                className="hero2-v2-primary"
                onClick={goFleet}
                whileHover={reduceMotion ? undefined : { scale: 1.03, y: -2 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                {ctaLabel}
                <FontAwesomeIcon icon={faArrowRight} className="hero2-v2-cta-arrow" />
              </motion.button>

              <div className="hero2-v2-how">
                <motion.button
                  type="button"
                  className="hero2-v2-link"
                  onClick={() => navigate("/howitworks")}
                  whileHover={reduceMotion ? undefined : { x: 3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <motion.span
                    className="hero2-v2-link-icon"
                    aria-hidden="true"
                    whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </motion.span>
                  See how it works
                </motion.button>
                <span className="hero2-v2-how-note">
                  Simple. Fast. Hassle-free.
                </span>
              </div>
            </motion.div>

            <motion.div
              className="hero2-v2-journeys"
              aria-hidden="true"
              {...fadeUp(0.44, 14)}
            >
              <div className="hero2-v2-avatars">
                {["a", "b", "c"].map((key, i) => (
                  <motion.span
                    key={key}
                    className={`hero2-v2-avatar hero2-v2-avatar--${key}`}
                    initial={
                      reduceMotion ? false : { opacity: 0, scale: 0.6, x: -8 }
                    }
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: reduceMotion ? 0 : 0.48 + i * 0.08,
                      ease: EASE,
                    }}
                  />
                ))}
              </div>
              <motion.span
                className="hero2-v2-journeys-script"
                initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.5,
                  delay: reduceMotion ? 0 : 0.72,
                  ease: EASE,
                }}
              >
                More journeys ahead
              </motion.span>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero2-v2-visual"
            style={
              reduceMotion ? undefined : { y: stageY, scale: stageScale }
            }
            initial={
              reduceMotion ? false : { opacity: 0, x: 48 }
            }
            animate={{
              opacity: 1,
              x: 0,
            }}
            transition={{
              duration: 0.85,
              delay: reduceMotion ? 0 : 0.08,
              ease: EASE,
            }}
          >
            <div className="hero2-v2-visual-frame">
              <motion.img
                src={stageImage}
                alt="Self-drive car ready for the road"
                className="hero2-v2-stage-img"
                initial={reduceMotion ? false : { scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.2, delay: 0.1, ease: EASE }}
              />
              <div className="hero2-v2-visual-shade" aria-hidden="true" />
              <div className="hero2-v2-visual-sheen" aria-hidden="true" />
            </div>

            <div className="hero2-v2-rail" aria-hidden="true">
              {railItems.map((label, i) => (
                <motion.span
                  key={label}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: reduceMotion ? 0 : 0.55 + i * 0.06,
                    ease: EASE,
                  }}
                >
                  {label}
                </motion.span>
              ))}
              <motion.i
                initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: reduceMotion ? 0 : 0.9,
                  ease: EASE,
                }}
              />
              <motion.strong
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.45,
                  delay: reduceMotion ? 0 : 0.98,
                  ease: EASE,
                }}
              >
                Explore Ranchi further
              </motion.strong>
            </div>

            <motion.p
              className="hero2-v2-signature"
              aria-hidden="true"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: reduceMotion ? 0 : 1.05,
                ease: EASE,
              }}
            >
              Same Roads New Stories
            </motion.p>
          </motion.div>
        </div>

        <motion.form
          onSubmit={handleSearch}
          className="hero2-v2-search"
          aria-label="Search cars"
          initial={
            reduceMotion ? false : { opacity: 0, y: 36, scale: 0.985 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6,
            delay: reduceMotion ? 0 : 0.42,
            ease: EASE,
          }}
        >
          {[
            {
              id: "hero2-place",
              label: (
                <>
                  <FontAwesomeIcon icon={faLocationDot} /> Pickup location
                </>
              ),
              control: (
                <input
                  id="hero2-place"
                  value={pickupPlace}
                  placeholder={locBusy ? "Finding your location…" : "Area or address"}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPickupPlace(next);
                    if (cityTouched.current) return;
                    const inferred = matchCityFromPlace(cities, next);
                    if (inferred?.id) setCityId(inferred.id);
                  }}
                />
              ),
            },
            {
              id: "hero2-city",
              label: (
                <>
                  <FontAwesomeIcon icon={faLocationDot} /> Pickup city
                </>
              ),
              control: (
                <select
                  id="hero2-city"
                  value={cityId}
                  onChange={(e) => {
                    cityTouched.current = true;
                    setCityId(e.target.value);
                  }}
                >
                  {!cityId && (
                    <option value="">{locBusy ? "Finding city…" : "Select city"}</option>
                  )}
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: "hero2-from",
              label: (
                <>
                  <FontAwesomeIcon icon={faCalendarDays} /> Pickup date
                </>
              ),
              control: (
                <input
                  id="hero2-from"
                  type="date"
                  min={todayMin}
                  value={fromDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setFromDate(next);
                    if (toDate && next && toDate <= next) {
                      setToDate(localDateYmd(2, new Date(`${next}T12:00:00`)));
                    }
                  }}
                />
              ),
            },
            {
              id: "hero2-to",
              label: (
                <>
                  <FontAwesomeIcon icon={faCalendarDays} /> Return date
                </>
              ),
              control: (
                <input
                  id="hero2-to"
                  type="date"
                  min={fromDate || todayMin}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              ),
            },
            {
              id: "hero2-rental",
              label: (
                <>
                  <FontAwesomeIcon icon={faCarSide} /> Rental type
                </>
              ),
              control: (
                <select
                  id="hero2-rental"
                  value={rentalType}
                  onChange={(e) => setRentalType(e.target.value)}
                >
                  {RENTAL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              ),
            },
          ].map((field, index) => (
            <React.Fragment key={field.id}>
              {index > 0 ? (
                <span className="hero2-v2-sep" aria-hidden="true" />
              ) : null}
              <motion.div
                className={`hero2-v2-field hero2-v2-field--${field.id.replace("hero2-", "")}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: reduceMotion ? 0 : 0.55 + index * 0.06,
                  ease: EASE,
                }}
              >
                <label htmlFor={field.id}>{field.label}</label>
                {field.control}
              </motion.div>
            </React.Fragment>
          ))}

          <motion.button
            type="submit"
            className="hero2-v2-submit"
            disabled={!cityId || Boolean(cityMismatch)}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={reduceMotion ? undefined : { scale: 1.03, y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={{
              duration: 0.4,
              delay: reduceMotion ? 0 : 0.8,
              ease: EASE,
            }}
          >
            Search Cars
            <FontAwesomeIcon icon={faArrowRight} className="hero2-v2-cta-arrow" />
          </motion.button>

          {locMsg ? <p className="hero2-v2-loc">{locMsg}</p> : null}
          {searchError || cityMismatch ? (
            <p className="hero2-v2-error" role="alert">
              {searchError || cityMismatch}
            </p>
          ) : null}
        </motion.form>

        <motion.div
          className="hero2-v2-scroll"
          aria-hidden="true"
          {...fadeUp(0.9, 8)}
        >
          <span className="hero2-v2-scroll-mouse" />
          <span>Scroll to explore</span>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero2;
