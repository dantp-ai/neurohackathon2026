"""Per-task classifier head on frozen EEG embeddings (continual-learning ready).

Rehearsal-based continual learning: every (embedding, label) sample is kept in a
bounded buffer and the head is refit on update(). Frozen embeddings are tiny, so
this is cheap and free of catastrophic forgetting — the standard approach when the
feature extractor is frozen. One TaskHead per task (e.g. 'ad_vs_cn').

A head needs >=2 classes before it can predict; until then update() just buffers.
"""

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score


class TaskHead:
    def __init__(self, task: str, max_buffer: int = 20000, C: float = 1.0, seed: int = 0):
        self.task = task
        self.max_buffer = max_buffer
        self.C = C
        self.seed = seed
        self._X: np.ndarray | None = None   # buffered embeddings [n, d]
        self._y: np.ndarray | None = None   # buffered labels [n]
        self.clf: LogisticRegression | None = None
        self.classes_: np.ndarray | None = None
        self.n_seen = 0                     # total samples ever (pre-eviction)

    # -- continual update -----------------------------------------------------
    def update(self, X, y) -> dict:
        """Add labelled samples and refit. X: [n, d] or [d]; y: [n] or scalar."""
        X = np.asarray(X, dtype=np.float32)
        if X.ndim == 1:
            X = X[None]
        y = np.atleast_1d(np.asarray(y))
        if len(X) != len(y):
            raise ValueError(f"X/y length mismatch: {len(X)} vs {len(y)}")
        self.n_seen += len(y)
        self._X = X if self._X is None else np.vstack([self._X, X])
        self._y = y if self._y is None else np.concatenate([self._y, y])
        self._evict()
        self._refit()
        return self.metrics()

    def _evict(self):
        """Cap the buffer with a seeded random subsample (keeps class diversity
        better than pure recency when one class streams in bursts)."""
        n = len(self._y)
        if n <= self.max_buffer:
            return
        rng = np.random.default_rng(self.seed)
        keep = rng.choice(n, size=self.max_buffer, replace=False)
        self._X, self._y = self._X[keep], self._y[keep]

    def _refit(self):
        self.classes_ = np.unique(self._y)
        if len(self.classes_) < 2:
            self.clf = None
            return
        self.clf = LogisticRegression(
            C=self.C, max_iter=2000, class_weight="balanced", random_state=self.seed
        )
        self.clf.fit(self._X, self._y)

    # -- inference ------------------------------------------------------------
    @property
    def ready(self) -> bool:
        return self.clf is not None

    def _check_ready(self):
        if self.clf is None:
            raise RuntimeError(
                f"Task '{self.task}' not ready: needs >=2 classes "
                f"(seen {self.n_seen} samples, classes so far "
                f"{None if self._y is None else np.unique(self._y).tolist()})."
            )

    def predict_proba(self, X) -> np.ndarray:
        self._check_ready()
        X = np.asarray(X, dtype=np.float32)
        if X.ndim == 1:
            X = X[None]
        return self.clf.predict_proba(X)

    def predict(self, X) -> np.ndarray:
        proba = self.predict_proba(X)
        return self.classes_[proba.argmax(1)]

    def metrics(self) -> dict:
        n_buf = 0 if self._y is None else len(self._y)
        if self.clf is None:
            return {"task": self.task, "ready": False, "n_seen": self.n_seen,
                    "n_buffer": n_buf, "classes": None}
        return {"task": self.task, "ready": True, "n_seen": self.n_seen,
                "n_buffer": n_buf, "classes": self.classes_.tolist(),
                "train_acc": float(accuracy_score(self._y, self.clf.predict(self._X)))}
