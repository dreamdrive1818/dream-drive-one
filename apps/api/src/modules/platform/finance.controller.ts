import { Body, Controller, Get, Param, Post, Put, Query, Req, StreamableFile } from "@nestjs/common";
import type { Request } from "express";
import { FinanceEngine } from "./finance.service";
import { assertInternal, clientIp, requireRoles } from "../../lib/auth";

@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceEngine) {}

  @Get("v1/admin/reports/:kind/export")
  async export(
    @Req() req: Request,
    @Param("kind") kind: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cityId") cityId?: string
  ) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    const { filename, csv } = await this.finance.exportCsv(user, kind, { from, to, cityId }, clientIp(req));
    return new StreamableFile(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("v1/admin/reports/:kind")
  report(
    @Req() req: Request,
    @Param("kind") kind: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cityId") cityId?: string
  ) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.finance.report(user, kind, { from, to, cityId });
  }

  @Get("v1/admin/finance/invoice-series")
  series(@Req() req: Request) {
    requireRoles(req, "FINANCE", "SUPER_ADMIN", "CITY_MANAGER");
    return this.finance.series();
  }

  @Put("v1/admin/finance/invoice-series")
  markSeries(
    @Req() req: Request,
    @Body() body: { prefix?: string; gstin?: string | null; nextNumber?: number; fyLabel?: string }
  ) {
    const user = requireRoles(req, "FINANCE", "SUPER_ADMIN");
    return this.finance.markSeries(user, body);
  }

  @Post("internal/reports/snapshot")
  snapshot(@Req() req: Request) {
    assertInternal(req);
    return this.finance.snapshotNightly();
  }
}
