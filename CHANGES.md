# Changes made to reach the final CipherQ banking security application

This documents the full history of edits from the original Intent-Bound Quantum Encryption
project, across six passes: an initial FinTech rebrand, a correction pass that consolidated
the result into one coherent banking workflow, a bugfix/UX pass, a mutual face-verification
pass, a "make the quantum step visible" pass, and this delivery — reframing the app as a
FinSpark-aligned banking privileged-access security platform.

## Enterprise UI/UX redesign pass (in progress — this delivery)

**Goal:** restyle the frontend into a premium enterprise banking look (in the spirit of Okta,
Microsoft Entra, and Stripe Dashboard), without touching backend logic, APIs, auth, RBAC,
routing, database interactions, or any working feature. Working page-by-page; each page below
is a completed, self-contained edit.

- **Landing page rebuilt** (`LandingPage.jsx` + `globals.css`). Replaced the dark navy
  gradient/particle hero with a light theme: a top nav bar, a centered hero with a subtle
  animated gradient mesh and faint grid background, floating stat cards drawn from the
  project's own real numbers (6 roles, 7×6 resource/operation matrix, 256-qubit BB84 exchange,
  AES-256-GCM), a six-step workflow visualization that mirrors the app's actual RBAC → intent →
  quantum → risk → face-identity pipeline, the existing "insider threat / CipherQ approach"
  copy restyled as light pillar cards, a dark closing CTA band, and a footer. No new routes or
  buttons — every CTA calls the same `navigate("dashboard"|"login"|"register")` used before.
- **Login / register page rebuilt** (`AuthPage.jsx` + `globals.css`). Replaced the single
  glass card on a gradient background with an Okta/Entra-style split layout: a dark left panel
  (brand, a plain-language description of the real security pipeline, and technical badges —
  AES-256-GCM, BB84 Quantum-Safe, RBAC Enforced, Face Verified — reflecting actual features,
  not invented compliance certifications) and a clean white form panel on the right. All form
  fields, validation, the face-enrollment follow-up step, and API calls are unchanged.
- No backend files touched. No new npm dependencies (`lucide-react`, already a dependency, is
  the only icon source used). Not yet build-verified against a live `npm run dev` — this
  sandbox has no network access to run `npm install`; please sanity-check visually before
  presenting.
- **Still to do:** Dashboard, SOC Dashboard, Access Request, Secure Send, Received Records,
  Security Activity, Account & Security, Sidebar/Header chrome, tables/charts styling pass,
  and a final responsiveness/empty-state/loading-skeleton review.

## FinSpark banking privileged-access pass

**Goal:** reframe CipherQ from a peer-to-peer protected-record app into a banking
privileged-access security platform, without rebuilding it, changing the tech stack, or
breaking the existing intent-binding / BB84-Qiskit / AES-256-GCM / risk-scoring / face-identity
/ protected-record features.

- **Banking roles added to `users`.** Three new columns — `role`, `department`,
  `privilege_level` — added via a migration-safe `PRAGMA table_info` + `ALTER TABLE` (only if
  missing; never touches or drops existing rows/columns). Six roles: `BANK_EMPLOYEE`,
  `BRANCH_MANAGER`, `SECURITY_ANALYST`, `DATABASE_ADMIN`, `SYSTEM_ADMIN`, `AUDITOR`. Privilege
  level is 1 (lowest) to 5 (highest), independent of role. Self-registration always assigns
  `BANK_EMPLOYEE` / privilege 1 server-side — a person can never elevate their own role by
  sending `role`/`privilege_level` in the register payload (verified in the smoke test).
- **Backend-enforced RBAC.** New `RBAC_MATRIX` (role → resource → {operation: minimum
  privilege}) and `rbac_allowed()` in `app.py`. A role/resource/operation combination absent
  from the matrix is always denied, and privilege level is a second independent gate on top
  of role. This is checked twice for every real access decision: once at
  `POST /api/rbac/validate` (fails the workflow fast, before intent/quantum/risk work begins),
  and again — authoritatively, never trusting the earlier client call — inside
  `POST /api/access-requests` itself.
