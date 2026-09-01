import { Injectable } from "@nestjs/common";
import { prisma } from "../../lib/prisma";

@Injectable()
export class NotifyEngine {
  async send(input: {
    template: string;
    to?: string;
    toUserId?: string;
    data?: Record<string, string>;
  }) {
    let to = input.to;
    if (!to && input.toUserId) {
      const user = await prisma.user.findUnique({ where: { id: input.toUserId } });
      to = user?.email;
    }
    if (!to) return { ok: false, error: "no recipient" };

    const tpl = await prisma.notificationTemplate.findUnique({
      where: { key: input.template },
    });
    const subject = this.render(tpl?.subject ?? input.template, input.data ?? {});
    const body = this.render(
      tpl?.body ?? JSON.stringify(input.data ?? {}),
      input.data ?? {}
    );

    const sent = await this.deliver(to, subject, body, input.data ?? {});
    await prisma.notificationLog.create({
      data: {
        template: input.template,
        to,
        status: sent.ok ? "sent" : "failed",
      },
    });
    return sent;
  }

  logs() {
    return prisma.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  upsertTemplate(key: string, body: { channel?: string; subject?: string; body: string }) {
    return prisma.notificationTemplate.upsert({
      where: { key },
      create: {
        key,
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
    return prisma.notificationTemplate.findMany();
  }

  async retryFailed() {
    const failed = await prisma.notificationLog.findMany({
      where: { status: "failed" },
      take: 20,
    });
    let retried = 0;
    for (const row of failed) {
      const again = await this.deliver(row.to, row.template, row.template, {});
      await prisma.notificationLog.update({
        where: { id: row.id },
        data: { status: again.ok ? "sent" : "failed" },
      });
      if (again.ok) retried += 1;
    }
    return { retried };
  }

  private render(text: string, data: Record<string, string>) {
    return Object.entries(data).reduce(
      (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
      text
    );
  }

  private async deliver(
    to: string,
    subject: string,
    body: string,
    data: Record<string, string>
  ) {
    if (!process.env.GMAIL_USER) {
      console.log(`[notify:dev] to=${to} subject=${subject} body=${body} data=${JSON.stringify(data)}`);
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
      await transport.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        html: `<pre>${body}</pre>`,
      });
      return { ok: true };
    } catch (err) {
      console.error("notify failed", err);
      return { ok: false };
    }
  }
}
