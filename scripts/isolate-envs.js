"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\n/g, "\r\n"), "utf8");
}

const DB =
  "postgresql://dreamdrive:dreamdrive@localhost:5432/dreamdrive?schema=public";
const TOKEN = "dev-internal";

const envs = {
  "packages/database": `# Local to packages/database only.
DATABASE_URL=${DB}
NODE_ENV=development
`,

  "services/gateway": `# Gateway — public API on :4000
NODE_ENV=development
PORT=4000
GATEWAY_PORT=4000
INTERNAL_TOKEN=${TOKEN}
DEV_AUTH_BYPASS=true
IDENTITY_URL=http://localhost:4001
CATALOG_URL=http://localhost:4002
BOOKING_URL=http://localhost:4003
PAYMENT_URL=http://localhost:4004
DOCUMENT_URL=http://localhost:4005
FLEET_URL=http://localhost:4006
PARTNER_URL=http://localhost:4007
NOTIFICATION_URL=http://localhost:4008
PLATFORM_URL=http://localhost:4009
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
REDIS_URL=redis://localhost:6379
`,

  "services/identity-service": `# Identity service :4001
NODE_ENV=development
PORT=4001
IDENTITY_PORT=4001
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
NOTIFICATION_URL=http://localhost:4008
`,

  "services/catalog-service": `# Catalog service :4002
NODE_ENV=development
PORT=4002
CATALOG_PORT=4002
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
BUFFER_HOURS=3
`,

  "services/booking-service": `# Booking service :4003
NODE_ENV=development
PORT=4003
BOOKING_PORT=4003
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
HOLD_MINUTES=15
CATALOG_URL=http://localhost:4002
NOTIFICATION_URL=http://localhost:4008
`,

  "services/payment-service": `# Payment service :4004
NODE_ENV=development
PORT=4004
PAYMENT_PORT=4004
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
PAYMENTS_MOCK=true
BOOKING_URL=http://localhost:4003
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
`,

  "services/document-service": `# Document service :4005
NODE_ENV=development
PORT=4005
DOCUMENT_PORT=4005
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
BOOKING_URL=http://localhost:4003
LEEGALITY_API_KEY=
LEEGALITY_BASE_URL=https://app.leegality.com/api
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_WEBHOOK_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
`,

  "services/fleet-service": `# Fleet service :4006
NODE_ENV=development
PORT=4006
FLEET_PORT=4006
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
CATALOG_URL=http://localhost:4002
PARTNER_URL=http://localhost:4007
`,

  "services/partner-service": `# Partner service :4007
NODE_ENV=development
PORT=4007
PARTNER_PORT=4007
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
`,

  "services/notification-service": `# Notification service :4008
NODE_ENV=development
PORT=4008
NOTIFICATION_PORT=4008
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_APP_PASSWORD=
`,

  "services/platform-service": `# Platform service :4009
NODE_ENV=development
PORT=4009
PLATFORM_PORT=4009
DATABASE_URL=${DB}
INTERNAL_TOKEN=${TOKEN}
`,

  "apps/worker": `# Worker (cron)
NODE_ENV=development
INTERNAL_TOKEN=${TOKEN}
BOOKING_URL=http://localhost:4003
NOTIFICATION_URL=http://localhost:4008
`,

  "apps/socket": `# Socket server :4010
NODE_ENV=development
PORT=4010
SOCKET_PORT=4010
SOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
`,

  "apps/api": `# Legacy health API (not the public gateway)
NODE_ENV=development
PORT=3999
API_PORT=3999
`,

  "apps/web": `# Public website :3000 — talks only to the gateway
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_PRESET=
`,

  "apps/admin": `# Admin console :3001 — talks only to the gateway
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
`,

  "apps/mobile": `# Expo customer app — talks only to the gateway
EXPO_PUBLIC_API_URL=http://localhost:4000
`,

  "packages/config": `# Library only — no runtime. Kept so the package is self-contained.
NODE_ENV=development
`,
};

