"""Fast tests for the per-task head + store (no foundation model load).

The head/store logic is tested on synthetic separable embeddings so these run in
milliseconds. The embedder itself is exercised by demo_dementia.py --synthetic.
"""

import numpy as np
import pytest

from ml import TaskHead, TaskStore


def separable(n=60, d=192, seed=0):
    """Two L2-normalized, linearly-separable embedding clusters."""
    rng = np.random.default_rng(seed)
    a = rng.normal(0.5, 0.1, (n, d)).astype(np.float32)
    b = rng.normal(-0.5, 0.1, (n, d)).astype(np.float32)
    X = np.vstack([a, b])
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    y = np.array(["AD"] * n + ["CN"] * n)
    return X, y


def test_head_needs_two_classes():
    h = TaskHead("t")
    m = h.update(np.ones((3, 8), np.float32), ["AD", "AD", "AD"])
    assert not h.ready and not m["ready"]
    with pytest.raises(RuntimeError):
        h.predict(np.ones((1, 8), np.float32))


def test_head_learns_separable():
    X, y = separable()
    h = TaskHead("ad_vs_cn")
    m = h.update(X, y)
    assert h.ready and m["train_acc"] > 0.95
    assert set(h.predict(X)) == {"AD", "CN"}
    assert h.predict_proba(X).shape == (len(X), 2)


def test_continual_update_accumulates():
    X, y = separable(n=80)
    h = TaskHead("t")
    # stream in 8 chunks; buffer + n_seen grow, accuracy stays high
    for xs, ys in zip(np.array_split(X, 8), np.array_split(y, 8)):
        h.update(xs, ys)
    assert h.n_seen == len(X)
    assert h.metrics()["n_buffer"] == len(X)
    assert (h.predict(X) == y).mean() > 0.95


def test_buffer_eviction_caps():
    h = TaskHead("t", max_buffer=50)
    X, y = separable(n=100)  # 200 samples > cap
    h.update(X, y)
    assert h.metrics()["n_buffer"] == 50
    assert h.n_seen == 200


def test_store_persistence(tmp_path):
    X, y = separable()
    s1 = TaskStore(root=str(tmp_path))
    s1.update("ad_vs_cn", X, y)
    assert "ad_vs_cn" in s1.list_tasks()
    # fresh store reads the persisted head from disk
    s2 = TaskStore(root=str(tmp_path))
    assert (s2.predict("ad_vs_cn", X) == y).mean() > 0.95


def test_store_unknown_task_raises(tmp_path):
    s = TaskStore(root=str(tmp_path))
    with pytest.raises(KeyError):
        s.get("nope", create=False)
