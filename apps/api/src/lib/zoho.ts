import { createHmac } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { pickZohoString, timingSafeMatch } from "./kyc";
import { uploadToCloudinary } from "./cloudinary";

const FORM = () => process.env.ZOHO_FORM_LINK_NAME || "CONSENTFORMFORCARHIRE";
const ZOHO_ACCOUNTS = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in";
const ZOHO_API = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.in";

let cachedToken: { value: string; exp: number } | null = null;

export function verifyZohoWebhook(secretHeader: string | undefined, rawBody: string) {
  const secret = process.env.ZOHO_WEBHOOK_SECRET?.trim();
  const production = process.env.NODE_ENV === "production";
  if (!secret) {
    if (production) throw new UnauthorizedException("Zoho webhook secret is not configured");
    return { ok: true, skipped: true };
  }
  const header = String(secretHeader ?? "").trim();
  if (!header) throw new UnauthorizedException("Missing Zoho webhook secret");
  if (timingSafeMatch(header, secret)) return { ok: true, skipped: false };
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (timingSafeMatch(header, expected) || timingSafeMatch(header, `sha256=${expected}`)) {
    return { ok: true, skipped: false };
  }
  throw new UnauthorizedException("Invalid Zoho webhook signature");
}

async function zohoAccessToken() {
  const refresh = process.env.ZOHO_REFRESH_TOKEN?.trim();
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  if (!refresh || !clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.value;
  const params = new URLSearchParams({
    refresh_token: refresh,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) return null;
  cachedToken = {
    value: data.access_token,
    exp: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
  };
  return cachedToken.value;
}

export async function fetchZohoAttachments(payload: Record<string, unknown>) {
  const recordId =
    pickZohoString(payload, ["record_id", "Record_ID", "zf_record_id", "ID", "id"]) || "";
  const token = await zohoAccessToken();
  if (!token || !recordId) return [] as { kind: string; url: string; publicId?: string }[];

  const res = await fetch(
    `${ZOHO_API}/api/v2/forms/${FORM()}/records/${encodeURIComponent(recordId)}/attachments`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
  const data = (await res.json().catch(() => ({}))) as {
    data?: { field_label?: string; file_name?: string }[];
  };
  const files = data.data ?? [];
  const uploaded: { kind: string; url: string; publicId?: string }[] = [];
  for (const file of files) {
    const name = file.file_name;
    if (!name) continue;
    const download = `${ZOHO_API}/api/v2/forms/${FORM()}/attachment/${encodeURIComponent(recordId)}/${encodeURIComponent(name)}`;
    const fileRes = await fetch(download, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (!fileRes.ok) continue;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const kindHint = String(file.field_label ?? name).toLowerCase();
    const kind = kindHint.includes("pan")
      ? "PAN"
      : kindHint.includes("self")
        ? "SELFIE"
        : kindHint.includes("dl") || kindHint.includes("licen")
          ? "DL"
          : kindHint.includes("address")
            ? "ADDRESS"
            : "AADHAAR";
    const stored = await uploadToCloudinary({
      folder: "dreamdrive/kyc",
      buffer,
      filename: name,
      mimetype: fileRes.headers.get("content-type") || undefined,
    }).catch(() => null);
    if (stored?.url) uploaded.push({ kind, url: stored.url, publicId: stored.publicId });
  }
  return uploaded;
}

export function zohoOAuthReady() {
  return Boolean(
    process.env.ZOHO_REFRESH_TOKEN?.trim() &&
      process.env.ZOHO_CLIENT_ID?.trim() &&
      process.env.ZOHO_CLIENT_SECRET?.trim()
  );
}
