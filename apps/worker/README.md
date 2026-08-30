# `@dream-drive/worker`

Background process for cron + queue consumers. No public HTTP port.

Planned jobs:
- HOLD sweeper (release expired booking locks)
- Notification retry
- Webhook replay / Razorpay reconcile
- Partner settlement nightly batch

```bash
npm run start:dev --workspace=@dream-drive/worker
```
