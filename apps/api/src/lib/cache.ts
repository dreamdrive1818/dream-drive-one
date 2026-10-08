import Redis from "ioredis";
import { isTransientRedisError, redisStatusDead } from "./redis-status";

type MemoryRow = { value: string; exp: number };

const memory = new Map<string, MemoryRow>();
const inflight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL = 45;
const REDIS_WAIT_MS = 800;
const MAX_MEMORY_KEYS = 1200;
const CIRCUIT_MS = 30_000;
const KEEPALIVE_MS = 25_000;
const RETRY_MS = 15_000;
const FAIL_WINDOW = 5;

let redis: Redis | null | undefined;
let redisReady = false;
let redisFailLogs = 0;
let redisCircuitUntil = 0;
let lastPingWarn = 0;
let lastReadyLog = 0;

function redisUrl() {
  if (process.env.REDIS_DISABLED === "true" || process.env.CACHE_MEMORY_ONLY === "true") {
    return "";
  }
  return (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "").trim();
}

function isLocalRedisUrl(url: string) {
  return /^(redis:\/\/|rediss:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

/** In dev, remote Redis (e.g. Upstash) often times out — use memory unless REDIS_FORCE=true. */
function skipRemoteRedisInDev(url: string) {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.REDIS_FORCE === "true") return false;
  if (!url || isLocalRedisUrl(url)) return false;
  return true;
}

function circuitOpen() {
  return Date.now() < redisCircuitUntil;
}

function dropClient() {
  const client = redis;
  redis = undefined;
  redisReady = false;
  if (!client) return;
  client.removeAllListeners();
  try {
    client.disconnect(false);
  } catch {
    // ignore
  }
}

function tripCircuit(reason: string) {
  redisReady = false;
  redisCircuitUntil = Date.now() + CIRCUIT_MS;
  dropClient();
  console.warn(`redis cache: backing off ${CIRCUIT_MS / 1000}s — ${reason}`);
  scheduleRedisRetry();
}

function noteRedisFailure(err?: unknown) {
  const msg = err instanceof Error ? err.message : "unreachable";
  redisFailLogs += 1;
  if (isTransientRedisError(msg) || redisFailLogs >= FAIL_WINDOW) {
    if (redisFailLogs >= FAIL_WINDOW) {
      redisFailLogs = 0;
      tripCircuit(msg);
      return;
    }
    dropClient();
    scheduleRedisRetry();
  }
}

function normalizeRedisUrl(url: string) {
  if (/upstash\.io/i.test(url) && url.startsWith("redis://")) {
    return `rediss://${url.slice("redis://".length)}`;
  }
  return url;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cache timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function attachClient(client: Redis) {
  client.on("ready", () => {
    redisReady = true;
    redisFailLogs = 0;
    redisCircuitUntil = 0;
    if (Date.now() - lastReadyLog > 60_000) {
      lastReadyLog = Date.now();
      console.log("redis cache: connected");
    }
  });
  client.on("end", () => {
    redisReady = false;
    scheduleRedisRetry();
  });
  client.on("close", () => {
    redisReady = false;
  });
  client.on("error", (err) => {
    redisReady = false;
    const msg = err instanceof Error ? err.message : String(err);
    if (isTransientRedisError(msg)) {
      dropClient();
      scheduleRedisRetry();
      return;
    }
    noteRedisFailure(err);
  });
}

function getRedis(): Redis | null {
  if (circuitOpen()) return null;
  if (redis && redisStatusDead(redis.status)) {
    dropClient();
  }
  if (redis !== undefined) return redis;
  const raw = redisUrl();
  if (!raw || raw.includes("********")) {
    redis = null;
    return redis;
  }
  if (skipRemoteRedisInDev(raw)) {
    redis = null;
    return redis;
  }
  try {
    const url = normalizeRedisUrl(raw);
    const useTls = /upstash\.io/i.test(url) || url.startsWith("rediss://");
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 4000,
      commandTimeout: REDIS_WAIT_MS,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      keepAlive: 10_000,
      family: 4,
      tls: useTls ? {} : undefined,
      retryStrategy(times) {
        return Math.min(times * 400, 8_000);
      },
    });
    attachClient(redis);
    startKeepalive();
  } catch {
    redis = null;
  }
  return redis;
}

function memoryGet(key: string): string | undefined {
  const row = memory.get(key);
  if (!row) return undefined;
  if (row.exp <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return row.value;
}

function isProtectedKey(key: string) {
  return PUBLIC_PREFIXES.some((p) => key === p || key.startsWith(p));
}

function memorySet(key: string, raw: string, ttlSec: number) {
  memory.set(key, { value: raw, exp: Date.now() + ttlSec * 1000 });
  if (memory.size <= MAX_MEMORY_KEYS) return;
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.exp <= now) memory.delete(k);
  }
  if (memory.size <= MAX_MEMORY_KEYS) return;
  const overflow = memory.size - MAX_MEMORY_KEYS;
  let dropped = 0;
  for (const k of memory.keys()) {
    if (isProtectedKey(k)) continue;
    memory.delete(k);
    dropped += 1;
    if (dropped >= overflow) break;
  }
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const local = memoryGet(key);
  if (local !== undefined) {
    try {
      return JSON.parse(local) as T;
    } catch {
      return undefined;
    }
  }
  const client = getRedis();
  if (!client || !redisReady) return undefined;
  try {
    const raw = await withTimeout(client.get(key), REDIS_WAIT_MS);
    if (raw == null) return undefined;
    memorySet(key, raw, 120);
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec = DEFAULT_TTL) {
  const raw = JSON.stringify(value);
  memorySet(key, raw, ttlSec);
  const client = getRedis();
  if (!client || !redisReady) return;
  void client.set(key, raw, "EX", ttlSec).catch(() => undefined);
}

