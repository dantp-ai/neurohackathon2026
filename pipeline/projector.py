"""2D UMAP projector for live embeddings.

Fits a UMAP reducer once on a reference embedding set (default: the
healthy<->dementia trajectory in data/) so each live segment can be projected to
(umap_x, umap_y) immediately and land *relative to the healthy/dementia clusters*.
Falls back to (None, None) if umap or the reference is unavailable — the columns
are nullable and scripts/compute_umap.py can backfill a global projection later.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np

_DEFAULT_REF = Path(__file__).resolve().parents[1] / "data" / "interp_trajectory_sub037_sub001.npz"


class UmapProjector:
    def __init__(self, reference: np.ndarray | None):
        self.reducer = None
        if reference is None or len(reference) < 10:
            print("[projector] no reference embeddings — umap coords will be null.")
            return
        try:
            import umap
            self.reducer = umap.UMAP(
                n_components=2, n_neighbors=15, min_dist=0.25,
                metric="cosine", random_state=0,
            ).fit(np.asarray(reference, dtype=np.float32))
            print(f"[projector] UMAP fitted on {len(reference)} reference embeddings.")
        except Exception as exc:
            print(f"[projector] UMAP unavailable ({exc}); umap coords will be null.")

    @classmethod
    def default(cls) -> "UmapProjector":
        """Fit on the healthy<->dementia trajectory shipped in data/ (if present)."""
        ref = None
        if _DEFAULT_REF.exists():
            try:
                ref = np.load(_DEFAULT_REF, allow_pickle=True)["embedding"]
            except Exception:
                ref = None
        return cls(ref)

    def transform(self, embedding: np.ndarray) -> tuple[float | None, float | None]:
        if self.reducer is None:
            return None, None
        try:
            xy = self.reducer.transform(np.asarray(embedding, dtype=np.float32)[None])[0]
            return float(xy[0]), float(xy[1])
        except Exception:
            return None, None