- **Seven protected banking resources, six operations.** `CUSTOMER_RECORDS`, `TRANSACTIONS`,
  `LOANS`, `TREASURY_DATA`, `AUDIT_RECORDS`, `DATABASE_EXPORT`, `SYSTEM_CONFIGURATION` ×
  `VIEW`, `MODIFY`, `EXPORT`, `APPROVE`, `DELETE`, `ADMINISTER`.
- **New workflow: Login → Select Protected Resource → Select Operation → Enter Business
  Intent → RBAC/Privilege Validation → Existing Intent/Risk/Quantum Security Flow → Allow or
  Deny → Log Event.** Implemented as the new `AccessRequestPage.jsx` (primary nav item),
  calling (in order) `verify-session` (existing), `rbac/validate` (new), `generate-intent`
  (existing, `purpose` = the declared business intent), `validate-intent` (existing),
  `generate-key` (existing, real BB84/Qiskit — paused on the existing `QuantumKeyPanel`),
  `calculate-risk` (existing), `face-verify` (existing) for user feedback, then
  `POST /api/access-requests` (new) as the single authoritative finalize step: it re-checks
  RBAC, re-validates the intent/session binding against the `intents` table, checks for a
  quantum abort or a HIGH risk level, re-verifies face identity server-side, and only then
  issues ALLOW/DENY, persists the row to a new `access_requests` table, and logs the event.
  On ALLOW, the demo resource content is "revealed" (VIEW/EXPORT) or a simulated confirmation
  is returned (MODIFY/APPROVE/DELETE/ADMINISTER) — reusing the *exact same*
  `derive_key()`/AES-256-GCM primitive as `/api/encrypt` and `/api/protected-records`, so
  nothing about the cryptography was reimplemented.
- **Existing security features fully preserved and integrated, not replaced:**
  authentication (PBKDF2-HMAC-SHA256 + JWT), intent binding (SHA-256 hash), BB84/Qiskit
  quantum key exchange, AES-256-GCM encryption, mandatory face identity verification, adaptive
  risk scoring, the original peer-to-peer Protected Records (Secure Send / Received Records,
  completely unchanged), and the security event log all continue to work exactly as before —
  verified in an extended smoke test (see below) that exercises both the old and new
  endpoints in the same run.
- **SOC (Security Operations Center) dashboard.** New `SOCDashboardPage.jsx`, visible in the
  navbar only for `SECURITY_ANALYST` / `SYSTEM_ADMIN` / `DATABASE_ADMIN` / `AUDITOR` (checked
  again server-side — `GET /api/soc/summary` and `GET /api/soc/users` return `403` for any
  other role even if called directly, and the attempt is logged as
  `unauthorized_endpoint_access_attempt`). Shows bank-wide access requests and their
  allow/deny decisions, breakdowns by resource and by role, risk-score distribution, the full
  user/role/department/privilege roster with face-enrollment status, and recent security
  events.
