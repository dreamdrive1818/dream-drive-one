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

  "services/gateway": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/identity-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/catalog-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/booking-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/payment-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/document-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/fleet-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/partner-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/notification-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "services/platform-service": `# Folded into apps/api on :4000. Do not run this package.
NODE_ENV=development
`,

  "apps/worker": `# Worker (cron) — calls the single API
NODE_ENV=development
INTERNAL_TOKEN=${TOKEN}
API_URL=http://localhost:4000
`,

  "apps/socket": `# Socket server :4010
NODE_ENV=development
PORT=4010
SOCKET_PORT=4010
SOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
`,

  "apps/api": `# Public API — all domain modules in one process
NODE_ENV=development
PORT=4000
API_PORT=4000
API_URL=http://localhost:4000
SOCKET_URL=http://localhost:4010
INTERNAL_TOKEN=${TOKEN}
DEV_AUTH_BYPASS=true
DATABASE_URL=${DB}
REDIS_URL=redis://localhost:6379
BUFFER_HOURS=3
HOLD_MINUTES=15
PAYMENTS_MOCK=true
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_APP_PASSWORD=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_WEBHOOK_SECRET=
LEEGALITY_API_KEY=
LEEGALITY_BASE_URL=https://app.leegality.com/api
`,

  "apps/web": `# Public website :3000 — talks only to the API
NEXT_PUBLIC_API_URL=http://localhost:4000
`,

  "apps/admin": `# Admin console :3001 — talks only to the API
NEXT_PUBLIC_API_URL=http://localhost:4000
`,

  "apps/mobile": `# Expo customer app — talks only to the API
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
