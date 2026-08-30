# `@dream-drive/web`

Public website + admin UI, ported from `dream-drive-static/client-main` into Next.js.

The existing React Router SPA is mounted via a catch-all route (`src/app/[[...slug]]`). Firebase Auth stays in the browser; API calls go to `NEXT_PUBLIC_API_URL` (static backend or MS `apps/api`).

## Run

```bash
cd dream-drive-MS
npm install
npm run dev:web
# → http://localhost:3000
```

## Env

Copy `.env.example` → `.env.local` and fill Firebase / Cloudinary / API URL. All former `REACT_APP_*` vars are now `NEXT_PUBLIC_*`.

## Layout

```
src/
  app/                 Next.js shell (layout + catch-all)
  Admin/               Admin panel (same as static)
  components/          Public site sections
  container/           React Router routes
  context/             Providers
  api/http.js          Axios → NEXT_PUBLIC_API_URL
  firebase/            Auth + Storage only
```

Admin can later move to `apps/admin`; for now it stays here so the site works as one app.