- **Realistic seeded demo users.** `seed_demo_users()` runs once, only if `users` is empty,
  creating one account per role (`alice.employee`, `raj.manager`, `priya.security`,
  `vikram.dba`, `neha.sysadmin`, `karan.auditor`) with realistic FinSpark departments and
  varying privilege levels, hashed with the exact same PBKDF2 path as normal registration. Face
  identity is intentionally left unenrolled for these accounts (a real biometric embedding
  can't be seeded) — each enrolls once from Account & Security, same as any real user.
- **Frontend:** new `AccessRequestPage.jsx` (resource tiles + operation chips annotated with
  required privilege + business-intent textarea + the same live pipeline visualization used
  by Secure Send) and `SOCDashboardPage.jsx`; `Navbar.jsx` gained an "Access Request" link and
  a role-gated "SOC Dashboard" link, plus a role chip next to the user's name; `Dashboard.jsx`
  gained an Access Request card (now the primary "Start here" card), a SOC Dashboard card for
  authorized roles, and role/department/privilege display; `AuthPage.jsx` gained an optional
  Department field and a note that new accounts are Bank Employee/privilege 1;
  `AccountSecurityPage.jsx` now shows role/department/privilege level; `LandingPage.jsx` copy
  updated to the FinSpark banking privileged-access framing (design/layout unchanged).
  `api.js` gained thin wrappers for every new endpoint. A handful of new CSS rules (resource
  tiles, operation chips, role chip) were appended to `globals.css` — no existing rules were
  changed or removed.
- **No new npm or pip dependencies were introduced.** `quantum_bb84.py` was not modified.
- **Tested:** a 35-check backend smoke test (Flask test client, in-process) covering: login
  for all six seeded roles; rejecting a bad password; self-registration defaulting to
  `BANK_EMPLOYEE`/privilege 1 and rejecting an attempted role/privilege override in the
  payload; the RBAC catalog; RBAC validation for an allowed case, a role-disallowed case, and
  a privilege-insufficient case for two different roles; a full ALLOW pipeline run
  (intent → quantum → risk → face → access-requests) for an authorized System Admin request;
  the same pipeline denied on a face mismatch; an RBAC denial that still completes intent/
  quantum/risk/face correctly but is denied at the authoritative re-check; SOC dashboard role
  gating (allowed for Security Analyst/Auditor, denied for Bank Employee/Branch Manager); and
  — critically — that the pre-existing users directory, Protected Record creation,
  context-check, open (GRANTED), logs, dashboard-stats, and the no-auth `/api/quantum-info`
  endpoint all still work unmodified. All 35 checks passed. `qiskit`/`qiskit-aer` could not be
  installed in the sandbox this was built in (no internet access there); the test stubs only
  `simulate_bb84_qiskit()`'s return value for the test process, never any shipped code — real
  Qiskit should be verified on your own machine per the README's instructions.

## Visible Quantum Key Distribution pass

The BB84 quantum key exchange was real (see `backend/quantum_bb84.py`) but was invisible in
the UI — it was one pipeline dot that flipped from active to pass in well under a second, so
it was easy to miss entirely, especially in a live demo.

- **New `QuantumKeyPanel.jsx`** now pauses the Secure Send flow right after the quantum key
  stage and displays the *actual* `POST /api/generate-key` response: qubits transmitted (256),
  quantum circuits executed, sifted key bits kept, measured QBER (as a labeled bar against the
  11% abort threshold), the simulator backend name, and a truncated preview of the derived key
  — every number is real, not decorative. The user must click "Continue" to proceed, so the
  step can't be missed.
- **"Show proof this is a real Qiskit circuit"** expander fetches `GET /api/quantum-info` (no
  auth required, already existed in the backend) and displays the live Qiskit version, the
  simulator name, and an ASCII diagram of a real sample BB84 round circuit — so a technically
  skeptical viewer can verify it isn't a mock.
- If the exchange aborts (QBER over threshold), the panel still shows the real numbers and the
  measured QBER in red, with a clear "possible eavesdropping detected" verdict, before the user
  acknowledges and the send is blocked — rather than skipping straight to a generic block
  screen.
- New `GET /api/quantum-info` API wrapper (`getQuantumInfo`) added to `services/api.js`.

## Mutual face-verification pass

Face identity verification was adaptive (only triggered for MEDIUM/HIGH risk records) — this
pass makes it a **mandatory, symmetric part of every Protected Record**, enforced server-side
in both directions:

- **Sending now requires the sender to verify their own face identity, server-side, every
  time** — not just for high-risk transfers. `POST /api/protected-records` now requires a
  `sender_embedding` in the request and independently compares it against the sender's own
  enrolled template (`face_enrollments` for `g.user_id`) before creating the record. If the
  sender has no face enrolled → `403 face_enrollment_required`. If no embedding is sent →
  `403 face_verification_required`. If the face doesn't match → `403` with a `face_mismatch`
  security-log entry. This is a real backend authorization check — not just a frontend gate —
  matching the same pattern already used for `receiver_id` authorization on `/open`.
- **`requires_face_verification` is now always `1`** for every created record, regardless of
  `risk_level` (previously only `1` for MEDIUM/HIGH). The recipient must verify their face for
  every record they open, not only flagged ones. `risk_level`/`risk_score` are still computed
  and stored for display/audit, just no longer gate whether identity verification is required.
- **`SecureSendPage.jsx`** now always routes through a face-capture step after risk evaluation
  (previously only when `risk.level === "HIGH"`), and passes the resulting descriptor through
  to `createProtectedRecord` as `sender_embedding`.
- Copy updated throughout (Dashboard, Account & Security, registration, Secure Send, Received
  Records, README) from "adaptive"/"high-risk" framing to "mandatory, both directions."
- Verified with an extended backend smoke test: unenrolled sender blocked, enrolled sender
  without an embedding blocked, enrolled sender with someone else's face blocked, enrolled
  sender with their own face succeeds; recipient opening a LOW-risk record without a face
  embedding is now also denied, and opening with the correct face succeeds. All passed.

## Bugfix / UX pass

- **Fixed: the Capture button in face verification/enrollment never responded to clicks.**
  Root cause: the live-detection loop in `FaceCapture.jsx` used
  `if (!videoRef.current || videoRef.current.paused) return;` as its very first line. If the
  video element was ever momentarily paused — routine right after
  `getUserMedia`/`video.play()` — that `return` exited the loop *without rescheduling the next
  animation frame*, permanently freezing detection. `liveExpr` then never updated again, so
  the Capture button (which requires `liveExpr` to be non-null) stayed disabled forever. Fixed
  by checking `video.readyState`/`paused` per frame *without* ever letting the loop die —
  frames are skipped, not abandoned. Also added a 6-second "still not detecting a face?" hint
  with a one-click camera restart, and hardened the detector threshold.
- **Secure Send now re-verifies the registered user at the start of every send**, not only via
  JWT signature. New `GET /api/verify-session` (backend, additive) checks that the token's
  user ID still corresponds to a real row in `users` and logs `session_verified` /
  `session_verification_failed`. This is now literally the first stage of the Secure Send
  pipeline ("Verifying Registered User"), before intent binding — closing the gap where a
  structurally-valid JWT could outlive the account it names. Intent verification itself was
  already enforced (intent hash checked against its session both at record creation and at
  open time); this pass makes the registered-user check equally explicit and equally early.
- **Recipient dropdown hardened.** It's a real `<select>`, but previously gave no feedback
  while loading and no explanation when empty. Now shows a loading state, a retry-able error
  state, and — if there are genuinely no other registered users yet — a clear explanation plus
  a one-click refresh, instead of silently looking broken.
- **Declared Purpose / Intent is now a dropdown** of common banking purposes (fund transfer,
  account statement, loan document, bill payment, KYC document, invoice settlement, payroll,
  insurance claim) with an "Other (specify below)" option that reveals a free-text field —
  giving users more structured choices while still allowing a custom purpose.

## Correction pass — consolidation

**Problem addressed:** the first rebrand pass redesigned the frontend but kept the original
project's five independent pages (encrypt, decrypt, face, security dashboard, history) as
five separate dashboard cards/nav items — functionally a FinTech coat of paint over the
original demo modules, not one coherent product, and still required manually copying
ciphertext/nonce/tag/key/hash between an "encrypt" and a "decrypt" page.

**What changed:**

- **Navigation collapsed from 6 items to 5, matching the requested structure:** Dashboard,
  Secure Send, Received Records, Security Activity, Account & Security. Encryption,
  decryption, intent hashing, QKD and face embeddings are no longer separate menu items —
  they're the mechanisms behind Secure Send and Received Records.
- **New Protected Record concept (backend, additive):**
  - Two new tables — `protected_records`, `face_enrollments` — added via `CREATE TABLE IF NOT
    EXISTS` in `init_db()`. No existing table was altered or dropped.
  - New endpoints: `GET /api/users` (recipient directory), `GET/POST /api/face-status`,
    `/api/face-enroll`, `/api/face-verify`, `POST /api/protected-records` (create),
    `GET /api/protected-records` (list, `?box=received|sent`),
    `POST /api/protected-records/<id>/context-check`, `POST /api/protected-records/<id>/open`.
  - These reuse the **exact same** `derive_key()` and AES-256-GCM primitive as the original
    `/api/encrypt`/`/api/decrypt` — the cryptography was not reimplemented or weakened, only
    wrapped so the frontend no longer manually shuttles ciphertext/nonce/tag/key/hash between
    pages.
  - The original `/api/encrypt`, `/api/decrypt`, `/api/generate-intent`, `/api/validate-intent`,
    `/api/generate-key`, `/api/calculate-risk`, `/api/register`, `/api/login`, `/api/logs`,
    `/api/dashboard-stats` endpoints are **unchanged in contract** from the original project
    (the one addition — `/api/register` now optionally accepts `face_embedding` — is
    backward compatible; omitting it behaves exactly as before).
  - Authorization is enforced server-side: `_get_owned_record()` checks `recipient_id` against
    the authenticated user for every record fetch, regardless of what ID is requested in the
    URL — tested explicitly (see below).
- **Face expression analysis reframed and demoted.** The original expression detection
  (neutral/happy/angry/etc.) is retained only as an internal, clearly-labeled "experimental
  behavioral signal" inside the live camera overlay — it is never used to grant or deny
  access on its own. The **primary** face security feature is now **face identity
  verification**: a 128-d embedding from face-api.js's pretrained `FaceRecognitionNet`
  (already bundled in `frontend/public/models/`; no new model was trained or added),
  enrolled once and compared by Euclidean distance (threshold 0.5) whenever a Protected
  Record is flagged MEDIUM/HIGH risk. This is the "adaptive step-up verification" model:
  normal-risk actions only need password + intent/context checks; high-risk actions
  additionally require a face identity match.
- **Removed pages/components** that existed only to demo the underlying mechanisms in
  isolation: `TransactionPage.jsx`, `DecryptPage.jsx`, `FacePage.jsx`,
  `TransactionHistoryPage.jsx`, `SecurityDashboard.jsx`, and the now-unused `GlowCard.jsx`,
  `StatusBadge.jsx`, `CopyBox.jsx`, `useEncryption.js`. Their genuinely useful parts were
  folded into the five pages above: `SecurityDashboard`'s real charts and log table now live
  in `SecurityActivityPage.jsx` (its standalone "risk calculator" playground was dropped as
  disconnected from the linear workflow); `TransactionHistoryPage`'s log-derived record view
  is now the "Sent" tab of `ReceivedRecordsPage.jsx`; the three separate camera
  implementations were consolidated into one reusable `FaceCapture.jsx`.
- **New pages:** `SecureSendPage.jsx`, `ReceivedRecordsPage.jsx`, `SecurityActivityPage.jsx`,
  `AccountSecurityPage.jsx`.
- **Terminology pass:** removed "Encrypt Message" / "Decrypt Message" / "Copy Ciphertext" /
  "Generate Quantum Key" as user-facing labels; replaced with "Secure Send" / "Protected
  Record" / "Open Secure Record" / "Access Granted" / "Access Denied" throughout.
- **Backend tested end-to-end** with an in-process Flask test-client smoke test covering:
  registration with and without face enrollment, the recipient directory, intent
  generation/validation, protected-record creation, a third user (`eve`) attempting to access
  a record that isn't hers (403, logged as `unauthorized_record_access_attempt`), opening
  without a required face embedding (denied), opening with a wrong embedding (denied, record
  blocked), opening with the correct embedding (granted, plaintext recovered), a tampered
  `intent_hash` (context check correctly reports `context_valid: false`, subsequent open
  denied), dashboard stats aggregation, and `face-status`/`face-verify`. All passed.

## Original rebrand pass — for reference

- Frontend design system replaced with a navy/teal banking palette (Space Grotesk / Inter /
  JetBrains Mono).
- `backend/app.py`'s `/api/encrypt` and `/api/calculate-risk` gained optional
  `recipient_name`/`amount`/`purpose` fields for logging (superseded by the Protected Record
  fields above, but left in place since other code paths still call these endpoints directly
  and the fields are optional/backward compatible).
