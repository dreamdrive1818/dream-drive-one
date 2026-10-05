"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCarSide,
  faArrowRight,
  faUserFriends,
  faGasPump,
  faCogs,
  faSliders,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { api, peekApi } from "../api";
import {
  RENTAL_TYPE_LABELS,
  RENTAL_TYPES,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  SEAT_OPTIONS,
  FUEL_OPTIONS,
  TRANSMISSION_OPTIONS,
  parseFleetFilters,
  filtersToSearchParams,
  carDetailPath,
  isoToDatetimeLocal,
  datetimeLocalToIso,
  validateDateRange,
  buildApiSearchParams,
  rupeesToPaiseString,
  paiseToRupeesInput,
  sortCars,
  primaryImageUrl,
  formatInr,
  defaultSearchDates,
  localDateYmd,
} from "../fleetSearch";
import { lookupPickup, requestLiveCoords } from "../livePickup";
import "./Search.css";

const EMPTY_FILTERS = {
  cityId: "",
  from: "",
  to: "",
  rentalType: "SELF_DRIVE",
  type: "",
  seats: "",
  fuel: "",
  transmission: "",
  minPrice: "",
  maxPrice: "",
  sort: "",
};

function cachedCities() {
  const rows = peekApi("/v1/public/cities");
  return Array.isArray(rows) ? rows : [];
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cities, setCities] = useState(cachedCities);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(() => cachedCities().length === 0);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [maxRentalDays, setMaxRentalDays] = useState(30);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locMsg, setLocMsg] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [pickupPlace, setPickupPlace] = useState(() => searchParams.get("pickupPlace") || "");
  const askedLocation = useRef(false);
  const presetPlace = useRef(searchParams.get("pickupPlace") || "");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [manual, setManual] = useState({ name: "", phone: "", place: "", note: "" });

  const filters = useMemo(
    () => parseFleetFilters(searchParams),
    [searchParams]
  );

  const dateError = useMemo(
    () => validateDateRange(filters.from, filters.to, maxRentalDays),
    [filters.from, filters.to, maxRentalDays]
  );

  const minPriceRupees = paiseToRupeesInput(filters.minPrice);
  const maxPriceRupees = paiseToRupeesInput(filters.maxPrice);

  const sortedCars = useMemo(
    () => sortCars(cars, filters.sort),
    [cars, filters.sort]
  );

  const selectedCity = useMemo(
    () => cities.find((c) => c.id === filters.cityId) || null,
    [cities, filters.cityId]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.type) n += 1;
    if (filters.seats) n += 1;
    if (filters.fuel) n += 1;
    if (filters.transmission) n += 1;
    if (filters.minPrice) n += 1;
    if (filters.maxPrice) n += 1;
    return n;
  }, [filters]);

  const setFilters = useCallback(
    (patch) => {
      const next = { ...parseFleetFilters(searchParams), ...patch };
      setSearchParams(filtersToSearchParams(next), { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const apiFetchKey = [
    filters.cityId,
    filters.from,
    filters.to,
    filters.rentalType,
    filters.type,
    filters.seats,
    filters.sort,
    filters.fuel,
    filters.transmission,
    filters.minPrice,
    filters.maxPrice,
  ].join("|");

  const runSearch = useCallback(
    async (activeFilters) => {
      if (!activeFilters.cityId) return;
      if (validateDateRange(activeFilters.from, activeFilters.to, maxRentalDays)) return;

      const path = `/v1/public/search?${buildApiSearchParams(activeFilters)}`;
      const cached = peekApi(path);
      if (cached) {
        setCars(Array.isArray(cached) ? cached : []);
        setSearched(true);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const rows = await api(path);
        setCars(Array.isArray(rows) ? rows : []);
        setSearched(true);
      } catch (err) {
        setCars([]);
        setSearched(true);
        setError(err.message || "Could not load cars. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [maxRentalDays]
  );

  useEffect(() => {
    let cancelled = false;
    const warmed = cachedCities();
    if (warmed.length) {
      setCities(warmed);
      setCitiesLoading(false);
      const current = parseFleetFilters(searchParams);
      const dates = defaultSearchDates();
      const patch = {};
      if (!current.cityId && warmed[0]?.id) patch.cityId = warmed[0].id;
      if (!current.from) patch.from = dates.from;
      if (!current.to) patch.to = dates.to;
      if (Object.keys(patch).length) {
        setSearchParams(
          filtersToSearchParams({ ...current, ...patch }),
          { replace: true }
        );
      }
    } else {
      setCitiesLoading(true);
    }
    api("/v1/public/cities")
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setCities(list);

        const current = parseFleetFilters(searchParams);
        const dates = defaultSearchDates();
        const patch = {};
        if (!current.cityId && list[0]?.id) patch.cityId = list[0].id;
        if (!current.from) patch.from = dates.from;
        if (!current.to) patch.to = dates.to;
        if (Object.keys(patch).length) {
          setSearchParams(
            filtersToSearchParams({ ...current, ...patch }),
            { replace: true }
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Could not load cities.");
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    api("/v1/public/catalog-config")
      .then((cfg) => {
        if (!cancelled && cfg?.maxRentalDays) setMaxRentalDays(Number(cfg.maxRentalDays));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filters.cityId || dateError) return undefined;
    const timer = setTimeout(() => runSearch(filters), 280);
    return () => clearTimeout(timer);
  }, [apiFetchKey, dateError, runSearch, filters]);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function handleSubmit(e) {
    e.preventDefault();
    if (dateError) return;
    runSearch(filters);
  }

  function handleClear() {
    const cityId = filters.cityId || cities[0]?.id || "";
    const dates = defaultSearchDates();
    setSearchParams(
      filtersToSearchParams({
        ...EMPTY_FILTERS,
        cityId,
        from: dates.from,
        to: dates.to,
      }),
      { replace: true }
    );
    setError("");
  }

  function handleFromLocalChange(local) {
    setFilters({ from: datetimeLocalToIso(local) });
  }

  function handleToLocalChange(local) {
    setFilters({ to: datetimeLocalToIso(local) });
  }

  const applyCurrentLocation = useCallback(() => {
    setLocBusy(true);
    setLocMsg("");
    requestLiveCoords()
      .then((coords) => lookupPickup(coords, cities))
      .then(({ place, city }) => {
        setPickupPlace(place);
        setManual((prev) => ({ ...prev, place: place || prev.place }));
        if (city) {
          setFilters({ cityId: city.id, pickupPlace: place });
          setLocMsg("");
        } else {
          if (place) setFilters({ pickupPlace: place });
          setLocMsg("Pickup location is set. Choose the nearest city we serve.");
        }
      })
      .catch((err) => {
        setLocMsg(err?.message || "Could not turn that location into an address. Type the pickup place.");
      })
      .finally(() => setLocBusy(false));
  }, [cities, setFilters]);

  useEffect(() => {
    if (!cities.length || askedLocation.current) return;
    askedLocation.current = true;
    if (presetPlace.current) return;
    applyCurrentLocation();
  }, [cities, applyCurrentLocation]);

  async function submitManual(e) {
    e.preventDefault();
    if (!manual.name.trim()) {
      setManualMsg("Name is required.");
      return;
    }
    setManualBusy(true);
    setManualMsg("");
    try {
      await api("/v1/public/contact", {
        method: "POST",
        body: {
          name: manual.name.trim(),
          phone: manual.phone.trim(),
          city: manual.place.trim() || selectedCity?.name || "",
          source: "manual-booking",
          message: [
            manual.note.trim(),
            filters.from ? `Pickup ${filters.from}` : "",
            filters.to ? `Return ${filters.to}` : "",
            rentalLabel ? `Rental ${rentalLabel}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      });
      setManualMsg("Request sent. Our team will confirm this booking.");
      setManual({ name: "", phone: "", place: "", note: "" });
    } catch (err) {
      setManualMsg(err.message || "Could not send the request.");
    } finally {
      setManualBusy(false);
    }
  }

  function handleMinPriceChange(rupees) {
    setFilters({ minPrice: rupeesToPaiseString(rupees) });
  }

  function handleMaxPriceChange(rupees) {
    setFilters({ maxPrice: rupeesToPaiseString(rupees) });
  }

  const rentalLabel =
    RENTAL_TYPE_LABELS[filters.rentalType] || filters.rentalType;

  function renderFilterPanel(idSuffix = "") {
    const sid = (base) => `${base}${idSuffix}`;
    return (
      <div className="fleet-search-sidebar-inner">
        <div className="fleet-search-sidebar-head">
          <h2>Filters</h2>
          <button
            type="button"
            className="fleet-search-clear-link"
            onClick={handleClear}
            disabled={loading}
          >
            Clear all
          </button>
        </div>

        <div className="fleet-search-filter-group">
          <label htmlFor={sid("fleet-type")}>Car type</label>
          <select
            id={sid("fleet-type")}
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fleet-search-filter-group">
          <label htmlFor={sid("fleet-seats")}>Seats</label>
          <select
            id={sid("fleet-seats")}
            value={filters.seats}
            onChange={(e) => setFilters({ seats: e.target.value })}
          >
            <option value="">Any</option>
            {SEAT_OPTIONS.filter(Boolean).map((n) => (
              <option key={n} value={n}>
                {n} seats
              </option>
            ))}
          </select>
        </div>

        <div className="fleet-search-filter-group">
          <label htmlFor={sid("fleet-fuel")}>Fuel</label>
          <select
            id={sid("fleet-fuel")}
            value={filters.fuel}
            onChange={(e) => setFilters({ fuel: e.target.value })}
          >
            {FUEL_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fleet-search-filter-group">
          <label htmlFor={sid("fleet-transmission")}>Transmission</label>
          <select
            id={sid("fleet-transmission")}
            value={filters.transmission}
            onChange={(e) => setFilters({ transmission: e.target.value })}
          >
            {TRANSMISSION_OPTIONS.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fleet-search-filter-group">
          <span className="fleet-search-filter-label">Daily price (₹)</span>
          <div className="fleet-search-price-row">
            <input
              id={sid("fleet-min-price")}
              type="number"
              min="0"
              step="100"
              placeholder="Min"
              aria-label="Minimum daily price"
              value={minPriceRupees}
              onChange={(e) => handleMinPriceChange(e.target.value)}
            />
            <span aria-hidden="true">–</span>
            <input
              id={sid("fleet-max-price")}
              type="number"
              min="0"
              step="100"
              placeholder="Max"
              aria-label="Maximum daily price"
              value={maxPriceRupees}
              onChange={(e) => handleMaxPriceChange(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className="fleet-search-sidebar-apply"
          onClick={() => setFiltersOpen(false)}
        >
          Show results
        </button>
      </div>
    );
  }

  return (
    <div className="fleet-search-page">
      <div className="fleet-search-inner">
        <header className="fleet-search-header">
          <p className="fleet-search-eyebrow">Fleet</p>
          <h1>Find your drive</h1>
          <p className="fleet-search-lead">
            Choose city, dates, and filters — prices are starting daily rates.
          </p>
        </header>

        <form
          className="fleet-search-bar"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Search cars"
        >
          <div className="fleet-search-bar-fields">
            <div className="fleet-search-bar-field fleet-search-bar-field--place">
              <label htmlFor="fleet-pickup-place">Pickup location</label>
              <input
                id="fleet-pickup-place"
                value={pickupPlace}
                placeholder={locBusy ? "Finding your location…" : "Area, landmark, or address"}
                onChange={(e) => setPickupPlace(e.target.value)}
              />
            </div>

            <div className="fleet-search-bar-field">
              <label htmlFor="fleet-city">City</label>
              <select
                id="fleet-city"
                value={filters.cityId}
                onChange={(e) => setFilters({ cityId: e.target.value })}
                disabled={citiesLoading}
              >
                {!filters.cityId && <option value="">Select city</option>}
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.state ? `, ${c.state}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="fleet-search-bar-field">
              <label htmlFor="fleet-from">Pickup time</label>
              <input
                id="fleet-from"
                type="datetime-local"
                min={`${localDateYmd(0)}T00:00`}
                value={isoToDatetimeLocal(filters.from)}
                onChange={(e) => handleFromLocalChange(e.target.value)}
              />
            </div>

            <div className="fleet-search-bar-field">
              <label htmlFor="fleet-to">Return</label>
              <input
                id="fleet-to"
                type="datetime-local"
                min={isoToDatetimeLocal(filters.from) || `${localDateYmd(0)}T00:00`}
                value={isoToDatetimeLocal(filters.to)}
                onChange={(e) => handleToLocalChange(e.target.value)}
              />
            </div>

            <div className="fleet-search-bar-field">
              <label htmlFor="fleet-rental">Rental type</label>
              <select
                id="fleet-rental"
                value={filters.rentalType}
                onChange={(e) => setFilters({ rentalType: e.target.value })}
              >
                {RENTAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="fleet-search-submit"
            disabled={loading || !filters.cityId || Boolean(dateError)}
          >
            {loading ? "Searching…" : "Search"}
            {!loading && <FontAwesomeIcon icon={faArrowRight} />}
          </button>
        </form>

        <div className="fleet-search-extras">
          <button
            type="button"
            className="fleet-search-extra"
            onClick={applyCurrentLocation}
            disabled={locBusy || citiesLoading}
          >
            {locBusy ? "Finding location…" : "Use current location"}
          </button>
          <button
            type="button"
            className={`fleet-search-extra${manualOpen ? " is-on" : ""}`}
            onClick={() => {
              setManualOpen((open) => !open);
              setManualMsg("");
            }}
          >
            Manual booking
          </button>
        </div>
        {locMsg ? <p className="fleet-search-extra-note">{locMsg}</p> : null}
        {manualOpen ? (
          <form className="fleet-manual" onSubmit={submitManual}>
            <p className="fleet-manual-lead">
              Tell us the place and we will arrange the car if it is not in the list.
            </p>
            <div className="fleet-manual-grid">
              <label>
                Name
                <input
                  value={manual.name}
                  onChange={(e) => setManual((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={manual.phone}
                  inputMode="tel"
                  onChange={(e) => setManual((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="fleet-manual-wide">
                Pickup place
                <input
                  value={manual.place || pickupPlace}
                  onChange={(e) => {
                    setPickupPlace(e.target.value);
                    setManual((prev) => ({ ...prev, place: e.target.value }));
                  }}
                  placeholder="Area, landmark, or city"
                />
              </label>
              <label className="fleet-manual-wide">
                Note
                <input
                  value={manual.note}
                  onChange={(e) => setManual((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Car type or anything else"
                />
              </label>
            </div>
            <button type="submit" className="fleet-search-submit" disabled={manualBusy}>
              {manualBusy ? "Sending…" : "Send booking request"}
            </button>
            {manualMsg ? <p className="fleet-search-extra-note">{manualMsg}</p> : null}
          </form>
        ) : null}

        {dateError && (
          <p className="fleet-search-validation" role="alert">
            {dateError}
          </p>
        )}

        <div className="fleet-search-layout">
          <aside className="fleet-search-sidebar fleet-search-sidebar--desktop">
            {renderFilterPanel("")}
          </aside>

          <div className="fleet-search-main">
            <div className="fleet-search-toolbar">
              <div className="fleet-search-toolbar-left">
                <button
                  type="button"
                  className="fleet-search-filters-toggle"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={filtersOpen}
                >
                  <FontAwesomeIcon icon={faSliders} />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="fleet-search-filters-count">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                <p className="fleet-search-count">
                  {loading || citiesLoading
                    ? "Loading results…"
                    : searched
                      ? `${sortedCars.length} car${
                          sortedCars.length === 1 ? "" : "s"
                        } found`
                      : "Select a city to browse cars"}
                  {!loading && searched && selectedCity?.name
                    ? ` in ${selectedCity.name}`
                    : ""}
                  {!loading && searched && rentalLabel
                    ? ` · ${rentalLabel}`
                    : ""}
                </p>
              </div>

              <div className="fleet-search-sort">
                <label htmlFor="fleet-sort">Sort</label>
                <select
                  id="fleet-sort"
                  value={filters.sort}
                  onChange={(e) => setFilters({ sort: e.target.value })}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value || "featured"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div
                className="fleet-search-state fleet-search-state--error"
                role="alert"
              >
                <p>{error}</p>
                <button
                  type="button"
                  className="fleet-search-retry"
                  onClick={() => runSearch(filters)}
                >
                  Try again
                </button>
              </div>
            )}

            {(loading || citiesLoading) && (
              <div
                className="fleet-search-skeletons"
                aria-live="polite"
                aria-label="Loading cars"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="fleet-search-skeleton" />
                ))}
              </div>
            )}

            {!loading && !error && searched && sortedCars.length === 0 && (
              <div className="fleet-search-state">
                <div className="fleet-search-state-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faCarSide} />
                </div>
                <p>No cars match these filters</p>
                <p className="fleet-search-state-hint">
                  Try different dates or clear some filters.
                </p>
                <button
                  type="button"
                  className="fleet-search-retry"
                  onClick={handleClear}
                >
                  Clear filters
                </button>
              </div>
            )}

            {!loading && sortedCars.length > 0 && (
              <div className="fleet-search-grid">
                {sortedCars.map((car) => {
                  const available = car.available !== false;
                  const img = primaryImageUrl(car);
                  const category = car.type || "";

                  const cardInner = (
                    <>
                      <div className="fleet-search-card-media">
                        {img ? (
                          <img
                            src={img}
                            alt={car.name || "Vehicle"}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="fleet-search-card-placeholder"
                            aria-hidden="true"
                          >
                            <FontAwesomeIcon icon={faCarSide} />
                          </div>
                        )}
                        <span
                          className={`fleet-search-badge ${
                            available
                              ? "fleet-search-badge--available"
                              : "fleet-search-badge--unavailable"
                          }`}
                        >
                          {available ? "Available" : "Unavailable"}
                        </span>
                        {car.featured ? (
                          <span className="fleet-search-badge fleet-search-badge--featured">
                            Featured
                          </span>
                        ) : null}
                      </div>

                      <div className="fleet-search-card-body">
                        <div className="fleet-search-card-heading">
                          <h3>{car.name || "—"}</h3>
                          {category ? <p>{category}</p> : null}
                        </div>

                        <ul className="fleet-search-specs">
                          <li>
                            <FontAwesomeIcon icon={faUserFriends} />
                            <span>
                              {car.seats === null ||
                              car.seats === undefined ||
                              car.seats === ""
                                ? "—"
                                : car.seats}
                            </span>
                          </li>
                          <li>
                            <FontAwesomeIcon icon={faGasPump} />
                            <span>
                              {car.fuel === null ||
                              car.fuel === undefined ||
                              car.fuel === ""
                                ? "—"
                                : car.fuel}
                            </span>
                          </li>
                          <li>
                            <FontAwesomeIcon icon={faCogs} />
                            <span>
                              {car.transmission === null ||
                              car.transmission === undefined ||
                              car.transmission === ""
                                ? "—"
                                : car.transmission}
                            </span>
                          </li>
                        </ul>

                        <div className="fleet-search-card-footer">
                          <div>
                            <p className="fleet-search-price-label">From</p>
                            <p className="fleet-search-price">
                              {formatInr(car.pricePaise)}
                              <span>/ day</span>
                            </p>
                          </div>
                          {available ? (
                            <span className="fleet-search-rent">
                              View details
                              <FontAwesomeIcon icon={faArrowRight} />
                            </span>
                          ) : (
                            <span className="fleet-search-rent fleet-search-rent--disabled">
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  );

                  if (!available) {
                    return (
                      <div
                        key={car.id}
                        className="fleet-search-card fleet-search-card--unavailable"
                        aria-disabled="true"
                      >
                        {cardInner}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={car.id}
                      to={carDetailPath(car.slug, filters)}
                      className="fleet-search-card"
                    >
                      {cardInner}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fleet-search-drawer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="fleet-search-drawer-backdrop"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="fleet-search-drawer-panel">
            <div className="fleet-search-drawer-top">
              <h2>Filters</h2>
              <button
                type="button"
                className="fleet-search-drawer-close"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <aside className="fleet-search-sidebar fleet-search-sidebar--drawer">
              {renderFilterPanel("-m")}
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
