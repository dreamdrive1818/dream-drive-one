"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCarSide, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import {
  RENTAL_TYPES,
  RENTAL_TYPE_LABELS,
  parseFleetFilters,
  detailPreserveParams,
  syncDetailSearchParams,
  isoToDatetimeLocal,
  datetimeLocalToIso,
  validateDateRange,
  sortedCarImages,
  pricingRuleForType,
  formatInr,
} from "../fleetSearch";
import { saveQuoteHandoff } from "../quoteStorage";
import "./CarDetail.css";

function loginRedirectPath(slug, context) {
  const qs = detailPreserveParams(context).toString();
  const path = `/cars/${slug}${qs ? `?${qs}` : ""}`;
  return `/login?redirect=${encodeURIComponent(path)}`;
}

export default function CarDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, ready: authReady } = useAuth();

  const [car, setCar] = useState(null);
  const [carLoading, setCarLoading] = useState(true);
  const [carError, setCarError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const context = useMemo(
    () => parseFleetFilters(searchParams),
    [searchParams]
  );

  const dateError = useMemo(
    () => validateDateRange(context.from, context.to),
    [context.from, context.to]
  );

  const images = useMemo(() => sortedCarImages(car), [car]);
  const pricingRule = useMemo(
    () => pricingRuleForType(car?.pricingRules, context.rentalType),
    [car?.pricingRules, context.rentalType]
  );

  const updateContext = useCallback(
    (patch) => {
      const next = { ...parseFleetFilters(searchParams), ...patch };
      setSearchParams(syncDetailSearchParams(next), { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setCarLoading(true);
    setCarError("");
    setCar(null);
    setActiveImage(0);

    api(`/v1/public/cars/${slug}`)
      .then((data) => {
        if (!cancelled) setCar(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setCarError(err.message || "Could not load this car.");
        }
      })
      .finally(() => {
        if (!cancelled) setCarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!car?.id || dateError || !context.from || !context.to) {
      setAvailability(null);
      setAvailabilityError("");
      setAvailabilityChecking(false);
      return undefined;
    }

    let cancelled = false;
    setAvailabilityChecking(true);
    setAvailabilityError("");

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        from: context.from,
        to: context.to,
      });
      api(`/v1/public/cars/${car.id}/availability?${params}`)
        .then((res) => {
          if (!cancelled) {
            setAvailability(res);
            setAvailabilityError("");
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setAvailability(null);
            setAvailabilityError(
              err.message || "Could not check availability for these dates."
            );
          }
        })
        .finally(() => {
          if (!cancelled) setAvailabilityChecking(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [car?.id, context.from, context.to, dateError]);

  const fleetBackHref = useMemo(() => {
    const qs = detailPreserveParams(context).toString();
    return `/fleet${qs ? `?${qs}` : ""}`;
  }, [context]);

  const canQuote =
    Boolean(context.from && context.to && !dateError && pricingRule) &&
    availability?.available === true &&
    !availabilityChecking &&
    !availabilityError &&
    !submitting;

  async function handleQuote(e) {
    e.preventDefault();
    setQuoteError("");

    if (!context.from || !context.to) {
      setQuoteError("Please select pickup and return dates.");
      return;
    }
    if (dateError) return;

    if (!user) {
      navigate(loginRedirectPath(slug, context));
      return;
    }

    if (!pricingRule) {
      setQuoteError("This rental type is not available for this car.");
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        from: context.from,
        to: context.to,
      });
      const avail = await api(
        `/v1/public/cars/${car.id}/availability?${params}`
      );
      setAvailability(avail);
      if (!avail.available) {
        setQuoteError("This car is not available for the selected dates.");
        return;
      }

      const quote = await api("/v1/quotes", {
        method: "POST",
        body: {
          carModelId: car.id,
          rentalType: context.rentalType,
          startsAt: context.from,
          endsAt: context.to,
        },
      });

      const handoff = saveQuoteHandoff(quote, car);
      navigate(`/checkout/${quote.id}`, { state: { quote: handoff } });
    } catch (err) {
      setQuoteError(err.message || "Could not create quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (carLoading) {
    return (
      <div className="car-detail-page">
        <div className="car-detail-loading">
          <ClipLoader color="var(--primary-color, #0072ce)" size={40} />
          <p style={{ marginTop: 16 }}>Loading car details…</p>
        </div>
      </div>
    );
  }

  if (carError || !car) {
    return (
      <div className="car-detail-page">
        <div className="car-detail-inner">
          <div className="car-detail-state-error" role="alert">
            <p>{carError || "Car not found."}</p>
            <Link to="/fleet" className="car-detail-back" style={{ marginTop: 16 }}>
              Back to search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mainImage = images[activeImage]?.url || "";

  return (
    <div className="car-detail-page">
      <div className="car-detail-inner">
        <Link to={fleetBackHref} className="car-detail-back">
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to search
        </Link>

        <div className="car-detail-layout">
          <section aria-label="Car gallery">
            <div className="car-detail-gallery-main">
              {mainImage ? (
                <img src={mainImage} alt={car.name} />
              ) : (
                <div className="car-detail-gallery-placeholder">
                  <FontAwesomeIcon icon={faCarSide} />
                  <span>No image</span>
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="car-detail-thumbs" role="list">
                {images.map((img, index) => (
                  <button
                    key={img.id || img.url}
                    type="button"
                    className={`car-detail-thumb${activeImage === index ? " is-active" : ""}`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={img.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <div>
            <div className="car-detail-info">
              <h1>{car.name}</h1>
              {car.city?.name && (
                <p className="car-detail-city">
                  {car.city.name}
                  {car.city.state ? `, ${car.city.state}` : ""}
                </p>
              )}

              <dl className="car-detail-specs">
                <div className="car-detail-spec">
                  <dt>Seats</dt>
                  <dd>{car.seats}</dd>
                </div>
                <div className="car-detail-spec">
                  <dt>Fuel</dt>
                  <dd>{car.fuel}</dd>
                </div>
                <div className="car-detail-spec">
                  <dt>Transmission</dt>
                  <dd>{car.transmission}</dd>
                </div>
                {car.type && (
                  <div className="car-detail-spec">
                    <dt>Type</dt>
                    <dd>{car.type}</dd>
                  </div>
                )}
              </dl>
            </div>

            <form className="car-detail-panel" onSubmit={handleQuote} noValidate>
              <h2>Book this car</h2>

              <div className="car-detail-field">
                <label htmlFor="detail-rental">Rental type</label>
                <select
                  id="detail-rental"
                  value={context.rentalType}
                  onChange={(e) => updateContext({ rentalType: e.target.value })}
                  disabled={submitting}
                >
                  {RENTAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="car-detail-field">
                <label htmlFor="detail-from">Pickup</label>
                <input
                  id="detail-from"
                  type="datetime-local"
                  value={isoToDatetimeLocal(context.from)}
                  onChange={(e) =>
                    updateContext({ from: datetimeLocalToIso(e.target.value) })
                  }
                  disabled={submitting}
                />
              </div>

              <div className="car-detail-field">
                <label htmlFor="detail-to">Return</label>
                <input
                  id="detail-to"
                  type="datetime-local"
                  value={isoToDatetimeLocal(context.to)}
                  onChange={(e) =>
                    updateContext({ to: datetimeLocalToIso(e.target.value) })
                  }
                  disabled={submitting}
                />
              </div>

              {dateError && (
                <p className="car-detail-validation" role="alert">
                  {dateError}
                </p>
              )}

              <div className="car-detail-price-block">
                {pricingRule ? (
                  <>
                    <p className="from-price">
                      {formatInr(pricingRule.dailyPaise)}{" "}
                      <span>/ day from</span>
                    </p>
                    <p className="car-detail-price-meta">
                      {RENTAL_TYPE_LABELS[context.rentalType] || context.rentalType}
                      {pricingRule.depositPaise > 0 &&
                        ` · Deposit ${formatInr(pricingRule.depositPaise)}`}
                      {pricingRule.extraKmPaise != null &&
                        ` · Extra km ${formatInr(pricingRule.extraKmPaise)}`}
                    </p>
                  </>
                ) : (
                  <p className="car-detail-warning" role="status">
                    This rental type is not currently offered for this car.
                  </p>
                )}
              </div>

              <p className="car-detail-hint">
                Availability is checked for your selected date range. A full
                blocked-date calendar is not available yet.
              </p>

              {availabilityChecking && (
                <p className="car-detail-availability car-detail-availability--checking">
                  Checking availability…
                </p>
              )}
              {!availabilityChecking && availabilityError && (
                <p className="car-detail-availability car-detail-availability--bad" role="alert">
                  {availabilityError}
                </p>
              )}
              {!availabilityChecking &&
                !availabilityError &&
                availability?.available === true && (
                  <p className="car-detail-availability car-detail-availability--ok">
                    Available for your selected dates
                  </p>
                )}
              {!availabilityChecking &&
                !availabilityError &&
                availability?.available === false && (
                  <p className="car-detail-availability car-detail-availability--bad">
                    Unavailable for your selected dates
                  </p>
                )}

              {quoteError && (
                <p className="car-detail-error" role="alert">
                  {quoteError}
                </p>
              )}

              <button
                type="submit"
                className="car-detail-cta"
                disabled={!canQuote && Boolean(user)}
              >
                {submitting
                  ? "Creating quote…"
                  : user
                    ? "Continue to checkout"
                    : "Sign in to get quote"}
              </button>

              {!user && authReady && (
                <p className="car-detail-hint" style={{ marginTop: 12 }}>
                  You can browse freely. Sign in is required only when you
                  continue to checkout.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
