"""
db.py — MongoDB connection, integer-ID counters, and index setup.
-------------------------------------------------------------------
Replaces the previous SQLite (`sqlite3`) storage layer with MongoDB via
PyMongo. Every collection keeps the SAME logical shape as the old SQLite
tables (same field names, same relationships) so the rest of the
application's logic — RBAC, intent binding, quantum key handling,
encryption, face verification, risk scoring — is completely unchanged.

Why integer `_id` instead of MongoDB's default ObjectId:
The frontend and REST contract (`GET /api/protected-records/<int:record_id>`,
JWT `sub` claims, `user.id` fields, etc.) all assume small sequential
integer IDs, exactly like the old SQLite AUTOINCREMENT columns. Rather than
touch that contract, `next_id()` below reproduces AUTOINCREMENT behavior
with an atomic Mongo counter document, and every collection stores its
primary key directly as an integer `_id` (or, for `intents`, the existing
string `session_id`, which was already the SQLite primary key).

Connection handling: PyMongo's MongoClient is thread-safe and pools
connections internally, so — unlike the old per-request `sqlite3.connect()`
— a single client is created lazily on first use and reused for the life
of the process. There is no per-request teardown to register.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

from pymongo import ASCENDING, MongoClient, ReturnDocument
from pymongo.errors import PyMongoError

# Always load .env from the same folder as this file
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_FILE)

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb://localhost:27017"
)

MONGODB_DB_NAME = os.getenv(
    "MONGODB_DB_NAME",
    "cipherq"
)

print(f"[CipherQ] Database: {MONGODB_DB_NAME}")

if MONGODB_URI.startswith("mongodb+srv://"):
    print("[CipherQ] Using MongoDB Atlas")
else:
    print("[CipherQ] Using Local MongoDB")

_client = None
_db = None

def get_client():
    """Lazily create (once) and return the shared MongoClient."""
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
    return _client


def get_db():
    """Return the shared database handle. Call this exactly like the old
    `get_db()` was called throughout app.py — the difference is callers now
    do `get_db().users.find_one(...)` etc. instead of raw SQL."""
    global _db
    if _db is None:
        _db = get_client()[MONGODB_DB_NAME]
    return _db


def ping():
    """Used by /health. Returns (ok: bool, detail: str). Never raises, and
    never includes the connection string or credentials in the detail
    string — only a short, safe status word."""
    try:
        get_client().admin.command("ping")
        return True, "connected"
    except PyMongoError:
        return False, "unreachable"
    except Exception:
        return False, "error"


def next_id(counter_name):
    """Atomic integer ID generator that reproduces SQLite's AUTOINCREMENT.
    Uses a single document per sequence name in the `counters` collection
    and an atomic `$inc`, which MongoDB guarantees is safe under concurrent
    callers (no separate locking needed)."""
    db = get_db()
    doc = db.counters.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc["seq"]


def init_indexes():
    """Idempotent — safe to call on every startup. Creates indexes only if
    they don't already exist; never touches or drops existing data."""
    db = get_db()
    db.users.create_index("username", unique=True)
    db.users.create_index("email", unique=True)
    db.protected_records.create_index([("sender_id", ASCENDING)])
    db.protected_records.create_index([("recipient_id", ASCENDING)])
    db.access_requests.create_index([("user_id", ASCENDING)])
    db.access_requests.create_index([("decision", ASCENDING)])
    db.security_logs.create_index([("_id", ASCENDING)])
    db.messages.create_index([("sender_id", ASCENDING)])
    db.messages.create_index([("receiver_id", ASCENDING)])
    db.quantum_sessions.create_index([("user_id", ASCENDING)])
