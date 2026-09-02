# Admin operations console

Next.js. Port 3001.

No partner self-service. Roles enforced by the API; UI hides pages the role cannot use.

Staff login talks only to the API (`POST /v1/auth/login` or local `Bearer dev:email`). Firebase, Cloudinary, and the database stay on `apps/api`.
