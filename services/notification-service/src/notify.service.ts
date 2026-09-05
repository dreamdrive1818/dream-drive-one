import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "./lib/prisma";
import { NOTIFICATION_TEMPLATES } from "./templates";

const MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [5, 15, 45];
const LOGO =
  "https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png";

const FALLBACK = Object.fromEntries(
  NOTIFICATION_TEMPLATES.map((t) => [t.key, t])
) as Record<string, { subject: string; body: string; channel: string }>;

type SendInput = {
  template: string;
  to?: string;
  toUserId?: string;
  data?: Record<string, string>;
  ref?: string;
  channel?: string;
};

@Injectable()
export class NotifyEngine {
  async send(input: SendInput) {
    let to = input.to?.trim();
    if (!to && input.toUserId) {
      const user = await prisma.user.findUnique({ where: { id: input.toUserId } });
      to = user?.email ?? undefined;
    }
    if (!to) return { ok: false, error: "no recipient" };

    const tpl = await prisma.notificationTemplate.findUnique({
      where: { key: input.template },
    });
    const fallback = FALLBACK[input.template];
    const channel = (input.channel || tpl?.channel || fallback?.channel || "email").toLowerCase();
    const data = stringifyData(input.data ?? {});
    const subject = this.render(tpl?.subject ?? fallback?.subject ?? input.template, data);
    const body = this.render(tpl?.body ?? fallback?.body ?? JSON.stringify(data), data);

    const sent = await this.deliver(to, subject, body, channel);
    const attempts = 1;
    await prisma.notificationLog.create({
      data: {
        template: input.template,
        channel,
        to,
        subject,
        body,
        ref: input.ref,
        status: sent.ok ? "sent" : sent.skipped ? "skipped" : "failed",
        attempts,
        lastError: sent.error?.slice(0, 500),
        nextRetryAt: sent.ok || sent.skipped ? null : this.nextRetry(attempts),
      },
    });
    return sent;
  }

