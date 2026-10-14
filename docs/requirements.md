# Phase 1 — Product requirements

## Target users and workflow

Organizations create a workspace and an admin account. Admins invite team members. Team members track prospects, convert qualified leads into clients, record interactions and follow-up tasks, and review dashboard metrics.

## Functional requirements

- FR-01 Register organization + initial admin atomically; authenticate and terminate sessions.
- FR-02 Admin can invite, deactivate and assign roles to organization members. Invitation acceptance must validate token and expiry.
- FR-03 Authorized users can create, read, update and archive clients; search, sort, filter and paginate lists.
- FR-04 Leads support new, contacted, qualified, proposal_sent, won and lost states; conversion is transactional and idempotent.
- FR-05 Tasks have assignee, optional client/lead association, priority, due date and completion state.
- FR-06 Client interactions have type, timestamp, author and notes.
- FR-07 Dashboard computes organization-scoped metrics server-side.
- FR-08 All mutations are validated and auditable at minimum through created_by, updated_by and timestamps.
- FR-09 Staff access is limited to explicitly assigned records; all list and detail endpoints enforce this.

## Non-functional requirements

- NFR-01 Consistent JSON error envelopes, request IDs, appropriate HTTP statuses.
- NFR-02 Pagination on collections; database indexes for tenant ID and common filters.
- NFR-03 API contract documented with OpenAPI; no breaking API changes without versioning.
- NFR-04 Unit, integration, E2E and cross-tenant security tests in CI.
- NFR-05 Responsive accessible UI; loading, empty, error and success states.
- NFR-06 Configuration from environment; no secrets in source or images.
- NFR-07 Structured logs, health/readiness probes, metrics and actionable deployment diagnostics.
- NFR-08 Container images reproducible, non-root, pinned dependencies and scanned.
- NFR-09 Kubernetes rolling deployments with resource bounds and rollback support.
- NFR-10 Backups and restore drills required before real customer data is accepted.

## Acceptance criteria for MVP

1. Two organizations can operate without reading or modifying each other's records, even by guessing UUIDs.
2. Admin, manager and staff roles pass positive and negative authorization tests.
3. New lead can be created, progressed, converted into a client, assigned and followed up.
4. Search, filtering, pagination and dashboard figures match seeded database fixtures.
5. CI verifies lint, tests, container builds and vulnerability policy; CD deploys immutable image versions to Kubernetes.
6. A new developer can run the local stack using documented commands and environment examples.

## Out of scope for MVP

Payments, invoicing, email campaigns, WhatsApp integrations, external CRM sync, document uploads, mobile native applications, real-time collaboration and multiple organization membership per user.
