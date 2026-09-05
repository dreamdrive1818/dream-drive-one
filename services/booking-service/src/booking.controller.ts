import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { BookingStatus, RentalType, TripDirection } from "@prisma/client";
import { BookingEngine } from "./booking.service";
import { assertInternal, currentUser, isStaff, requireRoles, requireStaff } from "./lib/auth";

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
      extras?: { label: string; amountPaise: number }[];
      packageId?: string;
      terminalId?: string;
      flightNumber?: string;
      waitMinutes?: number;
      estimatedKm?: number;
      tripDirection?: TripDirection;
    }
  ) {
    const user = currentUser(req);
    return this.bookings.quote({ ...body, userId: user.id });
  }

  @Get("v1/quotes/:id")
  getQuote(@Req() req: Request, @Param("id") id: string) {
    const user = currentUser(req);
    return this.bookings.getQuote(id, user.id, isStaff(user));
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
    if (!booking) throw new NotFoundException("Booking not found");
    const user = currentUser(req);
    if (booking.userId !== user.id && !isStaff(user)) {
      throw new ForbiddenException("Not your booking");
    }
    return booking;
  }

  @Get("v1/me/bookings")
  mine(@Req() req: Request) {
    return this.bookings.mine(currentUser(req).id);
  }

  @Post("v1/bookings/:id/cancel")
  cancel(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    const user = currentUser(req);
    return this.bookings.cancel(user.id, id, isStaff(user), body?.reason);
  }

  @Post("v1/public/bookings/track/otp")
  trackOtp(@Body() body: { publicId?: string; phone?: string }) {
    if (!body?.publicId || !body?.phone) return { error: "publicId and phone required" };
    return this.bookings.requestTrackOtp(body.publicId, body.phone);
  }

  @Post("v1/public/bookings/track/verify")
  trackVerify(@Body() body: { publicId?: string; phone?: string; code?: string }) {
    if (!body?.publicId || !body?.phone || !body?.code) {
      return { error: "publicId, phone and code required" };
    }
    return this.bookings.verifyTrackOtp(body.publicId, body.phone, body.code);
  }

  @Get("v1/admin/bookings")
  adminList(
    @Req() req: Request,
    @Query("status") status?: BookingStatus,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    requireStaff(req);
    return this.bookings.listAdmin({ status, q, from, to });
  }

  @Post("v1/admin/bookings")
  adminCreate(
    @Req() req: Request,
    @Body()
    body: {
      userId?: string;
      customerEmail?: string;
      carModelId: string;
      rentalType: RentalType;
      startsAt: string;
      endsAt: string;
      pickupBranchId?: string;
      dropBranchId?: string;
      offerCode?: string;
      extras?: { label: string; amountPaise: number }[];
      notes?: string;
      flightNumber?: string;
      packageId?: string;
      terminalId?: string;
      waitMinutes?: number;
      estimatedKm?: number;
      tripDirection?: TripDirection;
      comped?: boolean;
    }
  ) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminCreate(body);
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
    @Body() body: { status: BookingStatus; reason?: string; comped?: boolean }
  ) {
    requireRoles(req, "SALES", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminStatus(id, body.status, body.reason, body.comped);
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

  // ─── Subscription Plans ───────────────────────────────

  @Get("v1/public/subscriptions/plans")
  subscriptionPlans() {
    return this.bookings.listSubscriptionPlans();
  }

  @Get("v1/admin/subscriptions/plans")
  adminSubscriptionPlans(@Req() req: Request) {
    requireRoles(req, "SALES", "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminListSubscriptionPlans();
  }

  @Post("v1/admin/subscriptions/plans")
  createSubscriptionPlan(
    @Req() req: Request,
    @Body()
    body: {
      carModelId: string;
      months: number;
      pricePaise: number;
      includedKm: number;
      depositPaise?: number;
      maintenanceIncl?: boolean;
      swapAllowed?: boolean;
    }
  ) {
    requireRoles(req, "SALES", "FINANCE", "SUPER_ADMIN");
    return this.bookings.createSubscriptionPlan(body);
  }

  @Patch("v1/admin/subscriptions/plans/:id")
  updateSubscriptionPlan(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    requireRoles(req, "SALES", "FINANCE", "SUPER_ADMIN");
    return this.bookings.updateSubscriptionPlan(id, body);
  }

  @Post("v1/admin/subscriptions/plans/:id/delete")
  deleteSubscriptionPlan(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.bookings.deleteSubscriptionPlan(id);
  }

  // ─── Subscription Lifecycle ─────────────────────────

  @Post("v1/subscriptions")
  subscribe(@Req() req: Request, @Body() body: { planId?: string }) {
    return this.bookings.createSubscription(currentUser(req).id, body.planId ?? "");
  }

  @Get("v1/admin/subscriptions")
  adminSubscriptions(
    @Req() req: Request,
    @Query("status") status?: string
  ) {
    requireRoles(req, "SALES", "FINANCE", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.listAdminSubscriptions({ status });
  }

  @Get("v1/admin/subscriptions/:id")
  adminGetSubscription(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SALES", "FINANCE", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.getSubscription(id);
  }

  @Post("v1/admin/subscriptions/:id/swap")
  swapSubscription(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { vehicleId?: string }
  ) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    if (!body?.vehicleId) throw new BadRequestException("vehicleId required");
    return this.bookings.swapSubscriptionVehicle(id, body.vehicleId);
  }

  @Post("v1/admin/subscriptions/:id/close")
  closeSubscription(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    requireRoles(req, "SALES", "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.closeSubscription(id, body?.reason);
  }

  @Post("v1/admin/subscriptions/:id/pause")
  pauseSubscription(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.pauseSubscription(id);
  }

  @Post("v1/admin/subscriptions/:id/resume")
  resumeSubscription(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.resumeSubscription(id);
  }

  @Get("v1/public/packages")
  packages() {
    return this.bookings.listPackages();
  }

  @Get("v1/public/packages/:slug")
  packageDetail(@Param("slug") slug: string) {
    return this.bookings.getPackage(slug);
  }

  @Get("v1/public/city-pairs")
  publicCityPairs() {
    return this.bookings.listCityPairs();
  }

  @Get("v1/admin/packages")
  adminPackages(@Req() req: Request) {
    requireRoles(req, "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.adminPackages();
  }

  @Post("v1/admin/packages")
  createPackage(
    @Req() req: Request,
    @Body()
    body: {
      slug: string;
      name: string;
      days: number;
      pricePaise: number;
      depositPaise?: number;
      cityId?: string;
      carClass?: string;
      inclusions?: string;
      published?: boolean;
      daysDetail?: { dayNumber: number; title: string; description?: string }[];
    }
  ) {
    requireRoles(req, "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.createPackage(body);
  }

  @Patch("v1/admin/packages/:id")
  updatePackage(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.updatePackage(id, body);
  }

  @Post("v1/admin/packages/:id/delete")
  deletePackage(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN", "SALES");
    return this.bookings.deletePackage(id);
  }

  @Get("v1/admin/city-pairs")
  cityPairs(@Req() req: Request) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN", "SALES");
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

  @Post("v1/admin/city-pairs/:id/delete")
  deletePair(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.deleteCityPair(id);
  }

  @Get("v1/admin/trip-extras")
  tripExtras(@Req() req: Request) {
    requireRoles(req, "SALES", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.bookings.listTripExtras();
  }

  @Post("v1/admin/bookings/:id/extras")
  addExtras(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { extras?: { label: string; amountPaise: number }[] }
  ) {
    const user = requireRoles(req, "SALES", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    const override = user.roles.includes("SALES") || user.roles.includes("SUPER_ADMIN");
    return this.bookings.addBookingExtras(id, body.extras ?? [], override);
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

  @Post("internal/bookings/mark-no-show")
  noShow(@Req() req: Request) {
    assertInternal(req);
    return this.bookings.markNoShows();
  }
}
