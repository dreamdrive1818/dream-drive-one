import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { PartnerEngine } from "./partner.service";
import { assertInternal, requireRoles } from "./lib/auth";

@Controller()
export class PartnerController {
  constructor(private readonly partners: PartnerEngine) {}

  @Get("v1/admin/partners")
  list(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.partners.list();
  }

  @Post("v1/admin/partners")
  create(@Req() req: Request, @Body() body: { name: string; email?: string; phone?: string }) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.create(body);
  }

  @Patch("v1/admin/partners/:id")
  update(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.update(id, body);
  }

  @Delete("v1/admin/partners/:id")
  remove(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.partners.remove(id);
  }

  @Put("v1/admin/partners/:id/commission-rules")
  rules(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { rules: { rentalType?: string | null; percentBps: number; flatPaise?: number }[] }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.setRules(id, body.rules ?? []);
  }

  @Get("v1/admin/partners/:id/ledger")
  ledger(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.ledger(id);
  }

  @Get("v1/admin/settlements")
  settlements(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.settlements();
  }

  @Post("v1/admin/settlements/generate")
  generate(
    @Req() req: Request,
    @Body() body: { partnerId: string; periodStart: string; periodEnd: string }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.generate(body.partnerId, body.periodStart, body.periodEnd);
  }

  @Post("v1/admin/settlements/:id/mark-paid")
  paid(@Req() req: Request, @Param("id") id: string, @Body() body: { utr?: string }) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.markPaid(id, body.utr);
  }

  @Post("internal/ledger/trip-complete")
  tripComplete(@Req() req: Request, @Body() body: { bookingId: string }) {
    assertInternal(req);
    return this.partners.tripComplete(body.bookingId);
  }
}
