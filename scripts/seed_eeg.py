"""
Seed script: inserts fake users, care relationships, and EEG segments
(with random 384-dim embeddings) into the local Supabase instance.

Usage:
    pip install supabase numpy
    python scripts/seed_eeg.py
"""

import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env.local")

# ---------------------------------------------------------------------------
# Config — loaded from .env.local (see .env.example)
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

EMBEDDING_DIM = 384
CHUNK_DURATION_S = 30
DEVICE_ID = "eeg-device-demo-001"

# ---------------------------------------------------------------------------
# Demo users
# ---------------------------------------------------------------------------
PATIENTS = [
    {"display_name": "Margaret Chen", "email": "margaret@demo.local"},
    {"display_name": "Harold Müller", "email": "harold@demo.local"},
]
CAREGIVERS = [
    {"display_name": "Dr. Sarah Kim", "email": "sarah@demo.local"},
    {"display_name": "James Chen", "email": "james@demo.local"},
]


def random_embedding() -> list[float]:
    vec = np.random.randn(EMBEDDING_DIM).astype(np.float32)
    vec /= np.linalg.norm(vec)
    return vec.tolist()


def random_metrics(anomalous: bool = False) -> dict:
    if anomalous:
        return {
            "fatigue": round(random.uniform(0.7, 1.0), 3),
            "attention": round(random.uniform(0.0, 0.3), 3),
            "mood": round(random.uniform(0.0, 0.35), 3),
            "anomaly_score": round(random.uniform(0.75, 1.0), 3),
        }
    return {
        "fatigue": round(random.uniform(0.1, 0.55), 3),
        "attention": round(random.uniform(0.45, 0.9), 3),
        "mood": round(random.uniform(0.45, 0.9), 3),
        "anomaly_score": round(random.uniform(0.0, 0.35), 3),
    }


def create_auth_user(client: Client, email: str) -> str:
    """Create an auth user and return their UUID."""
    res = client.auth.admin.create_user(
        {"email": email, "password": "demo1234", "email_confirm": True}
    )
    return res.user.id


def seed_users(client: Client) -> tuple[list[str], list[str]]:
    patient_ids, caregiver_ids = [], []

    for p in PATIENTS:
        uid = create_auth_user(client, p["email"])
        client.table("users").insert(
            {"id": uid, "role": "patient", "display_name": p["display_name"]}
        ).execute()
        patient_ids.append(uid)
        print(f"  patient: {p['display_name']} ({uid})")

    for c in CAREGIVERS:
        uid = create_auth_user(client, c["email"])
        client.table("users").insert(
            {"id": uid, "role": "caregiver", "display_name": c["display_name"]}
        ).execute()
        caregiver_ids.append(uid)
        print(f"  caregiver: {c['display_name']} ({uid})")

    return patient_ids, caregiver_ids


def seed_care_relationships(
    client: Client, patient_ids: list[str], caregiver_ids: list[str]
) -> None:
    for pid in patient_ids:
        for cid in caregiver_ids:
            client.table("care_relationships").insert(
                {"caregiver_id": cid, "patient_id": pid, "relationship": "clinician"}
            ).execute()


def seed_eeg_segments(
    client: Client,
    patient_ids: list[str],
    recording_minutes: int = 20,
    anomaly_rate: float = 0.1,
) -> list[str]:
    """Insert one recording worth of EEG segments per patient."""
    segment_ids = []
    n_chunks = (recording_minutes * 60) // CHUNK_DURATION_S
    now = datetime.now(timezone.utc)

    for pid in patient_ids:
        # Recording started `recording_minutes` ago
        start = now - timedelta(minutes=recording_minutes)
        rows = []
        for i in range(n_chunks):
            ts = start + timedelta(seconds=i * CHUNK_DURATION_S)
            anomalous = random.random() < anomaly_rate
            row = {
                "id": str(uuid.uuid4()),
                "patient_id": pid,
                "device_id": DEVICE_ID,
                "timestamp_start": ts.isoformat(),
                "duration_s": CHUNK_DURATION_S,
                **random_metrics(anomalous),
                "embedding": random_embedding(),
            }
            rows.append(row)

        # Insert in batches of 20 to stay well under payload limits
        batch_size = 20
        for batch_start in range(0, len(rows), batch_size):
            batch = rows[batch_start : batch_start + batch_size]
            res = client.table("eeg_segments").insert(batch).execute()
            segment_ids.extend(r["id"] for r in res.data)

        print(f"  inserted {n_chunks} EEG segments for patient {pid}")

    return segment_ids


def main() -> None:
    print("Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("\nSeeding users...")
    patient_ids, caregiver_ids = seed_users(client)

    print("\nSeeding care relationships...")
    seed_care_relationships(client, patient_ids, caregiver_ids)

    print("\nSeeding EEG segments (20 min recording, ~10% anomalous)...")
    seed_eeg_segments(client, patient_ids, recording_minutes=20, anomaly_rate=0.1)

    print("\nDone.")
    print("\nDemo credentials (password: demo1234):")
    for p in PATIENTS:
        print(f"  patient   {p['email']}")
    for c in CAREGIVERS:
        print(f"  caregiver {c['email']}")


if __name__ == "__main__":
    main()
