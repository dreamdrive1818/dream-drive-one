function tokens(text) {
  return ` ${String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

export function formatPickupPlace(addr, displayName) {
  const locality =
    addr.road || addr.neighbourhood || addr.suburb || addr.retail || addr.hamlet || addr.quarter;
  const area = [addr.suburb, addr.city_district, addr.neighbourhood, addr.county].find(
    (part) => part && String(part).toLowerCase() !== String(locality || "").toLowerCase()
  );
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.state_district;
  const parts = [locality, area, city].filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === String(part).toLowerCase())) {
      unique.push(part);
    }
  }
  if (unique.length) return unique.join(", ");
  return String(displayName || "").split(",").slice(0, 3).join(",").trim();
}

/** Longest served-city name that appears as a whole token in the pickup text. */
export function matchCityFromPlace(cities, placeText) {
  const hay = tokens(placeText);
  if (hay === "  " || !Array.isArray(cities) || !cities.length) return null;
  let best = null;
  let bestLen = 0;
  for (const city of cities) {
    const name = tokens(city?.name).trim();
    const slug = tokens(String(city?.slug || "").replace(/-/g, " ")).trim();
    const hit = (name && hay.includes(` ${name} `)) || (slug && hay.includes(` ${slug} `));
    if (!hit) continue;
    const len = (name || slug).length;
    if (len > bestLen) {
      best = city;
      bestLen = len;
    }
  }
  return best;
}

export function matchCityFromAddress(cities, addr, displayName) {
  const blob = [
    addr.city,
    addr.town,
    addr.village,
    addr.municipality,
    addr.state_district,
    addr.county,
    addr.state,
    displayName,
  ]
    .filter(Boolean)
    .join(", ");
  return matchCityFromPlace(cities, blob);
}

export function pickupCityMismatch(cities, placeText, cityId) {
  const inferred = matchCityFromPlace(cities, placeText);
  if (!inferred || !cityId || inferred.id === cityId) return "";
  return `Pickup is in ${inferred.name}. Select ${inferred.name} as the city to continue.`;
}

export function requestLiveCoords() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This browser cannot read your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => reject(new Error("Allow location access to fill the pickup place and city.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

export async function lookupPickup(coords, cities) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`
  );
  if (!res.ok) {
    throw new Error("Could not turn that location into an address. Type the pickup place.");
  }
  const data = await res.json();
  const addr = data.address || {};
  return {
    place: formatPickupPlace(addr, data.display_name),
    city: matchCityFromAddress(cities, addr, data.display_name),
  };
}
