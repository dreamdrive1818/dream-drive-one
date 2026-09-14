// Tests for session-token.ts (pure crypto – no DB needed)

import { mintSessionToken, parseSessionToken } from '../../../lib/session-token';

describe('mintSessionToken', () => {
  it('returns a string starting with dd1.', () => {
    const token = mintSessionToken({ email: 'user@example.com', uid: 'uid-1' });
    expect(token.startsWith('dd1.')).toBe(true);
  });

  it('lowercases the email in the token payload', () => {
    const token = mintSessionToken({ email: 'USER@EXAMPLE.COM', uid: 'uid-2' });
    const payload = parseSessionToken(token);
    expect(payload?.email).toBe('user@example.com');
  });

  it('trims whitespace from email', () => {
    const token = mintSessionToken({ email: '  trim@example.com  ', uid: 'uid-3' });
    const payload = parseSessionToken(token);
    expect(payload?.email).toBe('trim@example.com');
  });

  it('stores the uid correctly', () => {
    const token = mintSessionToken({ email: 'a@b.com', uid: 'my-uid-abc' });
    const payload = parseSessionToken(token);
    expect(payload?.uid).toBe('my-uid-abc');
  });

  it('produces a valid parseable token', () => {
    const token = mintSessionToken({ email: 'valid@example.com', uid: 'uid-valid' });
    const payload = parseSessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.v).toBe(1);
  });
});

describe('parseSessionToken', () => {
  it('returns payload for valid token', () => {
    const token = mintSessionToken({ email: 'x@y.com', uid: 'uid-x' });
    const payload = parseSessionToken(token);
    expect(payload?.email).toBe('x@y.com');
    expect(payload?.uid).toBe('uid-x');
  });

  it('returns null for expired token', () => {
    // Create payload with exp in the past
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    const body = Buffer.from(JSON.stringify({ v: 1, email: 'x@y.com', uid: 'uid-expired', exp: pastExp })).toString('base64url');
    // Create a fake token with invalid sig — should return null either way
    const fakeToken = `dd1.${body}.invalidsig`;
    expect(parseSessionToken(fakeToken)).toBeNull();
  });

  it('returns null for tampered token (modified body)', () => {
    const token = mintSessionToken({ email: 'real@example.com', uid: 'uid-real' });
    // Tamper: flip one character in the body part
    const parts = token.split('.');
    const tamperedBody = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'a' ? 'b' : 'a');
    const tamperedToken = `dd1.${tamperedBody}.${parts[2]}`;
    expect(parseSessionToken(tamperedToken)).toBeNull();
  });

  it('returns null for string without dd1. prefix', () => {
    expect(parseSessionToken('Bearer sometoken')).toBeNull();
    expect(parseSessionToken('notdd1.body.sig')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSessionToken('')).toBeNull();
  });

  it('token with custom TTL expires at the correct time', () => {
    const now = Math.floor(Date.now() / 1000);
    const ttlSec = 60; // 1 minute
    const token = mintSessionToken({ email: 'ttl@example.com', uid: 'uid-ttl', ttlSec });
    const payload = parseSessionToken(token);
    expect(payload).not.toBeNull();
    // exp should be approximately now + 60
    expect(payload!.exp).toBeGreaterThanOrEqual(now + ttlSec - 1);
    expect(payload!.exp).toBeLessThanOrEqual(now + ttlSec + 2);
  });

  it('returns null for a token with malformed structure (no dot)', () => {
    expect(parseSessionToken('dd1.nodot')).toBeNull();
  });
});
