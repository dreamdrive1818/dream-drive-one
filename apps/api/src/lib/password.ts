import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const key = (await scrypt(password, salt, expected.length)) as Buffer;
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateStaffPassword() {
  const bytes = randomBytes(8);
  let body = "";
  for (const b of bytes) body += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
  return `Dd-${body.slice(0, 4)}-${body.slice(4)}`;
}

