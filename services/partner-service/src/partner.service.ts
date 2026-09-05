import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerType, Prisma, RentalType } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { assertPartnerContractActive } from "./lib/vehicle-rules";
import {
  computeCommissionPaise,
  freezeBookingCommission,
  hasPayoutBank,
  parseBank,
} from "./lib/commission";

const RENTAL_TYPES = new Set<string>(Object.values(RentalType));
const SETTLEABLE: LedgerType[] = ["TRIP_EARNING", "COMMISSION", "PENALTY", "ADJUSTMENT"];
const CLOSED_BOOKING = ["COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const PARTNER_INCLUDE = {
  vehicles: {
    select: {
      id: true,
      registration: true,
      status: true,
      ownerType: true,
      branchId: true,
      carModel: { select: { name: true } },
    },
    orderBy: { registration: "asc" as const },
  },
  rules: true,
  contracts: { orderBy: { startsOn: "desc" as const } },
} satisfies Prisma.PartnerInclude;

const SETTLEMENT_INCLUDE = {
  partner: { select: { id: true, name: true, email: true, phone: true, bankJson: true, active: true } },
  lines: {
    include: {
      ledger: {
        include: {
          booking: { select: { id: true, publicId: true, status: true, amountPaise: true, rentalType: true } },
        },
      },
    },
  },
} satisfies Prisma.SettlementInclude;

@Injectable()
export class PartnerEngine {
  list() {
    return prisma.partner.findMany({
      include: PARTNER_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  async get(id: string) {
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        ...PARTNER_INCLUDE,
        settlements: { orderBy: { periodEnd: "desc" }, take: 12 },
      },
    });
    if (!partner) throw new NotFoundException("Partner not found");
    const openDamages = await this.openDamagesForPartner(id);
    const ledgerBalance = await prisma.ledgerEntry.aggregate({
      where: { partnerId: id },
      _sum: { amountPaise: true },
    });
    return {
      ...partner,
      bank: parseBank(partner.bankJson),
      hasBank: hasPayoutBank(partner.bankJson),
      openDamageCount: openDamages.length,
      openDamages,
      ledgerBalancePaise: ledgerBalance._sum.amountPaise ?? 0,
    };
  }

