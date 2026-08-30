import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RoleName } from "@prisma/client";
import { IdentityService } from "./identity.service";
import {
  assertInternal,
  currentUser,
  requireRoles,
} from "./lib/auth";
import { internalFetch, serviceUrls } from "./lib/http";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("v1/auth/sync")
  async sync(@Req() req: Request, @Body() body: { fullName?: string }) {
    const firebaseUid = req.headers["x-firebase-uid"] as string;
    const email = (req.headers["x-email"] as string) || "";
    const phone = (req.headers["x-phone"] as string) || undefined;
    if (!firebaseUid || !email) {
      return { error: "Gateway must attach identity headers" };
    }
    return this.identity.upsertFromIdentity({
      firebaseUid,
      email,
      phone,
      fullName: body?.fullName,
    });
  }

  @Post("v1/auth/otp/send")
  async sendOtp(@Body() body: { email?: string }) {
    if (!body?.email) return { error: "email required" };
    const code = this.identity.issueOtp(body.email);
    try {
      await internalFetch(serviceUrls().notification, "/internal/notify", {
        method: "POST",
        body: JSON.stringify({
          template: "otp",
          to: body.email,
          data: { code },
        }),
      });
    } catch {
      // still return ok in dev so login is unblocked if mail is not configured
    }
    const expose = process.env.NODE_ENV !== "production";
    return { ok: true, ...(expose ? { devCode: code } : {}) };
  }

  @Post("v1/auth/otp/verify")
  verifyOtp(@Body() body: { email?: string; code?: string }) {
    if (!body?.email || !body?.code) return { error: "email and code required" };
    return this.identity.verifyOtp(body.email, body.code);
  }

  @Get("v1/me")
  me(@Req() req: Request) {
    return this.identity.me(currentUser(req).id);
  }

  @Patch("v1/me")
  patchMe(
    @Req() req: Request,
    @Body() body: { fullName?: string; phone?: string; address?: Record<string, string> }
  ) {
    return this.identity.patchMe(currentUser(req).id, body);
  }

  @Post("v1/me/devices")
  devices(
    @Req() req: Request,
    @Body() body: { token?: string; platform?: string }
  ) {
    if (!body?.token) return { error: "token required" };
    return this.identity.registerDevice(
      currentUser(req).id,
      body.token,
      body.platform ?? "web"
    );
  }

  @Get("v1/admin/users")
  adminUsers(@Req() req: Request, @Query("q") q?: string) {
    requireRoles(req, "SUPPORT", "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.identity.listUsers(q);
  }

  @Patch("v1/admin/users/:id/roles")
  setRoles(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { roles?: RoleName[] }
  ) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    return this.identity.setRoles(actor.id, id, body.roles ?? []);
  }

  @Post("v1/admin/users/:id/disable")
  disable(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    return this.identity.disable(actor.id, id);
  }

  @Get("v1/admin/audit")
  audit(@Req() req: Request, @Query("take") take?: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.identity.audit(take ? Number(take) : 100);
  }

  @Get("internal/users/by-firebase/:uid")
  byFirebase(@Req() req: Request, @Param("uid") uid: string) {
    assertInternal(req);
    return this.identity.byFirebaseUid(uid);
  }

  @Get("internal/users/by-email/:email")
  byEmail(@Req() req: Request, @Param("email") email: string) {
    assertInternal(req);
    return this.identity.byEmail(email);
  }

  @Post("internal/users/ensure")
  async ensure(
    @Req() req: Request,
    @Body()
    body: {
      firebaseUid?: string;
      email?: string;
      phone?: string;
      fullName?: string;
    }
  ) {
    assertInternal(req);
    if (!body?.email) return { error: "email required" };
    return this.identity.upsertFromIdentity({
      firebaseUid: body.firebaseUid ?? `dev:${body.email.toLowerCase()}`,
      email: body.email,
      phone: body.phone,
      fullName: body.fullName,
    });
  }
}
