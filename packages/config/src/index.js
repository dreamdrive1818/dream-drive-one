"use strict";

function read(name, fallback) {
  const value = process.env[name];
  if (value != null && value !== "") return value;
  return fallback;
}

function urls() {
  const api = read("API_URL", "http://localhost:4000");
  return {
    gateway: api,
    api,
    identity: api,
    catalog: api,
    booking: api,
    payment: api,
    document: api,
    fleet: api,
    partner: api,
    notification: api,
    platform: api,
    socket: read("SOCKET_URL", "http://localhost:4010"),
  };
}

function internalToken() {
  return read("INTERNAL_TOKEN", "dev-internal");
}

module.exports = { read, urls, internalToken };
