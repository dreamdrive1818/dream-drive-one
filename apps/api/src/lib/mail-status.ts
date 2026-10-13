export function isSmtpConfigured() {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  const host = process.env.SMTP_HOST?.trim();
  if (host) {
    return Boolean(
      process.env.SMTP_NOREPLY_PASS?.trim() ||
        process.env.SMTP_SUPPORT_PASS?.trim() ||
        process.env.SMTP_INFO_PASS?.trim()
    );
  }
  return Boolean(process.env.GMAIL_USER?.trim());
}

export function mailProvider() {
  const primary = process.env.SMTP_HOST?.trim()
    ? "smtp"
    : process.env.GMAIL_USER?.trim()
      ? "gmail"
      : null;
  const fallback = process.env.RESEND_API_KEY?.trim() ? "resend" : null;
  if (primary && fallback) return `${primary}+${fallback}`;
  return primary || fallback || "none";
}
