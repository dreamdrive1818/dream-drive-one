import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomInt, timingSafeEqual } from "crypto";
import {
  BookingStatus,
  OfferType,
  RentalType,
  TripDirection,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addMinutes, daysBetween, hoursBetween, hourInIst, isNightHour, nightsBetween, internalFetch, serviceUrls } from "../../lib/http";
import type { AuthUser } from "../../lib/auth";
import { freezeBookingCommission } from "../../lib/commission";
import { assertPartnerContractActive, bookingScopeWhere, dlCovers, insuranceCovers } from "../../lib/vehicle-rules";

const HOLD_MINUTES = Number(process.env.HOLD_MINUTES ?? 15);
const QUOTE_TTL_MINUTES = Number(process.env.QUOTE_TTL_MINUTES ?? 20);
const NO_SHOW_GRACE_HOURS = Number(process.env.NO_SHOW_GRACE_HOURS ?? 2);
const MIN_OFFER_FLOOR_PAISE = 100;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SEND = 3;
const OTP_MAX_ATTEMPTS = 5;

const MAX_DAYS_BY_TYPE: Record<RentalType, number> = {
  SELF_DRIVE: 30,
  WITH_DRIVER_LOCAL: 7,
  WITH_DRIVER_INTERCITY: 15,
  AIRPORT: 2,
  OUTSTATION: 15,
  ONE_WAY: 5,
  TOUR_PACKAGE: 21,
  SUBSCRIPTION: 365,
};

const ACTIVE_TRIP: BookingStatus[] = [
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
];

const DRIVER_ON_TRIP: BookingStatus[] = ["HANDOVER", "ONGOING", "RETURN_PENDING"];

const CANCEL_LOCKED: BookingStatus[] = ["HANDOVER", "ONGOING", "COMPLETED"];

type PolicyBand = { hours: number; refundPct: number };

