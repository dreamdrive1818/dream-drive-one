import { INestApplication } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "http";
import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";
import { URL } from "url";

type UserCtx = {
  id: string;
  email: string;
  roles: string[];
  firebaseUid: string;
  phone?: string | null;
  cityId?: string | null;
  branchId?: string | null;
};

const cache = new Map<string, { at: number; user: UserCtx }>();

const PUBLIC = [
  /^\/v1\/public\//,
  /^\/v1\/auth\/otp\//,
  /^\/v1\/webhooks\//,
];

function urls() {
  return {
    identity: process.env.IDENTITY_URL ?? "http://localhost:4001",
    catalog: process.env.CATALOG_URL ?? "http://localhost:4002",
    booking: process.env.BOOKING_URL ?? "http://localhost:4003",
    payment: process.env.PAYMENT_URL ?? "http://localhost:4004",
    document: process.env.DOCUMENT_URL ?? "http://localhost:4005",
    fleet: process.env.FLEET_URL ?? "http://localhost:4006",
    partner: process.env.PARTNER_URL ?? "http://localhost:4007",
    notification: process.env.NOTIFICATION_URL ?? "http://localhost:4008",
    platform: process.env.PLATFORM_URL ?? "http://localhost:4009",
  };
}

function targetFor(path: string): string {
  const u = urls();
  if (
    path.startsWith("/v1/auth") ||
    path.startsWith("v1/me") ||
    path.startsWith("/v1/me") ||
    path.startsWith("/v1/admin/users") ||
    path.startsWith("/v1/admin/audit")
  )
    return u.identity;
  if (
    path.startsWith("/v1/public/search") ||
    path.startsWith("/v1/public/cars") ||
    path.startsWith("/v1/admin/car-models") ||
    path.startsWith("/v1/admin/pricing-rules")
  )
    return u.catalog;
  if (path.match(/^\/v1\/admin\/bookings\/[^/]+\/(handover|return)/))
    return u.fleet;
  if (
    path.startsWith("/v1/quotes") ||
    path.startsWith("/v1/bookings") ||
    path.startsWith("/v1/subscriptions") ||
    path.startsWith("/v1/public/packages") ||
    path.startsWith("/v1/admin/bookings") ||
    path.startsWith("/v1/admin/packages") ||
    path.startsWith("/v1/admin/city-pairs") ||
    path.startsWith("/v1/me/bookings")
  )
    return u.booking;
  if (
    path.startsWith("/v1/payments") ||
    path.startsWith("/v1/webhooks/razorpay") ||
    path.startsWith("/v1/me/invoices") ||
    path.startsWith("/v1/me/wallet") ||
    path.startsWith("/v1/admin/payments") ||
    path.startsWith("/v1/admin/deposits")
  )
    return u.payment;
  if (
    path.startsWith("v1/kyc") ||
    path.startsWith("/v1/kyc") ||
    path.startsWith("/v1/agreements") ||
    path.startsWith("/v1/me/kyc") ||
    path.startsWith("/v1/me/agreements") ||
    path.startsWith("/v1/admin/kyc") ||
    path.startsWith("/v1/admin/agreements") ||
    path.startsWith("/v1/webhooks/zoho-form") ||
    path.startsWith("/v1/webhooks/leegality")
  )
    return u.document;
  if (path.startsWith("/v1/public/cities")) return u.fleet;
  if (
    path.startsWith("/v1/admin/branches") ||
    path.startsWith("/v1/admin/vehicles") ||
    path.startsWith("/v1/admin/drivers") ||
    path.startsWith("/v1/admin/maintenance")
  )
    return u.fleet;
  if (
    path.startsWith("/v1/admin/partners") ||
    path.startsWith("/v1/admin/settlements")
  )
    return u.partner;
  if (
    path.startsWith("/v1/admin/notifications") ||
    path.startsWith("/v1/admin/notification-templates")
  )
    return u.notification;
  return u.platform;
}

function isPublic(path: string, method: string) {
  if (PUBLIC.some((re) => re.test(path))) return true;
  if (path.startsWith("/v1/public/packages")) return true;
  return false;
}

