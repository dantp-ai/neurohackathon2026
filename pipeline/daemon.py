"""
EEG processing daemon — reads a stream, computes metrics, writes to Supabase.

Usage:
    # Simulated data (no hardware needed):
    uv run pipeline/daemon.py --patient-id <uuid> --simulate

    # Replay the sample recording in data/:
    uv run pipeline/daemon.py --patient-id <uuid> --file data/sub-001_task-eyesclosed_eeg.set

    # Real device via LSL (start muselsl stream or BrainCo app first):
    uv run pipeline/daemon.py --patient-id <uuid>

Environment variables (loaded from .env.local):
    EXPO_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_KEY   (preferred — bypasses RLS)
    EXPO_PUBLIC_SUPABASE_ANON_KEY  (fallback for local dev without RLS)
"""

import argparse
import os
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from supabase import create_client

from pipeline.band_power import SessionNormalizer, compute_band_powers
from pipeline.embedding import run_anomaly_detection, run_embedding
from pipeline.stream import FileStream, LSLStream, SimulatedStream

load_dotenv(Path(__file__).parents[1] / ".env.local")

SUPABASE_URL = os.environ["EXPO_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.environ["EXPO_PUBLIC_SUPABASE_ANON_KEY"]

# --- Pipeline timing ---------------------------------------------------------
EMBED_WINDOW_S = 30.0  # buffer length fed to embedding model
EMBED_STRIDE_S = 5.0   # how often we insert a new eeg_segments row

# --- Anomaly thresholds ------------------------------------------------------
ANOMALY_THRESHOLD = 0.65


def _severity(score: float) -> str:
    if score >= 0.90:
        return "high"
    if score >= 0.80:
        return "medium"
    return "low"


def _build_stream(args: argparse.Namespace):
    if args.file:
        return FileStream(args.file)
    if args.simulate:
        return SimulatedStream(
            sfreq=256.0,
            n_channels=4,
            anomaly_every_s=float(args.anomaly_every),
        )
    return LSLStream(stream_type="EEG")


def run(patient_id: str, device_id: str, stream) -> None:
    sfreq = stream.sfreq
    buf_capacity = int(EMBED_WINDOW_S * sfreq)
    # Rolling buffer of raw samples; each element is a (n_channels,) row
    buffer: deque[np.ndarray] = deque(maxlen=buf_capacity)

    normalizer = SessionNormalizer(baseline_s=120.0, stride_s=EMBED_STRIDE_S)
    embedding_history: list[np.ndarray] = []

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Supabase connected. Patient: {patient_id}  Device: {device_id}")
    print(f"Buffering {EMBED_WINDOW_S:.0f}s of data before first insert...\n")

    last_insert = time.monotonic()

    while True:
        # --- Pull new samples ------------------------------------------------
        samples, _ = stream.pull_chunk(timeout=0.1, max_samples=128)
        if samples.shape[0] > 0:
            for row in samples:
                buffer.append(row)

        # --- Wait for stride interval ----------------------------------------
        now = time.monotonic()
        if now - last_insert < EMBED_STRIDE_S:
            continue

        # --- Wait until buffer is full (first EMBED_WINDOW_S seconds) --------
        if len(buffer) < buf_capacity:
            elapsed = len(buffer) / sfreq
            print(
                f"  Buffering: {elapsed:.1f}/{EMBED_WINDOW_S:.0f}s  "
                f"({100*elapsed/EMBED_WINDOW_S:.0f}%)",
                end="\r",
            )
            continue

        last_insert = now

        # --- Build (n_channels, n_samples) window ----------------------------
        window = np.stack(list(buffer), axis=1).astype(np.float32)

        # --- Band power on last 4s of window (better freq resolution) --------
        bp_window = window[:, -int(4 * sfreq):]
        raw_metrics = compute_band_powers(bp_window, sfreq, window_s=4.0)
        normalizer.update(raw_metrics)
        normalized = normalizer.normalize(raw_metrics)

        # --- Embedding + anomaly score ----------------------------------------
        embedding = run_embedding(window, sfreq)
        anomaly_score = run_anomaly_detection(embedding, embedding_history)
        embedding_history.append(embedding)
        if len(embedding_history) > 200:
            embedding_history = embedding_history[-200:]

        # --- Insert eeg_segments row ------------------------------------------
        segment_id = str(uuid.uuid4())
        segment_row = {
            "id": segment_id,
            "patient_id": patient_id,
            "device_id": device_id,
            "timestamp_start": datetime.now(timezone.utc).isoformat(),
            "duration_s": int(EMBED_WINDOW_S),
            "fatigue":       round(normalized["fatigue"],     3),
            "attention":     round(normalized["attention"],   3),
            "mood":          round(normalized["relaxation"],  3),
            "anomaly_score": round(anomaly_score,           3),
            "embedding":     embedding.tolist(),
        }
        try:
            supabase.table("eeg_segments").insert(segment_row).execute()
        except Exception as exc:
            print(f"\n[WARN] eeg_segments insert failed: {exc}")

        # --- Create event if anomalous ----------------------------------------
        if anomaly_score >= ANOMALY_THRESHOLD:
            event_row = {
                "patient_id": patient_id,
                "segment_id": segment_id,
                "type": "anomaly",
                "severity": _severity(anomaly_score),
                "resolved": False,
            }
            try:
                supabase.table("events").insert(event_row).execute()
                print(f"\n[ALERT] anomaly_score={anomaly_score:.2f}  severity={_severity(anomaly_score)}")
            except Exception as exc:
                print(f"\n[WARN] events insert failed: {exc}")

        # --- Console status line ----------------------------------------------
        cal = "calibrated" if normalizer.calibrated else "baseline…"
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] "
            f"fatigue={normalized['fatigue']:.2f}  "
            f"attention={normalized['attention']:.2f}  "
            f"relaxation={normalized['relaxation']:.2f}  "
            f"anomaly={anomaly_score:.2f}  "
            f"({cal})"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="EEG processing daemon")
    parser.add_argument(
        "--patient-id", required=True,
        help="UUID of the patient row in Supabase",
    )
    parser.add_argument(
        "--device-id", default="eeg-device-001",
        help="Arbitrary device identifier stored with each segment",
    )

    source = parser.add_mutually_exclusive_group()
    source.add_argument(
        "--simulate", action="store_true",
        help="Generate synthetic EEG instead of connecting to a device",
    )
    source.add_argument(
        "--file", default=None, metavar="PATH",
        help="Replay a recorded file (e.g. data/sub-001_task-eyesclosed_eeg.set)",
    )

    parser.add_argument(
        "--anomaly-every", default=120, type=int, metavar="SECONDS",
        help="(simulate mode) Inject a theta-burst anomaly every N seconds (default: 120)",
    )
    args = parser.parse_args()

    stream = _build_stream(args)
    try:
        run(patient_id=args.patient_id, device_id=args.device_id, stream=stream)
    except KeyboardInterrupt:
        print("\nDaemon stopped.")


if __name__ == "__main__":
    main()
