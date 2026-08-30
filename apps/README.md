# Apps

Runnable products in the Dream-Drive MS monorepo.

| Package | Folder | Default port | Stack |
| --- | --- | ---: | --- |
| `@dream-drive/api` | `api/` | 4000 | NestJS HTTP |
| `@dream-drive/web` | `web/` | 3000 | Next.js — **ported from `dream-drive-static/client-main`** |
| `@dream-drive/worker` | `worker/` | — | NestJS schedule / queues |
| `@dream-drive/socket` | `socket/` | 4010 | NestJS + Socket.IO |
| `@dream-drive/admin` | `admin/` | 3001 | Next.js stub (admin UI still inside `web` for now) |
| `@dream-drive/mobile` | `mobile/` | — | Expo |

## Frontend (`apps/web`)

Source of truth for the live UI is now here (not CRA). React Router runs inside a Next.js catch-all; `NEXT_PUBLIC_API_URL` points at `dream-drive-static/backend` or `apps/api`.

```bash
npm install
npm run dev:web
# http://localhost:3000
```

From repo root:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
npm run dev:socket
```
