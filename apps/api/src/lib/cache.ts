import Redis from "ioredis";

type MemoryRow = { value: string; exp: number };

const memory = new Map<string, MemoryRow>();
const inflight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL = 45;
const REDIS_WAIT_MS = 180;
const MAX_MEMORY_KEYS = 800;

let redis: Redis | null | undefined;
let redisReady = false;
let redisFailLogs = 0;

function redisUrl() {
  return (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "").trim();
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

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const raw = redisUrl();
  if (!raw || raw.includes("********")) {
    if (process.env.NODE_ENV === "development") {
      console.warn("redis cache: REDIS_URL missing or placeholder — using in-memory cache");
    }
    redis = null;
    return redis;
  }
  try {
    const url = normalizeRedisUrl(raw);
    const useTls = /upstash\.io/i.test(url) || url.startsWith("rediss://");
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2500,
      commandTimeout: REDIS_WAIT_MS,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      family: 4,
      tls: useTls ? {} : undefined,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 400, 2000);
      },
    });
    redis.on("ready", () => {
      redisReady = true;
      console.log("redis cache: connected");
    });
    redis.on("end", () => {
      redisReady = false;
    });
    redis.on("error", (err) => {
      redisReady = false;
      if (process.env.NODE_ENV === "development" && redisFailLogs < 3) {
        redisFailLogs += 1;
        console.warn("redis cache:", err.message);
      }
    });
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
    memorySet(key, raw, DEFAULT_TTL);
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

function scheduleRedisRetry() {
  if (redisRetry) return;
  redisRetry = setTimeout(() => {
    redisRetry = null;
    void pingRedis();
  }, 30_000);
  redisRetry.unref?.();
}

export async function pingRedis() {
  const client = getRedis();
  if (!client) {
    console.warn("redis cache: disabled — reads go to Postgres");
    return false;
  }
  try {
    if (client.status !== "ready") {
      await withTimeout(client.connect(), 2500);
    }
    await withTimeout(client.ping(), 800);
    redisReady = true;
    console.log("redis cache: ready");
    return true;
  } catch (err) {
    redisReady = false;
    console.warn("redis cache: ping failed —", err instanceof Error ? err.message : err);
    scheduleRedisRetry();
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
