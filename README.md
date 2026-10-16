# VIEK — Client Management System (ClientFlow)

A production-oriented, multi-tenant client relationship management (CRM) application built with React 19, Express 5, PostgreSQL 16, and Prisma ORM. Containerized with Docker, orchestrated using Kubernetes manifests, and validated through automated GitHub Actions CI.

> **Status:** Full-stack implementation active. Authentication lifecycle, multi-tenant isolation, atomic lead conversion, CRM operational modules, public showcase dashboard, container manifests, and automated CI test suites are fully implemented and verified (36/36 tests passing).

---

## Table of Contents

- [Product Scope](#product-scope)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Problems Solved & Architectural Solutions](#problems-solved--architectural-solutions)
- [Delivery Phases Progress](#delivery-phases-progress)
- [Core Modules & Features](#core-modules--features)
- [API Contract & Endpoints Inventory](#api-contract--endpoints-inventory)
- [Developer Setup & Quickstart](#developer-setup--quickstart)
- [Automated Testing & Verification](#automated-testing--verification)
- [Containerization & Kubernetes](#containerization--kubernetes)
- [Security & Operational Principles](#security--operational-principles)

---

## Product Scope

VIEK CMS (service name: **ClientFlow**) enables organizations to manage their sales pipelines, client relationships, task deliverables, and interaction histories, with organization-level data isolation and role-based permissions.

**Implemented Core Modules:**
- **Organization Onboarding & Authentication:** Self-service registration, 6-digit numeric OTP email verification, secure session rotation, and multi-step password reset.
- **Multi-Tenant Isolation:** Complete namespace segregation per organization across every database query and mutation.
- **Sales Lead Pipeline:** Structured lifecycle stages (`NEW`, `CONTACTED`, `QUALIFIED`, `WON`, `LOST`), search, filtering, and assignment.
- **Atomic Lead-to-Client Conversion:** Single ACID database transaction converting leads to permanent clients while migrating follow-up tasks and logging audit histories.
- **Client Account Hub:** Centralized portfolio directory with contact management, text search, and pagination.
- **360° Interaction Timeline:** Chronological feed logging touchpoints (`MEETING`, `CALL`, `NOTE`) timestamped to staff authors.
- **Operational Task Tracker:** Team action items linked to leads or clients with priority levels (`HIGH`, `MEDIUM`, `LOW`) and status completion toggles.
- **Public Platform Showcase Dashboard:** High-impact public landing dashboard demonstrating platform business logic, executive metrics, interactive pipeline stages, and company communication channels (Instagram, Twitter, WhatsApp, Email).

---

## Architecture & Tech Stack

```text
Browser -> HTTPS Ingress -> Nginx (React 19 SPA)
                         -> Express 5 REST API -> PostgreSQL 16 (Prisma ORM)
GitHub  -> GitHub Actions CI (lint/test/build/scan) -> Docker Alpine Images -> Kubernetes (k8s/)
```

| Layer / Concern | Technology Choice | Details |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 7, React Router 7 | Single-page application, custom responsive design system (Obsidian Charcoal `#090D16` & Frost White `#F1F5F9`) |
| **State & Cache** | TanStack React Query 5 | Server-state caching, optimistic mutations, automatic query invalidation |
| **Backend API** | Node.js 20 (LTS), Express 5 | RESTful modular router, JSON 100kb limit, Helmet security headers, CORS protection |
| **Database & ORM** | PostgreSQL 16, Prisma ORM 6 | Schema modeling, declarative migrations, connection pooling, atomic transactions |
| **Data Validation** | Zod | Runtime validation for environment variables and API request payloads |
| **Cryptography & Auth** | Node.js `scrypt`, JWT | Ephemeral 15m access tokens, rotating `HttpOnly` refresh cookies, 6-digit SHA-256 OTP tokens |
| **Testing** | Vitest, Supertest | Unit and integration test suites covering auth, multi-tenancy, and CRM workflows |
| **Containerization** | Docker, Docker Compose | Multi-stage `node:20-alpine` (non-root `USER node`) and `nginx:1.27-alpine` |
| **Orchestration** | Kubernetes (`k8s/`) | Kustomize manifests with Deployment, Service, Ingress, ConfigMap, Secrets, and Health Probes |
| **CI / CD** | GitHub Actions | Automated workflow running linting, test suites, and container build checks |

---

## Problems Solved & Architectural Solutions

### 1. Multi-Tenant Data Isolation & IDOR Neutralization
- **The Problem:** In a shared database architecture, querying records without strict tenant scoping creates severe Insecure Direct Object Reference (IDOR) vulnerabilities, risking data leaks between competitor organizations.
- **The Solution:** Every operational table (`clients`, `leads`, `tasks`, `interactions`) enforces an indexed `organizationId` foreign key. The backend authentication middleware automatically injects the verified tenant ID into every Prisma query:
  ```javascript
  where: { id: recordId, organizationId: req.user.organizationId }
  ```
  Attempting to access or mutate a record belonging to another organization returns a strict `404 Not Found` rather than `403 Forbidden`, neutralizing resource enumeration and timing attacks.

### 2. Zero-Loss Atomic Lead-to-Client Conversion
- **The Problem:** Converting a won sales lead into an active enterprise client requires 4 distinct operations: creating the client entity, reassigning pending follow-up tasks, logging an audit record, and updating the lead status. Partial failure in any step leaves corrupted or orphaned records.
- **The Solution:** Implemented an all-or-nothing database transaction via Prisma (`prisma.$transaction`):
  1. `tx.client.create`: Creates the client portfolio account under the tenant organization.
  2. `tx.task.updateMany`: Re-links all pending lead tasks directly to the new Client ID.
  3. `tx.interaction.create`: Generates an immutable `NOTE` audit log timestamping the conversion.
  4. `tx.lead.update`: Sets lead status to `WON` and establishes a bidirectional foreign key reference.
  If any step encounters an error, the database rolls back completely to its pre-conversion state.

### 3. Cryptographic Security & OTP Session Strategy
- **The Problem:** Plain bcrypt or weak password storage is vulnerable to GPU-accelerated brute force attacks. Long-lived access tokens risk token theft in browser environments.
- **The Solution:**
  - Node.js native `crypto.scrypt` with per-user 16-byte cryptographically secure salts and timing-safe buffer comparisons.
  - Dual-token session strategy: 15-minute ephemeral JWT access tokens in memory/storage alongside rotating `HttpOnly`, `SameSite=Strict` refresh token cookies (`clientflow_refresh`).
  - Email verification OTP: 6-digit numeric codes hashed with SHA-256 in the database, protected by a 15-minute expiration window and a 5-attempt rate-limit shield.

### 4. Streamlined Multi-Step Password Recovery
- **The Problem:** Combining OTP entry and password resets on a single screen creates high cognitive load and validation errors.
- **The Solution:** Engineered a dedicated 3-stage password recovery workflow:
  1. `/forgot-password`: Requests account email and sends a 6-digit reset OTP.
  2. `/verify-reset-code`: Receives OTP; pasting or entering 6 digits immediately triggers backend validation (`POST /api/v1/auth/verify-reset-code`) and auto-advances to the password screen without extra button clicks.
  3. `/reset-password`: Dedicated interface exclusively for entering and confirming the new password, complete with interactive password visibility eye toggles.

### 5. Public Platform Showcase vs. Private Workspace Experience
- **The Problem:** Unauthenticated visitors landing on root were bounced straight to an empty login form without understanding the system's business logic or value proposition.
- **The Solution:** Built a public-facing CRM showcase dashboard rendered conditionally at root `/` when unauthenticated. It presents live executive metrics, interactive sales funnel inspection, simulated atomic conversion cards, client account previews, and direct social contact channels (Instagram, Twitter, WhatsApp, Email). Authenticated users seamlessly access their private workspace dashboard.

---

## Delivery Phases Progress

- [x] **Phase 1: Requirements & Architecture** — Business specifications, multi-tenant domain boundary, logical data model, and ADR-001 documentation.
- [x] **Phase 2: Monorepo Scaffolding & Foundation** — npm workspaces (`client`, `server`), React 19 / Vite 7, Express 5, Prettier, ESLint, Zod environment validation.
- [x] **Phase 3: Docker & Local Compose Stack** — Multi-stage non-root Dockerfiles, root `docker-compose.yml` for PostgreSQL 16 and full-stack orchestration.
- [x] **Phase 4: Prisma Schema & Migrations** — Complete schema (`Organization`, `User`, `VerificationToken`, `Session`, `Client`, `Lead`, `Task`, `Interaction`), indexes, initial migration.
- [x] **Phase 5: Auth & Multi-Tenant REST APIs** — Scrypt hashing, OTP verification, rotating cookies, JWT access tokens, cross-tenant isolation, IDOR protection, CRM endpoints.
- [x] **Phase 6: React Workspace UI & Workflows** — Authenticated top-nav layout, Leads pipeline table, Clients directory, Task tracker, Interaction drawer, live metrics.
- [x] **Phase 7: Public Platform Dashboard & UX Polish** — Public CRM showcase dashboard, executive metrics, password visibility eye toggles, multi-step password reset, responsive dark theme.
- [x] **Phase 8: Automated Testing Suite** — Vitest suites across client and server with 36/36 passing tests covering auth, tenant boundaries, atomic conversion, and API clients.
- [x] **Phase 9: GitHub Actions CI Pipeline** — Automated CI workflow (`.github/workflows/ci.yml`) executing lint checks, workspace test runs, and container build verification.
- [x] **Phase 10: Kubernetes Orchestration Manifests** — Production manifests in `k8s/` (`namespace`, `configmap`, `secret`, `postgres`, `server`, `client`, `ingress`, `kustomization`) with health checks.
- [ ] **Phase 11: Production Deployment & Helm Chart** — Cloud cluster provisioning, managed PostgreSQL connection, TLS ingress configuration.
- [ ] **Phase 12: Advanced Observability & Telemetry** — OpenTelemetry tracing, Prometheus metrics export, log aggregation.

---

## Core Modules & Features

### 1. Authentication & Identity
- Organization registration creates both the tenant organization and the primary Admin account in a single step.
- 6-digit OTP email verification via logger driver (`mail=log`) with direct verification links.
- Password eye toggles on all login, registration, and password reset inputs.
- Configurable session persistence: Remember Me enables 30-day refresh sessions vs 24 hours.

### 2. Leads Management & Pipeline
- Track prospect details: Company Name, Contact Name, Email, Phone, Estimated Value, and Assigned Staff.
- Structured progression across lifecycle stages: `NEW` ➔ `CONTACTED` ➔ `QUALIFIED` ➔ `WON` / `LOST`.
- Real-time text search and stage filtering.

### 3. Atomic Lead Conversion
- One-click atomic conversion modal on qualified leads.
- Automatically creates client account, transfers all open follow-up tasks, writes an audit interaction log, and locks the lead as `WON`.

### 4. Client Portfolio & 360° Timeline
- Searchable and paginated directory of active client organizations.
- Slide-over timeline drawer displaying chronological interaction history (`MEETING`, `CALL`, `NOTE`).
- Instant interaction logger attributing notes and call logs to the current user.

### 5. Task & Action Items Tracker
- Action items linked directly to Leads or Clients.
- Categorized by priority: `HIGH`, `MEDIUM`, `LOW`.
- Quick checkbox toggle to switch status between `TODO` and `COMPLETED`.

### 6. Team Membership, RBAC & User Invitations Lifecycle (FR-02)
- Multi-tier Role-Based Access Control: `ADMIN` (full control), `MANAGER` (team & pipeline visibility), and `STAFF` (operational tasks).
- Dedicated `Invitation` tracking table with high-entropy SHA-256 tokens and strict 7-day expiration windows.
- Secure email link acceptance flow (`/accept-invite?token=...`) activating member accounts with password configuration.
- 6th-day reminder notification system (automated scan + on-demand triggers) preventing link expirations.
- Complete Admin membership controls: invite colleagues, resend invitation links with refreshed expirations, dispatch reminders, revoke pending access, change roles, and deactivate/reactivate members.
- Cross-client responsive transactional HTML emails styled with Tailwind-like utility cards and inline CSS for cross-client email rendering (invitations, reminders, role updates, and suspension alerts).

---

## API Contract & Endpoints Inventory

All operational endpoints require a valid Bearer JWT access token and enforce organization-level scoping.

### Authentication & Invitation Endpoints (`/api/v1/auth`)
| Method | Path | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new organization & admin user | Public |
| `POST` | `/api/v1/auth/verify-email` | Verify registration using 6-digit OTP | Public |
| `POST` | `/api/v1/auth/resend-otp` | Request a fresh verification OTP | Public |
| `POST` | `/api/v1/auth/login` | Authenticate user, receive JWT & refresh cookie | Public |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token & issue new access token | Cookie |
| `POST` | `/api/v1/auth/logout` | Revoke session & clear refresh cookie | Authenticated |
| `GET` | `/api/v1/auth/me` | Fetch currently authenticated user & organization | Authenticated |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset 6-digit OTP | Public |
| `POST` | `/api/v1/auth/verify-reset-code`| Validate password reset OTP code | Public |
| `POST` | `/api/v1/auth/reset-password` | Update password using verified OTP | Public |
| `GET` | `/api/v1/auth/invitation` | Validate secure token & retrieve workspace invitation details | Public |
| `POST` | `/api/v1/auth/accept-invite` | Accept invitation, set password & activate workspace account | Public |

### Team & Membership Management Endpoints (`/api/v1/team`)
| Method | Path | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/team/members` | List organization team members and access status | `ADMIN`, `MANAGER` |
| `GET` | `/api/v1/team/invitations` | List pending and historical workspace invitations | `ADMIN`, `MANAGER` |
| `POST` | `/api/v1/team/invitations` | Dispatch new team invitation with 7-day token & HTML email | `ADMIN` |
| `POST` | `/api/v1/team/invitations/:id/resend` | Resend invitation with a refreshed 7-day token & email | `ADMIN` |
| `POST` | `/api/v1/team/invitations/:id/reminder` | Send 6th-day / expiring soon reminder notification email | `ADMIN` |
| `DELETE`| `/api/v1/team/invitations/:id` | Revoke active invitation and deactivate token | `ADMIN` |
| `PATCH`| `/api/v1/team/members/:id/role` | Update user access role (`ADMIN`, `MANAGER`, `STAFF`) | `ADMIN` |
| `PATCH`| `/api/v1/team/members/:id/status`| Deactivate or reactivate user account (`ACTIVE`, `SUSPENDED`) | `ADMIN` |
| `POST` | `/api/v1/team/invitations/process-reminders`| Scan and dispatch 6th-day reminders for expiring invites | `ADMIN` |

### CRM Operational Endpoints (`/api/v1`)
| Method | Path | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/leads` | List & filter leads (search, status, pagination) | Authenticated |
| `POST` | `/api/v1/leads` | Create a new sales lead | Authenticated |
| `GET` | `/api/v1/leads/:id` | Get lead details by ID (tenant isolated) | Authenticated |
| `PATCH`| `/api/v1/leads/:id` | Update lead stage, details, or assignment | Authenticated |
| `POST` | `/api/v1/leads/:id/convert` | Atomic lead-to-client conversion transaction | Authenticated |
| `GET` | `/api/v1/clients` | List client accounts (search, pagination) | Authenticated |
| `POST` | `/api/v1/clients` | Create a new client account directly | Authenticated |
| `GET` | `/api/v1/clients/:id` | Get client details & contact info | Authenticated |
| `PATCH`| `/api/v1/clients/:id` | Update client record | Authenticated |
| `GET` | `/api/v1/tasks` | List tasks (filter by status, lead, client) | Authenticated |
| `POST` | `/api/v1/tasks` | Create a task linked to a lead or client | Authenticated |
| `PATCH`| `/api/v1/tasks/:id` | Update task status (`TODO` / `COMPLETED`) | Authenticated |
| `GET` | `/api/v1/interactions` | List client interaction timeline records | Authenticated |
| `POST` | `/api/v1/interactions` | Log a call, meeting, or note for a client | Authenticated |
| `GET` | `/api/v1/health` | Health check probe (database connectivity) | Public |

---

## Developer Setup & Quickstart

### Prerequisites
- **Node.js**: v20.x or higher (LTS recommended)
- **npm**: v10.x or higher
- **PostgreSQL**: v16.x running locally on port `5432` OR **Docker**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Tomiwa25/viek-client-management-system.git
cd viek-client-management-system
npm install
```

### 2. Configure Environment Variables
Create `server/.env`:
```env
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/viek_client_management_db?schema=public"
JWT_ACCESS_SECRET="dev-jwt-access-secret-minimum-32-characters-long"
JWT_REFRESH_SECRET="dev-jwt-refresh-secret-minimum-32-characters-long"
EMAIL_DRIVER=log
COOKIE_SECURE=false
```

Create `client/.env`:
```env
VITE_API_URL=http://localhost:4000
```

### 3. Initialize Database & Run Migrations
```bash
# Verify PostgreSQL connectivity
npm run db:check --workspace=@viek-client-management/server

# Apply Prisma database migrations
npm run prisma:migrate --workspace=@viek-client-management/server
```

### 4. Run Development Servers
```bash
# Run both frontend and backend concurrently from workspace root:
npm run dev
```
- **Web Application:** `http://localhost:5173/`
- **Backend API:** `http://localhost:4000/api/v1/health`

---

## Automated Testing & Verification

The test suite runs Vitest in parallel across both workspaces, covering API clients, request authorization headers, OTP lifecycles, and database multi-tenant isolation.

```bash
# Run all workspace test suites:
npm test

# Run linter:
npm run lint

# Check code formatting:
npm run format:check
```

**Test Coverage Summary:**
- **Client (14 tests):** Token injection, header omission on public routes, error code envelope handling, OTP dispatch payloads, lead conversion requests, task status updates, interaction logging, and team invitation acceptance workflows.
- **Server (38 tests):** Health check, organization registration, Scrypt password verification, OTP generation, rate limiting, token refresh cookies, forgot password flow, cross-tenant isolation enforcement, atomic conversion transaction rollbacks, team invitation token hashing & 7-day expiration, 6th-day reminder scans, admin role modification guards, and member deactivation/reactivation lifecycle.
- **Result:** `52 passed (52 total) — 100% green`.

---

## Containerization & Kubernetes

### Running with Docker Compose
To launch the full stack (PostgreSQL + Express Backend + React/Nginx Frontend) in containers:
```bash
docker compose up --build
```
- Web Application: `http://localhost:5173`
- Backend API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`

### Kubernetes Manifests (`k8s/`)
Production-ready Kubernetes configurations are located in `k8s/`:
```bash
# Preview manifests via Kustomize:
kubectl kustomize k8s/

# Apply manifests to a cluster:
kubectl apply -k k8s/
```
Manifest components:
- `namespace.yaml`: Dedicated `viek-crm` namespace.
- `postgres.yaml`: Persistent volume claim and PostgreSQL StatefulSet.
- `server.yaml`: Node.js Express Deployment with non-root security context and health probes (`/api/v1/health`).
- `client.yaml`: Nginx SPA Deployment with client service.
- `ingress.yaml`: NGINX Ingress Controller rules routing `/api` to the backend and `/` to the frontend.

---

## Security & Operational Principles

- **Zero Plaintext Credentials:** Passwords use memory-hard Scrypt with per-user salt. Refresh tokens and OTP codes are hashed in the database.
- **Strict Authorization Boundary:** The backend is the sole trust boundary. All client-side UI guards are replicated and enforced at the database query layer.
- **Defense in Depth:** Helmet headers, restrictive CORS policies, HttpOnly SameSite=Strict cookies, and Zod payload validation prevent injection and cross-site scripting vulnerabilities.
- **Non-Root Containers:** Docker images execute under non-privileged users (`USER node` in Node.js, unprivileged Nginx) to minimize container escape attack surfaces.

---

## License

This project is licensed under the MIT License.
