type MailSendResult = {
  ok?: boolean;
  mocked?: boolean;
  skipped?: boolean;
  queued?: boolean;
  error?: string;
};

const OTP_MAIL_BUDGET_MS = 3_000;

export async function awaitMailWithBudget(
  send: Promise<MailSendResult>,
  ms = OTP_MAIL_BUDGET_MS
): Promise<MailSendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<MailSendResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: true, queued: true }), ms);
  });
  try {
    return await Promise.race([send, budget]);
  } finally {
    if (timer) clearTimeout(timer);
    void send.catch(() => undefined);
  }
}

/** True when OTP may be returned in API JSON (dev, mail failure, or explicit flag). */
export function shouldExposeOtpCode(mail: MailSendResult) {
  const emailSent = Boolean(mail.ok && !mail.mocked && !mail.skipped);
  if (!emailSent) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.OTP_EXPOSE_IN_API === "true";
}

export function buildOtpSendResponse(code: string, mail: MailSendResult) {
  const emailSent = Boolean((mail.ok && !mail.mocked && !mail.skipped) || mail.queued);
  const expose = shouldExposeOtpCode({
    ok: Boolean(mail.ok || mail.queued),
    mocked: mail.mocked,
    skipped: mail.skipped,
  });
  return {
    ok: true as const,
    emailSent,
    ...(mail.queued ? { queued: true as const } : {}),
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