async function resolveUser(authHeader?: string): Promise<UserCtx | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const cached = cache.get(token);
  if (cached && Date.now() - cached.at < 60_000) return cached.user;

  if (token.startsWith("dev:") && (process.env.DEV_AUTH_BYPASS ?? "true") !== "false") {
    const email = token.slice(4).toLowerCase();
    const user = await ensureUser({
      firebaseUid: `dev:${email}`,
      email,
      fullName: email.split("@")[0],
    });
    if (user) cache.set(token, { at: Date.now(), user });
    return user;
  }

  const decoded = await verifyFirebase(token);
  if (!decoded?.uid || !decoded.email) return null;
  const user = await ensureUser({
    firebaseUid: decoded.uid,
    email: decoded.email,
    phone: decoded.phone,
    fullName: decoded.name,
  });
  if (user) cache.set(token, { at: Date.now(), user });
  return user;
}

async function ensureUser(input: {
  firebaseUid: string;
  email: string;
  phone?: string;
  fullName?: string;
}): Promise<UserCtx | null> {
  const res = await fetch(`${urls().identity}/internal/users/ensure`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": process.env.INTERNAL_TOKEN ?? "dev-internal",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const row = (await res.json()) as UserCtx;
  return row;
}

async function verifyFirebase(token: string): Promise<{
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
} | null> {
  if (!process.env.FIREBASE_PROJECT_ID) return null;
  try {
    const admin = await import("firebase-admin");
    if (!admin.apps.length) {
      const cred = process.env.FIREBASE_CLIENT_EMAIL
        ? {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
          }
        : undefined;
      admin.initializeApp({
        credential: cred
          ? admin.credential.cert(cred)
          : admin.credential.applicationDefault(),
      });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone_number,
      name: decoded.name,
    };
  } catch (err) {
    console.warn("firebase verify failed", err);
    return null;
  }
}

const otpHits = new Map<string, { n: number; at: number }>();

function rateLimitOtp(ip: string) {
  const now = Date.now();
  const row = otpHits.get(ip);
  if (!row || now - row.at > 15 * 60 * 1000) {
    otpHits.set(ip, { n: 1, at: now });
    return true;
  }
  if (row.n >= 8) return false;
  row.n += 1;
  return true;
}

function pipeProxy(
  req: IncomingMessage,
  res: ServerResponse,
  targetBase: string,
  user: UserCtx | null
) {
  const url = new URL(req.url ?? "/", targetBase);
  const isTls = url.protocol === "https:";
  const headers = { ...req.headers, host: url.host } as Record<string, string | string[] | undefined>;
  delete headers["connection"];
  headers["x-internal-token"] = process.env.INTERNAL_TOKEN ?? "dev-internal";
  headers["x-user-id"] = "";
  headers["x-roles"] = "";
  headers["x-email"] = "";
  headers["x-firebase-uid"] = "";
  headers["x-city-id"] = "";
  headers["x-branch-id"] = "";
  if (user) {
    headers["x-user-id"] = user.id;
    headers["x-roles"] = (user.roles ?? []).join(",");
    headers["x-email"] = user.email;
    headers["x-firebase-uid"] = user.firebaseUid;
    if (user.phone) headers["x-phone"] = user.phone;
    if (user.cityId) headers["x-city-id"] = user.cityId;
    if (user.branchId) headers["x-branch-id"] = user.branchId;
  }
  const lib = isTls ? httpsRequest : httpRequest;
  const up = lib(
    {
      hostname: url.hostname,
      port: url.port || (isTls ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
    }
  );
  up.on("error", (err) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "upstream", message: err.message, target: targetBase }));
    }
  });
  req.pipe(up);
}

export function attachGatewayProxy(app: INestApplication) {
  const http = app.getHttpAdapter().getInstance();
  http.use(async (req: IncomingMessage & { originalUrl?: string; ip?: string }, res: ServerResponse, next: () => void) => {
    const path = req.originalUrl?.split("?")[0] ?? req.url?.split("?")[0] ?? "";
    if (!path.startsWith("/v1")) return next();
    if (path.startsWith("/v1/internal")) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (path === "/v1/auth/otp/send" && !rateLimitOtp(req.ip ?? "local")) {
      res.statusCode = 429;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Too many OTP requests" }));
      return;
    }

    const method = req.method ?? "GET";
    let user: UserCtx | null = null;
    try {
      user = await resolveUser(req.headers.authorization as string | undefined);
    } catch {
      user = null;
    }
    if (!isPublic(path, method) && !user) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Sign in required" }));
      return;
    }
    pipeProxy(req, res, targetFor(path), user);
  });
}
