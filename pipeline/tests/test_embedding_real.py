"""Slow real-embedder test: loads the actual foundation model and asserts
the same contract as the fast mocked tests. Skipped unless SLOW=1.

Why keep this separate from test_embedding.py:
  - Cold start is ~2 minutes and needs HuggingFace auth to the gated
    Neuroencoder/epi-embedding model.
  - Downloads ~500 MB the first time.
  - We still want it *runnable* - this is the single test that catches HF
    publishing a broken model version or the neuroencoder API changing the
    output shape underneath us.

Run with:
    SLOW=1 uv run pytest pipeline/tests/test_embedding_real.py
"""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.embedding import EMBEDDING_DIM, run_embedding, set_channel_names

# Canonical 10-20 montage the model expects; matches data/sub-001.
CHANNELS_10_20 = [
    "Fp1", "Fp2", "F3", "F4", "C3", "C4", "P3", "P4",
    "O1", "O2", "F7", "F8", "T7", "T8", "P7", "P8",
    "Fz", "Cz", "Pz",
]


@pytest.mark.slow
def test_real_embedder_matches_contract():
    """Real model on synthetic EEG returns a (384,) float32, finite, unit-norm vector."""
    set_channel_names(CHANNELS_10_20)
    try:
        rng = np.random.default_rng(0)
        # Amplitude is min-max normalized inside the model, so absolute scale
        # doesn't matter - small Gaussian noise stands in for real EEG.
        window = rng.normal(0.0, 1e-5, (19, 7500)).astype(np.float32)
        out = run_embedding(window, sfreq=250.0)
    finally:
        set_channel_names(None)

    assert out.shape == (EMBEDDING_DIM,)
    assert out.dtype == np.float32
    assert np.all(np.isfinite(out))
    # L2 norm ~ 1 (allowing slack for the 1e-8 safeguard in the normalizer).
    assert np.linalg.norm(out) == pytest.approx(1.0, abs=1e-3)
