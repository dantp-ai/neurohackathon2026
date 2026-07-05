"""End-to-end smoke test for the demo-seeding pipeline.

Runs the three seed scripts against a live local Supabase and asserts the
demo state the app expects: three human patients + one trajectory patient,
each with EEG segments carrying non-null UMAP coordinates. This is the
single test that protects `npm run demo` from silent regressions -
migration drift, embedder shape change, UMAP fitting failure, or a seed
script whose "idempotent" claim quietly breaks.

Skipped unless E2E=1 and preflight passes:
  - Supabase must be reachable (`supabase start` on the host).
  - `.env.local` must contain SUPABASE_SERVICE_KEY.
  - The trajectory NPZ must be present in `data/`.
  - HF model access is implicitly required (seed_eeg loads the foundation
    model). If HF auth is missing the seed_eeg subprocess will fail and
    surface that as the test failure.

Run via:
    npm run test:e2e           # resets DB + runs this test

Or manually against an already-fresh DB:
    E2E=1 uv run pytest -m e2e
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"
TRAJECTORY_NPZ = REPO_ROOT / "data" / "interp_trajectory_sub037_sub001.npz"
SEED_EEG_FILE = REPO_ROOT / "data" / "sub-001_task-eyesclosed_eeg.set"

# Expected demo state (matches PATIENTS/CAREGIVERS in scripts/seed_eeg.py
# and the trajectory patient in scripts/seed_trajectory.py).
EXPECTED_HUMAN_PATIENTS = 3   # Margaret, Harold, Sofia
EXPECTED_CAREGIVERS = 2       # Sarah, James
EXPECTED_TRAJECTORY_PTS = 530  # size of interp_trajectory NPZ

# The sub-001 recording is ~5 min at 500 Hz. seed_eeg cuts non-overlapping 30s
# windows → ~10-11 segments per patient. Lower bound is enough to prove the
# pipeline actually wrote something.
MIN_SEGMENTS_PER_HUMAN = 5


pytestmark = pytest.mark.e2e


@pytest.fixture(scope="module")
def supabase_client():
    """Load .env.local, verify preflight, return an authenticated client.

    Fixture-scoped so a single connection is reused across assertions.
    """
    load_dotenv(REPO_ROOT / ".env.local")
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        pytest.skip("SUPABASE_SERVICE_KEY missing from .env.local - run `supabase status`.")
    if not TRAJECTORY_NPZ.exists():
        pytest.skip(f"Missing {TRAJECTORY_NPZ.name} - see data/README.md.")
    if not SEED_EEG_FILE.exists():
        pytest.skip(f"Missing {SEED_EEG_FILE.name} - see data/README.md.")

    from supabase import create_client
    try:
        client = create_client(url, key)
        # Cheap connectivity check - Supabase Storage is always up.
        client.table("users").select("id", count="exact").limit(1).execute()
    except Exception as exc:
        pytest.skip(f"Supabase not reachable at {url} ({exc}). Run `supabase start`.")
    return client


def _run_seed(script_name: str) -> None:
    """Run a seed script as a subprocess, streaming its stderr to the test log.

    Using uv run + the host Python matches how a developer would run the
    scripts locally. Docker isn't required for the test itself - the seed
    logic is what we're validating, not the container plumbing.
    """
    script = SCRIPTS / script_name
    result = subprocess.run(
        ["uv", "run", "python", str(script)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        # Print both streams so pytest -s shows the failure context.
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        pytest.fail(f"{script_name} exited with code {result.returncode}")


@pytest.fixture(scope="module")
def seeded_db(supabase_client):
    """Run the three seed scripts, in order, once for the whole test module.

    We intentionally do NOT reset the DB here - the `npm run test:e2e`
    runner does that before invoking pytest. This keeps the pytest fixture
    idempotent-observing: it asserts on whatever state the runner set up.
    """
    _run_seed("seed_eeg.py")
    _run_seed("compute_umap.py")
    _run_seed("seed_trajectory.py")
    return supabase_client


def _count_role(client, role: str) -> int:
    res = client.table("users").select("id", count="exact").eq("role", role).execute()
    return res.count or 0


def _count_segments_for(client, patient_id: str) -> int:
    res = (
        client.table("eeg_segments")
        .select("id", count="exact")
        .eq("patient_id", patient_id)
        .execute()
    )
    return res.count or 0


def test_seed_creates_expected_users(seeded_db):
    """3 human patients + 1 trajectory patient + 2 caregivers."""
    assert _count_role(seeded_db, "patient") >= EXPECTED_HUMAN_PATIENTS + 1
    assert _count_role(seeded_db, "caregiver") >= EXPECTED_CAREGIVERS


def test_seed_creates_care_relationships(seeded_db):
    """Every human patient must be linked to at least one caregiver - the
    caregiver app's patient list depends on this join."""
    res = seeded_db.table("care_relationships").select("id", count="exact").execute()
    # 4 patients * 2 caregivers = 8 at minimum
    assert (res.count or 0) >= (EXPECTED_HUMAN_PATIENTS + 1) * EXPECTED_CAREGIVERS


def test_human_patients_have_eeg_segments(seeded_db):
    """Each demo human patient must have at least a few real embeddings.
    Below the floor means seed_eeg silently dropped rows (past root cause)."""
    patients = seeded_db.table("users").select("id, display_name").eq("role", "patient").execute()
    human_patients = [p for p in patients.data if p["display_name"] != "Trajectory Demo"]
    assert len(human_patients) >= EXPECTED_HUMAN_PATIENTS
    for p in human_patients[:EXPECTED_HUMAN_PATIENTS]:
        n = _count_segments_for(seeded_db, p["id"])
        assert n >= MIN_SEGMENTS_PER_HUMAN, (
            f"{p['display_name']} has only {n} segments - expected ≥ {MIN_SEGMENTS_PER_HUMAN}"
        )


def test_trajectory_patient_has_full_trajectory(seeded_db):
    """The /demo trajectory patient must have every point from the NPZ.
    A short count here means the Play button will play a partial trajectory."""
    res = (
        seeded_db.table("users")
        .select("id")
        .eq("display_name", "Trajectory Demo")
        .single()
        .execute()
    )
    n = _count_segments_for(seeded_db, res.data["id"])
    assert n == EXPECTED_TRAJECTORY_PTS, (
        f"Trajectory patient has {n} segments, expected {EXPECTED_TRAJECTORY_PTS}"
    )


def test_all_segments_have_umap_coords(seeded_db):
    """Every eeg_segments row must have umap_x and umap_y populated.
    Nulls here mean the caregiver Map tab shows an empty scatter - which
    is exactly the regression that shipped once and prompted this test.
    """
    with_coords = (
        seeded_db.table("eeg_segments")
        .select("id", count="exact")
        .not_.is_("umap_x", "null")
        .not_.is_("umap_y", "null")
        .execute()
    )
    total = seeded_db.table("eeg_segments").select("id", count="exact").execute()
    assert (with_coords.count or 0) == (total.count or 0), (
        f"{(total.count or 0) - (with_coords.count or 0)} segments missing UMAP coords"
    )
