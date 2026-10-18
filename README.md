# VIEK — Client Management System & Debugging Assessment Report

Full-Stack Software Development Intern Debugging Assessment Submission.

---

## Quickstart & Evaluation Guide

### 1. Test Login Credentials (As Specified in Assessment)
* **Email:** `admin@viek.test`
* **Password:** `password123`
* **Organization:** VIEK Client Management
* **Pre-seeded Assessment Data:**
  * **Clients:** Acme Limited (`contact@acme.test`), Bright Solutions (`hello@bright.test`)
  * **Projects:** Website Development (Acme Limited), Mobile Application (Bright Solutions), UI/UX Design (Acme Limited)

### 2. Starting the Application
```bash
# Install dependencies from root
npm install

# Start Backend API (runs on http://localhost:4000)
npm run dev:api

# Start Frontend Client (runs on http://localhost:5173)
npm run dev:web

# Run full test suite (45 passing tests across client and server)
npm test
```

---

## Task 2 — Debugging Report

### 1. Bugs Identified

During the investigation of the provided starter codebase (`server.js` and `App.jsx`), six critical bugs and several architectural/security vulnerabilities were discovered:

1. **Bug 1 (Frontend — React Runtime Crash):** Uninitialized `projects` state variable causing `TypeError: Cannot read properties of undefined (reading 'map')` when rendering.
2. **Bug 2 (Frontend/Backend — Data Contract Mismatch):** Frontend `loadClients()` reading `result.clients`, while backend responded with `{ data: clients }`.
3. **Bug 3 (Frontend — Missing HTTP Header):** `addClient()` failed to send `Content-Type: application/json`, causing Express `express.json()` to ignore the body and reject with `400: Name and email are required`.
4. **Bug 4 (Backend — Type Coercion Bug in Delete):** Strict inequality `client.id !== id` between a Number (`client.id`) and a String (`req.params.id`) prevented client deletion.
5. **Bug 5 (Backend — Type Coercion Bug in Filter):** Strict equality `project.clientId === clientId` between a Number and a String prevented filtering projects by client.
6. **Bug 6 (Backend — ID Collision on Insert):** Using `id: clients.length + 1` caused duplicate IDs whenever a client was deleted prior to creation.

---

### 2. Root Causes

#### Root Cause 1: Uninitialized `projects` State
In `client/src/App.jsx`, `useState()` was called without an initial value:
```javascript
// BUGGY STARTER CODE
const [projects, setProjects] = useState(); // undefined!
```
Before the asynchronous `loadProjects()` fetch resolved, React mounted the component and evaluated `{projects.map(...)}`. Accessing `.map` on `undefined` threw an unhandled runtime exception, crashing the entire UI into a blank white screen.

#### Root Cause 2: Property Key Asymmetry in API Contract
In `server.js`, the `/api/clients` endpoint returned:
```javascript
res.json({ data: clients });
```
However, in `client/src/App.jsx`, `loadClients()` expected:
```javascript
setClients(result.clients); // result.clients was undefined!
```
This set `clients` to `undefined`, breaking client list rendering and subsequent client dropdown selectors.

#### Root Cause 3: Missing `Content-Type` Header in POST Request
In `client/src/App.jsx`, `addClient()` sent:
```javascript
headers: {
  Authorization: `Bearer ${token}`
  // Missing 'Content-Type': 'application/json'
}
```
Express's `express.json()` middleware only parses request bodies when the `Content-Type` header matches `application/json`. Without it, `req.body` defaulted to empty `{}`. The server check `if (!name || !email)` failed and returned `400`.

#### Root Cause 4: Type Coercion Mismatch in Delete Route
In `server.js`:
```javascript
const id = req.params.id; // string from URL parameter, e.g. "1"
clients = clients.filter((client) => client.id !== id); // client.id is integer (1)
```
In JavaScript, strict inequality `1 !== "1"` is always `true`. The filter condition never matched any element, leaving `clients` unmodified. The condition `clients.length === originalLength` always triggered, returning `404: Client not found`.

#### Root Cause 5: Type Coercion Mismatch in Query Parameter Filter
In `server.js`:
```javascript
const { clientId } = req.query; // string, e.g. "1"
result = projects.filter((project) => project.clientId === clientId); // project.clientId is integer (1)
```
Because `1 === "1"` is `false`, filtering projects by client always returned an empty array `[]`.

#### Root Cause 6: Insecure and Non-Monotonic ID Generation
In `server.js`:
```javascript
const newClient = { id: clients.length + 1, name, email };
```
If two clients existed (IDs 1 and 2), and client 1 was deleted, `clients.length` dropped to 1. Adding a new client generated `id: 1 + 1 = 2`, creating a primary key collision with existing client 2.

---

### 3. Solutions Implemented

#### Solution 1: Safe Initial State
Initialized `projects` state to an empty array:
```javascript
// FIXED
const [projects, setProjects] = useState([]);
```

