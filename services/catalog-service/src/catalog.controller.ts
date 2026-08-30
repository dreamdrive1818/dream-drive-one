import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RentalType } from "@prisma/client";
import { CatalogService } from "./catalog.service";
import { assertInternal, requireRoles } from "./lib/auth";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("v1/public/search")
  search(
    @Query("cityId") cityId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("rentalType") rentalType?: RentalType,
    @Query("seats") seats?: string,
    @Query("fuel") fuel?: string,
    @Query("transmission") transmission?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string
  ) {
    return this.catalog.search({
      cityId, from, to, rentalType, seats, fuel, transmission, minPrice, maxPrice,
    });
  }

  @Get("v1/public/cars/:slug")
  bySlug(@Param("slug") slug: string) {
    return this.catalog.bySlug(slug);
  }

  @Get("v1/public/cars/:id/availability")
  availability(
    @Param("id") id: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.catalog.availability(id, from ?? "", to ?? "");
  }

  @Get("v1/admin/car-models")
  listModels(@Req() req: Request) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SALES", "SUPER_ADMIN");
    return this.catalog.listAdminModels();
  }

  @Post("v1/admin/car-models")
  createModel(@Req() req: Request, @Body() body: Record<string, unknown>) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.catalog.createModel(body);
  }

  @Patch("v1/admin/car-models/:id")
  updateModel(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    requireRoles(req, "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN");
    return this.catalog.updateModel(id, body);
  }

  @Delete("v1/admin/car-models/:id")
  deleteModel(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.catalog.deleteModel(id);
  }

  @Get("v1/admin/pricing-rules")
  listPricing(@Req() req: Request, @Query("carModelId") carModelId?: string) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.catalog.listPricing(carModelId);
  }

  @Post("v1/admin/pricing-rules")
  createPricing(@Req() req: Request, @Body() body: {
    carModelId: string;
    rentalType: RentalType;
    dailyPaise: number;
    hourlyPaise?: number;
    extraKmPaise?: number;
    depositPaise?: number;
  }) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.catalog.createPricing(body);
  }

  @Put("v1/admin/pricing-rules/:id")
  updatePricing(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    requireRoles(req, "FINANCE", "CITY_MANAGER", "SUPER_ADMIN");
    return this.catalog.updatePricing(id, body);
  }

  @Delete("v1/admin/pricing-rules/:id")
  deletePricing(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.catalog.deletePricing(id);
  }

  @Post("internal/availability/reserve")
  reserve(@Req() req: Request, @Body() body: {
    carModelId: string;
    vehicleId?: string;
    startsAt: string;
    endsAt: string;
    bookingId: string;
  }) {
    assertInternal(req);
    return this.catalog.reserve(body);
  }

  @Post("internal/availability/release")
  release(@Req() req: Request, @Body() body: { bookingId: string }) {
    assertInternal(req);
    return this.catalog.release(body.bookingId);
  }

  @Post("internal/availability/confirm")
  confirm(@Req() req: Request, @Body() body: { bookingId: string }) {
    assertInternal(req);
    return this.catalog.confirmHold(body.bookingId);
  }
}
