"""
seed.py — Idempotent demo-data seeding for CipherQ / FinSpark.
-----------------------------------------------------------------
Run directly for a one-off/CI seed:

    python seed.py

It is ALSO imported and called automatically by `app.py` on startup
(`python app.py`), exactly mirroring the original SQLite prototype's
"seed once, only if empty" behavior — the same idempotent functions are
used either way, so running `python seed.py` again later (e.g. after
manually clearing a demo user) never duplicates or overwrites existing
data. Safe to run against a fresh MongoDB Atlas cluster or an existing one.

Seeds:
  1. Six demo banking users (one per role) — passwords hashed with the
     exact same PBKDF2-HMAC-SHA256 scheme as normal /api/register, so
     nothing about auth is bypassed or weakened for these accounts.
  2. The Protected Resource catalog (display label + illustrative demo
     content shown only after a real ALLOW decision) — previously a
     hardcoded Python dict, now dynamic Mongo documents so it can be
     edited/extended without a code deploy.

Face identity is intentionally NOT pre-enrolled for demo users (a real
biometric embedding can't be seeded) — each demo user enrolls their own
face once from Account & Security, exactly like a real user would.
"""
import hashlib
import os
import secrets
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from db import get_db, init_indexes, next_id

DEMO_USERS = [
    {"username": "alice.employee", "email": "alice.employee@finspark.bank", "password": "Bank@Emp123",
     "role": "BANK_EMPLOYEE", "designation": "Bank Employee", "department": "Retail Banking", "privilege_level": 1},
    {"username": "raj.manager", "email": "raj.manager@finspark.bank", "password": "Bank@Mgr123",
     "role": "BRANCH_MANAGER", "designation": "Branch Manager", "department": "Retail Banking", "privilege_level": 3},
    {"username": "priya.security", "email": "priya.security@finspark.bank", "password": "Bank@Sec123",
     "role": "SECURITY_ANALYST", "designation": "Security Analyst", "department": "Cyber Security", "privilege_level": 3},
    {"username": "vikram.dba", "email": "vikram.dba@finspark.bank", "password": "Bank@Dba123",
     "role": "DATABASE_ADMIN", "designation": "Database Administrator", "department": "IT Operations", "privilege_level": 4},
    {"username": "neha.sysadmin", "email": "neha.sysadmin@finspark.bank", "password": "Bank@Sys123",
     "role": "SYSTEM_ADMIN", "designation": "System Administrator", "department": "IT Operations", "privilege_level": 5},
    {"username": "karan.auditor", "email": "karan.auditor@finspark.bank", "password": "Bank@Aud123",
     "role": "AUDITOR", "designation": "Auditor", "department": "Internal Audit", "privilege_level": 2},
]

# Same catalog previously hardcoded as RESOURCE_SAMPLE_CONTENT in app.py.
# `key` becomes the Mongo `_id` (and is what RBAC_MATRIX / RESOURCES in
# app.py refer to) — non-sensitive, illustrative content only.
PROTECTED_RESOURCES = [
    {"key": "CUSTOMER_RECORDS", "label": "Customer Records",
     "sample_content": "Customer #CU-88213 — Name: R. Kapoor — KYC: Verified — Segment: Retail Priority"},
    {"key": "TRANSACTIONS", "label": "Transactions",
     "sample_content": "TXN-550231 — Debit \u20b942,500.00 — NEFT to A/C ****9081 — Status: Settled"},
    {"key": "LOANS", "label": "Loans",
     "sample_content": "Loan #LN-30442 — Type: Home Loan — Principal: \u20b932,00,000 — Stage: Underwriting"},
    {"key": "TREASURY_DATA", "label": "Treasury Data",
     "sample_content": "Treasury Position — O/N Repo Book: \u20b9212Cr — VaR (1d, 99%): \u20b91.8Cr"},
    {"key": "AUDIT_RECORDS", "label": "Audit Records",
     "sample_content": "Audit Trail #AUD-9931 — Actor: SYS — Action: quarterly-recon — Result: No exceptions"},
    {"key": "DATABASE_EXPORT", "label": "Database Export",
     "sample_content": "Export Manifest — Table: customer_accounts — Rows: 128,004 — Format: encrypted CSV"},
    {"key": "SYSTEM_CONFIGURATION", "label": "System Configuration",
     "sample_content": "Config Key: session.timeout_minutes — Current Value: 15 — Environment: production"},
]


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000).hex()


def seed_demo_users():
    """Insert any demo user not already present by username. Never
    overwrites or duplicates an existing account."""
    db = get_db()
    created = 0
    for u in DEMO_USERS:
        if db.users.find_one({"username": u["username"]}):
            continue
        salt = secrets.token_hex(16)
        pw_hash = hash_password(u["password"], salt)
        uid = next_id("users")
        db.users.insert_one({
            "_id": uid,
            "username": u["username"],
            "email": u["email"],
            "password_hash": pw_hash,
            "salt": salt,
            "role": u["role"],
            "designation": u["designation"],
            "department": u["department"],
            "privilege_level": u["privilege_level"],
            "created_at": datetime.utcnow().isoformat() + "Z",
        })
        created += 1
    if created:
        print(f"[CipherQ] Seeded {created} demo banking user(s) (see README.md for credentials).")
    else:
        print("[CipherQ] Demo users already present — nothing to seed.")
    return created


def seed_protected_resources():
    """Upsert the Protected Resource catalog. Uses $setOnInsert so an
    already-seeded resource is never overwritten even if the demo content
    in this file changes later — edit existing docs directly in Mongo (or
    drop just that document) if you want a refreshed sample."""
    db = get_db()
    created = 0
    for r in PROTECTED_RESOURCES:
        result = db.protected_resources.update_one(
            {"_id": r["key"]},
            {"$setOnInsert": {
                "_id": r["key"],
                "key": r["key"],
                "label": r["label"],
                "sample_content": r["sample_content"],
            }},
            upsert=True,
        )
        if result.upserted_id is not None:
            created += 1
    if created:
        print(f"[CipherQ] Seeded {created} protected resource definition(s).")
    else:
        print("[CipherQ] Protected resource catalog already present — nothing to seed.")
    return created


def run_seed():
    init_indexes()
    seed_demo_users()
    seed_protected_resources()


if __name__ == "__main__":
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
    # Never print the full URI (it may embed credentials) — just confirm a
    # target is configured.
    print(f"[CipherQ] Seeding database '{os.environ.get('MONGODB_DB_NAME', 'cipherq_finspark')}'"
          f"{' (using MONGODB_URI from environment)' if 'MONGODB_URI' in os.environ else ' (using local default mongodb://localhost:27017)'}...")
    run_seed()
    print("[CipherQ] Seed complete.")
