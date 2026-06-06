"""
Seed script: inserts demo users, care relationships, and EEG segments derived
from the real sub-001 recording in `data/` into the local Supabase instance.

Each 30s window is processed with the SAME pipeline the live daemon uses:
  - embedding  -> real foundation model (neuroencoder MRL, 384-d) via backend.ml
  - metrics    -> pipeline.band_power (Welch band powers + SessionNormalizer)
  - anomaly    -> pipeline.embedding.run_anomaly_detection (cosine drift)
so seeded data lives in the exact same embedding space as live + trajectory data.

This script is idempotent: running it twice updates existing users in place and
replaces their eeg_segments.

Usage:
    uv run python scripts/seed_eeg.py
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import mne
import numpy as np
from dotenv import load_dotenv
from supabase import Client, create_client

# Make repo-root packages importable (appended, so the repo's local `supabase/`
# config dir never shadows the installed `supabase` package in site-packages).
sys.path.append(str(Path(__file__).parent.parent))
from backend.ml import EEGEmbedder
from pipeline.band_power import SessionNormalizer, compute_band_powers
from pipeline.embedding import run_anomaly_detection

load_dotenv(Path(__file__).parent.parent / ".env.local")

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

EMBEDDING_DIM = 384
CHUNK_DURATION_S = 30
DEVICE_ID = "eeg-device-demo-001"
EEG_FILE = Path(__file__).parent.parent / "data" / "sub-001_task-eyesclosed_eeg.set"

PATIENTS = [
    {"display_name": "Margaret Chen", "email": "margaret@demo.local"},
    {"display_name": "Harold Müller", "email": "harold@demo.local"},
]
CAREGIVERS = [
    {"display_name": "Dr. Sarah Kim", "email": "sarah@demo.local"},
    {"display_name": "James Chen", "email": "james@demo.local"},
]


# ---------------------------------------------------------------------------
# EEG -> segments (real embedder + shared pipeline metrics)
# ---------------------------------------------------------------------------
def load_recording() -> tuple[np.ndarray, float, list[str]]:
    print(f"Loading EEG from {EEG_FILE.name}...")
    raw = mne.io.read_raw_eeglab(str(EEG_FILE), preload=True, verbose="ERROR")
    return raw.get_data(), float(raw.info["sfreq"]), list(raw.ch_names)


def build_segments_for_recording(
    data: np.ndarray, sfreq: float, ch_names: list[str]
) -> list[dict]:
    """Slice into non-overlapping 30s windows; compute real embedding + metrics
    + anomaly per window using the shared pipeline."""
    spw = int(sfreq * CHUNK_DURATION_S)
    n = data.shape[1] // spw
    windows = np.stack([data[:, i * spw : (i + 1) * spw] for i in range(n)]).astype(np.float32)
    print(f"  recording: {data.shape[1] / sfreq:.1f}s @ {sfreq:g}Hz -> {n} windows")

    print("  embedding windows with foundation model...")
    emb = EEGEmbedder(dim=EMBEDDING_DIM).embed(windows, sfreq=sfreq, channel_names=ch_names)

    # Band-power metrics, normalized per session (same primitives as the daemon).
    normalizer = SessionNormalizer(baseline_s=120.0, stride_s=CHUNK_DURATION_S)
    raw_metrics = [compute_band_powers(windows[i], sfreq) for i in range(n)]
    for rm in raw_metrics:
        normalizer.update(rm)

    history: list[np.ndarray] = []
    segments = []
    for i in range(n):
        m = normalizer.normalize(raw_metrics[i])
        anomaly = run_anomaly_detection(emb[i], history)
        history.append(emb[i])
        segments.append({
            "duration_s": CHUNK_DURATION_S,
            "embedding": emb[i].astype(float).tolist(),
            "fatigue": round(m["fatigue"], 3),
            "attention": round(m["attention"], 3),
            "mood": round(m["mood"], 3),
            "anomaly_score": round(float(anomaly), 3),
            "_window_index": i,
        })
    return segments


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------
def get_or_create_user(client: Client, email: str, display_name: str, role: str) -> str:
    """Idempotent: returns the user's UUID, creating if needed."""
    page = 1
    while True:
        users = client.auth.admin.list_users(page=page, per_page=200)
        if not users:
            break
        for u in users:
            if u.email == email:
                client.table("users").upsert(
                    {"id": u.id, "role": role, "display_name": display_name}
                ).execute()
                return u.id
        if len(users) < 200:
            break
        page += 1

    res = client.auth.admin.create_user(
        {"email": email, "password": "demo1234", "email_confirm": True}
    )
    uid = res.user.id
    client.table("users").upsert(
        {"id": uid, "role": role, "display_name": display_name}
    ).execute()
    return uid


def seed_care_relationships(
    client: Client, patient_ids: list[str], caregiver_ids: list[str]
) -> None:
    for pid in patient_ids:
        for cid in caregiver_ids:
            client.table("care_relationships").upsert(
                {"caregiver_id": cid, "patient_id": pid, "relationship": "clinician"}
            ).execute()


def reset_segments_for(client: Client, patient_id: str) -> None:
    client.table("eeg_segments").delete().eq("patient_id", patient_id).execute()


def insert_segments(client: Client, segments: list[dict]) -> None:
    batch_size = 20
    for batch_start in range(0, len(segments), batch_size):
        batch = segments[batch_start : batch_start + batch_size]
        client.table("eeg_segments").insert(batch).execute()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    if not EEG_FILE.exists():
        raise FileNotFoundError(f"Expected EEG file at {EEG_FILE}. See data/README.md.")

    data, sfreq, ch_names = load_recording()
    print(f"  {len(ch_names)} channels: {', '.join(ch_names)}")
    base_segments = build_segments_for_recording(data, sfreq, ch_names)

    print("\nConnecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("\nSeeding users...")
    patient_ids = [get_or_create_user(client, p["email"], p["display_name"], "patient") for p in PATIENTS]
    caregiver_ids = [get_or_create_user(client, c["email"], c["display_name"], "caregiver") for c in CAREGIVERS]
    for p, pid in zip(PATIENTS, patient_ids):
        print(f"  patient: {p['display_name']} ({pid})")
    for c, cid in zip(CAREGIVERS, caregiver_ids):
        print(f"  caregiver: {c['display_name']} ({cid})")

    print("\nSeeding care relationships...")
    seed_care_relationships(client, patient_ids, caregiver_ids)

    print("\nSeeding EEG segments (real sub-001 recording, shared between both patients)...")
    now = datetime.now(timezone.utc)
    start = now - timedelta(seconds=len(base_segments) * CHUNK_DURATION_S)
    for pid in patient_ids:
        reset_segments_for(client, pid)
        rows = [
            {
                "patient_id": pid,
                "device_id": DEVICE_ID,
                "timestamp_start": (start + timedelta(seconds=seg["_window_index"] * CHUNK_DURATION_S)).isoformat(),
                "duration_s": seg["duration_s"],
                "fatigue": seg["fatigue"],
                "attention": seg["attention"],
                "mood": seg["mood"],
                "anomaly_score": seg["anomaly_score"],
                "embedding": seg["embedding"],
            }
            for seg in base_segments
        ]
        insert_segments(client, rows)
        print(f"  inserted {len(rows)} EEG segments for patient {pid}")

    print("\nDone.")
    print("\nDemo credentials (password: demo1234):")
    for u in PATIENTS + CAREGIVERS:
        print(f"  {u['email']}")
    print("\nNext: run `uv run python scripts/compute_umap.py` to project embeddings.")


if __name__ == "__main__":
    main()
