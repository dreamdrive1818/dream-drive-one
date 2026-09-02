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
  "seats",
  "fuel",
  "transmission",
  "minPrice",
  "maxPrice",
  "sort",
];

export function parseFleetFilters(searchParams) {
  const get = (key) => searchParams.get(key) || "";
  return {
    cityId: get("cityId"),
    from: get("from"),
    to: get("to"),
    rentalType: get("rentalType") || "SELF_DRIVE",
    seats: get("seats"),
    fuel: get("fuel"),
    transmission: get("transmission"),
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    sort: get("sort"),
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

export function validateDateRange(fromIso, toIso) {
  if (!fromIso || !toIso) return "";
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Enter valid pickup and return dates.";
  }
  if (to <= from) {
    return "Return date must be after pickup date.";
  }
  return "";
}

export function buildApiSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.cityId) params.set("cityId", filters.cityId);
  if (filters.rentalType) params.set("rentalType", filters.rentalType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.seats) params.set("seats", filters.seats);
  if (filters.fuel) params.set("fuel", filters.fuel);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
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
  }
  return list;
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

export function pricingRuleForType(pricingRules, rentalType) {
  if (!Array.isArray(pricingRules) || !rentalType) return null;
  return pricingRules.find((r) => r.rentalType === rentalType) ?? null;
}

/** Detail-page query sync (preserves cityId + booking context). */
export function syncDetailSearchParams(filters) {
  return detailPreserveParams(filters);
}
