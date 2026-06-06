"""
Seed script: inserts demo users, care relationships, and EEG segments derived
from the real sub-001 recording in `data/` into the local Supabase instance.

Each 30s window is converted into a 384-dim "embedding" by computing relative
band power per channel (delta, theta, alpha, beta, gamma × 19 channels = 95
features), zero-padded to 384. The real EEG embedder lives on a separate
branch — once it lands, swap `window_features` for a call into it.

This script is idempotent: running it twice updates existing users in place
and replaces their eeg_segments.

Usage:
    uv run python scripts/seed_eeg.py
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import mne
import numpy as np
from dotenv import load_dotenv
from scipy.signal import welch
from supabase import Client, create_client

load_dotenv(Path(__file__).parent.parent / ".env.local")

# ---------------------------------------------------------------------------
# Config — loaded from .env.local (see .env.example)
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

EMBEDDING_DIM = 384
CHUNK_DURATION_S = 30
DEVICE_ID = "eeg-device-demo-001"

EEG_FILE = Path(__file__).parent.parent / "data" / "sub-001_task-eyesclosed_eeg.set"

# Standard EEG band edges in Hz.
BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 45.0),
}
# `relative power` order, must match dict iteration in feature extraction.
BAND_NAMES = list(BANDS.keys())

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


# ---------------------------------------------------------------------------
# EEG → features
# ---------------------------------------------------------------------------
def load_recording() -> tuple[np.ndarray, float, list[str]]:
    """Load the real EEG recording, return (data, sfreq, channel_names)."""
    print(f"Loading EEG from {EEG_FILE.name}...")
    raw = mne.io.read_raw_eeglab(str(EEG_FILE), preload=True, verbose="ERROR")
    return raw.get_data(), float(raw.info["sfreq"]), list(raw.ch_names)


def window_features(window: np.ndarray, sfreq: float) -> np.ndarray:
    """
    Relative band power per channel for a 30s window.
    Returns shape (n_channels * 5,) — typically (19 * 5,) = (95,).
    """
    nperseg = min(int(sfreq * 2), window.shape[1])  # 2s segments for Welch
    freqs, psd = welch(window, fs=sfreq, nperseg=nperseg, axis=-1)

    band_powers = []
    for lo, hi in BANDS.values():
        mask = (freqs >= lo) & (freqs < hi)
        band_powers.append(psd[:, mask].mean(axis=-1))
    # shape (n_bands, n_channels)
    band_powers = np.stack(band_powers, axis=0)
    total = band_powers.sum(axis=0, keepdims=True) + 1e-12
    relative = band_powers / total
    # Flatten to (n_channels * n_bands,) with bands varying fastest.
    return relative.T.reshape(-1)


def metrics_from_bands(relative: np.ndarray, n_channels: int) -> dict:
    """
    Derive plausible 0-1 wellness metrics from relative band powers.

    Heuristics, not clinical truth, but the relative ordering is meaningful:
      fatigue       ~ theta / alpha            (drowsiness signature)
      attention     ~ beta / (alpha + theta)   (alert/focused signature)
      mood          ~ alpha share              (relaxed alpha-rich state)
      anomaly_score ~ (delta + theta) share    (AD pattern: slow-wave excess)
    """
    # Recover (n_channels, n_bands) layout from the flattened embedding.
    bands = relative.reshape(n_channels, len(BAND_NAMES)).mean(axis=0)
    delta, theta, alpha, beta, gamma = bands

    fatigue = theta / (alpha + 1e-6)
    attention = beta / (alpha + theta + 1e-6)
    mood = alpha
    anomaly = delta + theta

    def squash(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
        return float(max(lo, min(hi, v)))

    # Empirically scale to 0-1 ranges (the raw ratios sit roughly in 0-2).
    return {
        "fatigue": squash(fatigue / 2.0),
        "attention": squash(attention * 2.0),
        "mood": squash(mood * 2.5),
        "anomaly_score": squash(anomaly),
    }


def pad_to(vec: np.ndarray, dim: int) -> list[float]:
    """Zero-pad a feature vector to the embedding column size."""
    out = np.zeros(dim, dtype=np.float32)
    out[: min(len(vec), dim)] = vec[: min(len(vec), dim)]
    return out.tolist()


def build_segments_for_recording(
    data: np.ndarray, sfreq: float, n_channels: int
) -> list[dict]:
    """
    Slice the recording into non-overlapping 30s windows and compute features
    + metrics + 384-dim embedding for each. patient_id and timestamps are
    filled in per-patient by the caller.
    """
    samples_per_window = int(sfreq * CHUNK_DURATION_S)
    n_windows = data.shape[1] // samples_per_window
    print(f"  recording: {data.shape[1] / sfreq:.1f}s @ {sfreq:g}Hz → {n_windows} windows")

    segments = []
    for i in range(n_windows):
        start = i * samples_per_window
        window = data[:, start : start + samples_per_window]
        features = window_features(window, sfreq)
        segments.append(
            {
                "duration_s": CHUNK_DURATION_S,
                "embedding": pad_to(features, EMBEDDING_DIM),
                "_window_index": i,
                **metrics_from_bands(features, n_channels),
            }
        )
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
        raise FileNotFoundError(
            f"Expected EEG file at {EEG_FILE}. See data/README.md."
        )

    data, sfreq, ch_names = load_recording()
    n_channels = len(ch_names)
    print(f"  {n_channels} channels: {', '.join(ch_names)}")

    base_segments = build_segments_for_recording(data, sfreq, n_channels)

    print("\nConnecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("\nSeeding users...")
    patient_ids = [
        get_or_create_user(client, p["email"], p["display_name"], "patient")
        for p in PATIENTS
    ]
    caregiver_ids = [
        get_or_create_user(client, c["email"], c["display_name"], "caregiver")
        for c in CAREGIVERS
    ]
    for p, pid in zip(PATIENTS, patient_ids):
        print(f"  patient: {p['display_name']} ({pid})")
    for c, cid in zip(CAREGIVERS, caregiver_ids):
        print(f"  caregiver: {c['display_name']} ({cid})")

    print("\nSeeding care relationships...")
    seed_care_relationships(client, patient_ids, caregiver_ids)

    print("\nSeeding EEG segments (real sub-001 recording, shared between both patients)...")
    now = datetime.now(timezone.utc)
    total_seconds = len(base_segments) * CHUNK_DURATION_S
    start = now - timedelta(seconds=total_seconds)

    for pid in patient_ids:
        reset_segments_for(client, pid)
        rows = [
            {
                "patient_id": pid,
                "device_id": DEVICE_ID,
                "timestamp_start": (
                    start + timedelta(seconds=seg["_window_index"] * CHUNK_DURATION_S)
                ).isoformat(),
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
    for p in PATIENTS:
        print(f"  patient   {p['email']}")
    for c in CAREGIVERS:
        print(f"  caregiver {c['email']}")
    print("\nNext: run `uv run python scripts/compute_umap.py` to project embeddings.")


if __name__ == "__main__":
    main()