for (const [dir, body] of Object.entries(envs)) {
  write(path.join(root, dir, ".env"), body);
  write(path.join(root, dir, ".env.example"), body);
}

function patchText(file, fn) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return;
  let text = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
  text = fn(text);
  fs.writeFileSync(abs, text, "utf8");
}

const nestMains = [
  "services/gateway/src/main.ts",
  "services/identity-service/src/main.ts",
  "services/catalog-service/src/main.ts",
  "services/booking-service/src/main.ts",
  "services/payment-service/src/main.ts",
  "services/document-service/src/main.ts",
  "services/fleet-service/src/main.ts",
  "services/partner-service/src/main.ts",
  "services/notification-service/src/main.ts",
  "services/platform-service/src/main.ts",
  "apps/worker/src/main.ts",
  "apps/socket/src/main.ts",
  "apps/api/src/main.ts",
];

for (const file of nestMains) {
  patchText(file, (text) => {
    if (text.includes('import "dotenv/config"')) return text;
    return 'import "dotenv/config";\n' + text;
  });
}

const moduleFiles = [
  "services/gateway/src/app.module.ts",
  "services/identity-service/src/app.module.ts",
  "services/catalog-service/src/app.module.ts",
  "services/booking-service/src/app.module.ts",
  "services/payment-service/src/app.module.ts",
  "services/document-service/src/app.module.ts",
  "services/fleet-service/src/app.module.ts",
  "services/partner-service/src/app.module.ts",
  "services/notification-service/src/app.module.ts",
  "services/platform-service/src/app.module.ts",
  "apps/worker/src/app.module.ts",
  "apps/socket/src/app.module.ts",
  "apps/api/src/app.module.ts",
];

for (const file of moduleFiles) {
  patchText(file, (text) =>
    text.replace(
      /ConfigModule\.forRoot\(\{ isGlobal: true, envFilePath: \["\.\.\/\.\.\/\.env", "\.env"\] \}\)/g,
      'ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })'
    ).replace(
      /envFilePath: \["\.\.\/\.\.\/\.env", "\.env"\]/g,
      'envFilePath: ".env"'
    )
  );
}

function patchPkg(rel, mutate) {
  const abs = path.join(root, rel);
  const raw = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
  const pkg = JSON.parse(raw);
  mutate(pkg);
  fs.writeFileSync(abs, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

const nestPkgs = [
  "services/gateway/package.json",
  "services/identity-service/package.json",
  "services/catalog-service/package.json",
  "services/booking-service/package.json",
  "services/payment-service/package.json",
  "services/document-service/package.json",
  "services/fleet-service/package.json",
  "services/partner-service/package.json",
  "services/notification-service/package.json",
  "services/platform-service/package.json",
  "apps/worker/package.json",
  "apps/socket/package.json",
  "apps/api/package.json",
];

for (const rel of nestPkgs) {
  patchPkg(rel, (pkg) => {
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies.dotenv = "^16.4.5";
    if (pkg.dependencies["@dream-drive/database"] === "*") {
      pkg.dependencies["@dream-drive/database"] = "file:../../packages/database";
    }
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.dev) pkg.scripts.dev = pkg.scripts["start:dev"];
    if (!pkg.scripts.start) pkg.scripts.start = pkg.scripts["start:prod"] || pkg.scripts["start:dev"];
  });
}

patchPkg("apps/web/package.json", (pkg) => {
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.dev = pkg.scripts.dev || "next dev --port 3000";
});

patchPkg("apps/admin/package.json", (pkg) => {
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.dev = pkg.scripts.dev || "next dev --port 3001";
  pkg.scripts.start = pkg.scripts.start || "next start --port 3001";
});

patchPkg("apps/mobile/package.json", (pkg) => {
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.dev = pkg.scripts.dev || "expo start";
  pkg.scripts.start = pkg.scripts.start || "expo start";
});

console.log("wrote per-package env + patched loaders");
