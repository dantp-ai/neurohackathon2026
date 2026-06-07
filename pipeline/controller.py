"""
Live demo controller — streams neurodsp-simulated EEG into Supabase so the
clinician interface shows embedding points appearing in real time (and the
caregiver can label them on the Map page).

Uses the real pipeline (foundation-model embedder + UMAP projection). It slides
30s windows over a pre-generated neurodsp buffer (so points appear right after
the model loads, ~1 every 2.5s) and crossfades a healthy buffer into an
unhealthy one and back, so the streamed points visibly drift green → red across
the map — a live version of the cognitive-decline trajectory.

    npm run stream                                   # default patient "Sofia Rossi"
    STREAM_PATIENT="Margaret Chen" npm run stream

Streams into an existing patient so the points appear on a screen you can open.
Each patient also streams client-side in the app, so the controller is optional.
"""
import math
import os
import time
import uuid
from datetime import datetime, timezone

import numpy as np
from supabase import create_client

from pipeline.daemon import SUPABASE_KEY, SUPABASE_URL
from pipeline.embedding import run_embedding, set_channel_names
from pipeline.projector import UmapProjector
from pipeline.stream import NeurodspStream

WINDOW_S = 30.0
POINT_EVERY_S = 2.5
SFREQ = 250.0
DRIFT_RATE = 0.22  # radians/tick; ~60s for a full healthy→unhealthy→healthy cycle


def get_or_create_patient(sb, name: str) -> str:
    found = sb.table("users").select("id").eq("display_name", name).limit(1).execute()
    if found.data:
        return found.data[0]["id"]
    created = sb.table("users").insert({"display_name": name, "role": "patient"}).execute()
    return created.data[0]["id"]


def main() -> None:
    name = os.getenv("STREAM_PATIENT", "Sofia Rossi")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    pid = get_or_create_patient(sb, name)

    healthy = NeurodspStream(sfreq=SFREQ, n_channels=19, health="healthy", duration_s=600.0, seed=1)
    unhealthy = NeurodspStream(sfreq=SFREQ, n_channels=19, health="unhealthy", duration_s=600.0, seed=2)
    set_channel_names(healthy.channel_names)
    projector = UmapProjector.default()

    h_data, u_data = healthy._data, unhealthy._data
    n = min(len(h_data), len(u_data))
    win = int(WINDOW_S * SFREQ)
    step = int(POINT_EVERY_S * SFREQ)
    print(f"Live neurodsp stream -> '{name}' [{pid}]; drifting healthy↔unhealthy, point every {POINT_EVERY_S:g}s")

    cursor = win
    tick = 0
    while True:
        if cursor > n:
            cursor = win
        phase = math.sin(tick * DRIFT_RATE) * 0.5 + 0.5  # 0 (healthy) .. 1 (unhealthy)
        wh = h_data[cursor - win : cursor]
        wu = u_data[cursor - win : cursor]
        window = ((1.0 - phase) * wh + phase * wu).T.astype(np.float32)  # [n_ch, n_samples]

        emb = run_embedding(window, SFREQ)
        anomaly = round(float(phase), 3)  # color follows the healthy→unhealthy drift
        umap_x, umap_y = projector.transform(emb)

        row = {
            "id": str(uuid.uuid4()),
            "patient_id": pid,
            "device_id": "neurodsp-live",
            "timestamp_start": datetime.now(timezone.utc).isoformat(),
            "duration_s": int(WINDOW_S),
            "fatigue": round(min(1.0, 0.35 + phase * 0.55), 3),
            "attention": round(max(0.0, 0.75 - phase * 0.45), 3),
            "mood": round(max(0.0, 0.65 - phase * 0.35), 3),
            "anomaly_score": anomaly,
            "embedding": emb.tolist(),
        }
        if umap_x is not None:
            row["umap_x"], row["umap_y"] = float(umap_x), float(umap_y)
        try:
            sb.table("eeg_segments").insert(row).execute()
            xy = f"({umap_x:.2f},{umap_y:.2f})" if umap_x is not None else "(—)"
            print(f"  + point phase={phase:.2f} anomaly={anomaly:.2f} xy={xy}")
        except Exception as exc:
            print(f"[WARN] insert failed: {exc}")

        cursor += step
        tick += 1
        time.sleep(POINT_EVERY_S)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStream stopped.")
