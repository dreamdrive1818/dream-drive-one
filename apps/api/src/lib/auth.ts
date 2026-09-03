import {
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
  cityId?: string;
  branchId?: string;
};

const STAFF = new Set([
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
]);

export function header(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function clientIp(req: Request): string | undefined {
  const forwarded = header(req, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.ip || undefined;
}

export function currentUser(req: Request): AuthUser {
  const id = header(req, "x-user-id");
  if (!id) throw new UnauthorizedException("Sign in required");
  const roles = (header(req, "x-roles") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return {
    id,
    email: header(req, "x-email") ?? "",
    roles,
    cityId: header(req, "x-city-id"),
    branchId: header(req, "x-branch-id"),
  };
}

export function optionalUser(req: Request): AuthUser | null {
  try {
    return currentUser(req);
  } catch {
    return null;
  }
}

export function isStaff(user: AuthUser): boolean {
  return user.roles.some((r) => STAFF.has(r));
}

export function isSuper(user: AuthUser): boolean {
  return user.roles.includes("SUPER_ADMIN");
}

export function requireRoles(req: Request, ...allowed: string[]): AuthUser {
  const user = currentUser(req);
  if (isSuper(user)) return user;
  if (!allowed.some((role) => user.roles.includes(role))) {
    throw new ForbiddenException("Insufficient role");
  }
  return user;
}

export function requireStaff(req: Request): AuthUser {
  const user = currentUser(req);
  if (!isStaff(user)) throw new ForbiddenException("Staff only");
  return user;
}

export function assertInternal(req: Request): void {
  const token = header(req, "x-internal-token");
  const expected = process.env.INTERNAL_TOKEN ?? "dev-internal";
  if (token !== expected) {
    throw new UnauthorizedException("Internal token required");
  }
}

export function assertOwnerOrStaff(
  req: Request,
  ownerId: string
): AuthUser {
  const user = currentUser(req);
  if (user.id === ownerId || isStaff(user)) return user;
  throw new ForbiddenException("Not allowed");
}
