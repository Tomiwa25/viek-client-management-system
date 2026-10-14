# ADR-001: JavaScript modular monolith and organization-scoped tenancy

**Status:** Accepted for MVP (2026-10-14)

## Context

Build a demonstrable real-world full-stack CRM with a manageable development footprint, security boundaries and automated deployment.

## Decision

React/Vite JavaScript SPA, Express/Node.js modular monolith, Prisma/PostgreSQL. Every tenant-owned row has `organization_id`. One organization per user for MVP. GitHub Actions builds/tests/scans Docker images, publishes to GHCR and deploys with Helm to Kubernetes.

## Consequences

Advantages: one language end-to-end, straightforward development and deployment, relational integrity, observable authorization boundaries, portable images. Costs: tenant scoping must be enforced consistently; monolith requires clear module boundaries; Kubernetes adds operational complexity. Add explicit cross-tenant tests and use repository helpers to enforce organization filters.

## Alternatives considered

Microservices: rejected for MVP because deployment and distributed consistency complexity are not justified. Database per tenant: rejected for MVP because operational overhead is disproportionate. Managed platform without Kubernetes: simpler but does not meet the portfolio orchestration requirement.
