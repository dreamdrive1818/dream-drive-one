"use strict";

/**
 * Build a Prisma-ready DATABASE_URL for Supabase direct Postgres (port 5432).
 * Prefer SUPABASE_DB_PASSWORD; otherwise use DATABASE_URL and force sslmode=require.
 */
function resolveDatabaseUrl(opts = {}) {
  const requirePassword = Boolean(opts.requirePassword);
  const password = (process.env.SUPABASE_DB_PASSWORD || "").trim();
  const host =
    process.env.SUPABASE_DB_HOST || "db.aghzvdmlczybfaffmwbb.supabase.co";
  const user = process.env.SUPABASE_DB_USER || "postgres";
  const database = process.env.SUPABASE_DB_NAME || "postgres";
  const port = process.env.SUPABASE_DB_PORT || "5432";

  let url = "";
  if (password) {
    url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require&schema=public`;
  } else {
    url = process.env.DATABASE_URL || "";
    if (url.includes("[YOUR-PASSWORD]")) {
      if (requirePassword) {
        throw new Error(
          "Set SUPABASE_DB_PASSWORD (or replace [YOUR-PASSWORD] in DATABASE_URL) for the Supabase direct connection."
        );
      }
      return url;
    }
    if (url && /supabase\.co/.test(url) && !/sslmode=/.test(url)) {
      url += (url.includes("?") ? "&" : "?") + "sslmode=require";
    }
    if (url && !/schema=/.test(url)) {
      url += (url.includes("?") ? "&" : "?") + "schema=public";
    }
  }

  if (url) {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url.replace(/[?&]schema=public/, "");
  }
  return url;
}

module.exports = { resolveDatabaseUrl };
