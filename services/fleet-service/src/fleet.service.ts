import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InspectionType, Prisma, VehicleStatus } from "@prisma/client";
import type { AuthUser } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { internalFetch, serviceUrls } from "./lib/http";
import {
  VEHICLE_DOC_KINDS,
  VEHICLE_STATUSES,
  assertPartnerContractActive,
  assertVehicleInScope,
  normalizeDocKind,
  normalizeRegistration,
  parseExpiry,
  vehicleScopeWhere,
} from "./lib/vehicle-rules";

@Injectable()
export class FleetEngine {
  cities() {
    return prisma.city.findMany({ include: { branches: true }, orderBy: { name: "asc" } });
  }
  createCity(body: { name: string; slug: string; state: string; active?: boolean }) {
    return prisma.city.create({ data: body });
  }
  updateCity(id: string, body: Record<string, unknown>) {
    return prisma.city.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        state: body.state != null ? String(body.state) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
      },
    });
  }
  deleteCity(id: string) {
    return prisma.city.delete({ where: { id } });
  }

  branches(cityId?: string) {
    return prisma.branch.findMany({
      where: cityId ? { cityId } : undefined,
      include: { city: true },
    });
  }
  createBranch(body: { cityId: string; name: string; address: string; active?: boolean }) {
    return prisma.branch.create({ data: body });
  }
  updateBranch(id: string, body: Record<string, unknown>) {
    return prisma.branch.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        address: body.address != null ? String(body.address) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
      },
    });
  }
  deleteBranch(id: string) {
    return prisma.branch.delete({ where: { id } });
  }

  vehicles(
    user: AuthUser,
    query: { branchId?: string; cityId?: string; status?: string; partnerId?: string; q?: string } = {}
  ) {
    const status = query.status && VEHICLE_STATUSES.includes(query.status as (typeof VEHICLE_STATUSES)[number])
      ? (query.status as VehicleStatus)
      : undefined;
    return prisma.vehicle.findMany({
      where: {
        ...vehicleScopeWhere(user),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.cityId ? { branch: { cityId: query.cityId } } : {}),
        ...(status ? { status } : {}),
        ...(query.partnerId ? { partnerId: query.partnerId } : {}),
        ...(query.q
          ? { registration: { contains: normalizeRegistration(query.q), mode: "insensitive" } }
          : {}),
      },
      include: this.vehicleInclude(),
      orderBy: { registration: "asc" },
    });
  }

  async getVehicle(user: AuthUser, id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        ...this.vehicleInclude(),
        odometerLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    assertVehicleInScope(user, vehicle);
    return vehicle;
  }

  async createVehicle(
    user: AuthUser,
    body: {
      registration: string;
      carModelId: string;
      branchId: string;
      ownerType?: "COMPANY" | "PARTNER";
      partnerId?: string;
      year?: number;
      color?: string;
      odometerKm?: number;
      status?: VehicleStatus;
    }
  ) {
    const registration = normalizeRegistration(body.registration);
    if (!registration) throw new BadRequestException("Registration required");
    if (!body.carModelId) throw new BadRequestException("carModelId required");
    if (!body.branchId) throw new BadRequestException("branchId required");
    await this.assertBranchInScope(user, body.branchId);
    const ownerType = body.ownerType === "PARTNER" || body.partnerId ? "PARTNER" : "COMPANY";
    const partnerId = ownerType === "PARTNER" ? body.partnerId || null : null;
    if (ownerType === "PARTNER") await assertPartnerContractActive(partnerId);
    const odometerKm = Math.max(0, Number(body.odometerKm) || 0);
    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          registration,
          carModelId: body.carModelId,
          branchId: body.branchId,
          ownerType,
          partnerId,
          year: body.year != null ? Number(body.year) : undefined,
          color: body.color,
          odometerKm,
          status: body.status && VEHICLE_STATUSES.includes(body.status) ? body.status : "AVAILABLE",
        },
        include: this.vehicleInclude(),
      });
      if (odometerKm) {
        await this.logOdometer(vehicle.id, odometerKm, "CREATE", user.id);
      }
      await this.audit(user.id, "vehicle.create", vehicle.id, { registration, branchId: body.branchId });
      return vehicle;
    } catch (err) {
      this.rethrowUniqueReg(err);
    }
  }

  async updateVehicle(user: AuthUser, id: string, body: Record<string, unknown>) {
    const existing = await this.requireVehicle(user, id);
    const data: Prisma.VehicleUpdateInput = {};
    if (body.registration != null) data.registration = normalizeRegistration(String(body.registration));
    if (body.carModelId != null) data.carModel = { connect: { id: String(body.carModelId) } };
    if (body.color != null) data.color = String(body.color);
    if (body.year != null) data.year = Number(body.year);
    if (body.branchId != null) {
      throw new BadRequestException("Use POST /v1/admin/vehicles/:id/transfer-branch to move a vehicle");
    }
    if (body.status != null) {
      const status = String(body.status) as VehicleStatus;
      if (!VEHICLE_STATUSES.includes(status)) throw new BadRequestException("Invalid status");
      this.assertStatusChange(existing.status, status);
      data.status = status;
    }
    if (body.ownerType != null || body.partnerId !== undefined) {
      const ownerType =
        body.ownerType === "PARTNER" || (body.partnerId != null && String(body.partnerId))
          ? "PARTNER"
          : body.ownerType === "COMPANY"
            ? "COMPANY"
            : existing.ownerType;
      if (ownerType === "PARTNER") {
        const partnerId = body.partnerId != null ? String(body.partnerId) : existing.partnerId;
        await assertPartnerContractActive(partnerId);
        data.ownerType = "PARTNER";
        data.partner = partnerId ? { connect: { id: partnerId } } : undefined;
      } else {
        data.ownerType = "COMPANY";
        data.partner = { disconnect: true };
      }
    }
    let nextKm: number | undefined;
    if (body.odometerKm != null) {
      nextKm = Math.max(0, Number(body.odometerKm));
      if (nextKm < existing.odometerKm) {
        throw new BadRequestException("Odometer cannot go backwards");
      }
      data.odometerKm = nextKm;
    }
    try {
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data,
        include: this.vehicleInclude(),
      });
      if (nextKm != null && nextKm !== existing.odometerKm) {
        await this.logOdometer(id, nextKm, "MANUAL", user.id, body.notes != null ? String(body.notes) : undefined);
      }
      await this.audit(user.id, "vehicle.update", id, body);
      return vehicle;
    } catch (err) {
      this.rethrowUniqueReg(err);
    }
  }

  async deleteVehicle(user: AuthUser, id: string) {
    const vehicle = await this.requireVehicle(user, id);
    const open = await prisma.booking.count({
      where: {
        vehicleId: id,
        status: { notIn: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
      },
    });
    if (open) throw new BadRequestException("Vehicle has an open booking — mark SOLD or BLOCKED instead");
    await prisma.vehicle.delete({ where: { id } });
    await this.audit(user.id, "vehicle.delete", id, { registration: vehicle.registration });
    return { ok: true };
  }

  async transferBranch(
    user: AuthUser,
    id: string,
    body: { branchId: string; odometerKm?: number; notes?: string }
  ) {
    if (!body.branchId) throw new BadRequestException("branchId required");
    const vehicle = await this.requireVehicle(user, id);
    if (vehicle.status === "ON_TRIP") {
      throw new BadRequestException("Cannot transfer a vehicle that is on a trip");
    }
    if (vehicle.branchId === body.branchId) {
      throw new BadRequestException("Vehicle is already at that branch");
    }
    const dest = await prisma.branch.findUnique({ where: { id: body.branchId }, include: { city: true } });
    if (!dest) throw new NotFoundException("Branch not found");
    if (!dest.active) throw new BadRequestException("Destination branch is inactive");
    if (user.roles.includes("CITY_MANAGER") && user.cityId && dest.cityId !== user.cityId) {
      throw new BadRequestException("Cannot transfer outside your city");
    }
    let odometerKm = vehicle.odometerKm;
    if (body.odometerKm != null) {
      odometerKm = Math.max(0, Number(body.odometerKm));
      if (odometerKm < vehicle.odometerKm) throw new BadRequestException("Odometer cannot go backwards");
    }
    const updated = await prisma.vehicle.update({
      where: { id },
      data: { branchId: dest.id, odometerKm },
      include: this.vehicleInclude(),
    });
    if (odometerKm !== vehicle.odometerKm) {
      await this.logOdometer(id, odometerKm, "TRANSFER", user.id, body.notes);
    }
    await this.audit(user.id, "vehicle.transfer-branch", id, {
      fromBranchId: vehicle.branchId,
      toBranchId: dest.id,
      notes: body.notes,
    });
    return updated;
  }

  async addDocument(
    user: AuthUser,
    vehicleId: string,
    body: { kind: string; url: string; expiresAt?: string | null }
  ) {
    await this.requireVehicle(user, vehicleId);
    const kind = normalizeDocKind(body.kind);
    if (!VEHICLE_DOC_KINDS.includes(kind as (typeof VEHICLE_DOC_KINDS)[number])) {
      throw new BadRequestException(`kind must be one of ${VEHICLE_DOC_KINDS.join(", ")}`);
    }
    if (!body.url) throw new BadRequestException("url required");
    if ((kind === "INSURANCE" || kind === "PUC" || kind === "PERMIT") && !body.expiresAt) {
      throw new BadRequestException(`${kind} needs an expiry date`);
    }
    const doc = await prisma.vehicleDocument.create({
      data: {
        vehicleId,
        kind,
        url: String(body.url),
        expiresAt: parseExpiry(body.expiresAt),
      },
    });
    await this.audit(user.id, "vehicle.document.create", vehicleId, { kind, docId: doc.id });
    return doc;
  }

  async updateDocument(
    user: AuthUser,
    vehicleId: string,
    docId: string,
    body: Record<string, unknown>
  ) {
    await this.requireVehicle(user, vehicleId);
    const existing = await prisma.vehicleDocument.findFirst({ where: { id: docId, vehicleId } });
    if (!existing) throw new NotFoundException("Document not found");
    const kind = body.kind != null ? normalizeDocKind(String(body.kind)) : existing.kind;
    if (!VEHICLE_DOC_KINDS.includes(kind as (typeof VEHICLE_DOC_KINDS)[number])) {
      throw new BadRequestException(`kind must be one of ${VEHICLE_DOC_KINDS.join(", ")}`);
    }
    return prisma.vehicleDocument.update({
      where: { id: docId },
      data: {
        kind,
        url: body.url != null ? String(body.url) : undefined,
        expiresAt:
          body.expiresAt === null
            ? null
            : body.expiresAt != null
              ? parseExpiry(String(body.expiresAt))
              : undefined,
      },
    });
  }

  async deleteDocument(user: AuthUser, vehicleId: string, docId: string) {
    await this.requireVehicle(user, vehicleId);
    const existing = await prisma.vehicleDocument.findFirst({ where: { id: docId, vehicleId } });
    if (!existing) throw new NotFoundException("Document not found");
    await prisma.vehicleDocument.delete({ where: { id: docId } });
    await this.audit(user.id, "vehicle.document.delete", vehicleId, { kind: existing.kind, docId });
    return { ok: true };
  }

  drivers() {
    return prisma.driver.findMany({ include: { branch: true, documents: true } });
  }
  createDriver(body: { fullName: string; phone: string; branchId: string; active?: boolean }) {
    return prisma.driver.create({ data: body });
  }
  updateDriver(id: string, body: Record<string, unknown>) {
    return prisma.driver.update({
      where: { id },
      data: {
        fullName: body.fullName != null ? String(body.fullName) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
        branchId: body.branchId != null ? String(body.branchId) : undefined,
      },
    });
  }
  deleteDriver(id: string) {
    return prisma.driver.delete({ where: { id } });
  }

  async handover(bookingId: string, body: {
    odometerKm: number;
    fuelLevel: string;
    notes?: string;
    photos?: string[];
  }) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking?.vehicleId) throw new NotFoundException("Booking or vehicle missing");
    if (booking.rentalType === "SELF_DRIVE") {
      const kyc =
        (await prisma.kycCase.findFirst({ where: { bookingId: booking.id, status: "APPROVED" } })) ||
        (await prisma.kycCase.findFirst({
          where: {
            userId: booking.userId,
            status: "APPROVED",
            validUntil: { gte: new Date() },
          },
          orderBy: { createdAt: "desc" },
        }));
      if (!kyc) {
        throw new BadRequestException("Self-drive handover needs approved KYC");
      }
      if (kyc.dlExpiresOn && kyc.dlExpiresOn.getTime() < booking.endsAt.getTime()) {
        throw new BadRequestException("Driving licence expires before drop-off");
      }
      const signed = await prisma.agreement.findFirst({
        where: { bookingId: booking.id, status: { in: ["SIGNED", "WAIVED"] } },
      });
      if (!signed) {
        throw new BadRequestException("Self-drive handover needs a signed agreement");
      }
    }
    const inspection = await prisma.inspection.create({
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        type: "HANDOVER" as InspectionType,
        odometerKm: body.odometerKm,
        fuelLevel: body.fuelLevel,
        notes: body.notes,
        photos: {
          create: (body.photos ?? []).map((url) => ({ url })),
        },
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "ONGOING" },
    });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, from: booking.status, to: "ONGOING", reason: "handover" },
    });
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: "ON_TRIP", odometerKm: body.odometerKm },
    });
    await this.logOdometer(booking.vehicleId, body.odometerKm, "HANDOVER");
    return inspection;
  }

  async returnVehicle(bookingId: string, body: {
    odometerKm: number;
    fuelLevel: string;
    notes?: string;
    photos?: string[];
    damages?: { description: string; amountPaise: number }[];
  }) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking?.vehicleId) throw new NotFoundException("Booking or vehicle missing");
    const inspection = await prisma.inspection.create({
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        type: "RETURN",
        odometerKm: body.odometerKm,
        fuelLevel: body.fuelLevel,
        notes: body.notes,
        photos: { create: (body.photos ?? []).map((url) => ({ url })) },
        damages: { create: body.damages ?? [] },
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "COMPLETED" },
    });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: booking.id, from: booking.status, to: "COMPLETED", reason: "return" },
    });
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: {
        status: "AVAILABLE",
        odometerKm: body.odometerKm,
        branchId: booking.dropBranchId,
      },
    });
    await this.logOdometer(booking.vehicleId, body.odometerKm, "RETURN");
    await internalFetch(
      serviceUrls().catalog,
      "/internal/availability/release",
      { method: "POST", body: JSON.stringify({ bookingId: booking.id }) }
    ).catch(() => undefined);
    await internalFetch(
      serviceUrls().partner,
      "/internal/ledger/trip-complete",
      { method: "POST", body: JSON.stringify({ bookingId: booking.id }) }
    ).catch(() => undefined);
    // Auto-release security deposit after return inspection
    await internalFetch(
      serviceUrls().payment,
      "/internal/deposits/release-by-booking",
      { method: "POST", body: JSON.stringify({ bookingId: booking.id }) }
    ).catch(() => undefined);
    return inspection;
  }

  listAirports(cityId?: string) {
    return prisma.airportTerminal.findMany({
      where: {
        active: true,
        ...(cityId ? { cityId } : {}),
      },
      include: { city: { select: { id: true, name: true, slug: true } } },
      orderBy: { name: "asc" },
    });
  }

  adminAirports(cityId?: string) {
    return prisma.airportTerminal.findMany({
      where: cityId ? { cityId } : undefined,
      include: { city: { select: { id: true, name: true, slug: true } } },
      orderBy: { name: "asc" },
    });
  }

  createAirport(body: {
    cityId: string;
    name: string;
    code: string;
    freeWaitMinutes?: number;
    waitPaisePerMin?: number;
    nightSurchargePaise?: number;
    nightStartsHour?: number;
    nightEndsHour?: number;
    active?: boolean;
  }) {
    if (!body.cityId || !body.name || !body.code) {
      throw new BadRequestException("cityId, name and code required");
    }
    return prisma.airportTerminal.create({
      data: {
        cityId: body.cityId,
        name: body.name,
        code: body.code.trim().toUpperCase(),
        freeWaitMinutes: body.freeWaitMinutes ?? 45,
        waitPaisePerMin: body.waitPaisePerMin ?? 500,
        nightSurchargePaise: body.nightSurchargePaise ?? 20000,
        nightStartsHour: body.nightStartsHour ?? 22,
        nightEndsHour: body.nightEndsHour ?? 6,
        active: body.active ?? true,
      },
    });
  }

  updateAirport(id: string, body: Record<string, unknown>) {
    return prisma.airportTerminal.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        code: body.code != null ? String(body.code).trim().toUpperCase() : undefined,
        freeWaitMinutes: body.freeWaitMinutes != null ? Number(body.freeWaitMinutes) : undefined,
        waitPaisePerMin: body.waitPaisePerMin != null ? Number(body.waitPaisePerMin) : undefined,
        nightSurchargePaise: body.nightSurchargePaise != null ? Number(body.nightSurchargePaise) : undefined,
        nightStartsHour: body.nightStartsHour != null ? Number(body.nightStartsHour) : undefined,
        nightEndsHour: body.nightEndsHour != null ? Number(body.nightEndsHour) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
        cityId: body.cityId != null ? String(body.cityId) : undefined,
      },
    });
  }

  deleteAirport(id: string) {
    return prisma.airportTerminal.delete({ where: { id } });
  }

  async expiries(user: AuthUser, days = 30) {
    const windowDays = Math.min(365, Math.max(1, Number(days) || 30));
    const soon = new Date();
    soon.setDate(soon.getDate() + windowDays);
    const now = new Date();
    const rows = await prisma.vehicleDocument.findMany({
      where: {
        expiresAt: { lte: soon },
        vehicle: vehicleScopeWhere(user),
      },
      include: {
        vehicle: {
          include: {
            carModel: { select: { id: true, name: true } },
            branch: { include: { city: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { expiresAt: "asc" },
    });
    return rows.map((row) => {
      const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
      const daysLeft = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000)
        : null;
      return {
        ...row,
        expired: daysLeft != null && daysLeft < 0,
        daysLeft,
      };
    });
  }

  private vehicleInclude() {
    return {
      carModel: { select: { id: true, name: true, slug: true, type: true } },
      branch: { include: { city: { select: { id: true, name: true, slug: true } } } },
      partner: { select: { id: true, name: true, active: true, contracts: true } },
      documents: { orderBy: { createdAt: "desc" as const } },
    };
  }

  private async requireVehicle(user: AuthUser, id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { branch: true, documents: true },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    assertVehicleInScope(user, vehicle);
    return vehicle;
  }

  private async assertBranchInScope(user: AuthUser, branchId: string) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException("Branch not found");
    if (!branch.active) throw new BadRequestException("Branch is inactive");
    assertVehicleInScope(user, { branchId: branch.id, branch: { cityId: branch.cityId } });
    return branch;
  }

  private assertStatusChange(from: VehicleStatus, to: VehicleStatus) {
    if (from === to) return;
    if (from === "ON_TRIP" && to !== "AVAILABLE" && to !== "MAINTENANCE") {
      throw new BadRequestException("Finish or return the trip before changing status");
    }
    if (from === "SOLD" && to !== "AVAILABLE") {
      throw new BadRequestException("Sold vehicles can only be restored to AVAILABLE");
    }
  }

  private async logOdometer(vehicleId: string, km: number, source: string, actorId?: string, notes?: string) {
    await prisma.vehicleOdometerLog.create({
      data: { vehicleId, km, source, actorId, notes },
    });
  }

  private async audit(actorId: string | undefined, action: string, entityId: string, payload: unknown) {
    await prisma.auditLog.create({
      data: { actorId, action, entity: "Vehicle", entityId, payload: payload as object },
    });
  }

  private rethrowUniqueReg(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BadRequestException("Registration already exists");
    }
    throw err;
  }
}
