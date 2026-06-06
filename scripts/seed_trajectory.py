"""Seed the healthy->dementia interpolation trajectory as a demo patient.

Loads data/interp_trajectory_sub037_sub001.npz (live foundation-model embeddings
+ precomputed UMAP xy + per-point time alpha) and inserts one eeg_segments row
per point, ordered in time by alpha so the caregiver Map plays the healthy->
dementia drift. anomaly_score = alpha (green -> red as decline progresses); the
umap coords come straight from the file, so the Map works without compute_umap.

This powers the DEMO experience. Idempotent.

Usage:  uv run python scripts/seed_trajectory.py
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

NPZ = Path(__file__).parent.parent / "data" / "interp_trajectory_sub037_sub001.npz"
PATIENT = {"display_name": "Trajectory Demo", "email": "trajectory@demo.local"}
DEVICE_ID = "demo-trajectory"
STEP = timedelta(hours=6)   # spacing between points; 530 pts ~ 132 days of "evolution"


def build_rows(emb, alpha, xy, patient_id: str, start: datetime) -> list[dict]:
    """One eeg_segments row per trajectory point, ordered in time by alpha."""
    order = np.argsort(alpha)               # time axis: healthy (0) -> dementia (1)
    rows = []
    for i, idx in enumerate(order):
        a = float(alpha[idx])
        rows.append({
            "patient_id": patient_id,
            "device_id": DEVICE_ID,
            "timestamp_start": (start + STEP * i).isoformat(),
            "duration_s": 30,
            "fatigue":   round(0.30 + 0.40 * a, 3),   # plausible decline-correlated
            "attention": round(0.70 - 0.40 * a, 3),
            "mood":      round(0.60 - 0.30 * a, 3),
            "anomaly_score": round(a, 3),             # green -> red over time
            "embedding": np.asarray(emb[idx], dtype=float).tolist(),
            "umap_x": float(xy[idx, 0]),
            "umap_y": float(xy[idx, 1]),
        })
    return rows


def main() -> None:
    load_dotenv(Path(__file__).parent.parent / ".env.local")
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    key = os.environ["SUPABASE_SERVICE_KEY"]

    from supabase import create_client
    from seed_eeg import (  # reuse helpers/conventions from the main seeder
        CAREGIVERS, get_or_create_user, insert_segments, reset_segments_for,
        seed_care_relationships,
    )

    if not NPZ.exists():
        raise FileNotFoundError(f"Trajectory dataset not found at {NPZ}. See data/README.md.")
    d = np.load(NPZ, allow_pickle=True)
    emb, alpha, xy = d["embedding"], d["alpha"], d["xy"]
    print(f"Loaded trajectory: {emb.shape[0]} points, dim {emb.shape[1]}")

    client = create_client(url, key)
    pid = get_or_create_user(client, PATIENT["email"], PATIENT["display_name"], "patient")
    caregiver_ids = [
        get_or_create_user(client, c["email"], c["display_name"], "caregiver")
        for c in CAREGIVERS
    ]
    seed_care_relationships(client, [pid], caregiver_ids)
    reset_segments_for(client, pid)

    start = datetime.now(timezone.utc) - STEP * len(alpha)
    rows = build_rows(emb, alpha, xy, pid, start)
    insert_segments(client, rows)
    print(f"Seeded {len(rows)} trajectory segments for {PATIENT['display_name']} ({pid}).")
    print("The Map tab will show the healthy->dementia drift (umap coords included).")


if __name__ == "__main__":
    main()
