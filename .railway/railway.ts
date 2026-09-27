import {
  defineRailway,
  github,
  group,
  postgres,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

/**
 * One Railway card per app in apps/, except mobile (Expo stays off Railway).
 * Shared npm workspaces, so every card builds from the repo root.
 * Apply with: railway login && railway link && railway config apply
 */
const REPO = "dreamdrive1818/dream-drive-one";
const BRANCH = "dev";

const repoFiles = ["package.json", "package-lock.json", "turbo.json"];

const apiPublic = "https://${{api.RAILWAY_PUBLIC_DOMAIN}}";
const webPublic = "https://${{web.RAILWAY_PUBLIC_DOMAIN}}";
const adminPublic = "https://${{admin.RAILWAY_PUBLIC_DOMAIN}}";
const socketPublic = "https://${{socket.RAILWAY_PUBLIC_DOMAIN}}";
const apiPrivate = "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}";
const browserOrigins = `${webPublic},${adminPublic}`;

function watch(...paths: string[]) {
  return [...paths, ...repoFiles];
}

function source() {
  return github(REPO, { branch: BRANCH });
}

function build(command: string, watchPatterns: string[]) {
  return {
    buildCommand: `npm ci --include=dev && ${command}`,
    watchPatterns,
  };
}

function kept(names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, preserve()]));
}

const apiSecrets = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "FACEBOOK_APP_ID",
  "FACEBOOK_APP_SECRET",
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_MEASUREMENT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_UPLOAD_PRESET",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GMAIL_USER",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_APP_PASSWORD",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_WEBHOOK_SECRET",
  "ZOHO_FORM_LINK_NAME",
  "KYC_HASH_PEPPER",
  "LEEGALITY_API_KEY",
  "LEEGALITY_BASE_URL",
  "LEEGALITY_PROFILE_ID",
  "LEEGALITY_PRIVATE_SALT",
  "LEEGALITY_IP_ALLOWLIST",
  "PUBLIC_SITE_NAME",
  "PUBLIC_PHONE",
  "PUBLIC_WHATSAPP",
  "PUBLIC_EMAIL",
  "PUBLIC_ADDRESS",
] as const;

export default defineRailway((ctx) => {
  const prod = ctx.environment === "production";

  const db = postgres("postgres");
  const cache = redis("redis");

  const apiWatch = watch("apps/api/**", "packages/**");
  const api = service("api", {
    source: source(),
    build: build(
      "npm run generate --workspace=@dream-drive/database && npm run build --workspace=@dream-drive/api",
      apiWatch,
    ),
    preDeploy: "npm run push --workspace=@dream-drive/database",
    start: "npm run start --workspace=@dream-drive/api",
    healthcheck: "/health",
    healthcheckTimeout: 180,
    env: {
      NODE_ENV: "production",
      NPM_CONFIG_PRODUCTION: "false",
      DATABASE_URL: db.env.DATABASE_URL,
      DIRECT_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      SESSION_SECRET: preserve(),
      INTERNAL_TOKEN: preserve(),
      DEV_AUTH_BYPASS: "false",
      PAYMENTS_MOCK: prod ? "false" : "true",
      API_URL: apiPublic,
      API_PUBLIC_URL: apiPublic,
      SOCKET_URL: socketPublic,
      WEB_ORIGIN: webPublic,
      ADMIN_ORIGIN: adminPublic,
      CORS_ORIGINS: browserOrigins,
      BUFFER_HOURS: "3",
      MAX_RENTAL_DAYS: "30",
      HOLD_MINUTES: "15",
      ...kept(apiSecrets),
    },
  });

  const webWatch = watch("apps/web/**");
  const web = service("web", {
    source: source(),
    build: build("npm run build --workspace=@dream-drive/web", webWatch),
    start: "npm run start --workspace=@dream-drive/web",
    healthcheck: "/",
    healthcheckTimeout: 180,
    env: {
      NODE_ENV: "production",
      NPM_CONFIG_PRODUCTION: "false",
      NEXT_PUBLIC_API_URL: apiPublic,
      NEXT_PUBLIC_SOCKET_URL: socketPublic,
      ...kept(["NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_FACEBOOK_APP_ID"]),
    },
  });

  const adminWatch = watch("apps/admin/**");
  const admin = service("admin", {
    source: source(),
    build: build("npm run build --workspace=@dream-drive/admin", adminWatch),
    start: "npm run start --workspace=@dream-drive/admin",
    healthcheck: "/",
    healthcheckTimeout: 180,
    env: {
      NODE_ENV: "production",
      NPM_CONFIG_PRODUCTION: "false",
      NEXT_PUBLIC_API_URL: apiPublic,
      NEXT_PUBLIC_SOCKET_URL: socketPublic,
    },
  });

  const workerWatch = watch("apps/worker/**");
  const worker = service("worker", {
    source: source(),
    build: build("npm run build --workspace=@dream-drive/worker", workerWatch),
    start: "npm run start --workspace=@dream-drive/worker",
    healthcheck: "/health",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      NPM_CONFIG_PRODUCTION: "false",
      API_URL: apiPrivate,
      INTERNAL_TOKEN: api.env.INTERNAL_TOKEN,
    },
  });

  const socketWatch = watch("apps/socket/**");
  const socket = service("socket", {
    source: source(),
    build: build("npm run build --workspace=@dream-drive/socket", socketWatch),
    start: "npm run start --workspace=@dream-drive/socket",
    healthcheck: "/health",
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: "production",
      NPM_CONFIG_PRODUCTION: "false",
      INTERNAL_TOKEN: api.env.INTERNAL_TOKEN,
      SOCKET_CORS_ORIGIN: browserOrigins,
    },
  });

  return project("dream-drive", {
    resources: [
      group("Apps", [web, admin]),
      group("Backend", [api, worker, socket]),
      group("Data", [db, cache]),
    ],
  });
});
