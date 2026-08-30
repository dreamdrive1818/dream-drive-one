# Admin operations console

Next.js + TypeScript + Tailwind + shadcn/ui. Port 3001.

No partner self-service. Roles enforced by gateway; UI hides pages the role cannot use.

Staff login: Firebase Auth → `/v1/auth/sync` → must have a non-CUSTOMER role or 403.
