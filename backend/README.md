# Backend — CipherQ for FinSpark (Banking Privileged-Access Security)

Flask API implementing every endpoint the frontend's `src/services/api.js` calls. The
original Intent-Bound Quantum Encryption endpoints (`register`, `login`, `generate-key`,
`capture-face`, `generate-intent`, `validate-intent`, `encrypt`, `decrypt`,
`calculate-risk`, `logs`, `dashboard-stats`) are unchanged in contract — same request/response
shapes. Everything below is additive:

- `register` optionally accepts `department`; role/privilege are always assigned by the
  server (`BANK_EMPLOYEE` / privilege 1) and never trusted from the client.
- `users` documents carry `role`, `department`, `privilege_level` fields alongside the
  original auth fields.
- `face-status`, `face-enroll`, `face-verify`, `users`, `verify-session` — unchanged from the
  prior CipherQ pass.
- `protected-records` (create/list) and `protected-records/<id>/context-check` / `/open` —
  the original peer-to-peer "Protected Record" workflow, unchanged.
- **New: the banking RBAC/privileged-access layer** — `rbac/catalog`, `rbac/validate`,
  `access-requests` (POST/GET), `soc/summary`, `soc/users` (see below).

No endpoint names or request/response contracts for the original ten routes changed.

## Persistence: MongoDB (not SQLite)

The storage layer was migrated from a local SQLite file (`quantum_cipher.db`) to MongoDB
(via PyMongo — see `db.py`). Every collection mirrors the previous table's shape 1:1 (same
field names, same relationships), so the rest of this document's description of routes and
behavior is otherwise unchanged. Collections:

| Collection | Was (SQLite table) | Primary key |
|---|---|---|
| `users` | `users` | integer `_id`, via `db.py`'s `next_id()` counter (reproduces AUTOINCREMENT) |
| `security_logs` | `security_logs` | integer `_id` |
| `messages` | `messages` | integer `_id` |
| `intents` | `intents` | `_id` = `session_id` (string, unchanged) |
| `face_enrollments` | `face_enrollments` | `_id` = `user_id` (unchanged 1-row-per-user shape) |
| `protected_records` | `protected_records` | integer `_id` |
| `access_requests` | `access_requests` | integer `_id` |
| `protected_resources` | `RESOURCE_SAMPLE_CONTENT` (hardcoded dict) | `_id` = resource key, e.g. `CUSTOMER_RECORDS` |
| `quantum_sessions` | *(new)* | integer `_id` — one document per `/api/generate-key` call (n_qubits, QBER, sifted bits, aborted, circuits_run, backend) |
| `counters` | *(new, internal)* | one document per ID sequence, used only by `next_id()` |

`RBAC_MATRIX`/`ROLES`/`RESOURCES`/`OPERATIONS` remain Python constants in `app.py` (policy-as-
code, reviewed like any other code change) — only the illustrative demo *content* shown after
an ALLOW decision moved into the `protected_resources` collection.

## Banking roles, resources, operations

```python
ROLES      = [BANK_EMPLOYEE, BRANCH_MANAGER, SECURITY_ANALYST, DATABASE_ADMIN, SYSTEM_ADMIN, AUDITOR]
RESOURCES  = [CUSTOMER_RECORDS, TRANSACTIONS, LOANS, TREASURY_DATA, AUDIT_RECORDS,
              DATABASE_EXPORT, SYSTEM_CONFIGURATION]
OPERATIONS = [VIEW, MODIFY, EXPORT, APPROVE, DELETE, ADMINISTER]
```

## RBAC matrix (role → resource → minimum privilege level per operation)

This lives in `RBAC_MATRIX` in `app.py` and is the single source of truth — `rbac_allowed()`
is called fresh on every `/api/rbac/validate` **and again, non-negotiably, inside
`/api/access-requests`** (the actual decision never trusts an earlier client-reported RBAC
check). A role/resource/operation combination absent from the matrix is always denied.

