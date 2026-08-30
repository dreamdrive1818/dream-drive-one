import { Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { NotifyEngine } from "./notify.service";
import { assertInternal, requireRoles } from "./lib/auth";

@Controller()
export class NotifyController {
  constructor(private readonly notify: NotifyEngine) {}

  @Post("internal/notify")
  send(
    @Req() req: Request,
    @Body()
    body: { template: string; to?: string; toUserId?: string; data?: Record<string, string> }
  ) {
    assertInternal(req);
    return this.notify.send(body);
  }

  @Post("internal/notify/retry")
  retry(@Req() req: Request) {
    assertInternal(req);
    return this.notify.retryFailed();
  }

  @Get("v1/admin/notifications")
  logs(@Req() req: Request) {
    requireRoles(req, "SUPER_ADMIN", "SUPPORT");
    return this.notify.logs();
  }

  @Get("v1/admin/notification-templates")
  templates(@Req() req: Request) {
    requireRoles(req, "SUPER_ADMIN");
    return this.notify.templates();
  }

  @Put("v1/admin/notification-templates/:key")
  upsert(
    @Req() req: Request,
    @Param("key") key: string,
    @Body() body: { channel?: string; subject?: string; body: string }
  ) {
    requireRoles(req, "SUPER_ADMIN");
    return this.notify.upsertTemplate(key, body);
  }
}
