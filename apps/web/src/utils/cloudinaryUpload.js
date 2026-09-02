const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function authHeader() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("dd_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Upload a remote URL or File/Blob through the API (API talks to Cloudinary).
 * Returns the secure HTTPS URL.
 */
export const isCloudinaryUrl = (url = "") =>
  typeof url === "string" && /res\.cloudinary\.com\//i.test(url.trim());

export const isHttpUrl = (url = "") => {
  try {
    const parsed = new URL(String(url).trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const uploadToCloudinary = async (fileOrUrl, options = {}) => {
  const value = typeof fileOrUrl === "string" ? fileOrUrl.trim() : fileOrUrl;
  if (!value) {
    throw new Error("Nothing to upload.");
  }

  if (typeof value === "string" && isCloudinaryUrl(value)) {
    return value;
  }

  const data = new FormData();
  if (typeof value === "string") data.append("url", value);
  else data.append("file", value);
  data.append("folder", options.folder || "dreamdrive/cars");

  const path = options.public ? "/v1/public/uploads" : "/v1/uploads";
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: authHeader(),
    body: data,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) {
    throw new Error(result.error || result.message || "Upload failed.");
  }

  return result.url;
};

/**
 * Ensure every image in the list is hosted via the API upload pipeline.
 * External links are uploaded; blank entries are dropped.
 */
export const ensureCloudinaryImages = async (images = [], onProgress) => {
  const list = Array.isArray(images) ? images : [];
  const next = [];

  for (let i = 0; i < list.length; i += 1) {
    const url = typeof list[i] === "string" ? list[i].trim() : "";
    if (!url) continue;

    if (isCloudinaryUrl(url)) {
      next.push(url);
      onProgress?.(i, url, "ready");
      continue;
    }

    if (!isHttpUrl(url)) {
      onProgress?.(i, url, "skip");
      continue;
    }

    onProgress?.(i, url, "uploading");
    const cloudUrl = await uploadToCloudinary(url, { folder: "dreamdrive/cars" });
    next.push(cloudUrl);
    onProgress?.(i, cloudUrl, "done");
  }

  return next.length ? next : [""];
};
