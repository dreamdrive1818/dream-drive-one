import {
  cacheKey,
  clearGets,
  getInflight,
  invalidateByPath,
  isFresh,
  peekGet,
  setGet,
  setInflight,
  ttlForPath,
} from "./get-cache";

function apiBase() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
  }
  return "";
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dd_token") || "";
}

export function setToken(token) {
  if (token) localStorage.setItem("dd_token", token);
  else {
    localStorage.removeItem("dd_token");
    clearGets();
  }
}

export function getOpsCity() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dd_ops_city") || "";
}

export function getOpsBranch() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dd_ops_branch") || "";
}

export function setOpsScope(cityId, branchId) {
  if (typeof window === "undefined") return;
  const nextCity = cityId || "";
  const nextBranch = branchId || "";
  if (nextCity) localStorage.setItem("dd_ops_city", nextCity);
  else localStorage.removeItem("dd_ops_city");
  if (nextBranch) localStorage.setItem("dd_ops_branch", nextBranch);
  else localStorage.removeItem("dd_ops_branch");
  window.dispatchEvent(new CustomEvent("dd-ops-scope", { detail: { cityId: nextCity, branchId: nextBranch } }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err) {
  if (!err) return false;
  if (err.name === "TypeError") return true;
  return /failed to fetch|networkerror|network request failed|load failed|econnrefused|err_connection/i.test(
    String(err.message || "")
  );
}

function requestKey(path) {
  return cacheKey("GET", getOpsCity(), getOpsBranch(), path);
}

export function peekApi(path) {
  return peekGet(requestKey(path));
}

export function seedApi(path, data) {
  if (data === undefined) return;
  setGet(requestKey(path), data);
}

export function prefetch(paths) {
  void Promise.all(paths.map((path) => api(path).catch(() => undefined)));
}

export async function api(path, options = {}) {
  const { retries: retriesOpt, cache: cacheMode, ...rest } = options;
  const method = String(rest.method || "GET").toUpperCase();
  const useCache = cacheMode !== false && method === "GET";
  const key = requestKey(path);
  const ttl = ttlForPath(path);

  if (useCache) {
    const cached = peekGet(key);
    const pending = getInflight(key);
    if (cached !== undefined && isFresh(key, ttl)) return cached;
    if (cached !== undefined) {
      if (!pending) {
        const refresh = runFetch(path, rest, retriesOpt, method).then((data) => {
          setGet(key, data);
          return data;
        });
        setInflight(key, refresh);
      }
      return cached;
    }
    if (pending) return pending;
  }

  const request = runFetch(path, rest, retriesOpt, method);
  if (useCache) setInflight(key, request);
  try {
    const data = await request;
    if (useCache) setGet(key, data);
    else invalidateByPath(path);
    return data;
  } catch (err) {
    if (method !== "GET") invalidateByPath(path);
    throw err;
  }
}

async function runFetch(path, rest, retriesOpt, method) {
  const retries = retriesOpt ?? (/^(GET|HEAD)$/i.test(method) ? 1 : 0);
  const isForm = typeof FormData !== "undefined" && rest.body instanceof FormData;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        method,
        headers: {
          ...(isForm ? {} : { "content-type": "application/json" }),
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          ...(getOpsCity() ? { "x-ops-city-id": getOpsCity() } : {}),
          ...(getOpsBranch() ? { "x-ops-branch-id": getOpsBranch() } : {}),
          ...(rest.headers || {}),
        },
        body: rest.body == null ? undefined : isForm ? rest.body : JSON.stringify(rest.body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message || data.error || res.statusText);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      lastError = err;
      const retryable = isNetworkError(err) && attempt < retries;
      if (!retryable) break;
      await sleep(400 * (attempt + 1));
    }
  }

  if (isNetworkError(lastError)) {
    const err = new Error("Can't reach the API. Keep npm run dev:api running, then refresh this page.");
    err.cause = lastError;
    throw err;
  }
  throw lastError;
}
