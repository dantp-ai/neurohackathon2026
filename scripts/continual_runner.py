"""Continual-learning runner — closes the labeling loop.

Polls Supabase for caregiver-confirmed labels (labels.activity joined to each
segment's embedding) and updates the per-task classifier head once enough new
labels accumulate. Heads persist under task_heads/.

Also exposes write_label() to confirm a label from the backend — the frontend
normally writes these, but this lets you drive/test the loop end-to-end.

Usage:
    uv run python scripts/continual_runner.py --update-every 10 --interval 5
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Append repo root so `backend` is importable WITHOUT the local `supabase/`
# config dir shadowing the installed `supabase` package (site-packages wins).
sys.path.append(str(Path(__file__).parent.parent))
from backend.ml import ContinualTrainer, SupabaseLabelSource, TaskStore


def _client():
    load_dotenv(Path(__file__).parent.parent / ".env.local")
    from supabase import create_client
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def write_label(client, segment_id: str, patient_id: str, activity: str,
                event_id: str | None = None) -> None:
    """Insert a caregiver-confirmed label (activity = the training class)."""
    client.table("labels").insert({
        "patient_id": patient_id,
        "segment_id": segment_id,
        "event_id": event_id,
        "activity": activity,
        "extraction_method": "caregiver_manual",
        "confirmed_by_caregiver": True,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-every", type=int, default=10)
    ap.add_argument("--interval", type=float, default=5.0, help="poll interval (s)")
    ap.add_argument("--store", default="task_heads")
    args = ap.parse_args()

    client = _client()
    trainer = ContinualTrainer(
        TaskStore(root=args.store), SupabaseLabelSource(client),
        update_every=args.update_every,
    )
    print(f"Continual runner: polling labels.activity every {args.interval:g}s, "
          f"update_every={args.update_every}. Ctrl-C to stop.")
    try:
        while True:
            for ev in trainer.step():
                print(f"[{datetime.now():%H:%M:%S}] updated '{ev['task']}' "
                      f"(+{ev['n_new']} new, buffer {ev['n_buffer']}, classes {ev.get('classes')})")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nRunner stopped.")


if __name__ == "__main__":
    main()
