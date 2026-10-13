import { isSmtpConfigured, mailProvider } from '../../../lib/mail-status';

describe('isSmtpConfigured', () => {
  const keys = [
    'RESEND_API_KEY',
    'SMTP_HOST',
    'SMTP_NOREPLY_PASS',
    'SMTP_SUPPORT_PASS',
    'SMTP_INFO_PASS',
    'GMAIL_USER',
  ];
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('is false when nothing is set', () => {
    expect(isSmtpConfigured()).toBe(false);
  });

  it('is true when Hostinger host and mailbox password exist', () => {
    process.env.SMTP_HOST = 'smtp.hostinger.com';
    process.env.SMTP_NOREPLY_PASS = 'secret';
    expect(isSmtpConfigured()).toBe(true);
  });

  it('is true for Gmail fallback', () => {
    process.env.GMAIL_USER = 'dreamdrive1818@gmail.com';
    expect(isSmtpConfigured()).toBe(true);
  });

  it('reports Hostinger as primary with Resend as fallback', () => {
    process.env.SMTP_HOST = 'smtp.hostinger.com';
    process.env.RESEND_API_KEY = 're_test';
    expect(isSmtpConfigured()).toBe(true);
    expect(mailProvider()).toBe('smtp+resend');
  });

  it('uses Resend alone when no SMTP is configured', () => {
    process.env.RESEND_API_KEY = 're_test';
    expect(mailProvider()).toBe('resend');
  });
});
