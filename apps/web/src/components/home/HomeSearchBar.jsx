"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../ms/api";
import {
  RENTAL_TYPES,
  filtersToSearchParams,
  dateToIsoAtHour,
  validateDateRange,
} from "../../ms/fleetSearch";
import "./HomeSearchBar.css";

export default function HomeSearchBar() {
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [cityId, setCityId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rentalType, setRentalType] = useState("SELF_DRIVE");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/v1/public/cities")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCities(list);
        if (list[0]?.id) setCityId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const from = dateToIsoAtHour(fromDate, 10);
  const to = dateToIsoAtHour(toDate, 10);
  const dateError = useMemo(() => validateDateRange(from, to), [from, to]);

  function submit(e) {
    e.preventDefault();
    if (!cityId) {
      setError("Select a city to search.");
      return;
    }
    if (dateError) {
      setError(dateError);
      return;
    }
    setError("");
    const params = filtersToSearchParams({
      cityId,
      from,
      to,
      rentalType,
    });
    navigate(`/fleet?${params.toString()}`);
  }

  return (
    <section className="home-search" aria-label="Search cars">
      <form className="home-search-card" onSubmit={submit}>
        <div className="home-search-field">
          <label htmlFor="home-city">City</label>
          <select id="home-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {!cityId && <option value="">Select city</option>}
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="home-search-field">
          <label htmlFor="home-from">Pickup</label>
          <input
            id="home-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="home-search-field">
          <label htmlFor="home-to">Return</label>
          <input
            id="home-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="home-search-field">
          <label htmlFor="home-type">Rental</label>
          <select
            id="home-type"
            value={rentalType}
            onChange={(e) => setRentalType(e.target.value)}
          >
            {RENTAL_TYPES.slice(0, 3).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="home-search-submit">
          Search cars
        </button>
        {error ? <p className="home-search-error">{error}</p> : null}
      </form>
    </section>
  );
}
