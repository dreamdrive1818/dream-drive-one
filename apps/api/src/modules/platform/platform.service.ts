import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "../../lib/prisma";
import type { AuthUser } from "../../lib/auth";
import { bookingScopeWhere, vehicleScopeWhere } from "../../lib/vehicle-rules";

@Injectable()
export class PlatformEngine {
  offers() {
    return prisma.offer.findMany({ include: { redemptions: true } });
  }
  createOffer(body: {
    code: string;
    type: "PERCENT" | "FLAT";
    value: number;
    startsAt: string;
    endsAt: string;
    maxRedemptions?: number;
  }) {
    return prisma.offer.create({
      data: {
        ...body,
        code: body.code.trim().toUpperCase(),
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
  }

  tickets(user: AuthUser) {
    const booking = bookingScopeWhere(user);
    return prisma.ticket.findMany({
      where: Object.keys(booking).length ? { OR: [{ bookingId: null }, { booking }] } : undefined,
      include: { messages: { orderBy: { createdAt: "asc" } }, user: { select: { email: true, profile: true } } },
      orderBy: { id: "desc" },
    });
  }

  myTickets(userId: string) {
    return prisma.ticket.findMany({
      where: { userId },
      include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
      orderBy: { id: "desc" },
    });
  }

  async myTicket(userId: string, id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket || ticket.userId !== userId) throw new NotFoundException("Ticket not found");
    return {
      ...ticket,
      messages: ticket.messages.filter((m) => !m.internal),
    };
  }

  async createTicket(userId: string, body: { subject: string; body: string; bookingId?: string }) {
    if (!body?.subject?.trim()) throw new BadRequestException("Subject is required");
    if (!body?.body?.trim()) throw new BadRequestException("Message is required");
    if (body.bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { OR: [{ id: body.bookingId }, { publicId: body.bookingId }], userId },
      });
      if (!booking) throw new BadRequestException("Booking not found");
      body.bookingId = booking.id;
    }
    return prisma.ticket.create({
      data: {
        userId,
        bookingId: body.bookingId,
        subject: body.subject.trim(),
        messages: { create: { body: body.body.trim() } },
      },
      include: { messages: true },
    });
  }

  async replyTicket(userId: string, id: string, body: string, staff: boolean, internal = false) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    if (!staff && ticket.userId !== userId) throw new ForbiddenException("Not your ticket");
    if (!staff && internal) throw new ForbiddenException("Not allowed");
    if (!body?.trim()) throw new BadRequestException("Message is required");
    if (!staff && ticket.status === "CLOSED") {
      throw new BadRequestException("This ticket is closed");
    }
    await prisma.ticketMessage.create({
      data: { ticketId: id, body: body.trim(), internal: staff ? internal : false },
    });
    if (!internal && ticket.status === "RESOLVED") {
      await prisma.ticket.update({ where: { id }, data: { status: "PENDING" } });
    }
    return staff ? this.adminTicket(id) : this.myTicket(ticket.userId, id);
  }

  async adminTicket(id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        user: { select: { email: true, profile: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async setTicketStatus(id: string, status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED") {
    await prisma.ticket.update({ where: { id }, data: { status } });
    return this.adminTicket(id);
  }

  reviews() {
    return prisma.review.findMany({ include: { user: { select: { email: true } } } });
  }
  createReview(userId: string, body: { bookingId: string; carModelId: string; rating: number; body?: string }) {
    return prisma.review.create({
      data: { userId, ...body, published: false },
    });
  }

  leads() {
    return prisma.lead.findMany({
      include: { activities: true },
      orderBy: { createdAt: "desc" },
    });
  }
  addLeadNote(id: string, note: string) {
    return prisma.leadActivity.create({ data: { leadId: id, note } });
  }
  setLeadStatus(id: string, status: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST") {
    return prisma.lead.update({ where: { id }, data: { status } });
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

  async reports(kind: string) {
    if (kind === "gst") {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return {
        kind,
        totalAmountPaise: invoices.reduce((s, i) => s + i.amountPaise, 0),
        totalGstPaise: invoices.reduce((s, i) => s + i.gstPaise, 0),
        invoices,
      };
    }
    const payments = await prisma.payment.findMany({
      where: { status: "SUCCESS" },
      include: { booking: { select: { publicId: true, rentalType: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return {
      kind: "revenue",
      totalPaise: payments.reduce((s, p) => s + p.amountPaise, 0),
      payments,
    };
  }
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
