/** Minimal multi-line PDF (Helvetica). No extra npm dependency. */

function pdfEscape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrap(text: string, width: number): string[] {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = word.length > width ? word.slice(0, width) : word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function rs(paise: number) {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export type AgreementPdfInput = {
  publicId: string;
  customer: string;
  email: string;
  phone: string;
  rentalType: string;
  vehicle: string;
  registration: string;
  startsAt: string;
  endsAt: string;
  amountPaise: number;
  depositPaise: number;
  city: string;
  state: string;
  jurisdiction: string;
  clauses: string;
  signedStamp?: string | null;
};

export function buildAgreementPdf(input: AgreementPdfInput): Buffer {
  const stamp = input.signedStamp?.trim();
  const blocks: string[] = [
    "Dream Drive — Self-drive / chauffeur rental agreement",
    `Booking ${input.publicId}`,
    stamp ? `STATUS: ${stamp}` : "STATUS: UNSIGNED DRAFT",
    "",
    `Hirer: ${input.customer}`,
    `Email: ${input.email}    Phone: ${input.phone || "-"}`,
    `Product: ${input.rentalType.replace(/_/g, " ")}`,
    `Vehicle: ${input.vehicle}${input.registration ? ` (${input.registration})` : ""}`,
    `Period: ${input.startsAt} to ${input.endsAt}`,
    `Hire charges: ${rs(input.amountPaise)}    Security deposit: ${rs(input.depositPaise)}`,
    `City: ${input.city}    State: ${input.state}`,
    `Jurisdiction: ${input.jurisdiction}`,
    "",
    "Clauses",
    stripHtml(input.clauses) ||
      "The hirer agrees to the terms of hire, KYC, vehicle care, and damage policy of Dream Drive.",
    "",
    "This document is generated for e-sign. Handover of a self-drive car requires a completed signature.",
  ];

  const lines: string[] = [];
  for (const block of blocks) {
    if (block === "") {
      lines.push("");
      continue;
    }
    lines.push(...wrap(block, 92));
  }

  let y = 800;
  const ops: string[] = ["BT", "/F1 14 Tf", "50 800 Td", `(${pdfEscape("Dream Drive")}) Tj`, "/F1 9 Tf"];
  for (const line of lines.slice(1)) {
    y -= 14;
    if (y < 50) break;
    ops.push(`1 0 0 1 50 ${y} Tm (${pdfEscape(line.slice(0, 110))}) Tj`);
  }
  ops.push("ET");
  const stream = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, "utf8");
}
