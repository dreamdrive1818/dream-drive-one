import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AgreementStatus, KycStatus, RentalType } from "@prisma/client";
import { buildAgreementPdf } from "./agreement-pdf";
import {
  createLeegalityRequest,
  fetchLeegalitySignedFile,
  leegalityLiveReady,
  verifyLeegalityWebhook,
} from "./leegality";
import { prisma } from "../../lib/prisma";
import { internalFetch, serviceUrls } from "../../lib/http";
import type { AuthUser } from "../../lib/auth";
import { bookingScopeWhere } from "../../lib/vehicle-rules";
import {
  assertDlCoversDropOff,
  identityStamp,
  isReusable,
  kycValidUntil,
  KYC_KINDS,
  KYC_MAX_BYTES,
  normalizeAadhaar,
  normalizeKind,
  normalizePan,
  parseDlExpiry,
  parseZohoDate,
  pickZohoString,
  stripSensitiveZoho,
} from "../../lib/kyc";
import {
  cloudinaryCanSign,
  isOurCloudinaryUrl,
  issueCloudinarySlot,
  sanitizeFolder,
  uploadToCloudinary,
} from "../../lib/cloudinary";
import { fetchZohoAttachments, verifyZohoWebhook, zohoOAuthReady } from "../../lib/zoho";

const KYC_VIEW = ["SUPPORT", "SALES", "CITY_MANAGER", "SUPER_ADMIN"] as const;
const KYC_DECIDE = ["SUPPORT", "SUPER_ADMIN"] as const;

type DocInput = {
  kind: string;
  url: string;
  publicId?: string;
  mimeType?: string;
  bytes?: number;
  expiresOn?: string | Date | null;
};

@Injectable()
export class DocumentEngine {
  kycViewRoles() {
    return [...KYC_VIEW];
  }
  kycDecideRoles() {
    return [...KYC_DECIDE];
  }

  issueUploadSlot(kindRaw?: string) {
    const kind = normalizeKind(kindRaw);
    const folder = sanitizeFolder("dreamdrive/kyc");
    const signed = issueCloudinarySlot(folder);
    if (signed) {
      return { ok: true, kind, ...signed, maxBytes: KYC_MAX_BYTES };
    }
    return {
      ok: true,
      kind,
      mode: "server" as const,
      folder,
      postUrl: "/v1/kyc/uploads",
      signed: false,
      maxBytes: KYC_MAX_BYTES,
      note: cloudinaryCanSign()
        ? undefined
        : "CLOUDINARY_API_KEY/SECRET missing — upload the file to this API instead of Cloudinary directly.",
    };
  }

  async storeUpload(input: {
    kind?: string;
    url?: string;
    publicId?: string;
    buffer?: Buffer;
    filename?: string;
    mimetype?: string;
  }) {
    const kind = normalizeKind(input.kind);
    const folder = sanitizeFolder("dreamdrive/kyc");
    const production = process.env.NODE_ENV === "production";

    if (input.buffer?.length) {
      if (input.buffer.length > KYC_MAX_BYTES) {
        throw new BadRequestException("File must be 8 MB or smaller");
      }
      const uploaded = await uploadToCloudinary({
        folder,
        buffer: input.buffer,
        filename: input.filename,
        mimetype: input.mimetype,
      });
      return { ok: true, kind, ...uploaded, mimeType: input.mimetype, bytes: input.buffer.length };
    }

    const url = String(input.url ?? "").trim();
    if (!url) return this.issueUploadSlot(kind);

    if (production && !isOurCloudinaryUrl(url) && !url.startsWith("https://res.cloudinary.com/mock/")) {
      throw new BadRequestException("Only server-issued Cloudinary URLs are accepted");
    }
    if (isOurCloudinaryUrl(url) || url.startsWith("https://res.cloudinary.com/mock/")) {
      return { ok: true, kind, url, publicId: input.publicId };
    }
    const uploaded = await uploadToCloudinary({ folder, url });
    return { ok: true, kind, ...uploaded };
  }

  async submitKyc(
    userId: string,
    body: {
      bookingId?: string;
      documents?: DocInput[];
      notes?: string;
      aadhaarNumber?: string;
      panNumber?: string;
      dlExpiresOn?: string | Date | null;
    }
  ) {
    const booking = await this.resolveBooking(userId, body.bookingId);
    const dropOff = booking?.endsAt ?? null;
    const dlExpiresOn = parseDlExpiry(body.dlExpiresOn);
    assertDlCoversDropOff(dlExpiresOn, dropOff);

    const aadhaar = body.aadhaarNumber != null ? normalizeAadhaar(body.aadhaarNumber) : null;
    const pan = body.panNumber != null ? normalizePan(body.panNumber) : null;
    const aadhaarStamp = aadhaar ? identityStamp("AADHAAR", aadhaar) : null;
    const panStamp = pan ? identityStamp("PAN", pan) : null;

    const reusable = await this.findReusable(userId, dropOff);
    const incoming = (body.documents ?? []).map((doc) => this.normalizeDoc(doc, dlExpiresOn));

    if (reusable && incoming.length === 0) {
      return this.cloneReusable(reusable, userId, booking?.id, {
        aadhaarStamp,
        panStamp,
        dlExpiresOn: dlExpiresOn ?? reusable.dlExpiresOn,
      });
    }

    const latest = await prisma.kycCase.findFirst({
      where: { userId },
      include: { documents: true },
      orderBy: { createdAt: "desc" },
    });

    if (latest && ["SUBMITTED", "UNDER_REVIEW"].includes(latest.status) && incoming.length === 0) {
      throw new BadRequestException("KYC is already under review");
    }

    if (incoming.length === 0 && !reusable) {
      throw new BadRequestException("Upload at least one KYC document");
    }

    this.assertRequiredDocs(incoming, latest, booking?.rentalType === "SELF_DRIVE");

    const identity = {
      aadhaarLast4: aadhaarStamp?.last4 ?? latest?.aadhaarLast4 ?? null,
      aadhaarHash: aadhaarStamp?.hash ?? latest?.aadhaarHash ?? null,
      panLast4: panStamp?.last4 ?? latest?.panLast4 ?? null,
      panHash: panStamp?.hash ?? latest?.panHash ?? null,
      dlExpiresOn: dlExpiresOn ?? latest?.dlExpiresOn ?? null,
    };

    const reopen =
      latest &&
      ["REJECTED", "NOT_STARTED", "SUBMITTED", "UNDER_REVIEW"].includes(latest.status) &&
      (!latest.bookingId || !booking?.id || latest.bookingId === booking.id);

    const kyc = reopen
      ? await this.replaceCaseDocs(latest.id, incoming, {
          ...identity,
          bookingId: booking?.id ?? latest.bookingId,
          notes: body.notes ?? null,
        })
      : await prisma.kycCase.create({
          data: {
            userId,
            bookingId: booking?.id,
            status: "SUBMITTED",
            notes: body.notes,
            ...identity,
            documents: { create: incoming },
          },
          include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
        });

    await prisma.customerProfile.updateMany({
      where: { userId },
      data: { kycStatus: "SUBMITTED" },
    });
    return this.presentCase(kyc);
  }