  create(body: {
    name: string;
    email?: string;
    phone?: string;
    bankJson?: object;
    active?: boolean;
  }) {
    if (!body.name?.trim()) throw new BadRequestException("name required");
    return prisma.partner.create({
      data: {
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        active: body.active !== false,
        bankJson: body.bankJson ? (parseBank(body.bankJson) as object) : undefined,
      },
      include: PARTNER_INCLUDE,
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    await this.require(id);
    const data: Prisma.PartnerUpdateInput = {};
    if (body.name != null) {
      if (!String(body.name).trim()) throw new BadRequestException("name required");
      data.name = String(body.name).trim();
    }
    if (body.email !== undefined) data.email = body.email == null ? null : String(body.email);
    if (body.phone !== undefined) data.phone = body.phone == null ? null : String(body.phone);
    if (body.active != null) data.active = Boolean(body.active);
    if (body.bankJson !== undefined) data.bankJson = parseBank(body.bankJson) as object;
    return prisma.partner.update({ where: { id }, data, include: PARTNER_INCLUDE });
  }

  async remove(id: string) {
    const partner = await this.require(id);
    const open = await prisma.booking.count({
      where: {
        vehicle: { partnerId: id },
        status: { notIn: [...CLOSED_BOOKING] },
      },
    });
    if (open) throw new BadRequestException("Partner has open bookings — deactivate instead");
    const unpaid = await prisma.settlement.count({ where: { partnerId: id, paid: false } });
    if (unpaid) throw new BadRequestException("Partner has unpaid settlements");
    if (partner.vehicles.length) {
      throw new BadRequestException("Detach vehicles before deleting the partner");
    }
    return prisma.partner.delete({ where: { id } });
  }

  async addContract(id: string, body: { startsOn: string; endsOn?: string | null; notes?: string | null }) {
    if (!body.startsOn) throw new BadRequestException("startsOn required");
    await this.require(id);
    const startsOn = new Date(body.startsOn);
    const endsOn = body.endsOn ? new Date(body.endsOn) : null;
    if (Number.isNaN(startsOn.getTime())) throw new BadRequestException("Invalid startsOn");
    if (endsOn && endsOn < startsOn) throw new BadRequestException("endsOn must be on or after startsOn");
    return prisma.partnerContract.create({
      data: {
        partnerId: id,
        startsOn,
        endsOn,
        notes: body.notes?.trim() || null,
      },
    });
  }

  async updateContract(
    partnerId: string,
    contractId: string,
    body: { startsOn?: string; endsOn?: string | null; notes?: string | null }
  ) {
    const contract = await prisma.partnerContract.findFirst({ where: { id: contractId, partnerId } });
    if (!contract) throw new NotFoundException("Contract not found");
    const startsOn = body.startsOn ? new Date(body.startsOn) : contract.startsOn;
    const endsOn = body.endsOn === undefined ? contract.endsOn : body.endsOn ? new Date(body.endsOn) : null;
    if (endsOn && endsOn < startsOn) throw new BadRequestException("endsOn must be on or after startsOn");
    return prisma.partnerContract.update({
      where: { id: contractId },
      data: {
        startsOn,
        endsOn,
        notes: body.notes === undefined ? undefined : body.notes?.trim() || null,
      },
    });
  }

  async removeContract(partnerId: string, contractId: string) {
    const contract = await prisma.partnerContract.findFirst({ where: { id: contractId, partnerId } });
    if (!contract) throw new NotFoundException("Contract not found");
    await prisma.partnerContract.delete({ where: { id: contractId } });
    return { ok: true };
  }

  async setRules(
    id: string,
    rules: { rentalType?: string | null; percentBps: number; flatPaise?: number }[]
  ) {
    await this.require(id);
    for (const r of rules) {
      if (r.rentalType && !RENTAL_TYPES.has(r.rentalType)) {
        throw new BadRequestException(`Invalid rentalType ${r.rentalType}`);
      }
      if (!Number.isFinite(r.percentBps) || r.percentBps < 0 || r.percentBps > 10000) {
        throw new BadRequestException("percentBps must be 0–10000 (basis points)");
      }
      if (r.flatPaise != null && (r.flatPaise < 0 || !Number.isFinite(r.flatPaise))) {
        throw new BadRequestException("flatPaise must be >= 0");
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.commissionRule.deleteMany({ where: { partnerId: id } });
      if (rules.length) {
        await tx.commissionRule.createMany({
          data: rules.map((r) => ({
            partnerId: id,
            rentalType: r.rentalType ? (r.rentalType as RentalType) : null,
            percentBps: Math.round(r.percentBps),
            flatPaise: Math.round(r.flatPaise ?? 0),
          })),
        });
      }
    });
    return prisma.commissionRule.findMany({ where: { partnerId: id } });
  }

  async attachVehicle(partnerId: string, vehicleId: string) {
    if (!vehicleId) throw new BadRequestException("vehicleId required");
    await assertPartnerContractActive(partnerId);
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, partnerId: true, registration: true },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    if (vehicle.partnerId && vehicle.partnerId !== partnerId) {
      throw new BadRequestException(`${vehicle.registration} is attached to another partner`);
    }
    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: { ownerType: "PARTNER", partnerId },
      include: { carModel: { select: { name: true } }, branch: { select: { name: true } } },
    });
  }

  async detachVehicle(partnerId: string, vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, partnerId } });
    if (!vehicle) throw new NotFoundException("Vehicle not attached to this partner");
    const open = await prisma.booking.count({
      where: { vehicleId, status: { notIn: [...CLOSED_BOOKING] } },
    });
    if (open) throw new BadRequestException("Vehicle has an open booking — detach after it closes");
    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: { ownerType: "COMPANY", partnerId: null },
    });
  }

  async ledger(id: string) {
    await this.require(id);
    const entries = await prisma.ledgerEntry.findMany({
      where: { partnerId: id },
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { publicId: true, amountPaise: true, status: true, rentalType: true } },
        lines: { select: { settlementId: true, excluded: true } },
      },
    });
    const balancePaise = entries.reduce((sum, e) => sum + e.amountPaise, 0);
    return { entries, balancePaise };
  }

  async adjust(id: string, body: { amountPaise: number; note?: string }) {
    await this.require(id);
    const amountPaise = Math.round(Number(body.amountPaise));
    if (!amountPaise) throw new BadRequestException("amountPaise required");
    if (!body.note?.trim()) throw new BadRequestException("note required for adjustments");
    return prisma.ledgerEntry.create({
      data: {
        partnerId: id,
        type: "ADJUSTMENT",
        amountPaise,
        note: body.note.trim(),
      },
    });
  }

  async tripComplete(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });
    if (!booking?.vehicle?.partnerId) return { skipped: true, reason: "not a partner vehicle" };
    const partnerId = booking.vehicle.partnerId;

    const existing = await prisma.ledgerEntry.findFirst({
      where: { bookingId: booking.id, type: "TRIP_EARNING" },
    });
    if (existing) return { ok: true, partnerId, skipped: true, reason: "already posted" };

    let percentBps = booking.commissionPercentBps;
    let flatPaise = booking.commissionFlatPaise;
    if (percentBps == null || flatPaise == null) {
      const frozen = await freezeBookingCommission(booking.id);
      percentBps = frozen?.percentBps ?? 0;
      flatPaise = frozen?.flatPaise ?? 0;
    }

    const commission = computeCommissionPaise(booking.amountPaise, percentBps ?? 0, flatPaise ?? 0);
    await prisma.ledgerEntry.create({
      data: {
        partnerId,
        bookingId: booking.id,
        type: "TRIP_EARNING",
        amountPaise: booking.amountPaise,
        note: `Gross ${booking.publicId}`,
      },
    });
    if (commission) {
      await prisma.ledgerEntry.create({
        data: {
          partnerId,
          bookingId: booking.id,
          type: "COMMISSION",
          amountPaise: -commission,
          note: `${percentBps ?? 0} bps + ${flatPaise ?? 0} paise (frozen)`,
        },
      });
    }

    const damages = await prisma.damageCharge.findMany({
      where: { inspection: { bookingId: booking.id }, status: "SETTLED" },
    });
    const penalty = damages.reduce((sum, d) => sum + d.amountPaise, 0);
    if (penalty) {
      await prisma.ledgerEntry.create({
        data: {
          partnerId,
          bookingId: booking.id,
          type: "PENALTY",
          amountPaise: -penalty,
          note: `Settled damages on ${booking.publicId}`,
        },
      });
    }

    return { ok: true, partnerId, commission, penalty };
  }

  async generate(partnerId: string, periodStart: string, periodEnd: string, proposedBy?: string) {
    if (!partnerId) throw new BadRequestException("partnerId required");
    await this.require(partnerId);
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("periodStart and periodEnd required");
    }
    if (end <= start) throw new BadRequestException("periodEnd must be after periodStart");

    const existing = await prisma.settlement.findUnique({
      where: { partnerId_periodStart_periodEnd: { partnerId, periodStart: start, periodEnd: end } },
    });
    if (existing?.paid) {
      throw new BadRequestException("Settlement for this period is already paid");
    }

    const claimed = await prisma.settlementLine.findMany({
      where: {
        ledger: { partnerId },
        ...(existing ? { settlementId: { not: existing.id } } : {}),
      },
      select: { ledgerId: true },
    });
    const claimedIds = new Set(claimed.map((c) => c.ledgerId));

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        partnerId,
        type: { in: SETTLEABLE },
        createdAt: { gte: start, lte: end },
      },
      include: {
        booking: {
          include: {
            inspections: { include: { damages: true } },
            vehicle: { select: { registration: true } },
          },
        },
      },
    });

    const openDamages = await this.openDamagesForPartner(partnerId);
    const holdReasons: string[] = [];
    if (openDamages.length) {
      holdReasons.push(
        `Open damage on ${openDamages.map((d) => d.registration || d.description).join(", ")}`
      );
    }

    const lines: { ledgerId: string; excluded: boolean; excludeReason: string | null }[] = [];
    for (const entry of entries) {
      if (claimedIds.has(entry.id)) continue;
      if (entry.bookingId) {
        const booking = entry.booking;
        if (!booking || booking.status !== "COMPLETED") {
          lines.push({
            ledgerId: entry.id,
            excluded: true,
            excludeReason: `Booking ${booking?.publicId ?? entry.bookingId} is not COMPLETED`,
          });
          continue;
        }
        const open = (booking.inspections ?? []).flatMap((i) => i.damages).filter((d) => d.status === "OPEN");
        if (open.length) {
          lines.push({
            ledgerId: entry.id,
            excluded: true,
            excludeReason: `Open damage on ${booking.publicId}`,
          });
          continue;
        }
      }
      lines.push({ ledgerId: entry.id, excluded: false, excludeReason: null });
    }

    const included = entries.filter((e) => lines.some((l) => l.ledgerId === e.id && !l.excluded));
    const amountPaise = included.reduce((sum, e) => sum + e.amountPaise, 0);
    const held = holdReasons.length > 0 || lines.some((l) => l.excluded);

    const settlement = existing
      ? await prisma.settlement.update({
          where: { id: existing.id },
          data: {
            amountPaise,
            held,
            holdReason: held ? holdReasons.join("; ") || "Lines excluded (open damage or incomplete trip)" : null,
            proposedBy: proposedBy ?? existing.proposedBy,
          },
        })
      : await prisma.settlement.create({
          data: {
            partnerId,
            periodStart: start,
            periodEnd: end,
            amountPaise,
            held,
            holdReason: held ? holdReasons.join("; ") || "Lines excluded (open damage or incomplete trip)" : null,
            proposedBy: proposedBy ?? null,
          },
        });

    await prisma.settlementLine.deleteMany({ where: { settlementId: settlement.id } });
    if (lines.length) {
      await prisma.settlementLine.createMany({
        data: lines.map((l) => ({
          settlementId: settlement.id,
          ledgerId: l.ledgerId,
          excluded: l.excluded,
          excludeReason: l.excludeReason,
        })),
      });
    }

    return prisma.settlement.findUnique({
      where: { id: settlement.id },
      include: SETTLEMENT_INCLUDE,
    });
  }

  async generateAll(periodStart: string, periodEnd: string, proposedBy?: string) {
    const partners = await prisma.partner.findMany({ where: { active: true }, select: { id: true } });
    const results = [];
    for (const p of partners) {
      results.push(await this.generate(p.id, periodStart, periodEnd, proposedBy));
    }
    return { count: results.length, settlements: results };
  }

  async getSettlement(id: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: SETTLEMENT_INCLUDE,
    });
    if (!settlement) throw new NotFoundException("Settlement not found");
    return settlement;
  }

  async markPaid(id: string, utr: string | undefined, paidBy?: string) {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: { partner: true, lines: true },
    });
    if (!settlement) throw new NotFoundException("Settlement not found");
    if (settlement.paid) throw new BadRequestException("Settlement already paid");
    if (settlement.held) {
      throw new BadRequestException(settlement.holdReason || "Payout is on hold (open damage)");
    }
    if (!hasPayoutBank(settlement.partner.bankJson)) {
      throw new BadRequestException("Bank account name, number and IFSC required before mark-paid");
    }
    const paid = await prisma.settlement.update({
      where: { id },
      data: {
        paid: true,
        utr: utr?.trim() || null,
        paidAt: new Date(),
        paidBy: paidBy ?? null,
      },
      include: SETTLEMENT_INCLUDE,
    });
    const already = await prisma.ledgerEntry.findFirst({
      where: { partnerId: settlement.partnerId, type: "PAYOUT", note: { contains: settlement.id } },
    });
    if (!already && settlement.amountPaise) {
      await prisma.ledgerEntry.create({
        data: {
          partnerId: settlement.partnerId,
          type: "PAYOUT",
          amountPaise: -settlement.amountPaise,
          note: `Payout ${settlement.id}${utr ? ` UTR ${utr}` : ""}`,
        },
      });
    }
    return paid;
  }

  async releaseHold(id: string, proposedBy?: string) {
    const settlement = await this.getSettlement(id);
    if (settlement.paid) throw new BadRequestException("Settlement already paid");
    return this.generate(
      settlement.partnerId,
      settlement.periodStart.toISOString(),
      settlement.periodEnd.toISOString(),
      proposedBy
    );
  }

  settlements(partnerId?: string) {
    return prisma.settlement.findMany({
      where: partnerId ? { partnerId } : undefined,
      include: {
        partner: { select: { id: true, name: true, email: true, active: true, bankJson: true } },
        lines: true,
      },
      orderBy: { periodEnd: "desc" },
    });
  }

  private async require(id: string) {
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: { vehicles: { select: { id: true } } },
    });
    if (!partner) throw new NotFoundException("Partner not found");
    return partner;
  }

  private async openDamagesForPartner(partnerId: string) {
    const damages = await prisma.damageCharge.findMany({
      where: {
        status: "OPEN",
        inspection: { vehicle: { partnerId } },
      },
      include: {
        inspection: {
          select: {
            booking: { select: { publicId: true } },
            vehicle: { select: { registration: true } },
          },
        },
      },
    });
    return damages.map((d) => ({
      id: d.id,
      description: d.description,
      amountPaise: d.amountPaise,
      publicId: d.inspection.booking.publicId,
      registration: d.inspection.vehicle.registration,
    }));
  }
}
