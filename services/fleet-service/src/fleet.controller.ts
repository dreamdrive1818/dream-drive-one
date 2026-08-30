import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { FleetEngine } from "./fleet.service";
import { requireRoles } from "./lib/auth";

const FLEET = ["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SUPER_ADMIN"] as const;

@Controller()
export class FleetController {
  constructor(private readonly fleet: FleetEngine) {}

  @Get("v1/public/cities")
  publicCities() {
    return this.fleet.cities();
  }

  @Get("v1/admin/cities")
  cities(@Req() req: Request) {
    requireRoles(req, ...FLEET, "SALES");
    return this.fleet.cities();
  }
  @Post("v1/admin/cities")
  createCity(@Req() req: Request, @Body() body: { name: string; slug: string; state: string; active?: boolean }) {
    requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.createCity(body);
  }
  @Patch("v1/admin/cities/:id")
  updateCity(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.updateCity(id, body);
  }
  @Delete("v1/admin/cities/:id")
  deleteCity(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.fleet.deleteCity(id);
  }

  @Get("v1/admin/branches")
  branches(@Req() req: Request, @Query("cityId") cityId?: string) {
    requireRoles(req, ...FLEET);
    return this.fleet.branches(cityId);
  }
  @Post("v1/admin/branches")
  createBranch(@Req() req: Request, @Body() body: { cityId: string; name: string; address: string }) {
    requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.createBranch(body);
  }
  @Patch("v1/admin/branches/:id")
  updateBranch(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.updateBranch(id, body);
  }
  @Delete("v1/admin/branches/:id")
  deleteBranch(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.fleet.deleteBranch(id);
  }

  @Get("v1/admin/vehicles")
  vehicles(@Req() req: Request) {
    requireRoles(req, ...FLEET);
    return this.fleet.vehicles();
  }
  @Post("v1/admin/vehicles")
  createVehicle(@Req() req: Request, @Body() body: {
    registration: string;
    carModelId: string;
    branchId: string;
    year?: number;
    color?: string;
  }) {
    requireRoles(req, ...FLEET);
    return this.fleet.createVehicle(body);
  }
  @Patch("v1/admin/vehicles/:id")
  updateVehicle(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, ...FLEET);
    return this.fleet.updateVehicle(id, body);
  }
  @Delete("v1/admin/vehicles/:id")
  deleteVehicle(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.fleet.deleteVehicle(id);
  }

  @Get("v1/admin/drivers")
  drivers(@Req() req: Request) {
    requireRoles(req, ...FLEET);
    return this.fleet.drivers();
  }
  @Post("v1/admin/drivers")
  createDriver(@Req() req: Request, @Body() body: { fullName: string; phone: string; branchId: string }) {
    requireRoles(req, ...FLEET);
    return this.fleet.createDriver(body);
  }
  @Patch("v1/admin/drivers/:id")
  updateDriver(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    requireRoles(req, ...FLEET);
    return this.fleet.updateDriver(id, body);
  }
  @Delete("v1/admin/drivers/:id")
  deleteDriver(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.fleet.deleteDriver(id);
  }

  @Get("v1/admin/maintenance-jobs")
  jobs(@Req() req: Request) {
    requireRoles(req, ...FLEET);
    return this.fleet.jobs();
  }
  @Post("v1/admin/maintenance-jobs")
  createJob(@Req() req: Request, @Body() body: {
    vehicleId: string;
    startsAt: string;
    endsAt: string;
    costPaise?: number;
    notes?: string;
  }) {
    requireRoles(req, ...FLEET);
    return this.fleet.createJob(body);
  }
  @Delete("v1/admin/maintenance-jobs/:id")
  deleteJob(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, ...FLEET);
    return this.fleet.deleteJob(id);
  }

  @Post("v1/admin/bookings/:id/handover")
  handover(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { odometerKm: number; fuelLevel: string; notes?: string; photos?: string[] }
  ) {
    requireRoles(req, ...FLEET);
    return this.fleet.handover(id, body);
  }

  @Post("v1/admin/bookings/:id/return")
  returnVehicle(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      odometerKm: number;
      fuelLevel: string;
      notes?: string;
      photos?: string[];
      damages?: { description: string; amountPaise: number }[];
    }
  ) {
    requireRoles(req, ...FLEET);
    return this.fleet.returnVehicle(id, body);
  }

  @Get("v1/admin/vehicles/expiries")
  expiries(@Req() req: Request) {
    requireRoles(req, ...FLEET);
    return this.fleet.expiries();
  }
}
