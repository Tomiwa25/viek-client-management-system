# Phase 2 — Local setup

Requirements: Node.js 22+, npm 10+, PostgreSQL 16+ (or a locally accessible PostgreSQL server).

1. From the repository root, run `npm install`.
2. Copy `backend/.env.example` to `backend/.env`; adjust `DATABASE_URL` to your own local PostgreSQL instance.
3. Create a local PostgreSQL database named `clientflow` and an appropriately restricted application user (do not use example passwords in production).
4. Run `npm run db:check --workspace backend` to confirm connectivity.
5. Run `npm run dev:api` and `npm run dev:web` in separate terminals.
6. Visit `http://localhost:5173` and `http://localhost:4000/api/v1/health`.
7. Run `npm test`, `npm run lint`, and `npm run build`.

The backend health endpoint intentionally does not test PostgreSQL; `db:check` does. Docker and Prisma migrations are scheduled for later phases. No client CRUD or authentication is implemented yet.
