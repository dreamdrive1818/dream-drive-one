import {
  BadRequestException,
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
  clientIp,
  currentUser,
  requireRoles,
} from "../../lib/auth";
import { internalFetch, serviceUrls } from "../../lib/http";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("v1/auth/sync")
  async sync(@Req() req: Request, @Body() body: { fullName?: string }) {
    const firebaseUid = req.headers["x-firebase-uid"] as string;
    const email = (req.headers["x-email"] as string) || "";
    const phone = (req.headers["x-phone"] as string) || undefined;
    if (!firebaseUid || !email) {
      throw new BadRequestException("Gateway must attach identity headers");
    }
    return this.identity.upsertFromIdentity({
      firebaseUid,
      email,
      phone,
      fullName: body?.fullName,
      ip: clientIp(req),
    });
  }

  @Post("v1/auth/login")
  login(
    @Req() req: Request,
    @Body() body: { email?: string; password?: string }
  ) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException("email and password required");
    }
    return this.identity.loginWithPassword(body.email, body.password, clientIp(req));
  }

  @Post("v1/auth/register")
  register(
    @Req() req: Request,
    @Body() body: { email?: string; password?: string; fullName?: string }
  ) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException("email and password required");
    }
    return this.identity.registerWithPassword(
      body.email,
      body.password,
      body.fullName,
      clientIp(req)
    );
  }

  @Post("v1/auth/google")
  google(@Req() req: Request, @Body() body: { idToken?: string }) {
    if (!body?.idToken) throw new BadRequestException("idToken required");
    return this.identity.loginWithGoogle(body.idToken, clientIp(req));
  }

  @Post("v1/auth/otp/send")
  async sendOtp(@Body() body: { email?: string }) {
    if (!body?.email) throw new BadRequestException("email required");
    const code = await this.identity.issueOtp(body.email);
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
  verifyOtp(
    @Req() req: Request,
    @Body() body: { email?: string; code?: string }
  ) {
    if (!body?.email || !body?.code) {
      throw new BadRequestException("email and code required");
    }
    return this.identity.verifyOtp(body.email, body.code, clientIp(req));
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
    if (!body?.token) throw new BadRequestException("token required");
    return this.identity.registerDevice(
      currentUser(req).id,
      body.token,
      body.platform ?? "web"
    );
  }

  @Get("v1/admin/users")
  adminUsers(
    @Req() req: Request,
    @Query("q") q?: string,
    @Query("take") take?: string
  ) {
    requireRoles(req, "SUPPORT", "SALES", "CITY_MANAGER", "SUPER_ADMIN");
    return this.identity.listUsers(q, take ? Number(take) : 100);
  }

  @Post("v1/admin/users/invite")
  invite(
    @Req() req: Request,
    @Body()
    body: {
      email?: string;
      fullName?: string;
      roles?: RoleName[];
      cityId?: string;
      branchId?: string;
    }
  ) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    if (!body?.email) throw new BadRequestException("email required");
    return this.identity.inviteStaff(
      actor.id,
      {
        email: body.email,
        fullName: body.fullName,
        roles: body.roles,
        cityId: body.cityId,
        branchId: body.branchId,
      },
      clientIp(req)
    );
  }

  @Patch("v1/admin/users/:id/roles")
  setRoles(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { roles?: RoleName[] }
  ) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    return this.identity.setRoles(actor.id, id, body.roles ?? [], clientIp(req));
  }

  @Post("v1/admin/users/:id/disable")
  disable(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    return this.identity.disable(actor.id, id, clientIp(req));
  }

  @Get("v1/admin/audit")
  audit(@Req() req: Request, @Query("take") take?: string) {
    requireRoles(req, "SUPER_ADMIN");
    return this.identity.auditLog(take ? Number(take) : 100);
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
    if (!body?.email) throw new BadRequestException("email required");
    return this.identity.upsertFromIdentity({
      firebaseUid: body.firebaseUid ?? `dev:${body.email.toLowerCase()}`,
      email: body.email,
      phone: body.phone,
      fullName: body.fullName,
    });
  }
}
