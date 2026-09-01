import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { PaymentKind } from "@prisma/client";
import { PaymentEngine } from "./payment.service";
import { currentUser, requireRoles } from "../../lib/auth";

@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentEngine) {}

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
  get(@Req() req: Request, @Param("id") id: string) {
    currentUser(req);
    return this.payments.get(id);
  }

  @Get("v1/me/invoices")
  invoices(@Req() req: Request) {
    return this.payments.invoices(currentUser(req).id);
  }

  @Get("v1/me/wallet")
  wallet(@Req() req: Request) {
    return this.payments.wallet(currentUser(req).id);
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
}