  async mine(userId: string) {
    const profile = await prisma.customerProfile.findUnique({ where: { userId } });
    const cases = await prisma.kycCase.findMany({
      where: { userId },
      include: {
        documents: true,
        zoho: true,
        booking: { select: { publicId: true, status: true, endsAt: true, rentalType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const latestApproved = cases.find((row) =>
      isReusable({ status: row.status, validUntil: row.validUntil, dlExpiresOn: row.dlExpiresOn })
    );
    return {
      kycStatus: profile?.kycStatus ?? "NOT_STARTED",
      kycValidUntil: profile?.kycValidUntil ?? latestApproved?.validUntil ?? null,
      reusable: Boolean(latestApproved),
      cases: cases.map((row) => this.presentCase(row)),
    };
  }

  async documentsForUser(userId: string) {
    const profile = await prisma.customerProfile.findUnique({ where: { userId } });
    const [kyc, agreements] = await Promise.all([this.mine(userId), this.agreementsForUser(userId)]);
    return {
      kycStatus: profile?.kycStatus ?? "NOT_STARTED",
      kycValidUntil: kyc.kycValidUntil,
      reusable: kyc.reusable,
      kyc: kyc.cases,
      agreements,
    };
  }

  async agreementsForUser(userId: string) {
    const rows = await prisma.agreement.findMany({
      where: { booking: { userId } },
      include: {
        envelope: true,
        booking: { select: { id: true, publicId: true, status: true, rentalType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.presentAgreement(row));
  }

  async resetKyc(actorId: string, id: string, notes?: string) {
    const kyc = await prisma.kycCase.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException("KYC case not found");
    const updated = await prisma.kycCase.update({
      where: { id },
      data: {
        status: "NOT_STARTED",
        notes: notes?.trim() || "Reset by support — please resubmit documents",
        reviewedAt: new Date(),
        reviewedById: actorId,
        validUntil: null,
      },
      include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: kyc.userId },
      data: { kycStatus: "NOT_STARTED", kycApprovedAt: null, kycValidUntil: null },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "kyc.reset",
        entity: "KycCase",
        entityId: id,
        payload: { userId: kyc.userId, notes: updated.notes },
      },
    });
    return this.presentCase(updated);
  }

  async adminList(user: AuthUser, status?: KycStatus) {
    const booking = bookingScopeWhere(user);
    const rows = await prisma.kycCase.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(Object.keys(booking).length ? { OR: [{ bookingId: null }, { booking }] } : {}),
      },
      include: {
        documents: true,
        zoho: true,
        user: { select: { email: true, phone: true, profile: true } },
        booking: {
          select: {
            publicId: true,
            status: true,
            endsAt: true,
            rentalType: true,
            carModelId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const now = Date.now();
    const soon = now + 30 * 86_400_000;
    return rows.map((row) => {
      const dl = row.dlExpiresOn?.getTime();
      return {
        ...this.presentCase(row),
        user: row.user,
        zoho: row.zoho ? { id: row.zoho.id, email: row.zoho.email, receivedAt: row.zoho.receivedAt } : null,
        dlExpired: Boolean(dl && dl < now),
        dlExpiring: Boolean(dl && dl >= now && dl < soon),
        dlMissesDropOff: Boolean(
          dl && row.booking?.endsAt && dl < row.booking.endsAt.getTime()
        ),
      };
    });
  }

  async markUnderReview(actorId: string, id: string) {
    const kyc = await prisma.kycCase.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException("KYC case not found");
    if (!["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(kyc.status)) {
      throw new BadRequestException("Only submitted KYC can move to review");
    }
    const updated = await prisma.kycCase.update({
      where: { id },
      data: { status: "UNDER_REVIEW", reviewedAt: new Date(), reviewedById: actorId },
      include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: kyc.userId },
      data: { kycStatus: "UNDER_REVIEW" },
    });
    return this.presentCase(updated);
  }

  async requestReupload(
    actorId: string,
    id: string,
    body: { documentId?: string; kind?: string; notes?: string }
  ) {
    const kyc = await prisma.kycCase.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!kyc) throw new NotFoundException("KYC case not found");
    const kind = body.kind ? normalizeKind(body.kind) : undefined;
    const docs = kyc.documents.filter(
      (doc) => doc.id === body.documentId || (kind && doc.kind === kind)
    );
    if (!docs.length) throw new BadRequestException("Document to re-upload was not found");
    const note = body.notes?.trim() || "Please re-upload this document";
    await prisma.$transaction(
      docs.map((doc) =>
        prisma.kycDocument.update({
          where: { id: doc.id },
          data: { status: "NEEDS_REUPLOAD", notes: note },
        })
      )
    );
    const updated = await prisma.kycCase.update({
      where: { id },
      data: {
        status: "REJECTED",
        notes: note,
        reviewedAt: new Date(),
        reviewedById: actorId,
        validUntil: null,
      },
      include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: kyc.userId },
      data: { kycStatus: "REJECTED", kycValidUntil: null },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "kyc.request_reupload",
        entity: "KycCase",
        entityId: id,
        payload: { documentIds: docs.map((d) => d.id), notes: note },
      },
    });
    await this.notifyKyc(kyc.userId, "REJECTED", note);
    return this.presentCase(updated);
  }

  async decision(actorId: string, id: string, status: KycStatus, notes?: string) {
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new BadRequestException("Decision must be APPROVED or REJECTED");
    }
    if (status === "REJECTED" && !String(notes ?? "").trim()) {
      throw new BadRequestException("Rejection reason is required");
    }
    const current = await prisma.kycCase.findUnique({
      where: { id },
      include: { booking: true, documents: true },
    });
    if (!current) throw new NotFoundException("KYC case not found");
    if (status === "APPROVED") {
      assertDlCoversDropOff(current.dlExpiresOn, current.booking?.endsAt ?? null);
    }
    const now = new Date();
    const validUntil = status === "APPROVED" ? kycValidUntil(now, current.dlExpiresOn) : null;
    const kyc = await prisma.kycCase.update({
      where: { id },
      data: {
        status,
        notes: notes?.trim() || current.notes,
        reviewedAt: now,
        reviewedById: actorId,
        validUntil,
      },
      include: { booking: true, documents: true },
    });
    await prisma.kycDocument.updateMany({
      where: { kycCaseId: id },
      data: { status: status === "APPROVED" ? "VERIFIED" : "UPLOADED" },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: kyc.userId },
      data: {
        kycStatus: status,
        kycApprovedAt: status === "APPROVED" ? now : null,
        kycValidUntil: validUntil,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: status === "APPROVED" ? "kyc.approved" : "kyc.rejected",
        entity: "KycCase",
        entityId: id,
        payload: { userId: kyc.userId, bookingId: kyc.bookingId, notes: kyc.notes },
      },
    });
    if (status === "APPROVED" && kyc.bookingId) {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${kyc.bookingId}/kyc-approved`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
    await this.notifyKyc(kyc.userId, status, kyc.notes);
    return this.presentCase(kyc);
  }

  async applyReusable(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const existing = await prisma.kycCase.findUnique({ where: { bookingId: booking.id } });
    if (existing?.status === "APPROVED" && isReusable({
      status: existing.status,
      validUntil: existing.validUntil,
      dlExpiresOn: existing.dlExpiresOn,
      dropOff: booking.endsAt,
    })) {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${booking.id}/kyc-approved`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
      return { reused: true, kycId: existing.id };
    }
    const reusable = await this.findReusable(booking.userId, booking.endsAt);
    if (!reusable) return { reused: false };
    const cloned = await this.cloneReusable(reusable, booking.userId, booking.id, {
      dlExpiresOn: reusable.dlExpiresOn,
    });
    return { reused: true, kycId: cloned.id };
  }

  async zohoWebhook(payload: Record<string, unknown>, secretHeader?: string, rawBody = "") {
    verifyZohoWebhook(secretHeader, rawBody || JSON.stringify(payload));
    const email = pickZohoString(payload, ["email", "Email", "added_email_id"]).toLowerCase();
    if (!email) throw new BadRequestException("email required");

    const aadhaarRaw = pickZohoString(payload, ["aadhar_number", "aadhaar_number", "Aadhaar"]);
    const panRaw = pickZohoString(payload, ["pan_number", "PAN", "pan"]);
    const dlRaw = pickZohoString(payload, ["dl_expiry", "dl_expires_on", "licence_expiry"]);
    let aadhaarStamp = null;
    let panStamp = null;
    try {
      const aadhaar = aadhaarRaw ? normalizeAadhaar(aadhaarRaw) : null;
      aadhaarStamp = aadhaar ? identityStamp("AADHAAR", aadhaar) : null;
    } catch {
      aadhaarStamp = null;
    }
    try {
      const pan = panRaw ? normalizePan(panRaw) : null;
      panStamp = pan ? identityStamp("PAN", pan) : null;
    } catch {
      panStamp = null;
    }
    const dlExpiresOn = (() => {
      try {
        return parseDlExpiry(dlRaw || null);
      } catch {
        return null;
      }
    })();

    const name =
      pickZohoString(payload, ["name", "Name"]) ||
      `${pickZohoString(payload, ["fname", "first_name"])} ${pickZohoString(payload, ["lname", "last_name"])}`.trim() ||
      email;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: `zoho:${email}`,
          email,
          phone: pickZohoString(payload, ["phone", "wphone"]) || null,
          profile: { create: { fullName: name } },
        },
      });
    }

    const start = parseZohoDate(pickZohoString(payload, ["start_date", "Start_Date"]));
    const end = parseZohoDate(pickZohoString(payload, ["end_date", "End_Date"]));
    const car = pickZohoString(payload, ["selected_car", "car", "vehicle"]);
    const booking = await this.matchZohoBooking(user.id, start, end, car);

    const recent = await prisma.zohoSubmission.findFirst({
      where: { email, receivedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      include: { kycCase: true },
      orderBy: { receivedAt: "desc" },
    });
    if (recent?.kycCase && recent.kycCase.userId === user.id) {
      return { ok: true, kycId: recent.kycCaseId, bookingId: recent.kycCase.bookingId, duplicate: true };
    }

    const files = zohoOAuthReady()
      ? await fetchZohoAttachments(payload).catch(() => [])
      : [];

    const kyc = await prisma.kycCase.create({
      data: {
        userId: user.id,
        bookingId: booking?.id,
        status: "SUBMITTED",
        aadhaarLast4: aadhaarStamp?.last4,
        aadhaarHash: aadhaarStamp?.hash,
        panLast4: panStamp?.last4,
        panHash: panStamp?.hash,
        dlExpiresOn,
        documents: {
          create: files.map((file) => ({
            kind: file.kind,
            url: file.url,
            publicId: file.publicId,
            status: "UPLOADED",
          })),
        },
        zoho: { create: { email, raw: stripSensitiveZoho(payload) as object } },
      },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: user.id },
      data: { kycStatus: "SUBMITTED" },
    });
    return {
      ok: true,
      kycId: kyc.id,
      bookingId: booking?.id ?? null,
      attachments: files.length,
      oauth: zohoOAuthReady(),
    };
  }

