const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export async function api(path, options = {}) {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { "content-type": "application/json" }),
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
      "x-ops-city-id": getOpsCity(),
      "x-ops-branch-id": getOpsBranch(),
      ...(options.headers || {}),
    },
    body: options.body == null ? undefined : isForm ? options.body : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