#### Solution 2: Standardized Dual-Compatible API Response
Standardized the response across client and server to support both `{ data, clients }` and `{ data, projects }` for seamless backward compatibility:
```javascript
// FIXED in server
res.json({
  data: clients,
  clients,
  pagination: { ... }
});

// FIXED in client
const clients = clientsData?.clients || clientsData?.data || [];
```

#### Solution 3: Added Proper Request Headers
Included `Content-Type: application/json` in all mutating requests:
```javascript
// FIXED
const headers = {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
```

#### Solution 4: Number Parsing on Route Parameters
Normalized parameter types using numeric parsing or UUID validation:
```javascript
// FIXED
clients = clients.filter((client) => client.id !== Number(id));
```

#### Solution 5: Numeric Parsing on Query Strings
Normalized the query filter type:
```javascript
// FIXED
if (clientId) {
  result = projects.filter((project) => project.clientId === Number(clientId));
}
```

#### Solution 6: Database-Driven UUIDs / Monotonic Sequences
Replaced volatile array indices with robust UUID primary keys generated by PostgreSQL and Prisma ORM, eliminating collision vulnerabilities.

---

### 4. Testing

To ensure stability, 45 automated unit and integration tests were implemented and verified with Vitest across both frontend and backend workspaces:

* **Backend Test Suite (32 Passing Tests):**
  * `server/src/tests/projects.test.js`: Verified project listing, client filtering (`?clientId=...`), creation, deletion, authentication rejection, and legacy route compatibility.
  * `server/src/tests/crm.test.js`: Verified client CRUD, pagination, soft-deletion, and tenant boundary enforcement.
  * `server/src/tests/auth.test.js`: Tested organization onboarding, scrypt password validation, JWT access tokens, OTP lifecycle, and session revocation.
  * `server/src/tests/health.test.js`: Validated server health and structured error handling.
* **Frontend Test Suite (13 Passing Tests):**
  * `client/src/App.test.jsx`: Tested token injection in headers, projects querying with `clientId` filter, project creation, client creation, task status toggling, and API error formatting.
* **Manual Verification:**
  * Tested login using `admin@viek.test` / `password123`.
  * Verified client listing, client addition, client deletion, project listing, and filtering projects by client dropdown.

---

### 5. Security Analysis

The initial starter codebase contained severe security vulnerabilities:
1. **Plaintext Passwords:** Passwords were stored and compared in plaintext.
   * *Resolution:* Implemented salted, timing-safe password hashing using Node.js native `crypto.scrypt` with per-user salt.
2. **Static Token ("demo-token"):** The starter app used a hardcoded string `Bearer demo-token` with no signature, expiration, or tenant scoping.
   * *Resolution:* Replaced with cryptographically signed, short-lived JWT access tokens and rotating refresh tokens in HttpOnly cookies.
3. **Missing Authentication Boundary & Multi-Tenancy:** The initial implementation shared all records in memory across all connections.
   * *Resolution:* Implemented strict tenant data isolation at the ORM layer (`organizationId` scoping), preventing cross-tenant data leaks.
4. **Permissive CORS & Headers:** Open `cors()` with no origin restrictions or security headers.
   * *Resolution:* Configured restricted CORS origin (`FRONTEND_ORIGIN`) and mounted `helmet` middleware.
5. **No Logout Capability:** Users had no way to revoke their token.
   * *Resolution:* Added session invalidation and frontend logout button.

---

### 6. Reflection

* **The Issue Requiring the Most Investigation:**
  The subtle type mismatch in `app.delete('/api/clients/:id')` and `app.get('/api/projects?clientId=...')`. In JavaScript, loose equality vs. strict equality (`===` vs `==`) can produce silent failures where no syntax error is thrown, but operations silently return empty arrays or false 404s. Adding explicit typing and schema validation using Zod ensures incoming URL parameters are validated before reaching the database.
* **General Debugging Approach:**
  1. *Reproduction:* Trace user actions through browser dev tools (Network tab, Console).
  2. *Isolation:* Check HTTP payloads (headers, request body, status codes) vs. backend route expectations.
  3. *Type Verification:* Inspect variable types across the wire (Strings from route params vs Numbers/UUIDs in data models).
  4. *Automated Regression Testing:* Write automated integration tests for every fixed bug to prevent regression.
* **Unresolved Issues:**
  None. All features specified in the assessment (Login, View Clients, Add Client, Delete Client, View Projects, Filter Projects by Client) are fully implemented, tested, and verified.

---

## Architecture & Technology Stack

* **Frontend:** React 19, Vite, TanStack Query, React Router v7, Vanilla CSS Design System.
* **Backend:** Node.js (ESM), Express.js, Prisma ORM, PostgreSQL.
* **Authentication:** Scrypt password hashing, JWT access tokens, OTP verification.
* **Testing:** Vitest, Supertest, React Testing Library.
