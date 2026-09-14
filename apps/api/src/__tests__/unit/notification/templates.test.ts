// Tests for notification templates

import { NOTIFICATION_TEMPLATES } from '../../../modules/notification/templates';

describe('NOTIFICATION_TEMPLATES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(NOTIFICATION_TEMPLATES)).toBe(true);
    expect(NOTIFICATION_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('contains a booking_confirmed template', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'booking_confirmed');
    expect(tpl).toBeDefined();
  });

  it('contains a booking_cancelled template', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'booking_cancelled');
    expect(tpl).toBeDefined();
  });

  it('contains an otp template', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'otp');
    expect(tpl).toBeDefined();
  });

  it('contains a payment_receipt template', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'payment_receipt');
    expect(tpl).toBeDefined();
  });

  it('contains a trip_reminder template', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'trip_reminder');
    expect(tpl).toBeDefined();
  });

  it('every template has key, channel, subject, and body', () => {
    for (const tpl of NOTIFICATION_TEMPLATES) {
      expect(typeof tpl.key).toBe('string');
      expect(tpl.key.length).toBeGreaterThan(0);
      expect(typeof tpl.channel).toBe('string');
      expect(typeof tpl.subject).toBe('string');
      expect(tpl.subject.length).toBeGreaterThan(0);
      expect(typeof tpl.body).toBe('string');
      expect(tpl.body.length).toBeGreaterThan(0);
    }
  });

  it('otp template subject mentions OTP or verify', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'otp')!;
    expect(tpl.subject.toLowerCase()).toMatch(/otp|verify|verif/i);
  });

  it('booking_confirmed template body contains {{publicId}} placeholder', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'booking_confirmed')!;
    expect(tpl.body).toContain('{{publicId}}');
  });

  it('booking_cancelled template body contains {{refundPct}} placeholder', () => {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.key === 'booking_cancelled')!;
    expect(tpl.body).toContain('{{refundPct}}');
  });

  it('template keys are unique', () => {
    const keys = NOTIFICATION_TEMPLATES.map((t) => t.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('all templates use email channel', () => {
    for (const tpl of NOTIFICATION_TEMPLATES) {
      expect(tpl.channel).toBe('email');
    }
  });
});
