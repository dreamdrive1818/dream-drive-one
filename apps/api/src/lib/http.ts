import { BadGatewayException } from "@nestjs/common";

/** All domain modules run in this process. Loopback for leftover internal HTTP. */
export function serviceUrls() {
  const api = process.env.API_URL ?? "http://localhost:4000";
  return {
    identity: api,
    catalog: api,
    booking: api,
    payment: api,
    document: api,
    fleet: api,
    partner: api,
    notification: api,
    platform: api,
    socket: process.env.SOCKET_URL ?? "http://localhost:4010",
  };
}

export async function internalFetch<T = unknown>(
  base: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-internal-token", process.env.INTERNAL_TOKEN ?? "dev-internal");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    const message =
      typeof json === "object" && json && "message" in json
        ? String((json as { message: unknown }).message)
        : text || res.statusText;
    throw new BadGatewayException(message);
  }
  return json as T;
}

export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export function hoursBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 3_600_000));
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Clock hour 0–23 in Asia/Kolkata. */
export function hourInIst(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
}

/** Midnights crossed in IST (driver nights). */
export function nightsBetween(start: Date, end: Date): number {
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const a = new Date(`${ymd(start)}T00:00:00+05:30`);
  const b = new Date(`${ymd(end)}T00:00:00+05:30`);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return Math.max(0, days);
}

export function isNightHour(hour: number, startsHour = 22, endsHour = 6): boolean {
  if (startsHour === endsHour) return false;
  if (startsHour > endsHour) return hour >= startsHour || hour < endsHour;
  return hour >= startsHour && hour < endsHour;
}
