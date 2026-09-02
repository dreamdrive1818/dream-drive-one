import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { KycStatus } from "@prisma/client";
import { DocumentEngine } from "./document.service";
import { assertOwnerOrStaff, currentUser, requireRoles } from "../../lib/auth";
import { sanitizeFolder, uploadToCloudinary } from "../../lib/cloudinary";

@Controller()
export class DocumentController {
  constructor(private readonly docs: DocumentEngine) {}

  @Post("v1/kyc/uploads")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() body: { kind?: string; url?: string }
  ) {
    currentUser(req);
    const kind = body?.kind ?? "id";
    if (body?.url && !file?.buffer) return { ok: true, kind, url: body.url };
    const uploaded = await uploadToCloudinary({
      folder: sanitizeFolder("dreamdrive/kyc"),
      url: body?.url,
      buffer: file?.buffer,
      filename: file?.originalname,
      mimetype: file?.mimetype,
    });
    return { ok: true, kind, ...uploaded };
  }

  @Post("v1/kyc/submit")
  submit(
    @Req() req: Request,
    @Body()
    body: {
      bookingId?: string;
      documents?: { kind: string; url: string }[];
      notes?: string;
    }
  ) {
    return this.docs.submitKyc(currentUser(req).id, body);
  }

  @Get("v1/me/kyc")
  mine(@Req() req: Request) {
    return this.docs.mine(currentUser(req).id);
  }

  @Get("v1/admin/kyc")
  adminList(@Req() req: Request, @Query("status") status?: KycStatus) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.adminList(status);
  }

  @Post("v1/admin/kyc/:id/decision")
  decision(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { status: KycStatus; notes?: string }
  ) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.decision(id, body.status, body.notes);
  }

  @Post("v1/webhooks/zoho-form")
  zoho(@Body() body: Record<string, unknown>) {
    return this.docs.zohoWebhook(body);
  }

  @Post("v1/agreements/generate")
  generate(@Req() req: Request, @Body() body: { bookingId?: string }) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.generateAgreement(body.bookingId ?? "");
  }

  @Post("v1/agreements/:id/send-leegality")
  send(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.sendLeegality(id);
  }

  @Post("v1/admin/agreements/:id/mark-signed")
  markSigned(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.markSigned(id);
  }

  @Post("v1/webhooks/leegality")
  leegality(@Body() body: { leegalityId?: string; status?: string; signedPdfUrl?: string }) {
    return this.docs.leegalityWebhook(body);
  }

  @Get("v1/me/agreements/:id")
  async mineAgreement(@Req() req: Request, @Param("id") id: string) {
    const agreement = await this.docs.getAgreement(id);
    if (!agreement) return { error: "not found" };
    assertOwnerOrStaff(req, agreement.booking.userId);
    return agreement;
  }
}
