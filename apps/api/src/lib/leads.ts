import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const DEDUPE_MS = 7 * 24 * 60 * 60 * 1000;
const CLICK_SOURCES = new Set(["whatsapp", "phone"]);

const SOURCE_ALIASES: Record<string, string> = {
  website: "web",
  "whats-app": "whatsapp",
  wa: "whatsapp",
  call: "phone",
  walkin: "walk-in",
  walk_in: "walk-in",
  google: "ads",
  facebook: "ads",
  meta: "ads",
  instagram: "ads",
};

export function normalizeLeadSource(raw?: string | null) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!value) return "web";
  return SOURCE_ALIASES[value] || value;
}

export type UpsertLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  source: string;
  note?: string;
  userId?: string;
};

export async function upsertPublicLead(input: UpsertLeadInput) {
  const name = input.name?.trim() || "Website enquiry";
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = input.phone?.trim() || undefined;
  const city = input.city?.trim() || undefined;
  const source = normalizeLeadSource(input.source);
  const note = input.note?.trim() || undefined;
  const click = CLICK_SOURCES.has(source);

  if (!email && !phone && !click) {
    throw new BadRequestException("email or phone required");
  }

  const since = new Date(Date.now() - DEDUPE_MS);
  const or: Prisma.LeadWhereInput[] = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  if (!email && !phone && click) {
    or.push({ source, email: null, phone: null });
  }

  const existing = await prisma.lead.findFirst({
    where: {
      createdAt: { gte: since },
      OR: or,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const activityNote =
      note ||
      (click && !email && !phone ? `${source} click` : undefined);
    if (activityNote) {
      await prisma.leadActivity.create({
        data: { leadId: existing.id, note: activityNote },
      });
    }
    return { id: existing.id, duplicate: true, status: existing.status };
  }

  const lead = await prisma.lead.create({
    data: {
      name,
      email,
      phone,
      city,
      source,
      userId: input.userId,
      activities: note || (click && !email && !phone)
        ? { create: { note: note || `${source} click` } }
        : undefined,
    },
  });
  return { id: lead.id, duplicate: false, status: lead.status };
}