| Role | Resource | Operations (min. privilege) |
|---|---|---|
| BANK_EMPLOYEE | Customer Records | VIEW (1), MODIFY (2) |
| | Transactions | VIEW (1) |
| | Loans | VIEW (2) |
| BRANCH_MANAGER | Customer Records | VIEW (1), MODIFY (2), EXPORT (3) |
| | Transactions | VIEW (1), MODIFY (3), APPROVE (3) |
| | Loans | VIEW (2), MODIFY (3), APPROVE (3) |
| | Audit Records | VIEW (3) |
| | Treasury Data | VIEW (4) |
| SECURITY_ANALYST | Customer Records / Transactions | VIEW (2) |
| | Audit Records | VIEW (2), EXPORT (3) |
| | Treasury Data / System Configuration | VIEW (3) |
| DATABASE_ADMIN | Customer Records | VIEW (3), MODIFY (4), DELETE (4) |
| | Transactions | VIEW (3), DELETE (4) |
| | Database Export | VIEW (3), EXPORT (4), ADMINISTER (5) |
| | System Configuration | VIEW (3), MODIFY (4) |
| | Treasury Data | VIEW (4), EXPORT (5) |
| SYSTEM_ADMIN | System Configuration | VIEW (3), MODIFY (4), ADMINISTER (5), DELETE (5) |
| | Database Export | VIEW (3), EXPORT (4), ADMINISTER (5) |
| | Customer Records / Transactions / Loans / Audit Records | VIEW (3) |
| | Treasury Data | VIEW (4), ADMINISTER (5) |
| AUDITOR | Customer Records / Transactions / Loans | VIEW (2) — read-only |
| | Audit Records | VIEW (1), EXPORT (2) |
| | Treasury Data / System Configuration | VIEW (3) |

Auditors never appear with MODIFY/DELETE/APPROVE/ADMINISTER on any resource — by design.

## The privileged-access workflow, end to end

```
POST /api/rbac/validate        -> RBAC/Privilege Validation (fails fast, nothing else runs)
POST /api/generate-intent      -> bind business intent (same intent-hash mechanism as Secure Send)
POST /api/validate-intent      -> confirm the binding
POST /api/generate-key         -> real BB84 quantum key exchange (Qiskit Aer)
POST /api/calculate-risk       -> adaptive risk score
POST /api/face-verify          -> (used by the frontend to show pass/fail before finalizing)
POST /api/access-requests      -> AUTHORITATIVE finalize: re-checks RBAC, re-validates the
                                   intent/session binding, checks quantum abort + risk level,
                                   requires + re-verifies face identity, THEN issues ALLOW/DENY,
                                   persists the row, and logs the event.
```

`/api/access-requests` is deliberately the only place a decision is actually made — it repeats
every check rather than trusting the client's earlier calls, exactly like `_get_owned_record()`
already did for Protected Records.

## SOC (Security Operations Center) dashboard endpoints

Role-gated via a `require_role(*SOC_ROLES)` decorator (`SOC_ROLES = {SECURITY_ANALYST,
SYSTEM_ADMIN, DATABASE_ADMIN, AUDITOR}`) stacked under `@auth_required`:

- `GET /api/soc/summary` — total/allowed/denied access requests, breakdown by resource and by
  role, risk distribution, recent access requests, recent security events, total users.
- `GET /api/soc/users` — full user roster with role, department, privilege level, and face
  enrollment status.

Any other role gets a `403` from both, and the attempt is itself logged as
`unauthorized_endpoint_access_attempt`.

## Face identity model

Unchanged from the prior CipherQ pass — face **identity** verification (distinct from the
retained, non-authoritative expression-detection signal) uses face-api.js's pretrained
`FaceRecognitionNet`, a 128-dimension embedding model already bundled in
`frontend/public/models/`. The backend stores it and compares new descriptors with a
Euclidean distance threshold of `0.5` (`FACE_MATCH_THRESHOLD` in `app.py`). Every Access
Request and every Protected Record requires this check — no adaptive/optional path.

## Run

```bash
cd backend
cp .env.example .env        # then edit MONGODB_URI / JWT_SECRET as needed
pip install -r requirements.txt
python3 app.py
```

Server starts on **http://localhost:5000** (the frontend's `vite.config.js` already proxies
`/api` → `http://localhost:5000`). On startup, `init_indexes()` runs (idempotent — creates
Mongo indexes if missing) and the same idempotent seed functions used by `seed.py` run once
more (if `users`/`protected_resources` are already populated, nothing is inserted) — see the
root `README.md` for demo credentials and MongoDB Atlas setup. Data is stored in MongoDB
(local `mongodb://localhost:27017` by default, or Atlas — see `MONGODB_URI`), and persists
across backend restarts and across multiple backend instances, since it now lives in the
database rather than a single process-local file.

