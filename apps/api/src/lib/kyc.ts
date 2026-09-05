import { createHash, timingSafeEqual } from "crypto";
import { BadRequestException } from "@nestjs/common";

export const KYC_KINDS = ["AADHAAR", "PAN", "DL", "SELFIE", "ADDRESS"] as const;
export type KycKind = (typeof KYC_KINDS)[number];

export const KYC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const KYC_MAX_BYTES = 8 * 1024 * 1024;
export const KYC_REUSE_DAYS = 365;
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizeKind(kind: string | undefined): KycKind {
  const value = String(kind ?? "DL").trim().toUpperCase().replace(/\s+/g, "_");
  const mapped: Record<string, KycKind> = {
    DL: "DL",
    DRIVING_LICENCE: "DL",
    DRIVING_LICENSE: "DL",
    LICENCE: "DL",
    LICENSE: "DL",
    AADHAAR: "AADHAAR",
    AADHAR: "AADHAAR",
    UID: "AADHAAR",
    PAN: "PAN",
    SELFIE: "SELFIE",
    SELFIE_WITH_ID: "SELFIE",
    ADDRESS: "ADDRESS",
    ADDRESS_PROOF: "ADDRESS",
    ID: "AADHAAR",
  };
  const kindName = mapped[value];
  if (!kindName) {
    throw new BadRequestException(`Unknown document kind. Use ${KYC_KINDS.join(", ")}`);
  }
  return kindName;
}

export function assertKycMime(mimetype: string | undefined, filename?: string) {
  const mime = String(mimetype ?? "").toLowerCase();
  const ext = String(filename ?? "").split(".").pop()?.toLowerCase();
  const byExt =
    ext === "pdf"
      ? "application/pdf"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "";
  const resolved = mime || byExt;
  if (!KYC_MIME.has(resolved) && !KYC_MIME.has(byExt)) {
    throw new BadRequestException("File must be PDF, JPG, PNG, or WebP");
  }
  return resolved || "application/octet-stream";
}

function pepper() {
  return process.env.KYC_HASH_PEPPER || process.env.SESSION_SECRET || "dev-kyc-pepper";
}

export function hashSecret(value: string) {
  return createHash("sha256").update(`${pepper()}:${value}`).digest("hex");
}

export function normalizeAadhaar(raw: string | undefined | null) {
  if (raw == null || raw === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (!AADHAAR_RE.test(digits)) {
    throw new BadRequestException("Aadhaar must be 12 digits");
  }
  return digits;
}

export function normalizePan(raw: string | undefined | null) {
  if (raw == null || raw === "") return null;
  const pan = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!pan) return null;
  if (!PAN_RE.test(pan)) {
    throw new BadRequestException("PAN must look like ABCDE1234F");
  }
  return pan;
}

export function identityStamp(kind: "AADHAAR" | "PAN", value: string) {
  return {
    last4: value.slice(-4),
    hash: hashSecret(`${kind}:${value}`),
  };
}

export function parseDlExpiry(raw: string | Date | undefined | null): Date | null {
  if (raw == null || raw === "") return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Driving licence expiry is not a valid date");
  }
  return date;
}

export function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 86_400_000);
}

export function kycValidUntil(approvedAt: Date, dlExpiresOn?: Date | null) {
  const horizon = addDays(approvedAt, KYC_REUSE_DAYS);
  if (dlExpiresOn && dlExpiresOn.getTime() < horizon.getTime()) return dlExpiresOn;
  return horizon;
}

export function isReusable(input: {
  status?: string | null;
  validUntil?: Date | null;
  dlExpiresOn?: Date | null;
  dropOff?: Date | null;
}) {
  if (input.status !== "APPROVED") return false;
  const now = Date.now();
  if (input.validUntil && input.validUntil.getTime() < now) return false;
  if (input.dlExpiresOn && input.dropOff && input.dlExpiresOn.getTime() < input.dropOff.getTime()) {
    return false;
  }
  if (input.dlExpiresOn && !input.dropOff && input.dlExpiresOn.getTime() < now) return false;
  return true;
}

export function assertDlCoversDropOff(dlExpiresOn: Date | null, dropOff?: Date | null) {
  if (!dlExpiresOn) return;
  const limit = dropOff ?? new Date();
  if (dlExpiresOn.getTime() < limit.getTime()) {
    throw new BadRequestException(
      dropOff
        ? "Driving licence expires before the planned drop-off"
        : "Driving licence has expired"
    );
  }
}

export function timingSafeMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function stripSensitiveZoho(payload: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...payload };
  for (const key of Object.keys(next)) {
    if (/aadha?ar/i.test(key) || /^pan$/i.test(key) || /pan_number/i.test(key)) {
      const value = String(next[key] ?? "");
      next[key] = value ? `****${value.replace(/\s+/g, "").slice(-4)}` : "";
    }
  }
  return next;
}

export function pickZohoString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = payload[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const found = Object.entries(payload).find(
      ([name, value]) => name.toLowerCase() === key.toLowerCase() && value != null && String(value).trim()
    );
    if (found) return String(found[1]).trim();
  }
  return "";
}

export function parseZohoDate(raw: string) {
  if (!raw) return null;
  const cleaned = raw.replace(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, (_, d, m, y) => {
    const year = String(y).length === 2 ? `20${y}` : y;
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
}
