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

@Controller()
export class PlatformController {
  constructor(private readonly platform: PlatformEngine) {}

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
