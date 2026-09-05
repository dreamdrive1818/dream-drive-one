"use strict";

/**
 * Prisma DATABASE_URL helper for Supabase.
 *
 * Direct host `db.<ref>.supabase.co` is IPv6-only. Home ISPs (this Windows
 * machine included) often have no IPv6 route, which Prisma reports as
 * "Can't reach database server". Use the IPv4 Session pooler from
 * Supabase → Connect (copy the host; do not guess aws-0-<region>).
 */
const DEFAULT_REF = "aghzvdmlczybfaffmwbb";

function usePooler() {
  return (process.env.SUPABASE_USE_POOLER ?? "true") !== "false";
}

function poolerHost() {
  return (process.env.SUPABASE_POOLER_HOST || "").trim();
}

function rewriteToPooler(url) {
  if (!url || /\[YOUR-PASSWORD\]/.test(url)) return url;
  if (!usePooler()) return url;
  const host = poolerHost();
  if (!host) return url;
  let parsed;
  try {
    parsed = new URL(url.replace(/^postgresql:/i, "http:"));
  } catch {
    return url;
  }
  const current = parsed.hostname || "";
  const refMatch = current.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  const ref = refMatch ? refMatch[1] : DEFAULT_REF;
  if (!refMatch && !current.endsWith("pooler.supabase.com") && current !== host) {
    return url;
  }
  parsed.hostname = host;
  parsed.port = process.env.SUPABASE_POOLER_PORT || "5432";
  const user = decodeURIComponent(parsed.username || "postgres");
  if (!user.includes(".")) parsed.username = `${user}.${ref}`;
  return parsed.toString().replace(/^http:/i, "postgresql:");
}

function resolveDatabaseUrl(opts = {}) {
  const requirePassword = Boolean(opts.requirePassword);
  const password = (process.env.SUPABASE_DB_PASSWORD || "").trim();
  const directHost =
    process.env.SUPABASE_DB_HOST || `db.${DEFAULT_REF}.supabase.co`;
  const user = process.env.SUPABASE_DB_USER || "postgres";
  const database = process.env.SUPABASE_DB_NAME || "postgres";
  const port = process.env.SUPABASE_DB_PORT || "5432";

  let url = "";
  if (password && poolerHost() && usePooler()) {
    const dbUser = user.includes(".") ? user : `${user}.${DEFAULT_REF}`;
    url = `postgresql://${dbUser}:${encodeURIComponent(password)}@${poolerHost()}:${process.env.SUPABASE_POOLER_PORT || "5432"}/${database}?sslmode=require&schema=public`;
  } else if (password) {
    url = `postgresql://${user}:${encodeURIComponent(password)}@${directHost}:${port}/${database}?sslmode=require&schema=public`;
  } else {
    url = process.env.DATABASE_URL || "";
    if (url.includes("[YOUR-PASSWORD]")) {
      if (requirePassword) {
        throw new Error(
          "Set SUPABASE_DB_PASSWORD (or replace [YOUR-PASSWORD] in DATABASE_URL) for the Supabase connection."
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
    url = rewriteToPooler(url);
  }

  if (url) {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = rewriteToPooler(
      (process.env.DIRECT_URL || url).replace(/[?&]schema=public/, "")
    );
  }
  return url;
}

module.exports = { resolveDatabaseUrl, rewriteToPooler };
