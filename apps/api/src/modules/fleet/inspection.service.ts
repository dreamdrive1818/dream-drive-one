import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, Prisma } from "@prisma/client";
import type { AuthUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { internalFetch, serviceUrls } from "../../lib/http";
import { bookingScopeWhere } from "../../lib/vehicle-rules";

export const FUEL_UNITS = ["EIGHTHS", "PERCENT"] as const;
export type FuelUnit = (typeof FUEL_UNITS)[number];

export const DEFAULT_ACCESSORIES = [
  "Spare tyre",
  "Jack & tools",
  "First-aid kit",
  "Fire extinguisher",
  "Floor mats",
  "Music system",
  "RC / insurance copy",
];

export type InspectionItemInput = { label: string; present?: boolean; notes?: string };
export type DamageInput = { description: string; amountPaise: number };
export type PhotoInput = string;

export type HandoverInput = {
  odometerKm: number;
  fuelLevel: string;
  fuelUnit?: string;
  notes?: string;
  photos?: PhotoInput[];
  items?: InspectionItemInput[];
  signatureUrl?: string;
};

export type ReturnInput = HandoverInput & { damages?: DamageInput[] };

const INSPECTION_INCLUDE = {
  photos: true,
  items: true,
  damages: true,
  vehicle: { select: { id: true, registration: true, odometerKm: true, status: true } },
  booking: {
    select: {
      id: true,
      publicId: true,
      status: true,
      rentalType: true,
      startsAt: true,
      endsAt: true,
      dropBranchId: true,
      user: { select: { email: true, profile: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.InspectionInclude;

@Injectable()
export class InspectionEngine {
  defaults() {
    return { accessories: DEFAULT_ACCESSORIES, fuelUnits: FUEL_UNITS };
  }

  list(
    user: AuthUser,
    query: { type?: string; status?: string; bookingId?: string; q?: string } = {}
  ) {
    const type = query.type === "HANDOVER" || query.type === "RETURN" ? query.type : undefined;
    const status = query.status === "OPEN" || query.status === "CLOSED" ? query.status : undefined;
    const bookingScope = bookingScopeWhere(user);
    const bookingWhere: Prisma.BookingWhereInput = {
      ...bookingScope,
      ...(query.bookingId
        ? { OR: [{ id: query.bookingId }, { publicId: query.bookingId }] }
        : {}),
      ...(query.q ? { publicId: { contains: query.q, mode: "insensitive" } } : {}),
    };
    return prisma.inspection.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
      },
      include: INSPECTION_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async get(user: AuthUser, id: string) {
    const row = await prisma.inspection.findUnique({
      where: { id },
      include: INSPECTION_INCLUDE,
    });
    if (!row) throw new NotFoundException("Inspection not found");
    const scope = bookingScopeWhere(user);
    if (Object.keys(scope).length) {
      const booking = await prisma.booking.findFirst({
        where: { id: row.bookingId, ...scope },
      });
      if (!booking) throw new NotFoundException("Inspection not found");
    }
    return row;
  }

  async handover(bookingId: string, body: HandoverInput, actorId?: string) {
    const booking = await this.requireBooking(bookingId);
    if (!booking.vehicleId) throw new BadRequestException("Assign a vehicle before handover");
    if (booking.status !== "CONFIRMED") {
      throw new BadRequestException("Handover is only allowed from CONFIRMED");
    }
    await this.assertSelfDriveReady(booking);
    const existing = await prisma.inspection.findFirst({
      where: { bookingId: booking.id, type: "HANDOVER" },
    });
    if (existing) throw new BadRequestException("Handover inspection already exists");

    const fuel = normalizeFuel(body.fuelLevel, body.fuelUnit);
    const odometerKm = requireOdometer(body.odometerKm, booking.vehicle?.odometerKm ?? 0, "handover");
    const items = normalizeItems(body.items);
    const photos = normalizePhotos(body.photos);

    const inspection = await prisma.inspection.create({
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        type: "HANDOVER",
        status: "CLOSED",
        odometerKm,
        fuelLevel: fuel.fuelLevel,
        fuelUnit: fuel.fuelUnit,
        notes: body.notes?.trim() || null,
        signatureUrl: body.signatureUrl?.trim() || null,
        closedAt: new Date(),
        photos: { create: photos.map((url) => ({ url })) },
        items: { create: items },
      },
      include: INSPECTION_INCLUDE,
    });

    await this.setStatus(booking.id, booking.publicId, "HANDOVER", "handover inspection");
    await this.setStatus(booking.id, booking.publicId, "ONGOING", "trip started");
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: "ON_TRIP", odometerKm },
    });
    await this.logOdometer(booking.vehicleId, odometerKm, "HANDOVER", actorId);
    return inspection;
  }

  async returnVehicle(bookingId: string, body: ReturnInput, actorId?: string) {
    const booking = await this.requireBooking(bookingId);
    if (!booking.vehicleId) throw new BadRequestException("Booking has no vehicle");
    if (!["HANDOVER", "ONGOING"].includes(booking.status)) {
      throw new BadRequestException("Return is only allowed from ONGOING");
    }
    const existing = await prisma.inspection.findFirst({
      where: { bookingId: booking.id, type: "RETURN" },
    });
    if (existing) throw new BadRequestException("Return inspection already exists");

    const handover = await prisma.inspection.findFirst({
      where: { bookingId: booking.id, type: "HANDOVER" },
      orderBy: { createdAt: "desc" },
    });
    if (!handover) throw new BadRequestException("Handover inspection is required before return");

    const fuel = normalizeFuel(body.fuelLevel, body.fuelUnit ?? handover.fuelUnit);
    if (fuel.fuelUnit !== handover.fuelUnit) {
      throw new BadRequestException(`Fuel unit must match handover (${handover.fuelUnit})`);
    }
    const odometerKm = requireOdometer(body.odometerKm, handover.odometerKm, "return");
    const damages = normalizeDamages(body.damages);
    const hasOpenDamages = damages.some((d) => d.amountPaise > 0);
    const items = normalizeItems(body.items);
    const photos = normalizePhotos(body.photos);

    const inspection = await prisma.inspection.create({
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        type: "RETURN",
        status: hasOpenDamages ? "OPEN" : "CLOSED",
        odometerKm,
        fuelLevel: fuel.fuelLevel,
        fuelUnit: fuel.fuelUnit,
        notes: body.notes?.trim() || null,
        signatureUrl: body.signatureUrl?.trim() || null,
        closedAt: hasOpenDamages ? null : new Date(),
        photos: { create: photos.map((url) => ({ url })) },
        items: { create: items },
        damages: {
          create: damages.map((d) => ({
            description: d.description,
            amountPaise: d.amountPaise,
            status: d.amountPaise > 0 ? "OPEN" : "WAIVED",
          })),
        },
      },
      include: INSPECTION_INCLUDE,
    });

    for (const damage of inspection.damages.filter((d) => d.amountPaise > 0)) {
      const extra = await this.raisePenalty(booking.id, damage.description, damage.amountPaise);
      await prisma.damageCharge.update({
        where: { id: damage.id },
        data: { extraId: extra?.id ?? null, status: extra?.id ? "SETTLED" : "OPEN" },
      });
    }

    const fromBranchId = booking.vehicle?.branchId ?? booking.pickupBranchId;
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: {
        status: "AVAILABLE",
        odometerKm,
        branchId: booking.dropBranchId,
      },
    });
    if (booking.dropBranchId && fromBranchId && fromBranchId !== booking.dropBranchId) {
      await prisma.vehicleTransfer.create({
        data: {
          vehicleId: booking.vehicleId,
          fromBranchId,
          toBranchId: booking.dropBranchId,
          status: "COMPLETED",
          fromStatus: "ON_TRIP",
          odometerKm,
          notes: `One-way return ${booking.publicId}`,
          actorId: actorId || null,
          completedAt: new Date(),
        },
      });
    }
    await this.logOdometer(booking.vehicleId, odometerKm, "RETURN", actorId);
    await internalFetch(serviceUrls().catalog, "/internal/availability/release", {
      method: "POST",
      body: JSON.stringify({ bookingId: booking.id }),
    }).catch(() => undefined);

    if (hasOpenDamages) {
      await this.setStatus(booking.id, booking.publicId, "RETURN_PENDING", "return inspection — damages invoiced");
    } else {
      await this.finalizeReturn(booking.id, booking.publicId, inspection.id);
    }

    return prisma.inspection.findUnique({
      where: { id: inspection.id },
      include: INSPECTION_INCLUDE,
    });
  }

  async addDamages(inspectionId: string, damages: DamageInput[]) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { booking: true, damages: true },
    });
    if (!inspection) throw new NotFoundException("Inspection not found");
    if (inspection.type !== "RETURN") {
      throw new BadRequestException("Damages can only be added to a return inspection");
    }
    if (inspection.status === "CLOSED") {
      throw new BadRequestException("Return inspection is already closed");
    }
    const rows = normalizeDamages(damages);
    if (!rows.length) throw new BadRequestException("At least one damage line is required");

    for (const row of rows) {
      const extra = await this.raisePenalty(inspection.bookingId, row.description, row.amountPaise);
      await prisma.damageCharge.create({
        data: {
          inspectionId: inspection.id,
          description: row.description,
          amountPaise: row.amountPaise,
          status: extra?.id ? "SETTLED" : "OPEN",
          extraId: extra?.id ?? null,
        },
      });
    }

    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { status: "OPEN", closedAt: null },
    });
    if (inspection.booking.status !== "RETURN_PENDING") {
      await this.setStatus(
        inspection.booking.id,
        inspection.booking.publicId,
        "RETURN_PENDING",
        "open damages"
      );
    }
    return prisma.inspection.findUnique({
      where: { id: inspection.id },
      include: INSPECTION_INCLUDE,
    });
  }

  async waiveDamage(inspectionId: string, damageId: string) {
    const damage = await prisma.damageCharge.findFirst({
      where: { id: damageId, inspectionId },
    });
    if (!damage) throw new NotFoundException("Damage not found");
    await prisma.damageCharge.update({
      where: { id: damage.id },
      data: { status: "WAIVED" },
    });
    return prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: INSPECTION_INCLUDE,
    });
  }

  async close(inspectionId: string) {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { booking: true, damages: true },
    });
    if (!inspection) throw new NotFoundException("Inspection not found");
    if (inspection.type !== "RETURN") {
      throw new BadRequestException("Only a return inspection can be closed this way");
    }
    const open = inspection.damages.filter((d) => d.status === "OPEN").length;
    if (open > 0) {
      throw new BadRequestException("Settle or waive open damages before closing the return");
    }
    await prisma.inspection.update({
      where: { id: inspection.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await this.finalizeReturn(inspection.booking.id, inspection.booking.publicId, inspection.id);
    return prisma.inspection.findUnique({
      where: { id: inspection.id },
      include: INSPECTION_INCLUDE,
    });
  }

  private async finalizeReturn(bookingId: string, publicId: string, inspectionId: string) {
    const open = await prisma.damageCharge.count({
      where: { inspectionId, status: "OPEN" },
    });
    if (open > 0) return;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;
    if (booking.status !== "COMPLETED") {
      await this.setStatus(bookingId, publicId, "COMPLETED", "return inspection closed");
    }
    await internalFetch(serviceUrls().partner, "/internal/ledger/trip-complete", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }).catch(() => undefined);
    await internalFetch(serviceUrls().payment, "/internal/deposits/release-by-booking", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }).catch(() => undefined);
  }

  private async raisePenalty(bookingId: string, description: string, amountPaise: number) {
    if (amountPaise <= 0) return null;
    try {
      return await internalFetch<{ id?: string }>(serviceUrls().payment, "/internal/payments/penalty", {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          label: `Damage: ${description}`,
          amountPaise,
        }),
      });
    } catch {
      await prisma.bookingExtra.create({
        data: { bookingId, label: `Damage: ${description}`, amountPaise },
      });
      await prisma.booking.update({
        where: { id: bookingId },
        data: { amountPaise: { increment: amountPaise } },
      });
      return null;
    }
  }

  private async requireBooking(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
      include: {
        vehicle: true,
        kycCase: true,
        agreements: true,
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  private async assertSelfDriveReady(booking: {
    id: string;
    userId: string;
    rentalType: string;
    endsAt: Date;
    kycCase?: { status: string; dlExpiresOn?: Date | null } | null;
  }) {
    if (booking.rentalType !== "SELF_DRIVE") return;
    const kyc =
      (booking.kycCase?.status === "APPROVED" ? booking.kycCase : null) ||
      (await prisma.kycCase.findFirst({
        where: { bookingId: booking.id, status: "APPROVED" },
      })) ||
      (await prisma.kycCase.findFirst({
        where: {
          userId: booking.userId,
          status: "APPROVED",
          validUntil: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
      }));
    if (!kyc) throw new BadRequestException("Self-drive handover needs approved KYC");
    if (kyc.dlExpiresOn && kyc.dlExpiresOn.getTime() < booking.endsAt.getTime()) {
      throw new BadRequestException("Driving licence expires before drop-off");
    }
    const signed = await prisma.agreement.findFirst({
      where: { bookingId: booking.id, status: { in: ["SIGNED", "WAIVED"] } },
    });
    if (!signed) throw new BadRequestException("Self-drive handover needs a signed agreement");
  }

  private async setStatus(bookingId: string, publicId: string, to: BookingStatus, reason: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status === to) return;
    await prisma.booking.update({ where: { id: bookingId }, data: { status: to } });
    await prisma.bookingStatusHistory.create({
      data: { bookingId, from: booking.status, to, reason },
    });
    await internalFetch(serviceUrls().socket, "/internal/booking-status", {
      method: "POST",
      body: JSON.stringify({ bookingId, publicId, status: to, reason }),
    }).catch(() => undefined);
  }

  private async logOdometer(vehicleId: string, km: number, source: string, actorId?: string) {
    await prisma.vehicleOdometerLog.create({
      data: { vehicleId, km, source, actorId },
    });
  }
}

function requireOdometer(raw: number, minimum: number, kind: "handover" | "return") {
  const km = Number(raw);
  if (!Number.isFinite(km) || km < 0 || !Number.isInteger(km)) {
    throw new BadRequestException("Odometer must be a whole number of kilometres");
  }
  if (kind === "return" && km < minimum) {
    throw new BadRequestException(`Return odometer must be ≥ handover (${minimum} km)`);
  }
  if (kind === "handover" && km < minimum) {
    throw new BadRequestException(`Handover odometer must be ≥ current vehicle reading (${minimum} km)`);
  }
  return km;
}

function normalizeFuel(fuelLevel: string, fuelUnit?: string): { fuelLevel: string; fuelUnit: FuelUnit } {
  const unit = String(fuelUnit || "EIGHTHS").trim().toUpperCase();
  if (!FUEL_UNITS.includes(unit as FuelUnit)) {
    throw new BadRequestException("Fuel unit must be EIGHTHS or PERCENT");
  }
  const raw = String(fuelLevel ?? "").trim();
  if (!raw) throw new BadRequestException("Fuel level required");
  if (unit === "PERCENT") {
    const n = Number(raw.replace("%", ""));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new BadRequestException("Fuel percent must be between 0 and 100");
    }
    return { fuelUnit: "PERCENT", fuelLevel: String(Math.round(n)) };
  }
  const eighths = parseEighths(raw);
  return { fuelUnit: "EIGHTHS", fuelLevel: String(eighths) };
}

