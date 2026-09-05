import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
} from "@nestjs/common";
import type { Request } from "express";
import { PaymentKind } from "@prisma/client";
import { PaymentEngine } from "./payment.service";
import { assertInternal, currentUser, isStaff, requireRoles } from "../../lib/auth";

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentEngine) {}

  // ─── Customer ───────────────────────────────────────

  @Post("v1/payments/orders")
  order(
    @Req() req: Request,
    @Body() body: { bookingId?: string; kind?: PaymentKind }
  ) {
    if (!body?.bookingId) return { error: "bookingId required" };
    return this.payments.createOrder(
      currentUser(req).id,
      body.bookingId,
      body.kind ?? "TOKEN"
    );
  }

  @Post("v1/payments/verify")
  verify(
    @Req() req: Request,
    @Body()
    body: {
      paymentId: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    }
  ) {
    return this.payments.verify(currentUser(req).id, body);
  }

  @Post("v1/webhooks/razorpay")
  async webhook(
    @Req() req: Request,
    @Headers("x-razorpay-signature") signature?: string
  ) {
    const raw =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body ?? {});
    return this.payments.webhook(raw, signature);
  }

  @Get("v1/payments/:id")
  async get(@Req() req: Request, @Param("id") id: string) {
    const user = currentUser(req);
    const payment = await this.payments.get(id);
    if (!payment) return { error: "not found" };
    if (payment.booking.userId !== user.id && !isStaff(user)) {
      return { error: "forbidden" };
    }
    return payment;
  }

  @Get("v1/me/invoices")
  invoices(@Req() req: Request) {
    return this.payments.invoices(currentUser(req).id);
  }

  @Get("v1/me/invoices/:id/pdf")
  async invoicePdf(@Req() req: Request, @Param("id") id: string) {
    const user = currentUser(req);
    const { filename, buffer } = await this.payments.invoicePdf(user.id, id, isStaff(user));
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("v1/me/invoices/:id")
  invoice(@Req() req: Request, @Param("id") id: string) {
    const user = currentUser(req);
    return this.payments.invoiceForUser(user.id, id, isStaff(user));
  }

  @Get("v1/me/wallet")
  wallet(@Req() req: Request) {
    return this.payments.wallet(currentUser(req).id);
  }

  // ─── Admin ──────────────────────────────────────────

  @Get("v1/admin/payments")
  adminPayments(
    @Req() req: Request,
    @Query() query: { status?: string; kind?: string; q?: string }
  ) {
    requireRoles(req, "FINANCE", "BRANCH_MANAGER", "SUPER_ADMIN");
    return this.payments.adminList(currentUser(req), query);
  }

  @Get("v1/admin/invoices")
  adminInvoices(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.adminInvoices();
  }

  @Get("v1/admin/deposits")
  adminDeposits(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.adminDeposits();
  }

  @Get("v1/admin/invoices/:id/pdf")
  async adminInvoicePdf(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "FINANCE", "SUPER_ADMIN");
    const { filename, buffer } = await this.payments.invoicePdf(actor.id, id, true);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("v1/admin/payments/reconcile")
  reconList(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.reconList();
  }

  @Post("v1/admin/payments/reconcile")
  reconcile(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.reconcile();
  }

  @Post("v1/admin/payments/offline")
  offline(
    @Req() req: Request,
    @Body() body: { bookingId: string; amountPaise: number; kind?: PaymentKind }
  ) {
    const actor = requireRoles(req, "FINANCE", "BRANCH_MANAGER", "SUPER_ADMIN");
    return this.payments.offline(actor.id, body);
  }

  @Post("v1/admin/payments/:id/refund")
  refund(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { amountPaise?: number }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.refund(id, body.amountPaise);
  }

  @Post("v1/admin/deposits/:id/capture")
  capture(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.depositCapture(id);
  }

  @Post("v1/admin/deposits/:id/release")
  release(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.payments.depositRelease(id);
  }

  // ─── Internal (from fleet return) ───────────────────

  @Post("internal/deposits/release-by-booking")
  async internalReleaseDeposit(
    @Req() req: Request,
    @Body() body: { bookingId: string }
  ) {
    assertInternal(req);
    return this.payments.depositReleaseByBooking(body.bookingId);
  }

  @Post("internal/payments/penalty")
  async internalPenalty(
    @Req() req: Request,
    @Body() body: { bookingId: string; label: string; amountPaise: number }
  ) {
    assertInternal(req);
    return this.payments.raisePenalty(body.bookingId, body.label, body.amountPaise);
  }
}
