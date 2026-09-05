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
import { PlatformEngine } from "./platform.service";
import { assertInternal, currentUser, isStaff, requireRoles, requireStaff } from "../../lib/auth";
import { onBookingCompleted } from "../../lib/loyalty-referral";

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformEngine) {}

  @Get("v1/admin/offers")
  offers(@Req() req: Request) {
    requireRoles(req, "SALES", "FINANCE", "SUPER_ADMIN");
    return this.platform.offers();
  }

  @Get("v1/admin/offers/:id")
  offer(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SALES", "FINANCE", "SUPER_ADMIN");
    return this.platform.offer(id);
  }

  @Post("v1/admin/offers")
  createOffer(
    @Req() req: Request,
    @Body()
    body: {
      code: string;
      type: "PERCENT" | "FLAT";
      value: number;
      startsAt: string;
      endsAt: string;
      maxRedemptions?: number;
      cityId?: string | null;
      rentalType?:
        | "SELF_DRIVE"
        | "WITH_DRIVER_LOCAL"
        | "WITH_DRIVER_INTERCITY"
        | "AIRPORT"
        | "OUTSTATION"
        | "ONE_WAY"
        | "TOUR_PACKAGE"
        | "SUBSCRIPTION"
        | null;
      minDays?: number | null;
      active?: boolean;
    }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.createOffer(body);
  }

  @Patch("v1/admin/offers/:id")
  updateOffer(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      code?: string;
      type?: "PERCENT" | "FLAT";
      value?: number;
      startsAt?: string;
      endsAt?: string;
      maxRedemptions?: number | null;
      cityId?: string | null;
      rentalType?:
        | "SELF_DRIVE"
        | "WITH_DRIVER_LOCAL"
        | "WITH_DRIVER_INTERCITY"
        | "AIRPORT"
        | "OUTSTATION"
        | "ONE_WAY"
        | "TOUR_PACKAGE"
        | "SUBSCRIPTION"
        | null;
      minDays?: number | null;
      active?: boolean;
    }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.updateOffer(id, body);
  }

  @Get("v1/me/loyalty")
  loyalty(@Req() req: Request) {
    return this.platform.loyalty(currentUser(req).id);
  }

  @Get("v1/me/referrals")
  myReferralGet(@Req() req: Request) {
    return this.platform.myReferral(currentUser(req).id);
  }

  @Post("v1/me/referrals")
  myReferral(@Req() req: Request) {
    return this.platform.myReferral(currentUser(req).id);
  }

  @Post("v1/me/referrals/claim")
  claimReferral(@Req() req: Request, @Body() body: { code?: string }) {
    return this.platform.claimReferral(currentUser(req).id, body.code ?? "");
  }

  @Post("internal/loyalty/booking-completed")
  async bookingCompleted(@Req() req: Request, @Body() body: { bookingId?: string }) {
    assertInternal(req);
    if (!body?.bookingId) return { error: "bookingId required" };
    return onBookingCompleted(body.bookingId);
  }

  @Get("v1/public/cars/:id/reviews")
  publicCarReviews(@Param("id") id: string) {
    return this.platform.publicCarReviews(id);
  }

  @Get("v1/admin/tickets")
  tickets(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("overdue") overdue?: string
  ) {
    const user = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.platform.tickets(user, { status, assignedToId, overdue });
  }

  @Get("v1/admin/tickets/:id")
  adminTicket(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.platform.adminTicket(id);
  }

  @Patch("v1/admin/tickets/:id")
  patchTicket(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      status?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
      assignedToId?: string | null;
      slaDueAt?: string | null;
      bookingId?: string | null;
    }
  ) {
    const actor = requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.platform.patchTicket(actor, id, body ?? {});
  }

  @Post("v1/admin/tickets/:id/messages")
  adminReply(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { body?: string; internal?: boolean; imageUrl?: string }
  ) {
    const actor = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    const canInternal = actor.roles.includes("SUPPORT") || actor.roles.includes("SUPER_ADMIN");
    return this.platform.replyTicket(
      actor.id,
      id,
      body.body ?? "",
      true,
      canInternal && Boolean(body.internal),
      body.imageUrl
    );
  }

  @Get("v1/me/tickets")
  myTickets(@Req() req: Request) {
    return this.platform.myTickets(currentUser(req).id);
  }

  @Get("v1/me/tickets/:id")
  myTicket(@Req() req: Request, @Param("id") id: string) {
    return this.platform.myTicket(currentUser(req).id, id);
  }

  @Post("v1/me/tickets")
  createMyTicket(
    @Req() req: Request,
    @Body() body: { subject: string; body: string; bookingId?: string; imageUrl?: string }
  ) {
    return this.platform.createTicket(currentUser(req).id, body);
  }

  @Patch("v1/me/tickets/:id")
  closeMyTicket(@Req() req: Request, @Param("id") id: string, @Body() body: { status?: string }) {
    if (body?.status && body.status !== "CLOSED") {
      return this.platform.myTicket(currentUser(req).id, id);
    }
    return this.platform.closeMyTicket(currentUser(req).id, id);
  }

  @Post("v1/me/tickets/:id/messages")
  replyMyTicket(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { body?: string; imageUrl?: string }
  ) {
    const user = currentUser(req);
    return this.platform.replyTicket(
      user.id,
      id,
      body.body ?? "",
      isStaff(user),
      false,
      body.imageUrl
    );
  }

  @Post("v1/tickets")
  createTicket(
    @Req() req: Request,
    @Body() body: { subject: string; body: string; bookingId?: string; imageUrl?: string }
  ) {
    return this.platform.createTicket(currentUser(req).id, body);
  }

  @Get("v1/me/reviews")
  myReviews(@Req() req: Request) {
    return this.platform.myReviews(currentUser(req).id);
  }

  @Post("v1/reviews")
  review(
    @Req() req: Request,
    @Body() body: { bookingId: string; carModelId?: string; rating: number; body?: string }
  ) {
    return this.platform.createReview(currentUser(req).id, body);
  }

  @Get("v1/admin/reviews")
  adminReviews(@Req() req: Request) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.platform.reviews();
  }

  @Patch("v1/admin/reviews/:id")
  moderateReview(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { published?: boolean }
  ) {
    requireRoles(req, "SUPER_ADMIN");
    return this.platform.moderateReview(id, Boolean(body?.published));
  }

  @Get("v1/admin/leads")
  leads(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("source") source?: string,
    @Query("assignedToId") assignedToId?: string,
    @Query("reminderDue") reminderDue?: string,
    @Query("q") q?: string
  ) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.leads({ status, source, assignedToId, reminderDue, q });
  }

  @Get("v1/admin/leads/:id")
  lead(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.lead(id);
  }

  @Post("v1/admin/leads/:id/notes")
  leadNote(@Req() req: Request, @Param("id") id: string, @Body() body: { note: string }) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.addLeadNote(id, body.note);
  }

  @Patch("v1/admin/leads/:id")
  patchLead(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      status?: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST";
      assignedToId?: string | null;
      remindAt?: string | null;
      city?: string | null;
      name?: string;
      email?: string | null;
      phone?: string | null;
      source?: string;
    }
  ) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.patchLead(id, body);
  }

  @Post("v1/admin/leads/:id/convert")
  convertLead(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      city?: string;
      startsAt?: string;
      endsAt?: string;
      carModelId?: string;
      rentalType?:
        | "SELF_DRIVE"
        | "WITH_DRIVER_LOCAL"
        | "WITH_DRIVER_INTERCITY"
        | "AIRPORT"
        | "OUTSTATION"
        | "ONE_WAY"
        | "TOUR_PACKAGE"
        | "SUBSCRIPTION";
      pickupBranchId?: string;
      dropBranchId?: string;
      offerCode?: string;
    }
  ) {
    requireRoles(req, "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.convertLead(id, body);
  }

  @Get("v1/admin/dashboard")
  dashboard(@Req() req: Request, @Query("from") from?: string, @Query("to") to?: string) {
    const user = requireStaff(req);
    return this.platform.dashboard(user, { from, to });
  }
}
