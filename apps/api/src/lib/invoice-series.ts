import { prisma } from "./prisma";

/** Indian financial year label, e.g. 5 Sep 2026 → FY2627 (Apr 2026–Mar 2027). */
export function indianFyLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 4 ? year : year - 1;
  const a = String(start).slice(-2);
  const b = String(start + 1).slice(-2);
  return `FY${a}${b}`;
}

export async function ensureInvoiceSeries() {
  const fy = indianFyLabel();
  const existing = await prisma.invoiceSeries.findUnique({ where: { id: "default" } });
  if (!existing) {
    return prisma.invoiceSeries.create({
      data: { id: "default", prefix: `DD/${fy}/`, fyLabel: fy, nextNumber: 1 },
    });
  }
  if (existing.fyLabel === fy) return existing;
  const prefix = existing.prefix.includes(existing.fyLabel)
    ? existing.prefix.replace(existing.fyLabel, fy)
    : existing.prefix;
  return prisma.invoiceSeries.update({
    where: { id: "default" },
    data: { fyLabel: fy, prefix, nextNumber: 1 },
  });
}

/** Atomically allocate the next GST invoice number from the marked series. */
export async function allocateInvoiceNumber() {
  const series = await ensureInvoiceSeries();
  const updated = await prisma.invoiceSeries.update({
    where: { id: series.id },
    data: { nextNumber: { increment: 1 } },
  });
  const seq = updated.nextNumber - 1;
  return {
    seriesId: updated.id,
    number: `${updated.prefix}${String(seq).padStart(5, "0")}`,
    gstin: updated.gstin,
  };
}
