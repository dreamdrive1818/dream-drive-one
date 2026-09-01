# `@dream-drive/api`

Single NestJS HTTP API for Dream-Drive. Identity, catalog, booking, payment, documents, fleet, partner, notifications, and platform all run in this process.

- Port: `API_PORT` / `PORT` (default `4000`)
- Health: `GET /health`
- Public prefix: `/v1`

```bash
npm run start:dev --workspace=@dream-drive/api
```

Web, admin, and mobile call only `http://localhost:4000`.
