import { Injectable } from "@nestjs/common";
import { prisma } from "../../lib/prisma";

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

  tickets() {
    return prisma.ticket.findMany({
      include: { messages: true, user: { select: { email: true } } },
      orderBy: { id: "desc" },
    });
  }
  async createTicket(userId: string, body: { subject: string; body: string; bookingId?: string }) {
    return prisma.ticket.create({
      data: {
        userId,
        bookingId: body.bookingId,
        subject: body.subject,
        messages: { create: { body: body.body } },
      },
      include: { messages: true },
    });
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
