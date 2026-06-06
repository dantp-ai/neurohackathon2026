"""Voice message → transcript → label (F2 backend).

Downloads a patient voice note from Supabase Storage, transcribes it with Groq
whisper-large-v3 (auto-detects English/Mandarin), writes the transcript onto the
message, and — if the note is a response to an anomaly EVENT — creates a `labels`
row (subjective_state = transcript) that shows up in the caregiver's Labels tab
for review/confirmation. Once confirmed (labels.activity), continual_runner.py
learns from it.

Requires:
    GROQ_API_KEY         — free tier at console.groq.com (no card)
    SUPABASE_SERVICE_KEY — backend writes (bypasses RLS)
A Supabase Storage bucket named `audio` holding the uploaded file.

Usage (called after the app uploads a voice note):
    uv run python scripts/transcribe.py --path voice/123.m4a --patient-id <uuid> \
        [--message-id <uuid>] [--event-id <uuid>] [--segment-id <uuid>]
"""

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


def transcribe_bytes(audio_bytes: bytes, filename: str) -> str:
    """Groq whisper-large-v3. Language omitted so EN/Mandarin auto-detect."""
    from groq import Groq

    client = Groq()  # reads GROQ_API_KEY
    resp = client.audio.transcriptions.create(
        file=(filename, audio_bytes),
        model="whisper-large-v3",
        response_format="text",
    )
    return resp if isinstance(resp, str) else resp.text


def main() -> None:
    load_dotenv(Path(__file__).parent.parent / ".env.local")
    ap = argparse.ArgumentParser()
    ap.add_argument("--path", required=True, help="audio path inside the `audio` Storage bucket")
    ap.add_argument("--patient-id", required=True)
    ap.add_argument("--message-id", default=None, help="message row to attach the transcript to")
    ap.add_argument("--event-id", default=None, help="if set, this voice note answers an anomaly event")
    ap.add_argument("--segment-id", default=None)
    args = ap.parse_args()

    from supabase import create_client

    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    sb = create_client(url, key)

    print(f"Downloading {args.path} from Storage…")
    audio = sb.storage.from_("audio").download(args.path)
    transcript = transcribe_bytes(audio, os.path.basename(args.path))
    print(f"Transcript: {transcript!r}")

    if args.message_id:
        sb.table("messages").update({"content": transcript}).eq("id", args.message_id).execute()
        print("Attached transcript to message.")

    # If it answers an anomaly event, surface a label for the caregiver to review.
    if args.event_id:
        sb.table("labels").insert({
            "patient_id": args.patient_id,
            "event_id": args.event_id,
            "segment_id": args.segment_id,
            "subjective_state": transcript,
            "extraction_method": "llm_auto",
            "confidence": 0.6,
            "confirmed_by_caregiver": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        print("Created label (subjective_state = transcript) for caregiver review.")


if __name__ == "__main__":
    main()
