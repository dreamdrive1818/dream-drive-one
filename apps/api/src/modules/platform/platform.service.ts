import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "../../lib/prisma";
import type { AuthUser } from "../../lib/auth";
import { bookingScopeWhere, vehicleScopeWhere } from "../../lib/vehicle-rules";
import type { LeadStatus, TicketStatus } from "@prisma/client";
import { BookingEngine } from "../booking/booking.service";
import { normalizeLeadSource } from "../../lib/leads";

@Injectable()
export class PlatformEngine {
  constructor(private readonly bookings: BookingEngine) {}

  offers() {
    return prisma.offer.findMany({
      include: { redemptions: true, city: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async offer(id: string) {
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { redemptions: true, city: { select: { id: true, name: true, slug: true } } },
    });
    if (!offer) throw new NotFoundException("Offer not found");
    return offer;
  }

  createOffer(body: {
    code: string;
    type: "PERCENT" | "FLAT";
    value: number;
    startsAt: string;
    endsAt: string;
    maxRedemptions?: number;
    cityId?: string | null;
    rentalType?:
      | "SELF_DRIVE"
      | "WITH_DRIVER_LOCAL"
      | "WITH_DRIVER_INTERCITY"
      | "AIRPORT"
      | "OUTSTATION"
      | "ONE_WAY"
      | "TOUR_PACKAGE"
      | "SUBSCRIPTION"
      | null;
    minDays?: number | null;
    active?: boolean;
  }) {
    if (!body?.code?.trim()) throw new BadRequestException("Code is required");
    if (!["PERCENT", "FLAT"].includes(body.type)) throw new BadRequestException("Invalid type");
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException("Value must be > 0");
    if (body.type === "PERCENT" && value > 100) throw new BadRequestException("Percent max is 100");
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!(startsAt < endsAt)) throw new BadRequestException("Invalid date window");
    const minDays = body.minDays == null ? null : Number(body.minDays);
    if (minDays != null && (!Number.isInteger(minDays) || minDays < 1)) {
      throw new BadRequestException("minDays must be a positive integer");
    }
    return prisma.offer.create({
      data: {
        code: body.code.trim().toUpperCase(),
        type: body.type,
        value,
        startsAt,
        endsAt,
        maxRedemptions: body.maxRedemptions ?? null,
        cityId: body.cityId || null,
        rentalType: body.rentalType || null,
        minDays,
        active: body.active !== false,
      },
      include: { city: { select: { id: true, name: true } } },
    });
  }

  async updateOffer(
    id: string,
    body: {
      code?: string;
      type?: "PERCENT" | "FLAT";
      value?: number;
      startsAt?: string;
      endsAt?: string;
      maxRedemptions?: number | null;
      cityId?: string | null;
      rentalType?:
        | "SELF_DRIVE"
        | "WITH_DRIVER_LOCAL"
        | "WITH_DRIVER_INTERCITY"
        | "AIRPORT"
        | "OUTSTATION"
        | "ONE_WAY"
        | "TOUR_PACKAGE"
        | "SUBSCRIPTION"
        | null;
      minDays?: number | null;
      active?: boolean;
    }
  ) {
    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Offer not found");
    const data: Record<string, unknown> = {};
    if (body.code != null) data.code = body.code.trim().toUpperCase();
    if (body.type != null) data.type = body.type;
    if (body.value != null) {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value <= 0) throw new BadRequestException("Value must be > 0");
      data.value = value;
    }
    if (body.startsAt != null) data.startsAt = new Date(body.startsAt);
    if (body.endsAt != null) data.endsAt = new Date(body.endsAt);
    if (body.maxRedemptions !== undefined) data.maxRedemptions = body.maxRedemptions;
    if (body.cityId !== undefined) data.cityId = body.cityId || null;
    if (body.rentalType !== undefined) data.rentalType = body.rentalType || null;
    if (body.minDays !== undefined) {
      if (body.minDays == null) data.minDays = null;
      else {
        const minDays = Number(body.minDays);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new BadRequestException("minDays must be a positive integer");
        }
        data.minDays = minDays;
      }
    }
    if (body.active !== undefined) data.active = Boolean(body.active);
    const startsAt = (data.startsAt as Date | undefined) ?? existing.startsAt;
    const endsAt = (data.endsAt as Date | undefined) ?? existing.endsAt;
    if (!(startsAt < endsAt)) throw new BadRequestException("Invalid date window");
    return prisma.offer.update({
      where: { id },
      data,
      include: { redemptions: true, city: { select: { id: true, name: true } } },
    });
  }

  async loyalty(userId: string) {
    const account = await prisma.loyaltyAccount.upsert({
      where: { userId },
      create: { userId, points: 0 },
      update: {},
      include: { txns: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    return account;
  }

  async myReferral(userId: string) {
    let row = await prisma.referral.findFirst({
      where: { referrerId: userId, refereeId: null },
      orderBy: { createdAt: "asc" },
    });
    if (!row) {
      row = await prisma.referral.create({
        data: { referrerId: userId, code: this.referralCode() },
      });
    }
    const claimed = await prisma.referral.findUnique({ where: { refereeId: userId } });
    let claimedCode: string | null = null;
    if (claimed) {
      const master = await prisma.referral.findFirst({
        where: { referrerId: claimed.referrerId, refereeId: null },
      });
      claimedCode = master?.code ?? claimed.code;
    }
    return {
      code: row.code,
      creditPaise: row.creditPaise,
      creditedAt: row.creditedAt,
      claimedCode,
      claimedCreditedAt: claimed?.creditedAt ?? null,
    };
  }

  async claimReferral(userId: string, code: string) {
    const normalized = code?.trim().toUpperCase();
    if (!normalized) throw new BadRequestException("Referral code required");
    const existing = await prisma.referral.findUnique({ where: { refereeId: userId } });
    if (existing) throw new BadRequestException("You already claimed a referral code");
    const completed = await prisma.booking.count({
      where: { userId, status: "COMPLETED" },
    });
    if (completed > 0) {
      throw new BadRequestException("Referral must be claimed before your first completed trip");
    }
    const master = await prisma.referral.findFirst({
      where: { code: normalized, refereeId: null },
    });
    if (!master) throw new BadRequestException("Invalid referral code");
    if (master.referrerId === userId) throw new BadRequestException("Cannot use your own code");
    await prisma.referral.create({
      data: {
        referrerId: master.referrerId,
        code: `${normalized}-${userId.slice(-6).toUpperCase()}`,
        refereeId: userId,
      },
    });
    return this.myReferral(userId);
  }

  private referralCode() {
    return (
      "DD" +
      Date.now().toString(36).toUpperCase().slice(-6) +
      Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, "0")
    );
  }


  tickets(
    user: AuthUser,
    query: { status?: string; assignedToId?: string; overdue?: string } = {}
  ) {
    const booking = bookingScopeWhere(user);
    const now = new Date();
    return prisma.ticket
      .findMany({
        where: {
          ...(Object.keys(booking).length ? { OR: [{ bookingId: null }, { booking }] } : {}),
          ...(query.status ? { status: query.status as TicketStatus } : {}),
          ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
          ...(query.overdue === "1" || query.overdue === "true"
            ? {
                slaDueAt: { lt: now },
                firstRespondedAt: null,
                status: { in: ["OPEN", "PENDING"] },
              }
            : {}),
        },
        include: ticketAdminInclude,
        orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
      })
      .then((rows) => rows.map((t) => decorateTicket(t, now)));
  }

  myTickets(userId: string) {
    return prisma.ticket.findMany({
      where: { userId },
      include: {
        messages: { where: { internal: false }, orderBy: { createdAt: "asc" } },
        booking: { select: { id: true, publicId: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async myTicket(userId: string, id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        booking: { select: { id: true, publicId: true, status: true } },
      },
    });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException("Ticket not found");
    return {
      ...ticket,
      messages: ticket.messages.filter((m) => !m.internal),
    };
  }

  async createTicket(
    userId: string,
    body: { subject: string; body: string; bookingId?: string; imageUrl?: string }
  ) {
    if (!body?.subject?.trim()) throw new BadRequestException("Subject is required");
    if (!body?.body?.trim() && !body?.imageUrl?.trim()) {
      throw new BadRequestException("Message is required");
    }
    const bookingId = body.bookingId ? await this.resolveOwnedBookingId(userId, body.bookingId) : undefined;
    const hours = ticketSlaHours();
    return prisma.ticket.create({
      data: {
        userId,
        bookingId,
        subject: body.subject.trim(),
        slaDueAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        messages: {
          create: {
            authorId: userId,
            body: (body.body || "").trim() || "(image attached)",
            imageUrl: body.imageUrl?.trim() || undefined,
          },
        },
      },
      include: { messages: true, booking: { select: { id: true, publicId: true, status: true } } },
    });
  }

  async closeMyTicket(userId: string, id: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException("Ticket not found");
    await prisma.ticket.update({ where: { id }, data: { status: "CLOSED" } });
    return this.myTicket(userId, id);
  }

  async replyTicket(
    userId: string,
    id: string,
    body: string,
    staff: boolean,
    internal = false,
    imageUrl?: string
  ) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (!staff && ticket.userId !== userId) throw new ForbiddenException("Not your ticket");
    if (!staff && internal) throw new ForbiddenException("Not allowed");
    if (!body?.trim() && !imageUrl?.trim()) throw new BadRequestException("Message is required");
    if (!staff && ticket.status === "CLOSED") {
      throw new BadRequestException("This ticket is closed");
    }
    const isInternal = staff ? internal : false;
    await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: userId,
        body: (body || "").trim() || (imageUrl ? "(image attached)" : ""),
        imageUrl: imageUrl?.trim() || undefined,
        internal: isInternal,
      },
    });
    const patch: { status?: TicketStatus; firstRespondedAt?: Date } = {};
    if (staff && !isInternal && !ticket.firstRespondedAt) {
      patch.firstRespondedAt = new Date();
    }
    if (!isInternal && ticket.status === "RESOLVED") patch.status = "PENDING";
    else if (staff && !isInternal && ticket.status === "OPEN") patch.status = "PENDING";
    if (Object.keys(patch).length) {
      await prisma.ticket.update({ where: { id }, data: patch });
    }
    return staff ? this.adminTicket(id) : this.myTicket(ticket.userId, id);
  }

  async adminTicket(id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: ticketAdminInclude,
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return decorateTicket(ticket, new Date());
  }

  async patchTicket(
    actor: AuthUser,
    id: string,
    body: {
      status?: TicketStatus;
      assignedToId?: string | null;
      slaDueAt?: string | null;
      bookingId?: string | null;
    }
  ) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const data: {
      status?: TicketStatus;
      assignedToId?: string | null;
      slaDueAt?: Date | null;
      bookingId?: string | null;
    } = {};
    if (body.status) {
      if (!["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(body.status)) {
        throw new BadRequestException("Invalid status");
      }
      data.status = body.status;
    }
    if (body.assignedToId !== undefined) {
      if (body.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: body.assignedToId },
          include: { roles: { include: { role: true } } },
        });
        if (!assignee) throw new BadRequestException("Assignee not found");
        const names = assignee.roles.map((r) => r.role.name);
        if (!names.includes("SUPPORT") && !names.includes("SUPER_ADMIN")) {
          throw new BadRequestException("Assignee must be SUPPORT");
        }
        data.assignedToId = body.assignedToId;
      } else {
        data.assignedToId = null;
      }
    }
    if (body.slaDueAt !== undefined) {
      data.slaDueAt = body.slaDueAt ? new Date(body.slaDueAt) : null;
    }
    if (body.bookingId !== undefined) {
      if (body.bookingId) {
        const booking = await prisma.booking.findFirst({
          where: { OR: [{ id: body.bookingId }, { publicId: body.bookingId }] },
          select: { id: true },
        });
        if (!booking) throw new BadRequestException("Booking not found");
        data.bookingId = booking.id;
      } else {
        data.bookingId = null;
      }
    }
    if (!Object.keys(data).length) return this.adminTicket(id);
    await prisma.ticket.update({ where: { id }, data });
    return this.adminTicket(id);
  }

  reviews() {
    return prisma.review.findMany({
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
        booking: { select: { id: true, publicId: true, status: true } },
        carModel: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  myReviews(userId: string) {
    return prisma.review.findMany({
      where: { userId },
      include: { carModel: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createReview(
    userId: string,
    body: { bookingId: string; carModelId?: string; rating: number; body?: string }
  ) {
    if (!body?.bookingId) throw new BadRequestException("bookingId is required");
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException("Rating must be an integer from 1 to 5");
    }
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: body.bookingId }, { publicId: body.bookingId }], userId },
    });
    if (!booking) throw new BadRequestException("Booking not found");
    if (booking.status !== "COMPLETED") {
      throw new BadRequestException("Reviews are only allowed after the trip is completed");
    }
    if (body.carModelId && body.carModelId !== booking.carModelId) {
      throw new BadRequestException("Car does not match this booking");
    }
    const existing = await prisma.review.findUnique({ where: { bookingId: booking.id } });
    if (existing) throw new BadRequestException("This booking already has a review");
    const text = body.body?.trim() || null;
    const flagged = hasAbuse(text);
    try {
      return await prisma.review.create({
        data: {
          userId,
          bookingId: booking.id,
          carModelId: booking.carModelId,
          rating,
          body: text,
          published: false,
          flagged,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw new BadRequestException("This booking already has a review");
      }
      throw err;
    }
  }

  async moderateReview(id: string, published: boolean) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found");
    return prisma.review.update({
      where: { id },
      data: { published },
      include: {
        user: { select: { email: true, profile: { select: { fullName: true } } } },
        booking: { select: { id: true, publicId: true, status: true } },
        carModel: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async publicCarReviews(idOrSlug: string) {
    const car = await prisma.carModel.findFirst({
      where: { published: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, name: true, slug: true },
    });
    if (!car) throw new NotFoundException("Car not found");
    const rows = await prisma.review.findMany({
      where: { carModelId: car.id, published: true },
      include: { user: { select: { profile: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const count = rows.length;
    const average = count ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
    return {
      car,
      count,
      average,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
        author: publicAuthorName(r.user?.profile?.fullName),
      })),
    };
  }

  private async resolveOwnedBookingId(userId: string, bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }], userId },
      select: { id: true },
    });
    if (!booking) throw new BadRequestException("Booking not found");
    return booking.id;
  }

  leads(
    query: {
      status?: string;
      source?: string;
      assignedToId?: string;
      reminderDue?: string;
      q?: string;
    } = {}
  ) {
    const now = new Date();
    const q = query.q?.trim();
    return prisma.lead.findMany({
      where: {
        ...(query.status ? { status: query.status as LeadStatus } : {}),
        ...(query.source ? { source: normalizeLeadSource(query.source) } : {}),
        ...(query.assignedToId
          ? query.assignedToId === "unassigned"
            ? { assignedToId: null }
            : { assignedToId: query.assignedToId }
          : {}),
        ...(query.reminderDue === "1" || query.reminderDue === "true"
          ? {
              remindAt: { lte: now },
              remindedAt: null,
              status: { notIn: ["BOOKED", "LOST"] },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: leadAdminInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async lead(id: string) {
    const row = await prisma.lead.findUnique({
      where: { id },
      include: leadAdminInclude,
    });
    if (!row) throw new NotFoundException("Lead not found");
    return row;
  }

  async addLeadNote(id: string, note: string) {
    const text = note?.trim();
    if (!text) throw new BadRequestException("note required");
    await this.lead(id);
    await prisma.leadActivity.create({ data: { leadId: id, note: text } });
    return this.lead(id);
  }

  async patchLead(
    id: string,
    body: {
      status?: LeadStatus;
      assignedToId?: string | null;
      remindAt?: string | null;
      city?: string | null;
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string;
    }
  ) {
    await this.lead(id);
    const data: {
      status?: LeadStatus;
      assignedToId?: string | null;
      remindAt?: Date | null;
      remindedAt?: Date | null;
      city?: string | null;
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string;
    } = {};
    if (body.status) {
      if (!LEAD_STATUSES.has(body.status)) throw new BadRequestException("Invalid status");
      data.status = body.status;
    }
    if (body.assignedToId !== undefined) {
      if (body.assignedToId) {
        await this.assertLeadOwner(body.assignedToId);
        data.assignedToId = body.assignedToId;
      } else {
        data.assignedToId = null;
      }
    }
    if (body.remindAt !== undefined) {
      if (body.remindAt) {
        const at = new Date(body.remindAt);
        if (Number.isNaN(at.getTime())) throw new BadRequestException("Invalid remindAt");
        data.remindAt = at;
        data.remindedAt = null;
      } else {
        data.remindAt = null;
        data.remindedAt = null;
      }
    }
    if (body.city !== undefined) data.city = body.city?.trim() || null;
    if (body.name?.trim()) data.name = body.name.trim();
    if (body.email !== undefined) data.email = body.email?.trim().toLowerCase() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.source) data.source = normalizeLeadSource(body.source);
    await prisma.lead.update({ where: { id }, data });
    return this.lead(id);
  }

  async convertLead(
    id: string,
    body: {
      city?: string;
      startsAt?: string;
      endsAt?: string;
      carModelId?: string;
      rentalType?:
        | "SELF_DRIVE"
        | "WITH_DRIVER_LOCAL"
        | "WITH_DRIVER_INTERCITY"
        | "AIRPORT"
        | "OUTSTATION"
        | "ONE_WAY"
        | "TOUR_PACKAGE"
        | "SUBSCRIPTION";
      pickupBranchId?: string;
      dropBranchId?: string;
      offerCode?: string;
    }
  ) {
    const lead = await this.lead(id);
    if (lead.status === "LOST") throw new BadRequestException("Cannot convert a lost lead");
    if (lead.bookingId && lead.booking) {
      return { lead, booking: lead.booking, alreadyConverted: true };
    }
    const cityName = (body.city || lead.city || "").trim();
    if (!cityName) throw new BadRequestException("city required");
    if (!body.startsAt || !body.endsAt) throw new BadRequestException("startsAt and endsAt required");
    if (!body.carModelId) throw new BadRequestException("carModelId required to create a quote");

    const city = await prisma.city.findFirst({
      where: {
        OR: [
          { id: cityName },
          { slug: cityName.toLowerCase() },
          { name: { equals: cityName, mode: "insensitive" } },
        ],
      },
    });
    const resolvedCity = city?.name || cityName;

    const userId = await this.findOrCreateLeadCustomer(lead);
    const quote = await this.bookings.quote({
      userId,
      carModelId: body.carModelId,
      rentalType: body.rentalType || "SELF_DRIVE",
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      pickupBranchId: body.pickupBranchId,
      dropBranchId: body.dropBranchId,
      offerCode: body.offerCode,
    });
    const booking = await this.bookings.createBooking(userId, quote.id);
    if (!booking?.id) throw new BadRequestException("Could not create booking");

    await prisma.lead.update({
      where: { id },
      data: {
        status: "BOOKED",
        city: resolvedCity,
        userId,
        bookingId: booking.id,
      },
    });
    await prisma.leadActivity.create({
      data: {
        leadId: id,
        note: `Converted to booking ${booking.publicId || booking.id}`,
      },
    });
    return {
      lead: await this.lead(id),
      quote: { id: quote.id, amountPaise: quote.amountPaise, expiresAt: quote.expiresAt },
      booking,
      alreadyConverted: false,
    };
  }

  private async assertLeadOwner(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new BadRequestException("Owner not found");
    const roles = user.roles.map((r) => r.role.name);
    const allowed = ["SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN"];
    if (!roles.some((r) => allowed.includes(r))) {
      throw new BadRequestException("Owner must be SALES, SUPPORT, CITY_MANAGER, or SUPER_ADMIN");
    }
  }

  private async findOrCreateLeadCustomer(lead: {
    id: string;
    userId: string | null;
    email: string | null;
    phone: string | null;
    name: string;
  }) {
    if (lead.userId) {
      const existing = await prisma.user.findUnique({ where: { id: lead.userId } });
      if (existing) return existing.id;
    }
    const email = lead.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) return byEmail.id;
    }
    const phone = lead.phone?.trim();
    if (phone) {
      const byPhone = await prisma.user.findFirst({ where: { phone } });
      if (byPhone) return byPhone.id;
    }
    if (!email && !phone) {
      throw new BadRequestException("Convert needs a customer email or phone on the lead");
    }
    const created = await prisma.user.create({
      data: {
        firebaseUid: `lead:${lead.id}`,
        email: email || `lead.${lead.id}@leads.dreamdrive.local`,
        phone: phone || null,
        profile: { create: { fullName: lead.name } },
      },
    });
    return created.id;
  }

  async dashboard(user: AuthUser, query: { from?: string; to?: string } = {}) {
    const bookingWhere = bookingScopeWhere(user);
    const vehicleWhere = vehicleScopeWhere(user);
    const from = query.from ? new Date(query.from) : startOfIstDay();
    const to = query.to ? new Date(query.to) : endOfIstDay();
    const now = new Date();
    const [
      bookings,
      pendingKyc,
      vehicles,
      revenue,
      handoversToday,
      overdueReturns,
      pendingSignatures,
      failedPayments,
      workshop,
    ] = await Promise.all([
      prisma.booking.count({ where: bookingWhere }),
      prisma.kycCase.count({
        where: {
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          ...(Object.keys(bookingWhere).length
            ? { OR: [{ bookingId: null }, { booking: bookingWhere }] }
            : {}),
        },
      }),
      prisma.vehicle.count({ where: { status: "AVAILABLE", ...vehicleWhere } }),
      prisma.payment.aggregate({
        where: {
          status: "SUCCESS",
          ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
        },
        _sum: { amountPaise: true },
      }),
      prisma.booking.count({
        where: {
          ...bookingWhere,
          startsAt: { gte: from, lte: to },
          status: { in: ["CONFIRMED", "HANDOVER", "ONGOING"] },
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingWhere,
          endsAt: { lt: now },
          status: { in: ["HANDOVER", "ONGOING", "RETURN_PENDING"] },
        },
      }),
      prisma.booking.count({
        where: { ...bookingWhere, status: "AWAITING_SIGNATURE" },
      }),
      prisma.payment.count({
        where: {
          status: "FAILED",
          ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
        },
      }),
      prisma.vehicle.count({ where: { status: "MAINTENANCE", ...vehicleWhere } }),
    ]);
    const byStatus = await prisma.booking.groupBy({
      by: ["status"],
      where: bookingWhere,
      _count: true,
    });
    let cityName: string | null = null;
    let branchName: string | null = null;
    if (user.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: user.branchId },
        include: { city: { select: { name: true } } },
      });
      branchName = branch?.name ?? null;
      cityName = branch?.city?.name ?? null;
    } else if (user.cityId) {
      const city = await prisma.city.findUnique({ where: { id: user.cityId }, select: { name: true } });
      cityName = city?.name ?? null;
    }
    return {
      bookings,
      pendingKyc,
      vehiclesAvailable: vehicles,
      revenuePaise: revenue._sum.amountPaise ?? 0,
      handoversToday,
      overdueReturns,
      pendingSignatures,
      failedPayments,
      workshop,
      from,
      to,
      byStatus,
      scope: {
        cityId: user.cityId || null,
        branchId: user.branchId || null,
        cityName,
        branchName,
      },
    };
  }
}

const ABUSE_RE =
  /\b(scam|fraud|cheat|stolen|kill|rape|porn|xxx|nazi|terrorist|bomb|abuse)\b/i;

const LEAD_STATUSES = new Set<LeadStatus>(["NEW", "CONTACTED", "QUALIFIED", "BOOKED", "LOST"]);

const leadAdminInclude = {
  activities: { orderBy: { createdAt: "desc" as const }, take: 50 },
  assignedTo: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  booking: { select: { id: true, publicId: true, status: true, amountPaise: true } },
};

function hasAbuse(text: string | null | undefined) {
  return Boolean(text && ABUSE_RE.test(text));
}

function ticketSlaHours() {
  const n = Number(process.env.TICKET_SLA_HOURS ?? 24);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

function publicAuthorName(fullName?: string | null) {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || "Customer";
}

const ticketAdminInclude = {
  messages: { orderBy: { createdAt: "asc" as const } },
  user: { select: { email: true, profile: true } },
  assignedTo: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  booking: { select: { id: true, publicId: true, status: true } },
};

function decorateTicket<T extends { slaDueAt: Date | null; firstRespondedAt: Date | null; status: string }>(
  ticket: T,
  now: Date
) {
  const slaOverdue = Boolean(
    ticket.slaDueAt &&
      !ticket.firstRespondedAt &&
      ticket.slaDueAt < now &&
      (ticket.status === "OPEN" || ticket.status === "PENDING")
  );
  return { ...ticket, slaOverdue };
}

function istYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfIstDay(date = new Date()) {
  return new Date(`${istYmd(date)}T00:00:00+05:30`);
}

function endOfIstDay(date = new Date()) {
  return new Date(`${istYmd(date)}T23:59:59.999+05:30`);
}
