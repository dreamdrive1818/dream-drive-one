"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../apps/api/.env"), override: true });

const cmd = process.argv.slice(2).join(" ");
const needsLiveDb = /\b(db push|migrate|studio)\b/.test(cmd);
const isGenerate = /\bgenerate\b/.test(cmd);
require("./resolve-url").resolveDatabaseUrl({ requirePassword: needsLiveDb });

// `prisma generate` only reads the schema. It does not connect, but Prisma still
// requires DATABASE_URL and DIRECT_URL to be set. Railway's image build does not
// always have them, so use a placeholder unless a real URL is already present.
if (isGenerate) {
  const placeholder =
    "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public";
  const missing = (value) => !value || value.includes("[YOUR-PASSWORD]");
  if (missing(process.env.DATABASE_URL)) process.env.DATABASE_URL = placeholder;
  if (missing(process.env.DIRECT_URL)) process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: __dirname,
});
process.exit(result.status ?? 1);
