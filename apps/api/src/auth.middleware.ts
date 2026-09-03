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

const PUBLIC = [
  /^\/v1\/public\//,
  /^\/v1\/auth\/otp\//,
  /^\/v1\/auth\/login$/,
  /^\/v1\/auth\/register$/,
  /^\/v1\/auth\/google$/,
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
    if (path === "/v1/auth/otp/send" && !rateLimitOtp(req.ip ?? "local", 3)) {
      res.status(429).json({ error: "Too many OTP requests" });
      return;
    }
    if (path === "/v1/public/uploads" && !rateLimitOtp(`upload:${req.ip ?? "local"}`, 8)) {
      res.status(429).json({ error: "Too many upload requests" });
      return;
    }

    let user: UserCtx | null = null;
    try {
      user = await this.resolveUser(req.headers.authorization);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in required";
      if (message === "Account disabled") {
        res.status(401).json({ error: "Account disabled" });
        return;
      }
      user = null;
    }

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
      if (user.cityId) req.headers["x-city-id"] = user.cityId;
      if (user.branchId) req.headers["x-branch-id"] = user.branchId;
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
    if (cached && Date.now() - cached.at < 60_000) {
      if (cached.user.status === "DISABLED") return null;
      return cached.user;
    }

    if (token.startsWith("dev:") && allowDevAuthBypass()) {
      const email = token.slice(4).toLowerCase();
      const user = await this.ensureUser({
        firebaseUid: `dev:${email}`,
        email,
        fullName: email.split("@")[0],
      });
      if (user) cache.set(token, { at: Date.now(), user });
      return user;
    }

    const session = parseSessionToken(token);
    if (session) {
      const user = await this.ensureUser({
        firebaseUid: session.uid,
        email: session.email,
      });
      if (user) cache.set(token, { at: Date.now(), user });
      return user;
    }

    const decoded = await this.verifyFirebase(token);
    if (!decoded?.uid || !decoded.email) return null;
    const user = await this.ensureUser({
      firebaseUid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone,
      fullName: decoded.name,
    });
    if (user) cache.set(token, { at: Date.now(), user });
    return user;
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
