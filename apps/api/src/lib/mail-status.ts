export function isSmtpConfigured() {
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
