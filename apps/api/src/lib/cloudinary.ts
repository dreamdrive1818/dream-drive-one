import { BadRequestException } from "@nestjs/common";

const AUTH_FOLDERS = new Set([
  "dreamdrive/kyc",
  "dreamdrive/cars",
  "dreamdrive/cms",
  "dreamdrive/media",
  "dreamdrive/testimonials",
]);

const PUBLIC_FOLDERS = new Set(["dreamdrive/testimonials"]);

export function sanitizeFolder(folder: string | undefined, publicOnly = false) {
  const cleaned = String(folder ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
  const allowed = publicOnly ? PUBLIC_FOLDERS : AUTH_FOLDERS;
  const next = cleaned || (publicOnly ? "dreamdrive/testimonials" : "dreamdrive/media");
  if (!allowed.has(next)) {
    throw new BadRequestException("Invalid upload folder");
  }
  return next;
}

export async function uploadToCloudinary(input: {
  folder: string;
  url?: string;
  buffer?: Buffer;
  filename?: string;
  mimetype?: string;
}): Promise<{ url: string; publicId?: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new BadRequestException("Cloudinary is not configured");
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
