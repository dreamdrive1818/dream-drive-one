import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { AgreementStatus, KycStatus, RentalType } from "@prisma/client";
import { DocumentEngine } from "./document.service";
import {
  assertInternal,
  assertOwnerOrStaff,
  clientIp,
  currentUser,
  isStaff,
  requireRoles,
} from "../../lib/auth";
import { assertKycMime, KYC_MAX_BYTES } from "../../lib/kyc";

const kycFile = FileInterceptor("file", {
  limits: { fileSize: KYC_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    try {
      assertKycMime(file.mimetype, file.originalname);
      cb(null, true);
    } catch (err) {
      cb(err as Error, false);
    }
  },
});

@Controller()
export class DocumentController {
  constructor(private readonly docs: DocumentEngine) {}

  @Post("v1/kyc/uploads")
  @UseInterceptors(kycFile)
  async upload(
    @Req() req: Request,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined,
    @Body() body: { kind?: string; url?: string; publicId?: string }
  ) {
    currentUser(req);
    return this.docs.storeUpload({
      kind: body?.kind,
      url: body?.url,
      publicId: body?.publicId,
      buffer: file?.buffer,
      filename: file?.originalname,
      mimetype: file?.mimetype,
    });
  }

  @Post("v1/kyc/submit")
  submit(
    @Req() req: Request,
    @Body()
    body: {
      bookingId?: string;
      documents?: { kind: string; url: string; publicId?: string; mimeType?: string; bytes?: number }[];
      notes?: string;
      aadhaarNumber?: string;
      panNumber?: string;
      dlExpiresOn?: string;
    }
  ) {
    return this.docs.submitKyc(currentUser(req).id, body);
  }

  @Get("v1/me/kyc")
  mine(@Req() req: Request) {
    return this.docs.mine(currentUser(req).id);
  }

  @Get("v1/me/documents")
  documents(@Req() req: Request) {
    return this.docs.documentsForUser(currentUser(req).id);
  }

  @Get("v1/me/agreements")
  agreements(@Req() req: Request) {
    return this.docs.agreementsForUser(currentUser(req).id);
  }

  @Get("v1/admin/kyc")
  adminList(@Req() req: Request, @Query("status") status?: KycStatus) {
    return this.docs.adminList(requireRoles(req, ...this.docs.kycViewRoles()), status);
  }

