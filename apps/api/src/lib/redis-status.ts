/** ioredis connection states that cannot be reused with connect(). */
const DEAD = new Set(["end", "close"]);

export function redisStatusDead(status?: string | null) {
  return !status || DEAD.has(status);
}

export function redisNeedsConnect(status?: string | null) {
  return status === "wait" || status === "connecting";
}

export function isTransientRedisError(message: string) {
  return /connection is closed|econnreset|etimedout|econnrefused|socket closed|stream isn't writeable|connection timeout|command timed out|read econnreset|nable to connect|cache timeout/i.test(
    message
  );
}
