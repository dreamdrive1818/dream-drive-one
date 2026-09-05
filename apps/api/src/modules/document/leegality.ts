import { createHmac } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { timingSafeMatch } from "../../lib/kyc";

export function leegalityBase() {
  return (process.env.LEEGALITY_BASE_URL || "https://app1.leegality.com/api").replace(/\/$/, "");
}

export function leegalityAuthToken() {
  return process.env.LEEGALITY_API_KEY?.trim() || "";
}

export function leegalityProfileId() {
  return process.env.LEEGALITY_PROFILE_ID?.trim() || "";
}

export function leegalityPrivateSalt() {
  return process.env.LEEGALITY_PRIVATE_SALT?.trim() || process.env.LEEGALITY_WEBHOOK_SECRET?.trim() || "";
}

export function leegalityLiveReady() {
  return Boolean(leegalityAuthToken() && leegalityProfileId());
}

function ipAllowlist(): string[] {
  return (process.env.LEEGALITY_IP_ALLOWLIST || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

export function assertLeegalityIp(ip: string | undefined) {
  const allowed = ipAllowlist();
  if (!allowed.length) return { ok: true, skipped: true };
  const value = String(ip || "").replace(/^::ffff:/, "");
  if (allowed.includes(value)) return { ok: true, skipped: false };
  throw new UnauthorizedException("Leegality webhook IP is not allowlisted");
}

function expectedMac(documentId: string, salt: string) {
  return createHmac("sha1", salt).update(documentId).digest("hex");
}

export function verifyLeegalityWebhook(body: Record<string, unknown>, ip?: string) {
  assertLeegalityIp(ip);
  const salt = leegalityPrivateSalt();
  const production = process.env.NODE_ENV === "production";
  const documentId = String(body.documentId ?? body.leegalityId ?? "").trim();
  const mac = String(body.mac ?? body.signature ?? "").trim();

  if (!salt) {
    if (production) throw new UnauthorizedException("Leegality webhook salt is not configured");
    return { ok: true, skipped: true, documentId };
  }
  if (!documentId || !mac) {
    throw new UnauthorizedException("Missing Leegality webhook mac");
  }
  const expected = expectedMac(documentId, salt);
  if (timingSafeMatch(mac.toLowerCase(), expected.toLowerCase())) {
    return { ok: true, skipped: false, documentId };
  }
  throw new UnauthorizedException("Invalid Leegality webhook signature");
}

export type LeegalityInvitee = { name: string; email: string; phone?: string | null };

export async function createLeegalityRequest(input: {
  pdf: Buffer;
  filename: string;
  invitee: LeegalityInvitee;
  irn?: string;
}) {
  const token = leegalityAuthToken();
  const profileId = leegalityProfileId();
  if (!token || !profileId) {
    return { mock: true as const, documentId: "", signUrl: null as string | null };
  }
  const payload = {
    profileId,
    file: {
      name: input.filename,
      file: input.pdf.toString("base64"),
    },
    invitees: [
      {
        name: input.invitee.name,
        email: input.invitee.email,
        phone: String(input.invitee.phone || "").replace(/\D/g, "").slice(-10) || undefined,
      },
    ],
    irn: input.irn,
  };
  const res = await fetch(`${leegalityBase()}/v3.0/sign/request`, {
    method: "POST",
    headers: {
      "X-Auth-Token": token,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: number;
    message?: string;
    data?: {
      documentId?: string;
      expiryDate?: string;
      invitees?: { signUrl?: string; email?: string }[];
    };
  };
  if (!res.ok || data.status === 0 || !data.data?.documentId) {
    throw new Error(data.message || `Leegality request failed (${res.status})`);
  }
  return {
    mock: false as const,
    documentId: data.data.documentId,
    signUrl: data.data.invitees?.[0]?.signUrl ?? null,
    expiryDate: data.data.expiryDate ?? null,
  };
}

export async function fetchLeegalitySignedFile(documentId: string): Promise<{
  url?: string;
  buffer?: Buffer;
  filename?: string;
} | null> {
  const token = leegalityAuthToken();
  if (!token || !documentId) return null;
  const url = new URL(`${leegalityBase()}/v3.3/document/details`);
  url.searchParams.set("documentId", documentId);
  url.searchParams.set("file", "true");
  url.searchParams.set("auditTrail", "true");
  const res = await fetch(url, { headers: { "X-Auth-Token": token } });
  const data = (await res.json().catch(() => ({}))) as {
    data?: {
      files?: { signedFile?: string; file?: string; name?: string }[];
      file?: { signedFile?: string; url?: string };
    };
  };
  const signedUrl =
    data.data?.files?.[0]?.signedFile ||
    data.data?.files?.[0]?.file ||
    data.data?.file?.signedFile ||
    data.data?.file?.url;
  if (!signedUrl) return null;
  const fileRes = await fetch(signedUrl);
  if (!fileRes.ok) return { url: signedUrl };
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { url: signedUrl, buffer, filename: data.data?.files?.[0]?.name || "signed.pdf" };
}
