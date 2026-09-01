import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { BookingStatus, RentalType } from "@prisma/client";
import { BookingEngine } from "./booking.service";
import { assertInternal, currentUser, isStaff, requireRoles, requireStaff } from "../../lib/auth";

@Controller()
export class BookingController {
  constructor(private readonly bookings: BookingEngine) {}

  @Post("v1/quotes")
  quote(
    @Req() req: Request,
    @Body()
    body: {
      carModelId: string;
      rentalType: RentalType;
      startsAt: string;
      endsAt: string;
      pickupBranchId?: string;
      dropBranchId?: string;
      offerCode?: string;
    }
  ) {
    const user = currentUser(req);
    return this.bookings.quote({ ...body, userId: user.id });
  }

  @Post("v1/quotes/:id/apply-offer")
  applyOffer(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { code?: string }
  ) {
    const user = currentUser(req);
    return this.bookings.applyOffer(id, body.code ?? "", user.id);
  }

  @Post("v1/bookings")
  create(@Req() req: Request, @Body() body: { quoteId?: string }) {
    if (!body?.quoteId) return { error: "quoteId required" };
    return this.bookings.createBooking(currentUser(req).id, body.quoteId);
  }

  @Get("v1/bookings/:id")
  async get(@Req() req: Request, @Param("id") id: string) {
    const booking = await this.bookings.get(id);
    if (!booking) return { error: "not found" };
    const user = currentUser(req);
    if (booking.userId !== user.id && !isStaff(user)) {
      return { error: "forbidden" };
    }
    return booking;
  }

  @Get("v1/me/bookings")
  mine(@Req() req: Request) {
    return this.bookings.mine(currentUser(req).id);
  }

  @Post("v1/bookings/:id/cancel")
  cancel(@Req() req: Request, @Param("id") id: string) {
    const user = currentUser(req);
    return this.bookings.cancel(user.id, id, isStaff(user));
  }

  @Get("v1/admin/bookings")
  adminList(@Req() req: Request, @Query("status") status?: BookingStatus) {
    requireStaff(req);
    return this.bookings.listAdmin(status);
  }

  @Patch("v1/admin/bookings/:id")
  adminPatch(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminPatch(id, body);
  }

  @Post("v1/admin/bookings/:id/status")
  adminStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { status: BookingStatus; reason?: string }
  ) {
    requireRoles(req, "SALES", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminStatus(id, body.status, body.reason);
  }

  @Post("v1/admin/bookings/:id/assign-vehicle")
  assignVehicle(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { vehicleId?: string }
  ) {
    requireRoles(req, "FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.assignVehicle(id, body.vehicleId ?? "");
  }

  @Post("v1/admin/bookings/:id/assign-driver")
  assignDriver(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { driverId?: string }
  ) {
    requireRoles(req, "FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.assignDriver(id, body.driverId ?? "");
  }

  @Post("v1/subscriptions")
  subscribe(@Req() req: Request, @Body() body: { planId?: string }) {
    return this.bookings.createSubscription(currentUser(req).id, body.planId ?? "");
  }

  @Get("v1/public/packages")
  packages() {
    return this.bookings.listPackages();
  }

  @Get("v1/admin/packages")
  adminPackages(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.bookings.adminPackages();
  }

  @Post("v1/admin/packages")
  createPackage(@Req() req: Request, @Body() body: { slug: string; name: string; days: number; pricePaise: number; published?: boolean }) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.bookings.createPackage(body);
  }

  @Patch("v1/admin/packages/:id")
  updatePackage(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.bookings.updatePackage(id, body);
  }

  @Post("v1/admin/packages/:id/delete")
  deletePackage(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.bookings.deletePackage(id);
  }

  @Get("v1/admin/city-pairs")
  cityPairs(@Req() req: Request) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.listCityPairs();
  }

  @Post("v1/admin/city-pairs")
  upsertPair(
    @Req() req: Request,
    @Body() body: { fromCityId: string; toCityId: string; oneWayPaise: number }
  ) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.upsertCityPair(body);
  }

  @Post("internal/bookings/:id/payment-captured")
  paymentCaptured(@Req() req: Request, @Param("id") id: string) {
    assertInternal(req);
    return this.bookings.paymentCaptured(id);
  }

  @Post("internal/bookings/:id/kyc-approved")
  kycApproved(@Req() req: Request, @Param("id") id: string) {
    assertInternal(req);
    return this.bookings.kycApproved(id);
  }

  @Post("internal/bookings/:id/agreement-signed")
  signed(@Req() req: Request, @Param("id") id: string) {
    assertInternal(req);
    return this.bookings.agreementSigned(id);
  }

  @Post("internal/holds/expire")
  expire(@Req() req: Request) {
    assertInternal(req);
    return this.bookings.expireHolds();
  }
}
