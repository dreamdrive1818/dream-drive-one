"use client";

import React, { useMemo } from "react";
import { availableHourOptions, hourFromIso } from "./fleetSearch";

/**
 * Hourly pickup/return time select for a trip date.
 * Past hours are filtered out for today; `minIso` keeps return after pickup.
 */
export default function TripTimeSelect({
  id,
  label = "Time",
  iso,
  dateStr,
  minIso,
  onChange,
  disabled = false,
  className = "",
}) {
  const options = useMemo(
    () => availableHourOptions(dateStr, { minIso }),
    [dateStr, minIso]
  );
  const value = hourFromIso(iso, options[0]?.value ?? 10);
  const safeValue = options.some((o) => o.value === value)
    ? value
    : options[0]?.value ?? "";

  return (
    <div className={className || "trip-time-select"}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <select
        id={id}
        value={safeValue}
        disabled={disabled || !dateStr || options.length === 0}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label || "Time"}
      >
        {options.length === 0 ? (
          <option value="">No times left today</option>
        ) : (
          options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