function parseEighths(raw: string) {
  const token = raw.trim().toUpperCase();
  const named: Record<string, number> = {
    E: 0,
    EMPTY: 0,
    "1/8": 1,
    "1/4": 2,
    "3/8": 3,
    "1/2": 4,
    "5/8": 5,
    "3/4": 6,
    "7/8": 7,
    F: 8,
    FULL: 8,
  };
  if (token in named) return named[token];
  const fraction = token.match(/^([0-8])\s*\/\s*8$/);
  if (fraction) return Number(fraction[1]);
  const n = Number(token);
  if (Number.isInteger(n) && n >= 0 && n <= 8) return n;
  throw new BadRequestException("Fuel eighths must be 0–8 (or 1/2, 3/4, FULL)");
}

function normalizeItems(items?: InspectionItemInput[]) {
  const source =
    items?.filter((i) => String(i.label || "").trim()).map((i) => ({
      label: String(i.label).trim(),
      present: i.present !== false,
      notes: i.notes?.trim() || null,
    })) ?? DEFAULT_ACCESSORIES.map((label) => ({ label, present: true, notes: null }));
  return source;
}

function normalizePhotos(photos?: PhotoInput[]) {
  return (photos ?? []).map((url) => String(url || "").trim()).filter(Boolean);
}

function normalizeDamages(damages?: DamageInput[]) {
  return (damages ?? [])
    .map((d) => ({
      description: String(d.description || "").trim(),
      amountPaise: Number(d.amountPaise) || 0,
    }))
    .filter((d) => d.description && d.amountPaise >= 0);
}
