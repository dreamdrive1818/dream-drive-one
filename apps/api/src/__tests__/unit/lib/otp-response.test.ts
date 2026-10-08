import {
  awaitMailWithBudget,
  buildOtpSendResponse,
  shouldExposeOtpCode,
} from '../../../lib/otp-response';

describe('buildOtpSendResponse', () => {
  it('returns emailSent and hides code when production mail succeeded', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.OTP_EXPOSE_IN_API;
    const body = buildOtpSendResponse('123456', { ok: true });
    expect(body).toEqual({ ok: true, emailSent: true });
    process.env.NODE_ENV = prev;
  });

  it('does not leak OTP in production when mail is still queued', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.OTP_EXPOSE_IN_API;
    const body = buildOtpSendResponse('123456', { ok: true, queued: true });
    expect(body.emailSent).toBe(true);
    expect(body.queued).toBe(true);
    expect(body).not.toHaveProperty('devCode');
    process.env.NODE_ENV = prev;
  });
});

describe('shouldExposeOtpCode', () => {
  it('exposes code when mail failed', () => {
    expect(shouldExposeOtpCode({ ok: false, error: 'Connection timeout' })).toBe(true);
  });
});

describe('awaitMailWithBudget', () => {
  it('returns queued when SMTP exceeds the budget', async () => {
    const slow = new Promise<{ ok: boolean }>((resolve) => {
      setTimeout(() => resolve({ ok: true }), 80);
    });
    const result = await awaitMailWithBudget(slow, 20);
    expect(result.queued).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('returns the real mail result when it finishes in time', async () => {
    const fast = Promise.resolve({ ok: true, mocked: true });
    const result = await awaitMailWithBudget(fast, 50);
    expect(result).toEqual({ ok: true, mocked: true });
  });
});
