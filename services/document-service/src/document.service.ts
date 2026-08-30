import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { KycStatus } from "@prisma/client";
import { prisma } from "./lib/prisma";
import { internalFetch, serviceUrls } from "./lib/http";

@Injectable()
export class DocumentEngine {
  async submitKyc(userId: string, body: {
    bookingId?: string;
    documents?: { kind: string; url: string }[];
    notes?: string;
  }) {
    const kyc = await prisma.kycCase.create({
      data: {
        userId,
        bookingId: body.bookingId,
        status: "SUBMITTED",
        notes: body.notes,
        documents: {
          create: (body.documents ?? []).map((d) => ({ kind: d.kind, url: d.url })),
        },
      },
      include: { documents: true },
    });
    await prisma.customerProfile.updateMany({
      where: { userId },
      data: { kycStatus: "SUBMITTED" },
    });
    return kyc;
  }

  mine(userId: string) {
    return prisma.kycCase.findMany({
      where: { userId },
      include: { documents: true, zoho: true },
      orderBy: { id: "desc" },
    });
  }

  adminList(status?: KycStatus) {
    return prisma.kycCase.findMany({
      where: status ? { status } : undefined,
      include: { documents: true, user: { select: { email: true, profile: true } }, booking: true },
      orderBy: { id: "desc" },
      take: 200,
    });
  }

  async decision(id: string, status: KycStatus, notes?: string) {
    if (status !== "APPROVED" && status !== "REJECTED") {
      throw new BadRequestException("Decision must be APPROVED or REJECTED");
    }
    const kyc = await prisma.kycCase.update({
      where: { id },
      data: { status, notes },
      include: { booking: true },
    });
    await prisma.customerProfile.updateMany({
      where: { userId: kyc.userId },
      data: { kycStatus: status },
    });
    if (status === "APPROVED" && kyc.bookingId) {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${kyc.bookingId}/kyc-approved`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
    return kyc;
  }

  async zohoWebhook(payload: Record<string, unknown>) {
    const email = String(payload.email ?? payload.Email ?? "").toLowerCase();
    if (!email) throw new BadRequestException("email required");
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: `zoho:${email}`,
          email,
          profile: { create: { fullName: String(payload.name ?? payload.Name ?? email) } },
        },
      });
    }
    const booking = await prisma.booking.findFirst({
      where: {
        userId: user.id,
        status: { in: ["AWAITING_KYC", "AWAITING_PAYMENT", "AWAITING_SIGNATURE"] },
      },
      orderBy: { createdAt: "desc" },
    });
    const kyc = await prisma.kycCase.create({
      data: {
        userId: user.id,
        bookingId: booking?.id,
        status: "SUBMITTED",
        zoho: { create: { email, raw: payload as object } },
      },
    });
    return { ok: true, kycId: kyc.id, bookingId: booking?.id ?? null };
  }

  async generateAgreement(bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id: bookingId }, { publicId: bookingId }] },
      include: { user: { include: { profile: true } } },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    const template = await prisma.agreementTemplate.findFirst({
      where: {
        OR: [{ rentalType: booking.rentalType }, { rentalType: null }],
      },
      orderBy: { rentalType: "desc" },
    });
    const html = this.renderAgreement(template?.html ?? this.defaultTemplate(), booking);
    const agreement = await prisma.agreement.create({
      data: {
        bookingId: booking.id,
        templateId: template?.id,
        status: "DRAFT",
        pdfUrl: `html://agreement/${booking.publicId}`,
      },
    });
    return { ...agreement, html };
  }

  async sendLeegality(id: string) {
    const agreement = await prisma.agreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException("Agreement not found");
    const mock = !process.env.LEEGALITY_API_KEY;
    const leegalityId = mock ? `lg_mock_${agreement.id}` : `lg_${agreement.id}`;
    if (!mock) {
      await fetch(`${process.env.LEEGALITY_BASE_URL ?? "https://app.leegality.com/api"}/documents`, {
        method: "POST",
        headers: {
          "X-Auth-Token": process.env.LEEGALITY_API_KEY ?? "",
          "content-type": "application/json",
        },
        body: JSON.stringify({ agreementId: agreement.id }),
      }).catch(() => undefined);
    }
    await prisma.agreement.update({
      where: { id },
      data: { status: "SENT" },
    });
    const envelope = await prisma.signatureEnvelope.upsert({
      where: { agreementId: id },
      create: { agreementId: id, leegalityId, status: "SENT" },
      update: { leegalityId, status: "SENT" },
    });
    return { agreementId: id, envelope, mock };
  }

  async leegalityWebhook(body: { leegalityId?: string; status?: string; signedPdfUrl?: string }) {
    if (!body.leegalityId) throw new BadRequestException("leegalityId required");
    const envelope = await prisma.signatureEnvelope.findUnique({
      where: { leegalityId: body.leegalityId },
      include: { agreement: true },
    });
    if (!envelope) return { ok: true, ignored: true };
    const signed = (body.status ?? "").toUpperCase().includes("SIGN");
    await prisma.signatureEnvelope.update({
      where: { id: envelope.id },
      data: { status: body.status ?? "SIGNED" },
    });
    await prisma.agreement.update({
      where: { id: envelope.agreementId },
      data: {
        status: signed ? "SIGNED" : "SENT",
        signedPdfUrl: body.signedPdfUrl,
      },
    });
    if (signed) {
      await internalFetch(
        serviceUrls().booking,
        `/internal/bookings/${envelope.agreement.bookingId}/agreement-signed`,
        { method: "POST", body: "{}" }
      ).catch(() => undefined);
    }
    return { ok: true };
  }

  async markSigned(id: string) {
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: { envelope: true },
    });
    if (!agreement) throw new NotFoundException("Agreement not found");
    const envelope = agreement.envelope ?? await prisma.signatureEnvelope.create({
      data: { agreementId: id, leegalityId: `lg_manual_${id}`, status: "SIGNED" },
    });
    return this.leegalityWebhook({
      leegalityId: envelope.leegalityId ?? undefined,
      status: "SIGNED",
      signedPdfUrl: "manual://signed",
    });
  }

  getAgreement(id: string) {
    return prisma.agreement.findUnique({
      where: { id },
      include: { envelope: true, booking: true },
    });
  }

  private defaultTemplate() {
    return `<h1>Dream-Drive Rental Agreement</h1>
<p>Booking {{publicId}}</p>
<p>Customer {{customer}}</p>
<p>Period {{startsAt}} to {{endsAt}}</p>
<p>Amount INR {{amount}}</p>
<p>I agree to the terms of hire, KYC, and vehicle care policy.</p>`;
  }

  private renderAgreement(html: string, booking: {
    publicId: string;
    startsAt: Date;
    endsAt: Date;
    amountPaise: number;
    user: { email: string; profile: { fullName: string } | null };
  }) {
    return html
      .replaceAll("{{publicId}}", booking.publicId)
      .replaceAll("{{customer}}", booking.user.profile?.fullName ?? booking.user.email)
      .replaceAll("{{startsAt}}", booking.startsAt.toISOString())
      .replaceAll("{{endsAt}}", booking.endsAt.toISOString())
      .replaceAll("{{amount}}", (booking.amountPaise / 100).toFixed(2));
  }
}
