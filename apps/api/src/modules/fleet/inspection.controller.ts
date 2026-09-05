import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  InspectionEngine,
  type DamageInput,
  type HandoverInput,
  type ReturnInput,
} from "./inspection.service";
import { requireRoles } from "../../lib/auth";

const FLEET = ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"] as const;

@Controller()
export class InspectionController {
  constructor(private readonly inspections: InspectionEngine) {}

  @Get("v1/admin/inspections/defaults")
  defaults(@Req() req: Request) {
    requireRoles(req, ...FLEET);
    return this.inspections.defaults();
  }

  @Get("v1/admin/inspections")
  list(
    @Req() req: Request,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("bookingId") bookingId?: string,
    @Query("q") q?: string
  ) {
    const user = requireRoles(req, ...FLEET, "FINANCE");
    return this.inspections.list(user, { type, status, bookingId, q });
  }

  @Get("v1/admin/inspections/:id")
  get(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, ...FLEET, "FINANCE");
    return this.inspections.get(user, id);
  }

  @Post("v1/admin/bookings/:id/handover")
  handover(@Req() req: Request, @Param("id") id: string, @Body() body: HandoverInput) {
    const user = requireRoles(req, ...FLEET);
    return this.inspections.handover(id, body, user.id);
  }

  @Post("v1/admin/bookings/:id/return")
  returnVehicle(@Req() req: Request, @Param("id") id: string, @Body() body: ReturnInput) {
    const user = requireRoles(req, ...FLEET);
    return this.inspections.returnVehicle(id, body, user.id);
  }

  @Post("v1/admin/inspections/:id/damages")
  addDamages(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { damages?: DamageInput[]; description?: string; amountPaise?: number }
  ) {
    requireRoles(req, ...FLEET);
    const damages =
      body.damages ??
      (body.description ? [{ description: body.description, amountPaise: Number(body.amountPaise) || 0 }] : []);
    return this.inspections.addDamages(id, damages);
  }

  @Post("v1/admin/inspections/:id/damages/:damageId/waive")
  waive(@Req() req: Request, @Param("id") id: string, @Param("damageId") damageId: string) {
    requireRoles(req, ...FLEET);
    return this.inspections.waiveDamage(id, damageId);
  }

  @Post("v1/admin/inspections/:id/close")
  close(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...FLEET);
    return this.inspections.close(id);
  }
}
