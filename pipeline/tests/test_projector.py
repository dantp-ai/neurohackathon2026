"""Tests for pipeline.projector.UmapProjector.

The projector fits a UMAP reducer once on a reference embedding set and then
projects live 384-d embeddings to (x, y) for the caregiver Map tab. Failure
modes we want to nail down:

  - No reference / too few points → reducer stays None; transform must
    return (None, None), not raise. The daemon writes the row without
    umap_x/y in that case (columns are nullable), so a silent regression
    that raises here would kill the whole insert.
  - `.transform(...)` must return finite floats when the reducer is fitted;
    a NaN slips into the DB and the frontend renders it as (0, 0).
  - Determinism: same input, same output (with random_state=0 in the
    constructor). Regressions here would make the Map jitter for identical
    embeddings.
"""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.projector import UmapProjector

EMBEDDING_DIM = 384


@pytest.fixture(scope="module")
def reference_embeddings() -> np.ndarray:
    """Small synthetic reference set - enough to fit UMAP, small enough to
    keep the test fast (~2s to fit)."""
    rng = np.random.default_rng(0)
    ref = rng.normal(size=(30, EMBEDDING_DIM)).astype(np.float32)
    ref /= np.linalg.norm(ref, axis=1, keepdims=True) + 1e-8
    return ref


@pytest.fixture(scope="module")
def fitted_projector(reference_embeddings) -> UmapProjector:
    """One fitted projector, reused across tests in this module."""
    return UmapProjector(reference_embeddings)


def test_no_reference_yields_null_coords():
    """No fitted reducer → (None, None). Must not raise."""
    p = UmapProjector(reference=None)
    assert p.reducer is None
    assert p.transform(np.zeros(EMBEDDING_DIM, np.float32)) == (None, None)


def test_too_few_reference_points_yields_null_coords():
    """< 10 reference points is treated as no reference (UMAP won't fit meaningfully)."""
    rng = np.random.default_rng(0)
    too_few = rng.normal(size=(5, EMBEDDING_DIM)).astype(np.float32)
    p = UmapProjector(reference=too_few)
    assert p.reducer is None
    assert p.transform(np.zeros(EMBEDDING_DIM, np.float32)) == (None, None)


def test_fitted_projector_returns_finite_floats(fitted_projector):
    rng = np.random.default_rng(1)
    v = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
    v /= np.linalg.norm(v)
    x, y = fitted_projector.transform(v)
    assert isinstance(x, float) and isinstance(y, float)
    assert np.isfinite(x) and np.isfinite(y)


def test_transform_is_deterministic(fitted_projector):
    """Same input → same output. Guard against a future refactor that drops
    random_state and turns the Map into a jitter animation."""
    rng = np.random.default_rng(2)
    v = rng.normal(size=EMBEDDING_DIM).astype(np.float32)
    v /= np.linalg.norm(v)
    x1, y1 = fitted_projector.transform(v)
    x2, y2 = fitted_projector.transform(v)
    assert (x1, y1) == (x2, y2)


def test_default_projector_handles_missing_reference(monkeypatch, tmp_path):
    """When the reference NPZ is missing, `.default()` falls back cleanly.
    Simulate this by pointing _DEFAULT_REF at a non-existent path."""
    from pipeline import projector as projector_mod

    monkeypatch.setattr(projector_mod, "_DEFAULT_REF", tmp_path / "does-not-exist.npz")
    p = UmapProjector.default()
    assert p.reducer is None
    assert p.transform(np.zeros(EMBEDDING_DIM, np.float32)) == (None, None)
