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
import { currentUser, isStaff, requireRoles, requireStaff } from "./lib/auth";

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformEngine) {}

  @Get("v1/public/pages/:slug")
  page(@Param("slug") slug: string) {
    return this.platform.page(slug);
  }

  @Get("v1/public/banners")
  banners() {
    return this.platform.banners();
  }

  @Get("v1/public/blogs")
  blogs() {
    return this.platform.blogs();
  }

  @Get("v1/public/blogs/:slug")
  blog(@Param("slug") slug: string) {
    return this.platform.blog(slug);
  }

  @Post("v1/public/contact")
  contact(@Body() body: { name: string; email?: string; phone?: string; message?: string; city?: string }) {
    return this.platform.contact(body);
  }

  @Post("v1/public/leads")
  publicLead(@Body() body: { name: string; email?: string; phone?: string; source?: string; city?: string }) {
    return this.platform.createLead(body);
  }

  @Get("v1/admin/cms")
  cms(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.cmsList();
  }

  @Post("v1/admin/cms")
  upsertCms(
    @Req() req: Request,
    @Body() body: { slug: string; title: string; body: string; published?: boolean }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.upsertPage(body);
  }

  @Get("v1/admin/banners")
  adminBanners(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.adminBanners();
  }

  @Post("v1/admin/banners")
  createBanner(
    @Req() req: Request,
    @Body() body: { title: string; imageUrl: string; link?: string; active?: boolean }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.createBanner(body);
  }

  @Patch("v1/admin/banners/:id")
  updateBanner(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.updateBanner(id, body);
  }

  @Get("v1/admin/offers")
  offers(@Req() req: Request) {
    requireRoles(req, "SALES", "FINANCE", "SUPER_ADMIN");
    return this.platform.offers();
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
    }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.createOffer(body);
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
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.platform.tickets({ status, assignedToId, overdue });
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
    requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.platform.patchTicket(id, body ?? {});
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
    return this.platform.replyTicket(user.id, id, body.body ?? "", isStaff(user), false, body.imageUrl);
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

  @Post("v1/admin/leads/:id/notes")
  leadNote(@Req() req: Request, @Param("id") id: string, @Body() body: { note: string }) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.addLeadNote(id, body.note);
  }

  @Patch("v1/admin/leads/:id")
  leadStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { status?: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST"; assignedToId?: string | null; remindAt?: string | null; city?: string | null }
  ) {
    requireRoles(req, "SALES", "SUPPORT", "CITY_MANAGER", "SUPER_ADMIN");
    return this.platform.setLeadStatus(id, body);
  }

  @Get("v1/admin/dashboard")
  dashboard(@Req() req: Request) {
    requireStaff(req);
    return this.platform.dashboard();
  }

  @Get("v1/admin/reports/:kind")
  reports(@Req() req: Request, @Param("kind") kind: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.platform.reports(kind);
  }
}
