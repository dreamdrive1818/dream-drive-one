const store = new Map();
const inflight = new Map();

export function cacheKey(...parts) {
  return parts.map((part) => (part == null ? "" : String(part))).join("|");
}

export function ttlForPath(path) {
  const p = String(path || "").split("?")[0];
  if (p === "/v1/me") return 90_000;
  if (p === "/v1/me/bookings" || p === "/v1/me/dashboard") return 45_000;
  if (p.startsWith("/v1/public/cities") || p.startsWith("/v1/admin/cities") || p.startsWith("/v1/admin/branches")) {
    return 120_000;
  }
  if (p.startsWith("/v1/admin/partners") || p.startsWith("/v1/admin/car-models")) return 45_000;
  if (
    p.startsWith("/v1/public/search") ||
    p.startsWith("/v1/public/catalog-config") ||
    p.startsWith("/v1/public/home") ||
    p.startsWith("/v1/public/config")
  ) {
    return 120_000;
  }
  if (p.startsWith("/v1/admin/bookings")) return 18_000;
  if (p.startsWith("/v1/admin/vehicles")) return 20_000;
  if (p.startsWith("/v1/admin/dashboard")) return 30_000;
  return 20_000;
}

export function peekGet(key) {
  return store.get(key)?.data;
}

export function isFresh(key, ttl) {
  const row = store.get(key);
  if (!row) return false;
  return Date.now() - row.at < ttl;
}

export function setGet(key, data) {
  store.set(key, { at: Date.now(), data });
}

export function getInflight(key) {
  return inflight.get(key);
}

export function setInflight(key, promise) {
  inflight.set(key, promise);
  promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
}

export function clearGets() {
  store.clear();
  inflight.clear();
}

function relatedPrefixes(path) {
  const p = String(path || "");
  if (/\/v1\/auth\//i.test(p)) return [];
  const out = [p.split("?")[0]];
  if (/booking/i.test(p)) out.push("/v1/admin/bookings", "/v1/me/bookings", "/v1/me/dashboard", "/v1/admin/dashboard");
  if (/vehicle|car-model|pricing|catalog/i.test(p)) {
    out.push("/v1/admin/vehicles", "/v1/admin/car-models", "/v1/public/search", "/v1/public/home");
  }
  if (/cities|branch/i.test(p)) {
    out.push("/v1/admin/cities", "/v1/admin/branches", "/v1/public/cities");
  }
  if (p === "/v1/me" || p.startsWith("/v1/me?")) out.push("/v1/me", "/v1/me/dashboard");
  return [...new Set(out)];
}

export function invalidateByPath(path) {
  const prefixes = relatedPrefixes(path);
  for (const key of [...store.keys()]) {
    if (prefixes.some((prefix) => key.includes(prefix))) store.delete(key);
  }
}
