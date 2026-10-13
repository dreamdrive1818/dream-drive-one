const store = new Map();
const inflight = new Map();

const PERSIST_KEY = "dd_gc_v1";
const PERSIST_PATHS = new Set([
  "/v1/me",
  "/v1/me/dashboard",
  "/v1/public/cities",
  "/v1/public/catalog-config",
]);
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let persistTimer = null;

function canPersist() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Persisted rows belong to the signed-in token so another account never sees them. */
function ownerTag() {
  try {
    return (localStorage.getItem("dd_token") || "").slice(-24);
  } catch {
    return "";
  }
}

function pathOf(key) {
  return String(key).split("|")[1] || "";
}

function isPersisted(key) {
  return PERSIST_PATHS.has(pathOf(key));
}

function isPrivate(key) {
  return pathOf(key).startsWith("/v1/me");
}

function schedulePersist() {
  if (!canPersist() || persistTimer) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    const owner = ownerTag();
    const rows = {};
    for (const [key, row] of store) {
      if (!isPersisted(key)) continue;
      if (isPrivate(key) && !owner) continue;
      rows[key] = row;
    }
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ owner, rows }));
    } catch {
      // storage full or blocked
    }
  }, 300);
}

function hydrate() {
  if (!canPersist()) return;
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null");
    if (!saved || typeof saved.rows !== "object" || !saved.rows) return;
    const owner = ownerTag();
    const sameOwner = Boolean(owner) && saved.owner === owner;
    const now = Date.now();
    for (const [key, row] of Object.entries(saved.rows)) {
      if (!isPersisted(key) || (isPrivate(key) && !sameOwner)) continue;
      if (row && typeof row.at === "number" && now - row.at < PERSIST_MAX_AGE_MS) {
        store.set(key, row);
      }
    }
  } catch {
    // corrupt entry — ignore
  }
}

/** Bumped on sign-in/out so responses from the previous session are dropped. */
let generation = 0;

export function cacheGeneration() {
  return generation;
}

hydrate();

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

export function setGet(key, data, gen) {
  if (gen !== undefined && gen !== generation) return;
  store.set(key, { at: Date.now(), data });
  if (isPersisted(key)) schedulePersist();
}

export function getInflight(key) {
  return inflight.get(key);
}

export function setInflight(key, promise) {
  inflight.set(key, promise);
  promise
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    })
    .catch(() => undefined);
}

export function clearGets() {
  generation += 1;
  store.clear();
  inflight.clear();
  if (!canPersist()) return;
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // ignore
  }
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
  if (/getaway|cms\//i.test(p)) out.push("/v1/public/home");
  if (p === "/v1/me" || p.startsWith("/v1/me?")) out.push("/v1/me", "/v1/me/dashboard");
  return [...new Set(out)];
}

export function invalidateByPath(path) {
  const prefixes = relatedPrefixes(path);
  let touched = false;
  for (const key of [...store.keys()]) {
    if (prefixes.some((prefix) => key.includes(prefix))) {
      store.delete(key);
      if (isPersisted(key)) touched = true;
    }
  }
  if (touched) schedulePersist();
}
