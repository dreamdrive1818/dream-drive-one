import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BookingStatus,
  OfferType,
  RentalType,
} from "@prisma/client";
import { prisma } from "./lib/prisma";
import { addMinutes, daysBetween, hoursBetween, internalFetch, serviceUrls } from "./lib/http";

const HOLD_MINUTES = Number(process.env.HOLD_MINUTES ?? 15);

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
  }) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!(startsAt < endsAt)) throw new BadRequestException("Invalid dates");
    if (startsAt < new Date()) throw new BadRequestException("Cannot book in the past");

    const model = await prisma.carModel.findUnique({
      where: { id: input.carModelId },
      include: { pricingRules: true, city: { include: { branches: true } } },
    });
    if (!model) throw new NotFoundException("Car not found");

    const rule =
      model.pricingRules.find((r) => r.rentalType === input.rentalType) ??
      model.pricingRules[0];
    if (!rule) throw new BadRequestException("No price for this rental type");

    const days = daysBetween(startsAt, endsAt);
    const hours = hoursBetween(startsAt, endsAt);
    let amountPaise =
      input.rentalType === "WITH_DRIVER_LOCAL" && rule.hourlyPaise
        ? rule.hourlyPaise * hours
        : rule.dailyPaise * days;

    let offerId: string | undefined;
    if (input.offerCode) {
      const offer = await this.validOffer(input.offerCode, input.userId);
      amountPaise = this.discount(amountPaise, offer);
      offerId = offer.id;
    }

    const pickup =
      input.pickupBranchId ??
      model.city.branches[0]?.id;
    if (!pickup) throw new BadRequestException("No pickup branch");

    const quote = await prisma.quote.create({
      data: {
        userId: input.userId,
        carModelId: input.carModelId,
        rentalType: input.rentalType,
        startsAt,
        endsAt,
        amountPaise,
        depositPaise: rule.depositPaise,
        offerId,
        expiresAt: addMinutes(new Date(), 20),
        payload: {
          days,
          hours,
          pickupBranchId: pickup,
          dropBranchId: input.dropBranchId ?? pickup,
          extraKmPaise: rule.extraKmPaise,
        },
      },
    });
    return quote;
  }

  async applyOffer(quoteId: string, code: string, userId?: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.expiresAt < new Date()) {
      throw new BadRequestException("Quote expired");
    }
    const offer = await this.validOffer(code, userId);
    const amountPaise = this.applyOfferAmount(quote.amountPaise, offer);
    return prisma.quote.update({
      where: { id: quoteId },
      data: { amountPaise, offerId: offer.id },
    });
  }

  async createBooking(userId: string, quoteId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote || quote.expiresAt < new Date()) {
      throw new BadRequestException("Quote expired");
    }
    const existing = await prisma.booking.findUnique({ where: { quoteId } });
    if (existing) return existing;

    const payload = quote.payload as {
      pickupBranchId: string;
      dropBranchId: string;
    };
    const booking = await prisma.booking.create({
      data: {
        publicId: this.publicId(),
        userId,
        quoteId: quote.id,
        carModelId: quote.carModelId,
        rentalType: quote.rentalType,
        status: "HOLD",
        startsAt: quote.startsAt,
        endsAt: quote.endsAt,
        pickupBranchId: payload.pickupBranchId,
        dropBranchId: payload.dropBranchId,
        amountPaise: quote.amountPaise,
        depositPaise: quote.depositPaise,
        offerId: quote.offerId,
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
      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          from: "HOLD",
          to: "AWAITING_PAYMENT",
        },
      });
    } catch (err) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });
      throw err;
    }

    if (quote.offerId && userId) {
      await prisma.offerRedemption.create({
        data: { offerId: quote.offerId, userId },
      }).catch(() => undefined);
    }

    return prisma.booking.findUnique({
      where: { id: booking.id },
      include: { history: true, extras: true },
    });
  }

  get(id: string) {
    return prisma.booking.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: {
        history: { orderBy: { createdAt: "asc" } },
        extras: true,
        payments: true,
        kycCase: true,
        agreements: true,
        driverAssignment: { include: { driver: true } },
        inspections: true,
      },
    });
  }

  mine(userId: string) {
    return prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    });
  }

  async cancel(userId: string, id: string, staff: boolean) {
    const booking = await this.require(id);
    if (!staff && booking.userId !== userId) {
      throw new BadRequestException("Not your booking");
    }
    const locked: BookingStatus[] = ["HANDOVER", "ONGOING", "COMPLETED"];
    if (locked.includes(booking.status)) {
      throw new BadRequestException("Cannot cancel after handover");
    }
    await this.setStatus(booking.id, "CANCELLED", "customer/admin cancel");
    await internalFetch(serviceUrls().catalog, "/internal/availability/release", {
      method: "POST",
      body: JSON.stringify({ bookingId: booking.id }),
    }).catch(() => undefined);
    return this.get(booking.id);
  }

  async adminPatch(id: string, body: Record<string, unknown>) {
    const booking = await this.require(id);
    return prisma.booking.update({
      where: { id: booking.id },
      data: {
        notes: body.notes != null ? String(body.notes) : undefined,
        flightNumber: body.flightNumber != null ? String(body.flightNumber) : undefined,
        startsAt: body.startsAt ? new Date(String(body.startsAt)) : undefined,
        endsAt: body.endsAt ? new Date(String(body.endsAt)) : undefined,
      },
    });
  }

  async adminStatus(id: string, to: BookingStatus, reason?: string) {
    await this.require(id);
    await this.setStatus(id, to, reason ?? "admin");
    if (to === "CONFIRMED") {
      await internalFetch(serviceUrls().catalog, "/internal/availability/confirm", {
        method: "POST",
        body: JSON.stringify({ bookingId: id }),
      }).catch(() => undefined);
    }
    if (to === "CANCELLED" || to === "NO_SHOW") {
      await internalFetch(serviceUrls().catalog, "/internal/availability/release", {
        method: "POST",
        body: JSON.stringify({ bookingId: id }),
      }).catch(() => undefined);
    }
    return this.get(id);
  }

  async assignVehicle(id: string, vehicleId: string) {
    const booking = await this.require(id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    return prisma.booking.update({
      where: { id: booking.id },
      data: { vehicleId },
    });
  }

  async assignDriver(id: string, driverId: string) {
    const booking = await this.require(id);
    return prisma.driverAssignment.upsert({
      where: { bookingId: booking.id },
      create: { bookingId: booking.id, driverId },
      update: { driverId },
    });
  }

  async paymentCaptured(id: string) {
    const booking = await this.require(id);
    const next: BookingStatus =
      booking.rentalType === "SELF_DRIVE" ? "AWAITING_KYC" : "CONFIRMED";
    await this.setStatus(booking.id, next, "payment captured");
    await internalFetch(serviceUrls().catalog, "/internal/availability/confirm", {
      method: "POST",
      body: JSON.stringify({ bookingId: booking.id }),
    }).catch(() => undefined);
    if (next === "CONFIRMED") {
      await internalFetch(serviceUrls().notification, "/internal/notify", {
        method: "POST",
        body: JSON.stringify({
          template: "booking_confirmed",
          toUserId: booking.userId,
          data: { publicId: booking.publicId },
        }),
      }).catch(() => undefined);
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
      await internalFetch(serviceUrls().notification, "/internal/notify", {
        method: "POST",
        body: JSON.stringify({
          template: "booking_confirmed",
          toUserId: booking.userId,
          data: { publicId: booking.publicId },
        }),
      }).catch(() => undefined);
    }
    return this.get(booking.id);
  }

  listAdmin(status?: BookingStatus) {
    return prisma.booking.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { email: true, profile: true } }, payments: true },
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
      await internalFetch(serviceUrls().catalog, "/internal/availability/release", {
        method: "POST",
        body: JSON.stringify({ bookingId: booking.id }),
      }).catch(() => undefined);
    }
    return { expired: stale.length };
  }

  async createSubscription(userId: string, planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");
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
      data: { amountPaise: plan.pricePaise },
    });
    const booking = await this.createBooking(userId, quote.id);
    if (!booking) throw new BadRequestException("Could not create subscription booking");
    await prisma.subscription.create({
      data: { bookingId: booking.id, planId: plan.id },
    });
    return this.get(booking.id);
  }

  listPackages() {
    return prisma.tourPackage.findMany({
      where: { published: true },
      include: { daysDetail: { orderBy: { dayNumber: "asc" } } },
    });
  }

  adminPackages() {
    return prisma.tourPackage.findMany({
      include: { daysDetail: true },
    });
  }

  createPackage(body: { slug: string; name: string; days: number; pricePaise: number; published?: boolean }) {
    return prisma.tourPackage.create({ data: body });
  }

  updatePackage(id: string, body: Record<string, unknown>) {
    return prisma.tourPackage.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        days: body.days != null ? Number(body.days) : undefined,
        pricePaise: body.pricePaise != null ? Number(body.pricePaise) : undefined,
        published: body.published != null ? Boolean(body.published) : undefined,
      },
    });
  }

  deletePackage(id: string) {
    return prisma.tourPackage.delete({ where: { id } });
  }

  listCityPairs() {
    return prisma.cityPairRate.findMany();
  }

  upsertCityPair(body: { fromCityId: string; toCityId: string; oneWayPaise: number }) {
    return prisma.cityPairRate.upsert({
      where: { fromCityId_toCityId: { fromCityId: body.fromCityId, toCityId: body.toCityId } },
      create: body,
      update: { oneWayPaise: body.oneWayPaise },
    });
  }

  private applyOfferAmount(amount: number, offer: { type: OfferType; value: number }) {
    return this.discount(amount, offer);
  }

  private discount(amount: number, offer: { type: OfferType; value: number }) {
    if (offer.type === "PERCENT") {
      return Math.max(0, Math.round(amount * (1 - offer.value / 100)));
    }
    return Math.max(0, amount - offer.value);
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
    await prisma.booking.update({ where: { id }, data: { status: to } });
    await prisma.bookingStatusHistory.create({
      data: { bookingId: id, from: booking.status, to, reason },
    });
  }
}
