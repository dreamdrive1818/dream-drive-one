import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { PlatformEngine } from "./platform.service";
import { currentUser, requireRoles, requireStaff } from "../../lib/auth";
import { publicClientConfig } from "../../lib/cloudinary";

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformEngine) {}

  @Get("v1/public/config")
  publicConfig() {
    return publicClientConfig();
  }

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

  @Get("v1/admin/tickets")
  tickets(@Req() req: Request) {
    requireStaff(req);
    return this.platform.tickets();
  }

  @Post("v1/tickets")
  createTicket(
    @Req() req: Request,
    @Body() body: { subject: string; body: string; bookingId?: string }
  ) {
    return this.platform.createTicket(currentUser(req).id, body);
  }

  @Post("v1/reviews")
  review(
    @Req() req: Request,
    @Body() body: { bookingId: string; carModelId: string; rating: number; body?: string }
  ) {
    return this.platform.createReview(currentUser(req).id, body);
  }

  @Get("v1/admin/reviews")
  adminReviews(@Req() req: Request) {
    requireStaff(req);
    return this.platform.reviews();
  }

  @Get("v1/admin/leads")
  leads(@Req() req: Request) {
    requireRoles(req, "SALES", "SUPPORT", "SUPER_ADMIN");
    return this.platform.leads();
  }

  @Post("v1/admin/leads/:id/notes")
  leadNote(@Req() req: Request, @Param("id") id: string, @Body() body: { note: string }) {
    requireRoles(req, "SALES", "SUPPORT", "SUPER_ADMIN");
    return this.platform.addLeadNote(id, body.note);
  }

  @Patch("v1/admin/leads/:id")
  leadStatus(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { status: "NEW" | "CONTACTED" | "QUALIFIED" | "BOOKED" | "LOST" }
  ) {
    requireRoles(req, "SALES", "SUPER_ADMIN");
    return this.platform.setLeadStatus(id, body.status);
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
