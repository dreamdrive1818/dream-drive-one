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

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  return cacheKey("GET", path);
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
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          ...(isForm ? {} : { "content-type": "application/json" }),
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
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
    const err = new Error("Can't reach the server. Wait a moment and try again.");
    err.cause = lastError;
    throw err;
  }
  throw lastError;
}
