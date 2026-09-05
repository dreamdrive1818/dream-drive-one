import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { MaintenanceEngine, type JobInput, type MaintPartInput } from "./maintenance.service";
import { requireRoles, type AuthUser } from "./lib/auth";

const WRITE = ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER"] as const;
const READ = [...WRITE, "FINANCE"] as const;

@Controller()
export class MaintenanceController {
  constructor(private readonly maint: MaintenanceEngine) {}

  @Get("v1/admin/workshops")
  workshops(@Req() req: Request, @Query("cityId") cityId?: string) {
    requireRoles(req, ...READ);
    return this.maint.workshops(cityId);
  }

  @Post("v1/admin/workshops")
  createWorkshop(
    @Req() req: Request,
    @Body() body: { name: string; address: string; phone?: string; cityId?: string; active?: boolean }
  ) {
    requireRoles(req, ...WRITE);
    return this.maint.createWorkshop(body);
  }

  @Patch("v1/admin/workshops/:id")
  updateWorkshop(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, ...WRITE);
    return this.maint.updateWorkshop(id, body);
  }

  @Delete("v1/admin/workshops/:id")
  deleteWorkshop(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...WRITE);
    return this.maint.deleteWorkshop(id);
  }

  @Get("v1/admin/maintenance-jobs")
  jobs(
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("vehicleId") vehicleId?: string,
    @Query("workshopId") workshopId?: string
  ) {
    const user = requireRoles(req, ...READ);
    return this.maint.jobs({
      status,
      vehicleId,
      workshopId,
      branchId: this.ownBranch(user),
    });
  }

  @Get("v1/admin/maintenance-jobs/:id")
  getJob(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...READ);
    return this.maint.getJob(id);
  }

  @Post("v1/admin/maintenance-jobs")
  createJob(@Req() req: Request, @Body() body: JobInput) {
    requireRoles(req, ...WRITE);
    return this.maint.createJob(body);
  }

  @Patch("v1/admin/maintenance-jobs/:id")
  updateJob(@Req() req: Request, @Param("id") id: string, @Body() body: JobInput) {
    requireRoles(req, ...WRITE);
    return this.maint.updateJob(id, body);
  }

  @Post("v1/admin/maintenance-jobs/:id/complete")
  complete(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      odometerKm?: number;
      costPaise?: number;
      labourPaise?: number;
      notes?: string;
      parts?: MaintPartInput[];
    }
  ) {
    requireRoles(req, ...WRITE);
    return this.maint.completeJob(id, body);
  }

  @Post("v1/admin/maintenance-jobs/:id/cancel")
  cancel(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...WRITE);
    return this.maint.cancelJob(id);
  }

  @Delete("v1/admin/maintenance-jobs/:id")
  remove(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...WRITE);
    return this.maint.cancelJob(id);
  }

  private ownBranch(user: AuthUser): string | undefined {
    if (user.roles.includes("SUPER_ADMIN") || user.roles.includes("CITY_MANAGER") || user.roles.includes("FLEET_OPS") || user.roles.includes("FINANCE")) {
      return undefined;
    }
    return user.branchId;
  }
}
