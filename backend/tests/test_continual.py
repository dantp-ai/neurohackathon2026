"""Tests for the continual-learning orchestration (no model load)."""

import numpy as np
import pytest

from ml import TaskStore
from ml.continual import InMemoryLabelSource, ContinualTrainer


def test_in_memory_source_drains():
    s = InMemoryLabelSource()
    s.push([0, 1], "t", "a")
    s.push([1, 0], "t", "b")
    assert len(s.fetch_new()) == 2
    assert s.fetch_new() == []          # drained


def test_update_fires_only_at_threshold(tmp_path):
    store = TaskStore(root=str(tmp_path))
    src = InMemoryLabelSource()
    tr = ContinualTrainer(store, src, update_every=10)
    rng = np.random.default_rng(0)
    for i in range(9):                  # 9 labels, both classes
        src.push(rng.normal(size=8), "task", "AD" if i % 2 else "CN")
    assert tr.step() == []              # below threshold -> no update
    assert store.list_tasks() == []
    src.push(rng.normal(size=8), "task", "CN")   # 10th
    ev = tr.step()
    assert len(ev) == 1 and ev[0]["task"] == "task" and ev[0]["n_new"] == 10
    assert store.list_tasks() == ["task"] and store.get("task").ready


def test_tasks_update_independently(tmp_path):
    store = TaskStore(root=str(tmp_path))
    src = InMemoryLabelSource()
    tr = ContinualTrainer(store, src, update_every=5)
    rng = np.random.default_rng(1)
    for i in range(5):
        src.push(rng.normal(size=8), "A", "x" if i < 3 else "y")
    for _ in range(3):
        src.push(rng.normal(size=8), "B", "p")
    ev = tr.step()
    assert {e["task"] for e in ev} == {"A"}     # only A hit 5
    assert len(tr._pending["B"]) == 3           # B still buffered


def test_per_task_thresholds_and_flush(tmp_path):
    store = TaskStore(root=str(tmp_path))
    src = InMemoryLabelSource()
    tr = ContinualTrainer(store, src, update_every={"fast": 2})   # default 10 otherwise
    rng = np.random.default_rng(2)
    for i in range(2):
        src.push(rng.normal(size=8), "fast", "a" if i == 0 else "b")
    for i in range(3):
        src.push(rng.normal(size=8), "slow", "a" if i < 2 else "b")
    fired = tr.step()
    assert {e["task"] for e in fired} == {"fast"}   # slow (3) < default 10
    ev = tr.flush_all()                              # force the rest
    assert {e["task"] for e in ev} == {"slow"}
    assert set(store.list_tasks()) == {"fast", "slow"}
