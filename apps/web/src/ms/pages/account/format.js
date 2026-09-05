export function rupees(paise) {
  const n = Number(paise || 0) / 100;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function formatDay(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

export function prettyStatus(value) {
  if (!value) return "—";
  return String(value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusTone(value) {
  const v = String(value || "").toUpperCase();
  if (["CONFIRMED", "APPROVED", "SIGNED", "SUCCESS", "COMPLETED", "RESOLVED", "AVAILABLE"].includes(v)) {
    return "ok";
  }
  if (["REJECTED", "CANCELLED", "FAILED", "CLOSED", "DISABLED"].includes(v)) return "bad";
  if (["HOLD", "PENDING", "SUBMITTED", "UNDER_REVIEW", "AWAITING_PAYMENT", "AWAITING_KYC", "AWAITING_SIGNATURE", "OPEN"].includes(v)) {
    return "warn";
  }
  return "muted";
}
