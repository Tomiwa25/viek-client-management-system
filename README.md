# VIEK — Client Management System

A production-oriented, multi-tenant client relationship management application built with React, JavaScript, Node.js, Express, PostgreSQL and Prisma. Containerized with Docker, orchestrated using Kubernetes, and delivered through GitHub Actions.

> **Status:** Phase 1 — requirements and architecture complete. No application code or deployment has been implemented yet. This README is a living record and will be updated as each phase is completed.

## Product scope

Viek CMS enables organizations to manage clients, leads, tasks and interaction history, with role-based access and organization-level data isolation.

**MVP modules:**
- Organization onboarding and user authentication
- Team membership and role-based authorization
- Clients: create, view, update, archive, search, filter, paginate
- Leads: pipeline stages, ownership and conversion to client
- Tasks: assignment, priority, due dates and completion
- Interactions: call, email, meeting and note records
- Dashboard: server-derived client, lead and task metrics

**Deferred:** billing, third-party messaging integrations, email campaigns, file uploads, real-time notifications and advanced analytics.

## Stack

| Concern | Choice |
| --- | --- |
| Frontend | React, Vite, JavaScript, React Router, TanStack Query |
| Backend | Node.js (active LTS), Express, JavaScript |
| Validation | Zod (request and environment schemas) |
| Database | PostgreSQL, Prisma ORM and migrations |
| Auth | Short-lived JWT access tokens; rotating opaque refresh tokens in Secure, HttpOnly cookies |
| Tests | Vitest, React Testing Library, Supertest; Playwright for end-to-end tests |
| API docs | OpenAPI 3.1 |
| Local containers | Docker and Docker Compose |
| Registry | GitHub Container Registry |
| Orchestration | Kubernetes, Helm |
| CI/CD | GitHub Actions, protected production environment |
| Observability | Structured JSON logs, request IDs, health endpoints, OpenTelemetry-compatible instrumentation |

## Architecture

```text
Browser -> HTTPS ingress -> Nginx (React static app)
                         -> Express REST API -> PostgreSQL
GitHub -> GitHub Actions (lint/test/build/scan) -> GHCR -> Helm -> Kubernetes
```

- API namespace: `/api/v1`.
- Backend is the authorization boundary; frontend permissions are only UX.
- Every tenant-owned query is constrained to the authenticated organization.
- Production database should be managed PostgreSQL, not an ephemeral Pod.
- API and web images are immutable and tagged by commit SHA.

See [architecture](docs/architecture/system.md), [requirements](docs/requirements.md), [API contract](docs/api/openapi.yaml), and [ADR-001](docs/decisions/001-stack-and-tenancy.md).

## Roles

| Role | Capabilities |
| --- | --- |
| Admin | Organization settings, membership management, all organization records |
| Manager | All organization clients/leads/tasks/interactions; no organization settings or member administration |
| Staff | Assigned clients/leads/tasks and their related interactions only |

All permissions will be enforced server-side and tested, including cross-organization access attempts.

## Delivery phases

- [x] **Phase 1:** Requirements, system architecture, initial API contract, data model and architectural decisions
- [ ] **Phase 2:** Monorepo scaffolding, React/Vite, Express, lint/format, env validation, PostgreSQL
- [ ] **Phase 3:** Dockerfiles and Docker Compose local stack
- [ ] **Phase 4:** Prisma schema, migrations, seed data, constraints and indexes
- [ ] **Phase 5:** Auth, session rotation, organization access control, REST APIs
- [ ] **Phase 6:** React UI, dashboard and application workflows
- [ ] **Phase 7:** End-to-end integration, accessibility and error handling
- [ ] **Phase 8:** Automated unit, integration, security and E2E tests
- [ ] **Phase 9:** GitHub Actions CI and container publishing
- [ ] **Phase 10:** Helm charts, local Kubernetes validation
- [ ] **Phase 11:** CD to Kubernetes, production ingress/TLS, migrations and rollback
- [ ] **Phase 12:** Observability, performance, hardening and deployment documentation

## Phase 1 record

**Decisions:** JavaScript end-to-end; modular monolith API; single PostgreSQL database with organization-scoped rows; one organization per user for MVP; REST/OpenAPI contract; GitHub Actions + GHCR + Helm; no managed service vendor selected yet.

**Deliverables:** Product requirements, authorization rules, logical data model, initial endpoint contract, architecture decision record.

**Validation:** Architecture and scope reviewed for consistency. No runtime tests are claimed.

## Developer setup

Coming in Phase 2. Do not run installation or deployment commands from this phase alone; the application has not been scaffolded.

## Security and operational principles

- Do not commit secrets, `.env` files or Kubernetes credentials.
- Hash passwords with Argon2id; never store plaintext passwords or refresh tokens.
- Enforce tenant scoping and least-privilege permissions at the API/data-access layers.
- Validate input, rate-limit authentication routes, and log security-relevant events without leaking personal data.
- Use TLS, secure cookies, CORS allowlists and CSRF protection for cookie-authenticated endpoints.
- Use GitHub OIDC for cloud authentication when supported; restrict deployment credentials and environment access.
- Use image scanning, non-root containers, resource limits, probes and safe migration procedures.

## Documentation policy

At the completion of each phase, update this README with: implemented changes, commands to run, relevant environment variables, verification evidence, operational decisions, limitations, and links to detailed documentation. Do not mark a phase complete without working deliverables.
