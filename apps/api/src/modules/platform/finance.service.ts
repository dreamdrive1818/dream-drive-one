import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { prisma } from "../../lib/prisma";
import type { AuthUser } from "../../lib/auth";
import { isSuper } from "../../lib/auth";
import { bookingScopeWhere } from "../../lib/vehicle-rules";
import { ensureInvoiceSeries, indianFyLabel } from "../../lib/invoice-series";

const REPORT_KINDS = ["revenue", "bookings", "deposits", "partners", "gst", "mismatch"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

const CITY_MANAGER_KINDS = new Set<ReportKind>(["revenue", "bookings", "deposits", "gst"]);
const REVENUE_KINDS = ["TOKEN", "BALANCE", "EXTRA", "PENALTY"] as const;
const CLOSED = ["CANCELLED", "NO_SHOW", "DRAFT"] as const;

const BOOKING_SELECT = {
  publicId: true,
  status: true,
  rentalType: true,
  amountPaise: true,
  depositPaise: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  pickupBranch: { select: { name: true, city: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class FinanceEngine {
  parseRange(from?: string, to?: string) {
    const today = istYmd();
    const startYmd = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : `${today.slice(0, 8)}01`;
    const endYmd = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
    if (startYmd > endYmd) throw new BadRequestException("from must be on or before to");
    return {
      from: startYmd,
      to: endYmd,
      start: new Date(`${startYmd}T00:00:00+05:30`),
      end: new Date(`${endYmd}T23:59:59.999+05:30`),
      timezone: "Asia/Kolkata",
    };
  }

  assertKind(kind: string): ReportKind {
    if (!REPORT_KINDS.includes(kind as ReportKind)) {
      throw new BadRequestException(`Unknown report: ${kind}`);
    }
    return kind as ReportKind;
  }

  assertCanRead(user: AuthUser, kind: ReportKind) {
    if (isSuper(user) || user.roles.includes("FINANCE")) return;
    if (user.roles.includes("CITY_MANAGER") && CITY_MANAGER_KINDS.has(kind)) return;
    throw new ForbiddenException("Finance role required");
  }

  assertCanWriteSeries(user: AuthUser) {
    if (isSuper(user) || user.roles.includes("FINANCE")) return;
    throw new ForbiddenException("Finance role required");
  }

  /** FINANCE sees all cities; CITY_MANAGER is locked to assigned city; SUPER_ADMIN honors ops switcher. */
  bookingWhere(user: AuthUser, cityId?: string) {
    if (user.roles.includes("CITY_MANAGER") && !isSuper(user)) {
      return bookingScopeWhere(user);
    }
    if (cityId) return { pickupBranch: { cityId } };
    if (isSuper(user)) return bookingScopeWhere(user);
    return {};
  }

  async report(
    user: AuthUser,
    kindRaw: string,
    query: { from?: string; to?: string; cityId?: string } = {}
  ) {
    const kind = this.assertKind(kindRaw);
    this.assertCanRead(user, kind);
    const range = this.parseRange(query.from, query.to);
    const bookingWhere = this.bookingWhere(user, query.cityId);
    const scoped = Object.keys(bookingWhere).length
      ? { booking: bookingWhere }
      : {};

    if (kind === "revenue") return this.revenue(range, bookingWhere, scoped);
    if (kind === "bookings") return this.bookings(range, bookingWhere);
    if (kind === "deposits") return this.deposits(range, bookingWhere, scoped);
    if (kind === "partners") return this.partners(range, bookingWhere);
    if (kind === "gst") return this.gst(range, bookingWhere, scoped);
    return this.mismatch();
  }

  async exportCsv(
    user: AuthUser,
    kindRaw: string,
    query: { from?: string; to?: string; cityId?: string } = {},
    ip?: string
  ) {
    const data = await this.report(user, kindRaw, query);
    const kind = data.kind as ReportKind;
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "finance.report.export",
        entity: "Report",
        entityId: kind,
        ip,
        payload: { kind, from: data.from, to: data.to, cityId: query.cityId || null },
      },
    });
    return {
      filename: `dreamdrive-${kind}-${data.from || "open"}-${data.to || "open"}.csv`,
      csv: "\uFEFF" + this.toCsv(kind, data),
    };
  }

  async series() {
    return ensureInvoiceSeries();
  }

  async markSeries(
    user: AuthUser,
    body: { prefix?: string; gstin?: string | null; nextNumber?: number; fyLabel?: string }
  ) {
    this.assertCanWriteSeries(user);
    const current = await ensureInvoiceSeries();
    const prefix = body.prefix != null ? String(body.prefix).trim() : current.prefix;
    if (!prefix) throw new BadRequestException("Invoice prefix is required");
    if (prefix.length > 40) throw new BadRequestException("Prefix is too long");
    const fyLabel = body.fyLabel?.trim() || current.fyLabel || indianFyLabel();
    const nextNumber =
      body.nextNumber == null ? current.nextNumber : Math.floor(Number(body.nextNumber));
    if (!Number.isFinite(nextNumber) || nextNumber < 1) {
      throw new BadRequestException("nextNumber must be >= 1");
    }
    const gstin =
      body.gstin === undefined
        ? current.gstin
        : body.gstin
          ? String(body.gstin).trim().toUpperCase()
          : null;
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) {
      throw new BadRequestException("GSTIN must be 15 alphanumeric characters");
    }
    const updated = await prisma.invoiceSeries.update({
      where: { id: current.id },
      data: { prefix, fyLabel, nextNumber, gstin, updatedBy: user.id, active: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "finance.invoice-series.mark",
        entity: "InvoiceSeries",
        entityId: updated.id,
        payload: { prefix, fyLabel, nextNumber, gstin },
      },
    });
    return updated;
  }

  async snapshotNightly() {
    const yesterday = istYmd(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const financeUser: AuthUser = {
      id: "system",
      email: "system@internal",
      roles: ["SUPER_ADMIN"],
    };
    const kinds: ReportKind[] = ["revenue", "bookings", "deposits", "partners", "gst"];
    const saved = [];
    for (const kind of kinds) {
      const data = await this.report(financeUser, kind, { from: yesterday, to: yesterday });
      const payload = {
        kind: data.kind,
        from: data.from,
        to: data.to,
        timezone: data.timezone,
        totals: data.totals,
        byCity: "byCity" in data ? data.byCity : null,
      };
      const row = await prisma.reportSnapshot.upsert({
        where: { kind_asOfIst_cityKey: { kind, asOfIst: yesterday, cityKey: "" } },
        create: { kind, asOfIst: yesterday, cityKey: "", payload },
        update: { payload },
      });
      saved.push({ id: row.id, kind: row.kind, asOfIst: row.asOfIst });
    }
    return { asOfIst: yesterday, count: saved.length, snapshots: saved };
  }

  private async revenue(
    range: ReturnType<FinanceEngine["parseRange"]>,
    bookingWhere: Record<string, unknown>,
    scoped: Record<string, unknown>
  ) {
    const [payments, refunds] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] },
          kind: { in: [...REVENUE_KINDS] },
          createdAt: { gte: range.start, lte: range.end },
          ...scoped,
        },
        include: { booking: { select: BOOKING_SELECT }, refunds: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.refund.findMany({
        where: {
          createdAt: { gte: range.start, lte: range.end },
          payment: {
            kind: { in: [...REVENUE_KINDS] },
            ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
          },
        },
        include: {
          payment: {
            include: { booking: { select: BOOKING_SELECT } },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
    ]);

    const collectionsPaise = payments.reduce((s, p) => s + p.amountPaise, 0);
    const refundsPaise = refunds.reduce((s, r) => s + r.amountPaise, 0);
    const byCity = rollupByCity(payments, (p) => p.amountPaise, "collectionsPaise");
    mergeCity(byCity, refunds, (r) => cityOf(r.payment.booking), (r) => r.amountPaise, "refundsPaise");

    const outstanding = await this.outstandingByCity(bookingWhere);
    for (const row of outstanding.byCity) {
      const slot = byCity.get(row.cityId) ?? emptyCity(row.cityId, row.cityName);
      slot.outstandingPaise = row.outstandingPaise;
      byCity.set(row.cityId, slot);
    }

    const byCityRows = [...byCity.values()].map((c) => ({
      ...c,
      netPaise: c.collectionsPaise - c.refundsPaise,
    }));

    return {
      kind: "revenue" as const,
      timezone: range.timezone,
      from: range.from,
      to: range.to,
      totals: {
        collectionsPaise,
        refundsPaise,
        netPaise: collectionsPaise - refundsPaise,
        outstandingPaise: outstanding.totalPaise,
        paymentCount: payments.length,
        refundCount: refunds.length,
      },
      byCity: byCityRows,
      rows: payments.map((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        createdIst: istYmd(p.createdAt),
        kind: p.kind,
        status: p.status,
        amountPaise: p.amountPaise,
        razorpayPaymentId: p.razorpayPaymentId,
        bookingPublicId: p.booking.publicId,
        cityId: p.booking.pickupBranch?.city?.id ?? "",
        cityName: p.booking.pickupBranch?.city?.name ?? "Unassigned",
        rentalType: p.booking.rentalType,
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        createdIst: istYmd(r.createdAt),
        amountPaise: r.amountPaise,
        razorpayRefundId: r.razorpayRefundId,
        bookingPublicId: r.payment.booking.publicId,
        cityName: r.payment.booking.pickupBranch?.city?.name ?? "Unassigned",
      })),
    };
  }

  private async bookings(
    range: ReturnType<FinanceEngine["parseRange"]>,
    bookingWhere: Record<string, unknown>
  ) {
    const rows = await prisma.booking.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        ...bookingWhere,
      },
      select: {
        ...BOOKING_SELECT,
        id: true,
        payments: {
          where: { status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] }, kind: { in: [...REVENUE_KINDS] } },
          select: { amountPaise: true, kind: true, refunds: { select: { amountPaise: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let amountPaise = 0;
    let paidPaise = 0;
    let outstandingPaise = 0;
    const mapped = rows.map((b) => {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
      byType[b.rentalType] = (byType[b.rentalType] ?? 0) + 1;
      const collected = b.payments.reduce((s, p) => s + p.amountPaise, 0);
      const refunded = b.payments.reduce(
        (s, p) => s + p.refunds.reduce((n, r) => n + r.amountPaise, 0),
        0
      );
      const paid = collected - refunded;
      const due = CLOSED.includes(b.status as (typeof CLOSED)[number])
        ? 0
        : Math.max(0, b.amountPaise - paid);
      amountPaise += b.amountPaise;
      paidPaise += paid;
      outstandingPaise += due;
      return {
        id: b.id,
        publicId: b.publicId,
        status: b.status,
        rentalType: b.rentalType,
        amountPaise: b.amountPaise,
        paidPaise: paid,
        outstandingPaise: due,
        createdIst: istYmd(b.createdAt),
        startsIst: istYmd(b.startsAt),
        endsIst: istYmd(b.endsAt),
        cityId: b.pickupBranch?.city?.id ?? "",
        cityName: b.pickupBranch?.city?.name ?? "Unassigned",
        branchName: b.pickupBranch?.name ?? "",
      };
    });

    return {
      kind: "bookings" as const,
      timezone: range.timezone,
      from: range.from,
      to: range.to,
      totals: {
        count: rows.length,
        amountPaise,
        paidPaise,
        outstandingPaise,
        byStatus,
        byType,
      },
      rows: mapped,
    };
  }

  private async deposits(
    range: ReturnType<FinanceEngine["parseRange"]>,
    bookingWhere: Record<string, unknown>,
    scoped: Record<string, unknown>
  ) {
    const [open, movements] = await Promise.all([
      prisma.securityDeposit.findMany({
        where: {
          held: true,
          released: false,
          ...(Object.keys(bookingWhere).length ? { booking: bookingWhere } : {}),
        },
        include: { booking: { select: BOOKING_SELECT } },
        take: 2000,
      }),
      prisma.payment.findMany({
        where: {
          kind: "DEPOSIT",
          createdAt: { gte: range.start, lte: range.end },
          ...scoped,
        },
        include: { booking: { select: BOOKING_SELECT } },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
    ]);
    const liabilityPaise = open.reduce((s, d) => s + d.amountPaise, 0);
    const byCity = rollupByCity(
      open.map((d) => ({ booking: d.booking, amountPaise: d.amountPaise })),
      (d) => d.amountPaise,
      "depositsHeldPaise"
    );
    return {
      kind: "deposits" as const,
      timezone: range.timezone,
      from: range.from,
      to: range.to,
      totals: {
        outstandingCount: open.length,
        liabilityPaise,
        movementCount: movements.length,
      },
      byCity: [...byCity.values()],
      outstanding: open.map((d) => ({
        id: d.id,
        amountPaise: d.amountPaise,
        held: d.held,
        released: d.released,
        bookingPublicId: d.booking.publicId,
        bookingStatus: d.booking.status,
        cityName: d.booking.pickupBranch?.city?.name ?? "Unassigned",
      })),
      movements: movements.map((p) => ({
        id: p.id,
        createdIst: istYmd(p.createdAt),
        status: p.status,
        amountPaise: p.amountPaise,
        bookingPublicId: p.booking.publicId,
        cityName: p.booking.pickupBranch?.city?.name ?? "Unassigned",
      })),
    };
  }

  private async partners(
    range: ReturnType<FinanceEngine["parseRange"]>,
    bookingWhere: Record<string, unknown>
  ) {
    const cityId =
      bookingWhere &&
      typeof bookingWhere === "object" &&
      "pickupBranch" in bookingWhere &&
      (bookingWhere as { pickupBranch?: { cityId?: string } }).pickupBranch?.cityId;

    const settlements = await prisma.settlement.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        ...(cityId
          ? { partner: { vehicles: { some: { branch: { cityId } } } } }
          : {}),
      },
      include: {
        partner: { select: { id: true, name: true, email: true, active: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    const unpaid = settlements.filter((s) => !s.paid);
    const held = settlements.filter((s) => s.held);
    const paidPaise = settlements.filter((s) => s.paid).reduce((s, r) => s + r.amountPaise, 0);
    const unpaidPaise = unpaid.reduce((s, r) => s + r.amountPaise, 0);
    return {
      kind: "partners" as const,
      timezone: range.timezone,
      from: range.from,
      to: range.to,
      totals: {
        settlementCount: settlements.length,
        paidPaise,
        unpaidPaise,
        heldCount: held.length,
      },
      rows: settlements.map((s) => ({
        id: s.id,
        partnerId: s.partnerId,
        partnerName: s.partner.name,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        amountPaise: s.amountPaise,
        paid: s.paid,
        held: s.held,
        holdReason: s.holdReason,
        utr: s.utr,
        paidAt: s.paidAt,
      })),
    };
  }

  private async gst(
    range: ReturnType<FinanceEngine["parseRange"]>,
    bookingWhere: Record<string, unknown>,
    scoped: Record<string, unknown>
  ) {
    const [series, invoices] = await Promise.all([
      ensureInvoiceSeries(),
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: range.start, lte: range.end },
          ...scoped,
        },
        include: {
          lines: true,
          booking: { select: BOOKING_SELECT },
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
    ]);
    const taxablePaise = invoices.reduce((s, i) => s + (i.amountPaise - i.gstPaise), 0);
    return {
      kind: "gst" as const,
      timezone: range.timezone,
      from: range.from,
      to: range.to,
      series: {
        id: series.id,
        prefix: series.prefix,
        fyLabel: series.fyLabel,
        nextNumber: series.nextNumber,
        gstin: series.gstin,
      },
      totals: {
        invoiceCount: invoices.length,
        taxablePaise,
        gstPaise: invoices.reduce((s, i) => s + i.gstPaise, 0),
        cgstPaise: invoices.reduce((s, i) => s + i.cgstPaise, 0),
        sgstPaise: invoices.reduce((s, i) => s + i.sgstPaise, 0),
        igstPaise: invoices.reduce((s, i) => s + i.igstPaise, 0),
        totalPaise: invoices.reduce((s, i) => s + i.amountPaise, 0),
      },
      rows: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        createdIst: istYmd(i.createdAt),
        amountPaise: i.amountPaise,
        taxablePaise: i.amountPaise - i.gstPaise,
        gstPaise: i.gstPaise,
        cgstPaise: i.cgstPaise,
        sgstPaise: i.sgstPaise,
        igstPaise: i.igstPaise,
        supplierState: i.supplierState,
        customerState: i.customerState,
        bookingPublicId: i.booking.publicId,
        cityName: i.booking.pickupBranch?.city?.name ?? "Unassigned",
        pdfUrl: i.pdfUrl,
      })),
    };
  }

  private async mismatch() {
    const rows = await prisma.payoutReconciliation.findMany({
      where: { status: { notIn: ["MATCHED", "OFFLINE"] } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    const today = istYmd();
    return {
      kind: "mismatch" as const,
      timezone: "Asia/Kolkata",
      from: today,
      to: today,
      totals: {
        count: rows.length,
        amountPaise: rows.reduce((s, r) => s + r.amountPaise, 0),
      },
      rows: rows.map((r) => ({
        id: r.id,
        razorpayPaymentId: r.razorpayPaymentId,
        razorpaySettlementId: r.razorpaySettlementId,
        amountPaise: r.amountPaise,
        feePaise: r.feePaise,
        status: r.status,
        notes: r.notes,
        settledAt: r.settledAt,
      })),
    };
  }

  private async outstandingByCity(bookingWhere: Record<string, unknown>) {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { notIn: [...CLOSED] },
        ...bookingWhere,
      },
      select: {
        amountPaise: true,
        pickupBranch: { select: { city: { select: { id: true, name: true } } } },
        payments: {
          where: {
            status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] },
            kind: { in: [...REVENUE_KINDS] },
          },
          select: { amountPaise: true, refunds: { select: { amountPaise: true } } },
        },
      },
      take: 5000,
    });
    const byCity = new Map<string, CityRollup>();
    let totalPaise = 0;
    for (const b of bookings) {
      const paid =
        b.payments.reduce((s, p) => s + p.amountPaise, 0) -
        b.payments.reduce((s, p) => s + p.refunds.reduce((n, r) => n + r.amountPaise, 0), 0);
      const due = Math.max(0, b.amountPaise - paid);
      if (!due) continue;
      totalPaise += due;
      const city = b.pickupBranch?.city;
      const key = city?.id ?? "";
      const slot = byCity.get(key) ?? emptyCity(key, city?.name ?? "Unassigned");
      slot.outstandingPaise += due;
      byCity.set(key, slot);
    }
    return { totalPaise, byCity: [...byCity.values()] };
  }

  private toCsv(kind: ReportKind, data: Record<string, unknown>) {
    if (kind === "revenue") {
      const rows = (data.rows as Array<Record<string, unknown>>) || [];
      return csvTable(
        ["date_ist", "booking", "city", "kind", "status", "amount_inr", "razorpay_payment_id"],
        rows.map((r) => [
          r.createdIst,
          r.bookingPublicId,
          r.cityName,
          r.kind,
          r.status,
          inr(r.amountPaise),
          r.razorpayPaymentId || "",
        ])
      );
    }
    if (kind === "bookings") {
      const rows = (data.rows as Array<Record<string, unknown>>) || [];
      return csvTable(
        ["public_id", "status", "rental_type", "city", "created_ist", "start_ist", "amount_inr", "paid_inr", "outstanding_inr"],
        rows.map((r) => [
          r.publicId,
          r.status,
          r.rentalType,
          r.cityName,
          r.createdIst,
          r.startsIst,
          inr(r.amountPaise),
          inr(r.paidPaise),
          inr(r.outstandingPaise),
        ])
      );
    }
    if (kind === "deposits") {
      const rows = (data.outstanding as Array<Record<string, unknown>>) || [];
      return csvTable(
        ["booking", "city", "amount_inr", "held", "released", "booking_status"],
        rows.map((r) => [r.bookingPublicId, r.cityName, inr(r.amountPaise), r.held, r.released, r.bookingStatus])
      );
    }
    if (kind === "partners") {
      const rows = (data.rows as Array<Record<string, unknown>>) || [];
      return csvTable(
        ["partner", "period_start", "period_end", "amount_inr", "paid", "held", "utr"],
        rows.map((r) => [
          r.partnerName,
          r.periodStart,
          r.periodEnd,
          inr(r.amountPaise),
          r.paid,
          r.held,
          r.utr || "",
        ])
      );
    }
    if (kind === "gst") {
      const rows = (data.rows as Array<Record<string, unknown>>) || [];
      return csvTable(
        ["number", "booking", "city", "date_ist", "taxable_inr", "cgst", "sgst", "igst", "total_inr", "supplier_state", "customer_state"],
        rows.map((r) => [
          r.number,
          r.bookingPublicId,
          r.cityName,
          r.createdIst,
          inr(r.taxablePaise),
          inr(r.cgstPaise),
          inr(r.sgstPaise),
          inr(r.igstPaise),
          inr(r.amountPaise),
          r.supplierState,
          r.customerState,
        ])
      );
    }
    const rows = (data.rows as Array<Record<string, unknown>>) || [];
    return csvTable(
      ["razorpay_payment_id", "settlement_id", "amount_inr", "fee_inr", "status", "notes"],
      rows.map((r) => [
        r.razorpayPaymentId,
        r.razorpaySettlementId || "",
        inr(r.amountPaise),
        inr(r.feePaise),
        r.status,
        r.notes || "",
      ])
    );
  }
}

