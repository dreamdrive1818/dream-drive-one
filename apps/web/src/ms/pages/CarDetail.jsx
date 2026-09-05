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
  monthKey,
  shiftMonth,
  dateToIsoAtHour,
  isoDate,
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
  const [month, setMonth] = useState(() => monthKey());
  const [busyDays, setBusyDays] = useState([]);
  const [cities, setCities] = useState([]);
  const [airports, setAirports] = useState([]);
  const [packages, setPackages] = useState([]);

  const context = useMemo(
    () => parseFleetFilters(searchParams),
    [searchParams]
  );

  const dateError = useMemo(
    () =>
      validateDateRange(
        context.from,
        context.to,
        car?.maxDaysByType?.[context.rentalType] || car?.maxRentalDays || 30
      ),
    [context.from, context.to, context.rentalType, car]
  );

  const images = useMemo(() => sortedCarImages(car), [car]);
  const pricingRule = useMemo(
    () => pricingRuleForType(car?.pricingRules, context.rentalType, context.from),
    [car?.pricingRules, context.rentalType, context.from]
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
    api("/v1/public/cities").then(setCities).catch(() => {});
    api("/v1/public/packages").then(setPackages).catch(() => {});
  }, []);

  useEffect(() => {
    const cityId = car?.city?.id || context.cityId;
    const params = cityId ? `?cityId=${encodeURIComponent(cityId)}` : "";
    api(`/v1/public/airports${params}`).then(setAirports).catch(() => setAirports([]));
  }, [car?.city?.id, context.cityId]);

  useEffect(() => {
    if (!car?.id) {
      setAvailability(null);
      setBusyDays([]);
      setAvailabilityError("");
      setAvailabilityChecking(false);
      return undefined;
    }

    let cancelled = false;
    setAvailabilityChecking(true);
    setAvailabilityError("");

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ month });
      if (context.from && context.to && !dateError) {
        params.set("from", context.from);
        params.set("to", context.to);
      }
      api(`/v1/public/cars/${car.id}/availability?${params}`)
        .then((res) => {
          if (cancelled) return;
          setAvailability(res);
          setBusyDays(Array.isArray(res.busyDays) ? res.busyDays : []);
          setAvailabilityError("");
        })
        .catch((err) => {
          if (!cancelled) {
            setAvailability(null);
            setBusyDays([]);
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
  }, [car?.id, context.from, context.to, dateError, month]);

  const fleetBackHref = useMemo(() => {
    const qs = detailPreserveParams(context).toString();
    return `/fleet${qs ? `?${qs}` : ""}`;
  }, [context]);

  const selectedPackage = packages.find((p) => p.id === context.packageId);

  const canQuote =
    Boolean(context.from && context.to && !dateError) &&
    (Boolean(pricingRule) || context.rentalType === "TOUR_PACKAGE") &&
    (context.rentalType !== "TOUR_PACKAGE" || Boolean(context.packageId)) &&
    (context.rentalType !== "ONE_WAY" || Boolean(context.dropBranchId)) &&
    availability?.available === true &&
    !availabilityChecking &&
    !availabilityError &&
    !submitting;

  const calendarDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startPad = first.getDay();
    const lastDate = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= lastDate; d += 1) {
      cells.push(new Date(y, m - 1, d));
    }
    return cells;
  }, [month]);

  const selectedFromDay = context.from ? isoDate(new Date(context.from)) : "";
  const selectedToDay = context.to ? isoDate(new Date(context.to)) : "";
  const todayKey = isoDate(new Date());

  function pickDay(day) {
    const key = isoDate(day);
    if (busyDays.includes(key) || key < todayKey) return;
    if (!context.from || (context.from && context.to) || key <= selectedFromDay) {
      updateContext({ from: dateToIsoAtHour(key, 10), to: "" });
      return;
    }
    updateContext({ to: dateToIsoAtHour(key, 10) });
  }

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

    if (!pricingRule && context.rentalType !== "TOUR_PACKAGE") {
      setQuoteError("This rental type is not available for this car.");
      return;
    }
    if (context.rentalType === "TOUR_PACKAGE" && !context.packageId) {
      setQuoteError("Choose a tour package first.");
      return;
    }
    if (context.rentalType === "ONE_WAY" && !context.dropBranchId) {
      setQuoteError("Pick a drop branch in a different city for one-way.");
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
          dropBranchId: context.dropBranchId || undefined,
          packageId: context.packageId || undefined,
          terminalId: context.terminalId || undefined,
          flightNumber: context.flightNumber || undefined,
          waitMinutes: context.waitMinutes ? Number(context.waitMinutes) : undefined,
          estimatedKm: context.estimatedKm ? Number(context.estimatedKm) : undefined,
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

              {context.rentalType === "AIRPORT" && (
                <>
                  <div className="car-detail-field">
                    <label htmlFor="detail-terminal">Airport terminal</label>
                    <select
                      id="detail-terminal"
                      value={context.terminalId}
                      onChange={(e) => updateContext({ terminalId: e.target.value })}
                      disabled={submitting}
                    >
                      <option value="">Select terminal</option>
                      {airports.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="car-detail-field">
                    <label htmlFor="detail-flight">Flight number (optional)</label>
                    <input
                      id="detail-flight"
                      value={context.flightNumber}
                      onChange={(e) => updateContext({ flightNumber: e.target.value })}
                      placeholder="6E 123"
                      disabled={submitting}
                    />
                  </div>
                  <div className="car-detail-field">
                    <label htmlFor="detail-wait">Expected wait (minutes)</label>
                    <input
                      id="detail-wait"
                      type="number"
                      min="0"
                      value={context.waitMinutes}
                      onChange={(e) => updateContext({ waitMinutes: e.target.value })}
                      disabled={submitting}
                    />
                  </div>
                </>
              )}

              {context.rentalType === "OUTSTATION" && (
                <div className="car-detail-field">
                  <label htmlFor="detail-km">Estimated kilometres</label>
                  <input
                    id="detail-km"
                    type="number"
                    min="0"
                    value={context.estimatedKm}
                    onChange={(e) => updateContext({ estimatedKm: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              )}

              {context.rentalType === "ONE_WAY" && (
                <div className="car-detail-field">
                  <label htmlFor="detail-drop">Drop branch (other city)</label>
                  <select
                    id="detail-drop"
                    value={context.dropBranchId}
                    onChange={(e) => updateContext({ dropBranchId: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select drop branch</option>
                    {cities.flatMap((c) =>
                      (c.branches || [])
                        .filter((b) => c.id !== car.city?.id)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {c.name} · {b.name}
                          </option>
                        ))
                    )}
                  </select>
                </div>
              )}

              {context.rentalType === "TOUR_PACKAGE" && (
                <div className="car-detail-field">
                  <label htmlFor="detail-pack">Tour package</label>
                  <select
                    id="detail-pack"
                    value={context.packageId}
                    onChange={(e) => updateContext({ packageId: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Select package</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.days}d)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dateError && (
                <p className="car-detail-validation" role="alert">
                  {dateError}
                </p>
              )}

              <div className="car-detail-calendar" aria-label="Availability calendar">
                <div className="car-detail-calendar-nav">
                  <button
                    type="button"
                    className="car-detail-cal-btn"
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                  >
                    ‹
                  </button>
                  <strong>
                    {new Date(`${month}-01`).toLocaleString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  <button
                    type="button"
                    className="car-detail-cal-btn"
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                  >
                    ›
                  </button>
                </div>
                <div className="car-detail-cal-week">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span key={`${d}-${i}`}>{d}</span>
                  ))}
                </div>
                <div className="car-detail-cal-grid">
                  {calendarDays.map((day, i) => {
                    if (!day) return <span key={`e-${i}`} className="car-detail-cal-empty" />;
                    const key = isoDate(day);
                    const busy = busyDays.includes(key);
                    const past = key < todayKey;
                    const selected =
                      key === selectedFromDay ||
                      key === selectedToDay ||
                      (selectedFromDay &&
                        selectedToDay &&
                        key > selectedFromDay &&
                        key < selectedToDay);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={busy || past || submitting}
                        className={[
                          "car-detail-cal-day",
                          busy ? "is-busy" : "",
                          past ? "is-past" : "",
                          selected ? "is-selected" : "",
                          key === selectedFromDay ? "is-start" : "",
                          key === selectedToDay ? "is-end" : "",
                        ].join(" ")}
                        onClick={() => pickDay(day)}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="car-detail-cal-legend">
                  <span className="dot busy" /> Blocked
                  <span className="dot ok" /> Free
                  <span className="dot sel" /> Selected
                </p>
              </div>

              <div className="car-detail-price-block">
                {context.rentalType === "TOUR_PACKAGE" && selectedPackage ? (
                  <>
                    <p className="from-price">
                      {formatInr(selectedPackage.pricePaise)}{" "}
                      <span>fixed · {selectedPackage.days} day{selectedPackage.days === 1 ? "" : "s"}</span>
                    </p>
                    <p className="car-detail-price-meta">{selectedPackage.name}</p>
                  </>
                ) : pricingRule ? (
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
                Grey dates are fully booked or blocked (including a {car.bufferHours ?? 3}-hour
                buffer between trips). Tap a start and end date, or use the pickers above.
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
