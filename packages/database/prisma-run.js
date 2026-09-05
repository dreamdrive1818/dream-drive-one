"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../apps/api/.env"), override: true });

const cmd = process.argv.slice(2).join(" ");
const needsLiveDb = /\b(db push|migrate|studio)\b/.test(cmd);
require("./resolve-url").resolveDatabaseUrl({ requirePassword: needsLiveDb });

const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: __dirname,
});
process.exit(result.status ?? 1);
