import { createHmac, timingSafeEqual } from "crypto";

const PREFIX = "dd1.";
const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60;

export type SessionPayload = {
  v: 1;
  email: string;
  uid: string;
  exp: number;
};

function secret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.INTERNAL_TOKEN ||
    "dev-internal"
  );
}

function signBody(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function mintSessionToken(input: {
  email: string;
  uid: string;
  ttlSec?: number;
}) {
  const payload: SessionPayload = {
    v: 1,
    email: input.email.toLowerCase().trim(),
    uid: input.uid,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSec ?? DEFAULT_TTL_SEC),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${PREFIX}${body}.${signBody(body)}`;
}

export function parseSessionToken(token: string): SessionPayload | null {
  if (!token.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const lastDot = rest.lastIndexOf(".");
  if (lastDot < 1) return null;
  const body = rest.slice(0, lastDot);
  const sig = rest.slice(lastDot + 1);
  const expected = signBody(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (payload?.v !== 1 || !payload.email || !payload.uid) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function allowDevAuthBypass() {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.DEV_AUTH_BYPASS ?? "true") !== "false";
}
