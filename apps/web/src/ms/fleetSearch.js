/** Backend RentalType enum — do not add values not in Prisma. */
export const RENTAL_TYPES = [
  { value: "SELF_DRIVE", label: "Self drive" },
  { value: "WITH_DRIVER_LOCAL", label: "With driver (local)" },
  { value: "WITH_DRIVER_INTERCITY", label: "With driver (intercity)" },
  { value: "AIRPORT", label: "Airport transfer" },
  { value: "OUTSTATION", label: "Outstation" },
  { value: "ONE_WAY", label: "One way" },
  { value: "TOUR_PACKAGE", label: "Tour package" },
  { value: "SUBSCRIPTION", label: "Subscription" },
];

export const RENTAL_TYPE_LABELS = Object.fromEntries(
  RENTAL_TYPES.map((t) => [t.value, t.label])
);

export const SORT_OPTIONS = [
  { value: "", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "popularity", label: "Popularity" },
];

export const TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "mpv", label: "MPV" },
  { value: "luxury", label: "Luxury" },
];

export const SEAT_OPTIONS = ["", "4", "5", "6", "7", "8"];

export const FUEL_OPTIONS = [
  { value: "", label: "Any fuel" },
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "cng", label: "CNG" },
];

export const TRANSMISSION_OPTIONS = [
  { value: "", label: "Any transmission" },
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
];

const FILTER_KEYS = [
  "cityId",
  "from",
  "to",
  "rentalType",
  "type",
  "seats",
  "fuel",
  "transmission",
  "minPrice",
  "maxPrice",
  "sort",
  "packageId",
  "dropBranchId",
  "terminalId",
  "flightNumber",
  "waitMinutes",
  "estimatedKm",
];

export function parseFleetFilters(searchParams) {
  const get = (key) => searchParams.get(key) || "";
  return {
    cityId: get("cityId"),
    from: get("from"),
    to: get("to"),
    rentalType: get("rentalType") || "SELF_DRIVE",
    type: get("type"),
    seats: get("seats"),
    fuel: get("fuel"),
    transmission: get("transmission"),
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    sort: get("sort"),
    packageId: get("packageId"),
    dropBranchId: get("dropBranchId"),
    terminalId: get("terminalId"),
    flightNumber: get("flightNumber"),
    waitMinutes: get("waitMinutes"),
    estimatedKm: get("estimatedKm"),
  };
}

export function filtersToSearchParams(filters) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value != null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  }
  return params;
}

/** Params forwarded to car detail (FE.W.03). */
export function detailPreserveParams(filters) {
  const params = new URLSearchParams();
  if (filters.cityId) params.set("cityId", filters.cityId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.rentalType) params.set("rentalType", filters.rentalType);
  if (filters.packageId) params.set("packageId", filters.packageId);
  if (filters.dropBranchId) params.set("dropBranchId", filters.dropBranchId);
  if (filters.terminalId) params.set("terminalId", filters.terminalId);
  if (filters.flightNumber) params.set("flightNumber", filters.flightNumber);
  if (filters.waitMinutes) params.set("waitMinutes", filters.waitMinutes);
  if (filters.estimatedKm) params.set("estimatedKm", filters.estimatedKm);
  return params;
}

export function carDetailPath(slug, filters) {
  const qs = detailPreserveParams(filters).toString();
  return `/cars/${slug}${qs ? `?${qs}` : ""}`;
}

export function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToIso(local) {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function validateDateRange(fromIso, toIso, maxDays = 30) {
  if (!fromIso || !toIso) return "";
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Enter valid pickup and return dates.";
  }
  if (to <= from) {
    return "Return date must be after pickup date.";
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (from < startOfToday) {
    return "Pickup cannot be in the past.";
  }
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (maxDays && days > maxDays) {
    return `Maximum rental length is ${maxDays} days.`;
  }
  return "";
}

export function buildApiSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.cityId) params.set("cityId", filters.cityId);
  if (filters.rentalType) params.set("rentalType", filters.rentalType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.type) params.set("type", filters.type);
  if (filters.seats) params.set("seats", filters.seats);
  if (filters.fuel) params.set("fuel", filters.fuel);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.sort) params.set("sort", filters.sort);
  return params;
}

/** UI rupees → API paise string. */
export function rupeesToPaiseString(rupees) {
  if (rupees === "" || rupees == null) return "";
  const n = Number(rupees);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100));
}

export function paiseToRupeesInput(paise) {
  if (!paise) return "";
  const n = Number(paise);
  if (!Number.isFinite(n)) return "";
  return String(n / 100);
}

export function sortCars(cars, sort) {
  const list = [...cars];
  if (sort === "price-asc") {
    list.sort((a, b) => (a.pricePaise ?? 0) - (b.pricePaise ?? 0));
  } else if (sort === "price-desc") {
    list.sort((a, b) => (b.pricePaise ?? 0) - (a.pricePaise ?? 0));
  } else if (sort === "popularity") {
    list.sort((a, b) => (b.bookingCount ?? 0) - (a.bookingCount ?? 0));
  }
  return list;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = String(key || monthKey()).split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return monthKey(d);
}

export function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateToIsoAtHour(dateStr, hour = 10) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function primaryImageUrl(car) {
  const images = car?.images;
  if (!Array.isArray(images) || !images.length) return "";
  const sorted = [...images].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  return sorted[0]?.url || "";
}

export function formatInr(paise) {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function sortedCarImages(car) {
  const images = car?.images;
  if (!Array.isArray(images)) return [];
  return [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function pricingRuleForType(pricingRules, rentalType, atIso) {
  if (!Array.isArray(pricingRules) || !rentalType) return null;
  const at = atIso ? new Date(atIso) : null;
  const typed = pricingRules.filter((r) => r.rentalType === rentalType);
  const pool = typed.length ? typed : pricingRules;
  if (!pool.length) return null;
  if (at && !Number.isNaN(at.getTime())) {
    const seasonal = pool.filter((r) => {
      if (!r.startsOn && !r.endsOn) return false;
      if (r.startsOn && at < new Date(r.startsOn)) return false;
      if (r.endsOn && at > new Date(r.endsOn)) return false;
      return true;
    });
    if (seasonal.length) return seasonal[0];
  }
  return pool.find((r) => !r.startsOn && !r.endsOn) ?? pool[0] ?? null;
}

/** Detail-page query sync (preserves cityId + booking context). */
export function syncDetailSearchParams(filters) {
  return detailPreserveParams(filters);
}