export async function cacheDel(...keys: string[]) {
  for (const key of keys) memory.delete(key);
  const client = getRedis();
  if (!client || !redisReady || !keys.length) return;
  void client.del(...keys).catch(() => undefined);
}

export async function remember<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const run = (async () => {
    const value = await load();
    await cacheSet(key, value, ttlSec);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

let redisRetry: ReturnType<typeof setTimeout> | null = null;
let redisKeepalive: ReturnType<typeof setInterval> | null = null;

function scheduleRedisRetry() {
  if (redisRetry) return;
  redisRetry = setTimeout(() => {
    redisRetry = null;
    void pingRedis();
  }, RETRY_MS);
  redisRetry.unref?.();
}

function startKeepalive() {
  if (redisKeepalive) return;
  redisKeepalive = setInterval(() => {
    void pingRedis();
  }, KEEPALIVE_MS);
  redisKeepalive.unref?.();
}

export async function pingRedis() {
  if (circuitOpen()) {
    scheduleRedisRetry();
    return false;
  }
  const client = getRedis();
  if (!client) return false;
  try {
    let active = client;
    if (redisStatusDead(active.status)) {
      dropClient();
      const next = getRedis();
      if (!next) return false;
      active = next;
    }
    if (active.status === "wait") {
      try {
        await withTimeout(active.connect(), 2500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already connecting|already connected/i.test(msg)) throw err;
      }
    }
    await withTimeout(active.ping(), 800);
    redisReady = true;
    redisFailLogs = 0;
    return true;
  } catch (err) {
    redisReady = false;
    const msg = err instanceof Error ? err.message : String(err);
    if (Date.now() - lastPingWarn > 60_000) {
      lastPingWarn = Date.now();
      console.warn("redis cache: ping failed —", msg);
    }
    dropClient();
    noteRedisFailure(err);
    if (!circuitOpen()) scheduleRedisRetry();
    return false;
  }
}

function stableQuery(query: Record<string, unknown>) {
  return Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k] == null ? "" : String(query[k])}`)
    .join("&");
}

export function searchCacheKey(query: Record<string, unknown>) {
  return `dd:search:${stableQuery(query)}`;
}

export function carCacheKey(slug: string) {
  return `dd:car:${slug}`;
}

export function availabilityCacheKey(id: string, from?: string, to?: string, month?: string) {
  return `dd:avail:${id}:${from || ""}:${to || ""}:${month || ""}`;
}

export function bookingsCacheKey(userId: string) {
  return `dd:bookings:${userId}`;
}

export function dashboardCacheKey(userId: string) {
  return `dd:dash:${userId}`;
}

export function meCacheKey(userId: string) {
  return `dd:me:${userId}`;
}

const PUBLIC_PREFIXES = [
  "dd:search:",
  "dd:car:",
  "dd:avail:",
  "dd:settings",
  "dd:cities",
  "dd:catcfg",
  "dd:home",
  "dd:public-config",
  "dd:pages:",
  "dd:banners:",
  "dd:blogs:",
  "dd:testimonials",
  "dd:auth-settings",
  "dd:packages",
  "dd:airports:",
  "dd:reviews:",
];

async function flushRedisPrefixes(client: Redis, prefixes: string[]) {
  try {
    const keys: string[] = [];
    for (const prefix of prefixes) {
      let cursor = "0";
      do {
        const [next, found] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 80);
        cursor = next;
        keys.push(...found);
      } while (cursor !== "0");
    }
    const uniq = [...new Set(keys)];
    for (let i = 0; i < uniq.length; i += 80) {
      await client.del(...uniq.slice(i, i + 80));
    }
  } catch {
    // memory already dropped
  }
}

export async function invalidateCatalogCache() {
  for (const key of [...memory.keys()]) {
    if (PUBLIC_PREFIXES.some((p) => key === p || key.startsWith(p))) memory.delete(key);
  }
  const client = getRedis();
  if (!client || !redisReady) return;
  void flushRedisPrefixes(client, PUBLIC_PREFIXES);
}

export async function invalidatePublicCache() {
  return invalidateCatalogCache();
}

export async function invalidateUserProfile(userId: string) {
  await cacheDel(meCacheKey(userId), dashboardCacheKey(userId));
}

export async function invalidateUserBookings(userId: string) {
  await cacheDel(bookingsCacheKey(userId), dashboardCacheKey(userId), meCacheKey(userId));
  await invalidateCatalogCache();
}

export function isRedisReady() {
  return redisReady;
}
