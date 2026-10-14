# Logical architecture and data model

## Service boundaries

- **Web:** React single-page application served as static assets through Nginx.
- **API:** Express modular monolith with routes -> validation/auth middleware -> service layer -> Prisma repositories.
- **Database:** PostgreSQL, provisioned independently from stateless web/API workloads.
- **Delivery:** GitHub Actions tests/builds/scans; GHCR stores images; Helm deploys to Kubernetes.

## Logical entities

| Entity | Important fields / constraints |
| --- | --- |
| Organization | id UUID PK, name, slug UNIQUE, created_at |
| User | id UUID PK, organization_id FK, email, password_hash, role, status, created_at; UNIQUE(organization_id, email) |
| Invitation | id, organization_id, email, role, token_hash, expires_at, accepted_at |
| Session | id, user_id, refresh_token_hash, expires_at, revoked_at |
| Client | id, organization_id, owner_id FK, name, email, phone, company, status, archived_at, created_at, updated_at |
| Lead | id, organization_id, owner_id FK, name, email, stage, converted_client_id nullable, created_at, updated_at |
| Task | id, organization_id, assignee_id FK, client_id nullable, lead_id nullable, title, priority, due_at, status, created_at |
| Interaction | id, organization_id, client_id FK, author_id FK, type, occurred_at, notes, created_at |

Use UUID identifiers, timestamps in UTC, indexed `organization_id`, and referential constraints. Application services must verify referenced entities belong to the same organization. Prevent a task from linking simultaneously to both a lead and a client unless explicitly supported in a later revision.

## Access policy

Admin: organization settings, invitations, members and all tenant records. Manager: all tenant business records. Staff: only assigned clients, assigned leads and assigned tasks; interactions only for clients assigned to them. Admin and manager can reassign records. User membership and session data are never exposed across tenants.

## API behavior

- JSON over HTTPS, `/api/v1` base, `Authorization: Bearer <access_token>` for protected requests.
- Rotating opaque refresh token in `HttpOnly; Secure; SameSite` cookie; CSRF defense on cookie-authenticated endpoints.
- Lists use `page` and `limit`, with a bounded maximum page size.
- Errors use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Archive clients by default; permanent deletion is a separately authorized operation if introduced.
- Conversion of a lead to a client must be atomic and safe against duplicate requests.

## Operations

- Local: Docker Compose with isolated PostgreSQL volume.
- Kubernetes: separate web and API Deployments, ClusterIP Services, Ingress, Secrets/ConfigMaps, resource limits, readiness/liveness probes.
- Database migration: one controlled pre-deployment Job or gated migration step, never in each API replica.
- Production: managed PostgreSQL with backups, TLS, secret management, audit logs and restore verification.
- Observability: request IDs, structured logs, traces/metrics integration; avoid logging access tokens or client PII.

## Open decisions

- Kubernetes host and managed PostgreSQL provider: choose when cost/region/availability requirements are known.
- DNS domain and TLS certificate mechanism: choose at deployment.
- Email delivery provider for invitation messages: select during invitation implementation.
