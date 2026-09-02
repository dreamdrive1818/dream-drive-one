"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCarSide } from "@fortawesome/free-solid-svg-icons";
import { ClipLoader } from "react-spinners";
import { api } from "../api";
import {
  RENTAL_TYPE_LABELS,
  RENTAL_TYPES,
  SORT_OPTIONS,
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
} from "../fleetSearch";
import "./Search.css";

const EMPTY_FILTERS = {
  cityId: "",
  from: "",
  to: "",
  rentalType: "SELF_DRIVE",
  seats: "",
  fuel: "",
  transmission: "",
  minPrice: "",
  maxPrice: "",
  sort: "",
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cities, setCities] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const filters = useMemo(
    () => parseFleetFilters(searchParams),
    [searchParams]
  );

  const dateError = useMemo(
    () => validateDateRange(filters.from, filters.to),
    [filters.from, filters.to]
  );

  const minPriceRupees = paiseToRupeesInput(filters.minPrice);
  const maxPriceRupees = paiseToRupeesInput(filters.maxPrice);

  const sortedCars = useMemo(
    () => sortCars(cars, filters.sort),
    [cars, filters.sort]
  );

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
    filters.seats,
    filters.fuel,
    filters.transmission,
    filters.minPrice,
    filters.maxPrice,
  ].join("|");

  const runSearch = useCallback(
    async (activeFilters) => {
      if (!activeFilters.cityId) return;
      if (validateDateRange(activeFilters.from, activeFilters.to)) return;

      setLoading(true);
      setError("");
      try {
        const rows = await api(
          `/v1/public/search?${buildApiSearchParams(activeFilters)}`
        );
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
    []
  );

  useEffect(() => {
    let cancelled = false;
    setCitiesLoading(true);
    api("/v1/public/cities")
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setCities(list);

        const current = parseFleetFilters(searchParams);
        if (!current.cityId && list[0]?.id) {
          setSearchParams(
            filtersToSearchParams({ ...current, cityId: list[0].id }),
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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filters.cityId || dateError) return;
    runSearch(filters);
  }, [apiFetchKey, dateError, runSearch, filters]);

  function handleSubmit(e) {
    e.preventDefault();
    if (dateError) return;
    runSearch(filters);
  }

  function handleClear() {
    const cityId = filters.cityId || cities[0]?.id || "";
    setSearchParams(filtersToSearchParams({ ...EMPTY_FILTERS, cityId }), {
      replace: true,
    });
    setError("");
  }

  function handleFromLocalChange(local) {
    setFilters({ from: datetimeLocalToIso(local) });
  }

  function handleToLocalChange(local) {
    setFilters({ to: datetimeLocalToIso(local) });
  }

  function handleMinPriceChange(rupees) {
    setFilters({ minPrice: rupeesToPaiseString(rupees) });
  }

  function handleMaxPriceChange(rupees) {
    setFilters({ maxPrice: rupeesToPaiseString(rupees) });
  }

  return (
    <div className="fleet-search-page">
      <div className="fleet-search-inner">
        <header className="fleet-search-header">
          <h1>Find your car</h1>
          <p>
            Search self-drive and chauffeur options by city, dates, and budget.
            Prices shown are starting daily rates for your selected rental type.
          </p>
        </header>

        <form className="fleet-search-filters" onSubmit={handleSubmit} noValidate>
          <div className="fleet-search-filters-grid">
            <div className="fleet-search-field">
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

            <div className="fleet-search-field">
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

            <div className="fleet-search-field">
              <label htmlFor="fleet-from">Pickup</label>
              <input
                id="fleet-from"
                type="datetime-local"
                value={isoToDatetimeLocal(filters.from)}
                onChange={(e) => handleFromLocalChange(e.target.value)}
              />
            </div>

            <div className="fleet-search-field">
              <label htmlFor="fleet-to">Return</label>
              <input
                id="fleet-to"
                type="datetime-local"
                value={isoToDatetimeLocal(filters.to)}
                onChange={(e) => handleToLocalChange(e.target.value)}
              />
            </div>

            <div className="fleet-search-field">
              <label htmlFor="fleet-seats">Seats</label>
              <select
                id="fleet-seats"
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

            <div className="fleet-search-field">
              <label htmlFor="fleet-fuel">Fuel</label>
              <select
                id="fleet-fuel"
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

            <div className="fleet-search-field">
              <label htmlFor="fleet-transmission">Transmission</label>
              <select
                id="fleet-transmission"
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

            <div className="fleet-search-field">
              <label htmlFor="fleet-min-price">Min price (₹/day)</label>
              <input
                id="fleet-min-price"
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 1500"
                value={minPriceRupees}
                onChange={(e) => handleMinPriceChange(e.target.value)}
              />
            </div>

            <div className="fleet-search-field">
              <label htmlFor="fleet-max-price">Max price (₹/day)</label>
              <input
                id="fleet-max-price"
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 5000"
                value={maxPriceRupees}
                onChange={(e) => handleMaxPriceChange(e.target.value)}
              />
            </div>
          </div>

          {dateError && (
            <p className="fleet-search-validation" role="alert">
              {dateError}
            </p>
          )}

          <div className="fleet-search-actions">
            <button
              type="submit"
              className="fleet-search-submit"
              disabled={loading || !filters.cityId || Boolean(dateError)}
            >
              {loading ? "Searching…" : "Search cars"}
            </button>
            <button
              type="button"
              className="fleet-search-clear"
              onClick={handleClear}
              disabled={loading}
            >
              Clear filters
            </button>
          </div>
        </form>

        <div className="fleet-search-toolbar">
          <p className="fleet-search-count">
            {loading
              ? "Loading results…"
              : searched
                ? `${sortedCars.length} car${sortedCars.length === 1 ? "" : "s"} found`
                : "Select a city to browse cars"}
          </p>
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
          <div className="fleet-search-state fleet-search-state--error" role="alert">
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

        {loading && (
          <div className="fleet-search-spinner" aria-live="polite">
            <ClipLoader color="var(--primary-color, #0072ce)" size={36} />
          </div>
        )}

        {!loading && !error && searched && sortedCars.length === 0 && (
          <div className="fleet-search-state">
            <p>No cars match your filters. Try different dates or clear some filters.</p>
          </div>
        )}

        {!loading && sortedCars.length > 0 && (
          <div className="fleet-search-grid">
            {sortedCars.map((car) => {
              const available = car.available !== false;
              const img = primaryImageUrl(car);
              const rentalLabel =
                RENTAL_TYPE_LABELS[filters.rentalType] || filters.rentalType;

              const cardInner = (
                <>
                  <div className="fleet-search-card-media">
                    {img ? (
                      <img src={img} alt={car.name} loading="lazy" />
                    ) : (
                      <div className="fleet-search-card-placeholder" aria-hidden="true">
                        <FontAwesomeIcon icon={faCarSide} />
                        <span>No image</span>
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
                  </div>
                  <div className="fleet-search-card-body">
                    <h3>{car.name}</h3>
                    <p className="fleet-search-specs">
                      {car.seats} seats · {car.fuel} · {car.transmission}
                      {car.city?.name ? ` · ${car.city.name}` : ""}
                    </p>
                    <p className="fleet-search-rental">{rentalLabel}</p>
                    <p className="fleet-search-price">
                      {formatInr(car.pricePaise)}{" "}
                      <span>/ day from</span>
                    </p>
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
  );
}
