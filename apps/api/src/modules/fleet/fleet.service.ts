import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, VehicleStatus, BookingStatus } from "@prisma/client";
import type { AuthUser } from "../../lib/auth";
import { isSuper } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { internalFetch, serviceUrls } from "../../lib/http";
import {
  DRIVER_ASSIGNED_STATUSES,
  DRIVER_BUSY_STATUSES,
  DRIVER_DOC_KINDS,
  VEHICLE_DOC_KINDS,
  VEHICLE_STATUSES,
  adminBranchWhere,
  adminCityWhere,
  assertPartnerContractActive,
  assertVehicleInScope,
  dlCovers,
  normalizeDocKind,
  normalizeDriverDocKind,
  normalizeDriverPhone,
  normalizeRegistration,
  parseExpiry,
  vehicleScopeWhere,
} from "../../lib/vehicle-rules";

@Injectable()
export class FleetEngine {
  cities() {
    return prisma.city.findMany({
      where: { active: true },
      include: { branches: { where: { active: true } } },
      orderBy: { name: "asc" },
    });
  }

  adminCities(user: AuthUser) {
    return prisma.city.findMany({
      where: adminCityWhere(user),
      include: {
        branches: { orderBy: { name: "asc" } },
        _count: { select: { branches: true, staff: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async getCity(user: AuthUser, id: string) {
    const city = await prisma.city.findUnique({
      where: { id },
      include: { branches: { orderBy: { name: "asc" } }, _count: { select: { branches: true, staff: true } } },
    });
    if (!city) throw new NotFoundException("City not found");
    this.assertCityVisible(user, city.id);
    return city;
  }

  async createCity(user: AuthUser, body: { name: string; slug: string; state: string; active?: boolean }) {
    if (!isSuper(user)) throw new ForbiddenException("Only super admin can create cities");
    const name = String(body.name || "").trim();
    const state = String(body.state || "").trim();
    const slug = slugify(body.slug || name);
    if (!name || !state || !slug) throw new BadRequestException("name, slug and state are required");
    try {
      return await prisma.city.create({
        data: { name, slug, state, active: body.active !== false },
        include: { branches: true },
      });
    } catch (err) {
      this.rethrowUniqueSlug(err);
    }
  }

  async updateCity(user: AuthUser, id: string, body: Record<string, unknown>) {
    await this.getCity(user, id);
    if (!isSuper(user) && !user.roles.includes("CITY_MANAGER")) {
      throw new ForbiddenException("Insufficient role");
    }
    try {
      return await prisma.city.update({
        where: { id },
        data: {
          name: body.name != null ? String(body.name).trim() : undefined,
          slug: body.slug != null ? slugify(String(body.slug)) : undefined,
          state: body.state != null ? String(body.state).trim() : undefined,
          active: body.active != null ? Boolean(body.active) : undefined,
        },
        include: { branches: true },
      });
    } catch (err) {
      this.rethrowUniqueSlug(err);
    }
  }

  async deleteCity(user: AuthUser, id: string) {
    if (!isSuper(user)) throw new ForbiddenException("Only super admin can delete cities");
    const city = await prisma.city.findUnique({
      where: { id },
      include: { _count: { select: { branches: true } } },
    });
    if (!city) throw new NotFoundException("City not found");
    if (city._count.branches) {
      throw new BadRequestException("Delete or move branches before deleting this city");
    }
    await prisma.city.delete({ where: { id } });
    return { ok: true };
  }

  async branches(user: AuthUser, cityId?: string) {
    if (cityId) this.assertCityVisible(user, cityId);
    return prisma.branch.findMany({
      where: {
        ...adminBranchWhere(user),
        ...(cityId ? { cityId } : {}),
      },
      include: {
        city: { select: { id: true, name: true, slug: true, state: true } },
        _count: { select: { vehicles: true, drivers: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async getBranch(user: AuthUser, id: string) {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        city: true,
        _count: { select: { vehicles: true, drivers: true } },
      },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    this.assertCityVisible(user, branch.cityId);
    if (user.assignedBranchId && branch.id !== user.assignedBranchId && !isSuper(user)) {
      throw new ForbiddenException("Cannot see other branches");
    }
    return branch;
  }

  async createBranch(
    user: AuthUser,
    body: { cityId: string; name: string; address: string; active?: boolean }
  ) {
    if (!isSuper(user) && !user.roles.includes("CITY_MANAGER")) {
      throw new ForbiddenException("Insufficient role");
    }
    const cityId = String(body.cityId || "");
    if (!cityId) throw new BadRequestException("cityId required");
    this.assertCityVisible(user, cityId);
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException("City not found");
    if (!city.active) throw new BadRequestException("City is inactive");
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();
    if (!name || !address) throw new BadRequestException("name and address are required");
    return prisma.branch.create({
      data: { cityId, name, address, active: body.active !== false },
      include: { city: true },
    });
  }

  async updateBranch(user: AuthUser, id: string, body: Record<string, unknown>) {
    const branch = await this.getBranch(user, id);
    if (!isSuper(user) && !user.roles.includes("CITY_MANAGER")) {
      throw new ForbiddenException("Insufficient role");
    }
    if (body.cityId && String(body.cityId) !== branch.cityId && !isSuper(user)) {
      throw new ForbiddenException("Cannot move a branch to another city");
    }
    if (body.cityId && String(body.cityId) !== branch.cityId) {
      this.assertCityVisible(user, String(body.cityId));
    }
    return prisma.branch.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name).trim() : undefined,
        address: body.address != null ? String(body.address).trim() : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
        cityId: body.cityId != null ? String(body.cityId) : undefined,
      },
      include: { city: true },
    });
  }

  async deleteBranch(user: AuthUser, id: string) {
    const branch = await this.getBranch(user, id);
    if (!isSuper(user) && !user.roles.includes("CITY_MANAGER")) {
      throw new ForbiddenException("Insufficient role");
    }
    const [vehicles, drivers, openBookings] = await Promise.all([
      prisma.vehicle.count({ where: { branchId: id } }),
      prisma.driver.count({ where: { branchId: id } }),
      prisma.booking.count({
        where: {
          OR: [{ pickupBranchId: id }, { dropBranchId: id }],
          status: { notIn: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
        },
      }),
    ]);
    if (vehicles || drivers) {
      throw new BadRequestException("Move vehicles and drivers before deleting this branch");
    }
    if (openBookings) {
      throw new BadRequestException("Branch has open bookings");
    }
    await prisma.branch.delete({ where: { id: branch.id } });
    return { ok: true };
  }

  private assertCityVisible(user: AuthUser, cityId: string) {
    if (isSuper(user)) return;
    if (user.assignedCityId && user.assignedCityId === cityId) return;
    throw new ForbiddenException("Cannot see other cities");
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
        transfers: { orderBy: { createdAt: "desc" }, take: 10 },
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
      await this.ensureMissingDocuments(vehicle.id);
      return this.getVehicle(user, vehicle.id);
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
    body: { branchId: string; odometerKm?: number; notes?: string; immediate?: boolean }
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
    const pending = await prisma.vehicleTransfer.findFirst({
      where: { vehicleId: id, status: "PENDING" },
    });
    if (pending) throw new BadRequestException("Vehicle already has a pending transfer");
    let odometerKm = vehicle.odometerKm;
    if (body.odometerKm != null) {
      odometerKm = Math.max(0, Number(body.odometerKm));
      if (odometerKm < vehicle.odometerKm) throw new BadRequestException("Odometer cannot go backwards");
    }
    const immediate = body.immediate !== false;
    const job = await prisma.vehicleTransfer.create({
      data: {
        vehicleId: id,
        fromBranchId: vehicle.branchId,
        toBranchId: dest.id,
        status: immediate ? "COMPLETED" : "PENDING",
        fromStatus: vehicle.status,
        odometerKm,
        notes: body.notes,
        actorId: user.id,
        completedAt: immediate ? new Date() : null,
      },
    });
    if (immediate) {
      return this.applyTransfer(user, job.id);
    }
    if (vehicle.status === "AVAILABLE") {
      await prisma.vehicle.update({ where: { id }, data: { status: "BLOCKED" } });
    }
    await this.audit(user.id, "vehicle.transfer-queue", id, {
      transferId: job.id,
      fromBranchId: vehicle.branchId,
      toBranchId: dest.id,
      notes: body.notes,
    });
    return this.getVehicle(user, id);
  }

  listTransfers(user: AuthUser, status?: string) {
    return prisma.vehicleTransfer.findMany({
      where: {
        ...(status ? { status } : {}),
        vehicle: vehicleScopeWhere(user),
      },
      include: {
        vehicle: {
          include: {
            carModel: { select: { id: true, name: true } },
            branch: { include: { city: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async completeTransfer(user: AuthUser, transferId: string) {
    return this.applyTransfer(user, transferId);
  }

  async cancelTransfer(user: AuthUser, transferId: string) {
    const job = await prisma.vehicleTransfer.findUnique({
      where: { id: transferId },
      include: { vehicle: { include: { branch: true } } },
    });
    if (!job) throw new NotFoundException("Transfer not found");
    if (job.status !== "PENDING") throw new BadRequestException("Transfer is not pending");
    assertVehicleInScope(user, job.vehicle);
    await prisma.vehicleTransfer.update({
      where: { id: transferId },
      data: { status: "CANCELLED" },
    });
    if (job.vehicle.status === "BLOCKED" && job.fromStatus === "AVAILABLE") {
      await prisma.vehicle.update({
        where: { id: job.vehicleId },
        data: { status: "AVAILABLE" },
      });
    }
    await this.audit(user.id, "vehicle.transfer-cancel", job.vehicleId, { transferId });
    return this.getVehicle(user, job.vehicleId);
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
        alertedAt: body.expiresAt !== undefined ? null : undefined,
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

  drivers(
    user: AuthUser,
    query: { branchId?: string; cityId?: string; active?: string; q?: string } = {}
  ) {
    const active =
      query.active === "true" ? true : query.active === "false" ? false : undefined;
    const q = String(query.q || "").trim();
    return prisma.driver.findMany({
      where: {
        ...vehicleScopeWhere(user),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.cityId ? { branch: { cityId: query.cityId } } : {}),
        ...(active != null ? { active } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q.replace(/\D/g, "") } },
              ],
            }
          : {}),
      },
      include: this.driverInclude(),
      orderBy: { fullName: "asc" },
    });
  }

  async getDriver(user: AuthUser, id: string) {
    return this.requireDriver(user, id);
  }

  async createDriver(
    user: AuthUser,
    body: { fullName: string; phone: string; branchId: string; active?: boolean }
  ) {
    const fullName = String(body.fullName || "").trim();
    if (!fullName) throw new BadRequestException("fullName required");
    if (!body.branchId) throw new BadRequestException("branchId required");
    const phone = normalizeDriverPhone(body.phone);
    await this.assertBranchInScope(user, body.branchId);
    try {
      const driver = await prisma.driver.create({
        data: {
          fullName,
          phone,
          branchId: body.branchId,
          active: body.active != null ? Boolean(body.active) : true,
        },
        include: this.driverInclude(),
      });
      await this.audit(user.id, "driver.create", driver.id, { phone, branchId: body.branchId }, "Driver");
      return driver;
    } catch (err) {
      this.rethrowUniquePhone(err);
    }
  }

  async updateDriver(user: AuthUser, id: string, body: Record<string, unknown>) {
    await this.requireDriver(user, id);
    if (body.branchId != null) await this.assertBranchInScope(user, String(body.branchId));
    try {
      const driver = await prisma.driver.update({
        where: { id },
        data: {
          fullName: body.fullName != null ? String(body.fullName).trim() : undefined,
          phone: body.phone != null ? normalizeDriverPhone(String(body.phone)) : undefined,
          active: body.active != null ? Boolean(body.active) : undefined,
          branchId: body.branchId != null ? String(body.branchId) : undefined,
        },
        include: this.driverInclude(),
      });
      await this.audit(user.id, "driver.update", id, body, "Driver");
      return driver;
    } catch (err) {
      this.rethrowUniquePhone(err);
    }
  }

  async deleteDriver(user: AuthUser, id: string) {
    await this.requireDriver(user, id);
    const assigned = await prisma.driverAssignment.findFirst({
      where: {
        driverId: id,
        booking: { status: { in: [...DRIVER_ASSIGNED_STATUSES] as BookingStatus[] } },
      },
      include: { booking: { select: { publicId: true, status: true } } },
    });
    if (assigned) {
      throw new BadRequestException(
        `Driver is assigned to ${assigned.booking.publicId} (${assigned.booking.status})`
      );
    }
    await prisma.driver.delete({ where: { id } });
    await this.audit(user.id, "driver.delete", id, {}, "Driver");
    return { ok: true };
  }

  async addDriverDocument(
    user: AuthUser,
    driverId: string,
    body: { kind: string; url: string; expiresAt?: string | null }
  ) {
    await this.requireDriver(user, driverId);
    const kind = normalizeDriverDocKind(body.kind);
    if (!DRIVER_DOC_KINDS.includes(kind as (typeof DRIVER_DOC_KINDS)[number])) {
      throw new BadRequestException(`kind must be one of ${DRIVER_DOC_KINDS.join(", ")}`);
    }
    if (!body.url) throw new BadRequestException("url required");
    if (kind === "DL" && !body.expiresAt) {
      throw new BadRequestException("DL needs an expiry date");
    }
    const doc = await prisma.driverDocument.create({
      data: {
        driverId,
        kind,
        url: String(body.url),
        expiresAt: parseExpiry(body.expiresAt),
      },
    });
    await this.audit(user.id, "driver.document.create", driverId, { kind, docId: doc.id }, "Driver");
    return doc;
  }

  async updateDriverDocument(
    user: AuthUser,
    driverId: string,
    docId: string,
    body: Record<string, unknown>
  ) {
    await this.requireDriver(user, driverId);
    const existing = await prisma.driverDocument.findFirst({ where: { id: docId, driverId } });
    if (!existing) throw new NotFoundException("Document not found");
    const kind = body.kind != null ? normalizeDriverDocKind(String(body.kind)) : existing.kind;
    if (!DRIVER_DOC_KINDS.includes(kind as (typeof DRIVER_DOC_KINDS)[number])) {
      throw new BadRequestException(`kind must be one of ${DRIVER_DOC_KINDS.join(", ")}`);
    }
    return prisma.driverDocument.update({
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

  async deleteDriverDocument(user: AuthUser, driverId: string, docId: string) {
    await this.requireDriver(user, driverId);
    const existing = await prisma.driverDocument.findFirst({ where: { id: docId, driverId } });
    if (!existing) throw new NotFoundException("Document not found");
    await prisma.driverDocument.delete({ where: { id: docId } });
    await this.audit(user.id, "driver.document.delete", driverId, { kind: existing.kind, docId }, "Driver");
    return { ok: true };
  }

  async addLeave(
    user: AuthUser,
    driverId: string,
    body: { startsAt: string; endsAt: string }
  ) {
    await this.requireDriver(user, driverId);
    const { startsAt, endsAt } = this.parseLeaveWindow(body.startsAt, body.endsAt);
    const leave = await prisma.driverLeave.create({
      data: { driverId, startsAt, endsAt },
    });
    await this.audit(user.id, "driver.leave.create", driverId, { leaveId: leave.id }, "Driver");
    return leave;
  }

  async updateLeave(
    user: AuthUser,
    driverId: string,
    leaveId: string,
    body: Record<string, unknown>
  ) {
    await this.requireDriver(user, driverId);
    const existing = await prisma.driverLeave.findFirst({ where: { id: leaveId, driverId } });
    if (!existing) throw new NotFoundException("Leave not found");
    const startsAt = body.startsAt != null ? new Date(String(body.startsAt)) : existing.startsAt;
    const endsAt = body.endsAt != null ? new Date(String(body.endsAt)) : existing.endsAt;
    this.assertLeaveWindow(startsAt, endsAt);
    return prisma.driverLeave.update({
      where: { id: leaveId },
      data: { startsAt, endsAt },
    });
  }

  async deleteLeave(user: AuthUser, driverId: string, leaveId: string) {
    await this.requireDriver(user, driverId);
    const existing = await prisma.driverLeave.findFirst({ where: { id: leaveId, driverId } });
    if (!existing) throw new NotFoundException("Leave not found");
    await prisma.driverLeave.delete({ where: { id: leaveId } });
    await this.audit(user.id, "driver.leave.delete", driverId, { leaveId }, "Driver");
    return { ok: true };
  }

  async driverAvailability(
    user: AuthUser,
    query: { from?: string; to?: string; cityId?: string; branchId?: string } = {}
  ) {
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + 24 * 60 * 60 * 1000);
    this.assertLeaveWindow(from, to);
    const rows = await prisma.driver.findMany({
      where: {
        ...vehicleScopeWhere(user),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.cityId ? { branch: { cityId: query.cityId } } : {}),
      },
      include: {
        branch: { include: { city: { select: { id: true, name: true } } } },
        documents: true,
        leaves: {
          where: { startsAt: { lt: to }, endsAt: { gt: from } },
          orderBy: { startsAt: "asc" },
        },
        assignments: {
          where: {
            booking: {
              OR: [
                { status: { in: [...DRIVER_BUSY_STATUSES] as BookingStatus[] } },
                {
                  status: { in: [...DRIVER_ASSIGNED_STATUSES] as BookingStatus[] },
                  startsAt: { lt: to },
                  endsAt: { gt: from },
                },
              ],
            },
          },
          include: {
            booking: {
              select: { id: true, publicId: true, status: true, startsAt: true, endsAt: true },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });
    return rows.map((driver) => {
      const onLeave = driver.leaves.length > 0;
      const busy = driver.assignments.length > 0;
      const dlOk = dlCovers(driver.documents, to);
      const reasons: string[] = [];
      if (!driver.active) reasons.push("inactive");
      if (onLeave) reasons.push("on leave");
      if (busy) {
        const trip = driver.assignments[0]?.booking;
        reasons.push(trip ? `assigned to ${trip.publicId}` : "assigned");
      }
      if (!dlOk) reasons.push("DL missing or expires before window end");
      return {
        ...driver,
        available: driver.active && !onLeave && !busy && dlOk,
        onLeave,
        busy,
        dlOk,
        reasons,
      };
    });
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

  async backfillDocuments(user: AuthUser) {
    const vehicles = await prisma.vehicle.findMany({
      where: vehicleScopeWhere(user),
      select: { id: true },
    });
    let created = 0;
    for (const v of vehicles) {
      created += await this.ensureMissingDocuments(v.id);
    }
    return { vehicles: vehicles.length, created };
  }

  async notifyExpiries(days = 30) {
    const windowDays = Math.min(365, Math.max(1, Number(days) || 30));
    const soon = new Date();
    soon.setDate(soon.getDate() + windowDays);
    const rows = await prisma.vehicleDocument.findMany({
      where: {
        expiresAt: { lte: soon, not: null },
        OR: [{ alertedAt: null }, { alertedAt: { lt: new Date(Date.now() - 7 * 86400000) } }],
      },
      include: {
        vehicle: {
          include: {
            carModel: { select: { name: true } },
            branch: { include: { city: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    const staff = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        roles: { some: { role: { name: { in: ["FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN"] } } } },
      },
      include: { staffScopes: true, roles: { include: { role: true } } },
    });
    let sent = 0;
    for (const row of rows) {
      const expires = row.expiresAt ? new Date(row.expiresAt).toLocaleDateString("en-IN") : "unknown";
      const cityId = row.vehicle.branch?.city?.id;
      const recipients = staff.filter((person) => {
        const names = person.roles.map((r) => r.role.name);
        if (names.includes("SUPER_ADMIN") || names.includes("FLEET_OPS")) return true;
        const scopeCity = person.staffScopes?.[0]?.cityId;
        return !scopeCity || !cityId || scopeCity === cityId;
      });
      for (const person of recipients) {
        if (!person.email) continue;
        await internalFetch(serviceUrls().notification, "/internal/notify", {
          method: "POST",
          body: JSON.stringify({
            template: "vehicle_doc_expiry",
            to: person.email,
            data: {
              registration: row.vehicle.registration,
              model: row.vehicle.carModel?.name || "",
              kind: row.kind,
              expires,
              branch: row.vehicle.branch?.name || "",
              city: row.vehicle.branch?.city?.name || "",
            },
          }),
        }).catch(() => undefined);
        sent += 1;
      }
      await prisma.vehicleDocument.update({
        where: { id: row.id },
        data: { alertedAt: new Date() },
      });
    }
    return { documents: rows.length, sent };
  }

  private async applyTransfer(user: AuthUser, transferId: string) {
    const job = await prisma.vehicleTransfer.findUnique({
      where: { id: transferId },
      include: { vehicle: { include: { branch: true } } },
    });
    if (!job) throw new NotFoundException("Transfer not found");
    if (job.status === "CANCELLED") throw new BadRequestException("Transfer was cancelled");
    assertVehicleInScope(user, job.vehicle);
    if (job.vehicle.status === "ON_TRIP") {
      throw new BadRequestException("Cannot complete transfer while the vehicle is on a trip");
    }
    const odometerKm = job.odometerKm ?? job.vehicle.odometerKm;
    await prisma.vehicle.update({
      where: { id: job.vehicleId },
      data: {
        branchId: job.toBranchId,
        odometerKm,
        status: job.fromStatus && job.fromStatus !== "ON_TRIP" ? job.fromStatus : "AVAILABLE",
      },
    });
    if (odometerKm !== job.vehicle.odometerKm) {
      await this.logOdometer(job.vehicleId, odometerKm, "TRANSFER", user.id, job.notes ?? undefined);
    }
    await prisma.vehicleTransfer.update({
      where: { id: transferId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await this.audit(user.id, "vehicle.transfer-branch", job.vehicleId, {
      transferId,
      fromBranchId: job.fromBranchId,
      toBranchId: job.toBranchId,
      notes: job.notes,
    });
    return this.getVehicle(user, job.vehicleId);
  }

  private async ensureMissingDocuments(vehicleId: string) {
    const existing = await prisma.vehicleDocument.findMany({ where: { vehicleId } });
    const have = new Set(existing.map((d) => d.kind.toUpperCase()));
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    const reg = vehicle?.registration || vehicleId;
    const defaults: { kind: string; years: number }[] = [
      { kind: "RC", years: 4 },
      { kind: "INSURANCE", years: 1 },
      { kind: "PUC", years: 1 },
      { kind: "PERMIT", years: 2 },
    ];
    let created = 0;
    for (const doc of defaults) {
      if (have.has(doc.kind)) continue;
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + doc.years);
      expiresAt.setUTCHours(23, 59, 59, 999);
      await prisma.vehicleDocument.create({
        data: {
          vehicleId,
          kind: doc.kind,
          url: `https://placehold.co/800x600?text=${encodeURIComponent(`${reg}-${doc.kind}`)}`,
          expiresAt,
        },
      });
      created += 1;
    }
    return created;
  }

  private vehicleInclude() {
    return {
      carModel: { select: { id: true, name: true, slug: true, type: true } },
      branch: { include: { city: { select: { id: true, name: true, slug: true } } } },
      partner: { select: { id: true, name: true, active: true, contracts: true } },
      documents: { orderBy: { createdAt: "desc" as const } },
    };
  }

  private driverInclude() {
    return {
      branch: { include: { city: { select: { id: true, name: true, slug: true } } } },
      documents: { orderBy: { expiresAt: "asc" as const } },
      leaves: { orderBy: { startsAt: "desc" as const }, take: 20 },
      assignments: {
        where: { booking: { status: { in: [...DRIVER_ASSIGNED_STATUSES] as BookingStatus[] } } },
        include: {
          booking: {
            select: {
              id: true,
              publicId: true,
              status: true,
              startsAt: true,
              endsAt: true,
              rentalType: true,
            },
          },
        },
      },
    };
  }

  private async requireDriver(user: AuthUser, id: string) {
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: this.driverInclude(),
    });
    if (!driver) throw new NotFoundException("Driver not found");
    assertVehicleInScope(user, { branchId: driver.branchId, branch: driver.branch });
    return driver;
  }

  private parseLeaveWindow(starts: string, ends: string) {
    const startsAt = new Date(starts);
    const endsAt = new Date(ends);
    this.assertLeaveWindow(startsAt, endsAt);
    return { startsAt, endsAt };
  }

  private assertLeaveWindow(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Valid startsAt and endsAt required");
    }
    if (startsAt >= endsAt) throw new BadRequestException("endsAt must be after startsAt");
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

  private async audit(
    actorId: string | undefined,
    action: string,
    entityId: string,
    payload: unknown,
    entity = "Vehicle"
  ) {
    await prisma.auditLog.create({
      data: { actorId, action, entity, entityId, payload: payload as object },
    });
  }

  private rethrowUniqueReg(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BadRequestException("Registration already exists");
    }
    throw err;
  }

  private rethrowUniquePhone(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BadRequestException("Driver phone already exists");
    }
    throw err;
  }

  private rethrowUniqueSlug(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new BadRequestException("City slug already exists");
    }
    throw err;
  }
}

function slugify(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
