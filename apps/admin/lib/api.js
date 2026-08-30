const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dd_token") || "";
}

export function setToken(token) {
  localStorage.setItem("dd_token", token);
}

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
