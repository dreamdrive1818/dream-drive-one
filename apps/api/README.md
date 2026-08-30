# `@dream-drive/api`

NestJS HTTP API for Dream-Drive.

- Port: `API_PORT` / `PORT` (default `4000`)
- Global prefix: `/v1`
- Health: `GET /v1/health`

```bash
npm run start:dev --workspace=@dream-drive/api
```

Domain modules (identity, catalog, booking, payment, etc.) land here first as a modular monolith, then can split into `services/*` when needed.
