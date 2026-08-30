# Infra notes

MVP: Docker Compose for Postgres + Redis (see repo `docker-compose.yml`).

Production: one container per Nest service, Next.js on Vercel or Node, Expo EAS for stores. Gateway is the only public API origin.

Do not expose :4001–:4009 on the public internet.
