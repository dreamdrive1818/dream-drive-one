import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "./auth";
import { isSuper } from "./auth";
import { prisma } from "./prisma";

export const VEHICLE_DOC_KINDS = ["RC", "INSURANCE", "PUC", "PERMIT", "FITNESS"] as const;
export type VehicleDocKind = (typeof VEHICLE_DOC_KINDS)[number];

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

export function vehicleScopeWhere(user: AuthUser) {
  if (isSuper(user)) return {};
  if (user.roles.includes("BRANCH_MANAGER") && user.branchId) {
    return { branchId: user.branchId };
  }
  if (user.roles.includes("CITY_MANAGER") && user.cityId) {
    return { branch: { cityId: user.cityId } };
  }
  if (user.branchId) return { branchId: user.branchId };
  if (user.cityId) return { branch: { cityId: user.cityId } };
  return {};
}

export function assertVehicleInScope(
  user: AuthUser,
  vehicle: { branchId: string; branch?: { cityId?: string } }
) {
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
