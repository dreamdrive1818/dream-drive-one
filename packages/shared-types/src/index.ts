export const SERVICES = {
  gateway: 4000,
  identity: 4001,
  catalog: 4002,
  booking: 4003,
  payment: 4004,
  document: 4005,
  fleet: 4006,
  partner: 4007,
  notification: 4008,
  platform: 4009,
  socket: 4010,
} as const;

export const STAFF_ROLES = [
  "SUPPORT",
  "SALES",
  "FLEET_OPS",
  "FINANCE",
  "BRANCH_MANAGER",
  "CITY_MANAGER",
  "SUPER_ADMIN",
] as const;

export const BLOCKING_BOOKING_STATUSES = [
  "HOLD",
  "AWAITING_PAYMENT",
  "AWAITING_KYC",
  "AWAITING_SIGNATURE",
  "CONFIRMED",
  "HANDOVER",
  "ONGOING",
  "RETURN_PENDING",
] as const;

export const HOLD_MINUTES = 15;
export const BUFFER_HOURS = 3;
export const QUOTE_TTL_MINUTES = 20;

export type DomainEvent =
  | "booking.hold.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.completed"
  | "payment.captured"
  | "kyc.approved"
  | "agreement.signed"
  | "inspection.returned";

export type ServiceName = keyof typeof SERVICES;
