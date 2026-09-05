import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "./lib/prisma";
import type { TicketStatus } from "@prisma/client";

@Injectable()
export class PlatformEngine {
  page(slug: string) {
    return prisma.cmsPage.findFirst({ where: { slug, published: true } });
  }
  banners() {
    const now = new Date();
    return prisma.banner.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });
  }
  blogs() {
    return prisma.blogPost.findMany({
      where: { published: true },
      include: { category: true },
      orderBy: { id: "desc" },
    });
  }
  blog(slug: string) {
    return prisma.blogPost.findFirst({
      where: { slug, published: true },
      include: { category: true, comments: true },
    });
  }

  async contact(body: { name: string; email?: string; phone?: string; message?: string; city?: string }) {
    return prisma.lead.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        city: body.city,
        source: "contact",
        activities: body.message
          ? { create: { note: body.message } }
          : undefined,
      },
    });
  }

  createLead(body: { name: string; email?: string; phone?: string; source?: string; city?: string }) {
    return prisma.lead.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        source: body.source ?? "web",
        city: body.city,
      },
    });
  }

  cmsList() {
    return prisma.cmsPage.findMany({ orderBy: { slug: "asc" } });
  }
  upsertPage(body: { slug: string; title: string; body: string; published?: boolean }) {
    return prisma.cmsPage.upsert({
      where: { slug: body.slug },
      create: body,
      update: { title: body.title, body: body.body, published: body.published },
    });
  }

  adminBanners() {
    return prisma.banner.findMany({ orderBy: { id: "desc" } });
  }
  createBanner(body: { title: string; imageUrl: string; link?: string; active?: boolean }) {
    return prisma.banner.create({ data: body });
  }
  updateBanner(id: string, body: Record<string, unknown>) {
    return prisma.banner.update({
      where: { id },
      data: {
        title: body.title != null ? String(body.title) : undefined,
        imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
        link: body.link != null ? String(body.link) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
      },
    });
  }

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

  tickets(query: { status?: string; assignedToId?: string; overdue?: string } = {}) {
    const now = new Date();
    return prisma.ticket
      .findMany({
        where: {
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
    return { ...ticket, messages: ticket.messages.filter((m) => !m.internal) };
  }

  async createTicket(
    userId: string,
    body: { subject: string; body: string; bookingId?: string; imageUrl?: string }
  ) {
    if (!body?.subject?.trim()) throw new BadRequestException("Subject is required");
    if (!body?.body?.trim() && !body?.imageUrl?.trim()) {
      throw new BadRequestException("Message is required");
    }
    let bookingId = body.bookingId;
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { OR: [{ id: bookingId }, { publicId: bookingId }], userId },
        select: { id: true },
      });
      if (!booking) throw new BadRequestException("Booking not found");
      bookingId = booking.id;
    }
    const hours = Number(process.env.TICKET_SLA_HOURS ?? 24) || 24;
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
    if (!staff && ticket.status === "CLOSED") throw new BadRequestException("This ticket is closed");
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
    if (staff && !isInternal && !ticket.firstRespondedAt) patch.firstRespondedAt = new Date();
    if (!isInternal && ticket.status === "RESOLVED") patch.status = "PENDING";
    else if (staff && !isInternal && ticket.status === "OPEN") patch.status = "PENDING";
    if (Object.keys(patch).length) await prisma.ticket.update({ where: { id }, data: patch });
    return staff ? this.adminTicket(id) : this.myTicket(ticket.userId, id);
  }

  async adminTicket(id: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketAdminInclude });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return decorateTicket(ticket, new Date());
  }

  async patchTicket(
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
      } else data.assignedToId = null;
    }
    if (body.slaDueAt !== undefined) data.slaDueAt = body.slaDueAt ? new Date(body.slaDueAt) : null;
    if (body.bookingId !== undefined) {
      if (body.bookingId) {
        const booking = await prisma.booking.findFirst({
          where: { OR: [{ id: body.bookingId }, { publicId: body.bookingId }] },
          select: { id: true },
        });
        if (!booking) throw new BadRequestException("Booking not found");
        data.bookingId = booking.id;
      } else data.bookingId = null;
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
    const flagged = Boolean(text && ABUSE_RE.test(text));
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
        author: r.user?.profile?.fullName?.trim().split(/\s+/)[0] || "Customer",
      })),
    };
  }

  leads(query: { status?: string; source?: string; assignedToId?: string; reminderDue?: string; q?: string } = {}) {
    const now = new Date();
    const q = query.q?.trim();
    return prisma.lead.findMany({
      where: {
        ...(query.status ? { status: query.status as "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST" } : {}),
        ...(query.source ? { source: query.source } : {}),
        ...(query.assignedToId
          ? query.assignedToId === "unassigned"
            ? { assignedToId: null }
            : { assignedToId: query.assignedToId }
          : {}),
        ...(query.reminderDue === "1" || query.reminderDue === "true"
          ? { remindAt: { lte: now }, remindedAt: null, status: { notIn: ["BOOKED", "LOST"] } }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        assignedTo: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        booking: { select: { id: true, publicId: true, status: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }
  addLeadNote(id: string, note: string) {
    return prisma.leadActivity.create({ data: { leadId: id, note } });
  }
  setLeadStatus(
    id: string,
    body: { status?: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST"; assignedToId?: string | null; remindAt?: string | null; city?: string | null }
  ) {
    return prisma.lead.update({
      where: { id },
      data: {
        status: body.status,
        assignedToId: body.assignedToId === undefined ? undefined : body.assignedToId,
        remindAt: body.remindAt === undefined ? undefined : body.remindAt ? new Date(body.remindAt) : null,
        city: body.city === undefined ? undefined : body.city,
        remindedAt: body.remindAt !== undefined ? null : undefined,
      },
    });
  }

  async dashboard() {
    const [bookings, pendingKyc, vehicles, revenue] = await Promise.all([
      prisma.booking.count(),
      prisma.kycCase.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.vehicle.count({ where: { status: "AVAILABLE" } }),
      prisma.payment.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amountPaise: true },
      }),
    ]);
    const byStatus = await prisma.booking.groupBy({
      by: ["status"],
      _count: true,
    });
    return {
      bookings,
      pendingKyc,
      vehiclesAvailable: vehicles,
      revenuePaise: revenue._sum.amountPaise ?? 0,
      byStatus,
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

const ABUSE_RE =
  /\b(scam|fraud|cheat|stolen|kill|rape|porn|xxx|nazi|terrorist|bomb|abuse)\b/i;

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