To seed (or re-seed) without starting the server:

```bash
python3 seed.py
```

## What it implements

| Endpoint | Description |
|---|---|
| `POST /api/register`, `/api/login` | Username/password auth, PBKDF2-HMAC-SHA256, JWT (24h). `/register` optionally accepts `department`; role/privilege are always server-assigned |
| `POST /api/generate-key` | Real BB84 quantum key exchange (Qiskit Aer) — see below |
| `POST /api/capture-face` | Logs a face-api.js detection result sent from the browser |
| `POST /api/generate-intent`, `/api/validate-intent` | SHA-256 intent hash bound to purpose/business-intent + receiver + device + session |
| `POST /api/encrypt`, `/api/decrypt` | AES-256-GCM, key = SHA-256(quantum_key + intent_hash + emotion) |
| `POST /api/calculate-risk` | Weighted risk score |
| `GET /api/logs`, `/api/dashboard-stats` | Security event log + aggregate stats (now includes role/department/privilege/SOC-authorized flag) |
| `GET /api/users`, `GET /api/verify-session` | Registered-user directory; session re-verification |
| `GET /api/face-status`, `POST /api/face-enroll`, `POST /api/face-verify` | Face identity enrollment/verification |
| `POST /api/protected-records`, `GET /api/protected-records`, `.../context-check`, `.../open` | Peer-to-peer Protected Record workflow (Secure Send / Received Records), unchanged |
| `GET /api/rbac/catalog` | Resource/operation catalog annotated with what the current user's role+privilege allows |
| `POST /api/rbac/validate` | RBAC/Privilege Validation step — logged as `rbac_validated`/`rbac_denied` |
| `POST /api/access-requests`, `GET /api/access-requests` | Finalize/list privileged access decisions |
| `GET /api/soc/summary`, `GET /api/soc/users` | SOC dashboard data — role-gated |

## Real Qiskit quantum backend

Unchanged — see `quantum_bb84.py`. `POST /api/generate-key` runs an actual quantum circuit;
`GET /api/quantum-info` (no auth) proves it (`qiskit_available`, `qiskit_version`,
`sample_circuit_diagram`). Requires `pip install qiskit qiskit-aer`. `quantum_bb84.py` itself
was **not modified** in this MongoDB migration pass — it has no database dependency at all
(it's a pure function of `n_qubits`/`eavesdrop_prob`) — so it carries over unchanged and its
correctness is inherited from the original codebase.

## How this pass was tested (and what you should still verify)

This sandbox had **no internet access**, so `pip install pymongo qiskit qiskit-aer` could not
actually run here, and no real MongoDB/Qiskit instance was reachable. To still exercise the
new database layer end-to-end rather than merely reading the code, every route in `app.py`
was run through Flask's in-process test client against a small, purpose-built in-memory
stand-in for the exact slice of the PyMongo API this project calls (`find_one`, `find`,
`insert_one`, `update_one`, `find_one_and_update`, `count_documents`, `aggregate`,
`create_index`) — never a mock of `app.py`'s own logic. That smoke test covered: registration
(including duplicate-username rejection), login, face enrollment/verification, intent
generation, RBAC catalog/validate, access-request ALLOW and DENY paths (bad privilege,
tampered intent hash, simulated quantum abort), SOC summary/users (and role-gating a
non-SOC role out with a 403), dashboard stats, encrypt/decrypt round-trip, and the full
Protected Record send → list → context-check → open flow. All of the above passed.

**What this does NOT prove**, and what you should verify yourself once you have real
packages/services available (see the root README's "Testing checklist"):
- That `pymongo`'s actual wire protocol behaves identically to the stand-in for every call
  shape used here (it's a faithful-enough shim for this app's usage, not a MongoDB
  reimplementation).
- That `qiskit`/`qiskit-aer` import and run correctly on your machine — `quantum_bb84.py`'s
  code path was not exercised in this sandbox at all (`QISKIT_AVAILABLE` was `False` here, so
  `/api/generate-key` genuinely 500'd exactly as designed, and the smoke test simply supplied
  its own `quantum_key_hex` string to exercise everything downstream of key generation).
- Behavior against a real MongoDB Atlas cluster (network latency, auth, TLS) — connect once
  with `MONGODB_URI` pointed at Atlas and re-run `python3 seed.py`, then `curl http://localhost:5000/health`, to
  confirm.
