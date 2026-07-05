"""Fast unit tests for pipeline.embedding.

The real embedder pulls the gated neuroencoder MRL model (~2 min cold start
plus HF auth). We test the wiring around it by monkeypatching
`pipeline.embedding._get_embedder` so we can nail down the contract without
touching the real model:

    - `run_embedding` output has the (384,) shape / float32 dtype the
      pgvector(384) column expects, is finite, and is L2-normalized.
    - The 30-second stride and channel-name montage reach the embedder.
      Both silently corrupt embeddings if they get dropped - hence the
      forwarding assertions.
    - `run_anomaly_detection` behaves correctly at the boundaries the
      daemon relies on (empty history, identical vs. antipodal vectors).

The real model is exercised by `test_embedding_real.py`, gated by SLOW=1.
"""

from __future__ import annotations

import numpy as np
import pytest

from pipeline import embedding
from pipeline.embedding import (
    EMBEDDING_DIM,
    run_anomaly_detection,
    run_embedding,
    set_channel_names,
)

SFREQ = 250.0
WINDOW_SAMPLES = 7500  # 30s * 250Hz
CHANNELS = 19


class _StubEmbedder:
    """Deterministic stand-in for backend.ml.EEGEmbedder.

    Records the call arguments so we can assert the wiring contract without
    touching the real HF model. `.embed(...)` returns the same fixed vector
    every call, so downstream normalization is deterministic.
    """

    def __init__(self, vector: np.ndarray):
        self._vector = vector
        self.calls: list[dict] = []

    def embed(self, eeg, sfreq, channel_names, stride_seconds):
        eeg_arr = np.asarray(eeg)
        self.calls.append({
            "eeg_shape": tuple(eeg_arr.shape),
            "eeg_dtype": eeg_arr.dtype,
            "sfreq": sfreq,
            "channel_names": channel_names,
            "stride_seconds": stride_seconds,
        })
        # Real embedder returns [N_epochs, dim]; a 30s window with 30s stride
        # yields N=1, so shape (1, 384) matches production.
        return self._vector[None, :].copy()


@pytest.fixture
def stub_embedder(monkeypatch):
    rng = np.random.default_rng(42)
    v = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
    stub = _StubEmbedder(v)
    monkeypatch.setattr(embedding, "_get_embedder", lambda: stub)
    # Guard against test-order leakage from set_channel_names in other tests.
    monkeypatch.setattr(embedding, "_channel_names", None)
    return stub


def test_run_embedding_returns_contracted_shape_and_dtype(stub_embedder):
    out = run_embedding(np.zeros((CHANNELS, WINDOW_SAMPLES), np.float32), SFREQ)
    assert out.shape == (EMBEDDING_DIM,)
    assert out.dtype == np.float32
    assert np.all(np.isfinite(out))


def test_run_embedding_output_is_l2_normalized(stub_embedder):
    out = run_embedding(np.zeros((CHANNELS, WINDOW_SAMPLES), np.float32), SFREQ)
    # The +1e-8 safeguard in the normalizer means the result is 1 / (1 + eps),
    # which is within 1e-5 of unit norm for any non-degenerate stub vector.
    assert np.linalg.norm(out) == pytest.approx(1.0, abs=1e-5)


def test_run_embedding_forwards_channel_names(stub_embedder, monkeypatch):
    """The foundation model averages channels into 8 brain regions using the
    10-20 labels. Dropping the montage silently produces garbage embeddings -
    guard against that with an explicit forwarding assertion.
    """
    names = ["Fp1", "Fp2", "F3"]
    set_channel_names(names)
    run_embedding(np.zeros((3, WINDOW_SAMPLES), np.float32), SFREQ)
    assert stub_embedder.calls[-1]["channel_names"] == names


def test_run_embedding_forwards_30s_stride(stub_embedder):
    """Stride must be 30s - one window in, one embedding out. A smaller stride
    silently averages multiple epochs and drifts the mapped point.
    """
    run_embedding(np.zeros((CHANNELS, WINDOW_SAMPLES), np.float32), SFREQ)
    assert stub_embedder.calls[-1]["stride_seconds"] == 30.0


def test_run_embedding_forwards_sfreq(stub_embedder):
    run_embedding(np.zeros((CHANNELS, WINDOW_SAMPLES), np.float32), SFREQ)
    assert stub_embedder.calls[-1]["sfreq"] == SFREQ


def test_run_embedding_casts_input_to_float32(stub_embedder):
    """The model wants float32; the pgvector column wants float32; we cast."""
    run_embedding(np.zeros((CHANNELS, WINDOW_SAMPLES), np.float64), SFREQ)
    assert stub_embedder.calls[-1]["eeg_dtype"] == np.float32


def test_run_anomaly_detection_neutral_with_short_history():
    """Fewer than 5 history points → 0.0. The daemon depends on this to avoid
    flapping alerts during the baseline period.
    """
    emb = np.zeros(EMBEDDING_DIM, np.float32)
    assert run_anomaly_detection(emb, history=[]) == 0.0
    assert run_anomaly_detection(emb, history=[emb] * 4) == 0.0


def test_run_anomaly_detection_is_zero_for_centroid_match():
    """A vector equal to the centroid → cosine_sim = 1 → score = 0."""
    rng = np.random.default_rng(0)
    v = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
    v /= np.linalg.norm(v)
    assert run_anomaly_detection(v, history=[v] * 10) == pytest.approx(0.0, abs=1e-6)


def test_run_anomaly_detection_is_mid_for_orthogonal():
    """Orthogonal vectors → cosine_sim = 0 → score = 0.5."""
    v = np.zeros(EMBEDDING_DIM, np.float32); v[0] = 1.0
    orth = np.zeros(EMBEDDING_DIM, np.float32); orth[1] = 1.0
    score = run_anomaly_detection(orth, history=[v] * 10)
    assert score == pytest.approx(0.5, abs=1e-6)


def test_run_anomaly_detection_is_max_for_antipodal():
    """cosine_sim = -1 → score = 1.0."""
    v = np.zeros(EMBEDDING_DIM, np.float32); v[0] = 1.0
    score = run_anomaly_detection(-v, history=[v] * 10)
    assert score == pytest.approx(1.0, abs=1e-6)


def test_run_anomaly_detection_stays_in_unit_interval():
    """Every score should land in [0, 1] regardless of input geometry."""
    rng = np.random.default_rng(7)
    history = [rng.normal(size=EMBEDDING_DIM).astype(np.float32) for _ in range(20)]
    for _ in range(50):
        v = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
        v /= np.linalg.norm(v) + 1e-8
        assert 0.0 <= run_anomaly_detection(v, history) <= 1.0
