import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { PartnerEngine } from "./partner.service";
import { assertInternal, requireRoles } from "./lib/auth";

@Controller()
export class PartnerController {
  constructor(private readonly partners: PartnerEngine) {}

  @Get("v1/admin/partners")
  list(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER", "FLEET_OPS", "BRANCH_MANAGER");
    return this.partners.list();
  }

  @Post("v1/admin/partners")
  create(
    @Req() req: Request,
    @Body() body: { name: string; email?: string; phone?: string; bankJson?: object; active?: boolean }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.create(body);
  }

  @Get("v1/admin/partners/:id/ledger")
  ledger(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.partners.ledger(id);
  }

  @Post("v1/admin/partners/:id/ledger/adjust")
  adjust(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { amountPaise: number; note?: string }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.adjust(id, body);
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

  @Post("v1/admin/partners/:id/contracts")
  addContract(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { startsOn: string; endsOn?: string | null; notes?: string | null }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "FLEET_OPS", "CITY_MANAGER");
    return this.partners.addContract(id, body);
  }

  @Patch("v1/admin/partners/:id/contracts/:contractId")
  updateContract(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("contractId") contractId: string,
    @Body() body: { startsOn?: string; endsOn?: string | null; notes?: string | null }
  ) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "FLEET_OPS", "CITY_MANAGER");
    return this.partners.updateContract(id, contractId, body);
  }

  @Delete("v1/admin/partners/:id/contracts/:contractId")
  removeContract(@Req() req: Request, @Param("id") id: string, @Param("contractId") contractId: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "FLEET_OPS", "CITY_MANAGER");
    return this.partners.removeContract(id, contractId);
  }

  @Post("v1/admin/partners/:id/vehicles")
  attachVehicle(@Req() req: Request, @Param("id") id: string, @Body() body: { vehicleId?: string }) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "FLEET_OPS", "CITY_MANAGER");
    return this.partners.attachVehicle(id, body.vehicleId ?? "");
  }

  @Delete("v1/admin/partners/:id/vehicles/:vehicleId")
  detachVehicle(@Req() req: Request, @Param("id") id: string, @Param("vehicleId") vehicleId: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "FLEET_OPS", "CITY_MANAGER");
    return this.partners.detachVehicle(id, vehicleId);
  }

  @Get("v1/admin/partners/:id")
  get(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER", "FLEET_OPS", "BRANCH_MANAGER");
    return this.partners.get(id);
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

  @Get("v1/admin/settlements")
  settlements(@Req() req: Request, @Query("partnerId") partnerId?: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.partners.settlements(partnerId);
  }

  @Post("v1/admin/settlements/generate")
  generate(
    @Req() req: Request,
    @Body() body: { partnerId?: string; periodStart: string; periodEnd: string; all?: boolean }
  ) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    if (body.all) return this.partners.generateAll(body.periodStart, body.periodEnd, user.id);
    if (!body.partnerId) throw new BadRequestException("partnerId required");
    return this.partners.generate(body.partnerId, body.periodStart, body.periodEnd, user.id);
  }

  @Get("v1/admin/settlements/:id")
  getSettlement(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.partners.getSettlement(id);
  }

  @Post("v1/admin/settlements/:id/mark-paid")
  paid(@Req() req: Request, @Param("id") id: string, @Body() body: { utr?: string }) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.partners.markPaid(id, body.utr, user.id);
  }

  @Post("v1/admin/settlements/:id/release-hold")
  release(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.partners.releaseHold(id, user.id);
  }

  @Post("internal/ledger/trip-complete")
  tripComplete(@Req() req: Request, @Body() body: { bookingId: string }) {
    assertInternal(req);
    return this.partners.tripComplete(body.bookingId);
  }

  @Post("internal/settlements/generate-weekly")
  weekly(@Req() req: Request) {
    assertInternal(req);
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.partners.generateAll(start.toISOString(), end.toISOString(), "worker");
  }
}