  async generateAgreement(bookingId: string, actorId?: string) {
    const ctx = await this.agreementContext(bookingId);
    if (ctx.booking.rentalType === "SELF_DRIVE") {
      const kycOk = await this.bookingKycApproved(ctx.booking.id, ctx.booking.userId, ctx.booking.endsAt);
      if (!kycOk) {
        throw new BadRequestException("KYC must be APPROVED before generating a self-drive agreement");
      }
    }
    const open = await prisma.agreement.findFirst({
      where: { bookingId: ctx.booking.id, status: { in: ["DRAFT", "SENT", "SIGNED", "WAIVED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (open?.status === "SENT" || open?.status === "SIGNED" || open?.status === "WAIVED") {
      throw new BadRequestException("Void the current agreement before generating a new one");
    }
    const html = this.renderAgreement(ctx.template.html, ctx.fields);
    const data = {
      templateId: ctx.template.id,
      status: "DRAFT" as const,
      htmlSnapshot: html,
      pdfUrl: "",
      signedPdfUrl: null as string | null,
    };
    const agreement = open
      ? await prisma.agreement.update({ where: { id: open.id }, data })
      : await prisma.agreement.create({ data: { bookingId: ctx.booking.id, ...data } });
    const pdfUrl = `/v1/me/agreements/${agreement.id}/pdf`;
    const saved = await prisma.agreement.update({
      where: { id: agreement.id },
      data: { pdfUrl },
      include: { envelope: true, booking: { select: { id: true, publicId: true, status: true, rentalType: true } } },
    });
    if (actorId) {
      await prisma.auditLog.create({
        data: {
          actorId,
          action: "agreement.generate",
          entity: "Agreement",
          entityId: saved.id,
          payload: { bookingId: ctx.booking.id, publicId: ctx.booking.publicId },
        },
      });
    }
    return { ...this.presentAgreement(saved), html };
  }

  async sendLeegality(id: string, actorId?: string) {
    const agreement = await this.requireAgreement(id);
    if (agreement.status === "VOID") throw new BadRequestException("Voided agreements cannot be sent");
    if (agreement.status === "SIGNED" || agreement.status === "WAIVED") {
      throw new BadRequestException("Agreement is already signed");
    }
    const ctx = await this.agreementContext(agreement.bookingId);
    const email = ctx.booking.user.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("Customer email is required for the Leegality invite");
    const pdf = this.pdfFor(ctx, agreement.htmlSnapshot);
    const live = leegalityLiveReady();
    let leegalityId = `lg_mock_${agreement.id}`;
    let signUrl: string | null = null;
    let mock = !live;
    if (live) {
      const sent = await createLeegalityRequest({
        pdf,
        filename: `DreamDrive-${ctx.booking.publicId}.pdf`,
        invitee: {
          name: ctx.fields.customer,
          email,
          phone: ctx.booking.user.phone,
        },
        irn: ctx.booking.publicId,
      });
      if (sent.mock) {
        mock = true;
      } else {
        leegalityId = sent.documentId;
        signUrl = sent.signUrl;
        mock = false;
      }
    }
    await prisma.agreement.update({ where: { id }, data: { status: "SENT", pdfUrl: `/v1/me/agreements/${id}/pdf` } });
    const envelope = await prisma.signatureEnvelope.upsert({
      where: { agreementId: id },
      create: { agreementId: id, leegalityId, status: "SENT", inviteEmail: email, signUrl },
      update: { leegalityId, status: "SENT", inviteEmail: email, signUrl },
    });
    if (actorId) {
      await prisma.auditLog.create({
        data: {
          actorId,
          action: "agreement.send_leegality",
          entity: "Agreement",
          entityId: id,
          payload: { mock, leegalityId, inviteEmail: email },
        },
      });
    }
    return { agreementId: id, envelope, mock, inviteEmail: email, liveReady: live };
  }

  async leegalityWebhook(body: Record<string, unknown>, ip?: string) {
    const verified = verifyLeegalityWebhook(body, ip);
    const leegalityId = String(
      verified.documentId || body.leegalityId || body.documentId || ""
    ).trim();
    if (!leegalityId) throw new BadRequestException("leegalityId required");
    const envelope = await prisma.signatureEnvelope.findUnique({
      where: { leegalityId },
      include: { agreement: true },
    });
    if (!envelope) return { ok: true, ignored: true };
    const documentStatus = String(body.documentStatus ?? body.status ?? "").toUpperCase();
    const webhookType = String(body.webhookType ?? "").toLowerCase();
    const action = String(
      (body.request as { action?: string } | undefined)?.action ?? ""
    ).toUpperCase();
    const signed =
      documentStatus === "COMPLETED" ||
      documentStatus.includes("COMPLETE") ||
      action === "SIGNED" ||
      String(body.status ?? "").toUpperCase() === "SIGNED" ||
      (webhookType === "success" && documentStatus.includes("COMPLETE"));
    let signedPdfUrl = String(body.signedPdfUrl ?? envelope.agreement.signedPdfUrl ?? "").trim() || null;
    if (signed && leegalityLiveReady() && !leegalityId.startsWith("lg_mock_") && !leegalityId.startsWith("lg_manual_")) {
      const file = await fetchLeegalitySignedFile(leegalityId).catch(() => null);
      if (file?.buffer?.length) {
        const uploaded = await uploadToCloudinary({
          folder: "dreamdrive/agreements",
          buffer: file.buffer,
          filename: file.filename || `${envelope.agreementId}-signed.pdf`,
          mimetype: "application/pdf",
        }).catch(() => null);
        signedPdfUrl = uploaded?.url || file.url || `/v1/me/agreements/${envelope.agreementId}/signed-pdf`;
        await prisma.signedArtifact.create({
          data: {
            agreementId: envelope.agreementId,
            kind: "SIGNED",
            url: signedPdfUrl,
            publicId: uploaded?.publicId,
            bytes: file.buffer.length,
          },
        });
      } else if (file?.url) {
        signedPdfUrl = file.url;
      }
    }
    if (signed && !signedPdfUrl) {
      signedPdfUrl = `/v1/me/agreements/${envelope.agreementId}/signed-pdf`;
    }
    return this.applySigned(leegalityId, {
      signedPdfUrl,
      envelopeStatus: signed ? "SIGNED" : documentStatus || "SENT",
      agreementStatus: signed ? "SIGNED" : "SENT",
    });
  }

  async markSigned(id: string, actorId: string, body?: { signedPdfUrl?: string; notes?: string }) {
    const agreement = await this.requireAgreement(id);
    if (agreement.status === "VOID") throw new BadRequestException("Cannot sign a voided agreement");
    const wetInk = body?.signedPdfUrl?.trim();
    const envelope =
      agreement.envelope ??
      (await prisma.signatureEnvelope.create({
        data: {
          agreementId: id,
          leegalityId: `lg_manual_${id}`,
          status: "SIGNED",
          inviteEmail: agreement.booking.user.email,
        },
      }));
    if (wetInk) {
      await prisma.signedArtifact.create({
        data: { agreementId: id, kind: "WET_INK", url: wetInk },
      });
    }
    await prisma.agreement.update({
      where: { id },
      data: {
        status: "WAIVED",
        waivedById: actorId,
        signedPdfUrl: wetInk || `/v1/me/agreements/${id}/signed-pdf`,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "agreement.mark_signed",
        entity: "Agreement",
        entityId: id,
        payload: { notes: body?.notes ?? null, wetInk: Boolean(wetInk) },
      },
    });
    return this.applySigned(envelope.leegalityId ?? `lg_manual_${id}`, {
      signedPdfUrl: wetInk || `/v1/me/agreements/${id}/signed-pdf`,
      envelopeStatus: "SIGNED",
      agreementStatus: "WAIVED",
    });
  }

  async voidAgreement(id: string, actorId: string, body?: { reason?: string; reissue?: boolean }) {
    const agreement = await this.requireAgreement(id);
    if (agreement.status === "VOID") throw new BadRequestException("Agreement is already void");
    const reason = body?.reason?.trim() || "Voided by admin";
    await prisma.agreement.update({
      where: { id },
      data: { status: "VOID", voidedAt: new Date(), voidReason: reason },
    });
    if (agreement.envelope) {
      await prisma.signatureEnvelope.update({
        where: { id: agreement.envelope.id },
        data: { status: "VOID" },
      });
    }
    let reissued: Awaited<ReturnType<DocumentEngine["generateAgreement"]>> | null = null;
    if (body?.reissue) {
      reissued = await this.generateAgreement(agreement.bookingId, actorId);
      await prisma.agreement.update({
        where: { id },
        data: { supersededById: reissued.id },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "agreement.void",
        entity: "Agreement",
        entityId: id,
        payload: { reason, reissuedId: reissued?.id ?? null },
      },
    });
    return {
      ok: true,
      voidedId: id,
      reissued,
      note: "Live Leegality invites are not recalled automatically — cancel the envelope in the Leegality dashboard if it was already sent.",
    };
  }

  async getAgreement(id: string) {
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        envelope: true,
        artifacts: true,
        booking: { select: { id: true, publicId: true, status: true, rentalType: true, userId: true } },
      },
    });
    return agreement ? this.presentAgreement(agreement, true) : null;
  }

  async agreementPdf(id: string, signed: boolean) {
    const agreement = await this.requireAgreement(id);
    if (signed) {
      const artifact = agreement.artifacts.find((row) => row.kind === "SIGNED" || row.kind === "WET_INK");
      if (artifact?.url?.startsWith("http")) {
        const res = await fetch(artifact.url);
        if (res.ok) {
          return {
            filename: `${agreement.booking.publicId}-signed.pdf`,
            buffer: Buffer.from(await res.arrayBuffer()),
          };
        }
      }
      if (agreement.status !== "SIGNED" && agreement.status !== "WAIVED") {
        throw new BadRequestException("Agreement is not signed yet");
      }
    }
    const ctx = await this.agreementContext(agreement.bookingId);
    const stamp =
      agreement.status === "WAIVED"
        ? "WET-INK / ADMIN WAIVER"
        : agreement.status === "SIGNED"
          ? "SIGNED"
          : null;
    return {
      filename: `${agreement.booking.publicId}${signed ? "-signed" : ""}.pdf`,
      buffer: this.pdfFor(ctx, agreement.htmlSnapshot, signed ? stamp || "SIGNED" : null),
    };
  }

  async listAdminAgreements(user: AuthUser, status?: AgreementStatus) {
    const booking = bookingScopeWhere(user);
    const rows = await prisma.agreement.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(Object.keys(booking).length ? { booking } : {}),
      },
      include: {
        envelope: true,
        booking: {
          select: {
            id: true,
            publicId: true,
            status: true,
            rentalType: true,
            user: { select: { email: true, profile: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => this.presentAgreement(row));
  }

  listTemplates() {
    return prisma.agreementTemplate.findMany({
      include: { city: { select: { id: true, name: true, state: true } } },
      orderBy: { name: "asc" },
    });
  }

  async createTemplate(body: {
    name?: string;
    html?: string;
    cityId?: string | null;
    rentalType?: RentalType | null;
    active?: boolean;
  }) {
    const name = body.name?.trim();
    const html = body.html?.trim();
    if (!name || !html) throw new BadRequestException("name and html are required");
    return prisma.agreementTemplate.create({
      data: {
        name,
        html,
        cityId: body.cityId || null,
        rentalType: body.rentalType || null,
        active: body.active ?? true,
      },
    });
  }

  async updateTemplate(
    id: string,
    body: {
      name?: string;
      html?: string;
      cityId?: string | null;
      rentalType?: RentalType | null;
      active?: boolean;
    }
  ) {
    const current = await prisma.agreementTemplate.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Template not found");
    return prisma.agreementTemplate.update({
      where: { id },
      data: {
        name: body.name?.trim() || current.name,
        html: body.html?.trim() || current.html,
        cityId: body.cityId === undefined ? current.cityId : body.cityId || null,
        rentalType: body.rentalType === undefined ? current.rentalType : body.rentalType,
        active: body.active ?? current.active,
      },
    });
  }

  async deleteTemplate(id: string) {
    const current = await prisma.agreementTemplate.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Template not found");
    return prisma.agreementTemplate.update({
      where: { id },
      data: { active: false },
    });
  }

  private async resolveBooking(userId: string, bookingId?: string) {
    if (bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
      });
      if (!booking || booking.userId !== userId) {
        throw new BadRequestException("Booking not found");
      }
      return booking;
    }
    return prisma.booking.findFirst({
      where: {
        userId,
        rentalType: "SELF_DRIVE",
        status: { in: ["AWAITING_KYC", "AWAITING_PAYMENT", "AWAITING_SIGNATURE", "HOLD"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  private async findReusable(userId: string, dropOff?: Date | null) {
    const rows = await prisma.kycCase.findMany({
      where: { userId, status: "APPROVED" },
      include: { documents: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return (
      rows.find((row) =>
        isReusable({
          status: row.status,
          validUntil: row.validUntil,
          dlExpiresOn: row.dlExpiresOn,
          dropOff: dropOff ?? null,
        })
      ) ?? null
    );
  }

  private async cloneReusable(
    source: {
      id: string;
      aadhaarLast4: string | null;
      aadhaarHash: string | null;
      panLast4: string | null;
      panHash: string | null;
      dlExpiresOn: Date | null;
      validUntil: Date | null;
      documents: { kind: string; url: string; publicId: string | null; mimeType: string | null; bytes: number | null; expiresOn: Date | null }[];
    },
    userId: string,
    bookingId: string | undefined,
    extra: {
      aadhaarStamp?: { last4: string; hash: string } | null;
      panStamp?: { last4: string; hash: string } | null;
      dlExpiresOn?: Date | null;
    }
  ) {
    const now = new Date();
    const dlExpiresOn = extra.dlExpiresOn ?? source.dlExpiresOn;
    const validUntil = source.validUntil && source.validUntil > now
      ? source.validUntil
      : kycValidUntil(now, dlExpiresOn);
    const existing = bookingId
      ? await prisma.kycCase.findUnique({ where: { bookingId } })
      : null;
    const data = {
      status: "APPROVED" as const,
      notes: "Reused approved KYC (12-month validity)",
      reviewedAt: now,
      validUntil,
      aadhaarLast4: extra.aadhaarStamp?.last4 ?? source.aadhaarLast4,
      aadhaarHash: extra.aadhaarStamp?.hash ?? source.aadhaarHash,
      panLast4: extra.panStamp?.last4 ?? source.panLast4,
      panHash: extra.panStamp?.hash ?? source.panHash,
      dlExpiresOn,
    };
    const kyc = existing
      ? await prisma.kycCase.update({
          where: { id: existing.id },
          data,
          include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
        })
      : await prisma.kycCase.create({
          data: {
            userId,
            bookingId,
            ...data,
            documents: {
              create: source.documents.map((doc) => ({
                kind: doc.kind,
                url: doc.url,
                publicId: doc.publicId,
                mimeType: doc.mimeType,
                bytes: doc.bytes,
                expiresOn: doc.expiresOn,
                status: "VERIFIED",
              })),
            },
          },
          include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
        });
    await prisma.customerProfile.updateMany({
      where: { userId },
      data: { kycStatus: "APPROVED", kycApprovedAt: now, kycValidUntil: validUntil },
    });
    if (bookingId) {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${bookingId}/kyc-approved`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
    return this.presentCase(kyc);
  }

  private async replaceCaseDocs(
    id: string,
    incoming: ReturnType<DocumentEngine["normalizeDoc"]>[],
    extra: {
      bookingId?: string | null;
      notes?: string | null;
      aadhaarLast4: string | null;
      aadhaarHash: string | null;
      panLast4: string | null;
      panHash: string | null;
      dlExpiresOn: Date | null;
    }
  ) {
    const current = await prisma.kycCase.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!current) throw new NotFoundException("KYC case not found");
    const byKind = new Map(current.documents.map((doc) => [doc.kind, doc]));
    for (const doc of incoming) {
      const existing = byKind.get(doc.kind);
      if (existing) {
        await prisma.kycDocument.update({
          where: { id: existing.id },
          data: { ...doc, status: "UPLOADED", notes: null },
        });
      } else {
        await prisma.kycDocument.create({ data: { kycCaseId: id, ...doc } });
      }
    }
    return prisma.kycCase.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        notes: extra.notes,
        bookingId: extra.bookingId ?? current.bookingId,
        aadhaarLast4: extra.aadhaarLast4,
        aadhaarHash: extra.aadhaarHash,
        panLast4: extra.panLast4,
        panHash: extra.panHash,
        dlExpiresOn: extra.dlExpiresOn,
        reviewedAt: null,
        validUntil: null,
      },
      include: { documents: true, booking: { select: { publicId: true, status: true, endsAt: true } } },
    });
  }

  private normalizeDoc(doc: DocInput, fallbackExpiry: Date | null) {
    const kind = normalizeKind(doc.kind);
    const url = String(doc.url ?? "").trim();
    if (!url) throw new BadRequestException(`${kind} is missing a file URL`);
    const production = process.env.NODE_ENV === "production";
    if (production && !isOurCloudinaryUrl(url) && !url.startsWith("https://res.cloudinary.com/mock/")) {
      throw new BadRequestException("Only server-issued Cloudinary URLs are accepted");
    }
    const expiresOn =
      kind === "DL" ? parseDlExpiry(doc.expiresOn ?? fallbackExpiry) : parseDlExpiry(doc.expiresOn ?? null);
    return {
      kind,
      url,
      publicId: doc.publicId,
      mimeType: doc.mimeType,
      bytes: doc.bytes,
      expiresOn,
      status: "UPLOADED",
    };
  }

  private assertRequiredDocs(
    incoming: { kind: string }[],
    latest: { documents: { kind: string; status: string }[] } | null,
    selfDrive: boolean
  ) {
    if (!selfDrive) return;
    const kinds = new Set([
      ...(latest?.documents.filter((d) => d.status !== "NEEDS_REUPLOAD").map((d) => d.kind) ?? []),
      ...incoming.map((d) => d.kind),
    ]);
    const needs = latest?.documents.filter((d) => d.status === "NEEDS_REUPLOAD").map((d) => d.kind) ?? [];
    if (needs.length) {
      const missing = needs.filter((kind) => !incoming.some((d) => d.kind === kind));
      if (missing.length) {
        throw new BadRequestException(`Re-upload required: ${missing.join(", ")}`);
      }
      return;
    }
    if (!kinds.has("DL")) throw new BadRequestException("Driving licence is required for self-drive");
    if (!kinds.has("AADHAAR") && !kinds.has("ADDRESS")) {
      throw new BadRequestException("Aadhaar or address proof is required");
    }
    if (!kinds.has("SELFIE")) throw new BadRequestException("Selfie with ID is required");
  }

  private async matchZohoBooking(
    userId: string,
    start: Date | null,
    end: Date | null,
    car: string
  ) {
    const awaiting = await prisma.booking.findMany({
      where: {
        userId,
        status: { in: ["AWAITING_KYC", "AWAITING_PAYMENT", "AWAITING_SIGNATURE"] },
      },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const models = await prisma.carModel.findMany({
      where: { id: { in: awaiting.map((b) => b.carModelId) } },
    });
    const byId = new Map(models.map((m) => [m.id, m]));
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const carLc = car.toLowerCase();
    const matched = awaiting.find((booking) => {
      const model = byId.get(booking.carModelId);
      const dateOk =
        (!start || day(booking.startsAt) === day(start)) &&
        (!end || day(booking.endsAt) === day(end));
      const carOk =
        !carLc ||
        model?.name.toLowerCase().includes(carLc) ||
        model?.slug.toLowerCase().includes(carLc);
      return dateOk && carOk;
    });
    return matched ?? awaiting[0] ?? null;
  }

  private presentCase(kyc: {
    id: string;
    userId?: string;
    bookingId?: string | null;
    status: string;
    notes: string | null;
    reviewedAt?: Date | null;
    validUntil?: Date | null;
    aadhaarLast4?: string | null;
    panLast4?: string | null;
    dlExpiresOn?: Date | null;
    createdAt?: Date;
    documents?: {
      id: string;
      kind: string;
      url: string;
      status: string;
      notes: string | null;
      expiresOn: Date | null;
      mimeType?: string | null;
    }[];
    booking?: { publicId: string; status: string; endsAt?: Date } | null;
    zoho?: unknown;
  }) {
    return {
      id: kyc.id,
      bookingId: kyc.bookingId,
      status: kyc.status,
      notes: kyc.notes,
      reviewedAt: kyc.reviewedAt ?? null,
      validUntil: kyc.validUntil ?? null,
      aadhaarLast4: kyc.aadhaarLast4 ?? null,
      panLast4: kyc.panLast4 ?? null,
      dlExpiresOn: kyc.dlExpiresOn ?? null,
      createdAt: kyc.createdAt,
      booking: kyc.booking ?? null,
      documents: (kyc.documents ?? []).map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        url: doc.url,
        status: doc.status,
        notes: doc.notes,
        expiresOn: doc.expiresOn,
        mimeType: doc.mimeType ?? null,
      })),
    };
  }

  private async notifyKyc(userId: string, status: string, notes?: string | null) {
    await internalFetch(serviceUrls().notification, "/internal/notify", {
      method: "POST",
      body: JSON.stringify({
        template: "kyc_decision",
        toUserId: userId,
        data: { status, notes: notes ?? "" },
      }),
    }).catch(() => undefined);
  }

  private defaultTemplate() {
    return `<h1>Dream-Drive Rental Agreement</h1>
<p>Booking {{publicId}}</p>
<p>Customer {{customer}} ({{email}} / {{phone}})</p>
<p>Vehicle {{vehicle}} {{registration}}</p>
<p>Period {{startsAt}} to {{endsAt}}</p>
<p>Hire INR {{amount}} &nbsp; Deposit INR {{deposit}}</p>
<p>City {{city}}, {{state}}. Jurisdiction: {{jurisdiction}}.</p>
<p>The hirer agrees to the terms of hire, KYC, vehicle care, and damage policy. Self-drive handover requires a completed signature.</p>`;
  }

  private renderAgreement(html: string, fields: Record<string, string>) {
    let out = html;
    for (const [key, value] of Object.entries(fields)) {
      out = out.replaceAll(`{{${key}}}`, value);
    }
    return out;
  }

  private presentAgreement(
    row: {
      id: string;
      bookingId: string;
      status: string;
      pdfUrl: string | null;
      signedPdfUrl: string | null;
      htmlSnapshot?: string | null;
      voidReason?: string | null;
      supersededById?: string | null;
      createdAt?: Date;
      envelope?: {
        id: string;
        status: string;
        leegalityId: string | null;
        inviteEmail?: string | null;
        signUrl?: string | null;
      } | null;
      artifacts?: { id: string; kind: string; url: string }[];
      booking?: {
        id?: string;
        publicId?: string;
        status?: string;
        rentalType?: string;
        userId?: string;
        user?: { email?: string | null; profile?: { fullName?: string | null } | null };
      } | null;
    },
    includeHtml = false
  ) {
    return {
      id: row.id,
      bookingId: row.bookingId,
      status: row.status,
      pdfUrl: row.pdfUrl || `/v1/me/agreements/${row.id}/pdf`,
      signedPdfUrl:
        row.status === "SIGNED" || row.status === "WAIVED"
          ? row.signedPdfUrl || `/v1/me/agreements/${row.id}/signed-pdf`
          : null,
      voidReason: row.voidReason ?? null,
      supersededById: row.supersededById ?? null,
      createdAt: row.createdAt,
      envelope: row.envelope ?? null,
      artifacts: row.artifacts ?? [],
      booking: row.booking ?? null,
      html: includeHtml ? row.htmlSnapshot ?? null : undefined,
    };
  }

  private async requireAgreement(id: string) {
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        envelope: true,
        artifacts: true,
        booking: { include: { user: { include: { profile: true } } } },
      },
    });
    if (!agreement) throw new NotFoundException("Agreement not found");
    return agreement;
  }

  private async bookingKycApproved(bookingId: string, userId: string, dropOff: Date) {
    const linked = await prisma.kycCase.findFirst({
      where: { bookingId, status: "APPROVED" },
    });
    if (linked) return true;
    const reusable = await this.findReusable(userId, dropOff);
    return Boolean(reusable);
  }

  private async applySigned(
    leegalityId: string,
    opts: {
      signedPdfUrl?: string | null;
      envelopeStatus: string;
      agreementStatus: "SIGNED" | "WAIVED" | "SENT";
    }
  ) {
    const envelope = await prisma.signatureEnvelope.findUnique({
      where: { leegalityId },
      include: { agreement: true },
    });
    if (!envelope) return { ok: true, ignored: true };
    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: { status: opts.envelopeStatus, lastWebhookAt: new Date() },
    });
    await prisma.agreement.update({
      where: { id: envelope.agreementId },
      data: {
        status: opts.agreementStatus,
        signedPdfUrl: opts.signedPdfUrl ?? `/v1/me/agreements/${envelope.agreementId}/signed-pdf`,
      },
    });
    if (opts.agreementStatus === "SIGNED" || opts.agreementStatus === "WAIVED") {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${envelope.agreement.bookingId}/agreement-signed`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
    return { ok: true, agreementId: envelope.agreementId };
  }

  private pdfFor(
    ctx: Awaited<ReturnType<DocumentEngine["agreementContext"]>>,
    htmlSnapshot?: string | null,
    signedStamp?: string | null
  ) {
    return buildAgreementPdf({
      ...ctx.pdf,
      clauses: htmlSnapshot || ctx.template.html,
      signedStamp,
    });
  }

  private async agreementContext(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
      include: {
        user: { include: { profile: true } },
        vehicle: { include: { carModel: true } },
        pickupBranch: { include: { city: true } },
      },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const carModel = booking.vehicle?.carModel
      ?? (await prisma.carModel.findUnique({ where: { id: booking.carModelId } }));
    const city = booking.pickupBranch.city;
    const template = await this.matchTemplate(city.id, booking.rentalType);
    const customer = booking.user.profile?.fullName || booking.user.email;
    const inDate = (d: Date) => d.toLocaleString("en-IN");
    const fields = {
      publicId: booking.publicId,
      customer,
      email: booking.user.email,
      phone: booking.user.phone || "-",
      rentalType: booking.rentalType,
      vehicle: carModel?.name || "Vehicle",
      registration: booking.vehicle?.registration || "unassigned",
      startsAt: inDate(booking.startsAt),
      endsAt: inDate(booking.endsAt),
      amount: (booking.amountPaise / 100).toFixed(2),
      deposit: (booking.depositPaise / 100).toFixed(2),
      city: city.name,
      state: city.state,
      jurisdiction: `Courts at ${city.name}, ${city.state}`,
    };
    return {
      booking,
      template,
      fields,
      pdf: {
        publicId: fields.publicId,
        customer: fields.customer,
        email: fields.email,
        phone: fields.phone,
        rentalType: fields.rentalType,
        vehicle: fields.vehicle,
        registration: fields.registration,
        startsAt: fields.startsAt,
        endsAt: fields.endsAt,
        amountPaise: booking.amountPaise,
        depositPaise: booking.depositPaise,
        city: fields.city,
        state: fields.state,
        jurisdiction: fields.jurisdiction,
      },
    };
  }

  private async matchTemplate(cityId: string, rentalType: RentalType) {
    const rows = await prisma.agreementTemplate.findMany({ where: { active: true } });
    const score = (row: (typeof rows)[number]) => {
      const cityOk = row.cityId === cityId ? 2 : row.cityId == null ? 1 : -10;
      const typeOk = row.rentalType === rentalType ? 2 : row.rentalType == null ? 1 : -10;
      return cityOk + typeOk;
    };
    const ranked = rows
      .map((row) => ({ row, score: score(row) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked[0]) return ranked[0].row;
    return { id: null as string | null, html: this.defaultTemplate() };
  }
}

export { KYC_KINDS };
