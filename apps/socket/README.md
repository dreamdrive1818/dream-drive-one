# `@dream-drive/socket`

Realtime Socket.IO server for booking tracking and admin live updates.

- Port: `SOCKET_PORT` (default `4010`)
- Namespace: `/booking`
- Events:
  - client → `booking:subscribe` `{ bookingId }`
  - server → `booking:status` status payload

```bash
npm run start:dev --workspace=@dream-drive/socket
```

Wire `apps/api` / `apps/worker` to emit into this process (Redis adapter later for multi-instance).
