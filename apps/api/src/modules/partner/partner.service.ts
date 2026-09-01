import { Injectable } from "@nestjs/common";
import { prisma } from "../../lib/prisma";

@Injectable()
export class PartnerEngine {
  list() {
    return prisma.partner.findMany({
      include: { vehicles: true, rules: true, contracts: true },
      orderBy: { name: "asc" },
    });
  }
  create(body: { name: string; email?: string; phone?: string; bankJson?: object }) {
    return prisma.partner.create({ data: body });
  }
  update(id: string, body: Record<string, unknown>) {
    return prisma.partner.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        email: body.email != null ? String(body.email) : undefined,
        phone: body.phone != null ? String(body.phone) : undefined,
        active: body.active != null ? Boolean(body.active) : undefined,
        bankJson: body.bankJson as object | undefined,
      },
    });
  }
  remove(id: string) {
    return prisma.partner.delete({ where: { id } });
  }

  async setRules(id: string, rules: { rentalType?: string | null; percentBps: number; flatPaise?: number }[]) {
    await prisma.commissionRule.deleteMany({ where: { partnerId: id } });
    await prisma.commissionRule.createMany({
      data: rules.map((r) => ({
        partnerId: id,
        rentalType: (r.rentalType as never) ?? null,
        percentBps: r.percentBps,
        flatPaise: r.flatPaise ?? 0,
      })),
    });
    return prisma.commissionRule.findMany({ where: { partnerId: id } });
  }

  ledger(id: string) {
    return prisma.ledgerEntry.findMany({
      where: { partnerId: id },
      orderBy: { createdAt: "desc" },
      include: { booking: { select: { publicId: true, amountPaise: true } } },
    });
  }

  async tripComplete(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });
    if (!booking?.vehicle?.partnerId) return { skipped: true };
    const partnerId = booking.vehicle.partnerId;
    const rule = await prisma.commissionRule.findFirst({
      where: {
        partnerId,
        OR: [{ rentalType: booking.rentalType }, { rentalType: null }],
      },
      orderBy: { rentalType: "desc" },
    });
    const commission = rule
      ? Math.round((booking.amountPaise * rule.percentBps) / 10000) + rule.flatPaise
      : 0;
    await prisma.ledgerEntry.create({
      data: {
        partnerId,
        bookingId: booking.id,
        type: "TRIP_EARNING",
        amountPaise: booking.amountPaise,
      },
    });
    if (commission) {
      await prisma.ledgerEntry.create({
        data: {
          partnerId,
          bookingId: booking.id,
          type: "COMMISSION",
          amountPaise: -commission,
        },
      });
    }
    return { ok: true, partnerId, commission };
  }

  async generate(partnerId: string, periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const entries = await prisma.ledgerEntry.findMany({
      where: { partnerId, createdAt: { gte: start, lte: end } },
    });
    const amountPaise = entries.reduce((sum, e) => sum + e.amountPaise, 0);
    const settlement = await prisma.settlement.upsert({
      where: {
        partnerId_periodStart_periodEnd: { partnerId, periodStart: start, periodEnd: end },
      },
      create: { partnerId, periodStart: start, periodEnd: end, amountPaise },
      update: { amountPaise },
    });
    await prisma.settlementLine.deleteMany({ where: { settlementId: settlement.id } });
    if (entries.length) {
      await prisma.settlementLine.createMany({
        data: entries.map((e) => ({ settlementId: settlement.id, ledgerId: e.id })),
      });
    }
    return prisma.settlement.findUnique({
      where: { id: settlement.id },
      include: { lines: true },
    });
  }

  markPaid(id: string, utr?: string) {
    return prisma.settlement.update({
      where: { id },
      data: { paid: true, utr },
    });
  }

  settlements() {
    return prisma.settlement.findMany({
      include: { partner: true },
      orderBy: { periodEnd: "desc" },
    });
  }
}
