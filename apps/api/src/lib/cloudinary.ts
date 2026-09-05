import { createHash, randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { BadRequestException } from "@nestjs/common";

const AUTH_FOLDERS = new Set([
  "dreamdrive/kyc",
  "dreamdrive/agreements",
  "dreamdrive/cars",
  "dreamdrive/cms",
  "dreamdrive/media",
  "dreamdrive/testimonials",
  "dreamdrive/fleet",
]);

const PUBLIC_FOLDERS = new Set(["dreamdrive/testimonials"]);

const FOLDER_ALIASES: Record<string, string> = {
  fleet: "dreamdrive/fleet",
  kyc: "dreamdrive/kyc",
  agreements: "dreamdrive/agreements",
  cars: "dreamdrive/cars",
  cms: "dreamdrive/cms",
  media: "dreamdrive/media",
  testimonials: "dreamdrive/testimonials",
};

export function uploadRoot() {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

export function publicApiOrigin() {
  return (process.env.API_PUBLIC_URL || process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
}

export function sanitizeFolder(folder: string | undefined, publicOnly = false) {
  let cleaned = String(folder ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
  if (FOLDER_ALIASES[cleaned]) cleaned = FOLDER_ALIASES[cleaned];
  const allowed = publicOnly ? PUBLIC_FOLDERS : AUTH_FOLDERS;
  const next = cleaned || (publicOnly ? "dreamdrive/testimonials" : "dreamdrive/media");
  if (!allowed.has(next)) {
    throw new BadRequestException("Invalid upload folder");
  }
  return next;
}

export function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET);
}

export function cloudinaryCanSign() {
  return Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export function isOurCloudinaryUrl(url: string | undefined | null) {
  const value = String(url ?? "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!/res\.cloudinary\.com$/i.test(parsed.hostname)) return false;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (cloud && !parsed.pathname.toLowerCase().includes(`/${cloud.toLowerCase()}/`)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

export function issueCloudinarySlot(folder: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  return {
    mode: "signed" as const,
    cloudName,
    apiKey,
    timestamp,
    signature: signParams(params, apiSecret),
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
  };
}

function saveLocal(
  folder: string,
  buffer: Buffer,
  filename?: string
): { url: string; publicId: string; local: true } {
  const ext = String(filename || "file")
    .split(".")
    .pop()
    ?.replace(/[^a-z0-9]/gi, "")
    .slice(0, 8) || "bin";
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const dir = join(uploadRoot(), folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), buffer);
  return {
    url: `${publicApiOrigin()}/v1/files/${folder}/${name}`,
    publicId: `${folder}/${name}`,
    local: true,
  };
}

export async function uploadToCloudinary(input: {
  folder: string;
  url?: string;
  buffer?: Buffer;
  filename?: string;
  mimetype?: string;
}): Promise<{ url: string; publicId?: string; mock?: boolean; local?: boolean }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    if (input.buffer?.length) return saveLocal(input.folder, input.buffer, input.filename);
    if (input.url?.trim()) return { url: input.url.trim() };
    throw new BadRequestException("file or url required");
  }

  const form = new FormData();
  if (input.buffer?.length) {
    const bytes = new Uint8Array(input.buffer);
    form.append(
      "file",
      new Blob([bytes], { type: input.mimetype || "application/octet-stream" }),
      input.filename || "upload"
    );
  } else if (input.url?.trim()) {
    form.append("file", input.url.trim());
  } else {
    throw new BadRequestException("file or url required");
  }
  form.append("upload_preset", uploadPreset);
  form.append("folder", input.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url) {
    throw new BadRequestException(data.error?.message || "Cloudinary upload failed");
  }
  return { url: data.secure_url, publicId: data.public_id };
}