const CANCEL_POLICY: Record<RentalType, PolicyBand[]> = {
  SELF_DRIVE: [
    { hours: 48, refundPct: 100 },
    { hours: 24, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  WITH_DRIVER_LOCAL: [
    { hours: 24, refundPct: 100 },
    { hours: 6, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  WITH_DRIVER_INTERCITY: [
    { hours: 48, refundPct: 100 },
    { hours: 12, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  AIRPORT: [
    { hours: 12, refundPct: 100 },
    { hours: 3, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  OUTSTATION: [
    { hours: 48, refundPct: 100 },
    { hours: 12, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  ONE_WAY: [
    { hours: 24, refundPct: 100 },
    { hours: 6, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  TOUR_PACKAGE: [
    { hours: 72, refundPct: 100 },
    { hours: 24, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  SUBSCRIPTION: [
    { hours: 168, refundPct: 100 },
    { hours: 48, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
};

type QuotePayload = {
  days: number;
  hours: number;
  nights?: number;
  pickupBranchId: string;
  dropBranchId: string;
  extraKmPaise: number | null;
  extras?: { label: string; amountPaise: number }[];
  packageId?: string;
  terminalId?: string;
  flightNumber?: string;
  waitMinutes?: number;
  estimatedKm?: number;
  tripDirection?: TripDirection;
  grossPaise: number;
  oneWayPaise?: number;
  waitPaise?: number;
  nightPaise?: number;
  driverAllowancePaise?: number;
  breakdown?: { label: string; amountPaise: number }[];
};

type ExtraInput = { label?: string; amountPaise?: number };

@Injectable()
export class BookingEngine {
  async quote(input: {
    userId?: string;
    carModelId: string;
    rentalType: RentalType;
    startsAt: string;
    endsAt: string;
    pickupBranchId?: string;
    dropBranchId?: string;
    offerCode?: string;
    extras?: ExtraInput[];
    packageId?: string;
    terminalId?: string;
    flightNumber?: string;
    waitMinutes?: number;
    estimatedKm?: number;
    tripDirection?: TripDirection;
  }) {
    const priced = await this.priceWindow(input);
    const quote = await prisma.quote.create({
      data: {
        userId: input.userId,
        carModelId: input.carModelId,
        rentalType: input.rentalType,
        startsAt: priced.startsAt,
        endsAt: priced.endsAt,
        amountPaise: priced.amountPaise,
        depositPaise: priced.depositPaise,
        offerId: priced.offerId,
        expiresAt: addMinutes(new Date(), QUOTE_TTL_MINUTES),
        payload: priced.payload,
      },
    });
    return this.hydrateQuote(quote);
  }

  async getQuote(id: string, userId: string, staff: boolean) {
    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException("Quote not found");
    if (quote.userId && quote.userId !== userId && !staff) {
      throw new BadRequestException("Not your quote");
    }
    return this.hydrateQuote(quote);
  }

  async applyOffer(quoteId: string, code: string, userId?: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.expiresAt < new Date()) {
      throw new BadRequestException("Quote expired");
    }
    if (quote.userId && userId && quote.userId !== userId) {
      throw new BadRequestException("Not your quote");
    }
    const payload = (quote.payload ?? {}) as QuotePayload;
    const extrasPaise = this.sumExtras(payload.extras);
    const gross = payload.grossPaise ?? Math.max(0, quote.amountPaise - extrasPaise);
    const offer = await this.validOffer(code, userId);
    const discounted = this.discount(gross, offer);
    const amountPaise = discounted + extrasPaise;
    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        amountPaise,
        offerId: offer.id,
        payload: { ...payload, grossPaise: gross },
      },
    });
    return this.hydrateQuote(updated);
  }

  async createBooking(userId: string, quoteId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.expiresAt < new Date()) {
      throw new BadRequestException("Quote expired");
    }
    if (quote.userId && quote.userId !== userId) {
      throw new BadRequestException("Not your quote");
    }
    const existing = await prisma.booking.findUnique({ where: { quoteId } });
    if (existing) return this.get(existing.id);

    const payload = (quote.payload ?? {}) as QuotePayload;
    if (!payload.pickupBranchId) throw new BadRequestException("Quote is missing pickup branch");

    const booking = await prisma.booking.create({
      data: {
        publicId: this.publicId(),
        userId,
        quoteId: quote.id,
        carModelId: quote.carModelId,
        rentalType: quote.rentalType,
        tripDirection: payload.tripDirection ?? null,
        status: "HOLD",
        startsAt: quote.startsAt,
        endsAt: quote.endsAt,
        pickupBranchId: payload.pickupBranchId,
        dropBranchId: payload.dropBranchId || payload.pickupBranchId,
        amountPaise: quote.amountPaise,
        depositPaise: quote.depositPaise,
        offerId: quote.offerId,
        flightNumber: payload.flightNumber ?? null,
        terminalId: payload.terminalId ?? null,
        packageId: payload.packageId ?? null,
        estimatedKm: payload.estimatedKm ?? null,
        waitMinutes: payload.waitMinutes ?? null,
        extras: payload.extras?.length
          ? { create: payload.extras.map((e) => ({ label: e.label, amountPaise: e.amountPaise })) }
          : undefined,
        history: {
          create: { to: "HOLD", reason: "quote confirmed" },
        },
      },
    });

    try {
      const reserved = await internalFetch<{ vehicleId: string }>(
        serviceUrls().catalog,
        "/internal/availability/reserve",
        {
          method: "POST",
          body: JSON.stringify({
            carModelId: quote.carModelId,
            startsAt: quote.startsAt.toISOString(),
            endsAt: quote.endsAt.toISOString(),
            bookingId: booking.id,
          }),
        }
      );
      await prisma.booking.update({
        where: { id: booking.id },
        data: { vehicleId: reserved.vehicleId, status: "AWAITING_PAYMENT" },
      });
      await freezeBookingCommission(booking.id);
      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          from: "HOLD",
          to: "AWAITING_PAYMENT",
        },
      });
      await this.emitRealtime(booking.id, booking.publicId, "AWAITING_PAYMENT", "vehicle reserved");
    } catch (err) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });
      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          from: "HOLD",
          to: "CANCELLED",
          reason: "no vehicle available",
        },
      });
      throw err;
    }

    if (quote.offerId && userId) {
      await prisma.offerRedemption.create({
        data: { offerId: quote.offerId, userId },
      }).catch(() => undefined);
    }

    return this.get(booking.id);
  }

  get(id: string) {
    return prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: this.bookingInclude(),
    });
  }

  mine(userId: string) {
    return prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        payments: true,
        extras: true,
        kycCase: { select: { id: true, status: true } },
        agreements: { select: { id: true, status: true, signedPdfUrl: true, pdfUrl: true } },
        pickupBranch: { select: { id: true, name: true, cityId: true } },
        dropBranch: { select: { id: true, name: true, cityId: true } },
        driverAssignment: { include: { driver: { select: { id: true, fullName: true, phone: true } } } },
        subscription: { select: { id: true, status: true, swapCount: true, swapDueReason: true } },
      },
    }).then(async (rows) => {
      const ids = [...new Set(rows.map((b) => b.carModelId))];
      const models = ids.length
        ? await prisma.carModel.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              name: true,
              slug: true,
              images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
            },
          })
        : [];
      const byId = new Map(models.map((m) => [m.id, m]));
      return rows.map((b) => ({ ...b, carModel: byId.get(b.carModelId) ?? null }));
    });
  }

  async cancel(userId: string, id: string, staff: boolean, reason?: string) {
    const booking = await this.require(id);
    if (!staff && booking.userId !== userId) {
      throw new BadRequestException("Not your booking");
    }
    if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      return { ...(await this.get(booking.id)), refundPaise: 0, refundPct: 0 };
    }
    if (CANCEL_LOCKED.includes(booking.status)) {
      throw new BadRequestException("Cannot cancel after handover");
    }

    const policy = this.cancelPolicy(booking.rentalType, booking.startsAt);
    const refundPaise = await this.refundPaid(booking.id, policy.refundPct);
    await this.setStatus(
      booking.id,
      "CANCELLED",
      reason ?? (staff ? "admin cancel" : "customer cancel")
    );
    await this.releaseVehicle(booking.id);
    const fresh = await this.get(booking.id);
    return {
      ...fresh,
      refundPaise,
      refundPct: policy.refundPct,
      policyHoursBeforeStart: Math.round(policy.hoursBefore * 10) / 10,
    };
  }

  async adminCreate(body: {
    userId?: string;
    customerEmail?: string;
    carModelId: string;
    rentalType: RentalType;
    startsAt: string;
    endsAt: string;
    pickupBranchId?: string;
    dropBranchId?: string;
    offerCode?: string;
    extras?: ExtraInput[];
    notes?: string;
    flightNumber?: string;
    packageId?: string;
    terminalId?: string;
    waitMinutes?: number;
    estimatedKm?: number;
    tripDirection?: TripDirection;
    comped?: boolean;
  }) {
    const userId = await this.resolveCustomer(body.userId, body.customerEmail);
    const quote = await this.quote({
      userId,
      carModelId: body.carModelId,
      rentalType: body.rentalType,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      pickupBranchId: body.pickupBranchId,
      dropBranchId: body.dropBranchId,
      offerCode: body.offerCode,
      extras: body.extras,
      packageId: body.packageId,
      terminalId: body.terminalId,
      flightNumber: body.flightNumber,
      waitMinutes: body.waitMinutes,
      estimatedKm: body.estimatedKm,
      tripDirection: body.tripDirection,
    });
    const booking = await this.createBooking(userId, quote.id);
    if (!booking) throw new BadRequestException("Could not create booking");

    if (body.notes || body.flightNumber) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          notes: body.notes ?? undefined,
          flightNumber: body.flightNumber ?? undefined,
        },
      });
    }

    if (body.comped) {
      const next: BookingStatus =
        booking.rentalType === "SELF_DRIVE" ? "AWAITING_KYC" : "CONFIRMED";
      await this.setStatus(booking.id, next, "admin-comped (token waived)");
      await this.confirmHold(booking.id);
    }
    return this.get(booking.id);
  }

  async adminPatch(id: string, body: Record<string, unknown>) {
    const booking = await this.require(id);
    const notes = body.notes != null ? String(body.notes) : undefined;
    const flightNumber = body.flightNumber != null ? String(body.flightNumber) : undefined;
    const carModelId = body.carModelId != null ? String(body.carModelId) : booking.carModelId;
    const rentalType = (body.rentalType as RentalType) || booking.rentalType;
    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : booking.startsAt;
    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : booking.endsAt;
    const pickupBranchId = body.pickupBranchId != null ? String(body.pickupBranchId) : booking.pickupBranchId;
    const dropBranchId = body.dropBranchId != null ? String(body.dropBranchId) : booking.dropBranchId;

    const datesChanged =
      startsAt.getTime() !== booking.startsAt.getTime() ||
      endsAt.getTime() !== booking.endsAt.getTime() ||
      carModelId !== booking.carModelId ||
      rentalType !== booking.rentalType ||
      pickupBranchId !== booking.pickupBranchId ||
      dropBranchId !== booking.dropBranchId;

    if (!datesChanged) {
      return prisma.booking.update({
        where: { id: booking.id },
        data: { notes, flightNumber },
      });
    }
    if (CANCEL_LOCKED.includes(booking.status) || booking.status === "COMPLETED") {
      throw new BadRequestException("Cannot change dates after handover");
    }

    const priced = await this.priceWindow({
      carModelId,
      rentalType,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      pickupBranchId,
      dropBranchId,
    });

    await this.releaseVehicle(booking.id);
    try {
      const reserved = await internalFetch<{ vehicleId: string }>(
        serviceUrls().catalog,
        "/internal/availability/reserve",
        {
          method: "POST",
          body: JSON.stringify({
            carModelId,
            vehicleId: carModelId === booking.carModelId ? booking.vehicleId : undefined,
            startsAt: priced.startsAt.toISOString(),
            endsAt: priced.endsAt.toISOString(),
            bookingId: booking.id,
          }),
        }
      );
      if (["CONFIRMED", "AWAITING_KYC", "AWAITING_SIGNATURE"].includes(booking.status)) {
        await this.confirmHold(booking.id);
      }
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          notes,
          flightNumber,
          carModelId,
          rentalType,
          startsAt: priced.startsAt,
          endsAt: priced.endsAt,
          pickupBranchId: priced.payload.pickupBranchId,
          dropBranchId: priced.payload.dropBranchId,
          amountPaise: priced.amountPaise,
          depositPaise: priced.depositPaise,
          vehicleId: reserved.vehicleId,
          tripDirection: priced.payload.tripDirection ?? null,
        },
      });
      await freezeBookingCommission(booking.id);
      return prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    } catch (err) {
      if (booking.vehicleId) {
        await internalFetch(serviceUrls().catalog, "/internal/availability/reserve", {
          method: "POST",
          body: JSON.stringify({
            carModelId: booking.carModelId,
            vehicleId: booking.vehicleId,
            startsAt: booking.startsAt.toISOString(),
            endsAt: booking.endsAt.toISOString(),
            bookingId: booking.id,
          }),
        }).catch(() => undefined);
        if (["CONFIRMED", "AWAITING_KYC", "AWAITING_SIGNATURE"].includes(booking.status)) {
          await this.confirmHold(booking.id);
        }
      }
      throw err;
    }
  }

  async adminStatus(id: string, to: BookingStatus, reason?: string, comped?: boolean) {
    const booking = await this.require(id);
    if (to === "CONFIRMED") {
      const paid = await prisma.payment.findFirst({
        where: {
          bookingId: booking.id,
          status: "SUCCESS",
          kind: { in: ["TOKEN", "BALANCE"] },
        },
      });
      if (!paid && !comped) {
        throw new BadRequestException("Token payment required (or mark as comped)");
      }
    }
    if (to === "HANDOVER" && booking.rentalType === "SELF_DRIVE") {
      await this.assertSelfDriveHandoverReady(booking.id);
    }
    await this.setStatus(id, to, reason ?? (comped ? "admin-comped" : "admin"));
    if (to === "CONFIRMED") await this.confirmHold(id);
    if (to === "CANCELLED" || to === "NO_SHOW") await this.releaseVehicle(id);
    return this.get(id);
  }

  async assignVehicle(id: string, vehicleId: string) {
    const booking = await this.require(id);
    if (!vehicleId) throw new BadRequestException("vehicleId required");
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { documents: true, carModel: true, partner: { include: { contracts: true } } },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (vehicle.carModelId !== booking.carModelId) {
      throw new BadRequestException("Vehicle is a different car model");
    }
    if (vehicle.status === "BLOCKED" || vehicle.status === "MAINTENANCE" || vehicle.status === "SOLD") {
      throw new BadRequestException(`Cannot assign ${vehicle.status} vehicle`);
    }
    if (vehicle.status !== "AVAILABLE" && booking.vehicleId !== vehicle.id) {
      throw new BadRequestException(`Vehicle is ${vehicle.status}`);
    }
    if (!insuranceCovers(vehicle.documents, booking.endsAt)) {
      throw new BadRequestException("Vehicle insurance must cover the booking dates");
    }
    if (vehicle.ownerType === "PARTNER" || vehicle.partnerId) {
      await assertPartnerContractActive(vehicle.partnerId, booking.startsAt, booking.endsAt);
    }

    await this.releaseVehicle(booking.id);
    await internalFetch<{ vehicleId: string }>(
      serviceUrls().catalog,
      "/internal/availability/reserve",
      {
        method: "POST",
        body: JSON.stringify({
          carModelId: booking.carModelId,
          vehicleId: vehicle.id,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          bookingId: booking.id,
        }),
      }
    );
    if (["CONFIRMED", "AWAITING_KYC", "AWAITING_SIGNATURE"].includes(booking.status)) {
      await this.confirmHold(booking.id);
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { vehicleId: vehicle.id },
    });
    await freezeBookingCommission(booking.id);
    return prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: this.bookingInclude(),
    });
  }

  async assignDriver(
    id: string,
    driverId: string,
    user?: AuthUser,
    opts?: { overrideCity?: boolean }
  ) {
    const booking = await this.require(id);
    if (!driverId) throw new BadRequestException("driverId required");
    if (booking.rentalType === "SELF_DRIVE") {
      throw new BadRequestException("Self-drive bookings do not take a chauffeur");
    }
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { branch: true, leaves: true, documents: true },
    });
    if (!driver) throw new NotFoundException("Driver not found");
    if (!driver.active) throw new BadRequestException("Driver is inactive");

    const pickup = await prisma.branch.findUnique({ where: { id: booking.pickupBranchId } });
    if (pickup && driver.branch.cityId !== pickup.cityId) {
      const canOverride =
        !!user &&
        (user.roles.includes("CITY_MANAGER") || user.roles.includes("SUPER_ADMIN"));
      if (!opts?.overrideCity || !canOverride) {
        throw new BadRequestException(
          canOverride
            ? "Driver is based in a different city. Pass overrideCity=true to assign anyway."
            : "Driver is based in a different city"
        );
      }
    }

    if (!dlCovers(driver.documents, booking.endsAt)) {
      throw new BadRequestException("Driver licence must be valid through trip end");
    }

    const onLeave = driver.leaves.some(
      (leave) => leave.startsAt < booking.endsAt && leave.endsAt > booking.startsAt
    );
    if (onLeave) throw new BadRequestException("Driver is on leave for these dates");

    const ongoing = await prisma.driverAssignment.findFirst({
      where: {
        driverId,
        bookingId: { not: booking.id },
        booking: { status: { in: DRIVER_ON_TRIP } },
      },
      include: { booking: { select: { publicId: true, status: true } } },
    });
    if (ongoing) {
      throw new BadRequestException(
        `Driver already has an ONGOING assignment (${ongoing.booking.publicId})`
      );
    }

    const clash = await prisma.driverAssignment.findFirst({
      where: {
        driverId,
        bookingId: { not: booking.id },
        booking: {
          status: { in: ACTIVE_TRIP },
          startsAt: { lt: booking.endsAt },
          endsAt: { gt: booking.startsAt },
        },
      },
      include: { booking: { select: { publicId: true, status: true } } },
    });
    if (clash) {
      throw new BadRequestException(
        `Driver already assigned to ${clash.booking.publicId} (${clash.booking.status})`
      );
    }

    return prisma.driverAssignment.upsert({
      where: { bookingId: booking.id },
      create: { bookingId: booking.id, driverId },
      update: { driverId },
      include: { driver: { select: { id: true, fullName: true, phone: true } } },
    });
  }

  async paymentCaptured(id: string) {
    const booking = await this.require(id);
    const next: BookingStatus =
      booking.rentalType === "SELF_DRIVE" ? "AWAITING_KYC" : "CONFIRMED";
    await this.setStatus(booking.id, next, "payment captured");
    await this.confirmHold(booking.id);
    if (next === "AWAITING_KYC") {
      await internalFetch(
        serviceUrls().document,
        "/internal/kyc/apply-reusable",
        { method: "POST", body: JSON.stringify({ bookingId: booking.id }) }
      ).catch(() => undefined);
    }
    if (next === "CONFIRMED") {
      await this.notifyConfirmed(booking.userId, booking.publicId);
    }
    return this.get(booking.id);
  }

  async kycApproved(id: string) {
    const booking = await this.require(id);
    if (booking.status === "AWAITING_KYC") {
      await this.setStatus(booking.id, "AWAITING_SIGNATURE", "kyc approved");
    }
    return this.get(booking.id);
  }

  async agreementSigned(id: string) {
    const booking = await this.require(id);
    if (booking.status === "AWAITING_SIGNATURE" || booking.status === "AWAITING_KYC") {
      await this.setStatus(booking.id, "CONFIRMED", "agreement signed");
      await this.notifyConfirmed(booking.userId, booking.publicId);
    }
    return this.get(booking.id);
  }

  listAdmin(
    user: AuthUser,
    query: { status?: BookingStatus; q?: string; from?: string; to?: string } = {}
  ) {
    const term = query.q?.trim();
    return prisma.booking.findMany({
      where: {
        ...bookingScopeWhere(user),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              startsAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(term
          ? {
              OR: [
                { publicId: { contains: term, mode: "insensitive" } },
                { user: { email: { contains: term, mode: "insensitive" } } },
                { user: { phone: { contains: term } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { email: true, phone: true, profile: true } },
        payments: true,
        extras: true,
        pickupBranch: { select: { id: true, name: true } },
        dropBranch: { select: { id: true, name: true } },
        driverAssignment: { include: { driver: { select: { id: true, fullName: true, phone: true } } } },
        vehicle: { select: { id: true, registration: true } },
      },
    }).then(async (rows) => {
      const ids = [...new Set(rows.map((b) => b.carModelId))];
      const models = ids.length
        ? await prisma.carModel.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, slug: true },
          })
        : [];
      const byId = new Map(models.map((m) => [m.id, m]));
      return rows.map((b) => ({ ...b, carModel: byId.get(b.carModelId) ?? null }));
    });
  }

  async expireHolds() {
    const cutoff = addMinutes(new Date(), -HOLD_MINUTES);
    const stale = await prisma.booking.findMany({
      where: {
        status: { in: ["HOLD", "AWAITING_PAYMENT"] },
        createdAt: { lt: cutoff },
        payments: { none: { status: "SUCCESS" } },
      },
    });
    for (const booking of stale) {
      await this.setStatus(booking.id, "CANCELLED", "hold expired");
      await this.releaseVehicle(booking.id);
    }
    return { expired: stale.length };
  }

  async markNoShows() {
    const cutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);
    const stale = await prisma.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "AWAITING_KYC", "AWAITING_SIGNATURE"] },
        startsAt: { lt: cutoff },
      },
    });
    for (const booking of stale) {
      await this.setStatus(booking.id, "NO_SHOW", `not handed over within ${NO_SHOW_GRACE_HOURS}h of start`);
      await this.releaseVehicle(booking.id);
    }
    return { marked: stale.length, graceHours: NO_SHOW_GRACE_HOURS };
  }

  async requestTrackOtp(publicId: string, phoneRaw: string) {
    const booking = await prisma.booking.findFirst({
      where: { publicId: publicId.trim().toUpperCase() },
      include: { user: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const phone = this.normalizePhone(phoneRaw);
    if (!booking.user.phone) {
      throw new BadRequestException("No phone on file — sign in to track this booking");
    }
    if (this.normalizePhone(booking.user.phone) !== phone) {
      throw new BadRequestException("Phone does not match this booking");
    }
    const key = this.trackOtpKey(booking.publicId, phone);
    const now = new Date();
    const existing = await prisma.emailOtp.findUnique({ where: { email: key } });
    let windowStart = existing?.windowStart ?? now;
    let windowCount = existing?.windowCount ?? 0;
    if (now.getTime() - windowStart.getTime() > OTP_WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= OTP_MAX_SEND) {
      throw new BadRequestException("Too many OTP requests. Try again in 15 minutes.");
    }
    const code = String(randomInt(100000, 1000000));
    await prisma.emailOtp.upsert({
      where: { email: key },
      create: {
        email: key,
        codeHash: this.hashOtp(key, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        windowStart,
        windowCount: 1,
      },
      update: {
        codeHash: this.hashOtp(key, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        windowStart,
        windowCount: windowCount + 1,
      },
    });
    await internalFetch(serviceUrls().notification, "/internal/notify", {
      method: "POST",
      body: JSON.stringify({
        template: "otp",
        toUserId: booking.userId,
        data: { code, purpose: "booking-track", publicId: booking.publicId },
      }),
    }).catch(() => undefined);
    return { ok: true, expiresInSec: OTP_TTL_MS / 1000 };
  }

  async verifyTrackOtp(publicId: string, phoneRaw: string, code: string) {
    const booking = await prisma.booking.findFirst({
      where: { publicId: publicId.trim().toUpperCase() },
      include: { user: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const phone = this.normalizePhone(phoneRaw);
    if (!booking.user.phone || this.normalizePhone(booking.user.phone) !== phone) {
      throw new BadRequestException("Phone does not match this booking");
    }
    const key = this.trackOtpKey(booking.publicId, phone);
    const row = await prisma.emailOtp.findUnique({ where: { email: key } });
    if (!row || row.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired OTP");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.delete({ where: { email: key } }).catch(() => undefined);
      throw new BadRequestException("Too many attempts. Request a new OTP.");
    }
    if (!this.hashesMatch(row.codeHash, this.hashOtp(key, code.trim()))) {
      await prisma.emailOtp.update({
        where: { email: key },
        data: { attempts: row.attempts + 1 },
      });
      throw new BadRequestException("Invalid or expired OTP");
    }
    await prisma.emailOtp.delete({ where: { email: key } }).catch(() => undefined);
    return this.get(booking.id);
  }

  // ─── Subscription Plans ───────────────────────────────

  listSubscriptionPlans() {
    return prisma.subscriptionPlan.findMany({
      where: { active: true },
      include: {
        carModel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: [{ carModelId: "asc" }, { months: "asc" }],
    });
  }

  adminListSubscriptionPlans() {
    return prisma.subscriptionPlan.findMany({
      include: {
        carModel: { select: { id: true, name: true, slug: true } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createSubscriptionPlan(body: {
    carModelId: string;
    months: number;
    pricePaise: number;
    includedKm: number;
    depositPaise?: number;
    maintenanceIncl?: boolean;
    swapAllowed?: boolean;
  }) {
    return prisma.subscriptionPlan.create({
      data: {
        carModelId: body.carModelId,
        months: body.months,
        pricePaise: body.pricePaise,
        includedKm: body.includedKm,
        depositPaise: body.depositPaise ?? 0,
        maintenanceIncl: body.maintenanceIncl ?? true,
        swapAllowed: body.swapAllowed ?? false,
      },
    });
  }

  updateSubscriptionPlan(id: string, body: Record<string, unknown>) {
    return prisma.subscriptionPlan.update({
      where: { id },
      data: {
        months: body.months != null ? Number(body.months) : undefined,
        pricePaise: body.pricePaise != null ? Number(body.pricePaise) : undefined,
        includedKm: body.includedKm != null ? Number(body.includedKm) : undefined,
        depositPaise: body.depositPaise != null ? Number(body.depositPaise) : undefined,
        maintenanceIncl: body.maintenanceIncl != null ? Boolean(body.maintenanceIncl) : undefined,
        swapAllowed: body.swapAllowed != null ? Boolean(body.swapAllowed) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
      },
    });
  }

  deleteSubscriptionPlan(id: string) {
    return prisma.subscriptionPlan.update({
      where: { id },
      data: { active: false },
    });
  }

  // ─── Subscription Lifecycle ─────────────────────────

  async createSubscription(userId: string, planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");
    if (!plan.active) throw new BadRequestException("Plan is no longer available");
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + plan.months);
    const quote = await this.quote({
      userId,
      carModelId: plan.carModelId,
      rentalType: "SUBSCRIPTION",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    await prisma.quote.update({
      where: { id: quote.id },
      data: { amountPaise: plan.pricePaise, depositPaise: plan.depositPaise },
    });
    const booking = await this.createBooking(userId, quote.id);
    if (!booking) throw new BadRequestException("Could not create subscription booking");
    const subscription = await prisma.subscription.create({
      data: { bookingId: booking.id, planId: plan.id },
    });
    await this.generateInvoiceSchedule(subscription.id, plan, startsAt);
    return this.getSubscription(subscription.id);
  }

  async swapSubscriptionVehicle(subscriptionId: string, newVehicleId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, booking: true },
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status !== "ACTIVE") throw new BadRequestException("Subscription is not active");
    if (!sub.plan.swapAllowed) throw new BadRequestException("Swap not allowed on this plan");

    await this.assignVehicle(sub.bookingId, newVehicleId);
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { swapCount: sub.swapCount + 1, swapDueReason: null },
    });
    return this.getSubscription(subscriptionId);
  }

  async closeSubscription(subscriptionId: string, reason?: string) {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { booking: true },
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status === "CLOSED" || sub.status === "COMPLETED") {
      throw new BadRequestException("Subscription already closed");
    }
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CLOSED", earlyCloseAt: new Date(), closedReason: reason },
    });
    await this.setStatus(sub.bookingId, "COMPLETED", reason ?? "subscription early close");
    await this.releaseVehicle(sub.bookingId);
    return this.getSubscription(subscriptionId);
  }

  async pauseSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status !== "ACTIVE") throw new BadRequestException("Can only pause active subscriptions");
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    return this.getSubscription(subscriptionId);
  }

  async resumeSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status !== "PAUSED") throw new BadRequestException("Subscription is not paused");
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: "ACTIVE", pausedAt: null },
    });
    return this.getSubscription(subscriptionId);
  }

  async getSubscription(id: string) {
    return prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: { include: { carModel: { select: { id: true, name: true, slug: true } } } },
        booking: { include: this.bookingInclude() },
        invoiceSchedule: { orderBy: { monthNumber: "asc" } },
      },
    });
  }

  async listAdminSubscriptions(query: { status?: string } = {}) {
    return prisma.subscription.findMany({
      where: query.status ? { status: query.status as any } : undefined,
      include: {
        plan: true,
        booking: {
          include: {
            user: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
            vehicle: { select: { id: true, registration: true } },
          },
        },
        invoiceSchedule: { orderBy: { monthNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  private async generateInvoiceSchedule(
    subscriptionId: string,
    plan: { months: number; pricePaise: number },
    startDate: Date
  ) {
    const monthlyAmount = Math.round(plan.pricePaise / plan.months);
    const schedules = Array.from({ length: plan.months }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        subscriptionId,
        monthNumber: i + 1,
        dueDate,
        amountPaise: i === plan.months - 1
          ? plan.pricePaise - monthlyAmount * (plan.months - 1)
          : monthlyAmount,
      };
    });
    await prisma.subscriptionInvoiceSchedule.createMany({ data: schedules });
  }

  listPackages() {
    return prisma.tourPackage.findMany({
      where: { published: true },
      include: {
        daysDetail: { orderBy: { dayNumber: "asc" } },
        city: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async getPackage(slugOrId: string) {
    const pack = await prisma.tourPackage.findFirst({
      where: { published: true, OR: [{ slug: slugOrId }, { id: slugOrId }] },
      include: {
        daysDetail: { orderBy: { dayNumber: "asc" } },
        city: { select: { id: true, name: true, slug: true, branches: { select: { id: true, name: true } } } },
      },
    });
    if (!pack) throw new NotFoundException("Package not found");
    return pack;
  }

  adminPackages() {
    return prisma.tourPackage.findMany({
      include: {
        daysDetail: { orderBy: { dayNumber: "asc" } },
        city: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async createPackage(body: {
    slug: string;
    name: string;
    days: number;
    pricePaise: number;
    depositPaise?: number;
    cityId?: string;
    carClass?: string;
    inclusions?: string;
    published?: boolean;
    daysDetail?: { dayNumber: number; title: string; description?: string }[];
  }) {
    if (!body.slug || !body.name || !body.days || body.pricePaise == null) {
      throw new BadRequestException("slug, name, days and pricePaise required");
    }
    return prisma.tourPackage.create({
      data: {
        slug: body.slug.trim().toLowerCase(),
        name: body.name,
        days: Number(body.days),
        pricePaise: Number(body.pricePaise),
        depositPaise: body.depositPaise ?? 0,
        cityId: body.cityId || null,
        carClass: body.carClass || null,
        inclusions: body.inclusions || null,
        published: body.published ?? false,
        daysDetail: body.daysDetail?.length
          ? {
              create: body.daysDetail.map((d) => ({
                dayNumber: Number(d.dayNumber),
                title: d.title,
                description: d.description || null,
              })),
            }
          : undefined,
      },
      include: { daysDetail: { orderBy: { dayNumber: "asc" } } },
    });
  }

  async updatePackage(id: string, body: Record<string, unknown>) {
    const daysDetail = Array.isArray(body.daysDetail)
      ? (body.daysDetail as { dayNumber?: number; title?: string; description?: string }[])
      : null;
    if (daysDetail) {
      await prisma.tourDay.deleteMany({ where: { packageId: id } });
    }
    return prisma.tourPackage.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        slug: body.slug != null ? String(body.slug).trim().toLowerCase() : undefined,
        days: body.days != null ? Number(body.days) : undefined,
        pricePaise: body.pricePaise != null ? Number(body.pricePaise) : undefined,
        depositPaise: body.depositPaise != null ? Number(body.depositPaise) : undefined,
        cityId: body.cityId === "" ? null : body.cityId != null ? String(body.cityId) : undefined,
        carClass: body.carClass === "" ? null : body.carClass != null ? String(body.carClass) : undefined,
        inclusions: body.inclusions != null ? String(body.inclusions) : undefined,
        published: body.published != null ? Boolean(body.published) : undefined,
        daysDetail: daysDetail
          ? {
              create: daysDetail
                .filter((d) => d.title)
                .map((d, i) => ({
                  dayNumber: Number(d.dayNumber ?? i + 1),
                  title: String(d.title),
                  description: d.description ? String(d.description) : null,
                })),
            }
          : undefined,
      },
      include: { daysDetail: { orderBy: { dayNumber: "asc" } } },
    });
  }

  deletePackage(id: string) {
    return prisma.tourPackage.update({
      where: { id },
      data: { published: false },
    });
  }

  listCityPairs() {
    return prisma.cityPairRate.findMany({
      include: {
        fromCity: { select: { id: true, name: true, slug: true } },
        toCity: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { oneWayPaise: "asc" },
    });
  }

  upsertCityPair(body: { fromCityId: string; toCityId: string; oneWayPaise: number }) {
    if (!body.fromCityId || !body.toCityId) throw new BadRequestException("fromCityId and toCityId required");
    if (body.fromCityId === body.toCityId) throw new BadRequestException("Pickup and drop cities must differ");
    return prisma.cityPairRate.upsert({
      where: { fromCityId_toCityId: { fromCityId: body.fromCityId, toCityId: body.toCityId } },
      create: {
        fromCityId: body.fromCityId,
        toCityId: body.toCityId,
        oneWayPaise: Number(body.oneWayPaise),
      },
      update: { oneWayPaise: Number(body.oneWayPaise) },
      include: {
        fromCity: { select: { id: true, name: true } },
        toCity: { select: { id: true, name: true } },
      },
    });
  }

  deleteCityPair(id: string) {
    return prisma.cityPairRate.delete({ where: { id } });
  }

  listTripExtras() {
    return prisma.tripExtra.findMany({ where: { active: true }, orderBy: { label: "asc" } });
  }

  async addBookingExtras(
    bookingId: string,
    extras: ExtraInput[],
    override = false
  ) {
    const booking = await this.require(bookingId);
    if (!["RETURN_PENDING", "COMPLETED", "ONGOING", "HANDOVER"].includes(booking.status) && !override) {
      throw new BadRequestException("Extras are added on return (or SALES may override)");
    }
    const rows = (extras ?? [])
      .filter((e) => e.label && Number(e.amountPaise) > 0)
      .map((e) => ({ label: String(e.label), amountPaise: Number(e.amountPaise) }));
    if (!rows.length) throw new BadRequestException("At least one extra with amount is required");
    await prisma.bookingExtra.createMany({
      data: rows.map((e) => ({ bookingId: booking.id, ...e })),
    });
    const added = rows.reduce((s, e) => s + e.amountPaise, 0);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { amountPaise: booking.amountPaise + added },
    });
    return this.get(booking.id);
  }

  private async priceWindow(input: {
    carModelId: string;
    rentalType: RentalType;
    startsAt: string;
    endsAt: string;
    pickupBranchId?: string;
    dropBranchId?: string;
    offerCode?: string;
    extras?: ExtraInput[];
    packageId?: string;
    terminalId?: string;
    flightNumber?: string;
    waitMinutes?: number;
    estimatedKm?: number;
    tripDirection?: TripDirection;
    userId?: string;
  }) {
    const startsAt = new Date(input.startsAt);
    let endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException("Invalid dates");
    }
    if (!(startsAt < endsAt)) throw new BadRequestException("Invalid dates");
    if (startsAt < new Date()) throw new BadRequestException("Cannot book in the past");

    let days = daysBetween(startsAt, endsAt);
    const cap = MAX_DAYS_BY_TYPE[input.rentalType] ?? 30;
    if (days > cap) {
      throw new BadRequestException(`Maximum rental length is ${cap} days for this product`);
    }

    const model = await prisma.carModel.findUnique({
      where: { id: input.carModelId },
      include: { pricingRules: true, city: { include: { branches: true } } },
    });
    if (!model) throw new NotFoundException("Car not found");

    const pickup =
      input.pickupBranchId ??
      model.city.branches[0]?.id;
    if (!pickup) throw new BadRequestException("No pickup branch");
    const drop = input.dropBranchId ?? pickup;

    const pickupBranch = await prisma.branch.findUnique({ where: { id: pickup } });
    const dropBranch = await prisma.branch.findUnique({ where: { id: drop } });
    if (!pickupBranch) throw new BadRequestException("Pickup branch not found");
    if (!dropBranch) throw new BadRequestException("Drop branch not found");

    const hours = hoursBetween(startsAt, endsAt);
    const nights = nightsBetween(startsAt, endsAt);
    const extras = (input.extras ?? [])
      .filter((e) => e.label && Number(e.amountPaise) > 0)
      .map((e) => ({ label: String(e.label), amountPaise: Number(e.amountPaise) }));

    let amountPaise = 0;
    let depositPaise = 0;
    let extraKmPaise: number | null = null;
    let oneWayPaise = 0;
    let waitPaise = 0;
    let nightPaise = 0;
    let driverAllowancePaise = 0;
    let tripDirection: TripDirection | undefined = input.tripDirection;
    let packageId = input.packageId;
    const flightNumber = input.flightNumber?.trim() || undefined;
    const waitMinutes = input.waitMinutes != null ? Math.max(0, Number(input.waitMinutes)) : 0;
    const estimatedKm = input.estimatedKm != null ? Math.max(0, Number(input.estimatedKm)) : undefined;
    const breakdown: { label: string; amountPaise: number }[] = [];

    if (input.rentalType === "TOUR_PACKAGE") {
      if (!input.packageId) throw new BadRequestException("packageId required for tour bookings");
      const pack = await prisma.tourPackage.findUnique({ where: { id: input.packageId } });
      if (!pack || !pack.published) throw new BadRequestException("Package not available");
      if (pack.carClass && model.type && pack.carClass.toLowerCase() !== model.type.toLowerCase()) {
        throw new BadRequestException(`This package requires a ${pack.carClass} (this car is ${model.type})`);
      }
      const minEnd = new Date(startsAt.getTime() + pack.days * 86_400_000);
      if (endsAt < minEnd) {
        endsAt = minEnd;
        days = pack.days;
      }
      amountPaise = pack.pricePaise;
      depositPaise = pack.depositPaise ?? 0;
      packageId = pack.id;
      breakdown.push({ label: pack.name, amountPaise: pack.pricePaise });
    } else if (input.rentalType === "SUBSCRIPTION") {
      const rule = this.pickPriceRule(model.pricingRules, input.rentalType, startsAt);
      amountPaise = rule?.dailyPaise ? rule.dailyPaise * days : 0;
      depositPaise = rule?.depositPaise ?? 0;
    } else {
      const rule = this.pickPriceRule(model.pricingRules, input.rentalType, startsAt);
      if (!rule) throw new BadRequestException("No price for this rental type");
      depositPaise = rule.depositPaise;
      extraKmPaise = rule.extraKmPaise;
      if (input.rentalType === "WITH_DRIVER_LOCAL" && rule.hourlyPaise) {
        amountPaise = rule.hourlyPaise * hours;
        breakdown.push({ label: `Chauffeur ${hours}h`, amountPaise });
      } else if (input.rentalType === "AIRPORT" && rule.hourlyPaise && hours <= 8) {
        amountPaise = rule.hourlyPaise * hours;
        breakdown.push({ label: `Airport transfer ${hours}h`, amountPaise });
      } else {
        amountPaise = rule.dailyPaise * days;
        breakdown.push({ label: `${days} day${days === 1 ? "" : "s"}`, amountPaise });
      }
    }

    if (input.rentalType === "AIRPORT") {
      const terminal = input.terminalId
        ? await prisma.airportTerminal.findUnique({ where: { id: input.terminalId } })
        : await prisma.airportTerminal.findFirst({
            where: { cityId: pickupBranch.cityId, active: true },
          });
      if (input.terminalId && !terminal) throw new BadRequestException("Airport terminal not found");
      if (terminal) {
        if (terminal.cityId !== pickupBranch.cityId && terminal.cityId !== dropBranch.cityId) {
          throw new BadRequestException("Terminal is not in the pickup or drop city");
        }
        const chargedWait = Math.max(0, waitMinutes - terminal.freeWaitMinutes);
        waitPaise = chargedWait * terminal.waitPaisePerMin;
        if (waitPaise) {
          extras.push({ label: `Airport wait (${chargedWait} min after ${terminal.freeWaitMinutes} free)`, amountPaise: waitPaise });
        }
        const hour = hourInIst(startsAt);
        if (isNightHour(hour, terminal.nightStartsHour, terminal.nightEndsHour) && terminal.nightSurchargePaise > 0) {
          nightPaise = terminal.nightSurchargePaise;
          extras.push({ label: "Night surcharge", amountPaise: nightPaise });
        }
      }
    }

    if (input.rentalType === "OUTSTATION") {
      const settings = await prisma.catalogSettings.findUnique({ where: { id: "default" } });
      const perNight = settings?.driverAllowancePerNightPaise ?? 30000;
      driverAllowancePaise = nights * perNight;
      if (driverAllowancePaise > 0) {
        extras.push({
          label: `Driver allowance (${nights} night${nights === 1 ? "" : "s"})`,
          amountPaise: driverAllowancePaise,
        });
      }
    }

    const differentCity = pickupBranch.cityId !== dropBranch.cityId;
    if (input.rentalType === "ONE_WAY") {
      if (!differentCity) {
        throw new BadRequestException("One-way requires a different drop city");
      }
      tripDirection = "ONE_WAY";
      const pair = await prisma.cityPairRate.findUnique({
        where: {
          fromCityId_toCityId: {
            fromCityId: pickupBranch.cityId,
            toCityId: dropBranch.cityId,
          },
        },
      });
      if (!pair) {
        throw new BadRequestException("No one-way rate configured for this city pair");
      }
      oneWayPaise = pair.oneWayPaise;
      amountPaise += oneWayPaise;
      breakdown.push({ label: "One-way fee", amountPaise: oneWayPaise });
    } else if (differentCity && input.rentalType !== "SELF_DRIVE" && input.rentalType !== "TOUR_PACKAGE") {
      tripDirection = "ONE_WAY";
      const pair = await prisma.cityPairRate.findUnique({
        where: {
          fromCityId_toCityId: {
            fromCityId: pickupBranch.cityId,
            toCityId: dropBranch.cityId,
          },
        },
      });
      oneWayPaise = pair?.oneWayPaise ?? 0;
      amountPaise += oneWayPaise;
      if (oneWayPaise) breakdown.push({ label: "One-way fee", amountPaise: oneWayPaise });
    } else if (!tripDirection) {
      tripDirection = "ROUND_TRIP";
    }

    const extrasPaise = this.sumExtras(extras);
    const grossPaise = amountPaise + waitPaise + nightPaise + driverAllowancePaise;
    amountPaise = grossPaise + (extrasPaise - waitPaise - nightPaise - driverAllowancePaise);

    let offerId: string | undefined;
    if (input.offerCode) {
      const offer = await this.validOffer(input.offerCode, input.userId);
      amountPaise = this.discount(grossPaise, offer) + (extrasPaise - waitPaise - nightPaise - driverAllowancePaise);
      offerId = offer.id;
    }

    const payload: QuotePayload = {
      days,
      hours,
      nights,
      pickupBranchId: pickup,
      dropBranchId: drop,
      extraKmPaise,
      extras,
      packageId,
      terminalId: input.terminalId,
      flightNumber,
      waitMinutes: waitMinutes || undefined,
      estimatedKm,
      tripDirection,
      grossPaise,
      oneWayPaise: oneWayPaise || undefined,
      waitPaise: waitPaise || undefined,
      nightPaise: nightPaise || undefined,
      driverAllowancePaise: driverAllowancePaise || undefined,
      breakdown,
    };

    return { startsAt, endsAt, amountPaise, depositPaise, offerId, payload };
  }

  private pickPriceRule(
    rules: {
      rentalType: RentalType;
      dailyPaise: number;
      extraKmPaise: number | null;
      depositPaise: number;
      hourlyPaise: number | null;
      startsOn: Date | null;
      endsOn: Date | null;
    }[],
    rentalType: RentalType,
    at: Date
  ) {
    const typed = rules.filter((r) => r.rentalType === rentalType);
    const pool = typed.length ? typed : rules.filter((r) => r.rentalType === "SELF_DRIVE");
    const fallback = pool.length ? pool : rules;
    if (!fallback.length) return null;
    const seasonal = fallback.filter((r) => {
      if (!r.startsOn && !r.endsOn) return false;
      if (r.startsOn && at < r.startsOn) return false;
      if (r.endsOn && at > r.endsOn) return false;
      return true;
    });
    if (seasonal.length) {
      seasonal.sort((a, b) => {
        const aSpan = (a.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER) - (a.startsOn?.getTime() ?? 0);
        const bSpan = (b.endsOn?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.startsOn?.getTime() ?? 0);
        return aSpan - bSpan;
      });
      return seasonal[0];
    }
    return fallback.find((r) => !r.startsOn && !r.endsOn) ?? fallback[0];
  }

  private discount(amount: number, offer: { type: OfferType; value: number }) {
    const raw =
      offer.type === "PERCENT"
        ? Math.round(amount * (1 - offer.value / 100))
        : amount - offer.value;
    const floor = Math.max(MIN_OFFER_FLOOR_PAISE, Math.round(amount * 0.1));
    return Math.max(floor, raw);
  }

  private async validOffer(code: string, userId?: string) {
    const offer = await prisma.offer.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { redemptions: true },
    });
    const now = new Date();
    if (!offer || offer.startsAt > now || offer.endsAt < now) {
      throw new BadRequestException("Offer not valid");
    }
    if (offer.maxRedemptions && offer.redemptions.length >= offer.maxRedemptions) {
      throw new BadRequestException("Offer fully redeemed");
    }
    if (userId && offer.redemptions.some((r) => r.userId === userId)) {
      throw new BadRequestException("Offer already used");
    }
    return offer;
  }

  private publicId() {
    return "DD" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
  }

  private async require(id: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  private async setStatus(id: string, to: BookingStatus, reason: string) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.status === to) return booking;
    await prisma.booking.update({ where: { id }, data: { status: to } });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: id, from: booking.status, to, reason },
    });
    await this.emitRealtime(id, booking.publicId, to, reason);
    return booking;
  }

  private async emitRealtime(bookingId: string, publicId: string, status: BookingStatus, reason?: string) {
    await internalFetch(serviceUrls().socket, "/internal/booking-status", {
      method: "POST",
      body: JSON.stringify({ bookingId, publicId, status, reason }),
    }).catch(() => undefined);
  }

  private async confirmHold(bookingId: string) {
    await internalFetch(serviceUrls().catalog, "/internal/availability/confirm", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }).catch(() => undefined);
  }

  private async releaseVehicle(bookingId: string) {
    await internalFetch(serviceUrls().catalog, "/internal/availability/release", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    }).catch(() => undefined);
  }

  private async notifyConfirmed(userId: string, publicId: string) {
    await internalFetch(serviceUrls().notification, "/internal/notify", {
      method: "POST",
      body: JSON.stringify({
        template: "booking_confirmed",
        toUserId: userId,
        data: { publicId },
      }),
    }).catch(() => undefined);
  }

  private cancelPolicy(rentalType: RentalType, startsAt: Date) {
    const hoursBefore = (startsAt.getTime() - Date.now()) / 3_600_000;
    const bands = CANCEL_POLICY[rentalType] ?? CANCEL_POLICY.SELF_DRIVE;
    const band = bands.find((b) => hoursBefore >= b.hours) ?? bands[bands.length - 1];
    return { hoursBefore, refundPct: band.refundPct };
  }

  private async refundPaid(bookingId: string, refundPct: number) {
    if (refundPct <= 0) return 0;
    const payments = await prisma.payment.findMany({
      where: { bookingId, status: { in: ["SUCCESS", "PARTIALLY_REFUNDED"] }, kind: { in: ["TOKEN", "BALANCE"] } },
      include: { refunds: true },
    });
    let total = 0;
    for (const payment of payments) {
      const already = payment.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
      const remaining = Math.max(0, payment.amountPaise - already);
      const amount = Math.round((payment.amountPaise * refundPct) / 100);
      const toRefund = Math.min(remaining, amount);
      if (toRefund <= 0) continue;
      await prisma.refund.create({ data: { paymentId: payment.id, amountPaise: toRefund } });
      const full = already + toRefund >= payment.amountPaise;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      total += toRefund;
    }
    return total;
  }

  private async assertSelfDriveHandoverReady(bookingId: string) {
    const kyc = await prisma.kycCase.findFirst({ where: { bookingId } });
    if (!kyc || kyc.status !== "APPROVED") {
      throw new BadRequestException("Self-drive handover needs approved KYC");
    }
    const signed = await prisma.agreement.findFirst({
      where: { bookingId, status: { in: ["SIGNED", "WAIVED"] } },
    });
    if (!signed) {
      throw new BadRequestException("Self-drive handover needs a signed agreement");
    }
  }

  private async resolveCustomer(userId?: string, customerEmail?: string) {
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException("Customer not found");
      return user.id;
    }
    if (customerEmail) {
      const user = await prisma.user.findUnique({
        where: { email: customerEmail.trim().toLowerCase() },
      });
      if (!user) throw new NotFoundException("Customer not found — create the customer first");
      return user.id;
    }
    throw new BadRequestException("userId or customerEmail required");
  }

  private async hydrateQuote(quote: {
    id: string;
    userId: string | null;
    carModelId: string;
    rentalType: RentalType;
    startsAt: Date;
    endsAt: Date;
    amountPaise: number;
    depositPaise: number;
    offerId: string | null;
    expiresAt: Date;
    payload: unknown;
  }) {
    const car = await prisma.carModel.findUnique({
      where: { id: quote.carModelId },
      select: {
        id: true,
        name: true,
        slug: true,
        city: { select: { id: true, name: true } },
        images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
      },
    });
    const payload = (quote.payload ?? {}) as QuotePayload;
    const pickup = payload.pickupBranchId
      ? await prisma.branch.findUnique({
          where: { id: payload.pickupBranchId },
          select: { id: true, name: true, cityId: true },
        })
      : null;
    const drop = payload.dropBranchId
      ? await prisma.branch.findUnique({
          where: { id: payload.dropBranchId },
          select: { id: true, name: true, cityId: true },
        })
      : null;
    const terminal = payload.terminalId
      ? await prisma.airportTerminal.findUnique({
          where: { id: payload.terminalId },
          select: { id: true, name: true, code: true, freeWaitMinutes: true },
        })
      : null;
    const tourPackage = payload.packageId
      ? await prisma.tourPackage.findUnique({
          where: { id: payload.packageId },
          select: { id: true, name: true, slug: true, days: true, carClass: true },
        })
      : null;
    return {
      ...quote,
      expired: quote.expiresAt < new Date(),
      carModel: car,
      pickupBranch: pickup,
      dropBranch: drop,
      terminal,
      tourPackage,
    };
  }

  private bookingInclude() {
    return {
      history: { orderBy: { createdAt: "asc" as const } },
      extras: true,
      payments: { include: { refunds: true } },
      kycCase: true,
      agreements: true,
      driverAssignment: { include: { driver: { select: { id: true, fullName: true, phone: true } } } },
      inspections: { include: { photos: true, items: true, damages: true }, orderBy: { createdAt: "asc" as const } },
      pickupBranch: { select: { id: true, name: true, cityId: true, city: { select: { name: true } } } },
      dropBranch: { select: { id: true, name: true, cityId: true, city: { select: { name: true } } } },
      terminal: { select: { id: true, name: true, code: true } },
      tourPackage: { select: { id: true, name: true, slug: true, days: true, carClass: true } },
      vehicle: { select: { id: true, registration: true, status: true } },
      subscription: { select: { id: true, status: true, swapCount: true, swapDueReason: true } },
      user: { select: { id: true, email: true, phone: true, profile: { select: { fullName: true } } } },
    };
  }

  private sumExtras(extras?: { amountPaise: number }[]) {
    return (extras ?? []).reduce((sum, e) => sum + (e.amountPaise || 0), 0);
  }

  private trackOtpKey(publicId: string, phone: string) {
    return `track:${publicId}:${phone}@booking.local`;
  }

  private hashOtp(key: string, code: string) {
    const secret = process.env.SESSION_SECRET || process.env.INTERNAL_TOKEN || "dev-internal";
    return createHash("sha256").update(`${key}:${code}:${secret}`).digest("hex");
  }

  private hashesMatch(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private normalizePhone(raw: string) {
    let phone = String(raw || "").replace(/\D/g, "");
    if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
    if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new BadRequestException("Valid Indian mobile number required");
    }
    return phone;
  }
}
