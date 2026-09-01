import { Injectable, NotFoundException } from "@nestjs/common";
import { InspectionType, VehicleStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { internalFetch, serviceUrls } from "../../lib/http";

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

  vehicles() {
    return prisma.vehicle.findMany({
      include: { carModel: true, branch: { include: { city: true } }, partner: true },
      orderBy: { registration: "asc" },
    });
  }
  createVehicle(body: {
    registration: string;
    carModelId: string;
    branchId: string;
    ownerType?: "COMPANY" | "PARTNER";
    partnerId?: string;
    year?: number;
    color?: string;
    odometerKm?: number;
  }) {
    return prisma.vehicle.create({ data: body });
  }
  updateVehicle(id: string, body: Record<string, unknown>) {
    return prisma.vehicle.update({
      where: { id },
      data: {
        status: body.status as VehicleStatus | undefined,
        branchId: body.branchId != null ? String(body.branchId) : undefined,
        odometerKm: body.odometerKm != null ? Number(body.odometerKm) : undefined,
        color: body.color != null ? String(body.color) : undefined,
        partnerId: body.partnerId != null ? String(body.partnerId) : undefined,
      },
    });
  }
  deleteVehicle(id: string) {
    return prisma.vehicle.delete({ where: { id } });
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

  jobs() {
    return prisma.maintenanceJob.findMany({ include: { vehicle: true, workshop: true, parts: true } });
  }
  async createJob(body: {
    vehicleId: string;
    workshopId?: string;
    startsAt: string;
    endsAt: string;
    costPaise?: number;
    notes?: string;
  }) {
    const job = await prisma.maintenanceJob.create({
      data: {
        vehicleId: body.vehicleId,
        workshopId: body.workshopId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        costPaise: body.costPaise ?? 0,
        notes: body.notes,
      },
    });
    await prisma.availabilityBlock.create({
      data: {
        vehicleId: body.vehicleId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        reason: `MAINT:${job.id}`,
      },
    });
    return job;
  }
  deleteJob(id: string) {
    return prisma.maintenanceJob.delete({ where: { id } });
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
    return inspection;
  }

  expiries() {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    return prisma.vehicleDocument.findMany({
      where: { expiresAt: { lte: soon } },
      include: { vehicle: true },
    });
  }
}
