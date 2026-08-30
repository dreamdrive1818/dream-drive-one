import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHmac } from "crypto";
import { PaymentKind } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { internalFetch, serviceUrls } from "./lib/http";

@Injectable()
export class PaymentEngine {
  mockMode() {
    return !process.env.RAZORPAY_KEY_ID || process.env.PAYMENTS_MOCK === "true";
  }

  async createOrder(userId: string, bookingId: string, kind: PaymentKind = "TOKEN") {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) throw new BadRequestException("Not your booking");

    const amountPaise =
      kind === "DEPOSIT" ? booking.depositPaise : booking.amountPaise;
    if (amountPaise <= 0) throw new BadRequestException("Nothing to pay");

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        kind,
        status: "CREATED",
        amountPaise,
      },
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

    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: payment.id,
      }),
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
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
    };
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

  async get(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { booking: true, refunds: true },
    });
  }

  invoices(userId: string) {
    return prisma.invoice.findMany({
      where: { booking: { userId } },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async wallet(userId: string) {
    return prisma.wallet.upsert({
      where: { userId },
      create: { userId, balancePaise: 0 },
      update: {},
      include: { txns: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
  }

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

  async refund(id: string, amountPaise?: number) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException("Payment not found");
    const amount = amountPaise ?? payment.amountPaise;
    const refund = await prisma.refund.create({
      data: { paymentId: id, amountPaise: amount },
    });
    const full = amount >= payment.amountPaise;
    await prisma.payment.update({
      where: { id },
      data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    return refund;
  }

  async depositCapture(id: string) {
    const deposit = await prisma.securityDeposit.update({
      where: { id },
      data: { held: true, released: false },
    });
    return deposit;
  }

  async depositRelease(id: string) {
    return prisma.securityDeposit.update({
      where: { id },
      data: { held: false, released: true },
    });
  }

  private async markSuccess(paymentId: string, razorpayPaymentId: string, eventId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "SUCCESS") return payment;
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCESS",
        razorpayPaymentId,
        eventId,
      },
    });
    await prisma.paymentAttempt.create({
      data: { paymentId, payload: { eventId, razorpayPaymentId } },
    });
    await this.afterSuccess(paymentId);
    return prisma.payment.findUnique({ where: { id: paymentId } });
  }

  private async afterSuccess(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) return;
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { number: { startsWith: `INV-${year}-` } },
    });
    const gstPaise = Math.round(payment.amountPaise * 0.18);
    await prisma.invoice.create({
      data: {
        bookingId: payment.bookingId,
        number: `INV-${year}-${String(count + 1).padStart(5, "0")}`,
        amountPaise: payment.amountPaise,
        gstPaise,
        lines: {
          create: [
            { label: `${payment.kind} payment`, amountPaise: payment.amountPaise - gstPaise },
            { label: "GST 18%", amountPaise: gstPaise },
          ],
        },
      },
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
}
