import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { IdentityService } from "./modules/identity/identity.service";
import { allowDevAuthBypass, parseSessionToken } from "./lib/session-token";

type UserCtx = {
  id: string;
  email: string;
  roles: string[];
  firebaseUid: string;
  phone?: string | null;
  cityId?: string | null;
  branchId?: string | null;
  status?: string;
};

const cache = new Map<string, { at: number; user: UserCtx }>();
const refreshing = new Map<string, Promise<UserCtx | null>>();
const FRESH_MS = 180_000;
/** Past FRESH_MS the cached user is served while a background refresh runs. */
const STALE_MS = 30 * 60_000;
const MAX_CACHED_TOKENS = 5000;

const PUBLIC = [
  /^\/v1\/public\//,
  /^\/v1\/auth\/otp\//,
  /^\/v1\/auth\/login$/,
  /^\/v1\/auth\/staff-login$/,
  /^\/v1\/auth\/register$/,
  /^\/v1\/auth\/dev$/,
  /^\/v1\/auth\/google$/,
  /^\/v1\/auth\/facebook$/,
  /^\/v1\/auth\/password\/forgot$/,
  /^\/v1\/auth\/password\/reset$/,
  /^\/v1\/webhooks\//,
];

const STAFF = new Set([
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
]);

const otpHits = new Map<string, { n: number; at: number }>();

function isPublic(path: string) {
  if (PUBLIC.some((re) => re.test(path))) return true;
  if (path.startsWith("/v1/public/packages")) return true;
  return false;
}

function rateLimitOtp(key: string, max = 3) {
  const now = Date.now();
  const row = otpHits.get(key);
  if (!row || now - row.at > 15 * 60 * 1000) {
    otpHits.set(key, { n: 1, at: now });
    return true;
  }
  if (row.n >= max) return false;
  row.n += 1;
  return true;
}

function isStaff(roles: string[]) {
  return roles.some((r) => STAFF.has(r));
}

function headerValue(req: Request, name: string) {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0] || "";
  return typeof raw === "string" ? raw : "";
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly identity: IdentityService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = (req.originalUrl ?? req.url ?? "").split("?")[0];
    if (!path.startsWith("/v1")) return next();
    if (path.startsWith("/v1/internal")) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (
      (path === "/v1/auth/otp/send" || path === "/v1/auth/password/forgot") &&
      !rateLimitOtp(req.ip ?? "local", 3)
    ) {
      res.status(429).json({ error: "Too many OTP requests" });
      return;
    }
    if (path === "/v1/public/uploads" && !rateLimitOtp(`upload:${req.ip ?? "local"}`, 8)) {
      res.status(429).json({ error: "Too many upload requests" });
      return;
    }

    let user: UserCtx | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        user = await this.resolveUser(authHeader);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sign in required";
        if (message === "Account disabled") {
          res.status(401).json({ error: "Account disabled" });
          return;
        }
        user = null;
      }
    }

    const opsCity = headerValue(req, "x-ops-city-id");
    const opsBranch = headerValue(req, "x-ops-branch-id");

    req.headers["x-user-id"] = "";
    req.headers["x-roles"] = "";
    req.headers["x-email"] = "";
    req.headers["x-firebase-uid"] = "";
    req.headers["x-city-id"] = "";
    req.headers["x-branch-id"] = "";
    if (user) {
      req.headers["x-user-id"] = user.id;
      req.headers["x-roles"] = (user.roles ?? []).join(",");
      req.headers["x-email"] = user.email;
      req.headers["x-firebase-uid"] = user.firebaseUid;
      if (user.phone) req.headers["x-phone"] = user.phone;
      if (user.cityId) req.headers["x-assigned-city-id"] = user.cityId;
      if (user.branchId) req.headers["x-assigned-branch-id"] = user.branchId;
      if (opsCity || opsBranch) {
        const scoped = await this.identity.resolveOpsScope(user, opsCity, opsBranch);
        if (scoped.cityId) req.headers["x-city-id"] = scoped.cityId;
        if (scoped.branchId) req.headers["x-branch-id"] = scoped.branchId;
      } else {
        if (user.cityId) req.headers["x-city-id"] = user.cityId;
        if (user.branchId) req.headers["x-branch-id"] = user.branchId;
      }
    }

    if (!isPublic(path) && !user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    if (path.startsWith("/v1/admin") && user && !isStaff(user.roles ?? [])) {
      res.status(403).json({ error: "Staff only" });
      return;
    }
    next();
  }

  private async resolveUser(authHeader?: string): Promise<UserCtx | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const cached = cache.get(token);
    const age = cached ? Date.now() - cached.at : Infinity;
    if (cached && age < STALE_MS) {
      if (cached.user.status === "DISABLED") return null;
      if (age >= FRESH_MS) {
        void this.refreshUser(token).catch((err) => {
          if (err instanceof Error && err.message === "Account disabled") cache.delete(token);
        });
      }
      return cached.user;
    }
    return this.refreshUser(token);
  }

  private refreshUser(token: string): Promise<UserCtx | null> {
    const pending = refreshing.get(token);
    if (pending) return pending;
    const run = this.loadUser(token)
      .then((user) => {
        if (user) {
          if (cache.size >= MAX_CACHED_TOKENS) cache.delete(cache.keys().next().value as string);
          cache.set(token, { at: Date.now(), user });
        } else {
          cache.delete(token);
        }
        return user;
      })
      .finally(() => refreshing.delete(token));
    refreshing.set(token, run);
    return run;
  }

  private async loadUser(token: string): Promise<UserCtx | null> {
    if (token.startsWith("dev:") && allowDevAuthBypass()) {
      const email = token.slice(4).toLowerCase();
      return this.ensureUser({
        firebaseUid: `dev:${email}`,
        email,
        fullName: email.split("@")[0],
      });
    }

    const session = parseSessionToken(token);
    if (session) {
      return this.ensureUser({
        firebaseUid: session.uid,
        email: session.email,
      });
    }

    const decoded = await this.verifyFirebase(token);
    if (!decoded?.uid || !decoded.email) return null;
    return this.ensureUser({
      firebaseUid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone,
      fullName: decoded.name,
    });
  }

  private async ensureUser(input: {
    firebaseUid: string;
    email: string;
    phone?: string;
    fullName?: string;
  }): Promise<UserCtx | null> {
    const row = await this.identity.upsertFromIdentity(input);
    if (!row?.id) return null;
    if (row.status === "DISABLED") {
      throw new Error("Account disabled");
    }
    return {
      id: row.id,
      email: row.email,
      roles: row.roles ?? [],
      firebaseUid: row.firebaseUid,
      phone: row.phone,
      cityId: row.cityId,
      branchId: row.branchId,
      status: row.status,
    };
  }

  private async verifyFirebase(token: string): Promise<{
    uid: string;
    email?: string;
    phone?: string;
    name?: string;
  } | null> {
    try {
      const { firebaseAdmin } = await import("./lib/firebase-admin");
      const admin = await firebaseAdmin();
      if (admin) {
        const decoded = await admin.auth().verifyIdToken(token);
        return {
          uid: decoded.uid,
          email: decoded.email,
          phone: decoded.phone_number,
          name: decoded.name,
        };
      }
    } catch (err) {
      console.warn("firebase admin verify failed, trying tokeninfo", err);
    }
    try {
      const { verifyGoogleOrFirebaseIdToken } = await import("./lib/firebase-rest");
      const decoded = await verifyGoogleOrFirebaseIdToken(token);
      return { uid: decoded.uid, email: decoded.email, name: decoded.name };
    } catch (err) {
      console.warn("firebase verify failed", err);
      return null;
    }
  }
}