  async logs() {
    const rows = await prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => this.presentLog(row));
  }

  upsertTemplate(key: string, body: { channel?: string; subject?: string; body: string }) {
    const clean = key.trim();
    if (!clean) throw new BadRequestException("Template key required");
    return prisma.notificationTemplate.upsert({
      where: { key: clean },
      create: {
        key: clean,
        channel: body.channel ?? "email",
        subject: body.subject,
        body: body.body,
      },
      update: {
        channel: body.channel ?? "email",
        subject: body.subject,
        body: body.body,
      },
    });
  }

  templates() {
    return prisma.notificationTemplate.findMany({ orderBy: { key: "asc" } });
  }

  async retryFailed() {
    const failed = await prisma.notificationLog.findMany({
      where: {
        status: "failed",
        attempts: { lt: MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      take: 20,
      orderBy: { createdAt: "asc" },
    });
    let retried = 0;
    for (const row of failed) {
      const again = await this.deliver(row.to, row.subject || row.template, row.body || row.template, row.channel);
      const attempts = row.attempts + 1;
      const dead = !again.ok && !again.skipped && attempts >= MAX_ATTEMPTS;
      await prisma.notificationLog.update({
        where: { id: row.id },
        data: {
          attempts,
          status: again.ok ? "sent" : again.skipped ? "skipped" : dead ? "dead" : "failed",
          lastError: again.error?.slice(0, 500) ?? null,
          nextRetryAt: again.ok || again.skipped || dead ? null : this.nextRetry(attempts),
        },
      });
      if (again.ok) retried += 1;
    }
    return { retried, scanned: failed.length };
  }

  async resend(id: string) {
    const row = await prisma.notificationLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Notification log not found");
    const sent = await this.deliver(row.to, row.subject || row.template, row.body || row.template, row.channel);
    await prisma.notificationLog.create({
      data: {
        template: row.template,
        channel: row.channel,
        to: row.to,
        subject: row.subject,
        body: row.body,
        ref: row.ref,
        status: sent.ok ? "sent" : sent.skipped ? "skipped" : "failed",
        attempts: 1,
        lastError: sent.error?.slice(0, 500),
        nextRetryAt: sent.ok || sent.skipped ? null : this.nextRetry(1),
      },
    });
    return sent;
  }

  async sendTripReminders() {
    const now = Date.now();
    const from = new Date(now + 20 * 3_600_000);
    const to = new Date(now + 28 * 3_600_000);
    const bookings = await prisma.booking.findMany({
      where: { status: "CONFIRMED", startsAt: { gte: from, lte: to } },
      include: {
        user: true,
        pickupBranch: { include: { city: true } },
      },
    });
    let sent = 0;
    const web = siteUrl();
    for (const booking of bookings) {
      const already = await prisma.notificationLog.findFirst({
        where: { template: "trip_reminder", ref: booking.publicId },
      });
      if (already) continue;
      const car = await prisma.carModel.findUnique({ where: { id: booking.carModelId } });
      const result = await this.send({
        template: "trip_reminder",
        toUserId: booking.userId,
        ref: booking.publicId,
        data: {
          publicId: booking.publicId,
          carName: car?.name || "",
          rentalType: labelRental(booking.rentalType),
          startsAt: formatIst(booking.startsAt),
          branch: booking.pickupBranch?.name || "",
          city: booking.pickupBranch?.city?.name || "",
          trackUrl: `${web}/track/${booking.publicId}`,
        },
      });
      if (result.ok) sent += 1;
    }
    return { sent, scanned: bookings.length };
  }

  private presentLog(row: {
    id: string;
    template: string;
    channel: string;
    to: string;
    subject: string;
    body: string;
    status: string;
    attempts: number;
    lastError: string | null;
    nextRetryAt: Date | null;
    ref: string | null;
    createdAt: Date;
  }) {
    return {
      ...row,
      to: maskRecipient(row.to),
      body: redactBody(row.template, row.body),
      lastError: row.lastError ? redactBody(row.template, row.lastError) : null,
    };
  }

  private render(text: string, data: Record<string, string>) {
    return Object.entries(data).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v ?? ""),
      text
    );
  }

  private nextRetry(attempts: number) {
    const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ?? 45;
    return new Date(Date.now() + minutes * 60_000);
  }

  private async deliver(
    to: string,
    subject: string,
    body: string,
    channel: string
  ): Promise<{ ok: boolean; mocked?: boolean; skipped?: boolean; error?: string }> {
    if (channel === "sms" || channel === "whatsapp") {
      console.log(`[notify:${channel}:skipped] to=${maskRecipient(to)} subject=${subject}`);
      return { ok: false, skipped: true, error: `${channel} channel not configured` };
    }
    if (!process.env.GMAIL_USER) {
      console.log(`[notify:dev] to=${to} subject=${subject} body=${body.slice(0, 500)}`);
      return { ok: true, mocked: true };
    }
    try {
      const nodemailer = require("nodemailer") as {
        createTransport: (opts: unknown) => { sendMail: (opts: unknown) => Promise<unknown> };
      };
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: process.env.GMAIL_REFRESH_TOKEN
          ? {
              type: "OAuth2",
              user: process.env.GMAIL_USER,
              clientId: process.env.GMAIL_CLIENT_ID,
              clientSecret: process.env.GMAIL_CLIENT_SECRET,
              refreshToken: process.env.GMAIL_REFRESH_TOKEN,
            }
          : { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      const html = looksLikeHtml(body) ? body : wrapPlain(body);
      await transport.sendMail({
        from: `DreamDrive <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        text: stripTags(body),
      });
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("notify failed", error);
      return { ok: false, error };
    }
  }
}

function stringifyData(data: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v == null ? "" : String(v);
  return out;
}

function looksLikeHtml(body: string) {
  return /<\/?[a-z][\s\S]*>/i.test(body);
}

function wrapPlain(text: string) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br/>");
  return `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #ddd;border-radius:10px;padding:24px;">
  <div style="text-align:center;margin-bottom:16px;"><img src="${LOGO}" alt="Dream Drive" style="height:56px;" /></div>
  <div>${escaped}</div>
</div>`;
}

function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function maskRecipient(to: string) {
  const email = to.trim();
  const at = email.indexOf("@");
  if (at > 0) {
    const user = email.slice(0, at);
    const domain = email.slice(at + 1);
    const keep = user.slice(0, 1);
    return `${keep}***@${domain}`;
  }
  const digits = email.replace(/\D/g, "");
  if (digits.length >= 8) return `${email.slice(0, 2)}******${email.slice(-2)}`;
  return "***";
}

function redactBody(template: string, body: string) {
  let text = body;
  if (template === "otp") text = text.replace(/\d{4,8}/g, "******");
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => maskRecipient(m));
}

function siteUrl() {
  return (process.env.WEB_ORIGIN || process.env.WEB_URL || "http://localhost:3000").replace(/\/$/, "");
}

function formatIst(date: Date) {
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function labelRental(value: string) {
  return value.replaceAll("_", " ");
}
