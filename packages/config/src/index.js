"use strict";

function read(name, fallback) {
  const value = process.env[name];
  if (value != null && value !== "") return value;
  return fallback;
}

function urls() {
  return {
    gateway: read("GATEWAY_URL", "http://localhost:4000"),
    identity: read("IDENTITY_URL", "http://localhost:4001"),
    catalog: read("CATALOG_URL", "http://localhost:4002"),
    booking: read("BOOKING_URL", "http://localhost:4003"),
    payment: read("PAYMENT_URL", "http://localhost:4004"),
    document: read("DOCUMENT_URL", "http://localhost:4005"),
    fleet: read("FLEET_URL", "http://localhost:4006"),
    partner: read("PARTNER_URL", "http://localhost:4007"),
    notification: read("NOTIFICATION_URL", "http://localhost:4008"),
    platform: read("PLATFORM_URL", "http://localhost:4009"),
    socket: read("SOCKET_URL", "http://localhost:4010"),
  };
}

function internalToken() {
  return read("INTERNAL_TOKEN", "dev-internal");
}

module.exports = { read, urls, internalToken };
