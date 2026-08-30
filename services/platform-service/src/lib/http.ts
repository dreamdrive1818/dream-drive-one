import { BadGatewayException } from "@nestjs/common";

export function serviceUrls() {
  return {
    identity: process.env.IDENTITY_URL ?? "http://localhost:4001",
    catalog: process.env.CATALOG_URL ?? "http://localhost:4002",
    booking: process.env.BOOKING_URL ?? "http://localhost:4003",
    payment: process.env.PAYMENT_URL ?? "http://localhost:4004",
    document: process.env.DOCUMENT_URL ?? "http://localhost:4005",
    fleet: process.env.FLEET_URL ?? "http://localhost:4006",
    partner: process.env.PARTNER_URL ?? "http://localhost:4007",
    notification: process.env.NOTIFICATION_URL ?? "http://localhost:4008",
    platform: process.env.PLATFORM_URL ?? "http://localhost:4009",
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
