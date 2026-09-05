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
import { assertInternal, requireRoles, requireStaff } from "../../lib/auth";

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
    const user = requireStaff(req);
    return this.fleet.adminCities(user);
  }
  @Get("v1/admin/cities/:id")
  getCity(@Req() req: Request, @Param("id") id: string) {
    const user = requireStaff(req);
    return this.fleet.getCity(user, id);
  }
  @Post("v1/admin/cities")
  createCity(@Req() req: Request, @Body() body: { name: string; slug: string; state: string; active?: boolean }) {
    const user = requireRoles(req, "SUPER_ADMIN");
    return this.fleet.createCity(user, body);
  }
  @Patch("v1/admin/cities/:id")
  updateCity(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const user = requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.updateCity(user, id, body);
  }
  @Delete("v1/admin/cities/:id")
  deleteCity(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, "SUPER_ADMIN");
    return this.fleet.deleteCity(user, id);
  }

  @Get("v1/admin/branches")
  branches(@Req() req: Request, @Query("cityId") cityId?: string) {
    const user = requireStaff(req);
    return this.fleet.branches(user, cityId);
  }
  @Get("v1/admin/branches/:id")
  getBranch(@Req() req: Request, @Param("id") id: string) {
    const user = requireStaff(req);
    return this.fleet.getBranch(user, id);
  }
  @Post("v1/admin/branches")
  createBranch(
    @Req() req: Request,
    @Body() body: { cityId: string; name: string; address: string; active?: boolean }
  ) {
    const user = requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.createBranch(user, body);
  }
  @Patch("v1/admin/branches/:id")
  updateBranch(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    const user = requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.updateBranch(user, id, body);
  }
  @Delete("v1/admin/branches/:id")
  deleteBranch(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, "SUPER_ADMIN", "CITY_MANAGER");
    return this.fleet.deleteBranch(user, id);
  }

  @Get("v1/admin/vehicles/expiries")
  expiries(@Req() req: Request, @Query("days") days?: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.expiries(user, days ? Number(days) : 30);
  }

  @Post("v1/admin/vehicles/expiries/notify")
  notifyExpiries(@Req() req: Request, @Body() body: { days?: number }) {
    requireRoles(req, ...FLEET);
    return this.fleet.notifyExpiries(body?.days);
  }

  @Post("internal/vehicles/expiry-alerts")
  internalExpiryAlerts(@Req() req: Request) {
    assertInternal(req);
    return this.fleet.notifyExpiries(30);
  }

  @Post("v1/admin/vehicles/backfill-documents")
  backfillDocuments(@Req() req: Request) {
    const user = requireRoles(req, "SUPER_ADMIN", "FLEET_OPS");
    return this.fleet.backfillDocuments(user);
  }

  @Get("v1/admin/vehicle-transfers")
  listTransfers(@Req() req: Request, @Query("status") status?: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.listTransfers(user, status);
  }

  @Post("v1/admin/vehicle-transfers/:id/complete")
  completeTransfer(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.completeTransfer(user, id);
  }

  @Post("v1/admin/vehicle-transfers/:id/cancel")
  cancelTransfer(@Req() req: Request, @Param("id") id: string) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.cancelTransfer(user, id);
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
    @Body() body: { branchId: string; odometerKm?: number; notes?: string; immediate?: boolean }
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


  @Get("v1/admin/drivers/availability")
  driverAvailability(
    @Req() req: Request,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cityId") cityId?: string,
    @Query("branchId") branchId?: string
  ) {
    const user = requireRoles(req, ...FLEET);
    return this.fleet.driverAvailability(user, { from, to, cityId, branchId });
  }

  @Get("v1/admin/drivers")
  drivers(
    @Req() req: Request,
    @Query("branchId") branchId?: string,
    @Query("cityId") cityId?: string,
    @Query("active") active?: string,
    @Query("q") q?: string
  ) {
    return this.fleet.drivers(requireRoles(req, ...FLEET), { branchId, cityId, active, q });
  }

  @Get("v1/admin/drivers/:id")
  getDriver(@Req() req: Request, @Param("id") id: string) {
    return this.fleet.getDriver(requireRoles(req, ...FLEET), id);
  }

  @Post("v1/admin/drivers")
  createDriver(
    @Req() req: Request,
    @Body() body: { fullName: string; phone: string; branchId: string; active?: boolean }
  ) {
    return this.fleet.createDriver(requireRoles(req, ...FLEET), body);
  }

  @Patch("v1/admin/drivers/:id")
  updateDriver(@Req() req: Request, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.fleet.updateDriver(requireRoles(req, ...FLEET), id, body);
  }

  @Delete("v1/admin/drivers/:id")
  deleteDriver(@Req() req: Request, @Param("id") id: string) {
    return this.fleet.deleteDriver(requireRoles(req, ...FLEET), id);
  }

  @Post("v1/admin/drivers/:id/documents")
  addDriverDocument(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { kind: string; url: string; expiresAt?: string | null }
  ) {
    return this.fleet.addDriverDocument(requireRoles(req, ...FLEET), id, body);
  }

  @Patch("v1/admin/drivers/:id/documents/:docId")
  updateDriverDocument(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("docId") docId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.fleet.updateDriverDocument(requireRoles(req, ...FLEET), id, docId, body);
  }

  @Delete("v1/admin/drivers/:id/documents/:docId")
  deleteDriverDocument(@Req() req: Request, @Param("id") id: string, @Param("docId") docId: string) {
    return this.fleet.deleteDriverDocument(requireRoles(req, ...FLEET), id, docId);
  }

  @Post("v1/admin/drivers/:id/leave")
  addLeave(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { startsAt: string; endsAt: string }
  ) {
    return this.fleet.addLeave(requireRoles(req, ...FLEET), id, body);
  }

  @Patch("v1/admin/drivers/:id/leave/:leaveId")
  updateLeave(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("leaveId") leaveId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.fleet.updateLeave(requireRoles(req, ...FLEET), id, leaveId, body);
  }

  @Delete("v1/admin/drivers/:id/leave/:leaveId")
  deleteLeave(@Req() req: Request, @Param("id") id: string, @Param("leaveId") leaveId: string) {
    return this.fleet.deleteLeave(requireRoles(req, ...FLEET), id, leaveId);
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
