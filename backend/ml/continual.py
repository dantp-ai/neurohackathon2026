"""Continual-learning orchestration.

The base model (EEGEmbedder) is frozen. This layer grows the small per-task heads
(TaskStore) as new caregiver-confirmed labels arrive.

Flow:
    LabelSource  --(embedding, task, label)-->  ContinualTrainer  -->  TaskStore
                                                  buffers per task,
                                                  refits a task's head once it has
                                                  >= update_every NEW labels.

A task is just a string (e.g. 'ad_vs_cn', 'falling', 'noise'); an unseen task name
auto-creates a head, so adding a new classifier needs nothing but labels carrying
that task name. In production the LabelSource is the database
(SupabaseLabelSource); in tests / the dementia simulation it is an
InMemoryLabelSource.
"""

from __future__ import annotations

from collections import defaultdict, deque

import numpy as np

from .store import TaskStore


class LabelSource:
    """A source of newly-labelled training samples."""

    def fetch_new(self):
        """Return a list of ``(embedding[d], task: str, label: str)`` for labels
        not yet returned. Implementations advance an internal cursor so each
        sample is delivered exactly once."""
        raise NotImplementedError


class InMemoryLabelSource(LabelSource):
    """Queue-backed source for simulation and tests."""

    def __init__(self):
        self._q = deque()

    def push(self, embedding, task: str, label: str):
        self._q.append((np.asarray(embedding, dtype=np.float32), str(task), str(label)))

    def push_many(self, embeddings, task: str, labels):
        for e, y in zip(embeddings, labels):
            self.push(e, task, y)

    def fetch_new(self):
        out = list(self._q)
        self._q.clear()
        return out


class SupabaseLabelSource(LabelSource):
    """Pulls caregiver-confirmed labels from the database and joins each to its
    EEG-segment embedding.

    In this schema the real training label is ``labels.activity``, so the default
    is a single task ``"activity"`` reading that column. ``task_columns`` maps a
    task name to the `labels` column holding its class if you ever need more than
    one. Each call returns confirmed labels newer than the last seen
    ``confirmed_at``:

        SELECT l.confirmed_at, l.activity, s.embedding
        FROM labels l JOIN eeg_segments s ON l.segment_id = s.id
        WHERE l.confirmed_by_caregiver AND l.confirmed_at > :cursor
              AND l.activity IS NOT NULL
        ORDER BY l.confirmed_at

    Integration adapter for the schema in supabase/migrations — wire to a
    supabase-py Client. Not unit-tested here (no live DB); the merge step
    confirms the exact client API.
    """

    def __init__(self, client, task_columns: dict | None = None,
                 since: str = "1970-01-01T00:00:00Z"):
        self.client = client
        # `labels.activity` is the only real training label in this schema.
        self.task_columns = dict(task_columns or {"activity": "activity"})
        self._cursor = since

    def fetch_new(self):
        out = []
        for task, col in self.task_columns.items():
            res = (
                self.client.table("labels")
                .select(f"confirmed_at, {col}, eeg_segments(embedding)")
                .eq("confirmed_by_caregiver", True)
                .gt("confirmed_at", self._cursor)
                .not_.is_(col, "null")
                .order("confirmed_at")
                .execute()
            )
            for row in res.data:
                emb = row["eeg_segments"]["embedding"]
                out.append((np.asarray(emb, dtype=np.float32), task, str(row[col])))
                self._cursor = max(self._cursor, row["confirmed_at"])
        return out


class ContinualTrainer:
    """Buffers incoming labels per task and refits a task's head once it has
    accumulated ``update_every`` new labels (an int, or a ``{task: int}`` dict
    for per-task thresholds, default 10)."""

    def __init__(self, store: TaskStore, source: LabelSource, update_every=10):
        self.store = store
        self.source = source
        self.update_every = update_every
        self._pending: dict[str, list] = defaultdict(list)
        self.history: list[dict] = []

    def _threshold(self, task: str) -> int:
        ue = self.update_every
        return ue.get(task, 10) if isinstance(ue, dict) else ue

    def step(self) -> list[dict]:
        """Ingest new labels and update any task that crossed its threshold.
        Returns the update events fired this step."""
        for emb, task, label in self.source.fetch_new():
            self._pending[task].append((emb, label))
        events = []
        for task, items in list(self._pending.items()):
            if len(items) >= self._threshold(task):
                events.append(self._flush(task))
        return events

    def flush_all(self) -> list[dict]:
        """Force an update for every task with pending labels (e.g. at shutdown)."""
        return [self._flush(t) for t, items in list(self._pending.items()) if items]

    def _flush(self, task: str) -> dict:
        items = self._pending[task]
        X = np.vstack([e for e, _ in items])
        y = np.array([lab for _, lab in items])
        metrics = self.store.update(task, X, y)
        self._pending[task] = []
        event = {"task": task, "n_new": len(items), **metrics}
        self.history.append(event)
        return event
