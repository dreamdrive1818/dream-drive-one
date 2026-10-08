import { isSmtpConfigured } from '../../../lib/mail-status';

describe('isSmtpConfigured', () => {
  const keys = [
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
});
