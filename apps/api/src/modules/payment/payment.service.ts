import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHmac } from "crypto";
import { PaymentKind } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { internalFetch, serviceUrls } from "../../lib/http";
import { buildInvoicePdf } from "./invoice-pdf";
import type { AuthUser } from "../../lib/auth";
import { bookingScopeWhere } from "../../lib/vehicle-rules";

/** Dream-Drive operates from Karnataka. */
const SUPPLIER_STATE = "KA";

/** GST rate as a fraction (18%). */
const GST_RATE = 0.18;

@Injectable()
export class PaymentEngine {
  mockMode() {
    return !process.env.RAZORPAY_KEY_ID || process.env.PAYMENTS_MOCK === "true";
  }

  // ─── Razorpay helpers ───────────────────────────────

  private razorpayAuth() {
    return Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");
  }

  // ─── Create order ───────────────────────────────────

  async createOrder(userId: string, bookingId: string, kind: PaymentKind = "TOKEN") {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) throw new BadRequestException("Not your booking");

    const amountPaise =
      kind === "DEPOSIT"
        ? booking.depositPaise
        : kind === "BALANCE"
          ? await this.remainingBalance(booking)
          : booking.amountPaise;
    if (amountPaise <= 0) throw new BadRequestException("Nothing to pay");

    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, kind, status: "CREATED", amountPaise },
    });

    if (this.mockMode()) {
      const orderId = `order_mock_${payment.id}`;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { razorpayOrderId: orderId, status: "PENDING" },
      });
      return {
        paymentId: payment.id,
        orderId,
        amountPaise,
        currency: "INR",
        keyId: "rzp_mock",
        mock: true,
      };
    }

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.razorpayAuth()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: payment.id }),
    });
    const order = (await res.json()) as { id?: string; error?: { description?: string } };
    if (!res.ok || !order.id) {
      throw new BadRequestException(order.error?.description ?? "Razorpay order failed");
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { razorpayOrderId: order.id, status: "PENDING" },
    });
    return {
      paymentId: payment.id,
      orderId: order.id,
      amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      mock: false,
    };
  }

  // ─── Verify ─────────────────────────────────────────

  async verify(userId: string, body: {
    paymentId: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }) {
    const payment = await prisma.payment.findUnique({
      where: { id: body.paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.booking.userId !== userId) throw new BadRequestException("Not your payment");

    if (this.mockMode()) {
      return this.markSuccess(payment.id, body.razorpayPaymentId ?? `pay_mock_${payment.id}`, "verify-mock");
    }

    const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const expected = createHmac("sha256", secret)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest("hex");
    if (expected !== body.razorpaySignature) {
      throw new BadRequestException("Invalid signature");
    }
    return this.markSuccess(payment.id, body.razorpayPaymentId ?? "", "verify");
  }

  // ─── Webhook ────────────────────────────────────────

  async webhook(rawBody: string, signature: string | undefined) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (secret && signature) {
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      if (expected !== signature && !this.mockMode()) {
        throw new BadRequestException("Invalid webhook signature");
      }
    }
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
      };
    };

    // Handle refund webhooks
    if (event.event === "refund.processed" || event.event === "refund.created") {
      const refundEntity = event.payload?.refund?.entity;
      if (refundEntity?.id && refundEntity?.payment_id) {
        await prisma.refund.updateMany({
          where: { paymentId: { not: undefined }, razorpayRefundId: null },
          data: {},
        });
        // Find refund by payment's razorpayPaymentId and update
        const payment = await prisma.payment.findFirst({
          where: { razorpayPaymentId: refundEntity.payment_id },
          include: { refunds: true },
        });
        if (payment) {
          const pendingRefund = payment.refunds.find((r) => !r.razorpayRefundId);
          if (pendingRefund) {
            await prisma.refund.update({
              where: { id: pendingRefund.id },
              data: { razorpayRefundId: refundEntity.id },
            });
          }
        }
      }
      return { ok: true };
    }

    const entity = event.payload?.payment?.entity;
    const eventId = `${event.event}:${entity?.id ?? Date.now()}`;
    const dup = await prisma.payment.findUnique({ where: { eventId } });
    if (dup) return { ok: true, duplicate: true };

    const orderId = entity?.order_id;
    if (!orderId) return { ok: true, ignored: true };
    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
    if (!payment) return { ok: true, ignored: true };
    if (event.event === "payment.captured" || event.event === "payment.authorized") {
      await this.markSuccess(payment.id, entity?.id ?? "", eventId);
    }
    return { ok: true };
  }

  // ─── Read ───────────────────────────────────────────

  async get(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { booking: true, refunds: true },
    });
  }

  invoices(userId: string) {
    return prisma.invoice.findMany({
      where: { booking: { userId } },
      include: {
        lines: true,
        booking: { select: { id: true, publicId: true, status: true, rentalType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async invoiceForUser(userId: string, invoiceId: string, staff = false) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: true,
        booking: {
          select: {
            id: true,
            publicId: true,
            userId: true,
            status: true,
            rentalType: true,
            startsAt: true,
            endsAt: true,
            amountPaise: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (!staff && invoice.booking.userId !== userId) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  async wallet(userId: string) {
    return prisma.wallet.upsert({
      where: { userId },
      create: { userId, balancePaise: 0 },
      update: {},
      include: { txns: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
  }

  // ─── Admin: offline ─────────────────────────────────

  async offline(actorId: string, body: { bookingId: string; amountPaise: number; kind?: PaymentKind }) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: body.bookingId }, { publicId: body.bookingId }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: body.kind ?? "TOKEN",
        status: "SUCCESS",
        amountPaise: body.amountPaise,
        razorpayOrderId: `offline_${Date.now()}`,
      },
    });
    await this.afterSuccess(payment.id);
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "payment.offline",
        entity: "Payment",
        entityId: payment.id,
        payload: body,
      },
    }).catch(() => undefined);
    return payment;
  }

  // ─── Admin: refund (with Razorpay API) ──────────────

  async refund(id: string, amountPaise?: number) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== "SUCCESS" && payment.status !== "PARTIALLY_REFUNDED") {
      throw new BadRequestException("Only SUCCESS or PARTIALLY_REFUNDED payments can be refunded");
    }

    const existingRefunds = await prisma.refund.aggregate({
      where: { paymentId: id },
      _sum: { amountPaise: true },
    });
    const alreadyRefunded = existingRefunds._sum.amountPaise ?? 0;
    const maxRefundable = payment.amountPaise - alreadyRefunded;
    const amount = Math.min(amountPaise ?? maxRefundable, maxRefundable);
    if (amount <= 0) throw new BadRequestException("Nothing left to refund");

    // Call Razorpay refund API if we have a real razorpayPaymentId
    let razorpayRefundId: string | undefined;
    if (
      !this.mockMode() &&
      payment.razorpayPaymentId &&
      !payment.razorpayPaymentId.startsWith("pay_mock_") &&
      !payment.razorpayOrderId?.startsWith("offline_")
    ) {
      try {
        const res = await fetch(
          `https://api.razorpay.com/v1/payments/${payment.razorpayPaymentId}/refund`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${this.razorpayAuth()}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ amount }),
          }
        );
        const data = (await res.json()) as { id?: string; error?: { description?: string } };
        if (!res.ok) {
          throw new BadRequestException(data.error?.description ?? "Razorpay refund failed");
        }
        razorpayRefundId = data.id;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException("Razorpay refund request failed");
      }
    }

    const refund = await prisma.refund.create({
      data: { paymentId: id, amountPaise: amount, razorpayRefundId },
    });
    const full = (alreadyRefunded + amount) >= payment.amountPaise;
    await prisma.payment.update({
      where: { id },
      data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    return refund;
  }

  // ─── Admin: deposit ─────────────────────────────────

  async depositCapture(id: string) {
    return prisma.securityDeposit.update({
      where: { id },
      data: { held: true, released: false },
    });
  }

  async depositRelease(id: string) {
    return prisma.securityDeposit.update({
      where: { id },
      data: { held: false, released: true },
    });
  }

  /** Called from fleet return inspection to auto-release deposit */
  async depositReleaseByBooking(bookingId: string) {
    const deposit = await prisma.securityDeposit.findUnique({ where: { bookingId } });
    if (!deposit || deposit.released) return { skipped: true, reason: "no deposit" };

    const ret = await prisma.inspection.findFirst({
      where: { bookingId, type: "RETURN" },
      include: { damages: true },
      orderBy: { createdAt: "desc" },
    });
    if (!ret || ret.status !== "CLOSED") {
      return { skipped: true, reason: "return inspection not closed" };
    }
    if (ret.damages.some((d) => d.status === "OPEN")) {
      return { skipped: true, reason: "open damages" };
    }

    return prisma.securityDeposit.update({
      where: { id: deposit.id },
      data: { held: false, released: true },
    });
  }

  /** Damage / penalty extra from fleet return inspection. Creates invoice line for the customer. */
  async raisePenalty(bookingId: string, label: string, amountPaise: number) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const amount = Number(amountPaise);
    if (!label?.trim() || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Penalty label and amount required");
    }
    const extra = await prisma.bookingExtra.create({
      data: { bookingId: booking.id, label: label.trim(), amountPaise: amount },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { amountPaise: { increment: amount } },
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind: "PENALTY",
        status: "SUCCESS",
        amountPaise: amount,
        razorpayOrderId: `penalty_${Date.now()}_${extra.id.slice(-6)}`,
      },
    });
    await this.afterSuccess(payment.id, extra.label);
    return { id: extra.id, paymentId: payment.id, extra };
  }

  // ─── Admin: list all payments ───────────────────────

  async adminList(user: AuthUser, query?: { status?: string; kind?: string; q?: string }) {
    const scope = bookingScopeWhere(user);
    const where: Record<string, unknown> = {};
    if (query?.status) where.status = query.status;
    if (query?.kind) where.kind = query.kind;
    if (query?.q || Object.keys(scope).length) {
      where.booking = {
        ...scope,
        ...(query?.q ? { publicId: { contains: query.q, mode: "insensitive" } } : {}),
      };
    }
    return prisma.payment.findMany({
      where,
      include: {
        booking: { select: { publicId: true, rentalType: true, userId: true } },
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async adminInvoices() {
    return prisma.invoice.findMany({
      include: {
        lines: true,
        booking: { select: { publicId: true, rentalType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async adminDeposits() {
    return prisma.securityDeposit.findMany({
      include: {
        booking: { select: { publicId: true, status: true, rentalType: true } },
      },
      orderBy: { bookingId: "desc" },
    });
  }

  // ─── Internal helpers ───────────────────────────────

  private async remainingBalance(booking: { id: string; amountPaise: number }) {
    const paid = await prisma.payment.aggregate({
      where: { bookingId: booking.id, status: "SUCCESS", kind: { in: ["TOKEN", "BALANCE"] } },
      _sum: { amountPaise: true },
    });
    return Math.max(0, booking.amountPaise - (paid._sum.amountPaise ?? 0));
  }

  private async markSuccess(paymentId: string, razorpayPaymentId: string, eventId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "SUCCESS") return payment;
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCESS", razorpayPaymentId, eventId },
    });
    await prisma.paymentAttempt.create({
      data: { paymentId, payload: { eventId, razorpayPaymentId } },
    });
    await this.afterSuccess(paymentId);
    return prisma.payment.findUnique({ where: { id: paymentId } });
  }

  private async afterSuccess(paymentId: string, lineLabel?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            pickupBranch: { include: { city: true } },
            user: { include: { addresses: { where: { isDefault: true }, take: 1 } } },
          },
        },
      },
    });
    if (!payment) return;

    // ── GST: CGST+SGST if same state, IGST if inter-state ──
    const supplierState = payment.booking.pickupBranch?.city?.state ?? SUPPLIER_STATE;
    const customerState =
      payment.booking.user?.addresses?.[0]?.state ?? supplierState;

    const gstPaise = Math.round(payment.amountPaise * GST_RATE);
    const sameState = supplierState.toUpperCase() === customerState.toUpperCase();
    const cgstPaise = sameState ? Math.round(gstPaise / 2) : 0;
    const sgstPaise = sameState ? gstPaise - cgstPaise : 0;
    const igstPaise = sameState ? 0 : gstPaise;

    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { number: { startsWith: `INV-${year}-` } },
    });

    const gstLines = sameState
      ? [
          { label: "CGST 9%", amountPaise: cgstPaise },
          { label: "SGST 9%", amountPaise: sgstPaise },
        ]
      : [{ label: "IGST 18%", amountPaise: igstPaise }];

    const invoice = await prisma.invoice.create({
      data: {
        bookingId: payment.bookingId,
        number: `INV-${year}-${String(count + 1).padStart(5, "0")}`,
        amountPaise: payment.amountPaise,
        gstPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        supplierState,
        customerState,
        lines: {
          create: [
            { label: lineLabel || `${payment.kind} payment`, amountPaise: payment.amountPaise - gstPaise },
            ...gstLines,
          ],
        },
      },
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: `/v1/me/invoices/${invoice.id}/pdf` },
    });

    if (payment.kind === "DEPOSIT") {
      await prisma.securityDeposit.upsert({
        where: { bookingId: payment.bookingId },
        create: { bookingId: payment.bookingId, amountPaise: payment.amountPaise, held: true },
        update: { amountPaise: payment.amountPaise, held: true },
      });
    }
    if (payment.kind === "TOKEN" || payment.kind === "BALANCE") {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${payment.bookingId}/payment-captured`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
  }

  async invoicePdf(userId: string, invoiceId: string, staff = false) {
    const invoice = await this.invoiceForUser(userId, invoiceId, staff);
    return {
      filename: `${invoice.number}.pdf`,
      buffer: buildInvoicePdf({
        number: invoice.number,
        createdAt: invoice.createdAt,
        amountPaise: invoice.amountPaise,
        gstPaise: invoice.gstPaise,
        cgstPaise: invoice.cgstPaise,
        sgstPaise: invoice.sgstPaise,
        igstPaise: invoice.igstPaise,
        supplierState: invoice.supplierState,
        customerState: invoice.customerState,
        lines: invoice.lines,
        booking: invoice.booking,
      }),
    };
  }

  reconList() {
    return prisma.payoutReconciliation.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async reconcile() {
    const now = new Date();
    if (this.mockMode()) {
      const payments = await prisma.payment.findMany({
        where: { status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] } },
        take: 500,
      });
      const rows = [];
      for (const p of payments) {
        const razorpayPaymentId = p.razorpayPaymentId || `internal:${p.id}`;
        const offline = p.razorpayOrderId?.startsWith("offline_");
        const row = await prisma.payoutReconciliation.upsert({
          where: { razorpayPaymentId },
          create: {
            razorpayPaymentId,
            razorpaySettlementId: offline ? "offline" : `setl_mock_${p.id}`,
            amountPaise: p.amountPaise,
            status: offline ? "OFFLINE" : "MATCHED",
            notes: "Mock reconciliation (PAYMENTS_MOCK or no Razorpay keys)",
            settledAt: now,
          },
          update: {
            amountPaise: p.amountPaise,
            status: offline ? "OFFLINE" : "MATCHED",
            notes: "Mock reconciliation (PAYMENTS_MOCK or no Razorpay keys)",
            settledAt: now,
          },
        });
        rows.push(row);
      }
      return { mock: true, count: rows.length, rows };
    }

    const months: { year: number; month: number }[] = [];
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    type ReconItem = {
      entity_id?: string;
      type?: string;
      amount?: number;
      credit?: number;
      fee?: number;
      tax?: number;
      settlement_id?: string;
      settled_at?: number;
    };
    const items: ReconItem[] = [];
    for (const { year, month } of months) {
      const res = await fetch(
        `https://api.razorpay.com/v1/settlements/recon/combined?year=${year}&month=${month}`,
        { headers: { Authorization: `Basic ${this.razorpayAuth()}` } }
      );
      const data = (await res.json()) as { items?: ReconItem[]; error?: { description?: string } };
      if (!res.ok) {
        throw new BadRequestException(data.error?.description ?? "Razorpay recon fetch failed");
      }
      items.push(...(data.items ?? []).filter((it) => it.type === "payment" || !it.type));
    }

    const seen = new Set<string>();
    const rows = [];
    for (const item of items) {
      const razorpayPaymentId = item.entity_id;
      if (!razorpayPaymentId) continue;
      seen.add(razorpayPaymentId);
      const amountPaise = item.credit ?? item.amount ?? 0;
      const internal = await prisma.payment.findFirst({
        where: { razorpayPaymentId },
      });
      let status = "UNMATCHED_RAZORPAY";
      let notes: string | null = "Present in Razorpay settlements, missing internally";
      if (internal) {
        if (internal.amountPaise === amountPaise) {
          status = "MATCHED";
          notes = null;
        } else {
          status = "MISMATCH";
          notes = `Internal ${internal.amountPaise} paise vs Razorpay ${amountPaise} paise`;
        }
      }
      const row = await prisma.payoutReconciliation.upsert({
        where: { razorpayPaymentId },
        create: {
          razorpayPaymentId,
          razorpaySettlementId: item.settlement_id,
          amountPaise,
          feePaise: item.fee ?? 0,
          taxPaise: item.tax ?? 0,
          status,
          notes,
          settledAt: item.settled_at ? new Date(item.settled_at * 1000) : now,
        },
        update: {
          razorpaySettlementId: item.settlement_id,
          amountPaise,
          feePaise: item.fee ?? 0,
          taxPaise: item.tax ?? 0,
          status,
          notes,
          settledAt: item.settled_at ? new Date(item.settled_at * 1000) : now,
        },
      });
      rows.push(row);
    }

    const unmatchedInternal = await prisma.payment.findMany({
      where: {
        status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED"] },
        razorpayPaymentId: { not: null },
        NOT: { razorpayOrderId: { startsWith: "offline_" } },
      },
      take: 500,
    });
    for (const p of unmatchedInternal) {
      const id = p.razorpayPaymentId as string;
      if (seen.has(id)) continue;
      const row = await prisma.payoutReconciliation.upsert({
        where: { razorpayPaymentId: id },
        create: {
          razorpayPaymentId: id,
          amountPaise: p.amountPaise,
          status: "UNMATCHED_INTERNAL",
          notes: "Paid internally, not yet in Razorpay settlement report",
        },
        update: {
          amountPaise: p.amountPaise,
          status: "UNMATCHED_INTERNAL",
          notes: "Paid internally, not yet in Razorpay settlement report",
        },
      });
      rows.push(row);
    }

    return { mock: false, count: rows.length, rows };
  }
}
