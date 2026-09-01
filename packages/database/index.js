"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../apps/api/.env") });

const { resolveDatabaseUrl } = require("./resolve-url");
resolveDatabaseUrl({ requirePassword: true });

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
