import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "./auth";
import { isSuper } from "./auth";
import { prisma } from "./prisma";

export const VEHICLE_DOC_KINDS = ["RC", "INSURANCE", "PUC", "PERMIT", "FITNESS"] as const;
export type VehicleDocKind = (typeof VEHICLE_DOC_KINDS)[number];

export const DRIVER_DOC_KINDS = ["DL", "BADGE", "ID", "POLICE_VERIFICATION"] as const;
export type DriverDocKind = (typeof DRIVER_DOC_KINDS)[number];

export const DRIVER_BUSY_STATUSES = ["HANDOVER", "ONGOING", "RETURN_PENDING"] as const;
export const DRIVER_ASSIGNED_STATUSES = ["CONFIRMED", "HANDOVER", "ONGOING", "RETURN_PENDING"] as const;

export const VEHICLE_STATUSES = ["AVAILABLE", "ON_TRIP", "MAINTENANCE", "BLOCKED", "SOLD"] as const;

export function normalizeRegistration(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function normalizeDocKind(raw: string) {
  const kind = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (kind === "RC_BOOK" || kind === "REGISTRATION" || kind === "REG") return "RC";
  if (kind === "INS" || kind === "POLICY") return "INSURANCE";
  if (kind === "POLLUTION") return "PUC";
  return kind;
}

export function parseExpiry(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  const raw = String(value).trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("Invalid expiry date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) parsed.setUTCHours(23, 59, 59, 999);
  return parsed;
}

export function insuranceCovers(
  documents: { kind: string; expiresAt: Date | null }[],
  until: Date
) {
  return documents.some((doc) => {
    const kind = normalizeDocKind(doc.kind);
    return kind === "INSURANCE" && doc.expiresAt != null && doc.expiresAt >= until;
  });
}

export function normalizeDriverDocKind(raw: string) {
  const kind = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (kind === "LICENCE" || kind === "LICENSE" || kind === "DRIVING_LICENCE" || kind === "DRIVING_LICENSE") {
    return "DL";
  }
  if (kind === "BADGE_NUMBER" || kind === "CHAUFFEUR_BADGE") return "BADGE";
  if (kind === "AADHAAR" || kind === "AADHAR" || kind === "IDENTITY") return "ID";
  if (kind === "PV" || kind === "POLICE" || kind === "BACKGROUND") return "POLICE_VERIFICATION";
  return kind;
}

export function dlCovers(
  documents: { kind: string; expiresAt: Date | null }[],
  until: Date
) {
  return documents.some((doc) => {
    const kind = normalizeDriverDocKind(doc.kind);
    return kind === "DL" && doc.expiresAt != null && doc.expiresAt >= until;
  });
}

export function normalizeDriverPhone(raw: string) {
  let phone = String(raw || "").replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new BadRequestException("Valid Indian mobile number required");
  }
  return phone;
}

export async function assertPartnerContractActive(
  partnerId: string | null | undefined,
  from?: Date,
  to?: Date
) {
  if (!partnerId) throw new BadRequestException("Partner vehicle needs a partner");
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { contracts: true },
  });
  if (!partner) throw new BadRequestException("Partner not found");
  if (!partner.active) throw new BadRequestException("Partner is inactive");
  const start = from ?? new Date();
  const end = to ?? start;
  const covers = partner.contracts.some(
    (contract) => contract.startsOn <= start && (!contract.endsOn || contract.endsOn >= end)
  );
  if (!covers) {
    throw new BadRequestException("Partner has no active contract covering these dates");
  }
}

const NONE = { in: [] as string[] };

/** Effective city/branch from StaffScope plus the admin shell switcher. */
export function vehicleScopeWhere(user: AuthUser) {
  if (user.branchId) return { branchId: user.branchId };
  if (user.cityId) return { branch: { cityId: user.cityId } };
  if (isSuper(user)) return {};
  return { id: NONE };
}

export function bookingScopeWhere(user: AuthUser) {
  if (user.branchId) return { pickupBranchId: user.branchId };
  if (user.cityId) return { pickupBranch: { cityId: user.cityId } };
  if (isSuper(user)) return {};
  return { id: NONE };
}

/** Org-admin lists (cities, staff) use assigned StaffScope, not the ops switcher. */
export function adminCityWhere(user: AuthUser) {
  if (isSuper(user)) return {};
  if (user.assignedCityId) return { id: user.assignedCityId };
  return { id: NONE };
}

export function adminBranchWhere(user: AuthUser) {
  if (isSuper(user)) return {};
  if (user.roles.includes("CITY_MANAGER") && user.assignedCityId) {
    return { cityId: user.assignedCityId };
  }
  if (user.assignedBranchId) return { id: user.assignedBranchId };
  if (user.assignedCityId) return { cityId: user.assignedCityId };
  return { id: NONE };
}

export function bookingRelationScope(user: AuthUser) {
  const scope = bookingScopeWhere(user);
  return Object.keys(scope).length ? scope : undefined;
}

export function bookingInScope(
  user: AuthUser,
  booking: { pickupBranchId: string; pickupBranch?: { cityId?: string | null } | null }
) {
  if (isSuper(user) && !user.cityId && !user.branchId) return true;
  if (!isSuper(user) && !user.cityId && !user.branchId) return false;
  if (user.branchId) return booking.pickupBranchId === user.branchId;
  if (user.cityId) return !booking.pickupBranch?.cityId || booking.pickupBranch.cityId === user.cityId;
  return true;
}

export function assertVehicleInScope(
  user: AuthUser,
  vehicle: { branchId: string; branch?: { cityId?: string } }
) {
  if (isSuper(user) && !user.cityId && !user.branchId) return;
  if (!isSuper(user) && !user.cityId && !user.branchId) {
    throw new BadRequestException("Vehicle is outside your branch");
  }
  const scope = vehicleScopeWhere(user);
  if ("branchId" in scope && scope.branchId && vehicle.branchId !== scope.branchId) {
    throw new BadRequestException("Vehicle is outside your branch");
  }
  if (
    "branch" in scope &&
    scope.branch?.cityId &&
    vehicle.branch?.cityId &&
    vehicle.branch.cityId !== scope.branch.cityId
  ) {
    throw new BadRequestException("Vehicle is outside your city");
  }
}
