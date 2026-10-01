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
  else localStorage.removeItem("dd_token");
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
  if (cityId) localStorage.setItem("dd_ops_city", cityId);
  else localStorage.removeItem("dd_ops_city");
  if (branchId) localStorage.setItem("dd_ops_branch", branchId);
  else localStorage.removeItem("dd_ops_branch");
  window.dispatchEvent(new CustomEvent("dd-ops-scope", { detail: { cityId: cityId || "", branchId: branchId || "" } }));
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
  const retries = retriesOpt ?? (/^(GET|HEAD)$/i.test(method) ? 3 : 1);
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
      await sleep(800 * (attempt + 1));
    }
  }

  if (isNetworkError(lastError)) {
    const err = new Error("Can't reach the API. Keep npm run dev:api running, then refresh this page.");
    err.cause = lastError;
    throw err;
  }
  throw lastError;
}
