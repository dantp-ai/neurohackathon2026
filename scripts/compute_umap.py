"""
Fit a 2D UMAP projection over all eeg_segments embeddings and write the
resulting (umap_x, umap_y) back to each row.

Run after seeding so the frontend can plot a 2D scatter of segments. Safe
to re-run — re-fits over the current population and overwrites coordinates.

Usage:
    uv run python scripts/compute_umap.py
"""

import os
from pathlib import Path
from typing import Any

import numpy as np
import umap
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent / ".env.local")

SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# UMAP hyperparameters — sensible defaults for ~100 high-dim embeddings.
N_NEIGHBORS = 15
MIN_DIST = 0.1
METRIC = "cosine"

FETCH_PAGE_SIZE = 1000
UPDATE_BATCH_SIZE = 50


def parse_embedding(raw: Any) -> list[float] | None:
    """pgvector comes back from supabase-py as a string '[1.0, 2.0, ...]' or a list."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        stripped = raw.strip().strip("[]")
        if not stripped:
            return None
        return [float(x) for x in stripped.split(",")]
    raise TypeError(f"Unexpected embedding type: {type(raw)}")


def fetch_all_segments(client: Client) -> list[dict]:
    """Page through eeg_segments to collect every row with an embedding."""
    rows: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table("eeg_segments")
            .select("id, embedding")
            .range(offset, offset + FETCH_PAGE_SIZE - 1)
            .execute()
        )
        if not page.data:
            break
        rows.extend(page.data)
        if len(page.data) < FETCH_PAGE_SIZE:
            break
        offset += FETCH_PAGE_SIZE
    return rows


def main() -> None:
    print("Connecting to Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Fetching segments...")
    rows = fetch_all_segments(client)
    print(f"  fetched {len(rows)} segments")

    parsed: list[tuple[str, list[float]]] = []
    for r in rows:
        vec = parse_embedding(r.get("embedding"))
        if vec is None:
            continue
        parsed.append((r["id"], vec))

    if len(parsed) < 4:
        print(f"Need at least 4 embeddings to fit UMAP, found {len(parsed)}. Aborting.")
        return

    ids = [p[0] for p in parsed]
    X = np.array([p[1] for p in parsed], dtype=np.float32)
    print(f"  embeddings matrix: {X.shape}")

    n_neighbors = min(N_NEIGHBORS, max(2, len(parsed) - 1))
    print(f"Fitting UMAP (n_neighbors={n_neighbors}, min_dist={MIN_DIST}, metric={METRIC})...")
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=MIN_DIST,
        metric=METRIC,
        random_state=42,
    )
    coords = reducer.fit_transform(X)
    print(f"  projected to shape {coords.shape}")

    print("Writing coordinates back to eeg_segments...")
    for i, (sid, (x, y)) in enumerate(zip(ids, coords)):
        client.table("eeg_segments").update(
            {"umap_x": float(x), "umap_y": float(y)}
        ).eq("id", sid).execute()
        if (i + 1) % UPDATE_BATCH_SIZE == 0:
            print(f"  updated {i + 1}/{len(ids)}")
    print(f"  updated {len(ids)}/{len(ids)}")

    print("Done.")


if __name__ == "__main__":
    main()
