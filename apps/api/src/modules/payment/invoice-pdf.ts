/** Minimal single-page PDF (Helvetica). No extra npm dependency. */

function pdfEscape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function rs(paise: number) {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export type InvoicePdfInput = {
  number: string;
  createdAt: Date;
  amountPaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  supplierState: string;
  customerState: string;
  lines: { label: string; amountPaise: number }[];
  booking?: {
    publicId?: string;
    rentalType?: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
  } | null;
};

export function buildInvoicePdf(inv: InvoicePdfInput): Buffer {
  const day = inv.createdAt.toLocaleDateString("en-IN");
  const rows: [string, string][] = [
    ["Dream Drive — Tax Invoice", ""],
    [`Invoice ${inv.number}`, `Date ${day}`],
    [`Booking ${inv.booking?.publicId ?? "-"}`, inv.booking?.rentalType ?? ""],
    [`Supplier state ${inv.supplierState}`, `Customer state ${inv.customerState}`],
    ["", ""],
    ["Item", "Amount"],
    ...inv.lines.map((l): [string, string] => [l.label, rs(l.amountPaise)]),
    ["", ""],
    ["GST total", rs(inv.gstPaise)],
    ["CGST", rs(inv.cgstPaise)],
    ["SGST", rs(inv.sgstPaise)],
    ["IGST", rs(inv.igstPaise)],
    ["Total (incl. GST)", rs(inv.amountPaise)],
  ];

  let y = 800;
  const ops: string[] = ["BT", "/F1 14 Tf", "50 800 Td", `(${pdfEscape("Dream Drive")}) Tj`];
  y -= 24;
  ops.push("/F1 10 Tf");
  for (const [left, right] of rows.slice(1)) {
    y -= 16;
    if (y < 60) break;
    ops.push(`1 0 0 1 50 ${y} Tm (${pdfEscape(left.slice(0, 70))}) Tj`);
    if (right) ops.push(`1 0 0 1 360 ${y} Tm (${pdfEscape(right.slice(0, 40))}) Tj`);
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
