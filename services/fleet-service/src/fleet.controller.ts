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

  @Get("v1/admin/vehicles/expiries")
  expiries(@Req() req: Request, @Query("days") days?: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.expiries(user, days ? Number(days) : 30);
  }

  @Get("v1/admin/vehicles")
  vehicles(
    @Req() req: Request,
    @Query("branchId") branchId?: string,
    @Query("cityId") cityId?: string,
    @Query("status") status?: string,
    @Query("partnerId") partnerId?: string,
    @Query("q") q?: string
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.vehicles(user, { branchId, cityId, status, partnerId, q });
  }

  @Post("v1/admin/vehicles")
  createVehicle(
    @Req() req: Request,
    @Body()
    body: {
      registration: string;
      carModelId: string;
      branchId: string;
      ownerType?: "COMPANY" | "PARTNER";
      partnerId?: string;
      year?: number;
      color?: string;
      odometerKm?: number;
    }
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.createVehicle(user, body);
  }

  @Get("v1/admin/vehicles/:id")
  getVehicle(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.getVehicle(user, id);
  }

  @Patch("v1/admin/vehicles/:id")
  updateVehicle(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.updateVehicle(user, id, body);
  }

  @Delete("v1/admin/vehicles/:id")
  deleteVehicle(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, "SUPER_ADMIN", "FLEET_OPS");
    return this.fleet.deleteVehicle(user, id);
  }

  @Post("v1/admin/vehicles/:id/transfer-branch")
  transferBranch(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { branchId: string; odometerKm?: number; notes?: string }
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.transferBranch(user, id, body);
  }

  @Post("v1/admin/vehicles/:id/documents")
  addDocument(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { kind: string; url: string; expiresAt?: string | null }
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.addDocument(user, id, body);
  }

  @Patch("v1/admin/vehicles/:id/documents/:docId")
  updateDocument(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("docId") docId: string,
    @Body() body: Record<string, unknown>
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.updateDocument(user, id, docId, body);
  }

  @Delete("v1/admin/vehicles/:id/documents/:docId")
  deleteDocument(@Req() req: Request, @Param("id") id: string, @Param("docId") docId: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.deleteDocument(user, id, docId);
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

  @Get("v1/public/airports")
  publicAirports(@Query("cityId") cityId?: string) {
    return this.fleet.listAirports(cityId);
  }

  @Get("v1/admin/airports")
  adminAirports(@Req() req: Request, @Query("cityId") cityId?: string) {
    requireRoles(req, ...FLEET, "SALES");
    return this.fleet.adminAirports(cityId);
  }

  @Post("v1/admin/airports")
  createAirport(
    @Req() req: Request,
    @Body()
    body: {
      cityId: string;
      name: string;
      code: string;
      freeWaitMinutes?: number;
      waitPaisePerMin?: number;
      nightSurchargePaise?: number;
      nightStartsHour?: number;
      nightEndsHour?: number;
      active?: boolean;
    }
  ) {
    requireRoles(req, "CITY_MANAGER", "SUPER_ADMIN", "FLEET_OPS");
    return this.fleet.createAirport(body);
  }

  @Patch("v1/admin/airports/:id")
  updateAirport(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    requireRoles(req, "CITY_MANAGER", "SUPER_ADMIN", "FLEET_OPS");
    return this.fleet.updateAirport(id, body);
  }

  @Post("v1/admin/airports/:id/delete")
  deleteAirport(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.deleteAirport(id);
  }

}
