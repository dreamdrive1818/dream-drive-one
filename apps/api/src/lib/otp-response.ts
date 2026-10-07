type MailSendResult = {
  ok?: boolean;
  mocked?: boolean;
  skipped?: boolean;
  error?: string;
};

/** True when OTP may be returned in API JSON (dev, mail failure, or explicit flag). */
export function shouldExposeOtpCode(mail: MailSendResult) {
  const emailSent = Boolean(mail.ok && !mail.mocked && !mail.skipped);
  if (!emailSent) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.OTP_EXPOSE_IN_API === "true";
}

export function buildOtpSendResponse(code: string, mail: MailSendResult) {
  const emailSent = Boolean(mail.ok && !mail.mocked && !mail.skipped);
  const expose = shouldExposeOtpCode(mail);
  return {
    ok: true as const,
    emailSent,
    ...(expose ? { devCode: code } : {}),
  };
}

/** Optional fixed OTP for QA when AUTH_TEST_OTP is set (dev or OTP_EXPOSE_IN_API). */
export function resolveAuthTestOtp(): string | null {
  const raw = process.env.AUTH_TEST_OTP?.trim();
  if (!raw || !/^\d{4,8}$/.test(raw)) return null;
  if (process.env.NODE_ENV !== "production") return raw;
  if (process.env.OTP_EXPOSE_IN_API === "true") return raw;
  return null;
}
