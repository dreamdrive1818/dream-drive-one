const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
const CARS_FOLDER = "dreamdrive/cars";

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

/**
 * Upload a remote URL or File/Blob to Cloudinary (unsigned preset).
 * Returns the secure HTTPS Cloudinary URL.
 */
export const uploadToCloudinary = async (fileOrUrl, options = {}) => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary is not configured. Check NEXT_PUBLIC_CLOUDINARY_* env vars.");
  }

  const value = typeof fileOrUrl === "string" ? fileOrUrl.trim() : fileOrUrl;
  if (!value) {
    throw new Error("Nothing to upload.");
  }

  if (typeof value === "string" && isCloudinaryUrl(value)) {
    return value;
  }

  const data = new FormData();
  data.append("file", value);
  data.append("upload_preset", UPLOAD_PRESET);
  data.append("folder", options.folder || CARS_FOLDER);

  if (options.publicId) {
    data.append("public_id", options.publicId);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: data,
    }
  );

  const result = await response.json();
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "Cloudinary upload failed.");
  }

  return result.secure_url;
};

/**
 * Ensure every image in the list is a Cloudinary URL.
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
    const cloudUrl = await uploadToCloudinary(url);
    next.push(cloudUrl);
    onProgress?.(i, cloudUrl, "done");
  }

  return next.length ? next : [""];
};