type CityRollup = {
  cityId: string;
  cityName: string;
  collectionsPaise: number;
  refundsPaise: number;
  outstandingPaise: number;
  depositsHeldPaise: number;
};

function emptyCity(cityId: string, cityName: string): CityRollup {
  return {
    cityId,
    cityName,
    collectionsPaise: 0,
    refundsPaise: 0,
    outstandingPaise: 0,
    depositsHeldPaise: 0,
  };
}

function cityOf(booking: { pickupBranch?: { city?: { id: string; name: string } | null } | null } | null) {
  return {
    cityId: booking?.pickupBranch?.city?.id ?? "",
    cityName: booking?.pickupBranch?.city?.name ?? "Unassigned",
  };
}

function rollupByCity<T extends { booking: { pickupBranch?: { city?: { id: string; name: string } | null } | null } }>(
  rows: T[],
  amount: (row: T) => number,
  field: keyof CityRollup
) {
  const map = new Map<string, CityRollup>();
  mergeCity(map, rows, (r) => cityOf(r.booking), amount, field);
  return map;
}

function mergeCity<T>(
  map: Map<string, CityRollup>,
  rows: T[],
  city: (row: T) => { cityId: string; cityName: string },
  amount: (row: T) => number,
  field: keyof CityRollup
) {
  for (const row of rows) {
    const c = city(row);
    const slot = map.get(c.cityId) ?? emptyCity(c.cityId, c.cityName);
    if (field !== "cityId" && field !== "cityName") {
      (slot[field] as number) += amount(row);
    }
    map.set(c.cityId, slot);
  }
}

export function istYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function inr(value: unknown) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

function csvTable(headers: string[], rows: unknown[][]) {
  const line = (cells: unknown[]) =>
    cells
      .map((c) => {
        const s = c == null ? "" : String(c);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      })
      .join(",");
  return [line(headers), ...rows.map(line)].join("\r\n");
}