  @Post("v1/admin/kyc/:id/review")
  review(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, ...this.docs.kycDecideRoles());
    return this.docs.markUnderReview(actor.id, id);
  }

  @Post("v1/admin/kyc/:id/request-reupload")
  reupload(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { documentId?: string; kind?: string; notes?: string }
  ) {
    const actor = requireRoles(req, ...this.docs.kycDecideRoles());
    return this.docs.requestReupload(actor.id, id, body ?? {});
  }

  @Post("v1/admin/kyc/:id/decision")
  decision(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { status: KycStatus; notes?: string }
  ) {
    const actor = requireRoles(req, ...this.docs.kycDecideRoles());
    return this.docs.decision(actor.id, id, body.status, body.notes);
  }

  @Post("v1/admin/kyc/:id/reset")
  resetKyc(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { notes?: string }
  ) {
    const actor = requireRoles(req, ...this.docs.kycDecideRoles());
    return this.docs.resetKyc(actor.id, id, body?.notes);
  }

  @Post("v1/webhooks/zoho-form")
  zoho(
    @Req() req: Request,
    @Headers("x-zoho-webhook-secret") secretHeader?: string,
    @Headers("x-zoho-signature") signature?: string,
    @Body() body?: Record<string, unknown>
  ) {
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(body ?? req.body ?? {});
    const payload = (typeof req.body === "string" ? JSON.parse(req.body) : body ?? {}) as Record<
      string,
      unknown
    >;
    return this.docs.zohoWebhook(payload, secretHeader || signature, raw);
  }

  @Post("internal/kyc/apply-reusable")
  applyReusable(@Req() req: Request, @Body() body: { bookingId?: string }) {
    assertInternal(req);
    return this.docs.applyReusable(body.bookingId ?? "");
  }

  @Post("v1/agreements/generate")
  generate(@Req() req: Request, @Body() body: { bookingId?: string }) {
    const actor = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.generateAgreement(body.bookingId ?? "", actor.id);
  }

  @Post("v1/agreements/:id/send-leegality")
  send(@Req() req: Request, @Param("id") id: string) {
    const actor = requireRoles(req, "SUPPORT", "SALES", "SUPER_ADMIN");
    return this.docs.sendLeegality(id, actor.id);
  }

  @Post("v1/admin/agreements/:id/mark-signed")
  markSigned(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body?: { signedPdfUrl?: string; notes?: string }
  ) {
    const actor = requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.docs.markSigned(id, actor.id, body);
  }

  @Post("v1/admin/agreements/:id/void")
  voidAgreement(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body?: { reason?: string; reissue?: boolean }
  ) {
    const actor = requireRoles(req, "SUPER_ADMIN");
    return this.docs.voidAgreement(id, actor.id, body);
  }

  @Get("v1/admin/agreements")
  adminAgreements(@Req() req: Request, @Query("status") status?: AgreementStatus) {
    return this.docs.listAdminAgreements(
      requireRoles(req, "SUPPORT", "SALES", "FINANCE", "CITY_MANAGER", "SUPER_ADMIN"),
      status
    );
  }

  @Get("v1/admin/agreement-templates")
  templates(@Req() req: Request) {
    requireRoles(req, "SUPPORT", "SALES", "FINANCE", "SUPER_ADMIN");
    return this.docs.listTemplates();
  }

  @Post("v1/admin/agreement-templates")
  createTemplate(
    @Req() req: Request,
    @Body()
    body: {
      name?: string;
      html?: string;
      cityId?: string | null;
      rentalType?: RentalType | null;
      active?: boolean;
    }
  ) {
    requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.docs.createTemplate(body);
  }

  @Patch("v1/admin/agreement-templates/:id")
  updateTemplate(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      html?: string;
      cityId?: string | null;
      rentalType?: RentalType | null;
      active?: boolean;
    }
  ) {
    requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.docs.updateTemplate(id, body);
  }

  @Delete("v1/admin/agreement-templates/:id")
  deleteTemplate(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPPORT", "SUPER_ADMIN");
    return this.docs.deleteTemplate(id);
  }

  @Post("v1/webhooks/leegality")
  leegality(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.docs.leegalityWebhook(body ?? {}, clientIp(req));
  }

  @Get("v1/me/agreements/:id/pdf")
  async minePdf(@Req() req: Request, @Param("id") id: string) {
    return this.streamAgreementPdf(req, id, false);
  }

  @Get("v1/me/agreements/:id/signed-pdf")
  async mineSignedPdf(@Req() req: Request, @Param("id") id: string) {
    return this.streamAgreementPdf(req, id, true);
  }

  @Get("v1/admin/agreements/:id/pdf")
  async adminPdf(@Req() req: Request, @Param("id") id: string) {
    requireRoles(req, "SUPPORT", "SALES", "FINANCE", "SUPER_ADMIN");
    const { filename, buffer } = await this.docs.agreementPdf(id, false);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get("v1/me/agreements/:id")
  async mineAgreement(@Req() req: Request, @Param("id") id: string) {
    const agreement = await this.docs.getAgreement(id);
    if (!agreement?.booking?.userId) throw new NotFoundException("Agreement not found");
    assertOwnerOrStaff(req, agreement.booking.userId);
    return agreement;
  }

  private async streamAgreementPdf(req: Request, id: string, signed: boolean) {
    const agreement = await this.docs.getAgreement(id);
    if (!agreement?.booking?.userId) throw new NotFoundException("Agreement not found");
    const user = currentUser(req);
    if (user.id !== agreement.booking.userId && !isStaff(user)) {
      throw new NotFoundException("Agreement not found");
    }
    const { filename, buffer } = await this.docs.agreementPdf(id, signed);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
