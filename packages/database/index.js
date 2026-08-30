"use strict";

const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch (_) {}

const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__dreamDrivePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__dreamDrivePrisma = prisma;
}

module.exports = { prisma, PrismaClient };
