# `@dream-drive/web`

Public website + admin UI, ported from `dream-drive-static/client-main` into Next.js.

The existing React Router SPA is mounted via a catch-all route (`src/app/[[...slug]]`). The browser talks **only** to `NEXT_PUBLIC_API_URL` (`apps/api`). Firebase, Cloudinary, and Postgres stay on the API.

## Run

```bash
cd dream-drive-MS
npm install
npm run dev:web
# → http://localhost:3000
```

## Env

Copy `.env.example` → `.env`. The only variable is `NEXT_PUBLIC_API_URL`.

## Layout

```
src/
  app/                 Next.js shell (layout + catch-all)
  Admin/               Admin panel (same as static)
  components/          Public site sections
  container/           React Router routes
  context/             Providers
  api/http.js          Axios → NEXT_PUBLIC_API_URL
  utils/cloudinaryUpload.js  Uploads via POST /v1/uploads
```

Admin can later move to `apps/admin`; for now it stays here so the site works as one app.
