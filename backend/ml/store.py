"""Registry of per-task heads with disk persistence.

This is the surface the continual-learning / database service calls. Each task's
head is one joblib file under `root`. Heads are created lazily on first update().
"""

from __future__ import annotations

import os

import joblib

from .head import TaskHead


class TaskStore:
    def __init__(self, root: str = "task_heads"):
        self.root = root
        os.makedirs(root, exist_ok=True)
        self._cache: dict[str, TaskHead] = {}

    def _path(self, task: str) -> str:
        return os.path.join(self.root, f"{task}.joblib")

    def get(self, task: str, create: bool = True) -> TaskHead:
        if task in self._cache:
            return self._cache[task]
        path = self._path(task)
        if os.path.exists(path):
            head = joblib.load(path)
        elif create:
            head = TaskHead(task)
        else:
            raise KeyError(f"No head for task '{task}'")
        self._cache[task] = head
        return head

    def update(self, task: str, X, y) -> dict:
        """Add labelled samples to a task and persist. Returns head metrics."""
        head = self.get(task)
        metrics = head.update(X, y)
        joblib.dump(head, self._path(task))
        return metrics

    def predict(self, task: str, X):
        return self.get(task, create=False).predict(X)

    def predict_proba(self, task: str, X):
        return self.get(task, create=False).predict_proba(X)

    def list_tasks(self) -> list[str]:
        return sorted(f[:-7] for f in os.listdir(self.root) if f.endswith(".joblib"))
