const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dd_token") || "";
}

export function setToken(token) {
  if (token) localStorage.setItem("dd_token", token);
  else localStorage.removeItem("dd_token");
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

export async function api(path, options = {}) {
  const { retries: retriesOpt, ...rest } = options;
  const method = rest.method || "GET";
  const retries = retriesOpt ?? (/^(GET|HEAD)$/i.test(method) ? 3 : 0);
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
      await sleep(800 * (attempt + 1));
    }
  }

  if (isNetworkError(lastError)) {
    const err = new Error("Can't reach the server. Wait a moment and try again.");
    err.cause = lastError;
    throw err;
  }
  throw lastError;
}
